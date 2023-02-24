#!/usr/bin/env bash
cd "$(dirname "$0")"
set -e

cd ../dist/

echo "delete temporary glyphs"
rm -rf fonts

echo "compress tar files"
parallel gzip -9f {} ::: *.tar
