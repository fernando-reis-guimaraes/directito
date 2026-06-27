#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo
echo "Action: run full Docker test suite including E2E"
echo
echo "This wrapper calls:"
echo "./scripts/test-docker.sh all"
echo
echo "Meaning:"
echo "- lint, if available"
echo "- typecheck/type-check/check:types, if available"
echo "- test/test:* scripts, including E2E"
echo
echo "Note:"
echo "E2E tests may require extra services such as database, browser, Redis, or test fixtures."
echo

exec ./scripts/test-docker.sh all
