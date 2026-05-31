#!/usr/bin/env bash
set -euo pipefail

echo "Checking tools"
node --version
pnpm --version

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
