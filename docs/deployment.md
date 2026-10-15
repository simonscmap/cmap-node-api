# Deployment

## What the deployment artifact contains

The artifact is a zip of the Node API project directory, with the compiled React
application copied into its `public/` directory, and with a set of files
excluded. The exclusions are listed in `exclusionList` in the Node API root and
the local secret files in addition to the build caches
and version-control directories. The Google service account key file is
deliberately not excluded, because the deployed site needs it to send email.

The archive does not contain `node_modules`; dependencies are installed on the
Elastic Beanstalk instance during deployment. The archive is roughly 26
megabytes; a size very different from that is worth investigating before upload.

## The build and packaging pipeline

Building and packaging is done by moving the `simpleBuildRelease.sh` script into the parent repository and executing it.  
It assumes both repositories are checked out side by side under the common parent directory:

```
parent/
  cmap-node-api/
  cmap-react/
```

At a high level the script:

1. Confirms the React repository is present beside the API repository and that
   the required tools (`nvm`, `zip`, `jq`) are available.
2. Confirms the Google service account key file is present and its project
   identifier is `simons-cmap`.
4. Clears the Node application's API `public/` directory, and copies the React build into it. In
   the current repository `public/` holds no version-controlled files, so it can
   be wiped and repopulated cleanly.
5. Reads both application version numbers and packages the API directory into a timestamped,
   version-tagged zip archive.

## Build the deployment

1. From the parent directory, move to the React app directory: `cd cmap-react`  
2. Use the node version specified in the .nvmrc file: `nvm use`
3. Build the app: `npm run build`
4. Move back to the parent directory `cd ../`
5. Copy the build script from the Node app into the parent directory: `cp cmap-node-api/simpleBuildRelease.sh .`
6. Make sure the script is executable: `chmod +x simpleBuildRelease.sh`
7. Run the script: `./simpleBuildRelease.sh`

The script builds and packages only. It does not contact AWS or any external
service. Uploading is a separate, manual console step, so an archive can be
produced and inspected before any deployment. This separation is deliberate.


## Deploying through the Elastic Beanstalk console

1. Sign in to the Elastic Beanstalk console for `us-west-1`.
2. Select the target environment, confirm it is healthy, and use "Upload and
   deploy" with the zip archive.
3. Set a distinct version label matching the archive name, so releases remain
   distinguishable.
4. Deploy to `CMAPDevelopment2` first and validate `simonscmap.dev`.
5. Promote the same archive to `CMAPProduction` through "Application versions"
   rather than rebuilding.

## Rollback

Every deployed archive remains available in the console under "Application
versions". To roll back, deploy the previous known-good version to the affected
environment through the actions menu. Because the same archive can be redeployed
without rebuilding, rollback is a console action and does not require the local
machine.