#!/usr/bin/env bash
set -euo pipefail

# Move to the parent of this script's directory
cd "$(dirname "$0")/.."

ORG="versatiles-org"
REPO="versatiles-fonts"

# 1) Check if an argument was provided
if [ $# -eq 0 ]; then
	echo "Usage: $0 <patch|minor|major>"
	exit 1
fi

INCREMENT_TYPE="$1"

# 2) Validate argument is one of patch, minor, or major
case "$INCREMENT_TYPE" in
patch | minor | major) ;;
*)
	echo "Error: argument must be 'patch', 'minor', or 'major'"
	exit 1
	;;
esac

# 3) Get the latest release tag name (e.g. "v1.2.3") from GitHub
#    If no releases exist, throw an error.
LATEST_RELEASE=$(gh release list -R "$ORG/$REPO" --limit 1 --json tagName -q '.[0].tagName' 2>/dev/null || true)
if [ -z "$LATEST_RELEASE" ]; then
	echo "Error: no releases found"
	exit 1
fi

# Strip off the leading 'v' to parse SemVer
CURRENT_VERSION="${LATEST_RELEASE#v}"

# 4) Parse the current version into major, minor, patch
IFS='.' read -r major minor patch <<<"$CURRENT_VERSION"

# 5) Bump according to the argument
case "$INCREMENT_TYPE" in
patch)
	patch=$((patch + 1))
	;;
minor)
	minor=$((minor + 1))
	patch=0
	;;
major)
	major=$((major + 1))
	minor=0
	patch=0
	;;
esac

# 6) Construct the new version string with a leading 'v'
NEW_VERSION="v${major}.${minor}.${patch}"

echo "Current version: $LATEST_RELEASE"
echo "New version: $NEW_VERSION"

# 7) Create a new release (which also pushes the new tag) on GitHub
gh release create "$NEW_VERSION" -R "$ORG/$REPO" \
	--generate-notes \
	--prerelease

echo "Release $NEW_VERSION created successfully."
