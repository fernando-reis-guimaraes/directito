# uma-directus

Directus fork used by UMA projects.

This fork keeps the upstream Directus codebase as close as possible to the official project, with a small authentication
patch that allows local email/password login as a fallback for users configured with an external authentication
provider.

## Docker image

Published image:

```text
docker.io/umappsnet/uma-directus
```

## Authentication patch

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

With the environment variable below enabled, the same user can log in with an external provider and also with local
email/password:

```bash
AUTH_ALLOW_LOCAL_PASSWORD_FOR_EXTERNAL_USERS=true
```

This does not allow multiple external providers for the same user. For example, a user configured with Google is not
allowed to log in through Microsoft.

## Release flow

The Docker image is built and pushed by GitHub Actions when a Git tag matching `v[0-9]*` is pushed.

### 1. Commit changes

```bash
git status
git add .
git commit -m "Describe the change"
```

### 2. Create a release tag

Use the upstream Directus version plus a fork suffix.

Example:

```bash
git tag v11.17.4-uma.1
```

### 3. Push the branch

```bash
git push origin HEAD
```

### 4. Push the tag

```bash
git push origin v11.17.4-uma.1
```

GitHub Actions will then build and push the Docker image.

## Published tags

For a tag like:

```text
v11.17.4-uma.1
```

Expected Docker image tag:

```text
docker.io/umappsnet/uma-directus:11.17.4-uma.1
```

Because this is a prerelease-style semver tag, the workflow may also publish:

```text
docker.io/umappsnet/uma-directus:canary
```

Use the explicit version tag in production.

## GitHub secrets

The release workflow requires these repository secrets:

```text
DOCKERHUB_USERNAME
DOCKERHUB_PASSWORD
```

`DOCKERHUB_PASSWORD` should be a Docker Hub access token, not the account password.

## Production usage

Pin the image version explicitly:

```yaml
image: umappsnet/uma-directus:11.17.4-uma.1
```

Avoid using `latest` in production.
