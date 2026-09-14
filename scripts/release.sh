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

# 3) Ensure the release is made from a clean, pushed main branch.
#    The release tag is created on GitHub, so unpushed commits would not be part of it.
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
	echo "Error: releases must be made from 'main', current branch is '$BRANCH'"
	exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
	echo "Error: working tree is not clean. Commit or stash these changes first:"
	git status --short
	exit 1
fi

echo "Fetching origin..."
git fetch --quiet origin main
LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse origin/main)
if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
	AHEAD=$(git rev-list --count origin/main..HEAD)
	BEHIND=$(git rev-list --count HEAD..origin/main)
	echo "Error: local main differs from origin/main ($AHEAD ahead, $BEHIND behind). Push or pull first."
	exit 1
fi

# 4) Check the code (typecheck, formatting) and the build configuration
echo "Checking code..."
npm run --silent check
npm run --silent build -- --dry-run >/dev/null

# 5) Ensure CI has passed for this commit
CI_STATUS=$(gh run list -R "$ORG/$REPO" --workflow ci.yml --commit "$LOCAL_SHA" --limit 1 --json status,conclusion -q '.[0] | "\(.status) \(.conclusion)"' 2>/dev/null || true)
case "$CI_STATUS" in
"completed success") echo "CI passed for ${LOCAL_SHA:0:7}." ;;
"") echo "Error: no CI run found for ${LOCAL_SHA:0:7}" && exit 1 ;;
completed*) echo "Error: CI failed for ${LOCAL_SHA:0:7} ($CI_STATUS)" && exit 1 ;;
*) echo "Error: CI for ${LOCAL_SHA:0:7} has not finished yet ($CI_STATUS). Try again later." && exit 1 ;;
esac

# 6) Get the latest release tag name (e.g. "v1.2.3") from GitHub
#    If no releases exist, throw an error.
LATEST_RELEASE=$(gh release list -R "$ORG/$REPO" --limit 1 --json tagName -q '.[0].tagName' 2>/dev/null || true)
if [ -z "$LATEST_RELEASE" ]; then
	echo "Error: no releases found"
	exit 1
fi

# Strip off the leading 'v' to parse SemVer
CURRENT_VERSION="${LATEST_RELEASE#v}"

# 7) Parse the current version into major, minor, patch
IFS='.' read -r major minor patch <<<"$CURRENT_VERSION"

# 8) Bump according to the argument
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

# 9) Construct the new version string with a leading 'v'
NEW_VERSION="v${major}.${minor}.${patch}"

echo "Current version: $LATEST_RELEASE"
echo "New version: $NEW_VERSION (commit ${LOCAL_SHA:0:7})"

# 10) Confirm, since creating the release starts the release workflow,
#     which publishes the archives and triggers the versatiles-frontend release.
CONFIRM=""
read -r -p "Create release $NEW_VERSION? [y/N] " CONFIRM || true
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
	echo "Aborted."
	exit 1
fi

# 11) Create a new release (which also creates the new tag) on GitHub, at exactly the checked commit
gh release create "$NEW_VERSION" -R "$ORG/$REPO" \
	--target "$LOCAL_SHA" \
	--generate-notes \
	--prerelease

echo "Release $NEW_VERSION created successfully."
