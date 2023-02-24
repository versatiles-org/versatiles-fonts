#!/usr/bin/env bash
cd "$(dirname "$0")"
set -e

rm -rf ../dist || true

node convert_fonts.js
