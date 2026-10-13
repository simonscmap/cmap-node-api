# Script to automate creating a zip archive for releasing the CMAP API and Web App

# depends on: 7z and jq

# - checks to ensure the google service account key file is present
# - handles copying the web app build to the node api and clearing out old files
# - automatically names the resulting archive with the project versions
# - creates archive and moves old archives to a ./releases folder for reference

# To run:
# (1) make this file executable
# (2) place it in the same directory that contains both projects (or modify the relative paths in the script below)
# (3) execute `./deploy.sh` from your terminal

echo "starting deploy script";

date;

pwd;

echo "checking google key file exists"

projectId=$(jq '.project_id' './cmap-node-api/utility/googleServiceAccountKeyFile.json')
privateKeyId=$(jq '.private_key_id' './cmap-node-api/utility/googleServiceAccountKeyFile.json')

if [ "$projectId"=="simons-cmap" ]; then
    echo "Key file exists"
else
   echo "No key file found. App will not be able to send emails.";
   echo $projectId;
   exit 1;
fi;

echo "remove static dir from node api";

rm -rf ./cmap-node-api/public/static/

echo "copy build to public folder"

cp -r ./cmap-react/build/* ./cmap-node-api/public/

echo "Web App Version:"
webAppVer=$(jq '.version' './cmap-react/build/web-app-version-tag.json' | tr -d '"')
echo $webAppVer

echo "API Version"
apiVer=$(jq '.version' './cmap-node-api/package.json' | tr -d '"')
echo $apiVer

echo "creating archive";

#mv *.zip ./releases/

cd cmap-node-api

7z a -tzip "../cmapDeployment_$(date +%F)_api("$apiVer")_web("$webAppVer").zip" ./ -xr@exclusionList
