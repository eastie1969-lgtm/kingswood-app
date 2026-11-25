# Kingswood Hub

This repository is the hosted Hub source. Inspect the current branch before editing; older OneDrive copies can predate deployed authentication fixes.

- Preserve `director-auth.cjs` sessions, CSRF protection and private host credentials.
- Keep technician session routes separate from office routes and preserve the scoped read-only banking automation.
- Production document paths belong on the persistent disk. Preserve existing environment overrides.
- Never commit live business data, reports, PIN lists, local environment files or bank credentials.
- Use synthetic temporary data for tests. Never run destructive checks against the live service.
- Install with `npm ci`, check with `npm run check` and test with `npm run test:cloud`.
- Read `CLOUD-DEVELOPMENT.md` before changing hosting or storage.

Cloud development must use a working branch and synthetic fixtures. Preserve the live persistent disk when deploying code.
