#!/usr/bin/env bash
set -euo pipefail

base_version="$(node -p "require('./directus/package.json').version")"
timestamp="$(date '+%Y%m%d%H%M%S')"
tag="v${base_version}-directito.${timestamp}"
image_tag="${base_version}-directito.${timestamp}"
branch="$(git branch --show-current)"
remote_url="$(git remote get-url origin)"
docker_image="docker.io/umappsnet/directito:${image_tag}"

if [ -z "${branch}" ]; then
  echo "Error: detached HEAD. Checkout a branch before releasing." >&2
  exit 1
fi

echo
echo "Action: create Directito release tag and push it"
echo
echo "Plan:"
echo "- Repository: $(pwd)"
echo "- Git remote: ${remote_url}"
echo "- Current branch: ${branch}"
echo "- Base Directus version: ${base_version}"
echo "- Release tag: ${tag}"
echo "- Docker image: ${docker_image}"
echo
echo "This script will:"
echo "1. Show current git status"
echo "2. Commit all uncommitted changes if any exist"
echo "3. Push branch '${branch}' to origin"
echo "4. Create local tag '${tag}'"
echo "5. Push tag '${tag}' to origin"
echo "6. Trigger GitHub Actions to build and push Docker image"
echo
echo "Current git status:"
git status --short

echo
echo "Authorization required."
echo "Type RELEASE to continue. Anything else aborts."
read -r confirmation

if [ "${confirmation}" != "RELEASE" ]; then
  echo "Aborted."
  exit 0
fi

echo
echo "Proceeding..."

if [ -z "$(git status --porcelain=v1 --untracked-files=normal)" ]; then
  echo
  echo "No uncommitted changes found."
else
  echo
  echo "Uncommitted changes found. Aborting release. Please commit or stash changes before releasing." >&2
  exit 1
fi

echo
echo "Pushing branch..."
git push origin "${branch}"

echo
echo "Creating tag..."
git tag "${tag}"

echo
echo "Pushing tag..."
git push origin "${tag}"

echo
echo "Done."
echo "Expected Docker image:"
echo "${docker_image}"
echo
echo "Because this is a prerelease tag, the workflow may also publish:"
echo "docker.io/umappsnet/directito:canary"
