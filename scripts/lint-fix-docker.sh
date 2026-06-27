#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

targets=("$@")

if [ "$#" -eq 0 ]; then
	targets=(".")
fi

platform="${PLATFORM:-}"

if [ -z "${platform}" ]; then
	case "$(uname -m)" in
		arm64)
			platform="linux/arm64"
			;;
		x86_64|amd64)
			platform="linux/amd64"
			;;
		*)
			echo "Error: unsupported local architecture: $(uname -m)" >&2
			exit 1
			;;
	esac
fi

image="uma-directus-node22-lint-fix:latest"

echo
echo "Action: run ESLint fix inside Docker"
echo
echo "Plan:"
echo "- Repository: $(pwd)"
echo "- Platform: ${platform}"
echo "- Dockerfile: Dockerfile.lint"
echo "- Image: ${image}"
echo "- Targets: ${targets[*]}"
echo

if ! command -v docker >/dev/null 2>&1; then
	echo "Error: docker is required." >&2
	exit 1
fi

if ! docker info >/dev/null 2>&1; then
	echo "Error: docker is not running or is not accessible." >&2
	exit 1
fi

docker buildx build \
	--file ./Dockerfile.lint \
	--platform "${platform}" \
	--tag "${image}" \
	--load \
	.

docker run --rm \
	--platform "${platform}" \
	--user "$(id -u):$(id -g)" \
	-v "$(pwd):/directus" \
	-v "uma-directus-pnpm-store:/pnpm-store" \
	-e HOME=/tmp \
	-e PNPM_HOME=/tmp/pnpm-home \
	-e XDG_CACHE_HOME=/tmp/cache \
	-w /directus \
	"${image}" \
	sh -lc '
		set -eu

		export PATH="${PNPM_HOME}:${PATH}"

		corepack prepare
		pnpm config set store-dir /pnpm-store
		pnpm install --recursive --frozen-lockfile

		echo
		echo ">>> pnpm exec eslint --fix $*"
		pnpm exec eslint --fix "$@"
	' sh "${targets[@]}"

echo
echo "Done. Current diff:"
git diff -- "${targets[@]}"
