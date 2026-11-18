module.exports = async function handler(request, response) {
  if (process.env.DATABASE_URL) {
    return handlePostgresTemplateRequest(request, response);
  }
  return handleTemplateProxyRequest(request, response);
};

async function handleTemplateProxyRequest(request, response) {
  const adminSession = require("./admin-session.js");
  const { proxyTemplateRequest } = await import("../worker/src/template-proxy.js");
  if (request.method === "OPTIONS" ||
      (request.method !== "GET" && request.method !== "POST")) {
    return proxyTemplateRequest(request, response);
  }
  if (!adminSession.getConfiguration()) {
    sendJson(response, 503, {
      error: "Admin login is not configured on this deployment.",
    });
    return;
  }
  if (!adminSession.hasValidSession(request)) {
    sendJson(response, 401, { error: "Sign in to access saved templates." });
    return;
  }
  if (request.method === "POST" && !adminSession.isSameOrigin(request)) {
    sendJson(response, 403, { error: "Template changes must come from this site." });
    return;
  }
  return proxyTemplateRequest(request, response);
}

async function handlePostgresTemplateRequest(request, response) {
  const { canonicalFormType, normalizeTemplate, validateTemplate } =
    await import("../worker/src/render.js");
  const adminSession = require("./admin-session.js");
  const store = require("./postgres-template-store.js");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.method !== "GET" && request.method !== "POST") {
    sendJson(response, 405, { error: "Use GET or POST /api/templates." });
    return;
  }
  if (!adminSession.getConfiguration()) {
    sendJson(response, 503, {
      error: "Admin login is not configured on this deployment.",
    });
    return;
  }
  if (!adminSession.hasValidSession(request)) {
    sendJson(response, 401, { error: "Sign in to access saved templates." });
    return;
  }
  if (request.method === "GET") {
    const url = new URL(request.url, "http://localhost");
    const formType = url.searchParams.get("formType");
    if (formType) {
      let canonical;
      try {
        canonical = canonicalFormType(formType);
      } catch (error) {
        sendJson(response, 400, { error: error.message });
        return;
      }
      try {
        const template = await store.getFormTemplate(canonical);
        if (!template) {
          sendJson(response, 404, { error: `No saved template exists for formType "${formType}".` });
          return;
        }
        sendJson(response, 200, template);
      } catch (error) {
        console.error("Unable to read PostgreSQL template:", error);
        sendJson(response, 500, { error: "Unable to read the saved form template." });
      }
      return;
    }
    try {
      sendJson(response, 200, { templates: await store.listFormTemplates() });
    } catch (error) {
      console.error("Unable to read PostgreSQL templates:", error);
      sendJson(response, 500, { error: "Unable to read saved form templates." });
    }
    return;
  }
  if (!adminSession.isSameOrigin(request)) {
    sendJson(response, 403, { error: "Template changes must come from this site." });
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
      typeof body.formType !== "string" || !body.template) {
    sendJson(response, 400, { error: "formType and template are required." });
    return;
  }

  let formType;
  let template;
  let name;
  try {
    formType = canonicalFormType(body.formType);
    template = normalizeTemplate(body.template);
    validateTemplate(template);
    name = typeof template.name === "string" ? template.name.trim() : "";
    if (!name || name.length > 160) {
      throw new TypeError("template.name is required and must be at most 160 characters.");
    }
    template = { ...template, formType: body.formType };
    if (JSON.stringify(template).length > 250_000) {
      throw new TypeError("Template configuration must be smaller than 250 KB.");
    }
  } catch (error) {
    if (error instanceof TypeError) {
      sendJson(response, 400, { error: error.message });
      return;
    }
    throw error;
  }

  try {
    sendJson(response, 200, {
      template: await store.saveFormTemplate(formType, name, template),
    });
  } catch (error) {
    console.error("Unable to save PostgreSQL template:", error);
    sendJson(response, 500, { error: "Unable to save the form template." });
  }
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "300kb",
    },
  },
};
