import { canonicalFormType, normalizeTemplate, validateTemplate } from "./render.js";

function publicFormType(template, storedType) {
  if (typeof template.formType === "string" && template.formType.trim() !== "") {
    return template.formType;
  }
  return storedType === "material" ? "material-take-out" : storedType;
}

function parseRecord(record) {
  if (!record) return null;
  const template = JSON.parse(record.template_json);
  return {
    formType: publicFormType(template, record.form_type),
    name: record.name,
    updatedAt: record.updated_at,
    template,
  };
}

export async function listFormTemplates(database) {
  const result = await database.prepare(
    "SELECT form_type, name, template_json, updated_at FROM form_templates ORDER BY form_type",
  ).all();
  return (result.results ?? []).map(parseRecord);
}

export async function getFormTemplate(database, formType) {
  const canonical = canonicalFormType(formType);
  const record = await database.prepare(
    "SELECT form_type, name, template_json, updated_at FROM form_templates WHERE form_type = ?",
  ).bind(canonical).first();
  return parseRecord(record);
}

export async function saveFormTemplate(database, formType, template) {
  const canonical = canonicalFormType(formType);
  template = normalizeTemplate(template);
  validateTemplate(template);
  const name = typeof template.name === "string" ? template.name.trim() : "";
  if (!name || name.length > 160) {
    throw new TypeError("template.name is required and must be at most 160 characters.");
  }
  const storedTemplate = { ...template, formType };
  const templateJson = JSON.stringify(storedTemplate);
  if (templateJson.length > 250_000) {
    throw new TypeError("Template configuration must be smaller than 250 KB.");
  }

  await database.prepare(`
    INSERT INTO form_templates (form_type, name, template_json, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(form_type) DO UPDATE SET
      name = excluded.name,
      template_json = excluded.template_json,
      updated_at = excluded.updated_at
  `).bind(canonical, name, templateJson).run();

  return getFormTemplate(database, formType);
}
