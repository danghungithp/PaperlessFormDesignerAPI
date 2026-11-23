import { fromFormSchema, toFormSchema } from "./designer-schema.mjs";

const TYPE_LABELS = {
  heading: "Tiêu đề",
  field: "Trường dữ liệu",
  "field:text": "Văn bản (Text)",
  "field:multiline": "Nhiều dòng (Multiline)",
  "field:number": "Số (Number)",
  "field:date": "Ngày tháng (Date)",
  "field:choice": "Lựa chọn (Choice)",
  "field:checkbox": "Hộp kiểm (Checkbox)",
  "field:boolean": "Đúng/Sai (Boolean)",
  lineItems: "Bảng Line Items",
  approvals: "Bảng Approval",
  image: "Hình ảnh / logo",
  dateTime: "Ngày giờ",
  text: "Đoạn văn",
  divider: "Đường kẻ",
  spacer: "Khoảng trống",
};

const FIELD_TYPE_LABELS = {
  text: "Văn bản (Text)",
  multiline: "Nhiều dòng (Multiline)",
  number: "Số (Number)",
  date: "Ngày tháng (Date)",
  choice: "Lựa chọn (Choice)",
  checkbox: "Hộp kiểm (Checkbox)",
  boolean: "Đúng/Sai (Boolean)",
  email: "Email",
};

function normalizeType(type) {
  const value = String(type ?? "text").toLowerCase();
  if (["choice", "multiline", "text", "date", "number", "boolean", "checkbox", "email"].includes(value)) {
    return value;
  }
  if (value.includes("multi")) return "multiline";
  if (value.includes("choice") || value.includes("select")) return "choice";
  if (value.includes("check")) return "checkbox";
  if (value.includes("bool")) return "boolean";
  if (value.includes("date") || value.includes("time")) return "date";
  if (value.includes("num") || value.includes("int") || value.includes("float")) return "number";
  return "text";
}

const demoFields = [
  { FieldKey: "textField", FieldLabel: "Text Field", FieldType: "text", FieldValue: "Sample text value", IsDirty: true, SectionKey: "general", Required: false, Placeholder: "Enter text" },
  { FieldKey: "multilineField", FieldLabel: "Multiline Field", FieldType: "multiline", FieldValue: "Sample multiline description", IsDirty: true, SectionKey: "general", Required: false, Placeholder: "Enter description" },
  { FieldKey: "numberField", FieldLabel: "Number Field", FieldType: "number", FieldValue: "12345", IsDirty: true, SectionKey: "general", Required: false, Placeholder: "Enter number" },
  { FieldKey: "dateField", FieldLabel: "Date Field", FieldType: "date", FieldValue: "2026-11-23", IsDirty: true, SectionKey: "general", Required: false, Placeholder: "Select date" },
  { FieldKey: "jsonChoice", FieldLabel: "JSON Choice", FieldType: "choice", FieldValue: "OPTION1", IsDirty: true, SectionKey: "general", Required: false, Placeholder: "Select option", OptionSource: "json", Options: [{ value: "OPTION1", label: "Option 1", parentValue: "" }, { value: "OPTION2", label: "Option 2", parentValue: "" }] },
  { FieldKey: "sharePointChoice", FieldLabel: "SharePoint Choice", FieldType: "choice", FieldValue: "Finance", IsDirty: true, SectionKey: "general", Required: false, Placeholder: "Select option", OptionSource: "sharepoint", OptionSet: "Department" },
  { FieldKey: "dependentChoice", FieldLabel: "Dependent Choice", FieldType: "choice", FieldValue: "CostCenter1", IsDirty: true, SectionKey: "general", Required: false, Placeholder: "Select option", OptionSource: "sharepoint", OptionSet: "CostCenter", ParentField: "sharePointChoice" },
  { FieldKey: "checkboxField", FieldLabel: "I confirm", FieldType: "checkbox", FieldValue: "true", IsDirty: true, SectionKey: "general", Required: false, Placeholder: "", DefaultValue: "false" },
  { FieldKey: "booleanField", FieldLabel: "Budget Available", FieldType: "boolean", FieldValue: "false", IsDirty: true, SectionKey: "general", Required: false, Placeholder: "", DefaultValue: "false" },
  { FieldKey: "department", FieldLabel: "department", FieldType: "choice", FieldValue: "Finance", IsDirty: true, SectionKey: "requestInfo", Required: true, OptionSource: "sharepoint", OptionSet: "Department" },
  { FieldKey: "documenttype", FieldLabel: "Document Type", FieldType: "choice", FieldValue: "", IsDirty: true, SectionKey: "requestInfo", Required: true, OptionSource: "sharepoint", OptionSet: "Documenttype" },
  { FieldKey: "materialtype", FieldLabel: "Material Type", FieldType: "choice", FieldValue: "InventoryPart", IsDirty: true, SectionKey: "requestInfo", Required: true, OptionSource: "sharepoint", OptionSet: "Materialtype" },
  { FieldKey: "description", FieldLabel: "Reason", FieldType: "multiline", FieldValue: "Sample reason", IsDirty: true, SectionKey: "requestInfo", Required: true },
];
const demoApprovals = [
  { ApprovalStepID: 1, ApprovalStepOrder: 1, ApproverEmail: "department.manager@example.com", State: "Department Manager review", Status: "Processing", Modified: "2026-11-16T07:27:55.000Z" },
  { ApprovalStepID: 2, ApprovalStepOrder: 2, ApproverEmail: "material.manager@example.com", State: "Material take out managers", Status: "Todo", Modified: "2026-11-16T07:27:59.000Z" },
];
const demoLineItems = [{
  cells: [
    { columnKey: "partno", value: "adsfsfd" },
    { columnKey: "description", value: "ádfsdf" },
    { columnKey: "quanity", value: "1" },
    { columnKey: "note", value: "ádfsadfdsa" },
  ],
  rowId: "demo-row-1",
  rowOrder: 10,
}];

const elements = {
  canvasRows: document.querySelector("#canvasRows"),
  headerRows: document.querySelector("#headerRows"),
  footerRows: document.querySelector("#footerRows"),
  paper: document.querySelector("#paper"),
  inspector: document.querySelector("#inspectorContent"),
  canvasFormTitle: document.querySelector("#canvasFormTitle"),
  inspectorSubtitle: document.querySelector("#inspectorSubtitle"),
  controlPalette: document.querySelector("#controlPalette"),
  fieldPalette: document.querySelector("#fieldPalette"),
  dataJson: document.querySelector("#dataJson"),
  formType: document.querySelector("#formType"),
  paperSize: document.querySelector("#paperSize"),
  orientation: document.querySelector("#orientation"),
  savedTemplates: document.querySelector("#savedTemplates"),
  authButton: document.querySelector("#authButton"),
  saveButton: document.querySelector("#saveButton"),
  loginDialog: document.querySelector("#loginDialog"),
  loginForm: document.querySelector("#loginForm"),
  adminPassword: document.querySelector("#adminPassword"),
  loginError: document.querySelector("#loginError"),
  loginSubmit: document.querySelector("#loginSubmit"),
  previewFrame: document.querySelector("#previewFrame"),
  previewMessage: document.querySelector("#previewMessage"),
  designView: document.querySelector("#designView"),
  previewView: document.querySelector("#previewView"),
  notice: document.querySelector("#notice"),
  apiStatus: document.querySelector("#apiStatus"),
};

function createId() {
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function optionSetFromKey(key) {
  return String(key).replace(/^./, (character) => character.toUpperCase());
}

function createControl(type, field = {}) {
  const control = { id: createId(), type };
  if (type === "heading") control.text = field.text ?? "Tiêu đề mục";
  if (type === "image") {
    control.src = field.src ?? "";
    control.alt = field.alt ?? "Logo";
    control.width = field.width ?? 160;
  }
  if (type === "dateTime") {
    control.label = field.label ?? "Ngày giờ tạo";
    control.format = field.format ?? "datetime";
  }
  if (type === "lineItems") {
    control.title = field.title ?? "LINE ITEMS";
    control.columns = Array.isArray(field.columns) ? field.columns : [
      { key: "partno", label: "Part Number" },
      { key: "description", label: "Description" },
      { key: "quanity", label: "Quantity" },
      { key: "note", label: "Note" },
    ];
  }
  if (type === "approvals") control.title = field.title ?? "APPROVAL LINE";
  if (type === "field") {
    control.fieldKey = field.key ?? "textField";
    control.label = field.label ?? (field.key ? (field.key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())) : "Text Field");
    control.fieldType = field.type ? normalizeType(field.type) : "text";
    control.multiline = control.fieldType === "multiline";
    control.section = field.section ?? "general";
    control.sectionTitle = field.sectionTitle ?? "";
    control.defaultValue = field.defaultValue ?? (control.fieldType === "checkbox" || control.fieldType === "boolean" ? "false" : "");
    control.placeholder = field.placeholder ?? (
      control.fieldType === "choice" ? `Select ${control.label}` :
      control.fieldType === "multiline" ? `Enter ${control.label.toLowerCase()}` :
      control.fieldType === "number" ? `Enter number` :
      control.fieldType === "date" ? `Select date` :
      control.fieldType === "text" ? `Enter text` : ""
    );
    control.required = Boolean(field.required);
    control.visible = field.visible !== false;
    control.optionSource = field.optionSource ?? (control.fieldType === "choice" ? "json" : "");
    control.optionSet = field.optionSet ?? (control.fieldType === "choice" && control.optionSource === "sharepoint" ? optionSetFromKey(control.fieldKey) : "");
    control.parentField = field.parentField ?? "";
    control.options = Array.isArray(field.options) ? field.options : [];
    control.layoutMode = field.layoutMode || (control.fieldType === "multiline" ? "vertical" : "horizontal");
  }
  if (type === "text") control.text = field.text ?? "Nhập nội dung tĩnh";
  if (type === "spacer") control.height = field.height ?? 20;
  return control;
}

function makeDefaultTemplate() {
  const textField = createControl("field", {
    key: "textField",
    label: "Text Field",
    type: "text",
    section: "general",
    defaultValue: "",
    placeholder: "Enter text",
    required: false,
    optionSource: "json",
    layoutMode: "vertical",
  });
  const multilineField = createControl("field", {
    key: "multilineField",
    label: "Multiline Field",
    type: "multiline",
    section: "general",
    defaultValue: "",
    placeholder: "Enter description",
    required: false,
    optionSource: "json",
    layoutMode: "vertical",
  });
  const numberField = createControl("field", {
    key: "numberField",
    label: "Number Field",
    type: "number",
    section: "general",
    defaultValue: "",
    placeholder: "Enter number",
    required: false,
    optionSource: "json",
    layoutMode: "horizontal",
  });
  const dateField = createControl("field", {
    key: "dateField",
    label: "Date Field",
    type: "date",
    section: "general",
    defaultValue: "",
    placeholder: "Select date",
    required: false,
    optionSource: "json",
    layoutMode: "horizontal",
  });
  const jsonChoice = createControl("field", {
    key: "jsonChoice",
    label: "JSON Choice",
    type: "choice",
    section: "general",
    defaultValue: "",
    placeholder: "Select option",
    required: false,
    optionSource: "json",
    options: [
      { value: "OPTION1", label: "Option 1", parentValue: "" },
      { value: "OPTION2", label: "Option 2", parentValue: "" },
    ],
    layoutMode: "vertical",
  });
  const sharePointChoice = createControl("field", {
    key: "sharePointChoice",
    label: "SharePoint Choice",
    type: "choice",
    section: "general",
    defaultValue: "",
    placeholder: "Select option",
    required: false,
    optionSource: "sharepoint",
    optionSet: "Department",
    layoutMode: "vertical",
  });
  const dependentChoice = createControl("field", {
    key: "dependentChoice",
    label: "Dependent Choice",
    type: "choice",
    section: "general",
    defaultValue: "",
    placeholder: "Select option",
    required: false,
    optionSource: "sharepoint",
    optionSet: "CostCenter",
    parentField: "sharePointChoice",
    layoutMode: "vertical",
  });
  const checkboxField = createControl("field", {
    key: "checkboxField",
    label: "I confirm",
    type: "checkbox",
    section: "general",
    defaultValue: "false",
    placeholder: "",
    required: false,
    optionSource: "json",
    layoutMode: "vertical",
  });
  const booleanField = createControl("field", {
    key: "booleanField",
    label: "Budget Available",
    type: "boolean",
    section: "general",
    defaultValue: "false",
    placeholder: "",
    required: false,
    optionSource: "json",
    layoutMode: "vertical",
  });

  return {
    id: createId(),
    name: "General Request Form",
    formCode: "GENERAL_REQUEST",
    formVersion: 1,
    formType: "material-take-out",
    paperSize: "A4",
    orientation: "portrait",
    headerRows: [],
    rows: [
      { id: createId(), columns: [{ controls: [Object.assign(createControl("heading"), { text: "General Information" })] }] },
      { id: createId(), columns: [{ controls: [textField] }] },
      { id: createId(), columns: [{ controls: [multilineField] }] },
      { id: createId(), columns: [{ controls: [numberField] }, { controls: [dateField] }] },
      { id: createId(), columns: [{ controls: [jsonChoice] }] },
      { id: createId(), columns: [{ controls: [sharePointChoice] }] },
      { id: createId(), columns: [{ controls: [dependentChoice] }] },
      { id: createId(), columns: [{ controls: [checkboxField] }, { controls: [booleanField] }] },
      { id: createId(), columns: [{ controls: [createControl("lineItems")] }] },
      { id: createId(), columns: [{ controls: [createControl("approvals")] }] },
    ],
    footerRows: [],
  };
}

function makeDemoRequest() {
  return {
    formType: "material-take-out",
    JsonFormValue: JSON.stringify(JSON.stringify(demoFields)),
    JsonApprovalLine: JSON.stringify(demoApprovals),
    lineItems: JSON.stringify(JSON.stringify(demoLineItems)),
  };
}

let template = makeDefaultTemplate();
let selectedControlId = null;
let storedTemplates = [];
let isAdminAuthenticated = false;
let noticeTimer;

elements.dataJson.value = JSON.stringify(makeDemoRequest(), null, 2);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function readInputJson() {
  try {
    const request = JSON.parse(elements.dataJson.value);
    if (!request || typeof request !== "object" || Array.isArray(request)) {
      throw new Error("JSON đầu vào phải là một object.");
    }
    return request;
  } catch (error) {
    throw new Error(`JSON dữ liệu không hợp lệ: ${error.message}`);
  }
}

function parseNested(value) {
  let parsed = value;
  for (let depth = 0; typeof parsed === "string" && depth < 2; depth += 1) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      break;
    }
  }
  return parsed;
}

function getDataFields() {
  let formValue;
  try {
    formValue = parseNested(readInputJson().JsonFormValue);
  } catch {
    return [];
  }
  if (formValue && !Array.isArray(formValue) && typeof formValue === "object") {
    const matchingKey = Object.keys(formValue).find((key) => /materialtakeoutform|materialtakeout/i.test(key));
    if (matchingKey) formValue = formValue[matchingKey];
  }
  if (Array.isArray(formValue)) {
    return formValue.filter((field) => field && typeof field === "object" && (field.FieldKey || field.key))
      .map((field) => {
        const key = String(field.FieldKey || field.key);
        const label = String(field.FieldLabel || field.label || key);
        const rawType = field.FieldType || field.type || "text";
        const type = normalizeType(rawType);
        return {
          key,
          label,
          type,
          section: String(field.SectionKey || field.section || "general"),
          required: Boolean(field.Required ?? field.required ?? false),
          defaultValue: field.DefaultValue ?? field.defaultValue ?? (type === "checkbox" || type === "boolean" ? "false" : ""),
          placeholder: field.Placeholder ?? field.placeholder ?? "",
          optionSource: field.OptionSource || field.optionSource || (type === "choice" ? "json" : ""),
          optionSet: field.OptionSet || field.optionSet || "",
          parentField: field.ParentField || field.parentField || "",
          options: Array.isArray(field.Options) ? field.Options : Array.isArray(field.options) ? field.options : [],
          layoutMode: field.LayoutMode || field.layoutMode || (type === "multiline" ? "vertical" : "horizontal"),
          sampleValue: field.FieldValue ?? field.sampleValue ?? (type === "checkbox" || type === "boolean" ? "false" : ""),
        };
      });
  }
  if (formValue && typeof formValue === "object") {
    return Object.keys(formValue).map((key) => ({
      key,
      label: key.replace(/([a-z0-9])([A-Z])/g, "$1 $2"),
      type: typeof formValue[key] === "number" ? "number" : typeof formValue[key] === "boolean" ? "boolean" : "text",
      section: "general",
      sampleValue: formValue[key] ?? "",
    }));
  }
  return [];
}

function getDataField(fieldKey) {
  return getDataFields().find((field) => field.key === fieldKey);
}

function getSelectedControl() {
  for (const region of ["headerRows", "rows", "footerRows"]) {
    for (const row of template[region] || []) {
      for (const column of row.columns) {
        const selected = column.controls.find((control) => control.id === selectedControlId);
        if (selected) return selected;
      }
    }
  }
  return null;
}

function getFieldSample(fieldKey) {
  const value = getDataFields().find((field) => field.key === fieldKey)?.sampleValue ?? "";
  return value !== null && typeof value === "object" ? JSON.stringify(value) : String(value);
}

function showNotice(message, isError = false) {
  clearTimeout(noticeTimer);
  elements.notice.textContent = message;
  elements.notice.classList.toggle("error", isError);
  elements.notice.classList.add("visible");
  noticeTimer = setTimeout(() => elements.notice.classList.remove("visible"), 3200);
}

function addRow(columnCount = 1, region = "rows") {
  const row = {
    id: createId(),
    columns: Array.from({ length: columnCount }, () => ({ controls: [] })),
  };
  template[region] ??= [];
  template[region].push(row);
  renderDesigner();
}

function addControl(type, rowId, columnIndex = 0, field = {}, region = "rows") {
  if (!template[region]?.length) addRow(1, region);
  const rows = template[region] || [];
  const row = rows.find((item) => item.id === rowId) ?? rows.at(-1);
  const column = row.columns[columnIndex] ?? row.columns[0];
  let control;
  if (type.startsWith("field:")) {
    const specificType = type.slice(6);
    control = createControl("field", {
      ...field,
      type: specificType,
      key: field.key || `${specificType}Field`,
      label: field.label || FIELD_TYPE_LABELS[specificType] || `${specificType.toUpperCase()} Field`,
    });
  } else {
    control = createControl(type, field);
  }
  column.controls.push(control);
  selectedControlId = control.id;
  renderDesigner();
}

function controlDisplayName(control) {
  if (control.type === "field") return control.label || control.fieldKey || "Trường dữ liệu";
  if (control.type === "heading" || control.type === "text") return control.text || TYPE_LABELS[control.type];
  if (control.type === "image") return control.alt || "Hình ảnh";
  if (control.type === "dateTime") return control.label || "Ngày giờ";
  if (control.type === "lineItems" || control.type === "approvals") return control.title || TYPE_LABELS[control.type];
  return TYPE_LABELS[control.type] || "Thành phần";
}

function renderPalette() {
  const types = [
    "heading", "text", "field",
    "field:number", "field:date", "field:choice", "field:checkbox", "field:boolean",
    "lineItems", "approvals", "image", "dateTime", "divider", "spacer",
  ];
  const controlIcons = {
    heading: "T",
    text: "¶",
    field: "Aa",
    "field:number": "#",
    "field:date": "📅",
    "field:choice": "▼",
    "field:checkbox": "☑",
    "field:boolean": "◩",
    lineItems: "▤",
    approvals: "✓",
    image: "▧",
    dateTime: "◷",
    divider: "—",
    spacer: "↕",
  };
  elements.controlPalette.innerHTML = types.map((type) =>
    `<button type="button" class="palette-control" draggable="true" data-palette-type="${type}">
      <span class="control-icon">${controlIcons[type] || "•"}</span>
      <span>${TYPE_LABELS[type]}</span>
    </button>`
  ).join("");

  const fields = getDataFields();
  elements.fieldPalette.innerHTML = fields.length
    ? fields.map((field) =>
      `<button type="button" class="field-chip" draggable="true" data-field-key="${escapeHtml(field.key)}" data-field-label="${escapeHtml(field.label)}" data-field-type="${escapeHtml(field.type)}" data-field-section="${escapeHtml(field.section)}" title="${escapeHtml(field.key)}">
        <span class="field-chip-main">${escapeHtml(field.label)}<small>${escapeHtml(field.key)} · ${escapeHtml(field.type)}</small></span>
        <span class="field-sample">${escapeHtml(field.sampleValue || "Chưa có giá trị mẫu")}</span>
      </button>`
    ).join("")
    : `<div class="inspector-hint">Chưa tìm thấy trường trong JSON mẫu.</div>`;
}

function renderRegion(rows, region, containerKey = region) {
  const container = elements[containerKey];
  container.innerHTML = rows.map((row, rowIndex) => `
    <div class="canvas-row" data-region="${region}" data-row-id="${escapeHtml(row.id)}" style="grid-template-columns:repeat(${row.columns.length}, minmax(0, 1fr))">
      <div class="row-tools">
        <select aria-label="Số cột của hàng" data-row-layout="${escapeHtml(row.id)}" data-region="${region}">
          ${[1, 2, 3].map((count) => `<option value="${count}" ${row.columns.length === count ? "selected" : ""}>${count} cột</option>`).join("")}
        </select>
        <button type="button" data-row-up="${escapeHtml(row.id)}" data-region="${region}" title="Di chuyển lên" ${rowIndex === 0 ? "disabled" : ""}>↑</button>
        <button type="button" data-row-down="${escapeHtml(row.id)}" data-region="${region}" title="Di chuyển xuống" ${rowIndex === rows.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" data-row-delete="${escapeHtml(row.id)}" data-region="${region}" title="Xóa hàng">×</button>
      </div>
      ${row.columns.map((column, columnIndex) => `
        <div class="canvas-column" data-region="${region}" data-row-id="${escapeHtml(row.id)}" data-column-index="${columnIndex}">
          ${column.controls.length
            ? column.controls.map((control) => `
              <div class="canvas-control ${control.id === selectedControlId ? "selected" : ""}" draggable="true" data-control-id="${escapeHtml(control.id)}" tabindex="0">
                <span class="control-handle">⋮⋮</span>
                <span class="canvas-control-content">
                  <span class="canvas-control-label">${escapeHtml(controlDisplayName(control))}</span>
                  ${control.type === "field" ? `
                    <span class="canvas-control-sample">${
                      control.fieldType === "checkbox" || control.fieldType === "boolean"
                        ? (getFieldSample(control.fieldKey) === "true" ? "☑ Đã chọn (true)" : "☐ Chưa chọn (false)")
                        : escapeHtml(getFieldSample(control.fieldKey) || "Giá trị mẫu trống")
                    }</span>
                  ` : ""}
                  ${control.type === "image" && control.src ? `<img class="canvas-control-image" src="${escapeHtml(control.src)}" alt="">` : ""}
                </span>
                <span class="canvas-control-type">${escapeHtml(
                  control.type === "field"
                    ? (FIELD_TYPE_LABELS[control.fieldType] || control.fieldType)
                    : (TYPE_LABELS[control.type] || control.type)
                )}</span>
              </div>`).join("")
            : `<div class="column-empty">Thả thành phần vào đây</div>`}
        </div>`).join("")}
    </div>`).join("");
}

function renderCanvas() {
  elements.paper.className = `paper paper-${template.paperSize.toLowerCase()}${template.orientation === "landscape" ? " paper-landscape" : ""}`;
  elements.canvasFormTitle.textContent = template.name;
  renderRegion(template.headerRows || [], "headerRows");
  renderRegion(template.rows || [], "rows", "canvasRows");
  renderRegion(template.footerRows || [], "footerRows");
  renderInspector();
  document.querySelector("#paperLabel").textContent = `${template.paperSize} · ${template.orientation === "portrait" ? "Dọc" : "Ngang"}`;
  document.querySelector("#pageCount").textContent = `${Math.max(1, Math.ceil(template.rows.length / 7))} trang`;
}

function renderInspector() {
  const control = getSelectedControl();
  if (!control) {
    elements.inspectorSubtitle.textContent = "Cấu hình trang in";
    elements.inspector.innerHTML = `<div class="inspector-form">
      <label>Tên template<input data-template-prop="name" value="${escapeHtml(template.name)}"></label>
      <label>Mã form<input data-template-prop="formCode" value="${escapeHtml(template.formCode || "")}"></label>
      <label>Loại form
        <select data-template-prop="formType">
          <option value="material-take-out" ${template.formType === "material-take-out" ? "selected" : ""}>Material Take Out</option>
          <option value="capex-v3" ${template.formType === "capex-v3" ? "selected" : ""}>CAPEX V3</option>
          <option value="capex-v1" ${template.formType === "capex-v1" ? "selected" : ""}>CAPEX V1</option>
        </select>
      </label>
      <div class="inspector-hint">Token chỉ dùng để xác thực thao tác lưu và không được ghi vào template. Chọn thành phần trên trang để sửa thuộc tính.</div>
    </div>`;
    return;
  }

  elements.inspectorSubtitle.textContent = TYPE_LABELS[control.type] || "Thành phần";
  const common = [];
  if (control.type === "field") {
    const fields = getDataFields();
    const options = fields.some((field) => field.key === control.fieldKey)
      ? fields
      : [{ key: control.fieldKey || "", label: control.label || control.fieldKey || "Tùy chỉnh" }, ...fields];

    const isChoice = control.fieldType === "choice";

    common.push(`
      <label>Trường JSON
        <select data-control-prop="fieldKey">${options.map((field) => `<option value="${escapeHtml(field.key)}" ${field.key === control.fieldKey ? "selected" : ""}>${escapeHtml(field.label)} · ${escapeHtml(field.key)}</option>`).join("")}</select>
      </label>
      <label>Nhãn hiển thị<input data-control-prop="label" value="${escapeHtml(control.label)}"></label>
      <label>Loại dữ liệu
        <select data-control-prop="fieldType">
          ${["text", "multiline", "number", "date", "choice", "checkbox", "boolean", "email"].map((type) => `<option value="${type}" ${control.fieldType === type ? "selected" : ""}>${FIELD_TYPE_LABELS[type] || type}</option>`).join("")}
        </select>
      </label>
      <label>Section<input data-control-prop="section" value="${escapeHtml(control.section || "general")}"></label>
      <label>Giá trị mặc định (Default Value)<input data-control-prop="defaultValue" value="${escapeHtml(control.defaultValue ?? "")}"></label>
      <label>Placeholder<input data-control-prop="placeholder" value="${escapeHtml(control.placeholder || "")}"></label>
      <label>Bố cục nhãn (Layout mode)
        <select data-control-prop="layoutMode">
          <option value="horizontal" ${control.layoutMode === "horizontal" ? "selected" : ""}>Ngang (Horizontal)</option>
          <option value="vertical" ${control.layoutMode === "vertical" ? "selected" : ""}>Dọc (Vertical)</option>
        </select>
      </label>
      ${isChoice ? `
        <label>Nguồn lựa chọn (Option source)
          <select data-control-prop="optionSource">
            <option value="json" ${control.optionSource === "json" ? "selected" : ""}>JSON tĩnh (Static options)</option>
            <option value="sharepoint" ${control.optionSource === "sharepoint" ? "selected" : ""}>SharePoint Option Set</option>
          </select>
        </label>
        ${control.optionSource === "sharepoint" ? `
          <label>Tên Option Set<input data-control-prop="optionSet" value="${escapeHtml(control.optionSet || "")}" placeholder="VD: Department, CostCenter..."></label>
          <label>Trường cha (Parent field - phụ thuộc)<input data-control-prop="parentField" value="${escapeHtml(control.parentField || "")}" placeholder="Key của trường cha nếu có (VD: sharePointChoice)"></label>
        ` : `
          <label>Danh sách Options (JSON)
            <textarea data-control-prop="options" style="font-family:monospace;font-size:11px;min-height:80px;" spellcheck="false">${escapeHtml(JSON.stringify(control.options || [], null, 2))}</textarea>
          </label>
          <div class="inspector-hint">Cấu trúc: <code>[{"value": "OPT1", "label": "Option 1", "parentValue": ""}]</code></div>
        `}
      ` : ""}
      <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:12px;">
        <label class="checkbox-label"><input type="checkbox" data-control-prop="required" ${control.required ? "checked" : ""}> Bắt buộc</label>
        <label class="checkbox-label"><input type="checkbox" data-control-prop="visible" ${control.visible !== false ? "checked" : ""}> Hiển thị</label>
        ${control.fieldType === "multiline" ? `<label class="checkbox-label"><input type="checkbox" data-control-prop="multiline" checked disabled> Nhiều dòng</label>` : ""}
      </div>
    `);
  } else if (control.type === "heading" || control.type === "text") {
    common.push(`<label>${control.type === "heading" ? "Nội dung tiêu đề" : "Nội dung"}<textarea data-control-prop="text">${escapeHtml(control.text)}</textarea></label>`);
  } else if (control.type === "image") {
    common.push(`<label>Đường dẫn ảnh<input data-control-prop="src" value="${escapeHtml(control.src || "")}" placeholder="https://..."></label>
      <label>Mô tả ảnh<input data-control-prop="alt" value="${escapeHtml(control.alt || "")}"></label>
      <label>Chiều rộng (px)<input type="number" min="20" max="1200" data-control-prop="width" value="${escapeHtml(control.width || 180)}"></label>
      <div class="inspector-hint">Dùng URL HTTPS hoặc data URI ảnh (PNG/JPEG/GIF/WebP).</div>`);
  } else if (control.type === "dateTime") {
    common.push(`<label>Nhãn<input data-control-prop="label" value="${escapeHtml(control.label || "")}"></label>
      <label>Hiển thị
        <select data-control-prop="format">
          ${[["datetime", "Ngày và giờ"], ["date", "Ngày"], ["time", "Giờ UTC"]].map(([value, label]) => `<option value="${value}" ${control.format === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </label>`);
  } else if (control.type === "approvals") {
    common.push(`<label>Tiêu đề bảng<input data-control-prop="title" value="${escapeHtml(control.title)}"></label>`);
  } else if (control.type === "spacer") {
    common.push(`<label>Chiều cao (px)<input type="number" min="4" max="120" data-control-prop="height" value="${escapeHtml(control.height)}"></label>`);
  } else if (control.type === "lineItems") {
    common.push(`<label>Tiêu đề bảng<input data-control-prop="title" value="${escapeHtml(control.title || "LINE ITEMS")}"></label>
      <label>Cột bảng (JSON)<textarea data-control-prop="columns" spellcheck="false">${escapeHtml(JSON.stringify(control.columns || [], null, 2))}</textarea></label>
      <div class="inspector-hint">Mỗi cột dùng <code>key</code> khớp với <code>columnKey</code> trong lineItems.</div>`);
  }
  elements.inspector.innerHTML = `<div class="inspector-form">${common.join("")}
    <button class="remove-control" type="button" data-remove-control="${escapeHtml(control.id)}">Xóa thành phần</button>
  </div>`;
}

function renderDesigner() {
  elements.formType.value = template.formType;
  elements.paperSize.value = template.paperSize;
  elements.orientation.value = template.orientation;
  renderPalette();
  renderCanvas();
}

function changeRowLayout(rowId, columnCount) {
  const row = ["headerRows", "rows", "footerRows"]
    .flatMap((region) => template[region] || [])
    .find((item) => item.id === rowId);
  if (!row || row.columns.length === columnCount) return;
  const controls = row.columns.flatMap((column) => column.controls);
  row.columns = Array.from({ length: columnCount }, () => ({ controls: [] }));
  controls.forEach((control, index) => row.columns[index % columnCount].controls.push(control));
  renderDesigner();
}

function buildRequest() {
  const data = readInputJson();
  const formType = elements.formType.value;
  template.formType = formType;
  template.paperSize = elements.paperSize.value;
  template.orientation = elements.orientation.value;
  return {
    ...data,
    FormType: "Dynamic",
    FormCode: template.formCode || formType,
    paperSize: template.paperSize,
    orientation: template.orientation,
    JsonTemplate: toFormSchema(template),
  };
}

async function requestRender(endpoint) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildRequest()),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `API trả về lỗi ${response.status}.`);
  return result;
}

async function showPreview() {
  elements.previewView.hidden = false;
  elements.designView.hidden = true;
  document.querySelectorAll(".view-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === "preview"));
  elements.previewMessage.hidden = false;
  elements.previewMessage.textContent = "Đang tạo bản xem trước…";
  try {
    const html = await requestRender("/api/render");
    elements.previewFrame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#fff}</style></head><body>${html}</body></html>`;
    elements.previewMessage.hidden = true;
  } catch (error) {
    elements.previewMessage.textContent = error.message;
    showNotice(error.message, true);
  }
}

async function downloadPdf() {
  const button = document.querySelector("#pdfButton");
  button.disabled = true;
  button.textContent = "Đang tạo PDF…";
  try {
    const response = await fetch("/api/render-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRequest()),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `API trả về lỗi ${response.status}.`);
    const bytes = Uint8Array.from(atob(result.pdfBase64), (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: result.pdfContentType || "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.pdfFileName || "paperless-form.pdf";
    link.click();
    URL.revokeObjectURL(url);
    showNotice(`Đã tạo PDF ${result.paperSize || template.paperSize}.`);
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Tải PDF";
  }
}

function updateAdminAuthentication(authenticated) {
  isAdminAuthenticated = authenticated;
  elements.authButton.textContent = authenticated ? "Đăng xuất" : "Đăng nhập";
  elements.saveButton.disabled = !authenticated;
  elements.savedTemplates.disabled = !authenticated;
  if (!authenticated) {
    storedTemplates = [];
    elements.savedTemplates.innerHTML = `<option value="">Đăng nhập để xem template</option>`;
    elements.apiStatus.textContent = "Đăng nhập để quản lý template";
  }
}

function showLoginDialog() {
  if (!elements.loginDialog.open) elements.loginDialog.showModal();
  elements.adminPassword.focus();
}

async function checkAdminSession() {
  try {
    const response = await fetch("/api/auth/session", { credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `API trả về lỗi ${response.status}.`);
    updateAdminAuthentication(result.authenticated === true);
    if (isAdminAuthenticated) await readStoredTemplates({ notify: false });
  } catch (error) {
    updateAdminAuthentication(false);
    elements.apiStatus.textContent = error.message;
  }
}

async function loginAdmin(event) {
  event.preventDefault();
  elements.loginError.hidden = true;
  elements.loginSubmit.disabled = true;
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: elements.adminPassword.value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `API trả về lỗi ${response.status}.`);
    elements.adminPassword.value = "";
    elements.loginDialog.close();
    updateAdminAuthentication(true);
    await readStoredTemplates({ notify: false });
    showNotice("Đã đăng nhập quản trị.");
  } catch (error) {
    elements.loginError.textContent = error.message;
    elements.loginError.hidden = false;
  } finally {
    elements.loginSubmit.disabled = false;
  }
}

async function logoutAdmin() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `API trả về lỗi ${response.status}.`);
  updateAdminAuthentication(false);
  showNotice("Đã đăng xuất.");
}

async function readStoredTemplates({ notify = true } = {}) {
  try {
    const response = await fetch("/api/templates", { credentials: "same-origin" });
    const result = await response.json();
    if (response.status === 401) {
      updateAdminAuthentication(false);
    }
    if (!response.ok) throw new Error(result.error || `API trả về lỗi ${response.status}.`);
    storedTemplates = Array.isArray(result.templates) ? result.templates : [];
    elements.apiStatus.textContent = `Database · ${storedTemplates.length} template`;
  } catch (error) {
    storedTemplates = [];
    elements.apiStatus.textContent = isAdminAuthenticated
      ? "Không kết nối được database"
      : "Đăng nhập để xem template đã lưu";
    if (notify) showNotice(`Không tải được template đã lưu: ${error.message}`, true);
  }
  elements.savedTemplates.innerHTML = `<option value="">Template đã lưu (${storedTemplates.length})</option>${
    storedTemplates.map((saved) => `<option value="${escapeHtml(saved.formType)}">${escapeHtml(saved.name || saved.formType)}</option>`).join("")
  }`;
}

async function saveTemplate() {
  if (!isAdminAuthenticated) {
    showLoginDialog();
    return;
  }
  const button = elements.saveButton;
  button.disabled = true;
  try {
    template.formType = elements.formType.value;
    template.paperSize = elements.paperSize.value;
    template.orientation = elements.orientation.value;
    const response = await fetch("/api/templates", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formType: template.formType, template: clone(template) }),
    });
    const result = await response.json();
    if (response.status === 401) {
      updateAdminAuthentication(false);
      showLoginDialog();
    }
    if (!response.ok) throw new Error(result.error || `API trả về lỗi ${response.status}.`);
    await readStoredTemplates({ notify: false });
    showNotice(`Đã lưu template cho formType “${template.formType}”.`);
  } catch (error) {
    showNotice(`Không lưu được template: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
}

function exportTemplate() {
  const content = JSON.stringify(toFormSchema(template), null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(template.formCode || template.name || "paperless-form").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showNotice("Đã xuất JSON schemaVersion 1.1.");
}

async function importTemplate(file) {
  try {
    const imported = JSON.parse(await file.text());
    const next = imported.template ?? (Array.isArray(imported.fields)
      ? fromFormSchema(imported)
      : imported);
    if (!next || typeof next !== "object" || !Array.isArray(next.rows)) {
      throw new Error("JSON phải là schemaVersion 1.1 có fields hoặc template có rows.");
    }
    template = {
      ...next,
      id: next.id || createId(),
      name: next.name || file.name.replace(/\.json$/i, ""),
      formType: next.formType || "material-take-out",
      paperSize: next.paperSize || "A4",
      orientation: next.orientation || "portrait",
      rows: next.rows.map((row) => ({
        ...row,
        id: row.id || createId(),
        columns: row.columns.map((column) => ({
          ...column,
          controls: (column.controls || []).map((control) => ({ ...control, id: control.id || createId() })),
        })),
      })),
    };
    selectedControlId = null;
    renderDesigner();
    showNotice("Đã nhập form schema. Nhấn Lưu template để lưu vào database.");
  } catch (error) {
    showNotice(`Không nhập được template: ${error.message}`, true);
  }
}

function removeControl(controlId) {
  for (const region of ["headerRows", "rows", "footerRows"]) {
    for (const row of template[region] || []) {
      for (const column of row.columns) {
        column.controls = column.controls.filter((control) => control.id !== controlId);
      }
    }
  }
  selectedControlId = null;
  renderDesigner();
}

function getDragPayload(event) {
  try {
    return JSON.parse(event.dataTransfer.getData("application/x-paperless-control"));
  } catch {
    return null;
  }
}

document.querySelectorAll("[data-add-row]").forEach((button) => {
  button.addEventListener("click", () => addRow(Number(button.dataset.addRow)));
});
document.querySelectorAll("[data-add-region-row]").forEach((button) => {
  button.addEventListener("click", () => addRow(1, button.dataset.addRegionRow));
});
document.querySelector("#addRowButton").addEventListener("click", () => addRow(1));
document.querySelector("#previewButton").addEventListener("click", showPreview);
document.querySelector("#pdfButton").addEventListener("click", downloadPdf);
document.querySelector("#saveButton").addEventListener("click", saveTemplate);
elements.authButton.addEventListener("click", () => {
  if (!isAdminAuthenticated) {
    showLoginDialog();
    return;
  }
  logoutAdmin().catch((error) => showNotice(`Không thể đăng xuất: ${error.message}`, true));
});
elements.loginForm.addEventListener("submit", loginAdmin);
document.querySelector("#loginCancel").addEventListener("click", () => elements.loginDialog.close());
document.querySelector("#exportButton").addEventListener("click", exportTemplate);
document.querySelector("#importButton").addEventListener("click", () => document.querySelector("#importFile").click());
document.querySelector("#importFile").addEventListener("change", (event) => {
  if (event.target.files?.[0]) importTemplate(event.target.files[0]);
  event.target.value = "";
});
document.querySelector("#copyRequest").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(buildRequest(), null, 2));
    showNotice("Đã sao chép request mẫu cho Power Automate.");
  } catch (error) {
    showNotice(`Không thể sao chép request: ${error.message}`, true);
  }
});
elements.formType.addEventListener("change", () => {
  template.formType = elements.formType.value;
  template.formCode = elements.formType.value.startsWith("capex") ? "CAPEX_MVP" : "MATERIAL_TAKE_OUT";
  renderDesigner();
});
elements.paperSize.addEventListener("change", () => {
  template.paperSize = elements.paperSize.value;
  renderDesigner();
});
elements.orientation.addEventListener("change", () => {
  template.orientation = elements.orientation.value;
  renderDesigner();
});
elements.dataJson.addEventListener("input", () => {
  renderPalette();
  renderCanvas();
});
elements.savedTemplates.addEventListener("change", () => {
  if (elements.savedTemplates.value === "") return;
  const loaded = storedTemplates.find((saved) => saved.formType === elements.savedTemplates.value);
  if (!loaded) return;
  template = clone(loaded.template);
  selectedControlId = null;
  elements.formType.value = template.formType;
  elements.paperSize.value = template.paperSize;
  elements.orientation.value = template.orientation;
  renderDesigner();
  showNotice(`Đã mở template “${template.name}”.`);
});
document.querySelectorAll(".view-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.view === "preview") {
      showPreview();
    } else {
      elements.previewView.hidden = true;
      elements.designView.hidden = false;
      document.querySelectorAll(".view-tab").forEach((item) => item.classList.toggle("active", item === tab));
    }
  });
});

elements.controlPalette.addEventListener("click", (event) => {
  const button = event.target.closest("[data-palette-type]");
  if (button) addControl(button.dataset.paletteType);
});
elements.fieldPalette.addEventListener("click", (event) => {
  const button = event.target.closest("[data-field-key]");
  if (button) {
    const field = getDataField(button.dataset.fieldKey);
    addControl("field", null, 0, field ?? { key: button.dataset.fieldKey, label: button.dataset.fieldLabel });
  }
});
for (const [region, container] of [
  ["headerRows", elements.headerRows],
  ["rows", elements.canvasRows],
  ["footerRows", elements.footerRows],
]) {
  container.addEventListener("click", (event) => {
    const controlNode = event.target.closest("[data-control-id]");
    if (controlNode) {
      selectedControlId = controlNode.dataset.controlId;
      renderDesigner();
      return;
    }
    const deleteRow = event.target.closest("[data-row-delete]");
    if (deleteRow) {
      const removed = template[region].find((row) => row.id === deleteRow.dataset.rowDelete);
      if (removed?.columns.some((column) => column.controls.some((control) => control.id === selectedControlId))) selectedControlId = null;
      template[region] = template[region].filter((row) => row.id !== deleteRow.dataset.rowDelete);
      renderDesigner();
      return;
    }
    const moveUp = event.target.closest("[data-row-up]");
    const moveDown = event.target.closest("[data-row-down]");
    if (moveUp || moveDown) {
      const rowId = (moveUp || moveDown).dataset.rowUp || (moveUp || moveDown).dataset.rowDown;
      const index = template[region].findIndex((row) => row.id === rowId);
      const target = moveUp ? index - 1 : index + 1;
      if (index >= 0 && target >= 0 && target < template[region].length) {
        [template[region][index], template[region][target]] = [template[region][target], template[region][index]];
        renderDesigner();
      }
    }
  });
  container.addEventListener("change", (event) => {
    if (event.target.matches("[data-row-layout]")) {
      changeRowLayout(event.target.dataset.rowLayout, Number(event.target.value));
    }
  });
}
elements.inspector.addEventListener("change", (event) => {
  const control = getSelectedControl();
  const templateProperty = event.target.dataset.templateProp;
  if (templateProperty) {
    template[templateProperty] = event.target.value;
    renderDesigner();
    return;
  }
  const property = event.target.dataset.controlProp;
  if (control && property) {
    if (property === "multiline" || property === "required" || property === "visible") control[property] = event.target.checked;
    else if (property === "height" || property === "width") control[property] = Number(event.target.value);
    else if (property === "options") {
      try {
        const parsed = JSON.parse(event.target.value);
        if (!Array.isArray(parsed)) throw new Error("Options phải là một mảng JSON.");
        control.options = parsed;
      } catch (error) {
        showNotice(`Cấu hình options không hợp lệ: ${error.message}`, true);
        return;
      }
    } else if (property === "columns") {
      try {
        const columns = JSON.parse(event.target.value);
        if (!Array.isArray(columns) || columns.length === 0 || columns.some((column) => !column.key)) {
          throw new Error("Cần ít nhất một cột có key.");
        }
        control.columns = columns;
      } catch (error) {
        showNotice(`Cấu hình cột không hợp lệ: ${error.message}`, true);
        return;
      }
    } else {
      control[property] = event.target.value;
      if (property === "fieldType") {
        control.multiline = event.target.value === "multiline";
        control.layoutMode = control.multiline ? "vertical" : (control.layoutMode || "horizontal");
        if ((event.target.value === "checkbox" || event.target.value === "boolean") && !control.defaultValue) {
          control.defaultValue = "false";
        }
        if (event.target.value === "choice" && !control.optionSource) {
          control.optionSource = "json";
        }
      }
    }
    renderDesigner();
  }
});
elements.inspector.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove-control]");
  if (remove) removeControl(remove.dataset.removeControl);
});

const canvasRegions = [elements.headerRows, elements.canvasRows, elements.footerRows];
for (const palette of [elements.controlPalette, elements.fieldPalette, ...canvasRegions]) {
  palette.addEventListener("dragstart", (event) => {
    const paletteControl = event.target.closest("[data-palette-type]");
    const field = event.target.closest("[data-field-key]");
    const control = event.target.closest("[data-control-id]");
    let payload;
    if (paletteControl) payload = { type: paletteControl.dataset.paletteType };
    else if (field) {
      const sampleField = getDataField(field.dataset.fieldKey);
      payload = {
        type: "field",
        field: sampleField ?? {
          key: field.dataset.fieldKey,
          label: field.dataset.fieldLabel,
          type: field.dataset.fieldType,
          section: field.dataset.fieldSection,
        },
      };
    }
    else if (control) {
      payload = { controlId: control.dataset.controlId };
      control.classList.add("dragging");
    }
    if (payload) {
      event.dataTransfer.setData("application/x-paperless-control", JSON.stringify(payload));
      event.dataTransfer.effectAllowed = "move";
    }
  });
  palette.addEventListener("dragend", (event) => event.target.closest(".canvas-control")?.classList.remove("dragging"));
}
for (const regionContainer of canvasRegions) {
  regionContainer.addEventListener("dragover", (event) => {
    const column = event.target.closest(".canvas-column");
    if (!column) return;
    event.preventDefault();
    column.classList.add("drop-target");
  });
  regionContainer.addEventListener("dragleave", (event) => {
    if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
      event.target.closest(".canvas-column")?.classList.remove("drop-target");
    }
  });
  regionContainer.addEventListener("drop", (event) => {
    const columnNode = event.target.closest(".canvas-column");
    if (!columnNode) return;
    event.preventDefault();
    columnNode.classList.remove("drop-target");
    const payload = getDragPayload(event);
    if (!payload) return;
    const region = columnNode.dataset.region;
    const rows = template[region];
    const row = rows.find((item) => item.id === columnNode.dataset.rowId);
    const targetColumn = row?.columns[Number(columnNode.dataset.columnIndex)];
    if (!targetColumn) return;
    if (payload.controlId) {
      let moved;
      for (const sourceRegion of ["headerRows", "rows", "footerRows"]) {
        for (const sourceRow of template[sourceRegion] || []) {
          for (const sourceColumn of sourceRow.columns) {
            const index = sourceColumn.controls.findIndex((control) => control.id === payload.controlId);
            if (index >= 0) moved = sourceColumn.controls.splice(index, 1)[0];
          }
        }
      }
      if (moved) targetColumn.controls.push(moved);
    } else if (payload.type) {
      const control = createControl(payload.type, payload.field);
      targetColumn.controls.push(control);
      selectedControlId = control.id;
    }
    renderDesigner();
  });
}

renderDesigner();
checkAdminSession();
