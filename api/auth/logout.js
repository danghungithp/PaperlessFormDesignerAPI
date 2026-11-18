const { isSameOrigin, sendJson, setSessionCookie } = require("../admin-session.js");

module.exports = function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST /api/auth/logout." });
    return;
  }
  if (!isSameOrigin(request)) {
    sendJson(response, 403, { error: "Logout requests must come from this site." });
    return;
  }
  setSessionCookie(response, request, true);
  sendJson(response, 200, { authenticated: false });
};
