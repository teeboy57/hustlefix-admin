const admin = require("firebase-admin");
const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");

admin.initializeApp();

setGlobalOptions({maxInstances: 10});

exports.sendFcmNotification = onCall(async (request) => {
  const data = request && request.data ? request.data : {};
  const userId = data.userId;
  const title = data.title || "HustleFix";
  const body = data.body || "";
  const screen = data.screen;

  const allowedScreens = ["verification", "emergency", "wallet"];
  if (!userId) {
    throw new HttpsError("invalid-argument", "userId is required.");
  }

  if (!allowedScreens.includes(screen)) {
    throw new HttpsError(
        "invalid-argument",
        "screen must be one of: verification, emergency, wallet.",
    );
  }

  const tokenSnap = await admin.database()
      .ref("users/" + userId + "/fcmToken")
      .once("value");
  const token = tokenSnap.val();

  if (!token) {
    return {success: false, reason: "no-fcm-token"};
  }

  const message = {
    token,
    notification: {
      title,
      body,
    },
    data: {
      screen,
    },
  };

  await admin.messaging().send(message);

  return {success: true, screen, token: token.slice(0, 12) + "..."};
});
