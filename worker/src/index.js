import { renderForm } from "./render.js";
import { getFormTemplate, listFormTemplates, saveFormTemplate } from "./template-store.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
const ADMIN_COOKIE = "paperless_admin_session";
const ADMIN_SESSION_TTL = 8 * 60 * 60;
const textEncoder = new TextEncoder();

function adminConfiguration(env) {
  const password = env.TEMPLATE_ADMIN_PASSWORD;
  const secret = env.TEMPLATE_SESSION_SECRET;
  return typeof password === "string" && password.length >= 24 &&
    typeof secret === "string" && secret.length >= 32
    ? { password, secret }
    : null;
}

function authJsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

function isSameOrigin(request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecode(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signAdminSession(expiration, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(expiration));
  return base64UrlEncode(new Uint8Array(signature));
}

function adminCookieValue(request) {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return "";
  const value = cookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`));
  return value ? value.slice(ADMIN_COOKIE.length + 1) : "";
}

async function hasAdminSession(request, env) {
  const config = adminConfiguration(env);
  if (!config) return false;
  const [expiration, suppliedSignature, ...extra] = adminCookieValue(request).split(".");
  if (extra.length || !/^\d{10}$/.test(expiration) || Number(expiration) <= Math.floor(Date.now() / 1000)) {
    return false;
  }
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(config.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(suppliedSignature),
      textEncoder.encode(expiration),
    );
  } catch {
    return false;
  }
}

async function passwordMatches(candidate, expected) {
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", textEncoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", textEncoder.encode(expected)),
  ]);
  const candidateBytes = new Uint8Array(candidateHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= candidateBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

function adminSessionCookie(request, value, maxAge) {
  const secure = new URL(request.url).protocol === "https:";
  return `${ADMIN_COOKIE}=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

async function handleAdminAuth(request, env, pathname) {
  const config = adminConfiguration(env);
  if (!config) {
    return authJsonResponse({
      error: "Set TEMPLATE_ADMIN_PASSWORD (at least 24 characters) and TEMPLATE_SESSION_SECRET (at least 32 characters).",
    }, 503);
  }
  if (pathname === "/api/auth/session" && request.method === "GET") {
    return authJsonResponse({ authenticated: await hasAdminSession(request, env) });
  }
  if (request.method !== "POST") {
    return authJsonResponse({ error: "Use GET /api/auth/session or POST /api/auth/login and /api/auth/logout." }, 405);
  }
  if (!isSameOrigin(request)) {
    return authJsonResponse({ error: "Authentication requests must come from this site." }, 403);
  }
  if (pathname === "/api/auth/logout") {
    return authJsonResponse({ authenticated: false }, 200, {
      "Set-Cookie": adminSessionCookie(request, "", 0),
    });
  }
  if (pathname !== "/api/auth/login") {
    return authJsonResponse({ error: "Unknown authentication endpoint." }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return authJsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      typeof body.password !== "string" || body.password.length > 512) {
    return authJsonResponse({ error: "password is required." }, 400);
  }
  if (!await passwordMatches(body.password, config.password)) {
    return authJsonResponse({ error: "Mật khẩu không chính xác." }, 401);
  }

  const expiration = String(Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL);
  const value = `${expiration}.${await signAdminSession(expiration, config.secret)}`;
  return authJsonResponse({ authenticated: true }, 200, {
    "Set-Cookie": adminSessionCookie(request, value, ADMIN_SESSION_TTL),
  });
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function htmlResponse(html) {
  return new Response(html, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}

function base64Encode(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function pdfFileName(formType) {
  const slug = String(formType)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `paperless-${slug || "form"}.pdf`;
}

async function handlePdf(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST /api/render-pdf." }, 405);
  }
  if (!env.BROWSER || typeof env.BROWSER.quickAction !== "function") {
    return jsonResponse({ error: "Cloudflare Browser Run is not configured." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Request body must be a JSON object." }, 400);
  }

  let html;
  let paperSize;
  let orientation;
  try {
    if (body.template === undefined && env.DB && typeof body.formType === "string") {
      const saved = await getFormTemplate(env.DB, body.formType);
      if (saved) body = { ...body, template: saved.template };
    }

    html = renderForm(body);
    paperSize = body.paperSize ?? body.template?.paperSize ?? "A4";
    orientation = body.orientation ?? body.template?.orientation ?? "portrait";
    if (!["A3", "A4", "A5", "Letter", "Legal"].includes(paperSize)) {
      throw new TypeError("paperSize must be A3, A4, A5, Letter, or Legal.");
    }
    if (orientation !== "portrait" && orientation !== "landscape") {
      throw new TypeError("orientation must be portrait or landscape.");
    }
  } catch (error) {
    if (error instanceof TypeError) {
      return jsonResponse({ error: error.message }, 400);
    }
    console.error("Unable to prepare form for PDF rendering:", error);
    return jsonResponse({ error: "Unable to render the requested form." }, 500);
  }

  try {
    const pdfResponse = await env.BROWSER.quickAction("pdf", {
      html,
      pdfOptions: {
        format: paperSize.toLowerCase(),
        landscape: orientation === "landscape",
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: "8mm",
          right: "8mm",
          bottom: "8mm",
          left: "8mm",
        },
      },
    });
    if (!pdfResponse.ok) {
      console.error("Cloudflare Browser Run PDF request failed:", pdfResponse.status);
      return jsonResponse({ error: "Cloudflare Browser Run could not generate the PDF." }, 502);
    }

    const pdf = new Uint8Array(await pdfResponse.arrayBuffer());
    if (new TextDecoder().decode(pdf.subarray(0, 5)) !== "%PDF-") {
      console.error("Cloudflare Browser Run returned a non-PDF response.");
      return jsonResponse({ error: "Cloudflare Browser Run returned an invalid PDF." }, 502);
    }

    return jsonResponse({
      html,
      pdfBase64: base64Encode(pdf),
      pdfContentType: "application/pdf",
      pdfFileName: pdfFileName(body.FormCode ?? body.formCode ?? body.FormType ?? body.formType),
      paperSize,
      orientation,
    }, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("Cloudflare Browser Run PDF request failed:", error);
    return jsonResponse({ error: "Unable to generate the PDF for this form." }, 502);
  }
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method === "GET" && pathname === "/health") {
      return jsonResponse({ ok: true, service: "paperless-form-renderer" });
    }
    if (pathname.startsWith("/api/auth/")) {
      return handleAdminAuth(request, env, pathname);
    }
    if (pathname === "/api/templates") {
      if (!env.DB) {
        return jsonResponse({ error: "The D1 template database is not configured." }, 503);
      }
      if (!adminConfiguration(env)) {
        return jsonResponse({
          error: "Admin login is not configured on this deployment.",
        }, 503);
      }
      if (request.method === "GET") {
        if (!await hasAdminSession(request, env)) {
          return jsonResponse({ error: "Sign in to access saved templates." }, 401);
        }
        try {
          const formType = url.searchParams.get("formType");
          if (formType) {
            const record = await getFormTemplate(env.DB, formType);
            return record
              ? jsonResponse(record)
              : jsonResponse({ error: `No saved template exists for formType "${formType}".` }, 404);
          }
          return jsonResponse({ templates: await listFormTemplates(env.DB) });
        } catch (error) {
          if (error instanceof TypeError) {
            return jsonResponse({ error: error.message }, 400);
          }
          console.error("Unable to read form templates:", error);
          return jsonResponse({ error: "Unable to read saved form templates." }, 500);
        }
      }
      if (request.method === "POST") {
        if (!isSameOrigin(request)) {
          return jsonResponse({ error: "Template changes must come from this site." }, 403);
        }
        if (!await hasAdminSession(request, env)) {
          return jsonResponse({ error: "Sign in to save templates." }, 401);
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Request body must be valid JSON." }, 400);
        }
        if (!body || typeof body !== "object" || Array.isArray(body) ||
            typeof body.formType !== "string" || !body.template) {
          return jsonResponse({ error: "formType and template are required." }, 400);
        }
        try {
          return jsonResponse({
            template: await saveFormTemplate(env.DB, body.formType, body.template),
          });
        } catch (error) {
          if (error instanceof TypeError) {
            return jsonResponse({ error: error.message }, 400);
          }
          console.error("Unable to save form template:", error);
          return jsonResponse({ error: "Unable to save the form template." }, 500);
        }
      }
      return jsonResponse({ error: "Use GET or POST /api/templates." }, 405);
    }
    if (pathname === "/api/render-pdf") {
      return handlePdf(request, env);
    }
    if (request.method === "GET" && env.ASSETS && !pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }
    if (request.method === "GET" && pathname === "/") {
      return jsonResponse({
        service: "paperless-form-renderer",
        endpoint: "POST /api/render",
        supportedForms: ["capex", "capex-v1", "capex-v3", "material-take-out"],
        requestBody: {
          formType: "_CapexFormV3",
          JsonFormValue: { _CapexFormV3: {} },
          JsonApprovalLine: [],
          lineItems: [],
        },
      });
    }
    if (pathname !== "/api/render") {
      return jsonResponse({ error: "Not found." }, 404);
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Use POST /api/render." }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "Request body must be a JSON object." }, 400);
    }

    try {
      if (body.template === undefined && env.DB && typeof body.formType === "string") {
        const saved = await getFormTemplate(env.DB, body.formType);
        if (saved) body = { ...body, template: saved.template };
      }
      return htmlResponse(renderForm(body));
    } catch (error) {
      if (error instanceof TypeError) {
        return jsonResponse({ error: error.message }, 400);
      }
      console.error("Unable to render form:", error);
      return jsonResponse({ error: "Unable to render the requested form." }, 500);
    }
  },
};
