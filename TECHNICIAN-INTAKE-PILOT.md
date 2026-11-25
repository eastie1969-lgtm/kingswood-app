# Technician visit intake pilot

Historical proof record. The implementation has since moved to resumable uploads and server-verified sign-in. Follow `TECHNICIAN-VISIT-INTAKE.md` for the current review build, configuration and tests. The older single-request browser test has been replaced by `visit-intake-review-browser.cjs`.

This branch extends `technician-app.html`. It does not create a second application. It is disabled unless `KINGSWOOD_INTAKE_PILOT=1` and `NODE_ENV` is not `production`. Do not merge or deploy it as a production rollout.

## Existing save traced

The existing browser uploads images to Cloudinary, then sends report JSON and image URLs to `saveReportToOneDrive` on Cloud Run / Firebase, in `europe-west2`. The deployed source archive was downloaded read-only and its `index.js` SHA-256 matched the office source exactly: `71c163df0608912f3f1c9c846faa227721278ade48a2ab2df9dba64ee46dda4f`.

That function writes to the configured office user's OneDrive under `Kingswood Field Reports/<date> - <technician> - <job title>/`. It writes `REPORT.txt`, `JOB_DETAILS.txt`, `ARK_SCREENSHOT.txt` and numbered photos. Every PUT is awaited and its HTTP status checked, but there is no file read-back, byte comparison, immutable manifest, stable visit key or preservation of original camera names. Colliding date/technician/title paths can replace files. Failure can leave a partial folder. A successful response is evidence of accepted upload requests, not an independent verification of the complete visit.

The browser's authenticated path trusts `ok` and posts client-supplied save booleans to the Hub report-completion route. That route validates the booleans and minimum photo count but does not verify OneDrive. It marks a job Completed. The legacy path completes locally before the OneDrive call returns and can show success after a failed upload. Existing replay protection covers Hub report metadata by report ID; it does not protect the earlier cloud uploads, and the browser creates a new report ID on reopening.

Cloud listing of the actual configured root found only `Proofing Reports` during this investigation. No historical technician visit was independently established there. No production upload was invoked.

## Pilot behavior

- Existing technician name/PIN UI, server session and assigned-job screen; the Start Report action opens the visit intake within that same app.
- Date, signed-in technician, visit notes and original image files. The server uses the isolated office-verified job mapping for ARK reference, address and flat. Technician-entered identity/address/reference are not accepted.
- Optional Before / After / Context labels. No pairing requirement. Fewer than six images are accepted with a missing/limited-evidence explanation and flagged for review. Evidence sufficiency remains an office decision.
- Original bytes go directly from the app to the Hub and Microsoft Graph, without Cloudinary or image conversion. Indexed cloud filenames prevent camera-name collisions; the manifest retains exact original filenames, MIME type, size, SHA-256, label and exact cloud file references.
- IndexedDB stores notes, original File objects and a stable submission ID before transmission. Draft creation is transactional. Submitted content is frozen for retry. Storage failures block transmission instead of claiming a durable draft.
- Retry/reopen reconciles first. Every expected original and note is downloaded from OneDrive and hash-checked before a receipt. The verifier checks the manifest against the locally bound payload, expected file inventory and exact cloud IDs. Partial saves resume without replacing matching files; changed content under an existing ID is rejected.
- Receipt says `Received for review`, with `arkReportSaved: false`. It does not complete the job, write report metadata, save to Firestore, change a tracker, save ARK, approve evidence or alter Albert's template / Second Look / approval gates.
- Existing priority popups are deferred while the pilot form is open, and can reappear on returning to jobs.
- Pilot feeds exclude the Hub's historical Phase 5A demonstration jobs. Those samples have no verified intake mapping. If a test draft was created under the old Ian demonstration job, opening the verified dummy job offers an explicit recovery button. It copies the saved notes, date, explanation and original File objects while retaining the submission ID; the original draft remains stored. The technician reviews the new dummy reference/address before submitting. No live-job identity is remapped.

## Isolation and configuration

Use a fresh checkout and a private configuration file OUTSIDE the repository. The pilot requires an explicitly isolated `DATA_DIR`. Set the existing server's document, employee, vehicle, field-report and other filesystem roots to separate disposable test directories. Never copy live jobs into the test data file. Keep credentials, drive/folder IDs, tenant details, test media, browser profiles and private cloud URLs outside this public repository.

`KINGSWOOD_INTAKE_CONFIG` is a private JSON file containing `driveId`, `rootId`, `tenantId`, `clientId` and `jobs`. Each synthetic verified job has `jobId`, `assignedTechnicianId`, `arkReference`, `address`, optional `flat`, and `intakeVerified: true`. `KINGSWOOD_INTAKE_GRAPH_SECRET` is provided only in server memory/environment using existing authorised credentials. The root must be a dedicated private pilot folder. The code creates only submission subfolders beneath that exact root; it never creates sharing links or changes permissions.

`KINGSWOOD_INTAKE_FAULT_FILE` optionally points to an external test control file. A value of `after-photo:1` injects a one-time failure after the first verified cloud original, then consumes that control file. There is no HTTP fault-control endpoint.

## Validation

Run `node --test scripts/contracts/visit-intake.test.cjs` and `npm run check`. The service tests cover missing photos with an explanation, validation, assigned identity, verified mapping, replay, changed content, corrupted cloud notes and omitted manifest evidence.

With the isolated pilot server running, `node scripts/contracts/visit-intake-browser.cjs` uses the actual name/PIN sign-in and job screens at a phone-sized viewport. It exercises three synthetic original PNGs (including distinct images with identical camera filenames), labels, missing-evidence review, 360/390/430px layouts, offline failure, partial cloud save, full browser restart, retry, deliberately lost final response, reconciliation without resubmission, unchanged job completion state and denied unassigned-job access. External browser network traffic is blocked during the test. Private results/screenshots are written outside the checkout using `INTAKE_TEST_DIR`. The test intentionally creates a dummy cloud submission; do not run it against production or a non-isolated folder.

The completed pilot visit was independently listed and its note/manifest read through the OneDrive connector. A separate Graph read-back compared all three downloaded originals with the fixture hashes and original names, checked exactly one visit and five files, and inspected the unchanged permissions. This is cloud evidence, not proof inferred from a synced local file or upload response.

## Rollout gates and limits

- This is an isolated branch proof, not a released phone app. No main-branch deployment, production endpoint changes, permission changes, live-job writes, tracker changes or ARK saves were made.
- The existing sign-in is retained for this test. Its PIN comparison is in browser code, while the server login resolves a technician from the selected name without checking that PIN. It must receive a proper server-side identity check before any externally reachable rollout; an assigned-job session alone does not fix that existing weakness. No authentication/permission change was made in this pilot.
- The verified mapping is synthetic pilot configuration. Rollout needs a trusted live assigned-visit mapping with explicit verified ARK reference, address/flat and current assignment/version checks. Do not infer ARK identity from a free-text title or address match.
- Local durable ledger and frozen IndexedDB drafts are pilot state. Production needs an agreed durable receipt store, retention policy, operational retry/recovery monitoring and support for additional visits. Browser storage can be cleared or evicted; the application shell is not currently available for a cold start without connectivity. Reopen/retry was tested after reconnection.
- Photos are limited to 20, 15 MB each and 96 MB per visit. This prototype sends a bounded JSON/base64 request; large original-camera batches should use staged/chunked uploads before wider rollout. Only tiny synthetic PNG originals were exercised end-to-end; real-device camera/HEIC, large-file and mobile-browser eviction tests remain.
- Phone viewport tests used desktop Chromium; a physical phone over a remote test URL has not been tested. No public preview was deployed.
- Albert's separate read-only dummy-folder check was requested with Kev's explicit permission. The app safety system blocked that assistant's turn with `Potentially unintended activity`; it did not return a read-back. Albert access remains UNCONFIRMED. Do not reroute around that block, expand permissions or count our independent OneDrive verification as Albert's confirmation.
- Kev must review the pilot result before authorising rollout. Existing Albert report format, Second Look checks and exact report approval before ARK save remain in force.

Implementation references: [Microsoft Graph upload](https://learn.microsoft.com/graph/api/driveitem-put-content), [download/read-back](https://learn.microsoft.com/graph/api/driveitem-get-content), and [conflict behavior](https://learn.microsoft.com/graph/api/resources/driveitem).
