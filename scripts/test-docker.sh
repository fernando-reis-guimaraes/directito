#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

mode="${1:-}"
test_command=""

if [ -z "${mode}" ]; then
	echo
	echo "Select Docker test/check mode:"
	echo
	echo "  1) lint       - ESLint only"
	echo "  2) style      - Stylelint only"
	echo "  3) format     - Prettier check only"
	echo "  4) unit       - build + tests, excluding e2e and blackbox"
	echo "  5) suite      - format + lint + style + build + tests, excluding e2e and blackbox"
	echo "  6) blackbox   - packaged Directus blackbox tests"
	echo "  7) coverage   - build + coverage tests"
	echo "  8) all        - suite + blackbox + coverage, excluding e2e"
	echo "  9) command    - custom command inside Docker"
	echo "  0) abort"
	echo
	printf "Choice: "
	read -r choice

	case "${choice}" in
		1)
			mode="lint"
			;;
		2)
			mode="style"
			;;
		3)
			mode="format"
			;;
		4)
			mode="unit"
			;;
		5)
			mode="suite"
			;;
		6)
			mode="blackbox"
			;;
		7)
			mode="coverage"
			;;
		8)
			mode="all"
			;;
		9)
			mode="command"
			echo
			printf "Command: "
			read -r test_command
			;;
		0|"")
			echo "Aborted."
			exit 0
			;;
		*)
			echo "Invalid choice: ${choice}" >&2
			exit 1
			;;
	esac
fi

case "${mode}" in
	lint|style|format|unit|test|blackbox|coverage|suite|all)
		;;
	command)
		if [ -z "${test_command}" ]; then
			shift || true

			if [ "$#" -eq 0 ]; then
				echo "Usage: $0 command <command...>" >&2
				exit 1
			fi

			test_command="$*"
		fi
		;;
	*)
		echo "Usage:" >&2
		echo "  $0" >&2
		echo "  $0 lint" >&2
		echo "  $0 style" >&2
		echo "  $0 format" >&2
		echo "  $0 unit" >&2
		echo "  $0 test" >&2
		echo "  $0 blackbox" >&2
		echo "  $0 coverage" >&2
		echo "  $0 suite" >&2
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
