const admin = require("firebase-admin");
const path = require("path");

if (!admin.apps.length) {
  const serviceAccount = require(path.join(
    __dirname,
    "../ml_worker/serviceAccountKey.json"
  ));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
