const CAPEX_FIELDS = [
  ["1. Request information", [
    ["Assets ID", ["txtAssetID"]],
    ["Date of Request", ["dteDateOfRequest"]],
    ["Expected Receipt Date", ["dteDateOfExpectedReceipt"]],
    ["Requisitioner Name", ["txtRequisitionerName"]],
    ["Department", ["drpDepartmentName"]],
    ["Sub Department", ["drpSubDepartment"]],
  ]],
  ["2. Asset classification", [
    ["Classification", ["drpClassification"]],
    ["Acquisition Type", ["drpAccquisitionType"]],
    ["Asset Class", ["drpAssetClass"]],
    ["Executor", ["drpExecutorName"]],
  ]],
  ["3. Asset details", [
    ["Asset Short Name", ["txtAssetShortName"]],
    ["Useful Life (Years)", ["txtUsefulLifeYears"]],
    ["Year of Manufacture", ["txtYearOfManufacture"]],
    ["Country of Origin", ["txtCountryofOrigin"]],
  ]],
  ["4. Investment plan & replacement", [
    ["In Investment Plan", ["txtInInvestmentPlan"]],
    ["Investment Plan No.", ["txtInvestmentPlanNo"]],
    ["Plan Budget Amount", ["txtPlanBudgetAmount"]],
    ["Replaced Asset ID", ["txtReplacedAssetID"]],
    ["Original Cost / NBV", ["txtOriginCostNBV"]],
    ["Asset to be Replaced", ["txtAssetTobeReplaced"]],
  ]],
  ["5. Description & justification", [
    ["Asset Description", ["txtAssetDescription"], "multiline"],
    ["Justification / Explanation", ["txtJustificationExplanation"], "multiline"],
    ["Subject to Maintenance", ["drpSubjectToMaintenance"]],
  ]],
  ["6. Estimated cost", [
    ["Quantity", ["txtQuantity"]],
    ["Unit Price", ["txtUnitPrice"]],
    ["Purchase Price", ["txtPurchasePrice"]],
    ["Transport / Insurance", ["txtTransportInsurance"]],
    ["Duty", ["txtDuty"]],
    ["Other", ["txtOther"]],
    ["Base Value", ["txtBaseValue"]],
    ["Currency", ["drpCurrency"]],
  ]],
];

const MATERIAL_FIELD_LABELS = {
  inpRequestTitle: "Request title",
  department: "Department",
  materialtype: "Material Type",
  reason: "Reason",
  requestinfo: "Request Info",
};

const APPROVAL_CELL_STYLE =
  "padding:5px 8px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;";

function normalizedKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function readField(data, keys) {
  const wanted = new Set(keys.map(normalizedKey));
  const key = Object.keys(data).find((candidate) => wanted.has(normalizedKey(candidate)));
  return key === undefined ? undefined : data[key];
}

function displayField(data, keys) {
  return escapeHtml(displayValue(readField(data, keys)));
}

function section(title, fields, data) {
  const fieldMarkup = fields.map(([label, keys, kind]) => {
    const value = displayField(data, keys);
    const valueStyle = kind === "multiline"
      ? "min-height:44px;padding:6px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3px;white-space:pre-wrap;"
      : "padding:2px 0;";
    return `<div style="margin:0 0 7px;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="color:#64748b;font-size:9.5px;margin-bottom:2px;">${escapeHtml(label)}</div>
      <div style="font-size:11px;font-weight:600;color:#0f172a;${valueStyle}box-sizing:border-box;">${value}</div>
    </div>`;
  }).join("");

  return `<div style="background:#fff;border:1px solid #cbd5e1;border-radius:3px;padding:10px 12px;box-sizing:border-box;">
    <div style="background:#e9eef5;color:#1b365d;font-weight:700;padding:5px 8px;border-left:4px solid #1b365d;font-size:10.5px;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(title)}</div>
    ${fieldMarkup}
  </div>`;
}

function lineItemsFrom(request, data) {
  const supplied = readField(request, [
    "lineItems", "jsonLineItems", "JsonFormLine", "JsonFormDetail", "JsonMaterialLine",
  ]);
  if (supplied !== undefined) {
    return parseJsonInput(supplied, "lineItems", { expectedArray: true });
  }

  const embedded = readField(data, ["GridDataYY", "GridData", "LineItems"]);
  return parseJsonInput(embedded, "GridData", { expectedArray: true });
}

function cellMap(row) {
  if (!row || typeof row !== "object" || !Array.isArray(row.cells)) {
    return null;
  }
  return Object.fromEntries(row.cells
    .filter((cell) => cell && typeof cell === "object" && cell.columnKey !== undefined)
    .map((cell) => [String(cell.columnKey), cell.value]));
}

function lineItemsTable(rows, { title = "Items", showEmpty = false } = {}) {
  const validRows = rows.map((row, index) => ({ row, index, cells: cellMap(row) }))
    .filter((item) => item.cells !== null)
    .sort((left, right) => {
      const leftOrder = Number(left.row.rowOrder);
      const rightOrder = Number(right.row.rowOrder);
      if (Number.isFinite(leftOrder) && Number.isFinite(rightOrder)) {
        return leftOrder - rightOrder || left.index - right.index;
      }
      return left.index - right.index;
    });

  if (validRows.length === 0 && !showEmpty) {
    return "";
  }

  const columns = [...new Set(validRows.flatMap(({ cells }) => Object.keys(cells)))];
  const headers = columns.map((column) =>
    `<th style="padding:6px 8px;text-align:left;background:#1b365d;color:#fff;">${escapeHtml(column)}</th>`
  ).join("");
  const body = validRows.map(({ cells }, index) => {
    const background = index % 2 === 0 ? "#fff" : "#f8fafc";
    const values = columns.map((column) =>
      `<td style="${APPROVAL_CELL_STYLE}">${escapeHtml(displayValue(cells[column]))}</td>`
    ).join("");
    return `<tr style="background:${background};">${values}</tr>`;
  }).join("");

  const emptyRow = validRows.length === 0
    ? `<tr><td colspan="1" style="padding:8px;color:#64748b;">No line items</td></tr>`
    : "";
  return `<div style="margin-top:12px;border:1px solid #cbd5e1;border-radius:3px;overflow:hidden;">
    <div style="padding:7px 9px;background:#e9eef5;color:#1b365d;font-weight:700;font-size:10.5px;">${escapeHtml(title)}</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font:10.5px 'Segoe UI',Arial,sans-serif;">
      ${headers ? `<thead><tr>${headers}</tr></thead>` : ""}<tbody>${body}${emptyRow}</tbody>
    </table>
  </div>`;
}

function materialItemsTable(rows) {
  const columns = [
    ["Part Number", ["partno", "partnumber", "partnumberid"]],
    ["Part Description", ["description", "partdescription"]],
    ["Quanity", ["quanity", "quantity", "qty"]],
    ["Note", ["note", "notes"]],
  ];
  const validRows = rows.map((row) => cellMap(row)).filter((cells) => cells !== null);
  const body = validRows.length === 0
    ? `<tr><td colspan="${columns.length}" style="padding:10px 8px;border-bottom:1px solid #e2e8f0;color:#64748b;">No material items</td></tr>`
    : validRows.map((cells, index) => {
      const background = index % 2 === 0 ? "#fff" : "#f8fafc";
      const values = columns.map(([, aliases]) => {
        const value = readField(cells, aliases);
        return `<td style="${APPROVAL_CELL_STYLE}padding:8px;color:#0f172a;">${escapeHtml(displayValue(value))}</td>`;
      }).join("");
      return `<tr style="background:${background};">${values}</tr>`;
    }).join("");

  return `<div style="margin-top:14px;border:1px solid #cbd5e1;border-radius:4px;overflow:hidden;">
    <div style="padding:10px 12px;background:#f1f5f9;color:#111827;font-size:12px;font-weight:700;">LIST OF MATERIAL</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font:11px 'Segoe UI',Arial,sans-serif;">
      <thead><tr style="background:#fff;color:#374151;">
        ${columns.map(([label]) => `<th style="padding:8px;text-align:left;border-bottom:1px solid #cbd5e1;">${escapeHtml(label)}</th>`).join("")}
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
    <div style="padding:8px;background:#f1f5f9;color:#111827;">Rows count: ${validRows.length}/100</div>
  </div>`;
}

function approvalName(line) {
  const direct = readField(line, ["ApproverName", "ApproverDisplayName", "DisplayName"]);
  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }
  const approver = readField(line, ["Approver"]);
  if (approver && typeof approver === "object") {
    const name = readField(approver, ["DisplayName", "Name", "Email"]);
    if (name !== undefined) {
      return name;
    }
  }
  return readField(line, ["ApproverEmail"]) ?? "—";
}

function approvalDate(line) {
  const value = readField(line, ["ActionDate"])
    ?? readField(line, ["Modified"])
    ?? readField(line, ["Created"]);
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function approvalRows(approvals) {
  return approvals.map((line, index) => ({ line, index }))
    .sort((left, right) => {
      const a = Number(readField(left.line, ["ApprovalStepOrder"]));
      const b = Number(readField(right.line, ["ApprovalStepOrder"]));
      if (Number.isFinite(a) && Number.isFinite(b)) {
        return a - b || left.index - right.index;
      }
      return left.index - right.index;
    })
    .map(({ line }, index) => {
      const step = readField(line, ["ApprovalStepName", "ApprovalLevelName", "StepName", "Title"])
        ?? readField(line, ["State"])
        ?? readField(line, ["ApprovalStepOrder", "ApprovalLevelID"]);
      const comments = readField(line, ["Comments", "Comment", "ApproverComments", "Notes"]);
      const decisionValue = readField(line, ["Status"])
        ?? readField(line, ["StatusNumber"])
        ?? readField(line, ["State"]);
      const decision = displayValue(decisionValue);
      const normalizedDecision = decision.toLowerCase();
      const decisionColor = normalizedDecision.includes("approv")
        ? "background:#dcfce7;color:#15803d;"
        : normalizedDecision.includes("reject")
          ? "background:#fee2e2;color:#b91c1c;"
          : "background:#f1f5f9;color:#475569;";
      const background = index % 2 === 0 ? "#fff" : "#f8fafc";

      return `<tr style="background:${background};">
        <td style="${APPROVAL_CELL_STYLE}color:#334155;">${escapeHtml(displayValue(step))}</td>
        <td style="${APPROVAL_CELL_STYLE}color:#0f172a;">${escapeHtml(displayValue(approvalName(line)))}</td>
        <td style="${APPROVAL_CELL_STYLE}color:#475569;">${escapeHtml(displayValue(comments))}</td>
        <td style="${APPROVAL_CELL_STYLE}color:#475569;text-align:center;font-family:monospace;font-size:10px;">${escapeHtml(approvalDate(line))}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:center;"><span style="display:inline-block;padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:600;${decisionColor}">${escapeHtml(decision)}</span></td>
      </tr>`;
    }).join("");
}

function approvalTable(approvals, title = "", { showEmpty = false } = {}) {
  if (approvals.length === 0 && !showEmpty) {
    return "";
  }
  const emptyRow = approvals.length === 0
    ? `<tr><td colspan="5" style="padding:8px;color:#64748b;text-align:center;">No approval data</td></tr>`
    : "";
  return `<div style="margin-top:14px;border:1px solid #cbd5e1;border-radius:3px;overflow:hidden;">
    ${title ? `<div style="padding:9px 10px;background:#f1f5f9;color:#111827;font-size:12px;font-weight:700;">${escapeHtml(title)}</div>` : ""}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font:10.5px 'Segoe UI',Arial,sans-serif;">
      <thead><tr style="background:#1b365d;color:#fff;">
        <th style="padding:6px 8px;text-align:left;width:20%;">Approval step</th>
        <th style="padding:6px 8px;text-align:left;width:28%;">Approver (name/email)</th>
        <th style="padding:6px 8px;text-align:left;width:22%;">Comments</th>
        <th style="padding:6px 8px;text-align:center;width:18%;">Action Date</th>
        <th style="padding:6px 8px;text-align:center;width:12%;">Decision</th>
      </tr></thead>
      <tbody>${approvalRows(approvals)}${emptyRow}</tbody>
    </table>
  </div>`;
}

function capexHtml(data, approvals, lineItems) {
  const sections = CAPEX_FIELDS.map(([title, fields]) => section(title, fields, data));
  const itemTable = lineItemsTable(lineItems);
  const approvalHtml = approvalTable(approvals);
  const title = escapeHtml(displayValue(readField(data, ["txtAssetShortName", "txtAssetDescription"])) === "—"
    ? "Capital Expenditure Request / Approval"
    : displayValue(readField(data, ["txtAssetShortName", "txtAssetDescription"])));

  return `<div style="font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;background:#fff;color:#1e293b;width:100%;height:auto;max-width:none;margin:0;padding:8px;box-sizing:border-box;font-size:14px;line-height:1.35;">
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#1b365d;color:#fff;margin-bottom:12px;">
      <tr><td style="padding:14px 18px;">
        <div style="font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;">CAPITAL EXPENDITURE REQUEST / APPROVAL</div>
        <div style="font-size:10.5px;color:#cbd5e1;margin-top:4px;">${title}</div>
      </td><td style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;">CAPEX</td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:10px;">
      <tr>
        <td style="width:48%;vertical-align:top;padding:0;">${sections[0]}</td>
        <td style="width:4%;"></td>
        <td style="width:48%;vertical-align:top;padding:0;">${sections[2]}</td>
      </tr>
      <tr><td colspan="3" style="height:10px;"></td></tr>
      <tr>
        <td style="width:48%;vertical-align:top;padding:0;">${sections[1]}</td>
        <td style="width:4%;"></td>
        <td style="width:48%;vertical-align:top;padding:0;">${sections[3]}</td>
      </tr>
    </table>
    <div style="margin-top:10px;">
      ${sections.slice(4).join("")}
    </div>
    ${itemTable}
    ${approvalHtml}
    <div style="border-top:1px solid #e2e8f0;margin-top:12px;padding-top:6px;font-size:9.5px;color:#94a3b8;">Generated by Paperless Form Designer</div>
  </div>`;
}

function materialLabel(key) {
  return MATERIAL_FIELD_LABELS[normalizedKey(key)]
    ?? key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}

function materialData(data) {
  if (!Array.isArray(data)) {
    return { values: data, labels: {} };
  }

  const values = {};
  const labels = {};
  for (const field of data) {
    if (!field || typeof field !== "object" || Array.isArray(field)) {
      continue;
    }
    const key = readField(field, ["FieldKey"]);
    if (typeof key !== "string" || key.trim() === "") {
      continue;
    }
    values[key] = readField(field, ["FieldValue"]);
    const label = readField(field, ["FieldLabel"]);
    if (label !== undefined && label !== null && label !== "") {
      labels[key] = label;
    }
  }
  return { values, labels };
}

function materialFieldMarkup(label, value, { required = false, multiline = false } = {}) {
  const labelText = `${escapeHtml(label)}${required ? " *" : ""}`;
  const valueStyle = multiline
    ? "min-height:66px;white-space:pre-wrap;"
    : "min-height:44px;";
  return `<div style="margin-bottom:8px;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="padding:4px 6px;background:#f1f5f9;color:#374151;font-size:11px;">${labelText}</div>
    <div style="${valueStyle}padding:7px;background:#fff;border:1px solid #d1d5db;color:#111827;font-size:12px;box-sizing:border-box;">${escapeHtml(displayValue(value))}</div>
  </div>`;
}

function materialHtml(data, approvals, lineItems) {
  const { values, labels } = materialData(data);
  const entries = Object.entries(values);
  const takeField = (keys, labelsToMatch = []) => {
    const keySet = new Set(keys.map(normalizedKey));
    const labelSet = new Set(labelsToMatch.map(normalizedKey));
    const match = entries.find(([key]) =>
      keySet.has(normalizedKey(key)) || labelSet.has(normalizedKey(labels[key]))
    );
    return match ? match[1] : undefined;
  };
  const usedKeys = new Set();
  const takeEntry = (keys, labelsToMatch = []) => {
    const keySet = new Set(keys.map(normalizedKey));
    const labelSet = new Set(labelsToMatch.map(normalizedKey));
    const match = entries.find(([key]) =>
      keySet.has(normalizedKey(key)) || labelSet.has(normalizedKey(labels[key]))
    );
    if (match) {
      usedKeys.add(match[0]);
    }
    return match;
  };
  const department = takeEntry(["department"], ["department"]);
  const materialType = takeEntry(["materialtype"], ["material type"]);
  const reason = takeEntry(["reason", "description"], ["reason"]);
  const requestTitle = takeField(["InpRequestTitle"]);
  const extraFields = entries.filter(([key, value]) =>
    !usedKeys.has(key) &&
    !["griddatayy", "griddata", "lineitems"].includes(normalizedKey(key)) &&
    (value === null || typeof value !== "object")
  );
  const extraFieldRows = [];
  for (let index = 0; index < extraFields.length; index += 2) {
    const left = extraFields[index];
    const right = extraFields[index + 1];
    extraFieldRows.push(`<tr>
      <td style="width:48%;vertical-align:top;padding:0;">${materialFieldMarkup(labels[left[0]] ?? materialLabel(left[0]), left[1])}</td>
      <td style="width:4%;"></td>
      <td style="width:48%;vertical-align:top;padding:0;">${right ? materialFieldMarkup(labels[right[0]] ?? materialLabel(right[0]), right[1]) : ""}</td>
    </tr>`);
  }
  const items = materialItemsTable(lineItems);
  const approvalHtml = approvalTable(approvals, "APPROVAL LINE");

  return `<div style="font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,sans-serif;background:#fff;color:#1e293b;width:100%;height:auto;max-width:none;margin:0;padding:4px;box-sizing:border-box;font-size:14px;line-height:1.35;">
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#1b365d;color:#fff;margin-bottom:12px;">
      <tr><td style="padding:14px 18px;">
        <div style="font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;font-family:'Segoe UI',Arial,sans-serif;line-height:1.2;">Material Take Out / Phiếu mang vật tư ra ngoài</div>
        <div style="font-size:10.5px;color:#cbd5e1;margin-top:4px;font-family:'Segoe UI',Arial,sans-serif;">${escapeHtml(displayValue(requestTitle))}</div>
      </td><td style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;">MATERIAL</td></tr>
    </table>
    <div style="border:1px solid #d1d5db;box-shadow:0 1px 3px rgba(0,0,0,.12);">
      <div style="padding:7px 8px;background:#fff;border-bottom:3px solid #d1d5db;color:#111827;font-size:15px;font-weight:700;">Request Information</div>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed;padding:4px;">
        <tr>
          <td style="width:48%;vertical-align:top;padding:4px;">${materialFieldMarkup("department", department ? department[1] : undefined, { required: true })}</td>
          <td style="width:4%;"></td>
          <td style="width:48%;vertical-align:top;padding:4px;">${materialFieldMarkup("Material Type", materialType ? materialType[1] : undefined, { required: true })}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:0 4px;">${materialFieldMarkup("Reason", reason ? reason[1] : undefined, { required: true, multiline: true })}</td>
        </tr>
        ${extraFieldRows.join("")}
      </table>
    </div>
    ${items}
    ${approvalHtml}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0;margin-top:10px;font-size:9.5px;color:#94a3b8;">
      <tr><td style="padding:6px 0;">Generated by Paperless Form Designer</td><td style="padding:6px 0;text-align:right;font-family:monospace;">Schema v1.1</td></tr>
    </table>
  </div>`;
}

function templateFieldValue(data, key) {
  const { values } = materialData(data);
  if (Object.hasOwn(values, key)) {
    return values[key];
  }
  return readField(values, [key]);
}

function templateControlMarkup(control, data, approvals, lineItems, requestName) {
  if (!control || typeof control !== "object" || Array.isArray(control)) {
    throw new TypeError("Template controls must be JSON objects.");
  }
  const type = control.type;
  if (type === "heading") {
    const text = normalizedKey(control.text) === "requestinformation" && requestName?.trim()
      ? requestName
      : control.text ?? "Form section";
    return `<h2 style="margin:0 0 8px;color:#1b365d;font-size:18px;">${escapeHtml(text)}</h2>`;
  }
  if (type === "text") {
    return `<div style="margin:0 0 8px;white-space:pre-wrap;">${escapeHtml(control.text ?? "")}</div>`;
  }
  if (type === "image") {
    const source = String(control.src ?? "").trim();
    if (!source || (!/^https:\/\//i.test(source) && !/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(source))) {
      return "";
    }
    const width = Math.min(1200, Math.max(20, Number(control.width) || 180));
    return `<img src="${escapeHtml(source)}" alt="${escapeHtml(control.alt ?? "")}" style="display:block;width:${width}px;max-width:100%;height:auto;margin:0 0 8px;">`;
  }
  if (type === "dateTime") {
    const now = new Date();
    const format = control.format || "datetime";
    const value = format === "date"
      ? now.toISOString().slice(0, 10)
      : format === "time"
        ? now.toISOString().slice(11, 19) + " UTC"
        : now.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
    const label = control.label ? `<span style="color:#64748b;">${escapeHtml(control.label)}: </span>` : "";
    return `<div style="margin:0 0 8px;">${label}${escapeHtml(value)}</div>`;
  }
  if (type === "field") {
    const label = escapeHtml(control.label ?? control.fieldKey ?? "Field");
    const value = escapeHtml(displayValue(templateFieldValue(data, control.fieldKey ?? "")));
    const multiline = control.multiline === true;
    return `<div style="margin:0 0 10px;">
      <div style="margin-bottom:3px;color:#64748b;font-size:10px;">${label}</div>
      <div style="min-height:${multiline ? "48px" : "22px"};padding:6px 8px;border:1px solid #cbd5e1;white-space:pre-wrap;">${value}</div>
    </div>`;
  }
  if (type === "lineItems") {
    if (Array.isArray(control.columns) && control.columns.length > 0) {
      const validRows = lineItems.map((row) => cellMap(row)).filter((cells) => cells !== null);
      const headers = control.columns.map((column) =>
        `<th style="padding:6px 8px;text-align:left;background:#1b365d;color:#fff;">${escapeHtml(column.label ?? column.key)}</th>`
      ).join("");
      const body = validRows.length
        ? validRows.map((cells) => `<tr>${control.columns.map((column) =>
          `<td style="${APPROVAL_CELL_STYLE}">${escapeHtml(displayValue(readField(cells, [column.key])))}</td>`
        ).join("")}</tr>`).join("")
        : `<tr><td colspan="${control.columns.length}" style="padding:8px;color:#64748b;">No line items</td></tr>`;
      return `<div style="margin-top:12px;border:1px solid #cbd5e1;border-radius:3px;overflow:hidden;">
        <div style="padding:7px 9px;background:#e9eef5;color:#1b365d;font-weight:700;font-size:10.5px;">${escapeHtml(control.title || "LINE ITEMS")}</div>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font:10.5px 'Segoe UI',Arial,sans-serif;">
          <thead><tr>${headers}</tr></thead><tbody>${body}</tbody>
        </table>
      </div>`;
    }
    return lineItemsTable(lineItems, { title: control.title || "LINE ITEMS", showEmpty: true });
  }
  if (type === "approvals") {
    return approvalTable(approvals, control.title || "APPROVAL LINE", { showEmpty: true });
  }
  if (type === "divider") {
    return `<hr style="margin:8px 0;border:0;border-top:1px solid #cbd5e1;">`;
  }
  if (type === "spacer") {
    const height = Math.min(120, Math.max(4, Number(control.height) || 20));
    return `<div style="height:${height}px;"></div>`;
  }
  throw new TypeError(`Unsupported template control "${type}".`);
}

const TEMPLATE_CONTROL_TYPES = new Set([
  "heading", "text", "field", "image", "dateTime", "lineItems", "approvals", "divider", "spacer",
]);

export function normalizeTemplate(template) {
  if (template && !Array.isArray(template) && Array.isArray(template.fields) &&
      !Array.isArray(template.rows)) {
    if (template.schemaVersion !== "1.1") {
      throw new TypeError("Form schema template must use schemaVersion 1.1.");
    }
    if (template.sections !== undefined && !Array.isArray(template.sections)) {
      throw new TypeError("Form schema sections must be a JSON array.");
    }
    if (template.printLayout !== undefined) {
      if (!template.printLayout || typeof template.printLayout !== "object" || Array.isArray(template.printLayout)) {
        throw new TypeError("Form schema printLayout must be a JSON object.");
      }
      const { header = [], body = [], footer = [] } = template.printLayout;
      if (![header, body, footer].every(Array.isArray)) {
        throw new TypeError("Form schema printLayout regions must be JSON arrays.");
      }
      return {
        ...template,
        name: template.formName || template.name || "Paperless form",
        headerRows: header,
        rows: body,
        footerRows: footer,
        hasPrintLayout: true,
      };
    }
    const sectionMap = new Map((template.sections ?? []).map((section) => [section.key, section]));
    const rows = new Map();
    const emittedSections = new Set();
    for (const field of template.fields) {
      if (!field || typeof field.key !== "string" || field.key.trim() === "") {
        throw new TypeError("Each schema field must have a key.");
      }
      const rowIndex = Math.max(1, Number(field.layout?.row) || 1) - 1;
      const columnIndex = Math.max(1, Number(field.layout?.column) || 1) - 1;
      if (columnIndex > 3) {
        throw new TypeError("Schema layout.column must not be greater than 4.");
      }
      if (!rows.has(rowIndex)) rows.set(rowIndex, []);
      const columns = rows.get(rowIndex);
      while (columns.length <= columnIndex) columns.push({ controls: [] });
      const sectionKey = typeof field.section === "string" && field.section ? field.section : "requestInfo";
      const section = sectionMap.get(sectionKey);
      if (section?.visible === false || field.visible === false) continue;
      if (section && !emittedSections.has(sectionKey)) {
        columns[columnIndex].controls.push({
          type: "heading",
          text: section.title || sectionKey,
        });
        emittedSections.add(sectionKey);
      }
      columns[columnIndex].controls.push({
        type: "field",
        fieldKey: field.key,
        label: field.label || field.key,
        fieldType: field.type || "text",
        section: sectionKey,
        sectionTitle: section?.title || "",
        multiline: field.type === "multiline",
        required: field.required === true,
        visible: field.visible !== false,
        placeholder: field.placeholder || "",
        defaultValue: field.defaultValue ?? "",
        optionSource: field.optionSource || "",
        optionSet: field.optionSet || "",
        parentField: field.parentField || "",
        options: Array.isArray(field.options) ? field.options : [],
        layoutMode: field.layout?.mode || "horizontal",
      });
    }
    return {
      ...template,
      name: template.formName || template.name || "Paperless form",
      formType: template.formCode?.startsWith("CAPEX") ? "capex-v3" : "material-take-out",
      headerRows: [],
      footerRows: [],
      hasPrintLayout: false,
      rows: [...rows.entries()].sort(([left], [right]) => left - right)
        .map(([index, columns]) => ({ id: `row-${index + 1}`, columns })),
    };
  }
  return template;
}

export function validateTemplate(template) {
  if (!template || typeof template !== "object" || Array.isArray(template) ||
      !Array.isArray(template.rows) || template.rows.length > 100) {
    throw new TypeError("template must contain a rows array with at most 100 rows.");
  }
  let totalControls = 0;
  for (const row of template.rows) {
    if (!row || !Array.isArray(row.columns) || row.columns.length < 1 || row.columns.length > 4) {
      throw new TypeError("Each template row must contain between 1 and 4 columns.");
    }
    for (const column of row.columns) {
      if (!column || !Array.isArray(column.controls) || column.controls.length > 100) {
        throw new TypeError("Each template column must contain a controls array.");
      }
      totalControls += column.controls.length;
      for (const control of column.controls) {
        if (!control || typeof control !== "object" || Array.isArray(control) ||
            !TEMPLATE_CONTROL_TYPES.has(control.type)) {
          throw new TypeError(`Unsupported template control "${control?.type}".`);
        }
        if (control.type === "field" &&
            (typeof control.fieldKey !== "string" || control.fieldKey.trim() === "")) {
          throw new TypeError("Field controls require a fieldKey.");
        }
        if (control.type === "image" && control.src) {
          if (typeof control.src !== "string" || control.src.length > 4_000_000 ||
              (!/^https:\/\//i.test(control.src) &&
                !/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(control.src))) {
            throw new TypeError("Image controls require an HTTPS URL or a supported image data URI.");
          }
        }
        if (control.type === "dateTime" &&
            control.format !== undefined && !["date", "time", "datetime"].includes(control.format)) {
          throw new TypeError("Date/time controls support date, time, or datetime formats.");
        }
        if (control.type === "lineItems" && control.columns !== undefined) {
          if (!Array.isArray(control.columns) || control.columns.length < 1 || control.columns.length > 20 ||
              control.columns.some((item) => !item || typeof item.key !== "string" || item.key.trim() === "")) {
            throw new TypeError("Line item controls require between 1 and 20 columns with a key.");
          }
        }
      }
    }
  }
  if (totalControls > 1000) {
    throw new TypeError("A template may contain at most 1000 controls.");
  }
  return template;
}

function templateHtml(data, approvals, lineItems, template, formName, requestName) {
  template = normalizeTemplate(template);
  const allRows = [template.headerRows || [], template.rows, template.footerRows || []].flat();
  validateTemplate({ ...template, rows: allRows });
  const renderRows = (rows) => rows.map((row) =>
    `<table style="width:100%;margin:0 0 8px;border-collapse:collapse;table-layout:fixed;"><tr>${
      row.columns.map((column) => {
        const width = 100 / row.columns.length;
        const content = column.controls
          .map((control) => templateControlMarkup(control, data, approvals, lineItems, requestName))
          .join("");
        return `<td style="width:${width}%;padding:0 5px;vertical-align:top;">${content}</td>`;
      }).join("")
    }</tr></table>`
  ).join("");
  const title = escapeHtml(formName?.trim() || template.name || "Paperless form");
  return `<div style="width:100%;padding:8px;box-sizing:border-box;font:12px 'Segoe UI',Arial,sans-serif;line-height:1.4;color:#1e293b;">
    <h1 style="margin:0 0 14px;padding:12px;background:#1b365d;color:#fff;font-size:19px;">${title}</h1>
    ${renderRows(template.headerRows || [])}
    ${renderRows(template.rows)}
    ${renderRows(template.footerRows || [])}
  </div>`;
}

function parseJsonInput(value, name, { required = false, expectedArray = false, allowArray = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new TypeError(`${name} is required.`);
    }
    return expectedArray ? [] : {};
  }

  let parsed = value;
  for (let depth = 0; typeof parsed === "string" && depth < 2; depth += 1) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      if (depth === 0) {
        throw new TypeError(`${name} must contain valid JSON.`);
      }
      break;
    }
  }

  if (expectedArray ? !Array.isArray(parsed) : (
    !parsed || typeof parsed !== "object" || (!allowArray && Array.isArray(parsed))
  )) {
    throw new TypeError(`${name} must be a ${expectedArray ? "JSON array" : allowArray ? "JSON object or array" : "JSON object"}.`);
  }
  return parsed;
}

export function canonicalFormType(value) {
  const normalized = normalizedKey(value);
  if (normalized.includes("materialtakeout") || normalized.startsWith("materialmvp")) {
    return "material";
  }
  if (normalized === "capexmvp" || normalized === "capex") {
    return "capex";
  }
  if (normalized.includes("capexform") || normalized.startsWith("capexv")) {
    return normalized.includes("v1") ? "capex-v1" : normalized.includes("v3") ? "capex-v3" : "capex";
  }
  throw new TypeError(`Unsupported formType "${value}". Supported values: capex, capex-v1, capex-v3, material-take-out.`);
}

function findFormData(formValues, formType) {
  if (formType === "material") {
    const key = Object.keys(formValues).find((name) =>
      normalizedKey(name) === "materialtakeoutform" || normalizedKey(name) === "materialtakeout"
    );
    return key ? formValues[key] : formValues;
  }

  const requestedVersion = formType === "capex-v1" ? "capexformv1" : "capexformv3";
  const keys = Object.keys(formValues);
  const exact = keys.find((name) => normalizedKey(name) === requestedVersion);
  if (exact) {
    return formValues[exact];
  }
  if (formType !== "capex") {
    throw new TypeError(`JsonFormValue does not contain ${formType.replace("-", " ")} data.`);
  }
  const fallback = ["capexformv3", "capexformv1"]
    .map((wanted) => keys.find((name) => normalizedKey(name) === wanted))
    .find((name) => name !== undefined);
  return fallback ? formValues[fallback] : formValues;
}

function findDynamicFormData(formValues) {
  if (Array.isArray(formValues)) return formValues;
  const keys = Object.keys(formValues);
  const wrapper = keys.find((name) =>
    normalizedKey(name) === "materialtakeoutform" ||
    normalizedKey(name) === "materialtakeout" ||
    normalizedKey(name) === "capexformv1" ||
    normalizedKey(name) === "capexformv3"
  );
  return wrapper ? formValues[wrapper] : formValues;
}

export function renderForm(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("Request body must be a JSON object.");
  }
  const requestedType = readField(request, ["FormType", "formType"]);
  if (typeof requestedType !== "string" || requestedType.trim() === "") {
    throw new TypeError("formType is required.");
  }

  const isDynamic = normalizedKey(requestedType) === "dynamic";
  const formCode = readField(request, ["FormCode", "formCode"])
    ?? (request.FormType === undefined ? requestedType : undefined);
  if (!isDynamic && (typeof formCode !== "string" || formCode.trim() === "")) {
    throw new TypeError("FormCode is required when FormType is not Dynamic.");
  }
  const formType = isDynamic ? "material" : canonicalFormType(formCode);
  const formValues = parseJsonInput(
    readField(request, ["JsonFormValue", "formValue"]),
    "JsonFormValue",
    { required: true, allowArray: isDynamic || formType === "material" },
  );
  const data = isDynamic ? findDynamicFormData(formValues) : findFormData(formValues, formType);
  if (!data || typeof data !== "object" || (Array.isArray(data) && !isDynamic && formType !== "material")) {
    throw new TypeError("The selected form data must be a JSON object or a Material Takeout field array.");
  }
  const approvals = parseJsonInput(
    readField(request, ["JsonApprovalLine", "approvalLines"]),
    "JsonApprovalLine",
    { expectedArray: true },
  );
  const lineItems = lineItemsFrom(request, data);

  const suppliedTemplate = readField(request, ["JsonTemplate", "template"]);
  if (isDynamic) {
    if (suppliedTemplate === undefined) {
      throw new TypeError("JsonTemplate is required when FormType is Dynamic.");
    }
    const formName = readField(request, ["FormName", "formName"]);
    if (formName !== undefined && typeof formName !== "string") {
      throw new TypeError("FormName must be a string.");
    }
    const requestName = readField(request, ["RequestName", "requestName"]);
    if (requestName !== undefined && typeof requestName !== "string") {
      throw new TypeError("RequestName must be a string.");
    }
    const template = parseJsonInput(suppliedTemplate, "JsonTemplate");
    return templateHtml(data, approvals, lineItems, template, formName, requestName);
  }
  if (request.template !== undefined) {
    const formName = readField(request, ["FormName", "formName"]);
    if (formName !== undefined && typeof formName !== "string") {
      throw new TypeError("FormName must be a string.");
    }
    const requestName = readField(request, ["RequestName", "requestName"]);
    if (requestName !== undefined && typeof requestName !== "string") {
      throw new TypeError("RequestName must be a string.");
    }
    const template = parseJsonInput(request.template, "template");
    return templateHtml(data, approvals, lineItems, template, formName, requestName);
  }
  return formType === "material"
    ? materialHtml(data, approvals, lineItems)
    : capexHtml(data, approvals, lineItems);
}
