# The npm Tarball Strategy for frg-directus

This document describes how to distribute a custom Directus build as a local npm package tarball instead of publishing
it to npm or using a Docker image archive.

Use this strategy when you want the consumer repository to install your custom Directus package from a local `.tgz` file
under `/tarball`.

---

## TL;DR

Intent: build a custom Directus npm package, save it as a `.tgz` file, copy it into the consumer repository, and install
Directus from that local tarball.

High-level plan:

1. Build the custom Directus repository.
2. Use Directus' own `pnpm deploy` pattern to create a production package folder.
3. Run `npm pack` from the deployed package folder.
4. Copy the generated `.tgz` into the consumer repository under `/tarball`.
5. Install Directus in the consumer repository from `file:./tarball/...`.

```bash
cd /path/to/custom-directus-repo

corepack enable
corepack prepare

pnpm fetch
pnpm install --recursive --offline --frozen-lockfile
npm_config_workspace_concurrency=2 pnpm run build

rm -rf dist tarball
pnpm --filter directus deploy --legacy --prod dist

mkdir -p tarball

cd dist
npm pack --pack-destination ../tarball
cd ..

ls -lh tarball/*.tgz
```

Instead of running the build and pack commands manually, you may prefer to run the helper script:

```bash
./scripts/build-and-pack-npm-package.sh
```

Then, in the consumer repository:

```bash
mkdir -p tarball
cp /path/to/custom-directus-repo/tarball/*.tgz ./tarball/

pnpm add ./tarball/directus-*.tgz
```

Or pin it manually in `package.json`:

```json
{
	"dependencies": {
		"directus": "file:./tarball/directus-11.17.4.tgz"
	}
}
```

Then install:

```bash
pnpm install
pnpm exec directus --version
```

---

## Important Terminology

Use this:

```bash
pnpm --filter directus deploy --legacy --prod dist
npm pack
pnpm add ./tarball/directus-*.tgz
```

Do not use this for this strategy:

```bash
docker save
docker load
docker export
docker import
```

Reason:

- `pnpm deploy` creates a deployable copy of the selected workspace package.
- `npm pack` creates a standard npm package tarball.
- `pnpm add ./tarball/directus-*.tgz` installs that package in the consumer repository.
- Docker commands are for Docker image distribution, not npm package distribution.

For moving Directus as an npm dependency between repositories, use `pnpm deploy` and `npm pack`.

---

## Architecture Overview

1. **The Package Builder Repository**

   This is the custom Directus fork or custom Directus source repository.

   It contains:

   ```text
   pnpm-workspace.yaml
   package.json
   pnpm-lock.yaml
   directus/package.json
   ```

2. **The Directus Workspace Package**

   The npm package named `directus` lives in:

   ```text
   directus/package.json
   ```

   That is the package selected by:

   ```bash
   pnpm --filter directus ...
   ```

3. **The Deployed Package Folder**

   The deployed package is created at:

   ```text
   dist/
   ```

   This folder is produced by:

   ```bash
   pnpm --filter directus deploy --legacy --prod dist
   ```

4. **The npm Tarball**

   The npm package archive is created under:

   ```text
   tarball/
   ```

   Example:

   ```text
   tarball/directus-11.17.4.tgz
   ```

5. **The Consumer Repository**

   The consumer repository stores the tarball under:

   ```text
   /tarball
   ```

   Here `/` means the root of the consumer repository.

---

## 1. Build the Custom Directus Package

Run this from the root of the custom Directus repository.

```bash
cd /path/to/custom-directus-repo

corepack enable
corepack prepare

pnpm fetch
pnpm install --recursive --offline --frozen-lockfile
npm_config_workspace_concurrency=2 pnpm run build
```

Verify that the Directus workspace package exists:

```bash
node -p 'require("./directus/package.json").name'
```

Expected result:

```text
directus
```

---

## 2. Deploy the Directus Workspace Package

Run this from the root of the custom Directus repository.

```bash
rm -rf dist

pnpm --filter directus deploy --legacy --prod dist
```

Verify the deployed package:

```bash
ls -la dist
node -p 'require("./dist/package.json").name'
node -p 'require("./dist/package.json").bin'
```

Expected result:

```text
directus
```

The `dist` folder should contain the deployable Directus package and its production dependencies.

---

## 3. Important Difference from the Official Dockerfile

The official Directus Dockerfile deploys the package like this:

```bash
pnpm --filter directus deploy --legacy --prod dist
```

Then it rewrites `dist/package.json` with only essential fields.

Do not copy that package rewrite into this npm tarball strategy.

Do not do this for the npm tarball flow:

```bash
node -e '
  const f = "package.json", {name, version, type, exports, bin} = require(`./${f}`), {packageManager} = require(`../${f}`);
  fs.writeFileSync(f, JSON.stringify({name, version, type, exports, bin, packageManager}, null, 2));
'
```

Reason:

- In the Docker image, `node_modules` is already copied into the final image.
- In an npm tarball install, the consumer package manager may need dependency metadata.
- Stripping dependency fields can make the tarball unsafe or incomplete as an npm dependency.

For the npm tarball strategy, keep the deployed `package.json` generated by `pnpm deploy`.

---

## 4. Create the npm Tarball

Run this from the root of the custom Directus repository after creating `dist`.

```bash
rm -rf tarball
mkdir -p tarball

cd dist
npm pack --pack-destination ../tarball
cd ..

ls -lh tarball/*.tgz
```

Example output:

```text
tarball/directus-11.17.4.tgz
```

Inspect the tarball contents:

```bash
tar -tf tarball/*.tgz | sed -n '1,120p'
```

Verify package metadata:

```bash
tar -xOf tarball/*.tgz package/package.json | node -e '
let data = "";
process.stdin.on("data", chunk => data += chunk);
process.stdin.on("end", () => {
  const packageJson = JSON.parse(data);
  console.log(packageJson.name);
  console.log(packageJson.version);
  console.log(packageJson.bin);
});
'
```

Expected result:

```text
directus
...
...
```

---

## 5. Copy the Tarball into the Consumer Repository

Run this after creating the tarball.

```bash
mkdir -p /path/to/consumer-repo/tarball
rm -f /path/to/consumer-repo/tarball/directus-*.tgz

cp /path/to/custom-directus-repo/tarball/directus-*.tgz /path/to/consumer-repo/tarball/

ls -lh /path/to/consumer-repo/tarball/
```

Recommended consumer repository layout:

```text
consumer-repo/
  tarball/
    directus-11.17.4.tgz
  package.json
  pnpm-lock.yaml
  Dockerfile
  docker-compose.yml
  .env
```

---

## 6. Install the Tarball in the Consumer Repository

Run this from the consumer repository root.

```bash
cd /path/to/consumer-repo

pnpm add ./tarball/directus-*.tgz
```

Verify:

```bash
pnpm exec directus --version
```

If you prefer to edit `package.json` manually, use:

```json
{
	"dependencies": {
		"directus": "file:./tarball/directus-11.17.4.tgz"
	}
}
```

Then run:

```bash
pnpm install
pnpm exec directus --version
```

---

## 7. Use the Local Directus Package in a Consumer Dockerfile

Example `Dockerfile` for the consumer repository:

```dockerfile
# syntax=docker/dockerfile:1.4

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS runtime

RUN npm install --global pm2@5 corepack@latest

USER node

WORKDIR /app

ENV \
  DB_CLIENT="sqlite3" \
  DB_FILENAME="/app/database/database.sqlite" \
  NODE_ENV="production" \
  NPM_CONFIG_UPDATE_NOTIFIER="false"

COPY --chown=node:node package.json pnpm-lock.yaml ./
COPY --chown=node:node tarball ./tarball

RUN corepack enable \
  && corepack prepare \
  && pnpm install --prod --frozen-lockfile

RUN mkdir -p database extensions uploads

EXPOSE 8055

CMD : \
  && pnpm exec directus bootstrap \
  && pnpm exec directus start \
  ;
```

Build:

```bash
docker build -t consumer-directus:local .
```

Run:

```bash
docker run --rm -it \
  -p 8055:8055 \
  --env-file .env \
  consumer-directus:local
```

---

## 8. Use the Local Directus Package with Docker Compose

Example `docker-compose.yml`:

```yaml
services:
  directus:
    build:
      context: .
      dockerfile: Dockerfile
    image: consumer-directus:local
    ports:
      - '8055:8055'
    env_file:
      - .env
    volumes:
      - ./uploads:/app/uploads
      - ./extensions:/app/extensions
      - ./database:/app/database
```

Run:

```bash
docker compose up -d --build
```

Verify:

```bash
docker compose ps
docker compose logs -f directus
```

---

## 9. Helper Script for the Builder Repository

Create this file in the custom Directus repository:

```text
build-npm-tarball.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "Preparing package manager"
corepack enable
corepack prepare

echo "Fetching dependencies"
pnpm fetch

echo "Installing workspace dependencies"
pnpm install --recursive --offline --frozen-lockfile

echo "Building Directus"
npm_config_workspace_concurrency=2 pnpm run build

echo "Deploying Directus workspace package"
rm -rf dist
pnpm --filter directus deploy --legacy --prod dist

echo "Packing deployed package"
rm -rf tarball
mkdir -p tarball

cd dist
npm pack --pack-destination ../tarball
cd ..

echo "Created npm tarball:"
ls -lh tarball/*.tgz

echo "Inspecting package metadata:"
tar -xOf tarball/*.tgz package/package.json | node -e '
let data = "";
process.stdin.on("data", chunk => data += chunk);
process.stdin.on("end", () => {
  const packageJson = JSON.parse(data);
  console.log(`name: ${packageJson.name}`);
  console.log(`version: ${packageJson.version}`);
  console.log(`bin: ${JSON.stringify(packageJson.bin)}`);
});
'
```

Make it executable:

```bash
chmod +x build-npm-tarball.sh
```

Run it:

```bash
./build-npm-tarball.sh
```

---

## 10. Helper Script to Copy the Tarball to the Consumer Repository

Create this file in the custom Directus repository:

```text
copy-npm-tarball-to-consumer.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail

CONSUMER_REPO_PATH="${1:?Usage: $0 /path/to/consumer-repo}"

echo "Copying Directus npm tarball to ${CONSUMER_REPO_PATH}/tarball"

mkdir -p "${CONSUMER_REPO_PATH}/tarball"
rm -f "${CONSUMER_REPO_PATH}"/tarball/directus-*.tgz

cp tarball/directus-*.tgz "${CONSUMER_REPO_PATH}/tarball/"

echo "Copied tarball:"
ls -lh "${CONSUMER_REPO_PATH}"/tarball/directus-*.tgz
```

Make it executable:

```bash
chmod +x copy-npm-tarball-to-consumer.sh
```

Run it:

```bash
./copy-npm-tarball-to-consumer.sh /path/to/consumer-repo
```

---

## 11. Full Local Build-and-Copy Flow

Intent: build the custom Directus npm tarball and copy it into the consumer repository.

High-level plan:

1. Build the Directus monorepo.
2. Deploy the `directus` workspace package into `dist`.
3. Pack `dist` into an npm `.tgz`.
4. Copy the `.tgz` into the consumer repository under `/tarball`.

```bash
cd /path/to/custom-directus-repo

corepack enable
corepack prepare

pnpm fetch
pnpm install --recursive --offline --frozen-lockfile
npm_config_workspace_concurrency=2 pnpm run build

rm -rf dist tarball
pnpm --filter directus deploy --legacy --prod dist

mkdir -p tarball

cd dist
npm pack --pack-destination ../tarball
cd ..

mkdir -p /path/to/consumer-repo/tarball
rm -f /path/to/consumer-repo/tarball/directus-*.tgz

cp tarball/directus-*.tgz /path/to/consumer-repo/tarball/

ls -lh /path/to/consumer-repo/tarball/directus-*.tgz
```

---

## 12. Full Consumer Install-and-Run Flow

Intent: install the local Directus npm tarball in the consumer repository and verify the CLI.

High-level plan:

1. Install the local tarball.
2. Verify the Directus CLI.
3. Run Directus.

```bash
cd /path/to/consumer-repo

pnpm add ./tarball/directus-*.tgz

pnpm exec directus --version
pnpm exec directus bootstrap
pnpm exec directus start
```

---

## 13. Optional GitHub Actions Workflow to Build the npm Tarball

Place this file in the custom Directus repository:

```text
.github/workflows/build-npm-tarball.yml
```

```yaml
name: Build npm Tarball

on:
  workflow_dispatch:

jobs:
  build-npm-tarball:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Enable Corepack
        run: |
          corepack enable
          corepack prepare

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Fetch Dependencies
        run: |
          pnpm fetch

      - name: Install Dependencies
        run: |
          pnpm install --recursive --offline --frozen-lockfile

      - name: Build Directus
        run: |
          npm_config_workspace_concurrency=2 pnpm run build

      - name: Deploy Directus Package
        run: |
          rm -rf dist
          pnpm --filter directus deploy --legacy --prod dist

      - name: Pack Directus Package
        run: |
          rm -rf tarball
          mkdir -p tarball
          cd dist
          npm pack --pack-destination ../tarball
          cd ..
          ls -lh tarball/*.tgz

      - name: Upload npm Tarball
        uses: actions/upload-artifact@v4
        with:
          name: directus-npm-tarball
          path: tarball/*.tgz
```

This creates a downloadable GitHub Actions artifact containing the custom Directus npm tarball.

---

## 14. Important Limitation: The Consumer Repo Must Install the Tarball

A local npm tarball is not automatically used just because it exists in `/tarball`.

This is not enough:

```text
tarball/directus-11.17.4.tgz
```

The consumer repository must reference it from `package.json`:

```json
{
	"dependencies": {
		"directus": "file:./tarball/directus-11.17.4.tgz"
	}
}
```

Or install it with:

```bash
pnpm add ./tarball/directus-*.tgz
```

After changing the tarball, run:

```bash
pnpm install
```

If the tarball filename changes, update `package.json` accordingly.

---

## 15. Updating to a New Custom Directus Build

Recommended update flow:

1. Build a new tarball in the custom Directus repository.
2. Copy it into the consumer repository.
3. Update the `file:./tarball/...` dependency if the filename changed.
4. Run `pnpm install`.
5. Rebuild the consumer Docker image.

Example:

```bash
cd /path/to/custom-directus-repo

./build-npm-tarball.sh
./copy-npm-tarball-to-consumer.sh /path/to/consumer-repo

cd /path/to/consumer-repo

pnpm add ./tarball/directus-*.tgz
docker compose up -d --build
```

Verify:

```bash
pnpm exec directus --version
docker compose logs -f directus
```

---

## 16. Comparison with the Docker Image Tarball Strategy

Use the npm tarball strategy when the consumer repository should install Directus as an npm package:

```text
directus: file:./tarball/directus-11.17.4.tgz
```

Use the Docker image tarball strategy when the consumer repository should run a full prebuilt image:

```text
docker load -i docker-images/frg-directus-local.tar.gz
docker compose up -d
```

Decision:

```text
Need a package dependency inside a Node app?  Use the npm tarball strategy.
Need a complete runnable Docker image?       Use the Docker image tarball strategy.
Need mature production distribution?         Use a container registry or private npm registry.
```

---

## 17. When to Use This Strategy

Use this strategy when:

- the consumer repository should own the final Docker image build;
- the custom Directus build should behave like a normal npm dependency;
- you do not want to publish the package to npm;
- you do not want to set up a private npm registry yet;
- the deployment should be reproducible from files inside the consumer repository;
- copying a `.tgz` file into the consumer repository is acceptable.

---

## 18. When Not to Use This Strategy

Do not use this strategy when:

- you want to distribute a fully built Docker image;
- you want the fastest possible runtime deployment;
- you want mature version management;
- you want clean CI/CD with remote artifact resolution;
- you want rollback through image tags or package registry versions.

For mature production distribution, prefer one of these:

- private npm registry;
- GitHub Packages npm registry;
- GitHub Container Registry;
- Docker Hub;
- AWS ECR;
- Google Artifact Registry;
- Azure Container Registry.

---

## 19. Summary of Benefits

- **No npm publishing required**

  The package is installed directly from a local `.tgz` file.

- **Consumer repo controls the final image**

  The consumer repository can build its own Docker image using the custom Directus package.

- **Simple offline distribution**

  The package can be copied as a single file.

- **Closer to normal Node dependency management**

  The consumer repository installs Directus through `package.json` and `pnpm-lock.yaml`.

- **Smaller than a Docker image archive**

  An npm tarball is usually smaller than a full Docker image tarball.

---

## 20. Main Tradeoffs

- **Manual copy step**

  The tarball must be copied into the consumer repository.

- **Dependency lockfile changes**

  Updating the tarball usually changes `pnpm-lock.yaml`.

- **Less clean than a private registry**

  A registry is better once distribution becomes frequent.

- **Consumer image build is still required**

  Unlike the Docker image tarball strategy, this does not give you a complete prebuilt runtime image.

---

## Final Recommendation

Use this npm tarball strategy if you want the consumer repository to install custom Directus as a local npm dependency
and build its own final Docker image.

For the current custom Directus deployment, the practical order is:

1. Use the npm tarball strategy if the consumer repository should build its own deployment image.
2. Use the Docker image tarball strategy if you want to transfer a complete prebuilt image.
3. Use a private npm registry or container registry once the deployment process becomes more mature.
