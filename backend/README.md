# MAGAF Internal Platform API

The backend is a modular-monolith API for the internal MAGAF Technologies operating platform and its client portal. It uses Express, MongoDB/Mongoose, JWT, bcrypt, express-validator, and Cloudinary. The React/Vite application in `Frontend/` consumes this API through its domain API layer and bearer-token authentication.

## Architecture

Requests follow the feature-module flow:

`HTTP route → controller → business service → Mongoose model`

Business modules share the core client, user, service, project, payment, file, conversation, notification, task, and activity records. Advertising, automation, content, digital invitations, and mentoring use dedicated extension models while referencing their central project/client/service IDs.

## Folder structure

```text
backend/
├── app.js
├── server.js
├── package.json
├── .env.example
├── config/                 # environment, MongoDB, Cloudinary
├── middleware/             # JWT, roles, uploads, validation, errors
├── models/index.js         # Mongoose schemas and indexes
├── modules/
│   ├── auth/
│   ├── resources/          # clients, users, leads, deals, services, projects, etc.
│   ├── leads/              # lead conversion into client records
│   ├── requests/
│   ├── payments/
│   ├── files/
│   ├── communication/
│   ├── analytics/
│   ├── dashboard/
│   ├── targets/
│   ├── mentoring/
│   └── serviceWork/        # advertising, content, invitations, automation
├── routes/index.js
├── seed/seedData.js
├── test/api.test.js
├── utils/
├── validators/
└── uploads/                # memory uploads only; no production media is persisted here
```

## Requirements and local setup

- Node.js 20 or later
- MongoDB 6+ running locally or a MongoDB connection string
- Cloudinary account only when uploading real media

```powershell
Set-Location .\backend
npm install
Copy-Item .env.example .env
# Edit .env with a private JWT secret and your MongoDB URI.
npm run seed
npm run dev
```

The API starts on `http://localhost:4000`; `GET /health` reports the MongoDB connection state. `npm start` runs the non-watch server. Do not commit `.env`.

Configure optional founder bootstrap accounts in `INITIAL_FOUNDERS` as a JSON array of `{ "name", "email" }` objects, then set `INITIAL_ADMIN_PASSWORD` privately if any configured accounts are missing. No founder names or accounts are built into the seed. The password is bcrypt-hashed, is not logged or returned, and new accounts must change it on first sign-in. Seeding also ensures the seven service definitions exist; it creates no client, student, project, payment, messaging, request, target, or revenue records. Existing records are not deleted or overwritten.

## Environment variables

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | HTTP port (default `4000`) |
| `MONGO_URI` | MongoDB URI |
| `JWT_SECRET` | Private signing key; use at least 32 random characters in production |
| `JWT_EXPIRES_IN` | JWT lifetime (default `8h`) |
| `CLIENT_URL` | Comma-separated permitted browser origins for CORS |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud |
| `CLOUDINARY_API_KEY` | Cloudinary key |
| `CLOUDINARY_API_SECRET` | Cloudinary secret |
| `UPLOAD_MAX_FILE_SIZE_MB` | Per-file upload limit (default 25 MB) |
| `INITIAL_ADMIN_PASSWORD` | Temporary password used only when creating configured bootstrap accounts; set privately and change on first sign-in |
| `INITIAL_FOUNDERS` | Optional JSON array of `{ "name": "...", "email": "..." }` bootstrap accounts; defaults to none |

Cloudinary credentials are optional for startup, but file uploads return an explicit `503` until all three credentials are configured. The backend keeps uploaded media in Cloudinary and stores metadata/URLs in MongoDB.

## Authentication and authorization

1. `POST /api/auth/login` verifies the bcrypt hash, updates `lastLogin`, writes an activity event, and returns a JWT plus a safe user projection.
2. Send subsequent requests with `Authorization: Bearer <token>`.
3. JWT claims identify the user, role, portal type, and client record. Authentication middleware re-loads the active user on every request.
4. Route role gates and service-level ownership checks are both applied. Client tokens are scoped to the associated `Client._id`; submitted client IDs are ignored or rejected when they conflict with the token.
5. Client responses omit internal project/request notes and team assignment fields. Client conversation lists do not reveal the internal participant roster; team read receipts are summarized rather than disclosing employee identities to clients.

Internal roles: `super_admin`, `admin`, `manager`, `team_member`, `sales`, `developer`, `designer`, `mentor`, `finance`. Client accounts have role `client` and `portalType: "client"`. Only `super_admin` and `admin` can manage team-user records; only a super admin can assign administrator-level roles. Public client self-registration is disabled. Internal users create client records and may provision a portal account with an initial password. Password changes verify the current password and invalidate previously issued tokens.

## Business logic

- **Project requests:** submissions take the authenticated client's ID, validate the service, create internal notifications and an activity. Only accepted or quoted requests can be converted. Conversion creates a linked project and deal, carries the brief/pricing/service/client forward, re-associates request files and request conversation, and notifies the client.
- **Payments:** only finance-capable internal roles can record/update payment records. A client's payment submission is not treated as proof of funds; a payment gateway/webhook integration is intentionally not included. Paid records are the source for revenue and project/student paid totals. Project balances and invoice statuses are recalculated from persisted paid payment records. Overpayment is rejected.
- **Expenses and currency:** expense records are separate from revenue and only paid expenses reduce dashboard net revenue. Financial amounts currently use INR; the API rejects unsupported payment currencies rather than mixing currencies in totals.
- **Revenue and analytics:** calculations aggregate actual `Payment` records whose status is `paid`; mentoring payments use the same collection with `studentId`, so they contribute once to global revenue. Dashboard, service, time-series, client, project and revenue breakdown APIs query MongoDB; no graph values are hard-coded.
- **Lead conversion:** `POST /api/leads/:id/convert` creates a client from a lead and stores the client relationship on the lead. Repeated or concurrent conversions are rejected.
- **Messages:** each conversation has a client and optional project or request relationship. Every message stores sender role, attachments, status, and a per-user `readReceipts` list. Team access is limited to admin/manager roles or conversation participants. Notification records are generated for recipients.
- **Files:** memory-buffer upload validation accepts configured image/video/audio/document types, then streams to Cloudinary folders scoped by project/request/client. The `File` collection stores IDs, URLs, resource type, MIME type, uploader, ownership, category, and visibility. HTTPS links can be attached without fetching them server-side.
- **Targets:** current performance and progress are computed from actual records during reads, not accepted from frontend-supplied current values.
- **Service extensions:** advertising, content, invitation, and automation records require a matching core project/service. Mentoring students/sessions remain separate from project-client counts; mentoring revenue remains part of global revenue.
- **Audit:** important auth, entity, request, payment, upload, message, read, and service-work actions write append-oriented activity records.

## Founder bootstrap

Set `INITIAL_ADMIN_PASSWORD` and `INITIAL_FOUNDERS` only in a private local/server environment. The seed creates only the configured team accounts idempotently and marks newly created accounts for mandatory password change. It never removes prior records; use an empty development database for a clean workspace rather than dropping a database that may contain real work.

## Response format

Success:

```json
{ "success": true, "message": "Projects retrieved.", "data": [], "meta": { "page": 1, "limit": 25, "total": 0, "pages": 0 } }
```

Error:

```json
{ "success": false, "message": "Request validation failed.", "errors": [{ "field": "projectName", "message": "..." }] }
```

Production responses do not include stack traces. Mongo validation, duplicate-key, authorization, and not-found errors map to appropriate 4xx responses.

## Testing

```powershell
npm test
npm run check
```

The API tests run against an ephemeral MongoDB replica-independent memory server and cover authentication, ownership isolation, lead conversion, request conversion, payment-derived balances/revenue, expenses, messaging read receipts, upload configuration errors, and role/validation rejection. Tests may download the MongoDB test binary on first execution. Real Cloudinary upload and connection to a separately managed MongoDB deployment require credentials/configuration and are not claimed by the automated suite.

## Frontend coordination

Configure `VITE_API_BASE_URL` in `Frontend/.env.local` (for example, `http://localhost:4000/api`) and run the frontend from the `Frontend/` directory with `npm run dev`. The frontend maps server IDs/statuses into its presentation model in `src/api/normalizers.js`; authentication tokens are attached by `src/api/http.js`. Start the backend and its MongoDB service separately. Endpoint roles, request shapes, and response behavior are documented in [`docs/API.md`](./docs/API.md).

Run frontend checks from `Frontend/` with `npm run lint` and `npm run build`. Backend API regression tests run with `npm test` and require no separately managed database.
