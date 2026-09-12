#!/usr/bin/env bash
# fix_telegram_bridge.sh
# Run this ON the Azure VM inside ~/projects/AlphaArena/telegram-bot
#
# Usage:
#   cd ~/projects/AlphaArena/telegram-bot
#   bash fix_telegram_bridge.sh

set -uo pipefail

DIR="$(pwd)"
echo "==> Working in: $DIR"
echo

if [ ! -f "bot.js" ]; then
  echo "!! bot.js not found in current directory. cd to ~/projects/AlphaArena/telegram-bot and re-run."
  exit 1
fi

TS=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backup-$TS"
mkdir -p "$BACKUP_DIR"

echo "==> Backing up bot.js and .env (if present) to $BACKUP_DIR/"
cp -v bot.js "$BACKUP_DIR/" 2>/dev/null
[ -f .env ] && cp -v .env "$BACKUP_DIR/"
echo

# ---------------------------------------------------------
# STEP 1: Fix localhost -> 127.0.0.1 for OpenCode URL
# ---------------------------------------------------------
echo "==> Step 1: Searching for 'localhost:4096' references"
grep -rn "localhost:4096" . --include="*.js" --include=".env" 2>/dev/null | grep -v node_modules

if [ -f .env ] && grep -q "localhost:4096" .env; then
  echo "--> Fixing .env"
  sed -i 's/localhost:4096/127.0.0.1:4096/g' .env
fi

if grep -q "localhost:4096" bot.js 2>/dev/null; then
  echo "--> Fixing bot.js"
  sed -i 's/localhost:4096/127.0.0.1:4096/g' bot.js
fi
echo "==> Step 1 done."
echo

# ---------------------------------------------------------
# STEP 2: Fix common TelegramBot import mistakes
# ---------------------------------------------------------
echo "==> Step 2: Checking TelegramBot import in bot.js"
grep -n "require(\"node-telegram-bot-api\")\|require('node-telegram-bot-api')" bot.js

# Fix destructured import: const { TelegramBot } = require(...)  ->  const TelegramBot = require(...)
if grep -qE "const\s*\{\s*TelegramBot\s*\}\s*=\s*require\(['\"]node-telegram-bot-api['\"]\)" bot.js; then
  echo "--> Found bad destructured import. Fixing to default import."
  sed -i -E "s/const\s*\{\s*TelegramBot\s*\}\s*=\s*require\(['\"]node-telegram-bot-api['\"]\)/const TelegramBot = require(\"node-telegram-bot-api\")/" bot.js
else
  echo "--> No destructured-import pattern found (may already be correct, or uses a different pattern — check manually if constructor error persists)."
fi
echo

# ---------------------------------------------------------
# STEP 3: Reinstall the package clean (clears cache weirdness)
# ---------------------------------------------------------
echo "==> Step 3: Clean reinstall of node-telegram-bot-api"
npm uninstall node-telegram-bot-api
npm install node-telegram-bot-api@latest
echo

# ---------------------------------------------------------
# STEP 4: Restart via PM2
# ---------------------------------------------------------
echo "==> Step 4: Restarting telegram-bridge via PM2"
pm2 restart telegram-bridge
sleep 2
pm2 status
echo

# ---------------------------------------------------------
# STEP 5: Show fresh logs
# ---------------------------------------------------------
echo "==> Step 5: Recent logs (watch for 'OpenCode not reachable' or 'TelegramBot is not a constructor')"
pm2 logs telegram-bridge --lines 30 --nostream
echo

echo "==================================================="
echo "Done. Backups of original files are in: $DIR/$BACKUP_DIR"
echo "Now send a real test message via Telegram, then run:"
echo "  pm2 logs telegram-bridge --err --lines 20"
echo "to confirm no new errors appear."
echo "==================================================="

