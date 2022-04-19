const fs = require("fs");

// get api version from its package.json file

let apiPackage = fs.readFileSync(process.cwd() + "/package.json", {
  encoding: "utf8",
  flag: "r",
});

let ap;
try {
  ap = JSON.parse(apiPackage);
} catch (e) {
  console.error("error parsing package.json", e);
}

// get web app version from public folder
// NOTE this depends on the deployment script creating a version file in the public folder

let webPackage = null;

try {
  fs.readFileSync(process.cwd() + "/public/web-app-version-tag.json", {
    encoding: "utf8",
    flag: "r",
  });
} catch (e) {
  console.error("error trying to reat web app version file");
  console.error("if this file is missing, make sure it was produced in the web app build step");
  console.log(e);
}

let wp;
try {
  if (webPackage) {
    wp = JSON.parse(webPackage);
  }
} catch (e) {
  console.error("error parsing package.json", e);
}

module.exports = {
  versions: {
    api: ap.version,
    web: wp ? wp.version : undefined,
  }
};
