#!/usr/bin/env bash
# Run this once via SSH to set up the Next.js app on Hostinger.
# Usage: bash setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$SCRIPT_DIR/web"

echo "=== CMS Market Intelligence — Hostinger Setup ==="
echo "Repo root: $SCRIPT_DIR"
echo "Web dir:   $WEB_DIR"
echo ""

# Pull latest
echo "[1/4] Pulling latest from GitHub..."
cd "$SCRIPT_DIR"
git pull origin claude/build-setup-aISLi

# Install + build (postinstall runs next build automatically)
echo "[2/4] Installing dependencies and building..."
cd "$WEB_DIR"
npm install

echo "[3/4] Build complete."
echo ""
echo "=== hPanel Settings ==="
echo "  Application root:         $WEB_DIR"
echo "  Application startup file: server.js"
echo "  Node.js version:          18 or 20"
echo ""
echo "[4/4] Done. Go to hPanel → Node.js → Restart your app."
