const {
  getConfiguration,
  isSameOrigin,
  passwordMatches,
  sendJson,
  setSessionCookie,
} = require("../admin-session.js");

module.exports = function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST /api/auth/login." });
    return;
  }
  if (!isSameOrigin(request)) {
    sendJson(response, 403, { error: "Login requests must come from this site." });
    return;
  }
  if (!getConfiguration()) {
    sendJson(response, 503, {
      error: "Set TEMPLATE_ADMIN_PASSWORD (at least 24 characters) and TEMPLATE_SESSION_SECRET (at least 32 characters).",
    });
    return;
  }

  let body = request.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      sendJson(response, 400, { error: "Request body must be valid JSON." });
      return;
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      typeof body.password !== "string") {
    sendJson(response, 400, { error: "password is required." });
    return;
  }
  if (!passwordMatches(body.password)) {
    sendJson(response, 401, { error: "Mật khẩu không chính xác." });
    return;
  }

  setSessionCookie(response, request);
  sendJson(response, 200, { authenticated: true });
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "2kb",
    },
  },
};
