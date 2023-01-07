#!/bin/bash
cd "$(dirname "$0")"

cd ../dist/

echo " -> tar"
cd fonts
find . -name "*.pbf" -print0 | tar -cf ../fonts.tar --null --files-from -
cd ..

echo " -> gzip"
gzip -9kfv fonts.tar

echo " -> release"
release_version="v$(jq -r '.version' ../package.json)"
gh release create $release_version --generate-notes fonts.tar.gz
