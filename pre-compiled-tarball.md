# The Prebuilt npm Tarball Strategy for frg-directus

## TL;DR

### 1. Create the Directus tarball

```bash
cd /path/to/frg-directus

corepack enable
pnpm install --frozen-lockfile
pnpm build

pnpm --dir api pack --pack-destination dist

ls dist
```

### 3. Install Directus from the local tarball

```json
{
	"dependencies": {
		"directus": "file:../frg-directus/dist/directus-11.17.4.tgz"
	}
}

npm install
```

This repository uses the **Prebuilt npm Tarball Strategy** to deploy a custom Directus fork (`frg-directus`) without
requiring a private package registry such as Verdaccio or GitHub Packages.

The goal is simple:

- Keep the custom Directus fork in its own repository.
- Build that fork into an installable npm `.tgz` package.
- Consume that `.tgz` package from the deployment/consumer repository.
- Keep the final production deployment Docker-based.

This is not the same as running a raw Directus checkout in production. The production application still runs inside
Docker. The difference is that the Docker image installs Directus from a prebuilt npm tarball instead of using the
official Directus Docker image directly.

---

## Important Scope Note

Directus is safest to deploy with Docker because its runtime includes native and optional dependencies such as
`isolated-vm`, `sharp`/`libvips`, and `argon2`.

This strategy keeps Docker as the deployment boundary, but replaces the Directus source with a custom npm tarball
generated from the fork.

Use **Node.js 22** unless the custom fork has been explicitly tested with a newer Node.js version.

Do not use Node.js 24 by default. Some Directus/native dependency combinations can fail under Node.js 24.

---

## Architecture Overview

1. **The Fork Repository (`frg-directus`)**

   Contains the modified Directus core source code.

   A GitHub Actions workflow builds the monorepo and generates an npm `.tgz` tarball from the installable Directus
   package.

2. **The Tarball**

   The generated tarball is the custom Directus npm package.

   It can be distributed in two ways:
   - attached to a GitHub Release;
   - copied manually into the consumer repository under `/tarball`.

3. **The Consumer Repository**

   Contains the deployment Dockerfile, environment variables, custom extensions, and `package.json`.

   It consumes the custom Directus tarball as a normal npm dependency.

---

## 1. CI/CD Pipeline: Build and Release Tarball with GitHub Actions

Place the following YAML file inside the `frg-directus` repository at:

```text
.github/workflows/build-tarball.yml
```

This workflow is manually triggered with `workflow_dispatch`.

It builds the Directus monorepo, creates an npm tarball from the `api` package, and attaches that tarball to a GitHub
Release.

```yaml
name: Build and Release Directus Tarball

on:
  workflow_dispatch:
    inputs:
      version_tag:
        description: 'Release Version Tag (e.g., v11.17.4-frg.1)'
        required: true
        default: 'v11.17.4-frg.1'

jobs:
  build-and-release:
    runs-on: ubuntu-latest

    permissions:
      contents: write

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Enable Corepack
        run: |
          corepack enable
          pnpm --version

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Build Monorepo
        run: pnpm build

      - name: Generate Tarball
        id: pack
        run: |
          mkdir -p "$RUNNER_TEMP/directus-tarball"

          pnpm --dir api pack --pack-destination "$RUNNER_TEMP/directus-tarball"

          TARBALL_PATH="$(find "$RUNNER_TEMP/directus-tarball" -maxdepth 1 -name '*.tgz' -print -quit)"

          echo "Generated tarball: $TARBALL_PATH"
          echo "tarball_path=$TARBALL_PATH" >> "$GITHUB_OUTPUT"

      - name: Create GitHub Release and Upload Asset
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.event.inputs.version_tag }}
          name: Release ${{ github.event.inputs.version_tag }}
          files: ${{ steps.pack.outputs.tarball_path }}
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ github.token }}
```

### How to Trigger It

1. Open the `frg-directus` repository on GitHub.
2. Go to the **Actions** tab.
3. Select **Build and Release Directus Tarball**.
4. Click **Run workflow**.
5. Enter the release tag, for example:

```text
v11.17.4-frg.1
```

6. Run the workflow.
7. After it completes, open the GitHub Release and confirm that the `.tgz` file was uploaded.

---

## 2. Consuming the GitHub Release Tarball in the Consumer Repository

After the GitHub Action completes, the GitHub Release will contain a `.tgz` file.

Use that release asset URL in the consumer repository `package.json`.

Example:

```json
{
	"name": "my-directus-deployment",
	"private": true,
	"type": "module",
	"scripts": {
		"start": "directus start"
	},
	"dependencies": {
		"directus": "https://github.com/your-username/frg-directus/releases/download/v11.17.4-frg.1/directus-11.17.4.tgz",
		"@directus-labs/spreadsheet-layout": "latest",
		"directus-brazilian-pix": "latest",
		"directus-extension-classlog": "file:./extensions/classlog"
	}
}
```

Important: the tarball filename must match the actual file generated by `pnpm pack`.

Do not assume the filename is always:

```text
directus-11.17.4.tgz
```

Verify the actual generated filename from the workflow logs or from the GitHub Release asset.

---

## 3. Private Repository Warning

Do not put a GitHub Personal Access Token directly inside `package.json`.

Avoid this:

```json
{
	"dependencies": {
		"directus": "https://TOKEN@github.com/your-username/frg-directus/releases/download/v11.17.4-frg.1/directus-11.17.4.tgz"
	}
}
```

That can leak credentials through:

- git history;
- lockfiles;
- Docker image layers;
- build logs;
- npm cache.

For private repositories, prefer one of these approaches:

1. Use the local `/tarball` strategy described below.
2. Download the tarball during the Docker build using BuildKit secrets.
3. Use a private npm registry only if the operational overhead is acceptable.

For the current project, the simplest and safest approach is usually the local `/tarball` strategy.

---

## 4. Creating a Local Tarball for the Consumer Repository

This option avoids GitHub Release authentication entirely.

It is useful for:

- local testing;
- private forks;
- reproducible deployments;
- keeping the exact Directus tarball inside the consumer repository.

In this layout, the consumer repository stores the tarball under:

```text
/tarball
```

Here `/` means the root of the consumer repository.

### Intent

Build the custom Directus fork locally, generate the npm tarball, and copy the resulting `.tgz` file into the consumer
repository.

### High-level Plan

1. Build the `frg-directus` monorepo.
2. Run `pnpm pack` inside the package that produces the installable `directus` npm package.
3. Copy the generated `.tgz` file into the consumer repository under `/tarball`.
4. Reference that tarball from the consumer repository `package.json` using a local `file:` dependency.
5. Regenerate the consumer repository lockfile.

### Generate the Tarball Locally

Run this from the `frg-directus` repository:

```bash
cd /path/to/frg-directus

corepack enable
pnpm install --frozen-lockfile
pnpm build

rm -rf /tmp/frg-directus-tarball
mkdir -p /tmp/frg-directus-tarball

pnpm --dir api pack --pack-destination /tmp/frg-directus-tarball

ls -lh /tmp/frg-directus-tarball/*.tgz
```

### Copy the Tarball into the Consumer Repository

Run this after generating the tarball:

```bash
mkdir -p /path/to/consumer-repo/tarball
rm -f /path/to/consumer-repo/tarball/*.tgz
cp /tmp/frg-directus-tarball/*.tgz /path/to/consumer-repo/tarball/

ls -lh /path/to/consumer-repo/tarball/*.tgz
```

### Reference the Local Tarball from the Consumer Repository

In the consumer repository `package.json`, use the actual generated filename.

Example:

```json
{
	"name": "my-directus-deployment",
	"private": true,
	"type": "module",
	"scripts": {
		"start": "directus start"
	},
	"dependencies": {
		"directus": "file:./tarball/directus-11.17.4.tgz",
		"@directus-labs/spreadsheet-layout": "latest",
		"directus-brazilian-pix": "latest",
		"directus-extension-classlog": "file:./extensions/classlog"
	}
}
```

Then regenerate the lockfile from the consumer repository root:

```bash
cd /path/to/consumer-repo
npm install
```

If the project uses npm in Docker, commit both files:

```text
package.json
package-lock.json
```

Also commit the tarball if the deployment should be fully reproducible from the consumer repository:

```text
tarball/directus-11.17.4.tgz
```

---

## 5. Consumer Repository Dockerfile

This Dockerfile installs Directus from the package dependency declared in `package.json`.

It supports both:

- a remote GitHub Release tarball URL;
- a local tarball dependency such as `file:./tarball/directus-11.17.4.tgz`.

```dockerfile
FROM node:22-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json* ./
COPY ./tarball ./tarball
COPY ./directus-extension-classlog ./extensions/classlog

RUN npm ci --omit=dev

WORKDIR /app/extensions/classlog
RUN rm -rf dist node_modules && npm install --include=dev && npm run build

WORKDIR /app
RUN chown -R node:node /app
USER node

EXPOSE 8055

CMD ["npm", "start"]
```

Important: the local extension is copied before `npm ci` because `package.json` references it as:

```json
{
	"dependencies": {
		"directus-extension-classlog": "file:./extensions/classlog"
	}
}
```

If the actual consumer repository already stores the extension directly under:

```text
extensions/classlog
```

then use this instead:

```dockerfile
COPY ./extensions/classlog ./extensions/classlog
```

---

## 6. Optional: Simple Local Helper Script

This helper script builds the Directus tarball locally and copies it into the consumer repository.

Create it outside the repositories, for example:

```text
/tmp/build-frg-directus-tarball.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail

DIRECTUS_REPO="${1:?Directus repository path is required}"
CONSUMER_REPO="${2:?Consumer repository path is required}"

echo "Building Directus tarball from: $DIRECTUS_REPO"
echo "Copying tarball into: $CONSUMER_REPO/tarball"

cd "$DIRECTUS_REPO"

corepack enable
pnpm install --frozen-lockfile
pnpm build

rm -rf /tmp/frg-directus-tarball
mkdir -p /tmp/frg-directus-tarball

pnpm --dir api pack --pack-destination /tmp/frg-directus-tarball

mkdir -p "$CONSUMER_REPO/tarball"
rm -f "$CONSUMER_REPO"/tarball/*.tgz
cp /tmp/frg-directus-tarball/*.tgz "$CONSUMER_REPO/tarball/"

echo "Generated consumer tarball:"
ls -lh "$CONSUMER_REPO"/tarball/*.tgz

echo "Next step: update package.json to point to the generated file."
```

Run it:

```bash
bash /tmp/build-frg-directus-tarball.sh /path/to/frg-directus /path/to/consumer-repo
```

Verify:

```bash
ls -lh /path/to/consumer-repo/tarball/*.tgz
```

---

## 7. Verifying the Installed Directus Package

After running `npm install` or `npm ci` in the consumer repository, verify the installed package:

```bash
cd /path/to/consumer-repo

node -p "require('./node_modules/directus/package.json').name"
node -p "require('./node_modules/directus/package.json').version"
npx directus --version
```

Expected result:

```text
directus
```

The version should match the version from the generated tarball.

---

## 8. Recommended Release Flow

For development and testing:

1. Build the tarball locally.
2. Copy it into the consumer repository under `/tarball`.
3. Point `package.json` to `file:./tarball/...`.
4. Run `npm install`.
5. Build the Docker image.
6. Test Directus startup and extensions.

For production releases:

1. Tag the custom Directus fork.
2. Run the GitHub Actions tarball workflow.
3. Attach the tarball to a GitHub Release.
4. Either:
   - consume the GitHub Release URL directly; or
   - copy the release tarball into the consumer repository under `/tarball`.

The `/tarball` approach is usually simpler for private deployments.

---

## 9. Summary of Benefits

- **Clean separation of concerns**

  The custom Directus fork remains separate from the deployment application.

- **No private registry required**

  Avoids operating Verdaccio or GitHub Packages.

- **Reproducible deployments**

  The consumer repository can pin an exact tarball.

- **Docker remains the runtime boundary**

  The application still runs in Docker, reducing host-level dependency drift.

- **Simple rollback**

  Reverting to a previous Directus build only requires changing the tarball reference or restoring a previous tarball.

---

## 10. Main Tradeoffs

- **The tarball must be regenerated after every Directus fork change**

  Changes in `frg-directus` do not reach the consumer repository until a new tarball is built and installed.

- **Native dependency issues are still possible**

  The Docker image must use a compatible Node.js version and base image.

- **Local tarballs increase repository size**

  Committing `.tgz` files makes the consumer repository larger.

- **GitHub Release URLs are cleaner for public repos**

  But private repo authentication makes local tarballs simpler and safer.

---

## Final Recommendation

Use the local `/tarball` strategy first.

It is the simplest, safest, and most reproducible path for a private custom Directus fork.

Once the process is stable, optionally add GitHub Releases for cleaner versioned distribution.
