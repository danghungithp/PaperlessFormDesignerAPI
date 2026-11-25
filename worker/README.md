# Paperless Form Renderer

Cloudflare Worker and Vercel Serverless Function API that renders CAPEX and
Material Takeout form data as HTML or PDF. D1 stores saved template
configurations for the Cloudflare Worker deployment; the repository-root
Vercel deployment can use PostgreSQL for saved templates. The Worker does not
persist submitted form values. PDF requests send the rendered HTML to Cloudflare
Browser Run for PDF generation.

## Design and save print templates

Open the deployed site root (or `http://localhost:8787`) to use the visual
designer. Add one-, two-, or three-column rows, drag controls and sample data
fields onto the page, then adjust the paper size and orientation. The default
design is pre-filled with Material Takeout sample fields, a material table,
and an approval table. Each sample field shows its JSON key, type, and sample
value; dragging it into the form carries its key, label, and field type.

Sign in as an administrator to list and save templates in the configured
store. Saving a `formType` again replaces its current design.
**Export template** downloads the form definition using the `schemaVersion:
1.1` structure (`formCode`, `formName`, `sections`, `fields`, and field
layout). That JSON can be imported back into the designer. Power Automate can send only
the `formType` and form data; the HTML/PDF APIs look up the saved template.

## Configure Cloudflare D1

Create the database and copy the returned `database_id` into
`worker/wrangler.toml`, replacing the local placeholder:

```sh
cd worker
npx wrangler d1 create paperless-form-templates
```

Apply the schema, configure the admin login secrets, and deploy the Worker:

```sh
npx wrangler d1 migrations apply paperless-form-templates --remote
npx wrangler secret put TEMPLATE_ADMIN_PASSWORD
npx wrangler secret put TEMPLATE_SESSION_SECRET
npx wrangler deploy
```

The Worker config includes a Browser Run binding for PDF generation. Browser Run
usage follows the Cloudflare Workers plan limits; on Workers Free, Quick Actions
are limited to one request every 10 seconds and 10 browser minutes per day.
See the [Browser Run limits](https://developers.cloudflare.com/browser-run/limits/)
for current quotas.

Use a randomly generated password of at least 24 characters and a separate
random session secret of at least 32 characters. The designer uses the same
password login flow for the Worker and Vercel deployments.

The repository-root Vercel app can proxy template administration to the Worker
and resolve templates for its render endpoints. Set the Vercel environment
variable `TEMPLATE_STORE_URL` to the Worker origin (for example
`https://paperless-form-renderer.<account>.workers.dev`, without a trailing
slash), then redeploy Vercel. When using this proxy, set the same
`TEMPLATE_ADMIN_PASSWORD` and `TEMPLATE_SESSION_SECRET` in both environments
so the Worker can verify the Vercel-issued session. In local development:

```sh
cd worker
npx wrangler d1 migrations apply paperless-form-templates --local
npm run dev
```

Set `TEMPLATE_ADMIN_PASSWORD` and `TEMPLATE_SESSION_SECRET` in `worker/.dev.vars`
for local Worker saves. For local Vercel rendering with automatic lookup, also set
`TEMPLATE_STORE_URL=http://localhost:8787` in the repository-root `.env.local`.

## Configure Vercel PostgreSQL

When deploying the repository-root Vercel project, the template API uses
PostgreSQL directly if `DATABASE_URL` is configured. Add the connection string
from the Vercel PostgreSQL integration as the `DATABASE_URL` environment
variable. Set `TEMPLATE_ADMIN_PASSWORD` to a randomly generated password of
at least 24 characters, and `TEMPLATE_SESSION_SECRET` to a separate random
secret of at least 32 characters. The
`form_templates` table is created automatically the first time the API connects;
templates are stored as JSONB and upserted by canonical `formType`.

No `TEMPLATE_STORE_URL` or Cloudflare D1 setup is needed for root Vercel
deployments using PostgreSQL. `GET /api/templates` lists saved designs, and
`POST /api/templates` saves them after checking the signed admin session. Sign
in in the designer; the password is sent only to the login endpoint for
verification, and the browser receives an HttpOnly, SameSite session cookie.
The render endpoints look up a saved design when a request uses lowercase
`formType` (for example, `material-take-out`) and does not include its own
`template` or `JsonTemplate`. Requests using `FormType: "Dynamic"` continue to render the
template supplied in the request. If `DATABASE_URL` is not set, the existing
`TEMPLATE_STORE_URL` Worker proxy remains available when the same password and
session secret are configured on Vercel and the Worker.

## Run locally

```sh
cd worker
npm install
npx wrangler d1 migrations apply paperless-form-templates --local
npm run dev
```

The local Worker listens at `http://localhost:8787`.
For Vercel function development with PostgreSQL, also set `DATABASE_URL` and
`TEMPLATE_ADMIN_PASSWORD` and `TEMPLATE_SESSION_SECRET` in the repository-root
`.env.local`.

## Deploy to Vercel

The repository-root Vercel project uses `vercel.json` to publish the landing
page from `worker/public/`; root `api/` functions forward to the shared
renderer. It also exposes `GET /health` and `POST /api/render`.

If configuring a separate Vercel project with `worker/` as its root, Vercel
can use that folder's own `vercel.json`, `public/`, and `api/` functions.

```sh
cd worker
npx vercel
npx vercel --prod
```

The first command links the local project to a Vercel account/project; the
second publishes a production deployment. Alternatively, import the Git
repository into Vercel and set the project root directory to `worker`.

## Render a form

Send a JSON `POST` to `/api/render`. `JsonFormValue` and
`JsonApprovalLine` can each be supplied either as JSON values or as JSON
strings. `JsonApprovalLine` and `lineItems` are optional. Line items can also
be read from a `GridDataYY` array inside the selected form data.

```sh
curl -X POST http://localhost:8787/api/render \
  -H 'Content-Type: application/json' \
  -d '{
    "formType": "_CapexFormV3",
    "JsonFormValue": {
      "_CapexFormV3": {
        "drpAccquisitionType": "Buy",
        "drpAssetClass": "Building and structures",
        "dteDateOfRequest": "2026-11-09",
        "txtAssetDescription": "Production equipment",
        "txtPurchasePrice": "136",
        "txtQuantity": "4",
        "txtUnitPrice": "34"
      }
    },
    "JsonApprovalLine": [],
    "lineItems": []
  }'
```

Supported `formType` values:

- CAPEX: `capex`, `capex-v1`, `capex-v3`, `_CapexFormV1`, `_CapexFormV3`
- Material Takeout: `material-take-out`, `MaterialTakeoutForm`

The response from `POST /api/render` is an HTML fragment
(`text/html; charset=utf-8`) ready to embed in an HTML control. The root
layout fills the HTML control width and grows with its content. All submitted
values are HTML-escaped. CAPEX fields are mapped from the control names in
`JsonFormValue`; material form values are shown using their supplied field
names and grid cells.
The optional top-level `ExpectedDate` request property populates matching
`ExpectedDate`, `ExpectedReceiptDate`, or `dteDateOfExpectedReceipt` fields,
including the built-in CAPEX expected receipt date and matching Dynamic
template fields. When omitted, values from `JsonFormValue` are unchanged.

To receive the generated HTML and a PDF in the same response, send the same
request body to `POST /api/render-pdf` on either the Cloudflare Worker or Vercel
deployment. The Cloudflare URL is
`https://<worker-domain>/api/render-pdf`; it uses the Browser Run binding.
Both endpoints return JSON with `html`, `pdfBase64`, `pdfContentType`,
`pdfFileName`, `paperSize`, and `orientation`. The optional `paperSize` is
`A3`, `A4`, `A5`, `Letter`, or `Legal` (default `A4`); `orientation` is
`portrait` or `landscape` (default `portrait`).

The Vercel endpoint renders PDF with Chromium inside the Vercel function.
Vercel's build publishes the Chromium binary pack as a static asset, which the
function downloads from the project's public production domain on cold start.

To render a template supplied directly by a Power Automate flow, include
`JsonTemplate` in the same HTTP body as the form outputs. `JsonTemplate` may
be a JSON object or a JSON string containing the designer's exported
`schemaVersion: "1.1"` file. The legacy `template` property remains supported.
Designer exports include a `printLayout` extension with movable `header`,
`body`, and `footer` rows. Header/footer controls support titles, text, image
URLs or image data URIs, and render-time UTC date/time. Line-items and approval
controls can be placed in any region and use the `lineItems` and
`JsonApprovalLine` request arrays. Older schema files without `printLayout`
render only the controls they contain. In a `printLayout` template, a table is
rendered only when its matching `lineItems` or `approvals` control is present;
API data by itself does not add either table.
Only `FormType: "Dynamic"` uses `JsonTemplate`; HTML and PDF then follow the
schema's sections, fields, and row/column layout. For any other `FormType`,
the API ignores `JsonTemplate` and selects the built-in form from `FormCode`
(for example `CAPEX_MVP` or `MATERIAL_TAKE_OUT`). Legacy requests using only
lowercase `formType` continue to work. A saved template lookup by lowercase
`formType` is available when either `DATABASE_URL` or `TEMPLATE_STORE_URL` is
configured.
The line-items table and approval table are controlled by their respective
`JsonTemplate` controls and use data from `lineItems` and `JsonApprovalLine`.

```json
{
  "FormType": "Dynamic",
  "FormName": "Material Take Out Request",
  "FormCode": "MATERIAL_TAKE_OUT",
  "JsonFormValue": "[{\"FieldKey\":\"department\",\"FieldLabel\":\"department\",\"FieldType\":\"choice\",\"FieldValue\":\"Finance\",\"SectionKey\":\"requestInfo\"},{\"FieldKey\":\"materialtype\",\"FieldLabel\":\"Material Type\",\"FieldType\":\"choice\",\"FieldValue\":\"InventoryPart\",\"SectionKey\":\"requestInfo\"},{\"FieldKey\":\"description\",\"FieldLabel\":\"Reason\",\"FieldType\":\"multiline\",\"FieldValue\":\"Sample reason\",\"SectionKey\":\"requestInfo\"}]",
  "JsonApprovalLine": [],
  "lineItems": [],
  "paperSize": "A4",
  "orientation": "portrait",
  "JsonTemplate": {
    "schemaVersion": "1.1",
    "formCode": "MATERIAL_TAKE_OUT",
    "formName": "Material Take Out",
    "formVersion": 1,
    "sections": [
      { "key": "requestInfo", "title": "Request Information", "description": "General request information.", "order": 10, "visible": true }
    ],
    "fields": [
      { "key": "department", "label": "department", "type": "choice", "section": "requestInfo", "defaultValue": "", "placeholder": "Select department", "required": true, "visible": true, "order": 10, "optionSource": "sharepoint", "optionSet": "Department", "parentField": "", "options": [], "layout": { "mode": "horizontal", "row": 1, "column": 1 } },
      { "key": "materialtype", "label": "Material Type", "type": "choice", "section": "requestInfo", "defaultValue": "", "placeholder": "Select Material Type", "required": true, "visible": true, "order": 10, "optionSource": "sharepoint", "optionSet": "Materialtype", "parentField": "", "options": [], "layout": { "mode": "horizontal", "row": 1, "column": 2 } },
      { "key": "description", "label": "Reason", "type": "multiline", "section": "requestInfo", "defaultValue": "", "placeholder": "enter reason", "required": true, "visible": true, "order": 20, "optionSource": "", "optionSet": "", "parentField": "", "options": [], "layout": { "mode": "vertical", "row": 2, "column": 1 } }
    ]
  }
}
```

`FormName` is optional and overrides the print title (`formName`) from
`JsonTemplate`; if omitted or empty, the template title is used.
`RequestName` is optional and replaces the `Request Information` section
heading in the print layout; it does not change the main `FormName` title.

For a standard built-in form, use the same flow body without `JsonTemplate`,
and select the form with its `FormCode`:

```json
{
  "FormType": "Standard",
  "FormCode": "CAPEX_MVP",
  "JsonFormValue": {
    "_CapexFormV3": {
      "txtAssetDescription": "Production equipment",
      "txtPurchasePrice": "136"
    }
  },
  "JsonApprovalLine": [],
  "lineItems": []
}
```

Supported template control types are `heading`, `text`, `field`, `image`,
`dateTime`, `lineItems`, `approvals`, `divider`, and `spacer`. A schema
`JsonTemplate` maps its `fields` and `layout.row`/`layout.column` into the
print layout; table controls are rendered only where explicitly included.
Field values are matched using each field's `key` against `JsonFormValue`. The designer's
**Sao chép request** action copies the current sample data and schema in
`JsonTemplate`. In Power Automate, replace `JsonFormValue`,
`JsonApprovalLine`, and `lineItems` with the corresponding flow outputs, and
pass the designer's exported JSON object or its JSON string as `JsonTemplate`.
Use the returned `pdfBase64` with `base64ToBinary(...)` when creating a file.

In Power Automate, create a file using the HTTP action's outputs:

- **File name:** `body('HTTP')?['pdfFileName']`
- **File content:** `base64ToBinary(body('HTTP')?['pdfBase64'])`
- **HTML:** `body('HTTP')?['html']`

Replace `HTTP` with the actual name of your HTTP action. The existing
`POST /api/render` endpoint continues to return HTML only.

For an A4 portrait PDF in Power Apps, set the HTML text control to an A4-like
portrait aspect ratio and use:

```powerfx
PDF(
    HtmlViewer1,
    {
        Size: PaperSize.A4,
        Orientation: PaperOrientation.Portrait,
        Margin: "8mm"
    }
)
```

At 96 DPI, A4 is approximately 794 x 1123 pixels. The control's width and
height should use a similar 0.707 width-to-height ratio; a much wider control
is scaled down by `PDF()` and makes the form appear small on the page.

`GET /health` checks service availability. `GET /api/templates` lists saved
designs; `POST /api/templates` saves or replaces the entry for a `formType`
and requires an authenticated administrator session.

## Tests and deploy

```sh
npm test
npm run deploy
```

`npm run deploy` publishes the Cloudflare Worker using Wrangler. The Vercel
function is available at `/api/render`. Both APIs enable cross-origin requests
for easy integration; add authentication or restrict origins before exposing
sensitive form data on a public endpoint.
