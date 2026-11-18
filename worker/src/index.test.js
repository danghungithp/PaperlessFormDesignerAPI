import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./index.js";
import { renderForm } from "./render.js";
import { withSavedTemplate } from "./template-client.js";
import { fromFormSchema, toFormSchema } from "../public/designer-schema.mjs";
import renderPdfHandler from "../api/render-pdf.js";
import vercelRenderHandler from "../api/render.js";

const require = createRequire(import.meta.url);
process.env.CHROMIUM_BIN_DIR ??= resolve(
  dirname(fileURLToPath(import.meta.resolve("@sparticuz/chromium"))),
  "../bin",
);
const rootVercelPdfHandler = require("../../api/render-pdf.js");
const rootVercelRenderHandler = require("../../api/render.js");
const rootVercelTemplatesHandler = require("../../api/templates.js");
const rootVercelLoginHandler = require("../../api/auth/login.js");
const rootVercelSessionHandler = require("../../api/auth/session.js");
const rootVercelLogoutHandler = require("../../api/auth/logout.js");
const postgresTemplateStore = require("../../api/postgres-template-store.js");

function createTemplateDatabase() {
  const records = new Map();
  return {
    prepare(statement) {
      const sql = statement.replace(/\s+/g, " ").trim();
      return {
        async all() {
          return { results: [...records.values()] };
        },
        bind(...values) {
          if (sql.startsWith("INSERT INTO form_templates")) {
            return {
              async run() {
                records.set(values[0], {
                  form_type: values[0],
                  name: values[1],
                  template_json: values[2],
                  updated_at: "2026-11-16 00:00:00",
                });
              },
            };
          }
          if (sql.includes("WHERE form_type = ?")) {
            return {
              async first() {
                return records.get(values[0]) ?? null;
              },
            };
          }
          return {};
        },
      };
    },
  };
}

const capexRequest = {
  formType: "capex-v3",
  JsonFormValue: {
    _CapexFormV1: { Dropdown1: "Production Machinery" },
    _CapexFormV3: {
      drpAccquisitionType: "Buy",
      drpAssetClass: "Building and structures",
      dteDateOfExpectedReceipt: "2026-11-13",
      dteDateOfRequest: "2026-11-09",
      txtAssetDescription: "Test equipment",
      txtPurchasePrice: "136",
      txtQuantity: "4",
      txtRequisitionerName: "Test User",
      txtUnitPrice: "34",
      txtUsefulLifeYears: "2",
    },
  },
  JsonApprovalLine: [
    {
      ApprovalStepOrder: 2,
      ApproverEmail: "second@example.test",
      ActionDate: "2026-11-10T09:00:00.000Z",
      Status: "Pending",
    },
    {
      ApprovalStepOrder: 1,
      ApproverEmail: "first@example.test",
      ActionDate: "2026-11-09T09:00:00.000Z",
      Status: "Approved",
    },
  ],
};

test("renders selected CAPEX version and escapes values", () => {
  const html = renderForm({
    ...capexRequest,
    JsonFormValue: JSON.stringify(capexRequest.JsonFormValue),
    JsonApprovalLine: JSON.stringify(capexRequest.JsonApprovalLine),
    formType: "_CapexFormV3",
  });

  assert.match(html, /Building and structures/);
  assert.match(html, /2026-11-13/);
  assert.match(html, /Purchase Price/);
  assert.match(html, /136/);
  assert.doesNotMatch(html, /Production Machinery/);
  assert.match(html, /first@example\.test[\s\S]*second@example\.test/);
  assert.match(html, /<table[^>]*table-layout:fixed/);

  const escaped = renderForm({
    formType: "capex",
    JsonFormValue: { _CapexFormV3: { txtAssetDescription: "<script>alert(1)</script>" } },
  });
  assert.match(escaped, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(escaped, /<script>/);
});

test("generic CAPEX form type prefers V3 when both versions are present", () => {
  const html = renderForm({
    formType: "capex",
    JsonFormValue: {
      _CapexFormV1: { Dropdown1: "V1 value" },
      _CapexFormV3: { txtAssetDescription: "V3 value" },
    },
  });

  assert.match(html, /V3 value/);
  assert.doesNotMatch(html, /V1 value/);
});

test("renders material fields and flexible line-item JSON", () => {
  const html = renderForm({
    formType: "MaterialTakeoutForm",
    JsonFormValue: {
      MaterialTakeoutForm: { InpRequestTitle: "Materials <urgent>" },
    },
    lineItems: [{
      cells: [
        { columnKey: "partno", value: "A-1" },
        { columnKey: "description", value: "<bolt>" },
        { columnKey: "quanity", value: "1" },
        { columnKey: "note", value: "Keep dry" },
      ],
      rowId: "row-1",
      rowOrder: 10,
    }],
  });

  assert.match(html, /Request Information/);
  assert.match(html, /Material Take Out \/ Phiếu mang vật tư ra ngoài/);
  assert.match(html, /&lt;urgent&gt;/);
  assert.match(html, /LIST OF MATERIAL/);
  assert.match(html, /Part Number/);
  assert.match(html, /&lt;bolt&gt;/);
  assert.match(html, /Keep dry/);
});

test("accepts Power Automate JSON values encoded as strings twice", () => {
  const html = renderForm({
    formType: "_CapexFormV3",
    JsonFormValue: JSON.stringify(JSON.stringify({
      _CapexFormV3: { txtAssetDescription: "Double-encoded Power Automate value" },
    })),
    JsonApprovalLine: JSON.stringify(JSON.stringify([])),
    lineItems: JSON.stringify(JSON.stringify([{
      cells: [{ columnKey: "partno", value: "A-1" }],
      rowOrder: 1,
    }])),
  });

  assert.match(html, /Double-encoded Power Automate value/);
  assert.match(html, /A-1/);
});

test("renders Material Takeout field arrays using supplied labels and values", () => {
  const fields = [
    { FieldKey: "department", FieldLabel: "department", FieldType: "choice", FieldValue: "Project" },
    { FieldKey: "materialtype", FieldLabel: "Material Type", FieldType: "choice", FieldValue: "Other" },
    { FieldKey: "description", FieldLabel: "Reason", FieldType: "multiline", FieldValue: "test" },
  ];
  const html = renderForm({
    formType: "material-take-out",
    JsonFormValue: JSON.stringify(JSON.stringify(fields)),
    JsonApprovalLine: [
      {
        ApprovalLevelID: 12,
        ApprovalStepOrder: 1,
        ApproverEmail: "first@example.test",
        State: "Department Manager review",
        Status: "Processing",
        ActionDate: "2026-11-11T07:16:40.000Z",
      },
      {
        ApprovalLevelID: 27,
        ApprovalStepOrder: 2,
        ApproverEmail: "second@example.test",
        State: "Material take out managers",
        Status: "Todo",
        Modified: "2026-11-11T07:16:44.000Z",
      },
    ],
    lineItems: [{
      cells: [
        { columnKey: "partno", value: "A00001" },
        { columnKey: "description", value: "Material item" },
        { columnKey: "quanity", value: "1" },
        { columnKey: "note", value: "Test note" },
      ],
      rowId: "row-1",
      rowOrder: 1,
    }],
  });

  assert.match(html, /department/);
  assert.match(html, /Project/);
  assert.match(html, /Material Type/);
  assert.match(html, /Other/);
  assert.match(html, /Reason/);
  assert.match(html, />test</);
  assert.match(html, /LIST OF MATERIAL/);
  assert.match(html, /Part Number/);
  assert.match(html, /Part Description/);
  assert.match(html, /Quanity/);
  assert.match(html, /A00001/);
  assert.match(html, /Material item/);
  assert.match(html, /APPROVAL LINE/);
  assert.match(html, /Department Manager review[\s\S]*first@example\.test[\s\S]*Material take out managers[\s\S]*second@example\.test/);
  assert.match(html, /<span[^>]*>Processing<\/span>/);
  assert.match(html, /<span[^>]*>Todo<\/span>/);
  assert.doesNotMatch(html, /<span[^>]*>Department Manager review<\/span>/);
  assert.match(html, /2026-11-11 07:16:44 UTC/);
  assert.match(html, /width:100%;height:auto;max-width:none/);
  assert.doesNotMatch(html, /zoom:/);
  assert.ok(html.indexOf("LIST OF MATERIAL") < html.indexOf("APPROVAL LINE"));
});

test("renders saved templates with data fields, layouts, line items, and escaped text", () => {
  const html = renderForm({
    FormType: "Dynamic",
    FormName: "Material request from flow",
    JsonFormValue: JSON.stringify(JSON.stringify([
      { FieldKey: "department", FieldLabel: "Department", FieldValue: "Finance" },
      { FieldKey: "reason", FieldLabel: "Reason", FieldValue: "<script>not markup</script>" },
    ])),
    lineItems: [{
      cells: [{ columnKey: "partno", value: "A-10" }, { columnKey: "description", value: "Bolt" }],
    }],
    JsonApprovalLine: [{ ApprovalStepOrder: 1, ApproverEmail: "manager@example.test", Status: "Todo" }],
    JsonTemplate: {
      name: "Custom request",
      rows: [
        { columns: [{ controls: [{ type: "heading", text: "Request details" }] }] },
        { columns: [
          { controls: [{ type: "field", fieldKey: "department", label: "Department" }] },
          { controls: [{ type: "field", fieldKey: "reason", label: "Reason", multiline: true }] },
        ] },
        { columns: [{ controls: [{ type: "lineItems", columns: [
          { key: "partno", label: "Part number" },
          { key: "description", label: "Description" },
        ] }] }] },
        { columns: [{ controls: [{ type: "approvals", title: "Do not use template approval placement" }] }] },
      ],
    },
  });

  assert.match(html, /Material request from flow/);
  assert.doesNotMatch(html, />Custom request<\/h1>/);
  assert.match(html, /Finance/);
  assert.match(html, /&lt;script&gt;not markup&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>not markup/);
  assert.match(html, /A-10/);
  assert.match(html, /manager@example\.test/);
  assert.match(html, /LINE ITEMS/);
  assert.match(html, /Do not use template approval placement/);
  assert.equal((html.match(/LINE ITEMS/g) ?? []).length, 1);
  assert.ok(html.indexOf("A-10") < html.indexOf("Do not use template approval placement"));
  assert.equal((html.match(/<th[^>]*>Approval step<\/th>/g) ?? []).length, 1);
});

test("uses FormName for the Dynamic print title and validates its type", () => {
  const request = {
    FormType: "Dynamic",
    FormName: "Request <April>",
    JsonFormValue: [],
    JsonTemplate: {
      schemaVersion: "1.1",
      formCode: "MATERIAL_TAKE_OUT",
      formName: "Template title",
      formVersion: 1,
      sections: [],
      fields: [],
    },
  };
  const html = renderForm(request);
  assert.match(html, /Request &lt;April&gt;/);
  assert.doesNotMatch(html, />Template title<\/h1>/);
  assert.throws(() => renderForm({ ...request, FormName: { value: "invalid" } }), /FormName must be a string/);
});

test("uses RequestName for the Request Information heading only", () => {
  const html = renderForm({
    FormType: "Dynamic",
    FormName: "Material take out",
    RequestName: "Material issue details",
    JsonFormValue: [{ FieldKey: "department", FieldValue: "Finance" }],
    JsonTemplate: {
      schemaVersion: "1.1",
      formCode: "MATERIAL_TAKE_OUT",
      formName: "Template title",
      formVersion: 1,
      sections: [{ key: "requestInfo", title: "Request Information", order: 10, visible: true }],
      fields: [{
        key: "department",
        label: "Department",
        type: "text",
        section: "requestInfo",
        layout: { mode: "horizontal", row: 1, column: 1 },
      }],
    },
  });
  assert.match(html, /<h1[^>]*>Material take out<\/h1>/);
  assert.match(html, /<h2[^>]*>Material issue details<\/h2>/);
  assert.doesNotMatch(html, />Request Information<\/h2>/);

  assert.throws(() => renderForm({
    FormType: "Dynamic",
    RequestName: ["invalid"],
    JsonFormValue: [],
    JsonTemplate: { schemaVersion: "1.1", formCode: "MATERIAL_TAKE_OUT", fields: [] },
  }), /RequestName must be a string/);
});

test("maps Document Type and Material Type by their exact FieldKey", () => {
  const html = renderForm({
    FormType: "Dynamic",
    JsonFormValue: JSON.stringify([
      { FieldKey: "department", FieldValue: "Finance" },
      { FieldKey: "documenttype", FieldValue: "Intercompany Transfer" },
      { FieldKey: "materialtype", FieldValue: "InventoryPart" },
    ]),
    JsonTemplate: {
      schemaVersion: "1.1",
      formCode: "MATERIAL_TAKE_OUT",
      formName: "Form designer",
      formVersion: 1,
      sections: [{ key: "requestInfo", title: "Request Information", visible: true }],
      fields: [
        { key: "documenttype", label: "Document Type", type: "choice", section: "requestInfo", layout: { row: 1, column: 2 } },
        { key: "materialtype", label: "Material Type", type: "choice", section: "requestInfo", layout: { row: 1, column: 3 } },
      ],
      printLayout: {
        header: [],
        body: [{ columns: [
          { controls: [{ type: "field", fieldKey: "documenttype", label: "Document Type" }] },
          { controls: [{ type: "field", fieldKey: "materialtype", label: "Material Type" }] },
        ] }],
        footer: [],
      },
    },
  });

  assert.match(html, /Form designer/);
  assert.match(html, /font-size:10px;">Document Type<\/div>\s*<div[^>]*>Intercompany Transfer<\/div>/);
  assert.match(html, /font-size:10px;">Material Type<\/div>\s*<div[^>]*>InventoryPart<\/div>/);
  assert.doesNotMatch(html, /font-size:10px;">Document Type<\/div>\s*<div[^>]*>InventoryPart<\/div>/);
  assert.doesNotMatch(html, /font-size:10px;">Material Type<\/div>\s*<div[^>]*>Intercompany Transfer<\/div>/);
});

test("renders only the data tables explicitly included in the Dynamic template", () => {
  const baseRequest = {
    FormType: "Dynamic",
    JsonFormValue: [{ FieldKey: "department", FieldValue: "Finance" }],
    lineItems: [{ cells: [{ columnKey: "partno", value: "MAT-001" }] }],
    JsonApprovalLine: [{ State: "Manager approval", ApproverEmail: "manager@example.test", Status: "Todo" }],
  };
  const fieldsOnly = {
    schemaVersion: "1.1",
    formCode: "MATERIAL_TAKE_OUT",
    formName: "Fields only",
    formVersion: 1,
    sections: [],
    fields: [],
    printLayout: {
      header: [],
      body: [{ columns: [{ controls: [{ type: "field", fieldKey: "department", label: "Department" }] }] }],
      footer: [],
    },
  };
  const htmlWithoutTables = renderForm({ ...baseRequest, JsonTemplate: fieldsOnly });
  assert.match(htmlWithoutTables, /Finance/);
  assert.doesNotMatch(htmlWithoutTables, /LINE ITEMS|APPROVAL LINE|MAT-001|manager@example\.test/);

  const htmlWithOnlyApprovals = renderForm({
    ...baseRequest,
    JsonTemplate: {
      ...fieldsOnly,
      printLayout: {
        ...fieldsOnly.printLayout,
        footer: [{ columns: [{ controls: [{ type: "approvals", title: "Approvals only" }] }] }],
      },
    },
  });
  assert.match(htmlWithOnlyApprovals, /Approvals only/);
  assert.match(htmlWithOnlyApprovals, /manager@example\.test/);
  assert.doesNotMatch(htmlWithOnlyApprovals, /MAT-001|LINE ITEMS/);
});

test("exports designer fields as schemaVersion 1.1 with sample field types and layout", () => {
  const schema = toFormSchema({
    name: "Material Take Out",
    formCode: "MATERIAL_TAKE_OUT",
    formVersion: 1,
    formType: "material-take-out",
    rows: [
      { columns: [{ controls: [{ type: "heading", text: "Material Take Out" }] }] },
      { columns: [
        { controls: [{
          type: "field", fieldKey: "department", label: "department", fieldType: "choice",
          section: "requestInfo", placeholder: "Select department", required: true,
          optionSource: "sharepoint", optionSet: "Department",
        }] },
        { controls: [{
          type: "field", fieldKey: "documenttype", label: "Document Type", fieldType: "choice",
          section: "requestInfo", placeholder: "Select Document Type", required: true,
          optionSource: "sharepoint", optionSet: "Documenttype",
        }] },
        { controls: [{
          type: "field", fieldKey: "materialtype", label: "Material Type", fieldType: "choice",
          section: "requestInfo", placeholder: "Select Material Type", required: true,
          optionSource: "sharepoint", optionSet: "Materialtype",
        }] },
      ] },
      { columns: [{ controls: [{
        type: "field", fieldKey: "description", label: "Reason", fieldType: "multiline",
        section: "requestInfo", placeholder: "enter reason", required: true,
      }] }] },
    ],
  });

  assert.equal(schema.schemaVersion, "1.1");
  assert.equal(schema.formCode, "MATERIAL_TAKE_OUT");
  assert.deepEqual(schema.sections, [{
    key: "requestInfo",
    title: "Request Information",
    description: "",
    order: 10,
    visible: true,
  }]);
  assert.deepEqual(schema.fields.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    section: field.section,
    defaultValue: field.defaultValue,
    required: field.required,
    layout: field.layout,
  })), [
    { key: "department", label: "department", type: "choice", section: "requestInfo", defaultValue: "", required: true, layout: { mode: "horizontal", row: 1, column: 1 } },
    { key: "documenttype", label: "Document Type", type: "choice", section: "requestInfo", defaultValue: "", required: true, layout: { mode: "horizontal", row: 1, column: 2 } },
    { key: "materialtype", label: "Material Type", type: "choice", section: "requestInfo", defaultValue: "", required: true, layout: { mode: "horizontal", row: 1, column: 3 } },
    { key: "description", label: "Reason", type: "multiline", section: "requestInfo", defaultValue: "", required: true, layout: { mode: "vertical", row: 2, column: 1 } },
  ]);
  assert.equal(schema.printLayout.header.length, 0);
  assert.equal(schema.printLayout.body.length, 3);
  assert.equal(schema.printLayout.footer.length, 0);
});

test("exports, imports, and renders movable header, table, and footer controls", () => {
  const source = {
    name: "Printable request",
    formCode: "MATERIAL_TAKE_OUT",
    formType: "material-take-out",
    rows: [
      { columns: [{ controls: [{ id: "details", type: "field", fieldKey: "department", label: "Department" }] }] },
    ],
    headerRows: [
      { columns: [{ controls: [
        { id: "logo", type: "image", src: "data:image/png;base64,AAAA", alt: "Company logo", width: 100 },
        { id: "timestamp", type: "dateTime", label: "Generated", format: "datetime" },
      ] }] },
    ],
    footerRows: [
      { columns: [{ controls: [
        { id: "items", type: "lineItems", title: "Requested materials" },
        { id: "approvals", type: "approvals", title: "Approval history" },
        { id: "footer-note", type: "text", text: "Internal use" },
      ] }] },
    ],
  };
  const schema = toFormSchema(source);
  const imported = fromFormSchema(schema);
  assert.equal(imported.headerRows[0].columns[0].controls[0].type, "image");
  assert.equal(imported.footerRows[0].columns[0].controls[1].type, "approvals");
  assert.deepEqual(schema.printLayout.footer[0].columns[0].controls.map((control) => control.type), [
    "lineItems", "approvals", "text",
  ]);

  const html = renderForm({
    FormType: "Dynamic",
    JsonFormValue: [{ FieldKey: "department", FieldValue: "Finance" }],
    lineItems: [{ cells: [{ columnKey: "partno", value: "MAT-001" }] }],
    JsonApprovalLine: [{ State: "Manager approval", ApproverEmail: "manager@example.test", Status: "Todo" }],
    JsonTemplate: schema,
  });
  assert.match(html, /data:image\/png;base64,AAAA/);
  assert.match(html, /Generated:/);
  assert.match(html, /Requested materials/);
  assert.match(html, /MAT-001/);
  assert.match(html, /Approval history/);
  assert.match(html, /manager@example\.test/);
  assert.match(html, /Internal use/);
  assert.ok(html.indexOf("Company logo") < html.indexOf("Finance"));
  assert.ok(html.indexOf("MAT-001") < html.indexOf("Internal use"));
});

test("imports exported form schema into designer rows and renders a schema template", () => {
  const schema = {
    schemaVersion: "1.1",
    formCode: "MATERIAL_TAKE_OUT",
    formName: "Material form",
    formVersion: 1,
    sections: [{ key: "requestInfo", title: "Request Information", description: "", order: 10, visible: true }],
    fields: [
      { key: "department", label: "department", type: "choice", section: "requestInfo", defaultValue: "", placeholder: "Select department", required: true, visible: true, order: 10, optionSource: "sharepoint", optionSet: "Department", parentField: "", options: [], layout: { mode: "horizontal", row: 1, column: 1 } },
      { key: "materialtype", label: "Material Type", type: "choice", section: "requestInfo", defaultValue: "", placeholder: "Select Material Type", required: true, visible: true, order: 10, optionSource: "sharepoint", optionSet: "Materialtype", parentField: "", options: [], layout: { mode: "horizontal", row: 1, column: 2 } },
      { key: "description", label: "Reason", type: "multiline", section: "requestInfo", defaultValue: "", placeholder: "enter reason", required: true, visible: true, order: 20, optionSource: "", optionSet: "", parentField: "", options: [], layout: { mode: "vertical", row: 2, column: 1 } },
    ],
  };
  const imported = fromFormSchema(schema);
  assert.equal(imported.rows.length, 2);
  assert.equal(imported.rows[0].columns.length, 2);
  assert.equal(imported.rows[1].columns[0].controls[0].fieldKey, "description");

  const html = renderForm({
    FormType: "Dynamic",
    JsonFormValue: JSON.stringify([
      { FieldKey: "department", FieldValue: "Finance" },
      { FieldKey: "materialtype", FieldValue: "InventoryPart" },
      { FieldKey: "description", FieldValue: "Reason sample" },
    ]),
    JsonTemplate: JSON.stringify(schema),
  });
  assert.match(html, /Material form/);
  assert.match(html, /Finance/);
  assert.match(html, /InventoryPart/);
  assert.match(html, /Reason sample/);
});

test("render API accepts a Power Automate JsonTemplate string alongside form outputs", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      FormType: "Dynamic",
      JsonFormValue: JSON.stringify([
        { FieldKey: "department", FieldValue: "Finance output" },
        { FieldKey: "materialtype", FieldValue: "InventoryPart output" },
        { FieldKey: "description", FieldValue: "Power Automate reason" },
      ]),
      JsonApprovalLine: "[]",
      lineItems: "[]",
      JsonTemplate: JSON.stringify({
        schemaVersion: "1.1",
        formCode: "MATERIAL_TAKE_OUT",
        formName: "Flow-provided template",
        formVersion: 1,
        sections: [{ key: "requestInfo", title: "Request Information", order: 10, visible: true }],
        fields: [
          { key: "department", label: "Department", type: "choice", section: "requestInfo", layout: { mode: "horizontal", row: 1, column: 1 } },
          { key: "materialtype", label: "Material Type", type: "choice", section: "requestInfo", layout: { mode: "horizontal", row: 1, column: 2 } },
          { key: "description", label: "Reason", type: "multiline", section: "requestInfo", layout: { mode: "vertical", row: 2, column: 1 } },
        ],
      }),
    }),
  }));

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Flow-provided template/);
  assert.match(html, /Finance output/);
  assert.match(html, /InventoryPart output/);
  assert.match(html, /Power Automate reason/);
});

test("rejects malformed or unsupported saved template controls", () => {
  assert.throws(() => renderForm({
    FormType: "Dynamic",
    JsonFormValue: {},
    JsonTemplate: { rows: [{ columns: [{ controls: [{ type: "script", text: "bad" }] }] }] },
  }), /Unsupported template control/);
});

test("uses JsonTemplate only for Dynamic and selects static forms by FormCode", () => {
  const html = renderForm({
    FormType: "Standard",
    FormCode: "CAPEX_MVP",
    JsonFormValue: {
      _CapexFormV3: { txtAssetDescription: "Static CAPEX from FormCode" },
    },
    JsonTemplate: "not a valid template and must be ignored",
  });

  assert.match(html, /CAPITAL EXPENDITURE REQUEST/);
  assert.match(html, /Static CAPEX from FormCode/);
  assert.doesNotMatch(html, /not a valid template/);

  assert.throws(() => renderForm({
    FormType: "Dynamic",
    JsonFormValue: [{ FieldKey: "department", FieldValue: "Finance" }],
  }), /JsonTemplate is required when FormType is Dynamic/);
  assert.throws(() => renderForm({
    FormType: "Standard",
    JsonFormValue: {},
  }), /FormCode is required when FormType is not Dynamic/);
});

test("keeps all approval rows in a fluid HTML layout", () => {
  const approvals = Array.from({ length: 30 }, (_, index) => ({
    ApprovalStepOrder: index + 1,
    ApproverEmail: `approver${index}@example.test`,
    Status: "Todo",
  }));
  const html = renderForm({
    formType: "material-take-out",
    JsonFormValue: {
      MaterialTakeoutForm: {
        department: "Project",
        materialtype: "Other",
        reason: "Request",
      },
    },
    JsonApprovalLine: approvals,
  });

  assert.match(html, /width:100%;height:auto;max-width:none/);
  assert.match(html, /approver29@example\.test/);
});

test("returns clear API errors for invalid input and unknown routes", async () => {
  const missingType = await worker.fetch(new Request("https://example.test/api/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ JsonFormValue: {} }),
  }));
  assert.equal(missingType.status, 400);
  assert.match((await missingType.json()).error, /formType is required/);

  const unsupported = await worker.fetch(new Request("https://example.test/api/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formType: "unknown", JsonFormValue: {} }),
  }));
  assert.equal(unsupported.status, 400);

  const notFound = await worker.fetch(new Request("https://example.test/not-found"));
  assert.equal(notFound.status, 404);
});

test("renders a fragment with the expected API response headers", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      formType: "MaterialTakeoutForm",
      JsonFormValue: { MaterialTakeoutForm: { InpRequestTitle: "sample" } },
    }),
  }));

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /text\/html/);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(await response.text(), /sample/);
});

test("serves the designer and its static assets from the Worker asset binding", async () => {
  const assetResponse = new Response("designer asset");
  const response = await worker.fetch(new Request("https://example.test/designer.js"), {
    ASSETS: { fetch: async (request) => {
      assert.equal(new URL(request.url).pathname, "/designer.js");
      return assetResponse;
    } },
  });

  assert.equal(response, assetResponse);
  assert.equal(await response.text(), "designer asset");
});

test("saves, lists, and resolves D1 templates by formType with protected writes", async () => {
  const database = createTemplateDatabase();
  const env = {
    DB: database,
    TEMPLATE_ADMIN_PASSWORD: "correct horse battery staple 123",
    TEMPLATE_SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  };
  const template = {
    name: "Saved material form",
    rows: [{ columns: [{ controls: [{ type: "field", fieldKey: "department", label: "Department" }] }] }],
  };
  const login = await worker.fetch(new Request("https://example.test/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://example.test",
    },
    body: JSON.stringify({ password: env.TEMPLATE_ADMIN_PASSWORD }),
  }), env);
  assert.equal(login.status, 200);
  const cookie = login.headers.get("Set-Cookie").split(";")[0];

  const crossOriginSave = await worker.fetch(new Request("https://example.test/api/templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.example",
      Cookie: cookie,
    },
    body: JSON.stringify({ formType: "material-take-out", template }),
  }), env);
  assert.equal(crossOriginSave.status, 403);

  const unauthorized = await worker.fetch(new Request("https://example.test/api/templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://example.test",
    },
    body: JSON.stringify({ formType: "material-take-out", template }),
  }), env);
  assert.equal(unauthorized.status, 401);

  const saved = await worker.fetch(new Request("https://example.test/api/templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://example.test",
      Cookie: cookie,
    },
    body: JSON.stringify({ formType: "material-take-out", template }),
  }), env);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).template.name, "Saved material form");

  const list = await worker.fetch(new Request("https://example.test/api/templates", {
    headers: { Cookie: cookie },
  }), env);
  assert.equal(list.status, 200, await list.clone().text());
  const templates = await list.json();
  assert.equal(templates.templates.length, 1);
  assert.equal(templates.templates[0].formType, "material-take-out");

  const render = await worker.fetch(new Request("https://example.test/api/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      formType: "MaterialTakeoutForm",
      JsonFormValue: { MaterialTakeoutForm: { department: "Finance from flow" } },
    }),
  }), env);
  assert.equal(render.status, 200);
  assert.match(await render.text(), /Finance from flow/);

  const overwritten = await worker.fetch(new Request("https://example.test/api/templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://example.test",
      Cookie: cookie,
    },
    body: JSON.stringify({
      formType: "MaterialTakeoutForm",
      template: { ...template, name: "Updated material form" },
    }),
  }), env);
  assert.equal(overwritten.status, 200);
  const updatedList = await worker.fetch(new Request("https://example.test/api/templates", {
    headers: { Cookie: cookie },
  }), env);
  const updated = await updatedList.json();
  assert.equal(updated.templates.length, 1);
  assert.equal(updated.templates[0].name, "Updated material form");

  const logout = await worker.fetch(new Request("https://example.test/api/auth/logout", {
    method: "POST",
    headers: { Origin: "https://example.test", Cookie: cookie },
  }), env);
  assert.equal(logout.status, 200);
  const expiredSession = await worker.fetch(new Request("https://example.test/api/auth/session", {
    headers: { Cookie: logout.headers.get("Set-Cookie").split(";")[0] },
  }), env);
  assert.equal((await expiredSession.json()).authenticated, false);
});

test("PostgreSQL template store creates and upserts JSON templates", async () => {
  const records = new Map();
  const sql = (strings, ...values) => {
    const statement = strings.join(" ").replace(/\s+/g, " ").trim();
    if (statement.startsWith("CREATE TABLE")) return Promise.resolve([]);
    if (statement.startsWith("INSERT INTO form_templates")) {
      records.set(values[0], {
        form_type: values[0],
        name: values[1],
        template_json: JSON.parse(values[2]),
        updated_at: "2026-11-18T00:00:00.000Z",
      });
      return Promise.resolve([]);
    }
    if (statement.includes("WHERE form_type =")) {
      return Promise.resolve(records.has(values[0]) ? [records.get(values[0])] : []);
    }
    if (statement.includes("ORDER BY form_type")) {
      return Promise.resolve([...records.values()]);
    }
    throw new Error(`Unexpected SQL: ${statement}`);
  };
  const store = postgresTemplateStore.createPostgresTemplateStore(sql);

  const saved = await store.saveFormTemplate("material", "Saved form", {
    formType: "material-take-out",
    name: "Saved form",
    rows: [],
  });
  assert.equal(saved.formType, "material-take-out");
  assert.equal(saved.template.name, "Saved form");

  const updated = await store.saveFormTemplate("material", "Updated form", {
    formType: "material-take-out",
    name: "Updated form",
    rows: [],
  });
  assert.equal(updated.name, "Updated form");
  assert.equal((await store.listFormTemplates()).length, 1);
});

test("Vercel admin login grants a session for PostgreSQL template management", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousPassword = process.env.TEMPLATE_ADMIN_PASSWORD;
  const previousSecret = process.env.TEMPLATE_SESSION_SECRET;
  const originalSave = postgresTemplateStore.saveFormTemplate;
  process.env.DATABASE_URL = "postgres://test";
  process.env.TEMPLATE_ADMIN_PASSWORD = "correct horse battery staple 123";
  process.env.TEMPLATE_SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
  let savedFormType;
  postgresTemplateStore.saveFormTemplate = async (formType, name, template) => {
    savedFormType = formType;
    return { formType: template.formType, name, template, updatedAt: "2026-11-18T00:00:00.000Z" };
  };
  const createResponse = () => ({
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  });
  const body = {
    formType: "MaterialTakeoutForm",
    template: {
      name: "Saved from Vercel",
      rows: [{ columns: [{ controls: [{ type: "heading", text: "Request" }] }] }],
    },
  };

  try {
    const wrongPassword = createResponse();
    rootVercelLoginHandler({
      method: "POST",
      headers: { origin: "http://example.test", host: "example.test" },
      body: { password: "incorrect password" },
    }, wrongPassword);
    assert.equal(wrongPassword.statusCode, 401);

    const login = createResponse();
    rootVercelLoginHandler({
      method: "POST",
      headers: { origin: "http://example.test", host: "example.test" },
      body: { password: process.env.TEMPLATE_ADMIN_PASSWORD },
    }, login);
    assert.equal(login.statusCode, 200);
    assert.match(login.headers["Set-Cookie"], /HttpOnly; SameSite=Strict/);
    const cookie = login.headers["Set-Cookie"].split(";")[0];

    const session = createResponse();
    rootVercelSessionHandler({
      method: "GET",
      headers: { cookie },
    }, session);
    assert.equal(JSON.parse(session.body).authenticated, true);

    const inaccessibleList = createResponse();
    await rootVercelTemplatesHandler({
      method: "GET",
      url: "/api/templates",
      headers: { host: "example.test" },
    }, inaccessibleList);
    assert.equal(inaccessibleList.statusCode, 401);

    const unauthorized = createResponse();
    await rootVercelTemplatesHandler({
      method: "POST",
      headers: { origin: "http://example.test", host: "example.test" },
      body,
    }, unauthorized);
    assert.equal(unauthorized.statusCode, 401);

    const csrfAttempt = createResponse();
    await rootVercelTemplatesHandler({
      method: "POST",
      headers: {
        origin: "http://attacker.test",
        host: "example.test",
        cookie,
      },
      body,
    }, csrfAttempt);
    assert.equal(csrfAttempt.statusCode, 403);

    const saved = createResponse();
    await rootVercelTemplatesHandler({
      method: "POST",
      headers: {
        origin: "http://example.test",
        host: "example.test",
        cookie,
      },
      body,
    }, saved);
    assert.equal(saved.statusCode, 200);
    assert.equal(savedFormType, "material");
    assert.equal(JSON.parse(saved.body).template.name, "Saved from Vercel");

    const logout = createResponse();
    rootVercelLogoutHandler({
      method: "POST",
      headers: { origin: "http://example.test", host: "example.test" },
    }, logout);
    assert.equal(logout.statusCode, 200);
    assert.match(logout.headers["Set-Cookie"], /Max-Age=0/);
  } finally {
    postgresTemplateStore.saveFormTemplate = originalSave;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousPassword === undefined) delete process.env.TEMPLATE_ADMIN_PASSWORD;
    else process.env.TEMPLATE_ADMIN_PASSWORD = previousPassword;
    if (previousSecret === undefined) delete process.env.TEMPLATE_SESSION_SECRET;
    else process.env.TEMPLATE_SESSION_SECRET = previousSecret;
  }
});

test("Vercel render resolves saved PostgreSQL templates by lowercase formType", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const originalGet = postgresTemplateStore.getFormTemplate;
  process.env.DATABASE_URL = "postgres://test";
  let requestedFormType;
  postgresTemplateStore.getFormTemplate = async (formType) => {
    requestedFormType = formType;
    return {
      template: {
        name: "Saved template",
        rows: [{ columns: [{ controls: [{ type: "heading", text: "Loaded from PostgreSQL" }] }] }],
      },
    };
  };
  try {
    const request = await withSavedTemplate({
      formType: "MaterialTakeoutForm",
      JsonFormValue: { MaterialTakeoutForm: {} },
    });
    assert.equal(requestedFormType, "material");
    assert.equal(request.template.name, "Saved template");
    assert.match(renderForm(request), /Loaded from PostgreSQL/);
  } finally {
    postgresTemplateStore.getFormTemplate = originalGet;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test("Vercel function renders HTML and handles invalid request bodies", async () => {
  function mockResponse() {
    return {
      headers: {},
      statusCode: 200,
      body: undefined,
      setHeader(name, value) {
        this.headers[name] = value;
      },
      end(body) {
        this.body = body;
      },
    };
  }

  const success = mockResponse();
  await vercelRenderHandler({
    method: "POST",
    body: {
      formType: "MaterialTakeoutForm",
      JsonFormValue: { MaterialTakeoutForm: { InpRequestTitle: "Vercel test" } },
    },
  }, success);
  assert.equal(success.statusCode, 200);
  assert.match(success.headers["Content-Type"], /text\/html/);
  assert.match(success.body, /Vercel test/);

  const invalid = mockResponse();
  await vercelRenderHandler({ method: "POST", body: "{" }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test("repository-root Vercel function forwards to the shared renderer", async () => {
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  };

  await rootVercelRenderHandler({
    method: "POST",
    body: {
      formType: "MaterialTakeoutForm",
      JsonFormValue: { MaterialTakeoutForm: { InpRequestTitle: "Root deployment" } },
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["Content-Type"], /text\/html/);
  assert.match(response.body, /Root deployment/);
});

test("Vercel HTML renderer uses FormCode for explicit non-Dynamic FormType", async () => {
  const previousUrl = process.env.TEMPLATE_STORE_URL;
  const previousFetch = globalThis.fetch;
  process.env.TEMPLATE_STORE_URL = "https://worker.example";
  globalThis.fetch = async () => {
    throw new Error("Non-Dynamic FormType must not load a saved template.");
  };
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  };
  try {
    await vercelRenderHandler({
      method: "POST",
      body: {
        FormType: "Standard",
        FormCode: "CAPEX_MVP",
        JsonFormValue: { _CapexFormV3: { txtAssetDescription: "Static from FormCode" } },
      },
    }, response);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.TEMPLATE_STORE_URL;
    else process.env.TEMPLATE_STORE_URL = previousUrl;
  }

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /CAPITAL EXPENDITURE REQUEST/);
  assert.match(response.body, /Static from FormCode/);
});

test("Vercel template proxy forwards the authenticated session to the Worker", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousUrl = process.env.TEMPLATE_STORE_URL;
  const previousPassword = process.env.TEMPLATE_ADMIN_PASSWORD;
  const previousSecret = process.env.TEMPLATE_SESSION_SECRET;
  const previousFetch = globalThis.fetch;
  delete process.env.DATABASE_URL;
  process.env.TEMPLATE_STORE_URL = "https://worker.example";
  process.env.TEMPLATE_ADMIN_PASSWORD = "correct horse battery staple 123";
  process.env.TEMPLATE_SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
  const login = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end() {},
  };
  rootVercelLoginHandler({
    method: "POST",
    headers: { origin: "http://example.test", host: "example.test" },
    body: { password: process.env.TEMPLATE_ADMIN_PASSWORD },
  }, login);
  const cookie = login.headers["Set-Cookie"].split(";")[0];
  globalThis.fetch = async (input, options) => {
    assert.equal(String(input), "https://worker.example/api/templates?formType=material-take-out");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Cookie, cookie);
    assert.equal(options.headers.Origin, "https://worker.example");
    return new Response(JSON.stringify({ templates: [] }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  };
  try {
    await rootVercelTemplatesHandler({
      method: "POST",
      url: "/api/templates?formType=material-take-out",
      headers: {
        cookie,
        origin: "http://example.test",
        host: "example.test",
      },
      body: { formType: "material-take-out", template: { name: "Saved", rows: [] } },
    }, response);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousUrl === undefined) delete process.env.TEMPLATE_STORE_URL;
    else process.env.TEMPLATE_STORE_URL = previousUrl;
    if (previousPassword === undefined) delete process.env.TEMPLATE_ADMIN_PASSWORD;
    else process.env.TEMPLATE_ADMIN_PASSWORD = previousPassword;
    if (previousSecret === undefined) delete process.env.TEMPLATE_SESSION_SECRET;
    else process.env.TEMPLATE_SESSION_SECRET = previousSecret;
  }

  assert.equal(response.statusCode, 201);
  assert.deepEqual(JSON.parse(response.body), { templates: [] });
});

test("PDF endpoint returns HTML together with a valid A4 PDF", async () => {
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  };
  await renderPdfHandler({
    method: "POST",
    body: {
      formType: "_CapexFormV3",
      JsonFormValue: {
        _CapexFormV3: { txtAssetDescription: "PDF endpoint test" },
      },
      JsonApprovalLine: [],
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["Content-Type"], /application\/json/);
  const result = JSON.parse(response.body);
  assert.match(result.html, /PDF endpoint test/);
  assert.equal(result.pdfContentType, "application/pdf");
  assert.equal(result.pdfFileName, "paperless-capexformv3.pdf");
  assert.equal(result.paperSize, "A4");
  assert.equal(result.orientation, "portrait");
  assert.equal(Buffer.from(result.pdfBase64, "base64").subarray(0, 5).toString(), "%PDF-");
});

test("PDF endpoint uses the saved template for lowercase formType requests", async () => {
  const previousUrl = process.env.TEMPLATE_STORE_URL;
  const previousFetch = globalThis.fetch;
  process.env.TEMPLATE_STORE_URL = "https://worker.example";
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    assert.equal(url.searchParams.get("formType"), "_CapexFormV3");
    return new Response(JSON.stringify({
      template: {
        name: "Saved CAPEX print form",
        rows: [{ columns: [{ controls: [{ type: "field", fieldKey: "txtAssetDescription", label: "Asset description" }] }] }],
      },
    }), { headers: { "Content-Type": "application/json" } });
  };
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  };
  try {
    await renderPdfHandler({
      method: "POST",
      body: {
        formType: "_CapexFormV3",
        JsonFormValue: { _CapexFormV3: { txtAssetDescription: "Asset from flow" } },
      },
    }, response);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.TEMPLATE_STORE_URL;
    else process.env.TEMPLATE_STORE_URL = previousUrl;
  }

  assert.equal(response.statusCode, 200);
  const result = JSON.parse(response.body);
  assert.match(result.html, /Saved CAPEX print form/);
  assert.match(result.html, /Asset from flow/);
  assert.equal(Buffer.from(result.pdfBase64, "base64").subarray(0, 5).toString(), "%PDF-");
});

test("PDF endpoint accepts JsonTemplate from a Power Automate request", async () => {
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  };
  await renderPdfHandler({
    method: "POST",
    body: {
      FormType: "Dynamic",
      JsonFormValue: JSON.stringify([{ FieldKey: "department", FieldValue: "Flow department" }]),
      JsonApprovalLine: JSON.stringify(JSON.stringify([{
        ApprovalStepOrder: 1,
        State: "Department Manager review",
        ApproverEmail: "manager@example.test",
        Status: "Processing",
      }])),
      lineItems: JSON.stringify(JSON.stringify([{
        cells: [
          { columnKey: "partno", value: "FLOW-001" },
          { columnKey: "description", value: "Flow material" },
          { columnKey: "quanity", value: "2" },
        ],
        rowId: "flow-row-1",
        rowOrder: 1,
      }])),
      JsonTemplate: {
        schemaVersion: "1.1",
        formCode: "MATERIAL_TAKE_OUT",
        formName: "Flow PDF template",
        formVersion: 1,
        sections: [{ key: "requestInfo", title: "Request Information", order: 10, visible: true }],
        fields: [{
          key: "department",
          label: "Department",
          type: "choice",
          section: "requestInfo",
          layout: { mode: "horizontal", row: 1, column: 1 },
        }],
        printLayout: {
          header: [{ columns: [{ controls: [{ type: "heading", text: "Movable PDF header" }] }] }],
          body: [{ columns: [{ controls: [{ type: "field", fieldKey: "department", label: "Department" }] }] }],
          footer: [{ columns: [{ controls: [
            { type: "lineItems", title: "PDF line items", columns: [{ key: "partno", label: "Part number" }] },
            { type: "approvals", title: "PDF approvals" },
          ] }] }],
        },
      },
    },
  }, response);

  assert.equal(response.statusCode, 200);
  const result = JSON.parse(response.body);
  assert.ok(result.html.indexOf("Movable PDF header") < result.html.indexOf("Flow department"));
  assert.match(result.html, /Flow PDF template/);
  assert.match(result.html, /Flow department/);
  assert.match(result.html, /PDF line items/);
  assert.match(result.html, /FLOW-001/);
  assert.match(result.html, /PDF approvals/);
  assert.match(result.html, /manager@example\.test/);
  assert.equal(Buffer.from(result.pdfBase64, "base64").subarray(0, 5).toString(), "%PDF-");
});

test("PDF endpoint omits line items and approvals absent from the Dynamic template", async () => {
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  };
  await renderPdfHandler({
    method: "POST",
    body: {
      FormType: "Dynamic",
      JsonFormValue: [{ FieldKey: "department", FieldValue: "Finance" }],
      lineItems: [{ cells: [{ columnKey: "partno", value: "MAT-001" }] }],
      JsonApprovalLine: [{ ApproverEmail: "manager@example.test", Status: "Todo" }],
      JsonTemplate: {
        schemaVersion: "1.1",
        formCode: "MATERIAL_TAKE_OUT",
        formName: "No table template",
        formVersion: 1,
        sections: [],
        fields: [],
        printLayout: {
          header: [],
          body: [{ columns: [{ controls: [{ type: "field", fieldKey: "department", label: "Department" }] }] }],
          footer: [],
        },
      },
    },
  }, response);

  assert.equal(response.statusCode, 200);
  const result = JSON.parse(response.body);
  assert.match(result.html, /Finance/);
  assert.doesNotMatch(result.html, /LINE ITEMS|APPROVAL LINE|MAT-001|manager@example\.test/);
  assert.equal(Buffer.from(result.pdfBase64, "base64").subarray(0, 5).toString(), "%PDF-");
});

test("PDF endpoint uses FormCode for standard forms and ignores JsonTemplate", async () => {
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  };
  await renderPdfHandler({
    method: "POST",
    body: {
      FormType: "Standard",
      FormCode: "CAPEX_MVP",
      JsonFormValue: { _CapexFormV3: { txtAssetDescription: "Static PDF from FormCode" } },
      JsonTemplate: "not a valid template and must be ignored",
    },
  }, response);

  assert.equal(response.statusCode, 200);
  const result = JSON.parse(response.body);
  assert.match(result.html, /CAPITAL EXPENDITURE REQUEST/);
  assert.match(result.html, /Static PDF from FormCode/);
  assert.doesNotMatch(result.html, /not a valid template/);
  assert.equal(Buffer.from(result.pdfBase64, "base64").subarray(0, 5).toString(), "%PDF-");
});

test("PDF endpoint rejects invalid input without starting Chromium", async () => {
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  };
  await renderPdfHandler({ method: "POST", body: { formType: "unknown" } }, response);

  assert.equal(response.statusCode, 400);
  assert.match(JSON.parse(response.body).error, /Unsupported formType/);
});

test("PDF endpoint validates requested paper sizes before starting Chromium", async () => {
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  };
  await renderPdfHandler({
    method: "POST",
    body: {
      formType: "material-take-out",
      JsonFormValue: {},
      paperSize: "Tabloid",
    },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(JSON.parse(response.body).error, /paperSize must be A3, A4, A5/);
});

test("repository-root PDF function forwards to the PDF generator", async () => {
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    },
  };
  await rootVercelPdfHandler({
    method: "POST",
    body: {
      formType: "material-take-out",
      JsonFormValue: {
        MaterialTakeoutForm: { department: "Project" },
      },
      JsonApprovalLine: [],
      paperSize: "A3",
      orientation: "landscape",
    },
  }, response);

  assert.equal(response.statusCode, 200);
  const result = JSON.parse(response.body);
  assert.match(result.html, /Project/);
  assert.equal(result.paperSize, "A3");
  assert.equal(result.orientation, "landscape");
  assert.equal(Buffer.from(result.pdfBase64, "base64").subarray(0, 5).toString(), "%PDF-");
});
