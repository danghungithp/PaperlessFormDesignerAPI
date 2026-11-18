function normalizeType(type) {
  const value = String(type ?? "text").toLowerCase();
  if (["choice", "multiline", "text", "date", "number", "boolean", "email"].includes(value)) {
    return value;
  }
  if (value.includes("multi")) return "multiline";
  if (value.includes("choice") || value.includes("select")) return "choice";
  return "text";
}

function titleFromKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

export function toFormSchema(template) {
  const sections = new Map();
  const fields = [];
  const seenFields = new Set();
  let fieldRow = 0;
  const allRows = [
    ...(template.headerRows || []),
    ...template.rows,
    ...(template.footerRows || []),
  ];
  for (const row of allRows) {
    const hasFields = row.columns.some((column) =>
      column.controls.some((control) => control.type === "field")
    );
    if (!hasFields) continue;
    fieldRow += 1;
    for (const [columnIndex, column] of row.columns.entries()) {
      for (const control of column.controls) {
        if (control.type !== "field" || !control.fieldKey || seenFields.has(control.fieldKey)) continue;
        seenFields.add(control.fieldKey);
        const sectionKey = control.section || "requestInfo";
        if (!sections.has(sectionKey)) {
          sections.set(sectionKey, {
            key: sectionKey,
            title: control.sectionTitle || (sectionKey === "requestInfo" ? "Request Information" : titleFromKey(sectionKey)),
            description: control.sectionDescription || "",
            order: (sections.size + 1) * 10,
            visible: true,
          });
        }
        const type = normalizeType(control.fieldType);
        fields.push({
          key: control.fieldKey,
          label: control.label || control.fieldKey,
          type,
          section: sectionKey,
          defaultValue: control.defaultValue ?? "",
          placeholder: control.placeholder ?? (type === "choice" ? `Select ${control.label || control.fieldKey}` : ""),
          required: control.required ?? false,
          visible: control.visible ?? true,
          order: fieldRow * 10,
          optionSource: type === "choice" ? control.optionSource ?? "" : "",
          optionSet: type === "choice" ? control.optionSet ?? "" : "",
          parentField: control.parentField ?? "",
          options: Array.isArray(control.options) ? control.options : [],
          layout: {
            mode: control.layoutMode || (type === "multiline" ? "vertical" : "horizontal"),
            row: fieldRow,
            column: columnIndex + 1,
          },
        });
      }
    }
  }
  const formType = template.formType || "material-take-out";
  const serializeRows = (rows) => rows.map((row) => ({
    columns: row.columns.map((column) => ({
      controls: column.controls.map(({ id, ...control }) => control),
    })),
  }));
  return {
    schemaVersion: "1.1",
    formCode: template.formCode || (formType.startsWith("capex") ? "CAPEX_MVP" : "MATERIAL_TAKE_OUT"),
    formName: template.name || "Untitled form",
    formVersion: Number(template.formVersion) || 1,
    sections: [...sections.values()],
    fields,
    printLayout: {
      header: serializeRows(template.headerRows || []),
      body: serializeRows(template.rows),
      footer: serializeRows(template.footerRows || []),
    },
  };
}

export function fromFormSchema(schema) {
  if (!schema || typeof schema !== "object" || schema.schemaVersion !== "1.1" ||
      !Array.isArray(schema.fields)) {
    throw new Error("JSON phải có cấu trúc schemaVersion 1.1 và fields array.");
  }
  if (schema.sections !== undefined && !Array.isArray(schema.sections)) {
    throw new Error("sections phải là một JSON array.");
  }
  const sections = new Map((schema.sections || [])
    .filter((section) => section && typeof section.key === "string")
    .map((section) => [section.key, section]));
  const rows = new Map();
  for (const field of schema.fields) {
    if (!field || typeof field.key !== "string" || field.key.trim() === "") {
      throw new Error("Mỗi field phải có key.");
    }
    const rowIndex = Math.max(1, Number(field.layout?.row) || 1) - 1;
    const columnIndex = Math.max(1, Number(field.layout?.column) || 1) - 1;
    if (columnIndex > 3) throw new Error("layout.column không được lớn hơn 4.");
    if (!rows.has(rowIndex)) rows.set(rowIndex, []);
    const columns = rows.get(rowIndex);
    while (columns.length <= columnIndex) columns.push({ controls: [] });
    const section = sections.get(field.section);
    if (section && !columns.some((column) =>
      column.controls.some((control) => control.type === "heading" && control.text === section.title)
    )) {
      const sectionHasHeading = [...rows.values()].some((rowColumns) =>
        rowColumns.some((column) =>
          column.controls.some((control) => control.type === "heading" && control.text === section.title)
        )
      );
      if (!sectionHasHeading) {
        columns[columnIndex].controls.push({ id: `heading-${field.section}`, type: "heading", text: section.title });
      }
    }
    columns[columnIndex].controls.push({
      id: `field-${field.key}`,
      type: "field",
      fieldKey: field.key,
      label: field.label || field.key,
      fieldType: normalizeType(field.type),
      section: field.section || "requestInfo",
      sectionTitle: sections.get(field.section)?.title || "",
      defaultValue: field.defaultValue ?? "",
      placeholder: field.placeholder || "",
      required: Boolean(field.required),
      visible: field.visible !== false,
      optionSource: field.optionSource || "",
      optionSet: field.optionSet || "",
      parentField: field.parentField || "",
      options: Array.isArray(field.options) ? field.options : [],
      layoutMode: field.layout?.mode || "horizontal",
    });
  }
  const formType = schema.formCode?.startsWith("CAPEX") ? "capex-v3" : "material-take-out";
  let importedControlId = 0;
  const importRows = (sourceRows) => sourceRows.map((row, rowIndex) => ({
    id: `import-row-${rowIndex + 1}`,
    columns: row.columns.map((column) => ({
      controls: column.controls.map((control) => ({
        ...control,
        id: `import-control-${++importedControlId}`,
      })),
    })),
  }));
  const hasPrintLayout = schema.printLayout && typeof schema.printLayout === "object";
  return {
    id: `import-${Date.now()}`,
    name: schema.formName || "Imported form",
    formCode: schema.formCode || "",
    formVersion: Number(schema.formVersion) || 1,
    formType,
    paperSize: "A4",
    orientation: "portrait",
    headerRows: hasPrintLayout ? importRows(schema.printLayout.header || []) : [],
    rows: hasPrintLayout
      ? importRows(schema.printLayout.body || [])
      : [...rows.entries()]
        .sort(([left], [right]) => left - right)
        .map(([index, columns]) => ({
          id: `row-${index + 1}`,
          columns: columns.length ? columns : [{ controls: [] }],
        })),
    footerRows: hasPrintLayout ? importRows(schema.printLayout.footer || []) : [],
  };
}
