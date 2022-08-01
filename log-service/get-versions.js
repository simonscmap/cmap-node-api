const fs = require("fs");
const isProduction =
  process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";
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
  webPackage = fs.readFileSync(process.cwd() + "/public/web-app-version-tag.json", {
    encoding: "utf8",
    flag: "r",
  });
} catch (e) {
  if (isProduction) {
    console.error("error trying to read web app version file");
    console.error("if this file is missing, make sure it was produced in the web app build step");
  }
}

let wp;
try {
  if (webPackage) {
    wp = JSON.parse(webPackage);
  } else if (isProduction) {
    console.log("no version file for web app")
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
