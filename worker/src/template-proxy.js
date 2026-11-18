const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function respond(response, status, body, contentType = "application/json; charset=utf-8") {
  response.statusCode = status;
  response.setHeader("Content-Type", contentType);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(body);
}

export async function proxyTemplateRequest(request, response) {
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    response.setHeader(name, value);
  }
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.method !== "GET" && request.method !== "POST") {
    respond(response, 405, JSON.stringify({ error: "Use GET or POST /api/templates." }));
    return;
  }

  const configuredUrl = process.env.TEMPLATE_STORE_URL;
  if (!configuredUrl) {
    respond(response, 503, JSON.stringify({ error: "TEMPLATE_STORE_URL is not configured." }));
    return;
  }

  try {
    const storeUrl = new URL(configuredUrl);
    if (storeUrl.protocol !== "https:" && storeUrl.protocol !== "http:") {
      throw new TypeError("TEMPLATE_STORE_URL must use HTTP or HTTPS.");
    }
    const incomingUrl = new URL(request.url, "http://localhost");
    const destination = `${storeUrl.origin}/api/templates${incomingUrl.search}`;
    const headers = {};
    const cookie = request.headers.cookie;
    if (cookie) headers.Cookie = cookie;
    if (request.method === "POST") {
      headers["Content-Type"] = "application/json";
      headers.Origin = storeUrl.origin;
    }
    const upstream = await fetch(destination, {
      method: request.method,
      headers,
      body: request.method === "POST"
        ? typeof request.body === "string" ? request.body : JSON.stringify(request.body)
        : undefined,
    });
    respond(response, upstream.status, await upstream.text(), upstream.headers.get("Content-Type") ?? undefined);
  } catch (error) {
    console.error("Template store request failed:", error);
    const message = error instanceof TypeError ? error.message : "Unable to reach the template store.";
    respond(response, 502, JSON.stringify({ error: message }));
  }
}
