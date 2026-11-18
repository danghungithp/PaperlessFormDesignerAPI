const { getConfiguration, hasValidSession, sendJson } = require("../admin-session.js");

module.exports = function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Use GET /api/auth/session." });
    return;
  }
  if (!getConfiguration()) {
    sendJson(response, 503, {
      error: "Admin login is not configured on this deployment.",
    });
    return;
  }
  sendJson(response, 200, { authenticated: hasValidSession(request) });
};
