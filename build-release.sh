#!/usr/bin/env bash
#
# build-release.sh
#
# Purpose:
#   Build the Simons CMAP web application and package it into a single
#   deployment archive for AWS Elastic Beanstalk. This script BUILDS and
#   PACKAGES only. It does not upload anything to AWS and does not contact
#   any external service. Uploading is a separate, manual step performed
#   through the Elastic Beanstalk console (see the deployment runbook).
#
# What it does, in order:
#   1. Confirms both repositories are present side by side.
#   2. Confirms the Google service account key file is present (the site
#      cannot send email without it). This check actually fails when the
#      file is missing, unlike the previous version of the script.
#   3. Builds the React application using the Node version pinned for the
#      React repository (.nvmrc there), then restores the Node version
#      pinned for the API repository for packaging.
#   4. Copies the React build into the API public directory.
#   5. Reads both version numbers and packages the API directory (with the
#      copied build) into a timestamped, version-tagged zip archive in a
#      deployments directory beside the two repositories.
#
# What it does NOT do:
#   - It does not upload source maps to Sentry. Sentry is not relied upon.
#   - It does not talk to AWS. It only produces a local archive to inspect
#     and then upload by hand.
#
# Requirements on the machine running this script:
#   - nvm, with Node v12.18.1 and v14.17.0 installed
#     (install with: nvm install v12.18.1 && nvm install v14.17.0)
#   - zip
#   - jq
#   - The two repositories checked out side by side under one parent:
#         parent/
#           cmap-node-api/    (this script lives here)
#           cmap-react/
#   - The Google service account key present at:
#         cmap-node-api/utility/googleServiceAccountKeyFile.json
#   - A populated .env in each repository (values from the Elastic
#     Beanstalk environment configuration or the local snapshot)
#
# How to run:
#   From the cmap-node-api project root:
#       chmod +x build-release.sh      (first time only)
#       ./build-release.sh
#
# The resulting archive is written to:
#       parent/deployments/<timestamp>_back-<apiVer>_front-<webVer>.zip
#
# Exit codes:
#   0  success
#   1  a required condition was not met (missing repo, key file, tool, or
#      a failed build); the script stops before producing an archive

set -euo pipefail

# ---------------------------------------------------------------------------
# 0. Resolve locations
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # cmap-node-api
PARENT_DIR="$(dirname "$SCRIPT_DIR")"                        # the common parent
REACT_DIR="$PARENT_DIR/cmap-react"
API_DIR="$SCRIPT_DIR"

echo "=== Simons CMAP build-release ==="
date
echo "API repo:   $API_DIR"
echo "React repo: $REACT_DIR"

# ---------------------------------------------------------------------------
# 1. Preconditions: repositories and tools
# ---------------------------------------------------------------------------

if [ ! -d "$REACT_DIR" ]; then
  echo "ERROR: cannot find the React repository at: $REACT_DIR"
  echo "       Both repositories must sit side by side under one parent."
  exit 1
fi

for tool in zip jq; do
  if ! command -v "$tool" > /dev/null 2>&1; then
    echo "ERROR: required tool not found on PATH: $tool"
    exit 1
  fi
done

# Load nvm so this script can switch Node versions.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
else
  echo "ERROR: nvm not found at $NVM_DIR/nvm.sh"
  echo "       This script uses nvm to select the correct Node version per repository."
  exit 1
fi

API_NODE="$(cat "$API_DIR/.nvmrc")"
REACT_NODE="$(cat "$REACT_DIR/.nvmrc")"
echo "Pinned Node for API build/package: $API_NODE"
echo "Pinned Node for React build:       $REACT_NODE"

# ---------------------------------------------------------------------------
# 2. Precondition: Google service account key file (email capability)
# ---------------------------------------------------------------------------
#
# The previous script used:  if [ "$projectId"=="simons-cmap" ]
# That is a single string with no spaces around ==, which the shell always
# treats as non-empty and therefore true. The check never failed. The
# version below actually verifies the file exists and parses, and confirms
# the expected project id.

KEY_FILE="$API_DIR/utility/googleServiceAccountKeyFile.json"

echo "--- checking Google service account key file ---"
if [ ! -f "$KEY_FILE" ]; then
  echo "ERROR: Google service account key file not found at:"
  echo "       $KEY_FILE"
  echo "       The deployed site cannot send email without it."
  exit 1
fi

projectId="$(jq -r '.project_id' "$KEY_FILE" 2>/dev/null || true)"
if [ "$projectId" != "simons-cmap" ]; then
  echo "ERROR: the key file's project_id is not 'simons-cmap' (found: '$projectId')."
  echo "       Refusing to build with an unexpected or unreadable key file."
  exit 1
fi
echo "Key file present and project_id confirmed: $projectId"

# ---------------------------------------------------------------------------
# 3. Build the React application (React Node version)
# ---------------------------------------------------------------------------

echo "--- building React application ---"
nvm use "$REACT_NODE"
echo "Using Node: $(node -v) for the React build"

cd "$REACT_DIR"

# Install dependencies to match the lockfile, then build.
# npm ci is preferred for a clean, reproducible install; if the lockfile
# and package.json are out of sync it will fail, in which case use npm install.
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

# The build script writes build info, runs the production build, writes
# build/web-app-version-tag.json, and renames build/index.html to
# build/app.html (which the API serves).
npm run build

# Confirm the build produced the two things packaging depends on.
if [ ! -f "$REACT_DIR/build/app.html" ]; then
  echo "ERROR: React build did not produce build/app.html."
  echo "       The API serves app.html; packaging cannot proceed."
  exit 1
fi
if [ ! -f "$REACT_DIR/build/web-app-version-tag.json" ]; then
  echo "ERROR: React build did not produce build/web-app-version-tag.json."
  exit 1
fi
echo "React build complete."

# ---------------------------------------------------------------------------
# 4. Copy the React build into the API public directory (API Node version)
# ---------------------------------------------------------------------------

echo "--- assembling API public directory ---"
nvm use "$API_NODE"
echo "Using Node: $(node -v) for packaging"

cd "$API_DIR"

# In the current repository, public/ is entirely a build artifact: no files
# under public/ are tracked by git. It is therefore safe to remove the whole
# directory and repopulate it from the React build. (This differs from older
# documentation, which described tracked files under public/ that had to be
# preserved. That is no longer the case.)
rm -rf "$API_DIR/public"
mkdir -p "$API_DIR/public"
cp -r "$REACT_DIR/build/"* "$API_DIR/public/"

if [ ! -f "$API_DIR/public/app.html" ]; then
  echo "ERROR: app.html was not copied into public/. Aborting before packaging."
  exit 1
fi
echo "React build copied into public/."

# ---------------------------------------------------------------------------
# 5. Read versions and package the archive
# ---------------------------------------------------------------------------

apiVer="$(jq -r '.version' "$API_DIR/package.json")"
webVer="$(jq -r '.version' "$API_DIR/public/web-app-version-tag.json")"
echo "API version:     $apiVer"
echo "Web app version: $webVer"

DEPLOY_DIR="$PARENT_DIR/deployments"
mkdir -p "$DEPLOY_DIR"

STAMP="$(date +%Y%m%d-%H%M)"
ARCHIVE="$DEPLOY_DIR/${STAMP}_back-${apiVer}_front-${webVer}.zip"

echo "--- creating archive ---"
echo "Archive: $ARCHIVE"

# Package the API directory. The exclusionList file in the API root controls
# what is left out (node_modules, .git, precache assets, etc.). The .env file
# is excluded by exclusionList as well; environment variables are supplied on
# the Elastic Beanstalk instance, not shipped in the archive. The
# .ebextensions directory and the Google key file ARE included: .ebextensions
# is tracked and picked up automatically; the key file is present on disk and
# not excluded, so it is included.
cd "$API_DIR"
zip -q -r "$ARCHIVE" . -x@"$API_DIR/exclusionList"

# Report the archive size as a sanity check. The historical expected size is
# roughly 26 MB; a wildly different size is worth investigating before upload.
SIZE_H="$(du -h "$ARCHIVE" | cut -f1)"
echo "Archive created: $ARCHIVE ($SIZE_H)"

echo ""
echo "=== build-release complete ==="
echo "Next step: upload this archive through the Elastic Beanstalk console."
echo "See the deployment runbook for the upload and validation procedure."
echo "Deploy to CMAPDevelopment2 (simonscmap.dev) first, validate, then"
echo "promote the same archive to CMAPProduction (simonscmap.com)."
