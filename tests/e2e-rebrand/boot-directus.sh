#!/bin/sh
# Boot a disposable Directito (this branch, SQLite) for the rebrand Playwright E2E.
# Installs schema WITHOUT creating an admin user, so POST /server/setup stays available.
# The database file lives next to this script and can be deleted to reset.
# Usage: DIRECTUS_PORT=8057 sh boot-directus.sh
set -eu

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATA="$ROOT/tests/e2e-rebrand/.data.db"

export DB_CLIENT=sqlite3
export DB_FILENAME="$DATA"
export KEY="${E2E_KEY:-e2e-insecure-key-please-change-0123456789abcdef}"
export SECRET="${E2E_SECRET:-e2e-insecure-secret-please-change-0123456789abcdef}"
export HOST=127.0.0.1
export PORT="${DIRECTUS_PORT:-8057}"
export PUBLIC_URL="http://127.0.0.1:${DIRECTUS_PORT:-8057}"
export CORS_ENABLED=true
export SERVE_APP=true
export LOG_LEVEL=warn

cd "$ROOT/directus"

if [ ! -f "$DATA" ]; then
	node ./cli.js bootstrap --skipAdminInit
fi

node ./cli.js start
