# Technician visit intake — review build

Implemented in the existing `technician-app.html` and Hub server. Test branch only. No live deployment is authorised.

## Phone workflow

Sign in with the existing name/PIN screen, open an assigned job, enter visit date and notes, select original images, optionally label individual images Before / After / Context, and Submit visit. No photo pairs are required. Explain missing/limited evidence when fewer than six originals are available; the receipt flags this for office review. A received visit is never an approved or saved ARK report.

The displayed ARK reference, address and flat come from a fresh server check, rather than technician entry or a job-title guess. The original File objects, exact camera filenames, notes, labels and stable submission ID are kept in IndexedDB. Content freezes when transmission begins. Retry checks OneDrive first, then resumes missing 1 MiB chunks. Browser restart and session expiry do not discard the draft. Reopen the assigned job after signing in again. After a verified receipt, Record another visit explicitly archives that receipt and creates a new visit ID.

## Server identity and job verification

When intake is enabled, the browser PIN table is removed from served HTML and the server verifies a salted scrypt hash. Five failed attempts lock that identity for 15 minutes. Missing or disabled credentials fail closed. Active sessions are rechecked against active staff and the current credential hash; disabling or rotating a credential revokes the session. Production cookies are Secure, HttpOnly and SameSite=Lax. Mutating intake and login requests require an exact same origin.

The existing Hub job-detail dialog has a Director-only Verify visit identity action. It requires an existing director session, CSRF token and explicit confirmation of an independently checked numeric ARK reference against the exact address/flat. It records the verifying office identity/time, assigned technician and dispatch version. A changed address, flat, assignment, version, cancellation or withdrawal blocks stale intake. Ordinary whole-Hub saves preserve the server-held verification and cannot mint or replace it. Technician requests cannot provide their own trusted ARK identity.

This verification is intake metadata only. It does not write to ARK, the report tracker, approval state or completion fields. Albert's report format, Second Look and Kevin's approval-before-save remain unchanged.

## Persistence and recovery

Upload plans and original chunks are stored under `DATA_DIR/visit-upload-staging`, using fsynced temporary files and atomic no-replace hard links. Each original is checked against the browser-calculated SHA-256 before it can enter OneDrive. All HTTP intake requests are bounded to 2 MiB; no batch of base64 images crosses the mobile connection.

OneDrive receives an immutable `intake-intent.json`, the readable `technician-note.txt`, indexed original filenames and `submission.json` containing exact original names, labels, sizes, hashes and cloud item IDs/URLs. Indexed names preserve distinct images that share a camera filename. The service downloads the note and every original and checks the expected inventory, hashes and IDs before a receipt. A changed retry is rejected, and existing matching originals are not overwritten. An immutable cloud intent prevents separate processes or loss of the local receipt ledger from rebinding an ID to different content. Status reconciliation can rebuild its proof from that cloud intent and all cloud originals without the local ledger.

The legacy Cloudinary uploader, completion path and external legacy OneDrive function are blocked while intake is enabled. If the new client script fails to load, the app blocks submission rather than falling back to that legacy workflow. Intake never changes a job to Completed.

## Deployment configuration — after approval only

The feature defaults OFF. The existing live app has not been changed. To enable this build later, configure:

- `KINGSWOOD_VISIT_INTAKE_ENABLED=1`
- `KINGSWOOD_INTAKE_CONFIG`: absolute private JSON path containing `driveId`, `rootId`, `tenantId`, `clientId`. Use the explicitly approved private OneDrive destination. Never commit tenant details or IDs.
- `KINGSWOOD_INTAKE_GRAPH_SECRET`: existing authorised app secret in the host's secret environment. No new Microsoft permissions are created by this code.
- `KINGSWOOD_TECHNICIAN_CREDENTIALS_FILE`: absolute private JSON path OUTSIDE the repository/web root, mapping technician IDs to `{salt, hash}`; optional `disabled: true` revokes access. Provision through `scripts/provision-technician-pin.cjs`, supplying the technician ID as its argument and the PIN on stdin. Do not put PINs in command arguments, shell history or repository files. Rotate the old browser-published production PINs before rollout; the dummy test PIN is not a production credential.
- `DATA_DIR`: durable private storage for staging and receipt ledgers. Back this up and monitor capacity. The implementation does not delete original staging evidence automatically. Agree retention and cleanup with Kevin before rollout.
- `NODE_ENV=production`, TLS, the correct same-origin hostname and existing director credentials. The Hub's existing office security configuration must remain correctly deployed. This change does not redesign all legacy Hub endpoints.

Limits: 20 originals, 15 MiB per file and 96 MiB per visit. JPEG, PNG, WebP and HEIC/HEIF signatures are checked. Microsoft Graph credentials stay on the server. No sharing links or access grants are created.

The phone uploader uses bounded requests, but final assembly/read-back still uses server memory up to the bounded visit limit; size the worker accordingly. This is a single durable-volume deployment design; upload chunks are not shared across independent servers without shared durable storage. Browser eviction or clearing site data can remove a draft. The app shell does not support a cold start while entirely offline; an already-open form stays usable offline and reopening after reconnection recovers its data.

## Validation and remaining acceptance

`npm run test:visit-intake` covers service integrity/replay, loss of the local receipt ledger, original chunk interruption/restart, mismatched content, missing evidence, server PIN checks/throttling, real HTTP login/CSRF/office verification, changed assignments, disabled credentials and invalidated sessions.

`npm run smoke:visit-intake` requires an isolated test server and an external private `INTAKE_TEST_DIR`. The review build was tested against synthetic office-verified data using the normal dynamic job adapter, not the pilot's fixed job map. It tested 360/390/430px layouts, a multi-chunk original, two different originals with identical camera names, offline submission, interrupted transfer, browser restart, skip/resume of stored chunks, a deliberately lost final response, receipt reconciliation, unchanged completion/ARK state and an explicit new visit. The cloud originals are independently read back and compared with the fixture hashes.

Kevin's prior physical test already placed his note and four original JPEGs in the isolated OneDrive pilot folder; those originals were independently downloaded and verified. He must now test this updated staged build on his phone before rollout. Real-device HEIC, maximum-size batches, longer session-expiry behavior and operational storage/retention still need acceptance. Albert's own read-only access confirmation remains outstanding following the app safety block; do not circumvent that block or change his permissions/workflow.

`TECHNICIAN-INTAKE-PILOT.md` records the earlier proof and backend trace. The current resumable protocol is `/context`, `/status`, `/begin`, `/chunk`, `/finish`; the earlier single-request `/submit` is intentionally unavailable.
