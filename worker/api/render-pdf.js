import { renderPdf } from "../src/pdf.js";
import { renderForm } from "../src/render.js";
import { withSavedTemplate } from "../src/template-client.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function parseRequestBody(body) {
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      throw new TypeError("Request body must be valid JSON.");
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TypeError("Request body must be a JSON object.");
  }
  return body;
}

function pdfFileName(formType) {
  const slug = String(formType)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `paperless-${slug || "form"}.pdf`;
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
    sendJson(response, 405, { error: "Use POST /api/render-pdf." });
    return;
  }

  try {
    const body = await withSavedTemplate(
      parseRequestBody(request.body),
      process.env.TEMPLATE_STORE_URL,
    );
    const html = renderForm(body);
    const paperSize = body.paperSize ?? body.template?.paperSize ?? "A4";
    const orientation = body.orientation ?? body.template?.orientation ?? "portrait";
    const pdf = await renderPdf(html, { paperSize, orientation });
    sendJson(response, 200, {
      html,
      pdfBase64: Buffer.from(pdf).toString("base64"),
      pdfContentType: "application/pdf",
      pdfFileName: pdfFileName(body.FormCode ?? body.formCode ?? body.FormType ?? body.formType),
      paperSize,
      orientation,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      sendJson(response, 400, { error: error.message });
      return;
    }
    console.error("PDF generation failed:", error);
    sendJson(response, 500, { error: "Unable to generate the PDF for this form." });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
  maxDuration: 60,
};
