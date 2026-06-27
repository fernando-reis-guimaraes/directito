#!/usr/bin/env bash
set -euo pipefail

mode="${1:-suite}"
test_command=""

case "${mode}" in
	suite|unit|lint|typecheck|test|e2e|all)
		;;
	command)
		shift

		if [ "$#" -eq 0 ]; then
			echo "Usage: $0 command <command...>" >&2
			exit 1
		fi

		test_command="$*"
		;;
	*)
		echo "Usage:" >&2
		echo "  $0" >&2
		echo "  $0 suite" >&2
		echo "  $0 unit" >&2
		echo "  $0 lint" >&2
		echo "  $0 typecheck" >&2
		echo "  $0 test" >&2
		echo "  $0 e2e" >&2
		echo "  $0 all" >&2
		echo "  $0 command <command...>" >&2
		exit 1
		;;
esac

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

if ! command -v docker >/dev/null 2>&1; then
	echo "Error: docker is required." >&2
	exit 1
fi

if ! docker info >/dev/null 2>&1; then
	echo "Error: docker is not running or is not accessible." >&2
	exit 1
fi

build_args=(
	--file ./Dockerfile.test
	--target test
	--platform "${platform}"
	--progress=plain
	--build-arg "TEST_MODE=${mode}"
)

if [ -n "${test_command}" ]; then
	build_args+=(--build-arg "TEST_COMMAND=${test_command}")
fi

echo
echo "Action: run Directus tests/checks inside Docker"
echo
echo "Plan:"
echo "- Repository: $(pwd)"
echo "- Platform: ${platform}"
echo "- Mode: ${mode}"

if [ -n "${test_command}" ]; then
	echo "- Command: ${test_command}"
fi

echo

docker buildx build "${build_args[@]}" .
