#!/usr/bin/env bash
set -euo pipefail

# Usage: npm run release -- <patch|minor|major> [--dry-run]
#
# 1) Checks that main is clean, pushed, passes `npm run check` and CI.
# 2) Bumps the version in package.json and package-lock.json, commits and pushes it.
# 3) Creates a GitHub prerelease at exactly that commit. Its tag starts the release
#    workflow, which builds and uploads the archives, publishes the release and
#    triggers the versatiles-frontend release.
#
# With --dry-run, only the checks run and nothing is changed.

# Move to the parent of this script's directory
cd "$(dirname "$0")/.."

ORG="versatiles-org"
REPO="versatiles-fonts"

# 1) Parse arguments
INCREMENT_TYPE="${1-}"
DRY_RUN=false
if [ "${2-}" = "--dry-run" ]; then
	DRY_RUN=true
elif [ -n "${2-}" ]; then
	echo "Error: unknown option '$2'"
	exit 1
fi

case "$INCREMENT_TYPE" in
patch | minor | major) ;;
*)
	echo "Usage: npm run release -- <patch|minor|major> [--dry-run]"
	exit 1
	;;
esac

# 2) Ensure the release is made from a clean, pushed main branch.
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

# 3) Check the code (typecheck, formatting) and the build configuration
echo "Checking code..."
npm run --silent check
npm run --silent build -- --dry-run >/dev/null

# 4) Ensure CI has passed for this commit
CI_STATUS=$(gh run list -R "$ORG/$REPO" --workflow ci.yml --commit "$LOCAL_SHA" --limit 1 --json status,conclusion -q '.[0] | "\(.status) \(.conclusion)"' 2>/dev/null || true)
case "$CI_STATUS" in
"completed success") echo "CI passed for ${LOCAL_SHA:0:7}." ;;
"") echo "Error: no CI run found for ${LOCAL_SHA:0:7}" && exit 1 ;;
completed*) echo "Error: CI failed for ${LOCAL_SHA:0:7} ($CI_STATUS)" && exit 1 ;;
*) echo "Error: CI for ${LOCAL_SHA:0:7} has not finished yet ($CI_STATUS). Try again later." && exit 1 ;;
esac

# 5) Read the current version from package.json and make sure it matches the latest release
CURRENT_VERSION=$(node -p "require('./package.json').version")
LATEST_RELEASE=$(gh release list -R "$ORG/$REPO" --exclude-drafts --limit 1 --json tagName -q '.[0].tagName' 2>/dev/null || true)
if [ -z "$LATEST_RELEASE" ]; then
	echo "Error: no releases found"
	exit 1
fi
if [ "$LATEST_RELEASE" != "v$CURRENT_VERSION" ]; then
	echo "Error: package.json version ($CURRENT_VERSION) does not match the latest release ($LATEST_RELEASE)"
	exit 1
fi

# 6) Bump according to the argument
IFS='.' read -r major minor patch <<<"$CURRENT_VERSION"
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
NEW_VERSION="${major}.${minor}.${patch}"
NEW_TAG="v${NEW_VERSION}"

if git ls-remote --exit-code --tags origin "refs/tags/$NEW_TAG" >/dev/null; then
	echo "Error: tag $NEW_TAG already exists on origin"
	exit 1
fi

echo "Current version: $CURRENT_VERSION"
echo "New version:     $NEW_VERSION"

if [ "$DRY_RUN" = true ]; then
	echo "Dry run: all checks passed, nothing was changed."
	exit 0
fi

# 7) Confirm, since the release publishes the archives and triggers the versatiles-frontend release
CONFIRM=""
read -r -p "Bump to $NEW_VERSION, push and create release $NEW_TAG? [y/N] " CONFIRM || true
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
	echo "Aborted."
	exit 1
fi

# 8) Bump the version, commit and push
npm version "$NEW_VERSION" --no-git-tag-version >/dev/null
git add package.json package-lock.json
git commit --quiet -m "chore: release $NEW_TAG"
git push --quiet origin main
RELEASE_SHA=$(git rev-parse HEAD)

# 9) Create the prerelease (and its tag) on GitHub at exactly the version commit
gh release create "$NEW_TAG" -R "$ORG/$REPO" \
	--target "$RELEASE_SHA" \
	--title "$NEW_TAG" \
	--generate-notes \
	--prerelease

echo "Release $NEW_TAG created at ${RELEASE_SHA:0:7}. The release workflow builds and publishes it."
