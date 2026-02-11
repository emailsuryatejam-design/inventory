#!/bin/bash
# KCL Stores — Deploy to Hostinger
# Usage: ./deploy.sh [user@host]
#
# Deploys:
#   dist/        → /public_html/          (frontend build)
#   api/         → /public_html/api/      (PHP backend)
#   public/.htaccess → /public_html/.htaccess  (SPA routing)

set -e

# ── Configuration ────────────────────────────────────
SSH_HOST="${1:-u929828006@92.113.27.245}"  # Update with actual Hostinger SSH host
SSH_PORT=65002
REMOTE_ROOT="/home/u929828006/public_html"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  KCL Stores — Hostinger Deployment${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""

# ── Step 1: Build frontend ──────────────────────────
echo -e "${YELLOW}[1/4] Building frontend...${NC}"
npm run build
echo -e "${GREEN}  ✓ Build complete${NC}"
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
  api/ "${SSH_HOST}:${REMOTE_ROOT}/api/"
echo -e "${GREEN}  ✓ API uploaded${NC}"
echo ""

# ── Step 4: Upload .htaccess ────────────────────────
echo -e "${YELLOW}[4/4] Uploading .htaccess files...${NC}"
scp -P ${SSH_PORT} public/.htaccess "${SSH_HOST}:${REMOTE_ROOT}/.htaccess"
echo -e "${GREEN}  ✓ .htaccess uploaded${NC}"
echo ""

# ── Verify ──────────────────────────────────────────
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Deployment complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "  Test endpoints:"
echo "    Health:  https://yourdomain.com/api/health.php"
echo "    App:     https://yourdomain.com"
echo ""
