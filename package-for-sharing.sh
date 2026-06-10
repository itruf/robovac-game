#!/bin/bash
# Builds the app and packages it as dist/RoboVac.zip, ready to send to a friend.
# The zip includes READ ME FIRST.txt explaining the one-time Gatekeeper unblock
# (the app is not notarized — that requires a paid Apple Developer account).
set -euo pipefail
cd "$(dirname "$0")"

./build-mac-app.sh

echo "==> Packaging for sharing"
cat > "dist/READ ME FIRST.txt" <<'EOF'
RoboVac: Home Sweet Home 🤖
===========================

macOS will block this app the first time because it isn't notarized by Apple
(it's a homemade game, not from the App Store). Unblocking takes 20 seconds
and is needed only once:

  EASIEST WAY
  1. Move RoboVac.app to your Applications folder (or anywhere you like).
  2. Double-click it once — macOS will say it can't be opened. Click OK.
  3. Open System Settings -> Privacy & Security, scroll down:
     you'll see "RoboVac was blocked...". Click "Open Anyway".
  4. Confirm. It opens and never asks again.

  TERMINAL WAY (same result, one line)
  1. Open Terminal and run:
       xattr -cr ~/Applications/RoboVac.app
     (adjust the path to wherever you put the app)
  2. Double-click the app.

Works on both Apple Silicon and Intel Macs (macOS 12 or newer).

HOW TO PLAY
  W/S drive · A/D turn · Shift boost · E pet/interact · Space horn · P pause

  You're a robot vacuum. Clean the house, dodge the dog, befriend the cat —
  and help Gary pull off his secret proposal to Maya. 💍
EOF

rm -rf dist/share dist/RoboVac.zip
mkdir dist/share
cp -R dist/RoboVac.app dist/share/
mv "dist/READ ME FIRST.txt" dist/share/
ditto -c -k --sequesterRsrc dist/share dist/RoboVac.zip
rm -rf dist/share
echo "==> Done: dist/RoboVac.zip (send this file)"
