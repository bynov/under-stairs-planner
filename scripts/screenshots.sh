#!/usr/bin/env bash
# Regenerates raster assets: icons from SVG, OG image, and app screenshots via headless Chrome.
# Needs: rsvg-convert, magick, Google Chrome, and `pnpm dev` running on :5173.
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d)
rsvg-convert -w 180 -h 180 public/favicon.svg -o public/apple-touch-icon.png
rsvg-convert -w 32 -h 32 public/favicon.svg -o "$TMP/favicon-32.png"
magick "$TMP/favicon-32.png" public/favicon.ico
rsvg-convert -w 1200 -h 630 site/og.svg -o public/og.png
mkdir -p public/img
shot() { # $1 = url, $2 = out file
  "$CHROME" --headless=new --disable-gpu --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
    --window-size=1600,1000 --virtual-time-budget=8000 --screenshot="$2" "$1" 2>/dev/null
  magick "$2" -strip "$2"
}
shot "http://localhost:5173/app/?lang=en&shot=3d" public/img/3d.png
shot "http://localhost:5173/app/?lang=en&shot=front" public/img/front.png
rm -rf "$TMP"
echo "assets written"
