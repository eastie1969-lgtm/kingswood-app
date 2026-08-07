const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..", "..");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "kw-clean-first-use-"));
const dataFile = path.join(dataDir, "command-centre-data.json");
const port = 8167;

const kevinProfile = {
  staffId: "STAFF-20260716-012",
  name: "Kevin Eastman",
  role: "Director",
  status: "Active",
  employmentStatus: "Active",
  directorAccessAuthority: true,
  phase10DirectorAccess: true,
  payrollActive: false
};

function writeData(data) {
  fs.writeFileSync(dataFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function requestJson(method, route, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const request = http.request({
      hostname: "127.0.0.1",
      port,
      path: route,
      method,
      headers: {
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (response) => {
      let raw = "";
      response.on("data", (chunk) => { raw += chunk; });
      response.on("end", () => {
        resolve({
          status: response.statusCode,
          body: raw ? JSON.parse(raw) : {}
        });
      });
    });
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await requestJson("GET", "/api/phase-05e/hub-report-status");
      if (response.status === 200) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error("Preview server did not start.");
}

(async () => {
  writeData({ staffProfiles: [kevinProfile] });
  const server = childProcess.spawn(process.execPath, [".preview-server.cjs"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", DATA_DIR: dataDir },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer();

    const anonymous = await requestJson("GET", "/api/data");
    assert.strictEqual(anonymous.status, 401, "Anonymous /api/data reads must be blocked.");

    const authorised = await requestJson("GET", "/api/data", undefined, { "X-Kingswood-User": "Kevin" });
    assert.strictEqual(authorised.status, 200, "Authenticated /api/data reads must work.");

    const malformed = await requestJson("POST", "/api/data", { jobs: [] }, { "X-Kingswood-User": "Kevin" });
    assert.strictEqual(malformed.status, 409, "Zero-staff replacements must still be rejected.");

    const fallback = await requestJson("POST", "/api/data", {
      staffProfiles: [{ name: "Dan" }, { name: "Mason" }],
      jobs: [{ technician: "Dan" }]
    }, { "X-Kingswood-User": "Kevin" });
    assert.strictEqual(fallback.status, 409, "Starter/demo browser fallback saves must still be rejected.");

    const cleanSave = await requestJson("POST", "/api/data", {
      staffProfiles: [kevinProfile],
      jobs: [],
      technicians: [],
      vehicles: [],
      clients: []
    }, { "X-Kingswood-User": "Kevin" });
    assert.strictEqual(cleanSave.status, 200, "A valid new-system save with one genuine profile must be accepted.");

    writeData({
      staffProfiles: Array.from({ length: 14 }, (_, index) => ({ staffId: `STAFF-${index}`, name: `Test ${index}` })),
      jobs: [],
      technicians: []
    });
    const destructive = await requestJson("POST", "/api/data", {
      staffProfiles: [kevinProfile],
      jobs: []
    }, { "X-Kingswood-User": "Kevin" });
    assert.strictEqual(destructive.status, 409, "Shrinking a populated staff dataset must still be rejected.");

    writeData({ staffProfiles: [kevinProfile] });
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.addInitScript(() => localStorage.setItem("kingswood-hub-user", "Kevin"));
    const savePayloads = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/data") && request.method() === "POST") {
        const data = JSON.parse(request.postData() || "{}");
        const count = (key) => Array.isArray(data[key]) ? data[key].length : 0;
        savePayloads.push({
          staffProfiles: count("staffProfiles"),
          jobs: count("jobs"),
          technicians: count("technicians"),
          vehicles: count("vehicles"),
          clients: count("clients"),
          text: JSON.stringify(data)
        });
      }
    });
    await page.goto(`http://127.0.0.1:${port}/index.html?section=dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const bodyText = await page.locator("body").innerText();
    assert(!/\b(Dan|Mason|Aiden)\b/.test(bodyText), "Production hosted loads must not render starter staff names.");
    assert(savePayloads.every((payload) =>
      payload.staffProfiles === 1
      && payload.jobs === 0
      && payload.technicians === 0
      && payload.vehicles === 0
      && payload.clients === 0
      && !/\b(Dan|Mason|Aiden)\b/.test(payload.text)
    ), "Outgoing production saves must not include starter records.");
    await browser.close();

    console.log(JSON.stringify({
      ok: true,
      dataDir,
      savePayloads: savePayloads.map(({ text, ...safe }) => safe)
    }, null, 2));
  } finally {
    server.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
