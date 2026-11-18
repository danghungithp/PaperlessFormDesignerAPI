export default function handler(_request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.status(200).json({
    service: "paperless-form-renderer",
    endpoint: "POST /api/render",
    templates: {
      list: "GET /api/templates",
      save: "POST /api/templates (admin session required)",
      key: "formType",
    },
    health: "GET /health",
    supportedForms: ["capex", "capex-v1", "capex-v3", "material-take-out"],
    requestBody: {
      formType: "_CapexFormV3",
      JsonFormValue: { _CapexFormV3: {} },
      JsonApprovalLine: [],
      lineItems: [],
    },
  });
}
