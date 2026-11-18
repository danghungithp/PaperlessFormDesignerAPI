CREATE TABLE IF NOT EXISTS form_templates (
  form_type TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template_json TEXT NOT NULL CHECK (json_valid(template_json)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
