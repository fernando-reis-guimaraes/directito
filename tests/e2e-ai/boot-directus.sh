#!/bin/sh
# Boot a disposable Directus (this branch, SQLite) for the AI Playwright E2E.
# Usage: E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... sh boot-directus.sh
# The database file lives next to this script and can be deleted to reset.
set -eu

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATA="$ROOT/tests/e2e-ai/.data.db"

export DB_CLIENT=sqlite3
export DB_FILENAME="$DATA"
export KEY="${E2E_KEY:-e2e-insecure-key-please-change-0123456789abcdef}"
export SECRET="${E2E_SECRET:-e2e-insecure-secret-please-change-0123456789abcdef}"
export ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-admin@example.com}"
export ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-Admin123!}"
export HOST=127.0.0.1
export PORT="${DIRECTUS_PORT:-8055}"
export PUBLIC_URL="http://127.0.0.1:${DIRECTUS_PORT:-8055}"
export CORS_ENABLED=true
export SERVE_APP=true
export LOG_LEVEL=warn

cd "$ROOT/directus"
node ./cli.js bootstrap
node ./cli.js start
