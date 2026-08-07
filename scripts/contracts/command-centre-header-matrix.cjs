const fs = require("fs");
const path = require("path");
const { chromium, webkit, devices } = require("playwright");

const root = path.resolve(__dirname, "..", "..");
const baseUrl = process.env.KC_AUDIT_URL || "http://127.0.0.1:8126";
const appUrl = new URL("index.html", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const pinMatch = appSource.match(/const authorisedUsers\s*=\s*{[\s\S]*?Kevin:\s*"([^"]+)"/);

if (!pinMatch) throw new Error("Unable to locate the existing Kevin sign-in flow for audit.");

const kevinPin = pinMatch[1];
const sections = [
  ["dashboard", "Dashboard"],
  ["admin-centre", "Job Dispatch"],
  ["diary", "Job Diary"],
  ["weekly-planner", "Weekly Planner"],
  ["tracking", "Live Tracking"],
  ["clients", "Clients"],
  ["history", "Job History"],
  ["rams", "RAMS Centre"],
  ["proofing-reports", "Proofing Reports"],
  ["compliance", "Compliance Centre"],
  ["training-safety-compliance", "Training, Safety & Compliance"],
  ["training", "Training Matrix"],
  ["staff", "Staff Management"],
  ["technicians", "Technicians"],
  ["holiday-planner", "Holiday Planner"],
  ["vehicles", "Vehicles"],
  ["assets", "Assets, Tools & Equipment"],
  ["fines", "Fines and Charges"],
  ["valuations", "Valuations"],
  ["documents", "Company Documents"],
  ["notifications", "Notifications"],
  ["settings", "Settings"],
  ["directors", "Directors’ Area"],
  ["split-screen", "Split Screen"]
];

const directorTabs = [
  ["overview", "Company Overview"],
  ["absence", "Absence and Holidays"],
  ["payroll", "Payroll"],
  ["company-details", "Company Details"]
];

const profiles = [
  { name: "Desktop 1920x1080 100%", browser: "chromium", options: { viewport: { width: 1920, height: 1080 } } },
  { name: "Laptop 1536x864 100%", browser: "chromium", options: { viewport: { width: 1536, height: 864 } } },
  { name: "Laptop 1366x768 100%", browser: "chromium", options: { viewport: { width: 1366, height: 768 } } },
  { name: "Tablet 1024x768 100%", browser: "chromium", options: { viewport: { width: 1024, height: 768 }, hasTouch: true } },
  { name: "Large mobile 430x932 100%", browser: "chromium", options: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true } },
  { name: "Small mobile 360x800 100%", browser: "chromium", options: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
  { name: "Laptop 1366x768 at 125% zoom", browser: "chromium", options: { viewport: { width: 1093, height: 614 } } },
  { name: "Laptop 1366x768 at 150% zoom", browser: "chromium", options: { viewport: { width: 911, height: 512 } } },
  { name: "Laptop 1366x768 at 200% zoom", browser: "chromium", options: { viewport: { width: 683, height: 384 } } },
  { name: "iPhone Safari 390x844", browser: "webkit", options: { ...devices["iPhone 13"] } }
];

async function signIn(page) {
  await page.goto(appUrl, { waitUntil: "load" });
  await page.waitForSelector("#pinForm", { timeout: 20000 });
  await page.selectOption("#loginNameInput", "Kevin");
  await page.fill("#pinInput", kevinPin);
  await page.click(".auth-submit");
  await page.waitForFunction(() => !document.body.classList.contains("locked"), null, { timeout: 20000 });
  await page.waitForSelector(".topbar", { state: "visible", timeout: 20000 });
}

async function openSection(page, sectionId) {
  const result = await page.evaluate((id) => {
    const section = document.getElementById(id);
    if (!section) return { opened: false, reason: "section missing" };
    const button = document.querySelector(`.nav-button[data-section="${CSS.escape(id)}"]`);
    if (button) button.click();
    else if (typeof showSection === "function") showSection(id);
    else return { opened: false, reason: "no navigation route" };
    return { opened: section.classList.contains("active"), reason: "" };
  }, sectionId);
  await page.waitForTimeout(sectionId === "directors" ? 350 : 80);
  return result;
}

async function inspectHeader(page, expectedTitle) {
  return page.evaluate((expected) => {
    const tolerance = 2;
    const title = document.querySelector("#pageTitle");
    const titleBlock = document.querySelector(".topbar-title-block");
    const topbar = document.querySelector(".topbar");
    const statusCards = Array.from(document.querySelectorAll(
      ".topbar-revolut-balance:not(.hidden), .topbar-onedrive, .topbar-live-block, .topbar .user-panel"
    )).filter((element) => element.offsetParent !== null);

    const overlap = (a, b) => a.left < b.right - tolerance && a.right > b.left + tolerance &&
      a.top < b.bottom - tolerance && a.bottom > b.top + tolerance;
    const rect = (element) => element?.getBoundingClientRect();
    const titleRect = rect(title);
    const blockRect = rect(titleBlock);
    const barRect = rect(topbar);
    const splitWords = [];

    if (title) {
      const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        for (const match of node.data.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const lineTops = [...range.getClientRects()].map((item) => Math.round(item.top));
          if (new Set(lineTops).size > 1) splitWords.push(match[0]);
        }
      }
    }

    const statusOutsideViewport = statusCards
      .filter((card) => {
        const item = rect(card);
        return item.left < -tolerance || item.right > window.innerWidth + tolerance ||
          item.top < barRect.top - tolerance || item.bottom > barRect.bottom + tolerance;
      })
      .map((card) => card.className);
    const titleOverlaps = statusCards.filter((card) => overlap(titleRect, rect(card))).map((card) => card.className);
    const statusOverlaps = [];
    for (let i = 0; i < statusCards.length; i += 1) {
      for (let j = i + 1; j < statusCards.length; j += 1) {
        if (overlap(rect(statusCards[i]), rect(statusCards[j]))) {
          statusOverlaps.push(`${statusCards[i].className} / ${statusCards[j].className}`);
        }
      }
    }

    const failures = [];
    if (!title || title.textContent.trim() !== expected) failures.push("header title mismatch");
    if (!titleRect || titleRect.width < 1 || titleRect.height < 1) failures.push("header title not readable");
    if (splitWords.length) failures.push(`words split: ${splitWords.join(", ")}`);
    if (titleRect && blockRect && (titleRect.left < blockRect.left - tolerance || titleRect.right > blockRect.right + tolerance)) {
      failures.push("title outside title block");
    }
    if (titleOverlaps.length) failures.push("title overlaps status cards");
    if (statusOutsideViewport.length) failures.push("status card outside viewport/header");
    if (statusOverlaps.length) failures.push("status cards overlap");
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + tolerance) failures.push("horizontal page overflow");
    if (topbar.scrollWidth > topbar.clientWidth + tolerance) failures.push("horizontal header overflow");

    return {
      pass: failures.length === 0,
      failures,
      title: title?.textContent.trim() || "",
      splitWords,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    };
  }, expectedTitle);
}

async function runProfile(profile) {
  const browserType = profile.browser === "webkit" ? webkit : chromium;
  const browser = await browserType.launch();
  const context = await browser.newContext(profile.options);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
      consoleErrors.push(message.text());
    }
  });
  try {
    await signIn(page);
    const pageResults = [];
    for (const [id, title] of sections) {
      const opened = await openSection(page, id);
      const header = opened.opened ? await inspectHeader(page, title) : { pass: false, failures: [opened.reason], title: "" };
      pageResults.push({ id, title, ...header });
    }

    await openSection(page, "directors");
    const directorResults = [];
    for (const [id, title] of directorTabs) {
      const tab = page.locator(`[data-director-tab="${id}"]`);
      if (!(await tab.count())) {
        directorResults.push({ id, title, pass: false, failures: ["Directors tab missing"] });
        continue;
      }
      if (!(await tab.isVisible())) {
        directorResults.push({ id, title, pass: false, failures: ["Directors tab unavailable to authenticated audit user"] });
        continue;
      }
      await tab.click();
      await page.waitForTimeout(120);
      const header = await inspectHeader(page, "Directors’ Area");
      directorResults.push({ id, title, ...header });
    }
    return { profile: profile.name, pages: pageResults, directorTabs: directorResults, consoleErrors };
  } finally {
    await browser.close();
  }
}

(async () => {
  const results = [];
  for (const profile of profiles) results.push(await runProfile(profile));
  const pageMatrix = sections.map(([id, title]) => {
    const checks = results.map((result) => result.pages.find((item) => item.id === id));
    return { id, title, pass: checks.every((item) => item?.pass), failedProfiles: checks.filter((item) => !item?.pass).map((item) => item?.viewport || "unknown") };
  });
  const directorMatrix = directorTabs.map(([id, title]) => {
    const checks = results.map((result) => result.directorTabs.find((item) => item.id === id));
    return { id, title, pass: checks.every((item) => item?.pass), failedProfiles: checks.filter((item) => !item?.pass).map((item) => item?.viewport || "unknown") };
  });
  const report = { baseUrl, profiles: profiles.map((item) => item.name), pageMatrix, directorMatrix, results };
  if (process.env.KC_MATRIX_OUTPUT) fs.writeFileSync(process.env.KC_MATRIX_OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ baseUrl, profileCount: profiles.length, pageMatrix, directorMatrix }, null, 2));
  if (pageMatrix.some((item) => !item.pass) || directorMatrix.some((item) => !item.pass) || results.some((item) => item.consoleErrors.length)) {
    process.exitCode = 1;
  }
})();
