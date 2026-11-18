import { renderForm } from "../src/render.js";
import { withSavedTemplate } from "../src/template-client.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    response.setHeader(name, value);
  }
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST /api/render." });
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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    sendJson(response, 400, { error: "Request body must be a JSON object." });
    return;
  }

  try {
    body = await withSavedTemplate(body, process.env.TEMPLATE_STORE_URL);
    response.statusCode = 200;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(renderForm(body));
  } catch (error) {
    if (error instanceof TypeError) {
      sendJson(response, 400, { error: error.message });
      return;
    }
    console.error("Unable to resolve or render form template:", error);
    sendJson(response, 500, { error: "Unable to render the requested form." });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};
