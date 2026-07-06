# Kingswood Hub Go-Live Steps

This is the simple route to get a proper URL.

## What we need

1. A private GitHub repository for the Kingswood Hub files.
2. A Render account connected to that GitHub repository.
3. A Render Web Service using this folder.
4. A persistent disk mounted at `/var/data`.
5. The OpenAI key added in Render as a secret environment variable.

## Render settings

Use these:

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/healthz`
- Disk mount path: `/var/data`

Environment variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-5.4-mini`
- `DATA_DIR=/var/data`
- `PROOFING_REPORT_DIR=/var/data/proofing-reports`

## What the URL will look like

Render will give a live URL like:

`https://kingswood-hub.onrender.com`

## Important

This gives the Hub a proper online home.

The next phase is proper Microsoft OneDrive / SharePoint integration, so reports and Hub data can sync into Kingswood cloud storage rather than only Render storage.
