"use strict";
// Disposable synthetic data for development. Never points at the production disk.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
if (process.env.NODE_ENV === "production" || process.env.RENDER) throw new Error("The demo launcher must not run on the hosted production service.");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "kw-cloud-demo-"));
const profile = { staffId: "STAFF-20260716-012", name: "Demo Director", role: "Director", status: "Active", employmentStatus: "Active", directorAccessAuthority: true, payrollActive: false };
fs.writeFileSync(path.join(temporary, "command-centre-data.json"), JSON.stringify({
  staffProfiles: [profile], jobs: [], technicians: [], vehicles: [], clients: [], weeklyPlanner: [],
  holidayRequests: [], attendanceRecords: [], proofingReports: [], ramsItems: [], assets: [],
  trainingMatrix: [], companyDocuments: [], fines: [], valuations: [], complianceItems: [],
  leaveAllowanceResetYear: String(new Date().getFullYear())
}));
for (const key of ["PROOFING_REPORT_DIR", "FIELD_REPORTS_DIR", "RAMS_DOCUMENT_DIR", "STAFF_RECORDS_DIR", "EMPLOYEES_ROOT_DIR", "TRAINING_MATRIX_EXPORTS_DIR", "FINES_AND_CHARGES_DIR", "COMPANY_COMPLIANCE_DIR", "ASSETS_ROOT_DIR", "VEHICLE_RECORDS_DIR", "DIRECTORS_AREA_DIR", "REVOLUT_BUSINESS_API_DIR"]) delete process.env[key];
const port = process.env.PORT || "8138";
Object.assign(process.env, {
  NODE_ENV: "production", PORT: port, HOST: "127.0.0.1", DATA_DIR: temporary,
  RENDER_EXTERNAL_URL: `http://127.0.0.1:${port}`, KINGSWOOD_DIRECTOR_KEVIN_PIN: "12345678",
  KINGSWOOD_DIRECTOR_ALEX_PIN: "87654321", KINGSWOOD_REVOLUT_AUTOMATION_ENABLED: "false"
});
console.log(`Synthetic demo: http://127.0.0.1:${port} — Kevin / 12345678. No live records are used.`);
require("../.preview-server.cjs");
