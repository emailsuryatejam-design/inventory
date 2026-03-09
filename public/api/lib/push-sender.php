<?php
/**
 * WebSquare — Web Push Sender
 * Ported from Karibu Pantry Planner (pure PHP, VAPID + curl, no Composer)
 */

/**
 * Send a push notification to a single subscription
 *
 * @param array  $subscription  ['endpoint' => ..., 'p256dh' => ..., 'auth_key' => ...]
 * @param array  $payload       ['title' => ..., 'body' => ..., 'url' => ..., 'tag' => ...]
 * @return array ['success' => bool, 'status' => int, 'reason' => string]
 */
function sendPushNotification(array $subscription, array $payload): array {
    if (!defined('VAPID_PUBLIC_KEY') || !defined('VAPID_PRIVATE_KEY') || !defined('VAPID_SUBJECT')) {
        return ['success' => false, 'status' => 0, 'reason' => 'VAPID keys not configured'];
    }

    $endpoint = $subscription['endpoint'];
    $userPublicKey = $subscription['p256dh'];
    $userAuthToken = $subscription['auth_key'];

    if (!$endpoint || !$userPublicKey || !$userAuthToken) {
        return ['success' => false, 'status' => 0, 'reason' => 'Invalid subscription data'];
    }

    $payloadJson = json_encode($payload);

    // Create VAPID JWT
    $parsedUrl = parse_url($endpoint);
    $audience = $parsedUrl['scheme'] . '://' . $parsedUrl['host'];
    $jwt = createVapidJwt($audience);

    if (!$jwt) {
        return ['success' => false, 'status' => 0, 'reason' => 'Failed to create VAPID JWT'];
    }

    // Encrypt payload using Web Push encryption (aes128gcm)
    $encrypted = encryptPayload($payloadJson, $userPublicKey, $userAuthToken);
    if (!$encrypted) {
        return ['success' => false, 'status' => 0, 'reason' => 'Encryption failed'];
    }

    // Send via curl
    $headers = [
        'Content-Type: application/octet-stream',
        'Content-Encoding: aes128gcm',
        'Content-Length: ' . strlen($encrypted['ciphertext']),
        'TTL: 86400',
        'Authorization: vapid t=' . $jwt . ', k=' . VAPID_PUBLIC_KEY,
    ];

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $encrypted['ciphertext'],
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['success' => false, 'status' => 0, 'reason' => 'Curl error: ' . $curlError];
    }

    return [
        'success' => $httpCode === 201,
        'status'  => $httpCode,
        'reason'  => $httpCode === 201 ? 'Sent' : ($httpCode === 410 ? 'Subscription expired' : "HTTP $httpCode: $response"),
    ];
}

/**
 * Send push to all subscribers in a kitchen (tenant-scoped)
 */
function sendPushToKitchen(int $tenantId, int $kitchenId, array $payload, ?string $targetRole = null, ?int $excludeUserId = null): int {
    try {
        $pdo = getDB();

        $sql = 'SELECT ps.*, u.role FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id WHERE ps.tenant_id = ? AND ps.kitchen_id = ?';
        $params = [$tenantId, $kitchenId];

        if ($targetRole) {
            $sql .= ' AND u.role = ?';
            $params[] = $targetRole;
        }
        if ($excludeUserId) {
            $sql .= ' AND ps.user_id != ?';
            $params[] = $excludeUserId;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $subs = $stmt->fetchAll();

        $sent = 0;
        foreach ($subs as $sub) {
            $result = sendPushNotification($sub, $payload);
            if ($result['success']) {
                $sent++;
            } elseif ($result['status'] === 410) {
                // Remove expired subscription
                $pdo->prepare('DELETE FROM push_subscriptions WHERE id = ?')->execute([$sub['id']]);
            }
        }
        return $sent;
    } catch (Exception $e) {
        error_log('sendPushToKitchen error: ' . $e->getMessage());
        return 0;
    }
}

/**
 * Store in-app notification (tenant-scoped)
 */
function storeNotification(int $tenantId, int $kitchenId, ?int $userId, string $title, string $body, string $type = 'info', ?int $refId = null): void {
    try {
        $pdo = getDB();
        $stmt = $pdo->prepare('INSERT INTO notifications (tenant_id, kitchen_id, user_id, title, body, type, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$tenantId, $kitchenId, $userId, $title, $body, $type, $refId]);
    } catch (Exception $e) {
        error_log('storeNotification error: ' . $e->getMessage());
    }
}

// ── VAPID JWT Creation ──

function createVapidJwt(string $audience): ?string {
    $header = base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $payload = base64UrlEncode(json_encode([
        'aud' => $audience,
        'exp' => time() + 43200,
        'sub' => VAPID_SUBJECT,
    ]));

    $signingInput = "$header.$payload";

    // Load private key
    $privateKeyRaw = base64UrlDecode(VAPID_PRIVATE_KEY);
    $pem = createEcPem($privateKeyRaw);
    if (!$pem) return null;

    $key = openssl_pkey_get_private($pem);
    if (!$key) return null;

    $success = openssl_sign($signingInput, $derSignature, $key, OPENSSL_ALGO_SHA256);
    if (!$success) return null;

    // Convert DER signature to raw r||s (64 bytes)
    $rawSig = derToRaw($derSignature);
    if (!$rawSig) return null;

    return "$header.$payload." . base64UrlEncode($rawSig);
}

// ── Web Push Encryption (aes128gcm) ──

function encryptPayload(string $payload, string $userPublicKeyB64, string $userAuthB64): ?array {
    $userPublicKey = base64UrlDecode($userPublicKeyB64);
    $userAuth = base64UrlDecode($userAuthB64);

    if (strlen($userPublicKey) !== 65 || strlen($userAuth) !== 16) {
        return null;
    }

    // Generate local ECDH key pair
    $localKey = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if (!$localKey) return null;

    $localDetails = openssl_pkey_get_details($localKey);
    $localPublicKey = "\x04" . str_pad($localDetails['ec']['x'], 32, "\0", STR_PAD_LEFT)
                             . str_pad($localDetails['ec']['y'], 32, "\0", STR_PAD_LEFT);

    // ECDH shared secret
    $sharedSecret = computeEcdhSecret($localKey, $userPublicKey);
    if (!$sharedSecret) return null;

    // Generate salt
    $salt = random_bytes(16);

    // HKDF for IKM
    $ikm = hkdf($userAuth, $sharedSecret, "WebPush: info\x00" . $userPublicKey . $localPublicKey, 32);

    // HKDF for content encryption key
    $cek = hkdf($salt, $ikm, "Content-Encoding: aes128gcm\x00", 16);

    // HKDF for nonce
    $nonce = hkdf($salt, $ikm, "Content-Encoding: nonce\x00", 12);

    // Pad payload (minimum padding)
    $paddedPayload = $payload . "\x02";

    // AES-128-GCM encrypt
    $tag = '';
    $encrypted = openssl_encrypt($paddedPayload, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    if ($encrypted === false) return null;

    // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext + tag
    $rs = pack('N', 4096);
    $idLen = chr(65);
    $header = $salt . $rs . $idLen . $localPublicKey;

    return ['ciphertext' => $header . $encrypted . $tag];
}

// ── Crypto Helpers ──

function computeEcdhSecret($localKey, string $peerPublicKeyRaw): ?string {
    $peerX = substr($peerPublicKeyRaw, 1, 32);
    $peerY = substr($peerPublicKeyRaw, 33, 32);

    $peerPem = createEcPublicPem($peerX, $peerY);
    if (!$peerPem) return null;

    $peerKey = openssl_pkey_get_public($peerPem);
    if (!$peerKey) return null;

    if (function_exists('openssl_pkey_derive')) {
        $secret = openssl_pkey_derive($peerKey, $localKey, 32);
        return $secret ?: null;
    }

    return null;
}

function hkdf(string $salt, string $ikm, string $info, int $length): string {
    $prk = hash_hmac('sha256', $ikm, $salt, true);
    $t = '';
    $lastBlock = '';
    $counter = 1;
    while (strlen($t) < $length) {
        $lastBlock = hash_hmac('sha256', $lastBlock . $info . chr($counter), $prk, true);
        $t .= $lastBlock;
        $counter++;
    }
    return substr($t, 0, $length);
}

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
}

function derToRaw(string $der): ?string {
    if (ord($der[0]) !== 0x30) return null;
    $offset = 2;
    if (ord($der[1]) & 0x80) $offset++;

    if (ord($der[$offset]) !== 0x02) return null;
    $rLen = ord($der[$offset + 1]);
    $r = substr($der, $offset + 2, $rLen);
    $offset += 2 + $rLen;

    if (ord($der[$offset]) !== 0x02) return null;
    $sLen = ord($der[$offset + 1]);
    $s = substr($der, $offset + 2, $sLen);

    $r = str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT);
    $s = str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);

    return $r . $s;
}

function createEcPem(string $privateKeyRaw): ?string {
    $oid = hex2bin('06082A8648CE3D030107');
    $seq = "\x30" . chr(2 + 34 + 2 + strlen($oid))
         . "\x02\x01\x01"
         . "\x04\x20" . str_pad($privateKeyRaw, 32, "\0", STR_PAD_LEFT)
         . "\xa0" . chr(strlen($oid)) . $oid;

    $pem = "-----BEGIN EC PRIVATE KEY-----\n"
         . chunk_split(base64_encode($seq), 64, "\n")
         . "-----END EC PRIVATE KEY-----\n";

    $testKey = @openssl_pkey_get_private($pem);
    if (!$testKey) return null;

    return $pem;
}

function createEcPublicPem(string $x, string $y): ?string {
    $point = "\x04" . str_pad($x, 32, "\0", STR_PAD_LEFT) . str_pad($y, 32, "\0", STR_PAD_LEFT);
    $bitString = "\x03" . chr(strlen($point) + 1) . "\x00" . $point;

    $oid1 = hex2bin('06072A8648CE3D0201');
    $oid2 = hex2bin('06082A8648CE3D030107');
    $algId = "\x30" . chr(strlen($oid1) + strlen($oid2)) . $oid1 . $oid2;

    $seq = "\x30" . chr(strlen($algId) + strlen($bitString)) . $algId . $bitString;

    $pem = "-----BEGIN PUBLIC KEY-----\n"
         . chunk_split(base64_encode($seq), 64, "\n")
         . "-----END PUBLIC KEY-----\n";

    return $pem;
}
