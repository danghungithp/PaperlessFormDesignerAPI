const { createHash, createHmac, timingSafeEqual } = require("node:crypto");

const COOKIE_NAME = "paperless_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function getConfiguration() {
  const password = process.env.TEMPLATE_ADMIN_PASSWORD;
  const secret = process.env.TEMPLATE_SESSION_SECRET;
  if (!password || password.length < 24 || !secret || secret.length < 32) {
    return null;
  }
  return { password, secret };
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

function isSameOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const protocol = request.headers["x-forwarded-proto"] ||
    (process.env.NODE_ENV === "production" ? "https" : "http");
  if (!origin || !host) return false;
  try {
    return new URL(origin).origin === `${protocol.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
  } catch {
    return false;
  }
}

function signature(expiration, secret) {
  return createHmac("sha256", secret).update(expiration).digest("base64url");
}

function sessionCookieValue(secret, expiration = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS) {
  const value = String(expiration);
  return `${value}.${signature(value, secret)}`;
}

function cookieFromRequest(request) {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== "string") return "";
  const cookie = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return cookie ? cookie.slice(COOKIE_NAME.length + 1) : "";
}

function hasValidSession(request) {
  const configuration = getConfiguration();
  if (!configuration) return false;
  const [expiration, suppliedSignature, ...extra] = cookieFromRequest(request).split(".");
  if (extra.length || !/^\d{10}$/.test(expiration) || !suppliedSignature) return false;
  if (Number(expiration) <= Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(signature(expiration, configuration.secret));
  const supplied = Buffer.from(suppliedSignature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function passwordMatches(candidate) {
  const configuration = getConfiguration();
  if (!configuration || typeof candidate !== "string" || candidate.length > 512) return false;
  const expected = createHash("sha256").update(configuration.password).digest();
  const supplied = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(expected, supplied);
}

function setSessionCookie(response, request, clear = false) {
  const forwardedProtocol = request.headers["x-forwarded-proto"]?.split(",")[0].trim();
  const secure = process.env.NODE_ENV === "production" ||
    forwardedProtocol === "https";
  const value = clear ? "" : sessionCookieValue(getConfiguration().secret);
  const maxAge = clear ? 0 : SESSION_TTL_SECONDS;
  response.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`,
  );
}

module.exports = {
  getConfiguration,
  hasValidSession,
  isSameOrigin,
  passwordMatches,
  sendJson,
  setSessionCookie,
};
