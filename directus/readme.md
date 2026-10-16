# Directito

Directito is a Directus 11 fork used by UMA projects.

This fork keeps the upstream Directus codebase as close as possible to the official project, with small targeted patches
needed by UMA deployments.

## Docker image

Published image:

```text
cr.umapps.net/umapps/directito
```

The release workflow publishes a multi-architecture image for:

```text
linux/amd64
linux/arm64
```

This allows the same Docker image tag to run on both:

```text
Ubuntu x86_64 servers
Apple Silicon / MacBook M4 local CapRover setups
```

## Patches

### Authentication patch

This fork supports:

```text
one external provider + local email/password fallback
```

Example:

```text
provider = google
external_identifier = user@example.com
password = valid local password hash
```

The same user can log in with an external provider and also with local email/password, as long as the user record has a
password set. No additional environment variable is required to enable this behaviour.

This does not allow multiple external providers for the same user. For example, a user configured with Google is not
allowed to log in through Microsoft.

### Upload cancellation confirmation

This fork protects long-running file uploads from accidental cancellation.

When a file upload is in progress, closing the upload dialog through `Esc`, outside click, or the modal cancel button
now asks for browser-native confirmation before aborting the upload.

Current confirmation text:

```text
Cancel Upload?
```

This is intentionally short and language-neutral enough for English, Portuguese, and Spanish while the feature is being
validated. It can later be replaced by a styled Directito confirmation dialog and proper i18n strings.

### TUS upload retry patch

This fork enables retry support for Directito Studio resumable uploads using `tus-js-client`.

By default, failed TUS chunk uploads are retried with exponential delays:

```text
2000,4000,8000,16000,32000,64000
```

This means retries after:

```text
2s, 4s, 8s, 16s, 32s, 64s
```

The retry sequence is reset by `tus-js-client` after upload progress is accepted by the server.

The retry delays can be customized with:

```env
TUS_RETRY_DELAYS=2000,4000,8000,16000,32000,64000
```

Retries are only allowed for transient upload failures, such as network interruption, timeout, locked upload, rate
limiting, or server-side 5xx errors.

Client-side errors such as unauthorized, forbidden, not found, invalid payload, or file too large are not retried.

## Local Docker build

Use the local build script from the repository root:

```bash
./scripts/build-docker-image-local.sh directito
```

For a normal local validation build, answer `N` to push and type:

```text
BUILD
```

This builds the configured platforms into the Buildx cache.

If the local build script supports local loading, type:

```text
LOAD
```

This builds only the local platform and loads the image into the local Docker image store.

Expected local platforms:

```text
MacBook M4 / Apple Silicon: linux/arm64
Ubuntu x86_64: linux/amd64
```

You can also force a platform manually:

```bash
PLATFORMS=linux/arm64 ./scripts/build-docker-image-local.sh directito
```

or:

```bash
PLATFORMS=linux/amd64 ./scripts/build-docker-image-local.sh directito
```

## Dockerfile validation

The Dockerfile builds the Directito workspace and production image.

It runs:

```text
pnpm install --recursive --offline --frozen-lockfile
pnpm run build
pnpm --filter directus deploy --legacy --prod dist
```

This validates dependency installation, TypeScript/build output, Studio build, and Directito package deployment.

It does not run the full test suite unless explicit test commands are added to the Dockerfile.

## Release flow

The Docker image is built and pushed by GitHub Actions when a Git tag matching `v[0-9]*` is pushed.

The preferred release helper is:

```bash
./scripts/release-docker-image.sh
```

The release script expects a clean working tree. Commit changes before running it.

### 1. Commit changes

```bash
git status
git add .
git commit -m "Describe the change"
```

### 2. Run the release script

```bash
./scripts/release-docker-image.sh
```

The script will:

```text
1. Push the current branch
2. Create a release tag
3. Push the release tag
4. Trigger GitHub Actions
```

GitHub Actions will then build and push the Docker image.

## Published tags

For a tag like:

```text
v11.17.4-directito.1
```

Expected Docker image tag:

```text
cr.umapps.net/umapps/directito:11.17.4-directito.1
```

Because this is a prerelease-style semver tag, the workflow may also publish:

```text
cr.umapps.net/umapps/directito:canary
```

Use the explicit version tag in production.

## GitHub configuration

The release workflow requires:

```text
Repository variable:
CR_REGISTRY_USERNAME

Repository secret:
CR_REGISTRY_PASSWORD
```

`CR_REGISTRY_PASSWORD` should be a registry access token, not the account password.

## Production usage

Pin the image version explicitly:

```yaml
image: cr.umapps.net/umapps/directito:11.17.4-directito.1
```

Avoid using `latest` in production.

Example TUS upload configuration:

```env
TUS_ENABLED=true
TUS_CHUNK_SIZE=16mb
TUS_UPLOAD_EXPIRATION=168h
TUS_RETRY_DELAYS=2000,4000,8000,16000,32000,64000
```
