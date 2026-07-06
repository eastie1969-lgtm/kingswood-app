# Kingswood Hub Hosting

The Hub is now prepared to run as a hosted Node web service.

## Recommended host

Use Render for the hosted version. It gives you a normal web address and can run this Hub server without changing the app into a different system.

## Important

The live hosted version will not save directly to the OneDrive folder on Kev's PC. A hosted server is not on that computer.

For the first hosted version, use Render storage:

- `DATA_DIR=/var/data`
- `PROOFING_REPORT_DIR=/var/data/proofing-reports`

Later, for true OneDrive cloud saving from anywhere, connect Microsoft Graph / SharePoint properly.

## Render setup

1. Put this Kingswood Hub folder into a private GitHub repository.
2. In Render, create a new Web Service from that repository.
3. Use:
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/healthz`
4. Add environment variables:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL=gpt-5.4-mini`
   - `DATA_DIR=/var/data`
   - `PROOFING_REPORT_DIR=/var/data/proofing-reports`
5. If Render does not pick this up from `render.yaml`, add a persistent disk:
   - Name: `kingswood-hub-data`
   - Mount path: `/var/data`
   - Size: `5 GB`
6. Deploy.

Render will give a URL like:

`https://kingswood-hub.onrender.com`

## Local testing

On Kev's computer, use:

`Start Kingswood Hub.cmd`

The local URL remains:

`http://127.0.0.1:8126/index.html`
