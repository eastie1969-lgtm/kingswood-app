"use strict";
const fs = require("node:fs");
const path = require("node:path");

function configureCloudStorage(env, root) {
  if (env.NODE_ENV !== "production") return;
  if (!env.DATA_DIR || !path.isAbsolute(env.DATA_DIR)) {
    throw new Error("Production DATA_DIR must be an absolute path on persistent storage.");
  }
  const folders = {
    FIELD_REPORTS_DIR: "field-reports", PROOFING_REPORT_DIR: "proofing-reports",
    RAMS_DOCUMENT_DIR: "rams", STAFF_RECORDS_DIR: "staff-records", EMPLOYEES_ROOT_DIR: "employees",
    TRAINING_MATRIX_EXPORTS_DIR: "training-exports", FINES_AND_CHARGES_DIR: "fines-and-charges",
    COMPANY_COMPLIANCE_DIR: "company-compliance", ASSETS_ROOT_DIR: "assets",
    VEHICLE_RECORDS_DIR: "vehicles", DIRECTORS_AREA_DIR: "directors-area",
    REVOLUT_BUSINESS_API_DIR: "revolut-business-api"
  };
  for (const [key, folder] of Object.entries(folders)) {
    if (!env[key]) env[key] = path.join(env.DATA_DIR, folder);
  }
  if (!env.TECHNICIAN_APP_FILE) env.TECHNICIAN_APP_FILE = path.join(root, "technician-app.html");
}

// Technician endpoints enforce their own technician sessions in the server.
// Everything else under /api is an office operation unless separately secured.
const technicianRoutes = new Set([
  "/api/phase-05b/technician-login", "/api/phase-05b/technician-feed", "/api/phase-05b/technician-logout",
  "/api/phase-05b/test-expired-session", "/api/phase-05d/technician-report-submit",
  "/api/phase-06a1/leave-attendance", "/api/phase-06a2/holiday-request", "/api/phase-06a2/holiday-request/cancel",
  "/api/phase-06a5/notifications/read", "/api/phase-06a5/notifications/read-all", "/api/technician-action-summary",
  "/api/phase-09b/weekly-vehicle-check", "/api/phase-07/toolbox-talks", "/api/phase-07/toolbox-talks/view",
  "/api/phase-07/toolbox-talks/acknowledge", "/api/phase-07/announcements", "/api/phase-07/announcements/view",
  "/api/phase-07/announcements/acknowledge", "/api/phase-07/jobs/accept", "/api/phase-07/jobs/unable",
  "/api/phase-07/jobs/acknowledge-change", "/api/phase-07/jobs/acknowledge-cancellation",
  "/api/phase-07/jobs/acknowledge-withdrawal", "/api/phase-07/jobs/acknowledge"
]);
function isOfficeRoute(route) {
  return route.startsWith("/api/") && !technicianRoutes.has(route) &&
    !route.startsWith("/api/phase-10/") && !route.startsWith("/api/revolut/") &&
    route !== "/api/automation/revolut/gbp-balance";
}

function isPublicAsset(route) {
  const normalised = path.posix.normalize(route.replace(/\\/g, "/"));
  if (["/", "/index.html", "/app.js", "/styles.css", "/technician-app.html", "/technician.webmanifest"].includes(normalised)) return true;
  return normalised.startsWith("/assets/") && !normalised.split("/").some(part => part.startsWith(".")) &&
    /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf)$/i.test(normalised);
}

function allowedDocument(file, directories) {
  if (!/\.(pdf|png|jpe?g|webp|gif|docx?|xlsx?|csv|html)$/i.test(file)) return false;
  try {
    const actual = fs.realpathSync(file);
    if (!fs.statSync(actual).isFile()) return false;
    return directories.some(directory => {
      try {
        const base = fs.realpathSync(directory);
        const relative = path.relative(base, actual);
        return relative && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
      } catch { return false; }
    });
  } catch { return false; }
}

module.exports = { configureCloudStorage, isOfficeRoute, isPublicAsset, allowedDocument };
