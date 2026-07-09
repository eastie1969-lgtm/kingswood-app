# Kingswood Connect Hub

Kingswood Connect Hub is the central office and management system for Kingswood (London) Ltd.

It is the main business command centre for planning, administration, compliance, documents, staff, vehicles, assets, valuations, RAMS, reports and live operational visibility.

The old separate Admin App is no longer part of the intended final system. Office/admin work should be absorbed into the Kingswood Connect Hub.

## Design Standard

The permanent product-wide design authority is [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

All future UI work must follow that standard so Kingswood Connect feels like one piece of premium business office software, not separate pages stitched together.

## Current Architecture

Kingswood Connect is being shaped as two joined-up parts:

- **Kingswood Connect Hub** - the office and management system.
- **Technician App** - the field app used by technicians for jobs, RAMS, reports, photos, signatures and navigation.

Both should eventually use the same live business data so office actions and technician actions stay in sync automatically.

## Storage And Data

OneDrive is the current document and data storage layer.

While running locally, the Hub uses the local helper server to save data and generated documents into the Kingswood OneDrive folders. The browser cannot safely write directly to the C drive by itself, so the helper is needed for local file saving.

Current local data includes:

- `data/command-centre-data.json` - main Hub data.
- `data/technician-app-feed.json` - technician-facing job and operational feed.
- `data/connect-v12-feed.json` - bridge feed for the current technician/admin compatibility work.

The live production version must later use secure automatic cloud storage and shared data access. OneDrive remains useful for document storage, but the final live system should not depend on one local PC being switched on.

## How To Open Locally

Double-click:

`Start Kingswood Hub.cmd`

Then open:

`http://127.0.0.1:8126/index.html`

Keep the local helper running while using the Hub so OneDrive saves can complete.

## Main Hub Areas

### Dashboard

The office landing screen showing operational totals, alerts, OneDrive status, live office time, pending requests, valuation totals and quick routes into the key management areas.

### Job Dispatch

Office job creation and sending to the Technician App.

Jobs can be saved as drafts inside the Hub or sent to the Technician App. Sent jobs update the Weekly Planner using technician, date and AM/PM slot.

### Job Diary

Office view of jobs by date, client, technician, postcode and completion/report status.

### Weekly Planner

The operational weekly view showing technicians down the left, AM/PM rows, Monday to Friday columns, jobs, holiday, sickness and other availability notes.

### Live Vehicle Tracking

Live Vehicle Tracking now has a working **Test Mode** with an interactive map and simulated Kingswood vehicles.

This is a test data source only. It is designed so a real tracking provider can later replace the test data without rebuilding the screen.

### RAMS Centre

RAMS creation, review, revision, saving and sent-date tracking.

RAMS documents are managed here, not in Company Documents or Compliance Centre.

### Proofing Reports

Pest proofing report building, PDF generation and OneDrive saving.

Generated PDFs should keep a consistent Kingswood document style.

### Training Matrix

Training Matrix is the single source of truth for employee training, qualifications and certificates.

Staff Management must read the same training records by `staffId`. Do not create a separate training database inside Staff Management.

### Compliance Centre

Compliance Centre is for company-level compliance only.

It manages items such as:

- Public liability insurance.
- Employers' liability insurance.
- Fleet insurance.
- SafeContractor.
- Company policy review dates.
- Office compliance checks.
- Fire extinguisher servicing.
- Company-level certificates, accreditations and renewals.

It must not manage:

- Staff training or qualifications. These belong in Training Matrix.
- MOT, vehicle tax, vehicle servicing or vehicle insurance. These belong in Vehicles.
- RAMS. These belong in RAMS Centre.
- General company document tracking. These belong in Company Documents.

### Company Documents

Company Documents is a tracker for corporate, legal, policy, template and correspondence documents that already live in OneDrive.

It is not intended to replace OneDrive document storage or version history.

### Vehicles

Vehicle Management owns vehicle compliance and vehicle records, including MOT, tax, servicing, vehicle insurance, tracker status, mileage and vehicle-specific documents.

### Staff Management

Staff Management covers employee records, holiday, sickness, attendance, availability, emergency contacts, assigned vans and staff profile information.

Training records shown in Staff Management should come from Training Matrix.

### Assets, Tools & Equipment

Assets, Tools & Equipment is being developed into a full Kingswood asset register for machinery, power tools, hand tools, ladders, access equipment, pest control equipment, sprayers, testing equipment, cameras, PPE equipment, vehicle equipment and office equipment.

It uses Staff Management and Vehicles data for assignment instead of duplicating employee or vehicle records.

### Fines And Charges

Fines and Charges tracks parking tickets, congestion charges, ULEZ, speeding, bus lane, Dart Charge and other vehicle-related charges, including evidence and payment history.

### Clients

Client records for Ark, JG Pest Control, Private clients, housing associations and other customers.

## Integration Direction

The intended long-term shape is:

- The Hub controls office planning, compliance, staff, vehicles, documents, assets, valuations, RAMS and administration.
- The Technician App receives the correct field work, RAMS, navigation, reporting tasks and technician-specific records.
- Both use shared live business data.
- OneDrive stores documents and current local data.
- A secure cloud data layer should later handle production multi-user storage, permissions and live sync.

## Important Data Safety Rules

- Do not pretend a save has completed unless OneDrive or the final storage layer confirms it.
- Keep a local pending backup if OneDrive saving fails.
- Do not overwrite existing OneDrive files silently.
- Keep previous documents and history where renewal, replacement or disposal is involved.
- Do not show raw file paths, JSON or internal IDs to office users unless there is a deliberate support/debug reason.

## Staff And Job Planning Rule

The Job Diary and Job Dispatch must respect staff availability.

If a technician is sick, on holiday, training, absent, late, or on unpaid leave, the office should see a warning before assigning work. Where the system rules require it, the technician should be blocked from being selected.

## Current Build Approach

Build the Hub gradually, section by section, while keeping existing data safe.

Every new or improved screen must follow [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).
