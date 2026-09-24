#!/usr/bin/env bash
set -euo pipefail

default_image="cr.umapps.net/umapps/directito"
docker_image="${1:-}"
platforms="${PLATFORMS:-linux/amd64,linux/arm64}"

case "$(uname -m)" in
arm64)
	local_platform="linux/arm64"
	;;
x86_64 | amd64)
	local_platform="linux/amd64"
	;;
*)
	echo "Error: unsupported local architecture: $(uname -m)" >&2
	exit 1
	;;
esac

if [ -z "${docker_image}" ]; then
	echo
	printf "Docker image [%s]: " "${default_image}"
	read -r entered_image
	docker_image="${entered_image:-$default_image}"
fi

echo
printf "Push image after build? [y/N]: "
read -r push_confirmation
push_image="false"

if [[ "${push_confirmation}" =~ ^[Yy]([Ee][Ss])?$ ]]; then
	push_image="true"
fi

if ! command -v docker >/dev/null 2>&1; then
	echo "Error: docker is required to build the image." >&2
	exit 1
fi

if ! docker buildx version >/dev/null 2>&1; then
	echo "Error: docker buildx is required to build multi-platform images." >&2
	exit 1
fi

if ! docker info >/dev/null 2>&1; then
	echo "Error: docker is not running or is not accessible." >&2
	exit 1
fi

base_version="$(node -p "require('./directus/package.json').version")"
current_tag="$(git tag --points-at HEAD --list 'v[0-9]*' | sort -V | tail -n 1)"

if [ -n "${current_tag}" ]; then
	version="${current_tag#v}"
else
	timestamp="$(date '+%Y%m%d%H%M%S')"
	version="${base_version}-local.${timestamp}"
fi

extra_tag="latest"

if [[ "${version}" == *-* ]]; then
	extra_tag="canary"
fi

echo
echo "Action: build local multi-platform Docker image"
echo
echo "Plan:"
echo "- Repository: $(pwd)"
echo "- Docker image: ${docker_image}"
echo "- Platforms: ${platforms}"
echo "- Local load platform: ${local_platform}"
echo "- Version tag: ${docker_image}:${version}"
echo "- Alias tag: ${docker_image}:${extra_tag}"
echo "- Push image: ${push_image}"

if [ -z "${current_tag}" ]; then
	echo "- Source tag: none found on HEAD; using local prerelease tag from directus/package.json"
else
	echo "- Source tag: ${current_tag}"
fi

echo
if [ "${push_image}" = "true" ]; then
	echo "This script will push the built image and manifest list to the configured registry."
	echo "Make sure you are logged in with: docker login"
else
	echo "This script will build the configured platforms into the Buildx cache without pushing."
	echo "Use LOAD at confirmation to build only ${local_platform} and load the image into local Docker."
fi

echo
echo "Type BUILD to continue, or LOAD to build only ${local_platform} and load into local Docker."
echo "Anything else aborts."
read -r confirmation

load_image="false"

if [ "${confirmation}" = "LOAD" ]; then
	push_image="false"
	load_image="true"
	platforms="${local_platform}"
elif [ "${confirmation}" != "BUILD" ]; then
	echo "Aborted."
	exit 0
fi

echo
echo "Preparing Docker Buildx builder..."
if ! docker buildx inspect >/dev/null 2>&1; then
	docker buildx create --use >/dev/null
fi

docker buildx inspect --bootstrap >/dev/null

echo
echo "Building image..."
build_args=(
	--file ./Dockerfile
	--platform "${platforms}"
	--provenance=true
	--tag "${docker_image}:${version}"
	--tag "${docker_image}:${extra_tag}"
)

if [ "${push_image}" = "true" ]; then
	build_args+=(--push)
elif [ "${load_image}" = "true" ]; then
	build_args+=(--load)
fi

docker buildx build "${build_args[@]}" .

echo
echo "Done."

if [ "${push_image}" = "true" ]; then
	echo
	echo "Inspecting pushed image..."
	docker buildx imagetools inspect "${docker_image}:${version}"

	echo
	echo "Published:"
	echo "${docker_image}:${version}"
	echo "${docker_image}:${extra_tag}"
else
	if [ "${load_image}" = "true" ]; then
		echo "Built and loaded local image:"
		echo "${docker_image}:${version}"
		echo "${docker_image}:${extra_tag}"
	else
		echo "Built configured platforms into the Buildx cache."
		echo
		echo "To push the image and manifest list, run:"
		printf "docker buildx build --file ./Dockerfile --platform %q --provenance=true --tag %q --tag %q --push .\n" \
			"${platforms}" \
			"${docker_image}:${version}" \
			"${docker_image}:${extra_tag}"
	fi
fi
