#!/bin/bash
# Builds dist/RoboVac.app — a self-contained, offline, double-clickable Mac app.
set -euo pipefail
cd "$(dirname "$0")"

APP=dist/RoboVac.app
echo "==> Cleaning"
rm -rf dist build-tmp
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web/vendor" build-tmp

echo "==> Compiling app (universal: arm64 + x86_64)"
swiftc -O -target arm64-apple-macos12 -o build-tmp/RoboVac-arm64 mac-app/main.swift -framework Cocoa -framework WebKit
swiftc -O -target x86_64-apple-macos12 -o build-tmp/RoboVac-x86_64 mac-app/main.swift -framework Cocoa -framework WebKit
lipo -create -output "$APP/Contents/MacOS/RoboVac" build-tmp/RoboVac-arm64 build-tmp/RoboVac-x86_64

echo "==> Generating icon"
swift mac-app/makeicon.swift build-tmp/icon_1024.png
ICONSET=build-tmp/RoboVac.iconset
mkdir -p "$ICONSET"
for entry in "16 icon_16x16.png" "32 icon_16x16@2x.png" "32 icon_32x32.png" "64 icon_32x32@2x.png" \
             "128 icon_128x128.png" "256 icon_128x128@2x.png" "256 icon_256x256.png" \
             "512 icon_256x256@2x.png" "512 icon_512x512.png" "1024 icon_512x512@2x.png"; do
  size="${entry%% *}"; name="${entry#* }"
  sips -z "$size" "$size" build-tmp/icon_1024.png --out "$ICONSET/$name" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/RoboVac.icns"

echo "==> Bundling game files"
cp mac-app/Info.plist "$APP/Contents/Info.plist"
cp index.html main.js "$APP/Contents/Resources/web/"
cp vendor/three.module.min.js "$APP/Contents/Resources/web/vendor/"

echo "==> Signing (ad-hoc)"
codesign --force --deep -s - "$APP"

rm -rf build-tmp
echo "==> Done: $APP"
