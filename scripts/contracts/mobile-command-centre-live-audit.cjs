const fs = require("fs");
const path = require("path");
const { chromium, webkit, devices } = require("playwright");

const root = path.resolve(__dirname, "..", "..");
const baseUrl = process.env.KC_AUDIT_URL || "http://127.0.0.1:8126";
const appUrl = new URL("index.html", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const pinMatch = appSource.match(/const authorisedUsers\s*=\s*{[\s\S]*?Kevin:\s*"([^"]+)"/);

if (!pinMatch) {
  throw new Error("Unable to locate the existing Kevin sign-in flow for audit.");
}

const kevinPin = pinMatch[1];
const expectedSections = [
  "dashboard",
  "admin-centre",
  "diary",
  "weekly-planner",
  "tracking",
  "clients",
  "history",
  "rams",
  "proofing-reports",
  "compliance",
  "training-safety-compliance",
  "training",
  "staff",
  "technicians",
  "holiday-planner",
  "vehicles",
  "assets",
  "fines",
  "valuations",
  "documents",
  "notifications",
  "settings",
  "directors"
];

const profiles = [
  { name: "iPhone Safari portrait", browserName: "webkit", options: { ...devices["iPhone 13"] } },
  { name: "iPhone Safari landscape", browserName: "webkit", options: { ...devices["iPhone 13 landscape"] } },
  { name: "Android Chrome portrait", browserName: "chromium", options: { ...devices["Pixel 5"] } },
  { name: "Android Chrome landscape", browserName: "chromium", options: { ...devices["Pixel 5 landscape"] } },
  { name: "Small mobile portrait", browserName: "chromium", options: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true } },
  { name: "Large mobile portrait", browserName: "chromium", options: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true } }
];

async function signIn(page) {
  await page.goto(appUrl, { waitUntil: "load" });
  await page.waitForSelector("#pinForm", { timeout: 15000 });
  const signedOutPrivateVisible = await page.evaluate(() => {
    const auth = document.querySelector("#authScreen");
    const workspace = document.querySelector(".workspace");
    if (!workspace || workspace.offsetParent === null) return false;
    if (getComputedStyle(workspace).visibility === "hidden") return false;
    if (!auth || auth.offsetParent === null) return true;
    const center = document.elementFromPoint(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2));
    return !center?.closest?.("#authScreen");
  });
  await page.selectOption("#loginNameInput", "Kevin");
  await page.fill("#pinInput", kevinPin);
  await Promise.all([
    page.waitForSelector("body:not(.locked)", { timeout: 15000 }),
    page.click(".auth-submit")
  ]);
  return { signedOutPrivateVisible };
}

async function openMobileMenu(page) {
  const button = page.locator("#mobileMenuButton");
  if (!(await button.isVisible().catch(() => false))) {
    return { present: false, navCount: 0, expanded: false };
  }
  if (!(await page.locator("body.mobile-menu-open").count())) {
    await button.click();
  }
  await page.waitForTimeout(120);
  return {
    present: true,
    navCount: await page.locator("#mobileSidebar .nav-button").count(),
    expanded: (await button.getAttribute("aria-expanded")) === "true"
  };
}

async function checkLayout(page) {
  return page.evaluate((sections) => {
    function pageRectsOverlap(a, b) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }
    const doc = document.documentElement;
    const horizontalOverflow = doc.scrollWidth > doc.clientWidth + 2;
    const title = document.querySelector(".topbar-title-block");
    const panels = Array.from(document.querySelectorAll(".topbar-onedrive, .topbar-live-block, .topbar .user-panel, .topbar-revolut-balance:not(.hidden), #mobileMenuButton"))
      .filter((element) => element && element.offsetParent !== null && element !== title);
    const visibleRects = [title, ...panels]
      .filter(Boolean)
      .map((element) => ({ className: element.className || element.id, rect: element.getBoundingClientRect() }))
      .filter((item) => item.rect.width > 0 && item.rect.height > 0);
    const overlaps = [];
    for (let i = 0; i < visibleRects.length; i += 1) {
      for (let j = i + 1; j < visibleRects.length; j += 1) {
        if (pageRectsOverlap(visibleRects[i].rect, visibleRects[j].rect)) {
          overlaps.push(`${visibleRects[i].className} overlaps ${visibleRects[j].className}`);
        }
      }
    }
    const missingSections = sections.filter((section) => !document.querySelector(`#${CSS.escape(section)}`));
    const privateBeforeAuth = document.body.classList.contains("locked") && document.querySelector(".workspace")?.offsetParent !== null;
    const sampleTextVisible = /Demo Client|Example Client|Sample Customer|Test Customer/i.test(document.body.innerText);
    const badTables = Array.from(document.querySelectorAll("table")).filter((table) => table.getBoundingClientRect().right > doc.clientWidth + 2).length;
    const controlsTooSmall = Array.from(document.querySelectorAll("button, input, select, textarea, a[href]"))
      .filter((element) => element.offsetParent !== null)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.height < 34 && !element.closest("table");
      }).length;
    return { horizontalOverflow, overlaps, missingSections, privateBeforeAuth, sampleTextVisible, badTables, controlsTooSmall };
  }, expectedSections);
}

async function visitAllSections(page) {
  const opened = [];
  for (const section of expectedSections) {
    const menu = await openMobileMenu(page);
    if (!menu.present || !menu.expanded || menu.navCount < expectedSections.length) {
      return { opened, failure: `mobile menu unavailable before ${section}` };
    }
    const button = page.locator(`#mobileSidebar .nav-button[data-section="${section}"]`).first();
    if (!(await button.count())) {
      return { opened, failure: `section button missing: ${section}` };
    }
    if (!(await button.isVisible())) {
      await button.evaluate((element) => {
        const group = element.closest(".nav-group");
        group?.querySelector(".nav-group-toggle")?.click();
      });
      await page.waitForTimeout(80);
    }
    await button.click();
    await page.waitForTimeout(80);
    const active = await page.locator(`#${section}.section-panel.active`).count();
    if (!active) {
      return { opened, failure: `section did not open: ${section}` };
    }
    opened.push(section);
  }
  return { opened, failure: null };
}

async function runProfile(profile) {
  const browserType = profile.browserName === "webkit" ? webkit : chromium;
  const browser = await browserType.launch();
  const context = await browser.newContext(profile.options);
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) {
      consoleErrors.push(text);
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!/unpkg\.com|open-meteo\.com/.test(url)) {
      failedRequests.push(url.replace(/[?].*/, "?..."));
    }
  });
  try {
    const auth = await signIn(page);
    const initialMenu = await openMobileMenu(page);
    const navigation = await visitAllSections(page);
    await page.locator("#lockHubButton").click();
    await page.waitForSelector("body.locked", { timeout: 10000 });
    const signedOutFormVisible = await page.locator("#pinForm").isVisible();
    await signIn(page);
    const layout = await checkLayout(page);
    return {
      profile: profile.name,
      signedOutPrivateVisible: auth.signedOutPrivateVisible,
      signOutVisible: signedOutFormVisible,
      menu: initialMenu,
      navigation,
      layout,
      consoleErrors,
      failedRequests
    };
  } finally {
    await browser.close();
  }
}

(async () => {
  const results = [];
  for (const profile of profiles) {
    results.push(await runProfile(profile));
  }
  console.log(JSON.stringify({ baseUrl, sectionsExpected: expectedSections.length, results }, null, 2));
  const failed = results.filter((result) =>
    result.signedOutPrivateVisible ||
    !result.signOutVisible ||
    !result.menu.present ||
    !result.menu.expanded ||
    result.menu.navCount < expectedSections.length ||
    result.navigation.failure ||
    result.layout.horizontalOverflow ||
    result.layout.overlaps.length ||
    result.layout.missingSections.length ||
    result.layout.privateBeforeAuth ||
    result.layout.sampleTextVisible ||
    result.layout.badTables ||
    result.consoleErrors.length ||
    result.failedRequests.length
  );
  if (failed.length) {
    process.exitCode = 1;
  }
})();
