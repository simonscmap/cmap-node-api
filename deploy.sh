# Script to automate creating a zip archive for releasing the CMAP API and Web App

# depends on: 7z and jq
# depends on: cmap-react and cmap-node-api being in the same parent directory
# depends on: googleServiceAccountKeyFile.json being in the utility folder
# depends on: Sentry org/project/auth token being set as environment variables or .sentryclirc file

# - checks to ensure the google service account key file is present
# - handles copying the web app build to the node api and clearing out old files
# - automatically names the resulting archive with the project versions
# - creates archive and moves old archives to a ./releases folder for reference
# - Environment variables must be set at build time, which for frontend is here

# Get the directory where the script is located
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to cmap-react directory to get the correct git commit hash
cd "$PARENT_DIR/cmap-react"
GIT_COMMIT="$(git rev-parse --short HEAD)"
cd "$SCRIPT_DIR"

# Configure Sentry release
export SENTRY_RELEASE="$(jq -r '.version' "$PARENT_DIR/cmap-react/package.json")-${GIT_COMMIT}"
echo "⭐️ Using Sentry release: $SENTRY_RELEASE"

# Expose Sentry release to Create React App
export REACT_APP_SENTRY_RELEASE="$SENTRY_RELEASE"
echo "⭐️ Setting REACT_APP_SENTRY_RELEASE: $REACT_APP_SENTRY_RELEASE"

# For react, NODE_ENV is determined by the build command
# Sentry DSN is now determined at runtime based on hostname (see index.js)

echo "⭐️ starting deploy script";
 
date;
echo "⭐️ Running from: $SCRIPT_DIR"

echo "⭐️ checking google key file exists"

projectId=$(jq '.project_id' "$SCRIPT_DIR/utility/googleServiceAccountKeyFile.json")
privateKeyId=$(jq '.private_key_id' "$SCRIPT_DIR/utility/googleServiceAccountKeyFile.json")

if [ "$projectId"=="simons-cmap" ]; then
    echo "⭐️ Key file exists"
else
   echo "⭐️ No key file found. App will not be able to send emails.";
   echo $projectId;
   exit 1;
fi;

echo "⭐️ Building cmap-react project"
cd "$PARENT_DIR/cmap-react"

# Copy .sentryclirc to ensure Sentry CLI can find it
cp "$SCRIPT_DIR/.sentryclirc" .

npm run build

# Upload source maps to Sentry (both production and staging projects)
echo "⭐️ Uploading source maps to Sentry for release $SENTRY_RELEASE"

echo "⭐️ Uploading to production project (frontend)"
npx @sentry/cli@^1.65.0 releases -p frontend new "$SENTRY_RELEASE" || echo "⭐️ Release already exists"
npx @sentry/cli@^1.65.0 releases -p frontend files "$SENTRY_RELEASE" upload-sourcemaps build --rewrite
npx @sentry/cli@^1.65.0 releases -p frontend finalize "$SENTRY_RELEASE"

echo "⭐️ Uploading to staging/development project (frontend-staging-development)"
npx @sentry/cli@^1.65.0 releases -p frontend-staging-development new "$SENTRY_RELEASE" || echo "⭐️ Release already exists"
npx @sentry/cli@^1.65.0 releases -p frontend-staging-development files "$SENTRY_RELEASE" upload-sourcemaps build --rewrite
npx @sentry/cli@^1.65.0 releases -p frontend-staging-development finalize "$SENTRY_RELEASE"

# Clean up .sentryclirc file
rm .sentryclirc

cd "$SCRIPT_DIR"

echo "⭐️ create public dir if needed";
mkdir -p "$SCRIPT_DIR/public"

echo "⭐️ remove static dir from node api";
rm -rf "$SCRIPT_DIR/public/static/"

echo "⭐️ copy build to public folder"
cp -r "$PARENT_DIR/cmap-react/build/"* "$SCRIPT_DIR/public/"

echo "⭐️ Web App Version:"
webAppVer=$(jq '.version' "$PARENT_DIR/cmap-react/build/web-app-version-tag.json" | tr -d '"')
echo $webAppVer

echo "⭐️ API Version"
apiVer=$(jq '.version' "$SCRIPT_DIR/package.json" | tr -d '"')
echo $apiVer

# Create deployments directory in parent directory if it doesn't exist
mkdir -p "$PARENT_DIR/deployments"

echo "⭐️ creating archive";
cd "$SCRIPT_DIR"
zip -q -r "$PARENT_DIR/deployments/$(date +%Y%m%d-%H%M)_back-${apiVer}_front-${webAppVer}.zip" . -x@"$SCRIPT_DIR/exclusionList"

# for intel based computers
# 7z a -tzip "$PARENT_DIR/deployments/$(date +%Y%m%d-%H%M)_back-${apiVer}_front-${webAppVer}.zip" ./ -xr@exclusionList
