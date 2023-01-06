#!/bin/bash
cd "$(dirname "$0")"

rm -rf ../dist || true
node convert_fonts.js
tar -cf ../dist/fonts.tar -C ../dist/ fonts
gzip -9kfv ../dist/fonts.tar
