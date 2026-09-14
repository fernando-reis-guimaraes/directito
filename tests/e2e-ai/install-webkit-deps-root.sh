#!/bin/sh
# Root prerequisite script for Directus AI Playwright WebKit tests.
#
# WHY THIS EXISTS:
#   Playwright's WebKit browser binary is already installed user-locally via
#   `playwright install webkit` (no root needed for that step), but launching it
#   fails because the host OS is missing the shared libraries WebKit links
#   against. Chromium launches fine without this script.
#
# WHAT IT CHANGES:
#   Installs ONLY the OS packages Playwright reports as missing for WebKit
#   (output of `playwright install chromium webkit` host validation on this
#   machine). No configuration files are modified, no services are touched,
#   no secrets are involved. `apt-get install -y` is idempotent: re-running it
#   is a no-op once the packages are present.
#
# USAGE (run manually as root):
#   sh tests/e2e-ai/install-webkit-deps-root.sh
#
# AFTERWARDS (as the unprivileged user):
#   pnpm --filter tests-e2e-ai exec playwright test --project=webkit

set -eu

apt-get update

apt-get install -y \
	libwoff1 \
	libevent-2.1-7t64 \
	libgstreamer-gl1.0-0 \
	libgstreamer-plugins-bad1.0-0 \
	libflite1 \
	libwebpdemux2 \
	libavif16 \
	libharfbuzz-icu0 \
	libhyphen0 \
	libwayland-server0 \
	libmanette-0.2-0

echo 'WebKit host dependencies installed. Re-run the webkit Playwright project as the unprivileged user.'
