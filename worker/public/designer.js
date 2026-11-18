import { fromFormSchema, toFormSchema } from "./designer-schema.mjs";

const TYPE_LABELS = {
  heading: "Tiêu đề",
  field: "Trường dữ liệu",
  lineItems: "Bảng Line Items",
  approvals: "Bảng Approval",
  image: "Hình ảnh / logo",
  dateTime: "Ngày giờ",
  text: "Đoạn văn",
  divider: "Đường kẻ",
  spacer: "Khoảng trống",
};

const demoFields = [
  { FieldKey: "department", FieldLabel: "department", FieldType: "choice", FieldValue: "Finance", IsDirty: true, SectionKey: "requestInfo" },
  { FieldKey: "documenttype", FieldLabel: "Document Type", FieldType: "choice", FieldValue: "", IsDirty: true, SectionKey: "requestInfo" },
  { FieldKey: "materialtype", FieldLabel: "Material Type", FieldType: "choice", FieldValue: "InventoryPart", IsDirty: true, SectionKey: "requestInfo" },
  { FieldKey: "description", FieldLabel: "Reason", FieldType: "multiline", FieldValue: "dsfsdfsdf", IsDirty: true, SectionKey: "requestInfo" },
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
  if (type === "heading") control.text = "Tiêu đề mục";
  if (type === "image") {
    control.src = "";
    control.alt = "Logo";
    control.width = 160;
  }
  if (type === "dateTime") {
    control.label = "Ngày giờ tạo";
    control.format = "datetime";
  }
  if (type === "lineItems") {
    control.title = "LINE ITEMS";
    control.columns = [
      { key: "partno", label: "Part Number" },
      { key: "description", label: "Description" },
      { key: "quanity", label: "Quantity" },
      { key: "note", label: "Note" },
    ];
  }
  if (type === "approvals") control.title = "APPROVAL LINE";
  if (type === "field") {
    control.fieldKey = field.key ?? "department";
    control.label = field.label ?? "Department";
    control.multiline = field.type === "multiline";
    control.fieldType = field.type ?? "text";
    control.section = field.section ?? "requestInfo";
    control.placeholder = field.placeholder ?? (control.fieldType === "choice"
      ? `Select ${control.label}`
      : control.fieldType === "multiline" ? `enter ${control.label.toLowerCase()}` : "");
    control.required = field.required ?? true;
    control.optionSource = field.optionSource ?? (control.fieldType === "choice" ? "sharepoint" : "");
    control.optionSet = field.optionSet ?? (control.fieldType === "choice" ? optionSetFromKey(control.fieldKey) : "");
    control.parentField = field.parentField ?? "";
    control.options = Array.isArray(field.options) ? field.options : [];
    control.layoutMode = field.layoutMode ?? (control.fieldType === "multiline" ? "vertical" : "horizontal");
  }
  if (type === "text") control.text = "Nhập nội dung tĩnh";
  if (type === "spacer") control.height = 20;
  return control;
}

function makeDefaultTemplate() {
  const department = createControl("field", {
    key: "department",
    label: "department",
    type: "choice",
    section: "requestInfo",
    placeholder: "Select department",
    required: true,
    optionSource: "sharepoint",
    optionSet: "Department",
  });
  const materialType = createControl("field", {
    key: "materialtype",
    label: "Material Type",
    type: "choice",
    section: "requestInfo",
    placeholder: "Select Material Type",
    required: true,
    optionSource: "sharepoint",
    optionSet: "Materialtype",
  });
  const documentType = createControl("field", {
    key: "documenttype",
    label: "Document Type",
    type: "choice",
    section: "requestInfo",
    placeholder: "Select Document Type",
    required: true,
    optionSource: "sharepoint",
    optionSet: "Documenttype",
    parentField: "",
    options: [],
    layoutMode: "horizontal",
  });
  const reason = createControl("field", {
    key: "description",
    label: "Reason",
    type: "multiline",
    section: "requestInfo",
    placeholder: "enter reason",
    required: true,
  });
  reason.multiline = true;
  return {
    id: createId(),
    name: "Form designer",
    formCode: "MATERIAL_TAKE_OUT",
    formVersion: 1,
    formType: "material-take-out",
    paperSize: "A4",
    orientation: "portrait",
    headerRows: [],
    rows: [
      { id: createId(), columns: [{ controls: [Object.assign(createControl("heading"), { text: "Request Information" })] }] },
      { id: createId(), columns: [{ controls: [department] }, { controls: [documentType] }, { controls: [materialType] }] },
      { id: createId(), columns: [{ controls: [reason] }] },
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
    return formValue.filter((field) => field && typeof field === "object" && field.FieldKey)
      .map((field) => ({
        key: String(field.FieldKey),
        label: String(field.FieldLabel || field.FieldKey),
        type: String(field.FieldType || "text").toLowerCase(),
        section: String(field.SectionKey || "requestInfo"),
        required: field.Required ?? true,
        optionSource: field.OptionSource || (String(field.FieldType).toLowerCase() === "choice" ? "sharepoint" : ""),
        optionSet: field.OptionSet || (String(field.FieldType).toLowerCase() === "choice" ? optionSetFromKey(field.FieldKey) : ""),
        placeholder: field.Placeholder || "",
        sampleValue: field.FieldValue ?? "",
      }));
  }
  if (formValue && typeof formValue === "object") {
    return Object.keys(formValue).map((key) => ({
      key,
      label: key.replace(/([a-z0-9])([A-Z])/g, "$1 $2"),
      type: typeof formValue[key] === "number" ? "number" : "text",
      section: "requestInfo",
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
  const control = createControl(type, field);
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
  const types = ["heading", "field", "lineItems", "approvals", "image", "dateTime", "text", "divider"];
  elements.controlPalette.innerHTML = types.map((type) =>
    `<button type="button" class="palette-control" draggable="true" data-palette-type="${type}">
      <span class="control-icon">${type === "heading" ? "T" : type === "field" ? "Aa" : type === "lineItems" ? "▤" : type === "approvals" ? "✓" : type === "image" ? "▧" : type === "dateTime" ? "◷" : type === "divider" ? "—" : "¶"}</span>
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
                  ${control.type === "field" ? `<span class="canvas-control-sample">${escapeHtml(getFieldSample(control.fieldKey) || "Giá trị mẫu trống")}</span>` : ""}
                  ${control.type === "image" && control.src ? `<img class="canvas-control-image" src="${escapeHtml(control.src)}" alt="">` : ""}
                </span>
                <span class="canvas-control-type">${escapeHtml(TYPE_LABELS[control.type] || control.type)}</span>
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
    common.push(`<label>Trường JSON
      <select data-control-prop="fieldKey">${options.map((field) => `<option value="${escapeHtml(field.key)}" ${field.key === control.fieldKey ? "selected" : ""}>${escapeHtml(field.label)} · ${escapeHtml(field.key)}</option>`).join("")}</select>
    </label><label>Nhãn hiển thị<input data-control-prop="label" value="${escapeHtml(control.label)}"></label>
    <label>Loại dữ liệu
      <select data-control-prop="fieldType">
        ${["choice", "text", "multiline", "date", "number", "boolean", "email"].map((type) => `<option value="${type}" ${control.fieldType === type ? "selected" : ""}>${type}</option>`).join("")}
      </select>
    </label>
    <label>Section<input data-control-prop="section" value="${escapeHtml(control.section || "requestInfo")}"></label>
    <label>Placeholder<input data-control-prop="placeholder" value="${escapeHtml(control.placeholder || "")}"></label>
    <label>Option source<input data-control-prop="optionSource" value="${escapeHtml(control.optionSource || "")}"></label>
    <label>Option set<input data-control-prop="optionSet" value="${escapeHtml(control.optionSet || "")}"></label>
    <label class="checkbox-label"><input type="checkbox" data-control-prop="required" ${control.required ? "checked" : ""}> Bắt buộc</label>
    <label class="checkbox-label"><input type="checkbox" data-control-prop="multiline" ${control.multiline ? "checked" : ""}> Trường nhiều dòng</label>`);
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
    if (property === "multiline" || property === "required") control[property] = event.target.checked;
    else if (property === "height" || property === "width") control[property] = Number(event.target.value);
    else if (property === "columns") {
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
        control.layoutMode = control.multiline ? "vertical" : "horizontal";
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
