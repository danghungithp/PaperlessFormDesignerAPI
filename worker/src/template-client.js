import { canonicalFormType } from "./render.js";
import postgresTemplateStore from "../../api/postgres-template-store.js";

export async function withSavedTemplate(requestBody, storeUrl, fetcher = fetch) {
  const requestedType = requestBody.FormType ?? requestBody.formType;
  const isDynamic = typeof requestedType === "string" && requestedType.trim().toLowerCase() === "dynamic";
  if (isDynamic || requestBody.FormType !== undefined ||
      requestBody.template !== undefined || requestBody.JsonTemplate !== undefined ||
      typeof requestBody.formType !== "string") {
    return requestBody;
  }

  const formType = canonicalFormType(requestBody.formType);
  if (process.env.DATABASE_URL) {
    const record = await postgresTemplateStore.getFormTemplate(formType);
    return record ? { ...requestBody, template: record.template } : requestBody;
  }
  if (!storeUrl) return requestBody;

  let base;
  try {
    base = new URL(storeUrl);
  } catch {
    throw new Error("TEMPLATE_STORE_URL must be an absolute HTTP URL.");
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new Error("TEMPLATE_STORE_URL must use HTTP or HTTPS.");
  }
  const endpoint = new URL("/api/templates", base.origin);
  endpoint.searchParams.set("formType", requestBody.formType);
  const response = await fetcher(endpoint);
  if (response.status === 404) {
    return requestBody;
  }
  if (!response.ok) {
    throw new Error(`Template store returned HTTP ${response.status}.`);
  }

  const record = await response.json();
  if (!record || !record.template || typeof record.template !== "object") {
    throw new Error("Template store returned an invalid template.");
  }
  return { ...requestBody, template: record.template };
}
