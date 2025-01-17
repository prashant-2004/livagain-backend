var admin = require("firebase-admin");

var serviceAccount = require("./livagain-65e42-firebase-adminsdk-lm702-1fd6300b08.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://livagain-65e42-default-rtdb.firebaseio.com"
});

const db = admin.firestore(); // Use Firestore
// Or for Realtime Database: const db = admin.database();

module.exports = db;
