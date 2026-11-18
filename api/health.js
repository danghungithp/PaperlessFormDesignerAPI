module.exports = function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.status(200).json({ ok: true, service: "paperless-form-renderer" });
};
