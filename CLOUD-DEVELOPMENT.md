# Kingswood Hub cloud development

## Application

The existing app is hosted at https://kingswood-hub.onrender.com/ and the technician entry is /technician-app.html. It runs as a Render Node service with a 5 GB persistent disk mounted at /var/data. Existing director credentials are configured privately in Render; do not replace them with default PINs or commit them.

The current GitHub source has newer sign-in protections than the office OneDrive copy. Develop from this repository's current branch. The earlier source-only export prepared from the office folder must not replace the hosted authentication modules.

## Development

Install with npm ci. Run npm run check and npm run test:cloud. Tests use synthetic temporary data, do not connect to bank APIs and do not modify the live disk. npm start runs the local server; production requires an absolute DATA_DIR on persistent storage. Production director sign-in also requires existing KINGSWOOD_DIRECTOR_KEVIN_PIN and KINGSWOOD_DIRECTOR_ALEX_PIN secrets.

For a disposable local demo, run npm run dev:demo and use the synthetic sign-in printed by the launcher. It uses a new temporary data directory and must not be run on Render production. Stop it when finished; no business data is imported.

For remote development, connect this repository to a Codex Cloud environment and select that environment when starting work. The current local chat is not automatically transferred by deploying the app. The repository currently has public visibility; do not add private records. A private source repository remains preferable for continued business development and requires access to GitHub account setup.

## Storage and access

Production defaults all document areas beneath DATA_DIR, including RAMS, staff records, training exports, vehicles, assets and compliance. Explicit existing directory settings are preserved. Banking files remain in their separate secret directory and are never exposed through document downloads.

Office APIs require a director session and mutations require the session's CSRF token and matching origin. Technician routes retain their own technician sessions. The existing read-only automation route retains its separate scoped identity checks. Public responses include the sign-in UI, app JavaScript, styling, branding and health check; raw data and server files are excluded.

Cloud saves are displayed as Cloud saved rather than OneDrive Live. This does not add Microsoft Graph or SharePoint synchronisation. Windows folder-opening actions still require further adaptation for a cloud-only workflow. Existing document records with office-only Windows paths require document migration and reconciliation; do not rewrite them blindly.

## Deployment

Preserve the Render service, mounted disk, data, bank secrets and director credentials. Back up current records before a rollout. Code deployment must not copy local data over hosted data. A successful health check and access-boundary tests do not certify every office business workflow or PDF rendering.

The first remote rollout should verify login, saved data, job dispatch, technician changes and document creation/download. Reconcile the local and hosted datasets separately before importing any office changes.
