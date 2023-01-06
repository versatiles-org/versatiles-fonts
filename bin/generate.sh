#!/bin/bash
cd "$(dirname "$0")"

rm -rf ../dist || true
node convert_fonts.js

