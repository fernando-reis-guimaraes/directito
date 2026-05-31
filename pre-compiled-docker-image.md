# The Docker Image Tarball Strategy for frg-directus

This document describes how to distribute a custom Directus Docker image as a local `.tar.gz` file instead of pushing it to a container registry.

Use this strategy when you want to build a custom Directus image once, save it to disk, copy it into another repository or machine, and run it there with `docker load`.

---

## TL;DR

Intent: build a custom Directus Docker image, save it as a `.tar.gz` file, copy it into the consumer repository, and load it before running Docker Compose.

High-level plan:

1. Build the custom Directus Docker image.
2. Save the image to a compressed file with `docker save`.
3. Copy the image archive into the consumer repository under `/docker-images`.
4. Load the image in the consumer environment with `docker load`.
5. Run the service using the loaded image tag.

```bash
docker build -t frg-directus:local .
docker save frg-directus:local | gzip > frg-directus-local.tar.gz
```

Then, in the consumer repository or target machine:

```bash
gunzip -c docker-images/frg-directus-local.tar.gz | docker load
docker compose up -d
```

---

## Important Terminology

Use this:

```bash
docker save
docker load
```

Do not use this for this strategy:

```bash
docker export
docker import
```

Reason:

- `docker save` saves a Docker image, including image layers and tags.
- `docker load` restores that image and its tags.
- `docker export` exports a container filesystem, not a full Docker image.
- `docker export` does not preserve normal image metadata the same way `docker save` does.

For moving a built image between repositories or machines, use `docker save` and `docker load`.

---

## Architecture Overview

1. **The Image Builder Repository**

   This repository contains the Dockerfile that builds the custom Directus image.

   It may be the custom Directus fork repository, or a separate build repository.

2. **The Docker Image Archive**

   The built image is saved as a compressed file:

   ```text
   frg-directus-local.tar.gz
   ```

3. **The Consumer Repository**

   The consumer repository stores the image archive under:

   ```text
   /docker-images
   ```

   Here `/` means the root of the consumer repository.

4. **The Consumer Runtime**

   Before running `docker compose up`, the consumer environment loads the image:

   ```bash
   docker load -i docker-images/frg-directus-local.tar.gz
   ```

   After that, Docker Compose can use:

   ```yaml
   image: frg-directus:local
   ```

---

## 1. Build the Custom Directus Docker Image

Run this from the repository that contains the Dockerfile for the custom Directus image.

```bash
cd /path/to/frg-directus-docker-build-repo

docker build -t frg-directus:local .
```

Verify that the image exists:

```bash
docker images "frg-directus"
```

Expected result:

```text
REPOSITORY      TAG       IMAGE ID       CREATED          SIZE
frg-directus    local     ...            ...              ...
```

---

## 2. Save the Docker Image to Disk

Run this after building the image:

```bash
mkdir -p /tmp/frg-directus-docker-image

docker save frg-directus:local | gzip > /tmp/frg-directus-docker-image/frg-directus-local.tar.gz

ls -lh /tmp/frg-directus-docker-image/frg-directus-local.tar.gz
```

This creates:

```text
/tmp/frg-directus-docker-image/frg-directus-local.tar.gz
```

---

## 3. Copy the Image Archive into the Consumer Repository

Run this after saving the image:

```bash
mkdir -p /path/to/consumer-repo/docker-images
rm -f /path/to/consumer-repo/docker-images/frg-directus-local.tar.gz

cp /tmp/frg-directus-docker-image/frg-directus-local.tar.gz /path/to/consumer-repo/docker-images/

ls -lh /path/to/consumer-repo/docker-images/frg-directus-local.tar.gz
```

Recommended consumer repository layout:

```text
consumer-repo/
  docker-images/
    frg-directus-local.tar.gz
  docker-compose.yml
  load-docker-image.sh
  .env
```

---

## 4. Load the Docker Image in the Consumer Repository

Run this from the consumer repository root:

```bash
cd /path/to/consumer-repo

docker load -i docker-images/frg-directus-local.tar.gz
docker images "frg-directus"
```

Alternative form:

```bash
gunzip -c docker-images/frg-directus-local.tar.gz | docker load
docker images "frg-directus"
```

Expected result:

```text
REPOSITORY      TAG       IMAGE ID       CREATED          SIZE
frg-directus    local     ...            ...              ...
```

---

## 5. Use the Loaded Image in Docker Compose

Example `docker-compose.yml`:

```yaml
services:
  directus:
    image: frg-directus:local
    ports:
      - "8055:8055"
    env_file:
      - .env
    volumes:
      - ./uploads:/directus/uploads
      - ./extensions:/directus/extensions
```

Run:

```bash
docker compose up -d
```

Verify:

```bash
docker compose ps
docker compose logs -f directus
```

---

## 6. Helper Script for the Consumer Repository

Create this file in the consumer repository:

```text
load-docker-image.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "Loading Docker image from docker-images/frg-directus-local.tar.gz"

docker load -i docker-images/frg-directus-local.tar.gz

echo "Loaded images matching frg-directus:"
docker images "frg-directus"
```

Make it executable:

```bash
chmod +x load-docker-image.sh
```

Run it:

```bash
./load-docker-image.sh
```

Then start the stack:

```bash
docker compose up -d
```

---

## 7. Full Local Build-and-Copy Flow

Intent: build the Docker image and copy the compressed image archive into the consumer repository.

High-level plan:

1. Build the image.
2. Save the image as `.tar.gz`.
3. Copy the archive into the consumer repository.

```bash
cd /path/to/frg-directus-docker-build-repo

docker build -t frg-directus:local .

rm -rf /tmp/frg-directus-docker-image
mkdir -p /tmp/frg-directus-docker-image

docker save frg-directus:local | gzip > /tmp/frg-directus-docker-image/frg-directus-local.tar.gz

mkdir -p /path/to/consumer-repo/docker-images
rm -f /path/to/consumer-repo/docker-images/frg-directus-local.tar.gz

cp /tmp/frg-directus-docker-image/frg-directus-local.tar.gz /path/to/consumer-repo/docker-images/

ls -lh /path/to/consumer-repo/docker-images/frg-directus-local.tar.gz
```

---

## 8. Full Consumer Load-and-Run Flow

Intent: load the local Docker image archive and run the consumer Docker Compose stack.

High-level plan:

1. Load the image.
2. Verify the image tag exists.
3. Start the stack.

```bash
cd /path/to/consumer-repo

docker load -i docker-images/frg-directus-local.tar.gz

docker images "frg-directus"

docker compose up -d

docker compose ps
```

---

## 9. Optional GitHub Actions Workflow to Build the Docker Image Archive

Place this file in the image builder repository:

```text
.github/workflows/build-docker-image-tarball.yml
```

```yaml
name: Build Docker Image Tarball

on:
  workflow_dispatch:
    inputs:
      image_tag:
        description: "Docker image tag (e.g., frg-directus:v11.17.4-frg.1)"
        required: true
        default: "frg-directus:v11.17.4-frg.1"

jobs:
  build-image-tarball:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Build Docker Image
        run: |
          docker build -t "${{ github.event.inputs.image_tag }}" .

      - name: Save Docker Image
        run: |
          mkdir -p dist
          SAFE_TAG="$(echo "${{ github.event.inputs.image_tag }}" | tr '/:' '--')"
          docker save "${{ github.event.inputs.image_tag }}" | gzip > "dist/${SAFE_TAG}.tar.gz"
          ls -lh dist/*.tar.gz

      - name: Upload Docker Image Archive
        uses: actions/upload-artifact@v4
        with:
          name: docker-image-tarball
          path: dist/*.tar.gz
```

This creates a downloadable GitHub Actions artifact.

If you want a GitHub Release instead of an Actions artifact, use a release upload action and attach the `.tar.gz` file to a release.

---

## 10. Important Limitation: Docker Compose Cannot Load the Archive Automatically

Docker Compose can use a loaded image:

```yaml
services:
  directus:
    image: frg-directus:local
```

But Docker Compose does not normally load a local `.tar.gz` image archive by itself.

This will not work:

```yaml
services:
  directus:
    image: ./docker-images/frg-directus-local.tar.gz
```

The image must be loaded first:

```bash
docker load -i docker-images/frg-directus-local.tar.gz
docker compose up -d
```

---

## 11. When to Use This Strategy

Use this strategy when:

- the target environment cannot access a private registry;
- the image must be manually copied between machines;
- the deployment must be reproducible from files inside the consumer repository;
- the setup is small enough that committing or storing a large `.tar.gz` is acceptable;
- you want a simple alternative to GHCR, Docker Hub, ECR, or another registry.

---

## 12. When Not to Use This Strategy

Do not use this strategy as the default for mature CI/CD.

For normal production deployment, a container registry is cleaner:

- GitHub Container Registry;
- Docker Hub;
- AWS ECR;
- Google Artifact Registry;
- Azure Container Registry;
- a private registry.

A registry gives you:

- better version management;
- better CI/CD integration;
- easier rollback;
- less repository bloat;
- less manual loading.

---

## 13. Comparison with the npm Tarball Strategy

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
Need mature production distribution?         Use a container registry.
```

---

## 14. Summary of Benefits

- **Simple offline distribution**

  The Docker image can be copied as a single file.

- **No registry required**

  Avoids GHCR, Docker Hub, ECR, or private registry setup.

- **Exact runtime snapshot**

  The saved image includes the built application and installed dependencies.

- **Simple rollback**

  Load a previous `.tar.gz` image archive and restart the stack.

---

## 15. Main Tradeoffs

- **Large files**

  Docker image archives can be hundreds of MBs or several GBs.

- **Manual load step**

  The image must be loaded before Docker Compose can use it.

- **Repository bloat**

  Committing image archives makes the consumer repository much larger.

- **Weaker CI/CD ergonomics**

  Registries are better for automated deployment pipelines.

---

## Final Recommendation

Use this Docker image tarball strategy only when a registry is not worth the operational overhead.

For the current custom Directus deployment, the practical order is:

1. Use the npm tarball strategy if you want the consumer repository to build its own deployment image.
2. Use the Docker image tarball strategy if you want to transfer a complete prebuilt image.
3. Use a container registry once the deployment process becomes more mature.
