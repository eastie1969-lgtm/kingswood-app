# Kingswood Connect Design System

This is the product-wide design standard for Kingswood Connect. It applies to the whole Hub, not one page at a time.

Kingswood Connect must feel like one piece of premium business office software: fast, calm, clear, consistent, reliable, and easy for office staff to learn.

## Product Rules

- Treat every page as part of one connected office system.
- Reuse and improve shared components instead of creating one-off designs.
- Keep working logic, OneDrive saving, staff records, planner updates, exports, and integrations safe.
- Improve screens gradually. Do not redesign the whole app in one uncontrolled change.
- Hide technical details in normal office use. Store paths, IDs, JSON, and implementation details in the background.
- Use friendly business actions such as `View Certificate`, `Open Document`, `Save Record`, `Export Excel`, `Assign to Employee`, and `Mark Renewed`.

## Shared Components

### App Shell

The sidebar, top header, live office time, OneDrive status, global search, signed-in user and lock control are one shared shell. Any header or navigation change should be made globally, not separately per page.

### Page Layout

Use the same page rhythm everywhere:

- Page title and short supporting text
- Top action area
- Summary cards
- Filter/search bar
- Main table, profile panel, calendar, or work area

Avoid oversized empty panels and long pages where a two-panel or tabbed layout would be clearer.

### Panels And Cards

Use shared panel/card classes where possible:

- `work-panel`
- `summary-tile`
- `panel-heading`
- compact queue and alert cards

Cards should be useful, not decorative. Summary cards should show a number, a label, and a direct action or filter where appropriate.

### Buttons

Use the existing button hierarchy:

- `primary-button` for the main action
- `secondary-button` for supporting actions
- `danger-button` for destructive actions
- compact buttons only inside tables, queues, or tight action rows

Destructive actions must be visually distinct and must use the Kingswood Connect dialogue system before continuing.

### Forms

Forms should be clean, predictable, and office-friendly:

- Labels aligned consistently
- Inputs the same height unless they are notes, evidence, or document drop zones
- Two-column layout where it reduces scrolling
- Full-width notes and evidence/document areas
- No editable file path fields unless there is no safe alternative
- Do not ask users to type generated file names or OneDrive locations

### Tables

Use the shared table pattern:

- `table-shell`
- clear headers
- compact action buttons
- friendly file names
- status badges
- no raw paths as the main display

Tables should support search, filters, and click-through where useful.

### Status Badges

Use consistent status language and colours:

- Current / Live / Complete: positive
- Due Soon / Pending / Saving: warning
- Expired / Failed / Overdue / Delete: danger
- Draft / No Expiry / Not Set: neutral

Status should normally be calculated by the app, not typed manually by the user.

### Dialogues

All messages must use the global Kingswood Connect dialogue system.

Do not use:

- `alert()`
- `confirm()`
- `prompt()`
- browser default validation messages where a branded validation dialogue is possible

Use:

- `kcInfo`
- `kcAsk`
- `kcConfirmAction`
- `kcInput`

Dialogue heading should normally be `Kingswood Connect says`.

### File Upload And Evidence

Use one global pattern for documents, certificates, photos, screenshots, PDFs, and evidence:

- drag and drop
- file picker
- pasted screenshots where useful
- preview before save
- remove before save
- friendly file name shown to the user
- OneDrive location stored in the background

Do not create a new upload layout for each module unless the global component is being improved.

### Document Viewer

Document viewing should use one global document viewer pattern:

- friendly document title
- image preview in a clean modal
- PDF open/view action
- buttons for `Open file`, `Open folder`, `Download copy`, and `Close` where appropriate

Do not show the full OneDrive path as the main result.

### Empty States

Empty states should be small, calm, and useful.

Use simple messages such as:

- `No pending holiday requests.`
- `No training records found.`
- `No documents due for review.`

Avoid large empty boxes that dominate the screen.

### Loading And Saving States

OneDrive saving must be honest and visible.

Use the global OneDrive status language:

- `OneDrive Live`
- `Saving`
- `Save pending`
- `Offline`
- `Error`

Never show a successful save until OneDrive confirms the save. If OneDrive fails, keep a local pending backup and show a Kingswood Connect warning.

## Technical Information Policy

Do not normally show these to office users:

- local file paths
- raw OneDrive paths
- JSON
- internal IDs
- developer messages
- server implementation details

These can be stored, logged, or used in the background. If they must be shown for support, place them behind a deliberate technical/details action.

## Future Feature Checklist

Before adding or improving any feature:

1. Check whether a shared component already exists.
2. Reuse it if it fits.
3. Improve the shared component if the improvement should apply elsewhere.
4. Keep data and OneDrive saving safe.
5. Avoid showing technical details to office users.
6. Use global dialogue boxes.
7. Use friendly business wording.
8. Test the updated screen.
9. Confirm the local URL after the update.

## Current Shared Component Inventory

- App shell: sidebar, header, search, sign-in, lock, OneDrive status.
- Page panels: `work-panel`, `panel-heading`.
- Summary cards: `summary-tile`.
- Buttons: `primary-button`, `secondary-button`, `danger-button`.
- Tables: `table-shell`.
- Status badges: `status`.
- Global dialogue helpers: `kcInfo`, `kcAsk`, `kcConfirmAction`, `kcInput`.
- Certificate/document viewer: `certificateViewerDialog`.
- Evidence/file upload patterns: fines evidence, training certificates, compliance documents, RAMS builder paste area.
- OneDrive status helpers and save warnings.

When one of these improves, the improvement should be considered globally.
