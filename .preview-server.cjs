const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8126);
const host = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const dataDir = process.env.DATA_DIR || path.join(root, "data");
const dataFile = path.join(dataDir, "command-centre-data.json");
const dataBackupDir = path.join(dataDir, "backups");
const technicianFeedFile = path.join(dataDir, "technician-app-feed.json");
const adminFeedFile = path.join(dataDir, "admin-app-feed.json");
const connectV12FeedFile = path.join(dataDir, "connect-v12-feed.json");
const localEnvFile = path.join(root, ".env.local");
const proofingReportDir = process.env.PROOFING_REPORT_DIR
  || path.resolve(root, "..", "..", "Kingswood Field Reports", "Proofing Reports");

if (fs.existsSync(localEnvFile)) {
  const envLines = fs.readFileSync(localEnvFile, "utf8").split(/\r?\n/);
  envLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
    }
  });
}

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store"
};

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function safeFileName(value, fallback = "proofing-report") {
  return String(value || fallback)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || fallback;
}

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + "-" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

function pruneBackups(prefix, keep = 75) {
  if (!fs.existsSync(dataBackupDir)) return;
  const files = fs.readdirSync(dataBackupDir)
    .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
    .sort()
    .reverse();

  files.slice(keep).forEach((file) => {
    try {
      fs.unlinkSync(path.join(dataBackupDir, file));
    } catch {
      // A locked backup is harmless; OneDrive may be syncing it.
    }
  });
}

function backupExistingFile(filePath, prefix) {
  if (!fs.existsSync(filePath)) return null;
  fs.mkdirSync(dataBackupDir, { recursive: true });
  const backupPath = path.join(dataBackupDir, `${prefix}-${timestampForFile()}.json`);
  fs.copyFileSync(filePath, backupPath);
  pruneBackups(prefix);
  return backupPath;
}

function writeJsonSafely(filePath, content, backupPrefix) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const backupPath = backupExistingFile(filePath, backupPrefix);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, content, "utf8");
  fs.renameSync(tempPath, filePath);
  return backupPath;
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const bundledPath = path.join(
      process.env.USERPROFILE || "",
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "node",
      "node_modules",
      "playwright"
    );
    return require(bundledPath);
  }
}

function readRequestBody(request) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
  });
}

function localRamsDraft(payload) {
  const job = payload.job || {};
  const source = String(payload.source || payload.scope || "Site-specific works to be reviewed before starting.").trim();
  const lines = source
    .split(/\r?\n|•|-/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2)
    .slice(0, 6);
  const hazards = (lines.length ? lines : [
    "Access to work area and changing site conditions",
    "Use of hand tools and proofing materials",
    "Residents, site staff or public near the work area"
  ]).map((line) => ({
    hazard: "Site-specific hazard",
    who: "Technicians, residents, site staff and members of the public",
    controls: line,
    further: "Stop work and contact the office if site conditions change.",
    owner: job.technician || "Assigned technician",
    due: job.date || new Date().toISOString().slice(0, 10)
  }));

  return {
    title: `${job.address || "Job"} RAMS`,
    scope: payload.scope || `Carry out the planned works at ${job.address || "the job address"} in line with Kingswood procedures.`,
    ppe: ["Safety boots", "Gloves", "Hi-vis", "Eye protection as required"],
    equipment: ["Hand tools", "Access equipment", "Proofing materials", "Waste bags"],
    hazards,
    method: [
      "Attend site, sign in where required and confirm access arrangements.",
      "Review the work area and confirm the RAMS match the actual site conditions.",
      "Set up the work area, keep routes clear and protect residents / public from the works.",
      "Carry out the works using the agreed tools, PPE and controls.",
      "Remove waste, check the area is safe, take completion photos and report any changes."
    ]
  };
}

async function openAiRamsDraft(payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { aiUsed: false, draft: localRamsDraft(payload) };
  }

  const prompt = [
    "Create a UK RAMS draft for Kingswood London Ltd.",
    "Use clear, professional wording suitable for office review before issue.",
    "Do not invent legal approvals, certifications, signatures or site facts not provided.",
    "Keep the output practical for pest proofing, access, public/resident safety, PPE, tools, waste, and stop-work/change-control.",
    "The document must still be reviewed by a competent person before issue."
  ].join(" ");

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      scope: { type: "string" },
      ppe: { type: "array", items: { type: "string" } },
      equipment: { type: "array", items: { type: "string" } },
      method: { type: "array", items: { type: "string" } },
      hazards: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            hazard: { type: "string" },
            who: { type: "string" },
            controls: { type: "string" },
            further: { type: "string" },
            owner: { type: "string" },
            due: { type: "string" }
          },
          required: ["hazard", "who", "controls", "further", "owner", "due"]
        }
      }
    },
    required: ["title", "scope", "ppe", "equipment", "method", "hazards"]
  };

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      input: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(payload, null, 2) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "kingswood_rams_draft",
          schema,
          strict: true
        }
      }
    })
  });

  const result = await upstream.json();
  if (!upstream.ok) {
    throw new Error(result.error?.message || "OpenAI request failed");
  }

  const outputText = result.output_text || result.output?.flatMap((item) => item.content || [])
    .find((part) => part.type === "output_text")?.text;

  return { aiUsed: true, draft: JSON.parse(outputText) };
}

function localProofingReportDraft(payload) {
  const notes = String(payload.notes || "").trim();
  const lines = notes.split(/\r?\n|•|-/).map((line) => line.trim()).filter((line) => line.length > 2);
  return {
    clientName: "",
    propertyAddress: "",
    dateOfWorks: "",
    operativeName: "",
    areaOfWorks: "",
    hygieneLevel: "",
    rodentActivity: "",
    jobStatus: "",
    summary: "Kingswood attended site to inspect and complete pest proofing works as detailed below.",
    worksCarriedOut: lines.slice(0, 8),
    materialsUsed: [],
    findingsRecommendations: "All accessible work areas should be monitored and any further signs of activity reported for review."
  };
}

async function openAiProofingReportDraft(payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { aiUsed: false, draft: localProofingReportDraft(payload) };
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      clientName: { type: "string" },
      propertyAddress: { type: "string" },
      dateOfWorks: { type: "string" },
      operativeName: { type: "string" },
      areaOfWorks: { type: "string" },
      hygieneLevel: { type: "string" },
      rodentActivity: { type: "string" },
      jobStatus: { type: "string" },
      summary: { type: "string" },
      worksCarriedOut: { type: "array", items: { type: "string" } },
      materialsUsed: { type: "array", items: { type: "string" } },
      findingsRecommendations: { type: "string" }
    },
    required: [
      "clientName",
      "propertyAddress",
      "dateOfWorks",
      "operativeName",
      "areaOfWorks",
      "hygieneLevel",
      "rodentActivity",
      "jobStatus",
      "summary",
      "worksCarriedOut",
      "materialsUsed",
      "findingsRecommendations"
    ]
  };

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content: [
            "You write professional pest proofing reports for Kingswood (London) Ltd.",
            "Convert raw operative notes into concise, factual, client-facing report sections.",
            "Keep practical detail, avoid unsupported claims, and do not invent facts that are not in the notes.",
            "Use British English. Keep wording calm, professional and suitable for a property manager or client."
          ].join(" ")
        },
        { role: "user", content: JSON.stringify(payload, null, 2) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "kingswood_proofing_report",
          schema,
          strict: true
        }
      }
    })
  });

  const result = await upstream.json();
  if (!upstream.ok) {
    throw new Error(result.error?.message || "OpenAI proofing report request failed");
  }

  const outputText = result.output_text || result.output?.flatMap((item) => item.content || [])
    .find((part) => part.type === "output_text")?.text;

  return { aiUsed: true, draft: JSON.parse(outputText) };
}

async function openAiProofingPhotoCaption(payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  const kind = payload.kind === "after" ? "after" : "before";
  if (!apiKey || !payload.imageDataUrl) {
    return {
      aiUsed: false,
      caption: kind === "after"
        ? "Completed pest proofing works to restrict rodent ingress."
        : "Pre-proofing condition showing potential rodent ingress area."
    };
  }

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Write one short factual caption for a ${kind} photograph in a Kingswood pest control proofing report.`,
              "The photo is always related to pest proofing, rodent ingress prevention, access gaps, service penetrations, pipework, risers, vents, doors, walls, floors, mesh, mastic, sealant, cement, bristle strip, proofing materials, or completed proofing workmanship.",
              "Describe the pest-proofing relevance of what is visible, not a generic image description.",
              "For before photos, focus on potential ingress points, gaps, defects, access routes, or areas requiring proofing.",
              "For after photos, focus on the proofing measure installed or the sealed/protected area.",
              "Do not invent exact locations, infestation level, or materials unless they are clearly visible.",
              "Use professional British English. Maximum 22 words."
            ].join(" ")
          },
          {
            type: "input_image",
            image_url: payload.imageDataUrl,
            detail: "low"
          }
        ]
      }]
    })
  });

  const result = await upstream.json();
  if (!upstream.ok) {
    throw new Error(result.error?.message || "OpenAI photo caption request failed");
  }

  const caption = (result.output_text || result.output?.flatMap((item) => item.content || [])
    .find((part) => part.type === "output_text")?.text || "").trim();

  return {
    aiUsed: true,
    caption: caption || (kind === "after"
      ? "Completed pest proofing detail to restrict rodent ingress."
      : "Pre-proofing condition showing potential rodent ingress area.")
  };
}

async function saveProofingPdf(payload) {
  const title = safeFileName(payload.fileName || "Pest Proofing Report");
  const datedDir = path.join(proofingReportDir, String(new Date().getFullYear()));
  fs.mkdirSync(datedDir, { recursive: true });
  const pdfPath = path.join(datedDir, `${title}.pdf`);
  const htmlPath = path.join(datedDir, `${title}.html`);
  const html = String(payload.html || "");

  if (!html.trim()) {
    throw new Error("No report HTML was provided.");
  }

  try {
    const { chromium } = loadPlaywright();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "16mm",
        right: "22mm",
        bottom: "18mm",
        left: "22mm"
      }
    });
    await browser.close();
    return { saved: true, pdfPath };
  } catch (error) {
    fs.writeFileSync(htmlPath, html, "utf8");
    return {
      saved: false,
      htmlPath,
      message: `PDF rendering failed, but an HTML report was saved. ${error.message}`
    };
  }
}

const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, jsonHeaders);
    response.end();
    return;
  }

  if (request.url === "/healthz" && request.method === "GET") {
    response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.url === "/api/data" && request.method === "GET") {
    fs.readFile(dataFile, "utf8", (error, content) => {
      if (error) {
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end("{}");
        return;
      }

      response.writeHead(200, {
        ...jsonHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      response.end(content);
    });
    return;
  }

  if (request.url === "/api/data" && request.method === "POST") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        JSON.parse(body);
        const backupPath = writeJsonSafely(dataFile, body, "command-centre-data");
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: true, backupPath, dataFile }));
      } catch {
        response.writeHead(400, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: false }));
      }
    });
    return;
  }

  if (request.url === "/api/ai-rams" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => openAiRamsDraft(JSON.parse(body || "{}")))
      .then((result) => {
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result));
      })
      .catch((error) => {
        response.writeHead(500, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ message: error.message || "AI RAMS drafting failed" }));
      });
    return;
  }

  if (request.url === "/api/ai-proofing-report" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => openAiProofingReportDraft(JSON.parse(body || "{}")))
      .then((result) => {
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result));
      })
      .catch((error) => {
        response.writeHead(500, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ message: error.message || "AI proofing report drafting failed" }));
      });
    return;
  }

  if (request.url === "/api/ai-proofing-photo-caption" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => openAiProofingPhotoCaption(JSON.parse(body || "{}")))
      .then((result) => {
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result));
      })
      .catch((error) => {
        response.writeHead(500, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ message: error.message || "AI photo captioning failed" }));
      });
    return;
  }

  if (request.url === "/api/save-proofing-pdf" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => saveProofingPdf(JSON.parse(body || "{}")))
      .then((result) => {
        response.writeHead(result.saved ? 200 : 500, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result));
      })
      .catch((error) => {
        response.writeHead(500, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: false, message: error.message || "Could not save proofing PDF" }));
      });
    return;
  }

  if (request.url === "/api/publish-feeds" && request.method === "POST") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        const feeds = JSON.parse(body);
        fs.mkdirSync(dataDir, { recursive: true });
        writeJsonSafely(technicianFeedFile, JSON.stringify(feeds.technicianApp || {}, null, 2), "technician-app-feed");
        writeJsonSafely(adminFeedFile, JSON.stringify(feeds.adminApp || {}, null, 2), "admin-app-feed");
        writeJsonSafely(connectV12FeedFile, JSON.stringify(feeds.connectV12 || {}, null, 2), "connect-v12-feed");
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ published: true }));
      } catch {
        response.writeHead(400, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ published: false }));
      }
    });
    return;
  }

  const requestPath = decodeURIComponent(new URL(request.url, `http://localhost:${port}`).pathname);
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      ...(path.extname(filePath) === ".json" ? jsonHeaders : {}),
      "Cache-Control": "no-store"
    });
    response.end(content);
  });
});

server.listen(port, host);
