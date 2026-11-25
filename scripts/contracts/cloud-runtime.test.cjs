"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { configureCloudStorage, isOfficeRoute, isPublicAsset, allowedDocument } = require("../../cloud-runtime.cjs");

test("production documents default to persistent disk while existing overrides survive", () => {
  const data = path.join(os.tmpdir(), "synthetic-disk");
  const override = path.join(data, "existing-reports");
  const env = { NODE_ENV: "production", DATA_DIR: data, PROOFING_REPORT_DIR: override };
  configureCloudStorage(env, __dirname);
  assert.equal(env.PROOFING_REPORT_DIR, override);
  for (const [key, value] of Object.entries(env)) {
    if (key.endsWith("_DIR")) assert.ok(value.startsWith(data), key);
  }
  assert.equal(env.TECHNICIAN_APP_FILE, path.join(__dirname, "technician-app.html"));
  assert.throws(() => configureCloudStorage({ NODE_ENV: "production" }, __dirname), /DATA_DIR/);
  const local = {};
  configureCloudStorage(local, __dirname);
  assert.deepEqual(local, {});
});

test("office APIs fail closed without capturing technician or scoped automation routes", () => {
  for (const route of ["/api/data", "/api/local-file", "/api/runtime", "/api/publish-feeds", "/api/phase-07/jobs/dispatch", "/api/future-office-route"]) assert.equal(isOfficeRoute(route), true, route);
  for (const route of ["/api/phase-10/director-login", "/api/revolut/gbp-balance", "/api/automation/revolut/gbp-balance", "/api/phase-05b/technician-feed", "/api/phase-06a2/holiday-request", "/api/phase-07/jobs/accept", "/healthz"]) assert.equal(isOfficeRoute(route), false, route);
});

test("static files expose the UI and branding while excluding data, source and secrets", () => {
  for (const route of ["/", "/index.html", "/app.js", "/styles.css", "/assets/technician-icons/icon-192.png"]) assert.equal(isPublicAsset(route), true, route);
  for (const route of ["/.env.local", "/director-auth.cjs", "/data/command-centre-data.json", "/render.yaml", "/assets/../.env.local", "/assets/.private/image.png", "/scripts/private.js"]) assert.equal(isPublicAsset(route), false, route);
});

test("downloads stay inside document directories and exclude JSON credentials", t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "kw-download-test-"));
  t.after(() => {
    assert.ok(path.resolve(fixture).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(fixture, { recursive: true, force: true });
  });
  const docs = path.join(fixture, "documents");
  const sibling = path.join(fixture, "documents-private");
  fs.mkdirSync(docs); fs.mkdirSync(sibling);
  for (const file of [path.join(docs, "report.pdf"), path.join(docs, "token.json"), path.join(sibling, "report.pdf")]) fs.writeFileSync(file, "synthetic fixture");
  assert.equal(allowedDocument(path.join(docs, "report.pdf"), [docs]), true);
  assert.equal(allowedDocument(path.join(docs, "token.json"), [docs]), false);
  assert.equal(allowedDocument(path.join(sibling, "report.pdf"), [docs]), false);
  assert.equal(allowedDocument(path.join(docs, "missing.pdf"), [docs]), false);
});
