#!/bin/bash
# WebSquare — Deploy to Hostinger
# Usage: ./deploy.sh [user@host]
#
# Deploys:
#   dist/                   → /public_html/          (frontend build)
#   ../inventory-api/       → /public_html/api/      (PHP backend)
#   public/.htaccess        → /public_html/.htaccess (SPA routing)

set -e

# ── Configuration ────────────────────────────────────
SSH_HOST="${1:-u929828006@92.113.27.245}"  # Update with actual Hostinger SSH host
SSH_PORT=65002
REMOTE_ROOT="/home/u929828006/public_html"
API_DIR="../inventory-api"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  WebSquare — Hostinger Deployment${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""

# ── Preflight checks ─────────────────────────────────
if [ ! -d "$API_DIR" ]; then
  echo -e "${RED}  ✗ API directory not found at ${API_DIR}${NC}"
  echo "    Expected: $(cd .. && pwd)/inventory-api/"
  exit 1
fi

# ── Step 1: Build frontend ──────────────────────────
echo -e "${YELLOW}[1/4] Building frontend...${NC}"
npm run build
echo -e "${GREEN}  ✓ Build complete ($(du -sh dist | cut -f1))${NC}"
echo ""

# ── Step 2: Upload frontend (dist/) ─────────────────
echo -e "${YELLOW}[2/4] Uploading frontend to ${REMOTE_ROOT}/...${NC}"
rsync -avz --delete \
  -e "ssh -p ${SSH_PORT}" \
  --exclude='api/' \
  dist/ "${SSH_HOST}:${REMOTE_ROOT}/"
echo -e "${GREEN}  ✓ Frontend uploaded${NC}"
echo ""

# ── Step 3: Upload API files ────────────────────────
echo -e "${YELLOW}[3/4] Uploading API to ${REMOTE_ROOT}/api/...${NC}"
rsync -avz --delete \
  -e "ssh -p ${SSH_PORT}" \
  --exclude='setup.php' \
  --exclude='.env' \
  --exclude='config.local.php' \
  "${API_DIR}/" "${SSH_HOST}:${REMOTE_ROOT}/api/"
echo -e "${GREEN}  ✓ API uploaded${NC}"
echo ""

# ── Step 4: Upload .htaccess ────────────────────────
echo -e "${YELLOW}[4/4] Uploading .htaccess...${NC}"
scp -P ${SSH_PORT} public/.htaccess "${SSH_HOST}:${REMOTE_ROOT}/.htaccess"
echo -e "${GREEN}  ✓ .htaccess uploaded${NC}"
echo ""

# ── Done ──────────────────────────────────────────────
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Deployment complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "  Test endpoints:"
echo "    Landing:  https://websquare.pro"
echo "    Pricing:  https://websquare.pro/#/pricing"
echo "    API:      https://websquare.pro/api/health.php"
echo ""
