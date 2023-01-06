#!/bin/bash
cd "$(dirname "$0")"

rm -rf ../dist || true

echo " -> convert fonts"
node convert_fonts.js
