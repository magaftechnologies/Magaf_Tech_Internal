# MAGAF API contracts (v1)

Base URL: `/api`. Every protected route expects `Authorization: Bearer <JWT>`. JSON responses use `{ success, message, data, meta? }`; errors use `{ success: false, message, errors: [] }`. Object IDs in path parameters are MongoDB ObjectIds. Collection endpoints are paginated with `page` (default 1) and `limit` (default 25, maximum 100).

## Roles

`SA` = super_admin; `A` = admin; `M` = manager; `TM` = team_member; `S` = sales; `D` = developer/designer; `Me` = mentor; `F` = finance; `C` = client. “Team” means an authenticated internal portal user, with conversation/project assignment checks applied where applicable.

## Authentication

| Method | URL | Auth / roles | Body/query | Result |
|---|---|---|---|---|
| POST | `/auth/login` | Public; rate limited | `{ email, password }` | `{ token, user }` |
| GET | `/auth/me` | Any | — | Current safe user |
| POST | `/auth/change-password` | Any authenticated user | `{ currentPassword, newPassword (10+ chars) }` | New token and safe user; invalidates prior tokens |

## Shared resources

These routes use `/api/{resource}` and return paginated arrays on GET. List filters: `search`, `status`, `clientId` (team only), `projectId`, `serviceId`, `page`, `limit`. Supported methods are GET, POST, GET/PATCH `/:id`; DELETE is an archive action only for clients, services, users, projects, and tasks.

`GET /team-members` is available to authenticated internal team users and returns only active team accounts with assignment-safe profile fields. Client portal accounts are excluded from this directory and cannot be assigned to clients, leads, deals, projects, tasks, students, or products; the backend validates every submitted assignment, including direct API calls.

| Resource | Methods | Required create fields / common body | Auth |
|---|---|---|---|
| `/users` | GET, POST; GET/PATCH `/:id` | Admin-created team user: `{ name, email, password (10+ chars), role, phone?, department?, designation? }`. Password hash is never returned. | SA/A; role assignment above enforced |
| `/clients` | GET, POST; GET/PATCH/DELETE `/:id` | `{ name }`; business/contact, address, industry, status, assignment, tags and billing fields optional. Include `{ createPortalAccount: true, portalPassword }` to provision client login credentials. | Team; client reads/edits own profile-safe fields |
| `/leads` | GET, POST; GET/PATCH `/:id` | `{ name }`; `serviceId`, source, status, potentialValue, assignedTo, follow-up optional | SA/A/M/S/TM |
| `/expenses` | GET, POST; GET/PATCH `/:id` | `{ category, description, amount }`; optional paid/pending status, date, vendor, project/service and receipt file | SA/A/M/F |
| `/deals` | GET, POST; GET/PATCH `/:id` | `{ title, serviceId }`; lead/client/project, quote, agreed amount, status optional | SA/A/M/S/F |
| `/students` | GET, POST; GET/PATCH `/:id` | `{ name }`; learning profile, mentor and enrollment status optional | SA/A/M/Me |
| `/services` | GET, POST; GET/PATCH/DELETE `/:id` | `{ name, slug }`; description, category, icon, features, active/display order | Team reads; SA/A/M write |
| `/projects` | GET, POST; GET/PATCH/DELETE `/:id` | `{ projectName, clientId, serviceId }`; scope, dates, amounts, status, priority, team assignments | Team; C reads own and edits client-visible notes only |
| `/invoices` | GET, POST; GET/PATCH `/:id` | `{ clientId, amount }`; optional project/deal, issue/due dates, notes/status | Team; C reads own invoices |
| `/tasks` | GET, POST; GET/PATCH/DELETE `/:id` | `{ projectId, title }`; assignment, priority, status, due date | Team with task role |
| `/assets` | GET, POST; GET/PATCH `/:id` | `{ name, type }`; optional client/project/service, prompt, URL, status and notes | Authorized team roles |
| `/products` | GET, POST; GET/PATCH `/:id` | `{ name }`; description, problem, target, stage, priority and assignment optional | Internal team |
| `/activities` | GET, GET `/:id` | Filters: `search`, `clientId` for team, `projectId`, `page`, `limit` | Team; C sees only own-client events |

DELETE on clients, services, users, projects and tasks is a status/archive action to preserve history. Other record types are not deletable through generic routes; project requests use their dedicated review and conversion workflow.

Expense amounts are recorded in INR. Revenue, paid expenses, and net-after-expenses dashboard totals are calculated server-side from persisted payment and expense records.

### Lead conversion

| Method | URL | Auth / roles | Body | Result |
|---|---|---|---|---|
| POST | `/leads/:id/convert` | SA/A/M/S | Optional `{ businessName?, industry? }` | Creates a client and links it to the lead; duplicate conversions return `409` |
| PATCH | `/deals/:id` | SA/A/M/S/F | `{ status: "accepted" }` | Accepting a deal with a client creates and links its project |

## Project requests

| Method | URL | Auth / roles | Body/query |
|---|---|---|---|
| GET | `/project-requests` | Team or C | Team filters `status`, `clientId`, `serviceId`; C is automatically scoped |
| POST | `/project-requests` | Team or C | `{ projectName, serviceId, description (10+ chars), businessGoal?, requirements?, expectedDeliverables?, estimatedBudget?, preferredDeadline?, priority?, referenceLinks?, additionalNotes? }`; client ID comes from JWT |
| GET/PATCH | `/project-requests/:id` | Team or owning C | PATCH lets C edit requirements/reference links/notes; team can update review status, proposed quote, information requests and priority |
| POST | `/project-requests/:id/convert` | Team | `{ agreedAmount? }`; request must be `accepted` or `quoted`; creates linked project and accepted deal |

Request statuses: `submitted`, `under_review`, `need_more_information`, `quoted`, `accepted`, `rejected`, `converted_to_project`, `cancelled`.

## Payments and revenue

| Method | URL | Auth / roles | Body/query |
|---|---|---|---|
| GET | `/payments` | Team or C | Filters `status`, `projectId`, `dealId`, `invoiceId`, `serviceId`, `studentId`, `page`, `limit`; C gets own-client records and redacted notes |
| GET | `/payments/summary` | SA/A/M/F | Aggregated counts/amounts by payment status |
| POST | `/payments` | SA/A/M/F | `{ amount, clientId?, projectId?, dealId?, invoiceId?, studentId?, serviceId?, paymentAccountId?, currency?, paymentType?, paymentMethod?, transactionId?, paymentDate?, dueDate?, notes?, proofFiles? }`; non-cash entries require a valid uploaded payment receipt and are immediately paid without review; cash entries await a different authorized team approver |
| POST | `/payments/client-submissions` | C | `{ amount, paymentMethod, projectId?, dealId?, invoiceId?, paymentAccountId?, transactionId?, paymentDate?, proofFiles? }`; non-cash entries require a client-owned `payment_proof` file; all client submissions, including cash, await team verification |
| PATCH | `/payments/:id/resubmission` | C | Same body as the initial client submission; only the owning client can resubmit an existing `correction_requested` payment |
| PATCH | `/payments/:id/verification` | SA/A/M/F | `{ action: "verify" \| "reject" \| "request_correction", note? }`; only verified payments enter revenue and linked balances |
| PATCH | `/payments/:id/cash-approval` | SA/A/M/F | No body; second approver must differ from the team user who recorded the cash payment |
| POST | `/payments/:id/disputes` | C | `{ claimedAmount, reference?, explanation, proofFiles? }`; client must own the payment; only one unresolved issue at a time |
| PATCH | `/payments/:id/disputes/:disputeId` | SA/A/M/F | `{ status: "information_requested" \| "resolved" \| "rejected", response }` |
| PATCH | `/payments/:id` | SA/A/M/F | `{ status?, paymentMethod?, transactionId?, paymentDate?, dueDate?, notes? }` |
| POST | `/mentoring/payments` | SA/A/M/Me/F | Requires `{ studentId, amount, paymentMethod?, proofFiles? }`; non-cash receipts require proof and are paid immediately, while cash waits for a different authorized team approver; uses `paymentType: "mentoring_fee"` |

Payment types: `advance`, `milestone`, `full_payment`, `partial_payment`, `subscription`, `mentoring_fee`, `maintenance`, `other`. Lifecycle statuses include `submitted`, `under_verification`, `paid`, `rejected`, `correction_requested`, `partially_paid`, `failed`, `refunded`, and `cancelled`. Team-entered non-cash payments require uploaded proof and are recorded as paid immediately; team-entered cash payments require approval by a different authorized team member. Client submissions (cash or non-cash) remain outside revenue, invoices, and project balances until an authorized team member verifies them. Non-cash client submissions require uploaded proof; cash submissions do not. A client cannot mark an unpaid invoice as paid by posting a request.

`currency` currently supports `INR` only so totals are not combined across currencies without conversion.

### Payment accounts, distributions and finance audit

| Method | URL | Auth / roles | Body/query |
|---|---|---|---|
| GET | `/finance/payment-accounts` | Team or C | Clients see active payment destinations only; internal notes are excluded. Manager account numbers are masked. |
| POST | `/finance/payment-accounts` | SA/A/F | `{ name, method, accountHolder?, bankName?, accountNumber?, ifscCode?, upiId?, instructions?, internalNotes?, isActive?, displayOrder? }`; `method` is `upi`, `bank_transfer`, `cash`, or `other`; UPI requires `upiId`, bank transfer requires `accountNumber` and `ifscCode` |
| PATCH | `/finance/payment-accounts/:id` | SA/A/F | Any payment-account fields; setting `isActive: false` hides the destination from clients and new submissions |
| PUT | `/finance/projects/:projectId/distribution-rules` | SA/A | `{ companySharePercent, founderShares: [{ userId, percent }] }`; shares must total exactly 100% and founders must be active internal admins/super-admins |
| GET | `/finance/distributions` | SA/A/M/F | Optional `projectId`, `paymentId`, `limit` (max 500); includes historical finalized and reversed snapshots plus compensating reversal entries |
| GET | `/finance/distributions/summary` | SA/A/M/F | Optional `projectId`, `startDate`, `endDate`; aggregates project allocations and finalized transfers/funding/investments |
| GET | `/finance/founder-transfers` | SA/A/M/F | Optional `projectId`, `founderId`, and `limit` (max 500) |
| POST | `/finance/founder-transfers` | SA/A | `fromFounderId`, `toFounderId` or `toOwnerType: "company"`, `amount`, optional `distributionId` and `reason`; backend verifies available balance globally or within the selected project distribution |
| POST | `/finance/founder-transfers/:id/reversal` | SA/A | `{ reason }`; reverses an unused transfer, records before/after audit, and restores the source owner's available balance |
| PATCH | `/finance/distributions/:id` | SA/A | `{ companySharePercent, founderShares: [{ userId, percent }], reason }`; corrects a finalized allocation with an audit snapshot; unavailable while finalized transfers remain |
| POST | `/finance/distributions/:id/reversal` | SA/A | `{ reason }`; creates compensating negative allocations and marks the original snapshot reversed; linked transfers must first be reversed |
| GET | `/finance/company-transactions` | SA/A/M/F | Optional `type` (`external_funding` or `investment`), `startDate`, `endDate`, and `limit` (max 500) |
| POST | `/finance/company-transactions` | SA/A | `{ type, amount, description, currency?: "INR", occurredAt?, reference? }`; investments cannot exceed current company available funds; external funding increases the balance |
| GET | `/finance/audit` | SA/A | Optional `paymentId`, `projectId`, `accountId`, `distributionId`, `transferId`, `companyTransactionId`, `action`, `limit` (max 500); append-only financial before/after snapshots |

Each project defaults to 100% company allocation. Only verified/paid payments belonging to that project affect its paid total; the backend records which payment action crosses the project amount. A project distribution is eligible only once that amount is fully verified and must then be explicitly finalized using that project's saved rules. Founder/company allocations remain historical project snapshots. Founder transfers (including founder-to-company) and company external-funding/investment entries update available balances without changing those snapshots. Project payment finalization, distribution operations, transfers and company balance changes are serialized with database-backed leases to prevent concurrent overspend/race conditions. Finance audit records are immutable through the API; no update/delete endpoint is provided.

## Files and media

| Method | URL | Auth | Body/query |
|---|---|---|---|
| GET | `/files` | Team or C | Filters `projectId`, `projectRequestId`, `category`; C sees only client-visible owned files |
| POST | `/files/upload` | Team or C | `multipart/form-data`: repeated `files` (max 10; size from env), optional `projectId`, `projectRequestId`, `category`, `description`, `visibility` |
| POST | `/files/links` | Team or C | `{ title, url (HTTPS), projectId?, projectRequestId?, category?, description?, visibility? }` |
| GET/DELETE | `/files/:id` | Team or owning C | Client deletes only their own uploaded file |

Allowed upload MIME families: JPEG/PNG/WebP/GIF/SVG, MP4/WebM/QuickTime, MPEG/MP4/WAV/WebM/OGG audio, PDF/ZIP/Office documents, plain text and CSV. ZIP archives are stored as downloadable files and are not previewed or unpacked. File bytes are streamed to Cloudinary; only metadata and Cloudinary identifiers/URLs enter MongoDB.

## Conversations, messages and notifications

| Method | URL | Auth / roles | Body/query |
|---|---|---|---|
| GET/POST | `/conversations` | Team or C | POST: `{ clientId?, projectId?, projectRequestId?, serviceId? }`; client is taken from JWT and project/request ownership is validated |
| GET | `/conversations/:conversationId/messages` | Authorized participant or SA/A/M | Query `limit` (max 100) |
| POST | `/messages` | Authorized participant | `{ conversationId, content?, messageType?, attachments?: [fileId] }`; content or an attachment is required |
| PATCH | `/messages/:id/read` | Recipient side | Adds a per-user timestamped read receipt; repeat reads are idempotent |
| GET | `/notifications` | Any | `unread=true`, `limit` (max 100) |
| PATCH | `/notifications/read-all` | Any | — |
| PATCH | `/notifications/:id/read` | Owning recipient | — |
| GET | `/dashboard/client` | Authenticated client | — | Client-only project/request/payment/message/notification summary and recent activity |

Messages have types `text`, `image`, `video`, `audio`, `voice`, `file`, `system`; status is `sent` or `read` in this non-real-time implementation. Team users must be admins/managers or conversation participants. Client read receipts do not expose individual team readers.

## Mentoring and service extensions

| Method | URL | Auth / roles | Body/query |
|---|---|---|---|
| GET/POST | `/mentoring/sessions` | SA/A/M/Me | POST requires `{ studentId, date, topic }`; optional mentor, duration, notes/resources |
| PATCH | `/mentoring/sessions/:id` | SA/A/M/Me | Session fields/status; first completion increments student session completion once |
| GET/POST/PATCH | `/mentoring/students[/:id]` | SA/A/M/Me | Same student fields as `/students` |
| POST | `/mentoring/payments` | SA/A/M/Me/F | Canonical central payment flow |
| GET/POST/PATCH | `/advertising/projects[/:id]` | Team read; SA/A/M/D write | Create requires `{ projectId, creativeType }`; project must be advertising service |
| GET/POST/PATCH | `/content/projects[/:id]` | Team read; SA/A/M/D write | Create requires `{ projectId, contentType }`; project must be content service |
| GET/POST/PATCH | `/invitations/projects[/:id]` | Team read; SA/A/M write | Create requires `{ projectId, eventType }`; project must be invitations service |
| GET/POST/PATCH | `/automation/projects[/:id]` | Team read; SA/A/M/D write | Create requires `{ projectId, automationType }`; project must be automation service |

Extension write bodies accept their corresponding model-specific fields from the schemas in `models/index.js`, but cannot replace the core project's client or service relationship.

## Dashboard, analytics and targets

| Method | URL | Auth / roles | Query |
|---|---|---|---|
| GET | `/dashboard/summary` | Team | — |
| GET | `/dashboard/revenue` | Team | `range=last5|last7|last30|this_month|previous_month`, or `startDate`, `endDate`, optional `interval=month`, `serviceId` |
| GET | `/dashboard/services`, `/dashboard/clients`, `/dashboard/projects` | Team | — |
| GET | `/analytics/dashboard` | Team | Same summary as dashboard |
| GET | `/analytics/revenue` | Team | Time-series range parameters |
| GET | `/analytics/services` | Team | Service revenue and project/client counts |
| GET | `/analytics/clients`, `/analytics/projects` | Team | — |
| GET | `/analytics/acquisition` | Team | Six-month client/request trends, lead sources, and conversion |
| GET | `/analytics/revenue/breakdown` | Team | Optional `startDate`, `endDate`; returns totals by service/client/project |
| GET/POST | `/targets` | Team; writes SA/A/M/F | GET optional `status`, `targetType`; POST `{ targetType, period, targetValue, startDate, endDate, serviceId? }` |
| PATCH | `/targets/:id` | SA/A/M/F | Target definition fields; current values are never editable |

Target types: `revenue`, `clients`, `leads`, `projects`, `students`; periods: `monthly`, `annual`, `custom`. Target GET results include current performance and derived progress. Revenue time-series data contains `{ startDate, endDate, interval, series: [{ date, revenue, payments }] }` with zero-filled dates/months.

## Frontend integration

The React app uses `VITE_API_BASE_URL` (documented in `Frontend/.env.example`), bearer-token authentication, and frontend normalizers to map backend ObjectIds/enums into the accepted UI shape. Business records are loaded from API endpoints rather than browser-local mock storage. The backend remains authoritative for dashboard, target, project, payment, and service calculations.

Invoice PDF generation, payment-gateway settlement, WebSocket delivery, Cloudinary file replacement/versioning, invitations, and forgotten-password recovery are not available. File upload requires valid server-side Cloudinary configuration. Clients can submit payment details and evidence for internal verification; payment settlement itself remains manual.
