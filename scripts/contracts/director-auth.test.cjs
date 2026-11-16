"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { once } = require("node:events");
const { createDirectorAuth, sameOrigin, TTL } = require("../../director-auth.cjs");

// Synthetic test credentials only. Never load production credentials or services.
const credentials = { Kevin: "81234567", Alex: "92345678" };
const contextForName = name => ["Kevin", "Alex"].includes(name)
  ? { displayName: name, role: "Director", staffId: name === "Kevin" ? "STAFF-20260716-012" : "STAFF-20260716-011" }
  : null;
const request = (headers = {}) => ({ headers });
const cookieRequest = result => request({ cookie: result.setCookie.split(";")[0] });

test("names and forged/unknown cookies cannot authenticate", () => {
  const auth = createDirectorAuth({ credentials, contextForName });
  for (const headers of [{}, { "x-kingswood-user": "Kevin" }, { cookie: "kw_phase10_director_session=forged" }, { cookie: "kw_phase10_director_session=%ZZ" }]) {
    assert.equal(auth.session(request(headers)).status, 401);
  }
});

test("normal authentication, secure cookie, CSRF, session replacement and logout", () => {
  const auth = createDirectorAuth({ credentials, contextForName, production: true });
  const signed = auth.login(request(), { name: "Kevin", pin: credentials.Kevin });
  assert.equal(signed.ok, true);
  assert.match(signed.setCookie, /HttpOnly; SameSite=Strict; Path=\/; Max-Age=1800; Secure/);
  const req = cookieRequest(signed);
  assert.equal(auth.session(req).session.context.displayName, "Kevin");
  assert.equal(auth.csrf(request(), signed.session), false);
  assert.equal(auth.csrf(request({ "x-csrf-token": "wrong" }), signed.session), false);
  assert.equal(auth.csrf(request({ "x-csrf-token": signed.session.csrfToken }), signed.session), true);
  const replacement = auth.login(req, { name: "Alex", pin: credentials.Alex });
  assert.equal(auth.session(req).status, 401);
  const next = cookieRequest(replacement);
  assert.equal(auth.session(next).session.context.displayName, "Alex");
  auth.logout(next);
  assert.equal(auth.session(next).status, 401);
  assert.match(auth.cookie("", 0), /Max-Age=0/);
});

test("expiry and role removal revoke sessions without header renewal", () => {
  let clock = 1000;
  let active = true;
  const auth = createDirectorAuth({ credentials, now: () => clock, contextForName: name => active ? contextForName(name) : null });
  const first = auth.login(request(), { name: "Kevin", pin: credentials.Kevin });
  clock += TTL;
  assert.equal(auth.session({ headers: { ...cookieRequest(first).headers, "x-kingswood-user": "Kevin" } }).status, 401);
  const second = auth.login(request(), { name: "Kevin", pin: credentials.Kevin });
  active = false;
  assert.equal(auth.session(cookieRequest(second)).status, 403);
});

test("wrong PIN, non-director, absent config and short credentials fail closed", () => {
  const auth = createDirectorAuth({ credentials, contextForName });
  assert.equal(auth.login(request(), { name: "Kevin", pin: "wrong" }).status, 403);
  assert.equal(auth.login(request(), { name: "Jodie", pin: credentials.Kevin }).status, 403);
  for (const configured of [{}, { Kevin: "1234" }]) {
    assert.equal(createDirectorAuth({ credentials: configured, contextForName }).login(request(), { name: "Kevin", pin: configured.Kevin }).status, 403);
  }
  assert.equal(createDirectorAuth({ credentials, contextForName: () => ({ role: "Staff" }) }).login(request(), { name: "Kevin", pin: credentials.Kevin }).status, 403);
});

test("repeated failures are throttled and recover after the window", () => {
  let clock = 0;
  const auth = createDirectorAuth({ credentials, contextForName, now: () => clock });
  for (let i = 0; i < 5; i++) assert.equal(auth.login(request(), { name: "Kevin", pin: "wrong" }).status, 403);
  assert.equal(auth.login(request(), { name: "Kevin", pin: credentials.Kevin }).status, 429);
  clock = 15 * 60 * 1000 + 1;
  assert.equal(auth.login(request(), { name: "Kevin", pin: credentials.Kevin }).ok, true);
});

test("CSRF origin guard rejects cross-origin, null-origin and originless mutations", () => {
  const origin = "https://kingswood-hub.onrender.com";
  for (const supplied of [undefined, "null", "https://attacker.invalid"]) {
    assert.equal(sameOrigin({ method: "POST", headers: { origin: supplied } }, origin), false);
  }
  assert.equal(sameOrigin({ method: "POST", headers: { origin } }, origin), true);
  assert.equal(sameOrigin({ method: "GET", headers: {} }, origin), true);
  assert.equal(sameOrigin({ method: "GET", headers: { origin: "https://attacker.invalid" } }, origin), false);
});

test("actual server routes enforce sessions and CSRF; balance remains read-only", async t => {
  const root = path.resolve(__dirname, "../..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "kw-director-auth-test-"));
  const dataDir = path.join(fixture, "data");
  fs.mkdirSync(dataDir);
  fs.writeFileSync(path.join(dataDir, "command-centre-data.json"), JSON.stringify({
    staffProfiles: [
      { ...contextForName("Kevin"), name: "Test Director", status: "Active" },
      { ...contextForName("Alex"), name: "Test Other Director", status: "Active" }
    ], jobs: [], technicians: [], vehicles: [], clients: []
  }));
  const source = fs.readFileSync(path.join(root, ".preview-server.cjs"), "utf8");
  const origin = "https://kingswood-hub.onrender.com";
  const env = { PORT: "0", HOST: "127.0.0.1", NODE_ENV: "production", RENDER_EXTERNAL_URL: origin,
    KINGSWOOD_DIRECTOR_KEVIN_PIN: credentials.Kevin, KINGSWOOD_DIRECTOR_ALEX_PIN: credentials.Alex,
    DATA_DIR: dataDir, USERPROFILE: fixture, PHASE05E_DISABLE_FOLDER_LAUNCH: "1" };
  for (const key of ["PROOFING_REPORT_DIR", "FIELD_REPORTS_DIR", "RAMS_DOCUMENT_DIR", "STAFF_RECORDS_DIR",
    "EMPLOYEES_ROOT_DIR", "TRAINING_MATRIX_EXPORTS_DIR", "FINES_AND_CHARGES_DIR", "COMPANY_COMPLIANCE_DIR",
    "ASSETS_ROOT_DIR", "VEHICLE_RECORDS_DIR", "DIRECTORS_AREA_DIR", "REVOLUT_BUSINESS_API_DIR"]) env[key] = path.join(fixture, key);
  const realRequire = createRequire(path.join(root, ".preview-server.cjs"));
  let server;
  let balanceReads = 0;
  const sandbox = {
    require(name) {
      if (name === "https") return { request() { throw new Error("External network forbidden in auth tests"); } };
      if (name === "http") return { ...http, createServer(handler) { server = http.createServer(handler); return server; } };
      return realRequire(name);
    },
    __dirname: root, process: { env, platform: process.platform }, console: { log() {}, error() {} },
    Buffer, URL, setTimeout, clearTimeout, setInterval, clearInterval,
    syntheticBalance: async () => { balanceReads++; return { ok: true, connected: true, activeGbpAccountFound: true, availableBalance: 0 }; }
  };
  vm.runInNewContext(source.replace("server.listen(port, host);", "revolutGbpBalanceSnapshot = syntheticBalance;\nserver.listen(port, host);"), sandbox, { filename: ".preview-server.cjs" });
  await once(server, "listening");
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    // Only the absolute temporary fixture created above is removed.
    assert.ok(path.resolve(fixture).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(fixture, { recursive: true, force: true });
  });
  async function call(route, method = "GET", body, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port: server.address().port, path: route, method,
        headers: { ...(body !== undefined ? { "Content-Type": "application/json", Origin: origin } : {}), ...headers }
      }, res => {
        let raw = "";
        res.on("data", chunk => raw += chunk);
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: raw ? JSON.parse(raw) : {} }));
      });
      req.on("error", reject);
      if (body !== undefined) req.end(JSON.stringify(body)); else req.end();
    });
  }
  for (const route of ["/api/phase-10/director-session", "/api/phase-10/overview", "/api/phase-10/company-details", "/api/revolut/gbp-balance"]) {
    assert.equal((await call(route)).status, 401);
    assert.equal((await call(route, "GET", undefined, { "X-Kingswood-User": "Kevin" })).status, 401);
  }
  assert.equal(balanceReads, 0);
  assert.equal((await call("/api/phase-10/director-login", "POST", { name: "Jodie", pin: credentials.Kevin })).status, 403);
  const signed = await call("/api/phase-10/director-login", "POST", { name: "Kevin", pin: credentials.Kevin });
  assert.equal(signed.status, 200);
  assert.ok(signed.body.csrfToken);
  const cookie = signed.headers["set-cookie"][0].split(";")[0];
  const headers = { Cookie: cookie, "X-CSRF-Token": signed.body.csrfToken };
  assert.equal((await call("/api/phase-10/director-session", "GET", undefined, headers)).status, 200);
  const balance = await call("/api/revolut/gbp-balance", "GET", undefined, headers);
  assert.equal(balance.status, 200);
  assert.equal(balance.headers["cache-control"], "no-store");
  assert.equal(balance.headers["access-control-allow-origin"], undefined);
  assert.equal(balanceReads, 1);
  assert.equal((await call("/api/revolut/gbp-balance", "POST", {}, headers)).status, 405);
  assert.equal(balanceReads, 1);
  assert.equal((await call("/api/phase-10/director-logout", "POST", {}, { Cookie: cookie })).status, 403);
  assert.equal((await call("/api/phase-10/director-logout", "POST", {}, { ...headers, Origin: "https://attacker.invalid" })).status, 403);
  const out = await call("/api/phase-10/director-logout", "POST", {}, headers);
  assert.equal(out.status, 200);
  assert.match(out.headers["set-cookie"][0], /Max-Age=0/);
  assert.equal((await call("/api/revolut/gbp-balance", "GET", undefined, { ...headers, "X-Kingswood-User": "Kevin" })).status, 401);
  assert.equal(balanceReads, 1);
});

test("browser sign-in sends director PIN only to server and clears cached director data", () => {
  const root = path.resolve(__dirname, "../..");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const localUsers = app.match(/const authorisedUsers = \{([\s\S]*?)\};/)[1];
  assert.doesNotMatch(localUsers, /Kevin|Alex/);
  assert.match(app, /directorsApi\("\/director-login"/);
  assert.match(app, /directorSession\?\.csrfToken/);
  assert.match(app, /authGeneration !== directorAuthGeneration/);
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /id="pinInput"[^>]*maxlength="64"/);
  assert.match(html, /id="directorLogoutButton"/);
});

