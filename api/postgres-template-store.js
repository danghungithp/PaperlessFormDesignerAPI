const postgres = require("postgres");

function createPostgresTemplateStore(sql) {
  let schemaReady;

  async function ensureSchema() {
    if (!schemaReady) {
      schemaReady = sql`
        CREATE TABLE IF NOT EXISTS form_templates (
          form_type TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          template_json JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `.then(() => undefined).catch((error) => {
        schemaReady = undefined;
        throw error;
      });
    }
    await schemaReady;
  }

  async function getFormTemplate(formType) {
    await ensureSchema();
    const [record] = await sql`
      SELECT form_type, name, template_json, updated_at
      FROM form_templates
      WHERE form_type = ${formType}
    `;
    return parseRecord(record);
  }

  function parseRecord(record) {
    if (!record) return null;
    const template = typeof record.template_json === "string"
      ? JSON.parse(record.template_json)
      : record.template_json;
    const formType = typeof template.formType === "string" && template.formType.trim()
      ? template.formType
      : record.form_type === "material" ? "material-take-out" : record.form_type;
    return {
      formType,
      name: record.name,
      updatedAt: record.updated_at instanceof Date
        ? record.updated_at.toISOString()
        : record.updated_at,
      template,
    };
  }

  return {
    async listFormTemplates() {
      await ensureSchema();
      const records = await sql`
        SELECT form_type, name, template_json, updated_at
        FROM form_templates
        ORDER BY form_type
      `;
      return records.map(parseRecord);
    },

    getFormTemplate,

    async saveFormTemplate(formType, name, template) {
      await ensureSchema();
      const templateJson = JSON.stringify(template);
      await sql`
        INSERT INTO form_templates (form_type, name, template_json, updated_at)
        VALUES (${formType}, ${name}, ${templateJson}::jsonb, NOW())
        ON CONFLICT (form_type) DO UPDATE SET
          name = EXCLUDED.name,
          template_json = EXCLUDED.template_json,
          updated_at = NOW()
      `;
      return getFormTemplate(formType);
    },
  };
}

let store;

function getStore() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  if (!store) {
    const sql = postgres(process.env.DATABASE_URL, {
      ssl: "verify-full",
      max: 1,
      connect_timeout: 10,
      idle_timeout: 20,
    });
    store = createPostgresTemplateStore(sql);
  }
  return store;
}

module.exports = {
  createPostgresTemplateStore,
  getFormTemplate: (...args) => getStore().getFormTemplate(...args),
  listFormTemplates: (...args) => getStore().listFormTemplates(...args),
  saveFormTemplate: (...args) => getStore().saveFormTemplate(...args),
};
