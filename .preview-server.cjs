const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

const { createTechnicianFeed } = require("./packages/shared-models/technician-feed-contract");
const {
  applyVehicleAssignment,
  findActiveVehicleAssignment,
  normaliseVehicleCollection
} = require("./packages/shared-models/vehicle-assignment");
const {
  VEHICLE_CHECKLIST_ITEMS,
  defectAnswers,
  inspectionIdFor,
  normaliseChecklistAnswers,
  vehicleInspectionValidationErrors,
  vehicleWeeklyCheckState
} = require("./packages/shared-models/vehicle-inspections");
const {
  VEHICLE_DOCUMENT_DEFAULT_REMINDER_DAYS,
  normaliseMaintenanceEventType,
  normaliseVehicleDocumentType,
  validateVehicleDocumentPayload,
  validateVehicleMaintenancePayload,
  vehicleDocumentIdFor,
  vehicleDocumentStatus,
  vehicleMaintenanceIdFor
} = require("./packages/shared-models/vehicle-documents");
const {
  TOOLBOX_TALK_COMMUNICATION_TYPE,
  ANNOUNCEMENT_COMMUNICATION_TYPE,
  COMMUNICATION_TYPES,
  normaliseCommunicationType,
  validateActiveCommunicationType
} = require("./packages/shared-models/communication-types");
const {
  buildStaffComplianceRollup,
  normaliseTrainingRecord,
  normaliseTrainingRecordStatus,
  syncTrainingActionItems,
  trainingRecordIdFor
} = require("./packages/shared-models/staff-compliance-records");
const {
  DIRECTOR_STAFF,
  KINGSWOOD_LONDON_LEGAL_ENTITY_ID,
  PAYROLL_STATUSES,
  auditEventIdFor,
  buildPayrollSourceRows,
  dateInMonth,
  daysInMonthRange,
  defaultKingswoodLegalEntity,
  excelSafeText,
  findLegalEntity,
  isActiveEmploymentRecord,
  isEmployeePayrollRecord,
  isPayrollActive,
  legalEntitiesForRead,
  normaliseLegalEntityRecord,
  normaliseDirectorName,
  payrollExportIdFor,
  payrollPeriodIdFor,
  salaryAdvanceIdFor,
  textValue: directorTextValue,
  validateLegalEntityRecord
} = require("./packages/shared-models/directors-area");
const { calculateHolidayEntitlement, countedBankHolidays } = require("./packages/shared-models/holiday-entitlement");

const root = __dirname;
const port = Number(process.env.PORT || 8126);
const host = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const dataDir = process.env.DATA_DIR || path.join(root, "data");
const dataFile = path.join(dataDir, "command-centre-data.json");
const dataBackupDir = path.join(dataDir, "backups");
const technicianFeedFile = path.join(dataDir, "technician-app-feed.json");
const adminFeedFile = path.join(dataDir, "admin-app-feed.json");
const connectV12FeedFile = path.join(dataDir, "connect-v12-feed.json");
const completedReportMetadataFile = path.join(dataDir, "completed-report-metadata.json");
const localEnvFile = path.join(root, ".env.local");
const projectTechnicianAppFile = path.join(root, "technician-app.html");
const existingTechnicianAppFile = process.env.TECHNICIAN_APP_FILE || path.join(
  process.env.USERPROFILE || "C:\\Users\\Kev",
  "OneDrive - Kingswood (London) Ltd",
  "Desktop",
  "kingswood_app_updated_2.html"
);
const proofingReportDir = process.env.PROOFING_REPORT_DIR
  || path.resolve(root, "..", "..", "Kingswood Field Reports", "Proofing Reports");
const fieldReportsRootDir = process.env.FIELD_REPORTS_DIR
  || path.resolve(root, "..", "..", "Kingswood Field Reports");
const ramsDocumentDir = process.env.RAMS_DOCUMENT_DIR || path.join(root, "RAMS");
const staffRecordsDir = process.env.STAFF_RECORDS_DIR || path.join(
  process.env.USERPROFILE || "C:\\Users\\Kev",
  "OneDrive - Kingswood (London) Ltd",
  "Documents - Documents",
  "02. Kingswood London Ltd",
  "2.0 Employees",
  "Kingswood Connect Staff Records"
);
const employeesRootDir = process.env.EMPLOYEES_ROOT_DIR || path.join(
  process.env.USERPROFILE || "C:\\Users\\Kev",
  "OneDrive - Kingswood (London) Ltd",
  "Documents - Documents",
  "02. Kingswood London Ltd",
  "2.0 Employees"
);
const trainingMatrixExportsDir = process.env.TRAINING_MATRIX_EXPORTS_DIR || path.join(
  employeesRootDir,
  "Training and Qualifications",
  "Training Matrix"
);
const finesAndChargesDir = process.env.FINES_AND_CHARGES_DIR || path.join(
  process.env.USERPROFILE || "C:\\Users\\Kev",
  "OneDrive - Kingswood (London) Ltd",
  "Documents - Documents",
  "02. Kingswood London Ltd",
  "Fines and Charges"
);
const companyComplianceDir = process.env.COMPANY_COMPLIANCE_DIR || path.join(
  process.env.USERPROFILE || "C:\\Users\\Kev",
  "OneDrive - Kingswood (London) Ltd",
  "Documents - Documents",
  "02. Kingswood London Ltd",
  "Company Compliance"
);
const assetsRootDir = process.env.ASSETS_ROOT_DIR || path.join(
  process.env.USERPROFILE || "C:\\Users\\Kev",
  "OneDrive - Kingswood (London) Ltd",
  "Documents - Documents",
  "02. Kingswood London Ltd",
  "Assets, Tools and Equipment"
);
const vehicleRecordsRootDir = process.env.VEHICLE_RECORDS_DIR || path.join(
  process.env.USERPROFILE || "C:\\Users\\Kev",
  "OneDrive - Kingswood (London) Ltd",
  "Documents - Documents",
  "02. Kingswood London Ltd",
  "Vehicles"
);
const directorsAreaRootDir = process.env.DIRECTORS_AREA_DIR || path.join(dataDir, "directors-area");
const directorsAreaDataFile = path.join(directorsAreaRootDir, "directors-area-data.json");
const directorsPayrollExportDir = path.join(directorsAreaRootDir, "payroll-exports");
const revolutSecureRootDir = process.env.REVOLUT_BUSINESS_API_DIR || path.join(
  process.env.USERPROFILE || "C:\\Users\\Kev",
  "OneDrive - Kingswood (London) Ltd",
  "Documents",
  "Kingswood Secure Secrets",
  "Revolut Business API"
);
const revolutTokenFile = path.join(revolutSecureRootDir, "secrets", "revolut-oauth-tokens.secret.json");
const revolutClientIdFile = path.join(revolutSecureRootDir, "secrets", "revolut-client-id.secret");
const revolutIssuerFile = path.join(revolutSecureRootDir, "secrets", "revolut-jwt-issuer.secret");
const revolutPrivateKeyFile = path.join(revolutSecureRootDir, "private", "kingswood-revolut-private.pem");
const revolutTokenEndpoint = "https://b2b.revolut.com/api/1.0/auth/token";
const revolutAccountsEndpoint = "https://b2b.revolut.com/api/1.0/accounts";
const revolutClientAssertionType = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function phase10IsoWeekday(dateValue) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? -1 : date.getUTCDay();
}

function phase10DateRangeValues(start, end = start) {
  const values = [];
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return values;
  for (const cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    values.push(cursor.toISOString().slice(0, 10));
  }
  return values;
}

function phase10NormalWorkingWeekdays(staff = {}) {
  if (Array.isArray(staff.normalWorkingWeekdays) && staff.normalWorkingWeekdays.length) {
    return new Set(staff.normalWorkingWeekdays.map((day) => Number(day)).filter((day) => day >= 0 && day <= 6));
  }
  const pattern = directorTextValue(staff.normalWorkingPattern).toLowerCase();
  if (/mon(day)?\s*(to|-)\s*fri(day)?|monday to friday|weekdays/.test(pattern)) return new Set([1, 2, 3, 4, 5]);
  const namedDays = [
    ["sunday", 0],
    ["monday", 1],
    ["tuesday", 2],
    ["wednesday", 3],
    ["thursday", 4],
    ["friday", 5],
    ["saturday", 6]
  ];
  const matched = namedDays.filter(([name]) => pattern.includes(name)).map(([, day]) => day);
  if (matched.length) return new Set(matched);
  const contractedDays = Math.round(Number(staff.contractedWorkingDaysPerWeek || staff.normalWorkingDays || 5));
  return new Set([1, 2, 3, 4, 5, 6, 0].slice(0, Math.max(0, Math.min(contractedDays, 7))));
}

function phase10WorkingDaysForRecord(record = {}, staff = {}, leaveYear = {}, excludedDates = new Set()) {
  const start = directorTextValue(record.startDate || record.from || record.date);
  const end = directorTextValue(record.endDate || record.to || record.date || start);
  if (!start) return 0;
  const weekdays = phase10NormalWorkingWeekdays(staff);
  const days = phase10DateRangeValues(start, end)
    .filter((date) => date >= leaveYear.start && date <= leaveYear.end)
    .filter((date) => weekdays.has(phase10IsoWeekday(date)))
    .filter((date) => !excludedDates.has(date));
  if (directorTextValue(record.dayType).toLowerCase() === "half day" && days.length === 1) return 0.5;
  return days.length;
}

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
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function dynamicJsonHeaders(request) {
  const origin = request.headers.origin || "*";
  return {
    ...jsonHeaders,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  };
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

function safeFileName(value, fallback = "proofing-report") {
  return String(value || fallback)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || fallback;
}

function extensionFromMime(mimeType, fallbackName = "") {
  const nameExt = path.extname(String(fallbackName || "")).toLowerCase();
  if (nameExt) return nameExt;
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return ".pdf";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("wordprocessingml") || mime.includes("msword")) return ".docx";
  if (mime.includes("spreadsheetml") || mime.includes("excel")) return ".xlsx";
  return ".bin";
}

function bufferFromDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Evidence file was not a valid browser file payload.");
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
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

function canReadFile(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function resolveTechnicianAppFile() {
  if (canReadFile(projectTechnicianAppFile)) {
    return {
      filePath: projectTechnicianAppFile,
      servedApp: "project-technician-app"
    };
  }

  if (canReadFile(existingTechnicianAppFile)) {
    return {
      filePath: existingTechnicianAppFile,
      servedApp: "legacy-technician-app-fallback"
    };
  }

  return {
    filePath: projectTechnicianAppFile,
    servedApp: "missing-technician-app"
  };
}

function serveExistingTechnicianApp(response) {
  const resolved = resolveTechnicianAppFile();
  const technicianAppFile = resolved.filePath;

  if (!fs.existsSync(technicianAppFile)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    response.end("Technician App file not found.");
    return;
  }

  let html = fs.readFileSync(technicianAppFile, "utf8");
  html = html.replace(
    /const\s+PHASE5A_FEED_BASE_URL\s*=\s*['"][^'"]+['"]\s*;/,
    "const PHASE5A_FEED_BASE_URL = window.location.protocol === 'file:' ? 'http://127.0.0.1:8126' : window.location.origin;"
  );

  console.log(`[technician-app] Serving ${resolved.servedApp}: ${technicianAppFile}`);
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Kingswood-Served-App": resolved.servedApp,
    "X-Kingswood-Technician-App-Path": technicianAppFile
  });
  response.end(html);
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

function defaultCommandCentreDataFile() {
  return path.join(root, "data", "command-centre-data.json");
}

function commandDataStaffCount(data = {}) {
  return Array.isArray(data.staffProfiles) ? data.staffProfiles.length : 0;
}

function commandDataHasKevinDirector(data = {}) {
  return (data.staffProfiles || []).some((profile) =>
    directorTextValue(profile.staffId) === DIRECTOR_STAFF.Kevin.staffId
    && directorTextValue(profile.role).toLowerCase() === "director"
  );
}

function commandDataLooksLikeBrowserFallback(data = {}) {
  const staffCount = commandDataStaffCount(data);
  if (!staffCount || staffCount > 6) return false;
  const staffNames = new Set((data.staffProfiles || []).map((profile) => directorTextValue(profile.name).toLowerCase()));
  const fallbackNames = ["dan", "mason", "aiden", "kev"].filter((name) => staffNames.has(name)).length;
  return fallbackNames >= 2 && !commandDataHasKevinDirector(data);
}

function commandDataLooksUnsafeToSave(incoming = {}, existing = {}) {
  const existingStaffCount = commandDataStaffCount(existing);
  const incomingStaffCount = commandDataStaffCount(incoming);
  if (!incomingStaffCount) return true;
  if (commandDataLooksLikeBrowserFallback(incoming)) return true;
  return existingStaffCount > 1 && incomingStaffCount < Math.max(2, Math.ceil(existingStaffCount / 2));
}

function kevinDirectorProfileForMigration(existingProfile = {}) {
  return {
    ...existingProfile,
    staffId: DIRECTOR_STAFF.Kevin.staffId,
    name: DIRECTOR_STAFF.Kevin.name,
    role: "Director",
    status: "Active",
    employmentStatus: "Active",
    directorAccessAuthority: true,
    phase10DirectorAccess: true,
    payrollActive: false
  };
}

function migrateKevinDirectorAccess(data = {}) {
  const staffProfiles = Array.isArray(data.staffProfiles) ? data.staffProfiles : [];
  const index = staffProfiles.findIndex((profile) =>
    directorTextValue(profile.staffId) === DIRECTOR_STAFF.Kevin.staffId
  );
  if (index >= 0) {
    const existing = staffProfiles[index];
    const repaired = kevinDirectorProfileForMigration(existing);
    const changed = JSON.stringify(existing) !== JSON.stringify(repaired);
    if (!changed) return { data: { ...data, staffProfiles }, changed: false };
    const nextProfiles = staffProfiles.slice();
    nextProfiles[index] = repaired;
    return { data: { ...data, staffProfiles: nextProfiles }, changed: true };
  }
  return {
    data: { ...data, staffProfiles: [...staffProfiles, kevinDirectorProfileForMigration()] },
    changed: true
  };
}

function ensureHostedCommandDataReady() {
  const bundledDataFile = defaultCommandCentreDataFile();
  if (!fs.existsSync(dataFile) && dataFile !== bundledDataFile && fs.existsSync(bundledDataFile)) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.copyFileSync(bundledDataFile, dataFile);
  }
  if (!fs.existsSync(dataFile)) return;
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(dataFile, "utf8") || "{}");
  } catch {
    return;
  }
  const migration = migrateKevinDirectorAccess(data);
  if (migration.changed) {
    writeJsonSafely(dataFile, `${JSON.stringify(migration.data, null, 2)}\n`, "command-centre-data");
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function trainingExportRows(records = []) {
  return records.map((record) => [
    record.employee,
    record.course,
    record.provider,
    record.certificateNumber,
    record.completedDate,
    record.expiryDate,
    record.status,
    record.notes,
    record.documentFileName,
    record.oneDriveLocation
  ]);
}

function trainingCsv(records = []) {
  const headers = [
    "Employee",
    "Training / Qualification",
    "Provider",
    "Certificate / Licence Number",
    "Completed Date",
    "Expiry Date",
    "Status",
    "Notes",
    "Certificate File Name",
    "OneDrive Location"
  ];
  return [headers, ...trainingExportRows(records)]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");
}

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const zipDate = new Date();
  const zipDosTime = ((zipDate.getHours() & 0x1f) << 11) | ((zipDate.getMinutes() & 0x3f) << 5) | ((Math.floor(zipDate.getSeconds() / 2)) & 0x1f);
  const zipDosDate = (((zipDate.getFullYear() - 1980) & 0x7f) << 9) | (((zipDate.getMonth() + 1) & 0x0f) << 5) | (zipDate.getDate() & 0x1f);
  files.forEach(({ name, content }) => {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(zipDosTime, 10);
    local.writeUInt16LE(zipDosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(zipDosTime, 12);
    central.writeUInt16LE(zipDosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function pngWithoutAncillaryMetadata(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16 || buffer.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") return buffer;
  const parts = [buffer.slice(0, 8)];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString("ascii");
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > buffer.length) return buffer;
    const isCritical = /^[A-Z]/.test(type[0] || "");
    if (isCritical) parts.push(buffer.slice(offset, chunkEnd));
    offset = chunkEnd;
    if (type === "IEND") break;
  }
  return Buffer.concat(parts);
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xlsxSafeNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : "";
}

function columnName(index) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function simpleXlsx(rows, sheetName = "Sheet1", columnWidths = []) {
  const sheetData = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, cellIndex) => {
    const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
    return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 1);
  const cols = Array.from({ length: maxColumns }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${columnWidths[index] || 18}"/>`).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${sheetData}</sheetData></worksheet>`;
  return zipStore([
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name: "xl/worksheets/sheet1.xml", content: sheet }
  ]);
}

function multiSheetXlsx(sheets = []) {
  const safeSheets = sheets.slice(0, 12).map((sheet, index) => ({
    name: String(sheet.name || `Sheet ${index + 1}`).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || `Sheet ${index + 1}`,
    rows: Array.isArray(sheet.rows) ? sheet.rows : [],
    columnWidths: Array.isArray(sheet.columnWidths) ? sheet.columnWidths : [],
    headerRow: Number(sheet.headerRow || 1),
    freezeRow: Number(sheet.freezeRow || sheet.headerRow || 1),
    autoFilter: sheet.autoFilter !== false,
    merges: Array.isArray(sheet.merges) ? sheet.merges : [],
    rowHeights: sheet.rowHeights && typeof sheet.rowHeights === "object" ? sheet.rowHeights : {},
    logoPath: sheet.logoPath || "",
    landscape: sheet.landscape !== false,
    printTitleRows: sheet.printTitleRows || "",
    footer: sheet.footer || "Kingswood Connect payroll preparation - Page &P of &N"
  }));
  const styleIds = { title: 1, subtitle: 2, metaLabel: 3, metaValue: 4, header: 5, currency: 6, date: 7, exception: 8, total: 9, alternate: 10, note: 11, logoBg: 12, dateTime: 13, warningNote: 14, totalCurrency: 15 };
  const dateSerial = (value) => {
    const date = value instanceof Date ? value : new Date(`${String(value || "").slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return "";
    return Math.floor((date.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
  };
  const dateTimeSerial = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const midnight = Date.UTC(1899, 11, 30);
    const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds());
    return String((local - midnight) / 86400000);
  };
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="&#163;#,##0.00;[Red]-&#163;#,##0.00"/><numFmt numFmtId="165" formatCode="dd mmmm yyyy"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy hh:mm"/></numFmts><fonts count="8"><font><sz val="10"/><color rgb="FF12233A"/><name val="Calibri"/></font><font><b/><sz val="17"/><color rgb="FF0B1F36"/><name val="Calibri"/></font><font><b/><sz val="12"/><color rgb="FF2A7F83"/><name val="Calibri"/></font><font><b/><sz val="9"/><color rgb="FF55657A"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><color rgb="FF7A2E2E"/><sz val="10"/><name val="Calibri"/></font><font><color rgb="FF7A2E2E"/><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF0B1F36"/><name val="Calibri"/></font></fonts><fills count="9"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF7F7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B1F36"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE8E8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7FAFC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9F0F6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF7E6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF020B16"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD6DEE8"/></bottom><diagonal/></border><border><left style="thin"><color rgb="FFD6DEE8"/></left><right style="thin"><color rgb="FFD6DEE8"/></right><top style="thin"><color rgb="FFD6DEE8"/></top><bottom style="thin"><color rgb="FFD6DEE8"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="16"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="5" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1"/></xf><xf numFmtId="0" fontId="7" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="8" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="166" fontId="0" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="6" fillId="7" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="164" fontId="7" fillId="2" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const xlsxCell = (cell, rowIndex, cellIndex) => {
    const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
    const rich = cell && typeof cell === "object" && !Array.isArray(cell);
    const value = rich ? cell.value : cell;
    const style = rich ? cell.style : "";
    const styleAttr = style && styleIds[style] ? ` s="${styleIds[style]}"` : "";
    if (rich && cell.formula) return `<c r="${ref}"${styleAttr}><f>${xmlEscape(cell.formula)}</f><v>${xmlEscape(xlsxSafeNumber(value) || 0)}</v></c>`;
    if (rich && (cell.type === "number" || cell.type === "currency")) {
      const numeric = xlsxSafeNumber(value);
      return numeric === "" ? "" : `<c r="${ref}"${styleAttr}><v>${numeric}</v></c>`;
    }
    if (rich && cell.type === "date") {
      const serial = dateSerial(value);
      return serial ? `<c r="${ref}"${styleAttr || ` s="${styleIds.date}"`}><v>${serial}</v></c>` : "";
    }
    if (rich && cell.type === "dateTime") {
      const serial = dateTimeSerial(value);
      return serial ? `<c r="${ref}"${styleAttr || ` s="${styleIds.dateTime}"`}><v>${serial}</v></c>` : "";
    }
    const safeText = excelSafeText(value);
    if (safeText === "" && styleAttr) return `<c r="${ref}"${styleAttr}/>`;
    if (safeText === "") return "";
    return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${xmlEscape(safeText)}</t></is></c>`;
  };
  const logoSheetIndexes = safeSheets
    .map((sheet, index) => ({ sheet, index }))
    .filter(({ sheet }) => sheet.logoPath && fs.existsSync(sheet.logoPath));
  const files = [
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${safeSheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}${logoSheetIndexes.map(({ index }) => `<Override PartName="/xl/drawings/drawing${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join("")}</Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${safeSheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${safeSheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", content: stylesXml }
  ];
  safeSheets.forEach((sheet, sheetIndex) => {
    const rows = sheet.rows.map((row) => Array.isArray(row) ? row : [row]);
    const sheetData = rows.map((row, rowIndex) => {
      const explicitHeight = Number(sheet.rowHeights[rowIndex + 1] || 0);
      const height = explicitHeight > 0
        ? ` ht="${explicitHeight}" customHeight="1"`
        : row.some((cell) => cell && typeof cell === "object" && cell.style === "title") ? ' ht="24" customHeight="1"' : "";
      return `<row r="${rowIndex + 1}"${height}>${row.map((cell, cellIndex) => xlsxCell(cell, rowIndex, cellIndex)).join("")}</row>`;
    }).join("");
    const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 1);
    const cols = Array.from({ length: maxColumns }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${sheet.columnWidths[index] || 18}"/>`).join("");
    const filterRow = Math.min(Math.max(sheet.headerRow, 1), Math.max(rows.length, 1));
    const lastColumn = columnName(Math.max(maxColumns - 1, 0));
    const autoFilter = sheet.autoFilter ? `<autoFilter ref="A${filterRow}:${lastColumn}${Math.max(rows.length, filterRow)}"/>` : "";
    const mergeCells = sheet.merges.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${xmlEscape(ref)}"/>`).join("")}</mergeCells>` : "";
    const drawing = sheet.logoPath && fs.existsSync(sheet.logoPath) ? '<drawing r:id="rId1"/>' : "";
    files.push({
      name: `xl/worksheets/sheet${sheetIndex + 1}.xml`,
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="${Math.max(sheet.freezeRow, 1)}" topLeftCell="A${Math.max(sheet.freezeRow + 1, 2)}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${sheetData}</sheetData>${autoFilter}${mergeCells}<printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.55" bottom="0.55" header="0.25" footer="0.25"/><pageSetup paperSize="9" orientation="${sheet.landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;L${xmlEscape(sheet.footer)}&amp;RGenerated by Kingswood Connect</oddFooter></headerFooter>${drawing}</worksheet>`
    });
    if (sheet.logoPath && fs.existsSync(sheet.logoPath)) {
      const drawingIndex = sheetIndex + 1;
      files.push({
        name: `xl/worksheets/_rels/sheet${drawingIndex}.xml.rels`,
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIndex}.xml"/></Relationships>`
      });
      files.push({
        name: `xl/drawings/drawing${drawingIndex}.xml`,
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>95250</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>57150</xdr:rowOff></xdr:from><xdr:ext cx="1280160" cy="1280160"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${drawingIndex + 1}" name="Kingswood Logo ${drawingIndex}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`
      });
      files.push({
        name: `xl/drawings/_rels/drawing${drawingIndex}.xml.rels`,
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/kingswood-logo.png"/></Relationships>`
      });
    }
  });
  const firstLogo = logoSheetIndexes[0]?.sheet.logoPath;
  if (firstLogo && fs.existsSync(firstLogo)) {
    files.push({ name: "xl/media/kingswood-logo.png", content: pngWithoutAncillaryMetadata(fs.readFileSync(firstLogo)) });
  }
  const definedNames = safeSheets
    .map((sheet, index) => {
      const rows = sheet.rows.map((row) => Array.isArray(row) ? row : [row]);
      const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 1);
      const lastColumn = columnName(Math.max(maxColumns - 1, 0));
      const printArea = `'${sheet.name}'!$A$1:$${lastColumn}$${Math.max(rows.length, 1)}`;
      return `${sheet.printTitleRows ? `<definedName name="_xlnm.Print_Titles" localSheetId="${index}">${xmlEscape(`'${sheet.name}'!${sheet.printTitleRows}`)}</definedName>` : ""}<definedName name="_xlnm.Print_Area" localSheetId="${index}">${xmlEscape(printArea)}</definedName>`;
    })
    .join("");
  if (definedNames) {
    const workbookFile = files.find((file) => file.name === "xl/workbook.xml");
    workbookFile.content = workbookFile.content.replace("</workbook>", `<definedNames>${definedNames}</definedNames></workbook>`);
  }
  return zipStore(files);
}

function trainingXlsx(year, records = []) {
  const rows = [
    ["Kingswood (London) Ltd"],
    ["Training Matrix"],
    [`Year ${year}`],
    [`Date generated ${new Date().toLocaleDateString("en-GB")}`],
    [],
    ["Employee", "Training / Qualification", "Provider", "Certificate number", "Completed date", "Expiry date", "Status"],
    ...records.map((record) => [
      record.employee,
      record.course,
      record.provider,
      record.certificateNumber,
      record.completedDate,
      record.expiryDate,
      record.status
    ])
  ];
  const sheetData = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, cellIndex) => {
    const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
    return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="24"/><col min="2" max="2" width="34"/><col min="3" max="3" width="24"/><col min="4" max="4" width="26"/><col min="5" max="5" width="16"/><col min="6" max="6" width="16"/><col min="7" max="7" width="18"/></cols><sheetData>${sheetData}</sheetData></worksheet>`;
  return zipStore([
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Training Matrix ${xmlEscape(year)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name: "xl/worksheets/sheet1.xml", content: sheet }
  ]);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsvSafely(filePath, rows) {
  const headers = ["staffId", "name", "year", "holidayAllowance", "holidayTaken", "holidayRemaining", "sickDays", "trainingRecords"];
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(","))
  ];
  writeJsonSafely(filePath, lines.join("\r\n"), "staff-reports");
}

function recordYear(record, fallbackYear) {
  const value = record.year || record.date || record.from || record.completedDate || record.expiryDate || fallbackYear;
  const year = String(value).slice(0, 4);
  return /^\d{4}$/.test(year) ? year : fallbackYear;
}

function staffReportRows(payload, year) {
  const attendance = payload.attendanceRecords || [];
  const holidays = payload.approvedHolidays || [];
  const training = payload.trainingRecords || [];
  return (payload.staffProfiles || []).map((staff) => {
    const staffId = staff.staffId || "";
    const holidayTaken = holidays
      .filter((item) => item.staffId === staffId && String(item.year || recordYear(item, year)) === year)
      .reduce((sum, item) => sum + Number(item.days || 0), 0);
    const sickDays = attendance
      .filter((item) => item.staffId === staffId && String(item.year || recordYear(item, year)) === year)
      .filter((item) => /sick|absent/i.test(item.status || ""))
      .length;
    return {
      staffId,
      name: staff.name || "",
      year,
      holidayAllowance: 28,
      holidayTaken,
      holidayRemaining: 28 - holidayTaken,
      sickDays,
      trainingRecords: training
        .filter((item) => item.staffId === staffId && String(item.year || recordYear(item, year)) === year)
        .map((item) => item.course || item.training || "")
        .filter(Boolean)
        .join("; ")
    };
  });
}

function saveStaffRecords(payload) {
  const currentYear = String(new Date().getFullYear());
  const years = new Set([currentYear]);
  [
    ...(payload.holidayRequests || []),
    ...(payload.attendanceRecords || []),
    ...(payload.trainingRecords || []),
    ...(payload.sicknessAbsence || [])
  ].forEach((record) => years.add(recordYear(record, currentYear)));

  fs.mkdirSync(staffRecordsDir, { recursive: true });
  years.forEach((year) => {
    const yearDir = path.join(staffRecordsDir, year);
    fs.mkdirSync(yearDir, { recursive: true });
    if (Number(year) < Number(currentYear)) return;
    const profiles = (payload.staffProfiles || []).map((staff) => ({
      ...staff,
      holidayAllowance: staff.holidayAllowance || staff.contractualAnnualHolidayEntitlement || "",
      holidayAllowanceYear: year
    }));
    const holidayRequests = (payload.holidayRequests || []).filter((item) => recordYear(item, year) === year);
    const approvedHolidays = holidayRequests.filter((item) => item.status === "Approved");
    const sicknessAbsence = (payload.sicknessAbsence || []).filter((item) => recordYear(item, year) === year);
    const trainingRecords = (payload.trainingRecords || []).filter((item) => recordYear(item, year) === year);
    const attendanceRecords = (payload.attendanceRecords || []).filter((item) => recordYear(item, year) === year);

    writeJsonSafely(path.join(yearDir, "staff_profiles.json"), JSON.stringify(profiles, null, 2), "staff-profiles");
    writeJsonSafely(path.join(yearDir, "holiday_requests.json"), JSON.stringify(holidayRequests, null, 2), "holiday-requests");
    writeJsonSafely(path.join(yearDir, "approved_holidays.json"), JSON.stringify(approvedHolidays, null, 2), "approved-holidays");
    writeJsonSafely(path.join(yearDir, "sickness_absence.json"), JSON.stringify(sicknessAbsence, null, 2), "sickness-absence");
    writeJsonSafely(path.join(yearDir, "training_records.json"), JSON.stringify(trainingRecords, null, 2), "training-records");
    writeJsonSafely(path.join(yearDir, "attendance_records.json"), JSON.stringify(attendanceRecords, null, 2), "attendance-records");
    writeCsvSafely(path.join(yearDir, "staff_reports.csv"), staffReportRows(payload, year));
  });
  return { folder: staffRecordsDir, years: [...years].sort() };
}

function saveFineRecord(payload) {
  const fine = payload.fine || {};
  const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];
  const year = String(fine.date || new Date().getFullYear()).slice(0, 4);
  const folderName = safeFileName([
    fine.date || new Date().toISOString().slice(0, 10),
    fine.registration || "Vehicle",
    fine.driver || "Driver",
    fine.type || "Fine"
  ].join(" - "), "Fine record");
  const fineFolder = path.join(finesAndChargesDir, year, folderName);
  fs.mkdirSync(fineFolder, { recursive: true });

  const savedEvidence = evidence.map((item, index) => {
    const parsed = bufferFromDataUrl(item.dataUrl);
    const ext = extensionFromMime(item.mimeType || parsed.mimeType, item.name);
    const fileBase = safeFileName(item.name || `evidence-${index + 1}${ext}`, `evidence-${index + 1}${ext}`);
    const fileName = fileBase.toLowerCase().endsWith(ext) ? fileBase : `${fileBase}${ext}`;
    const filePath = path.join(fineFolder, fileName);
    fs.writeFileSync(filePath, parsed.buffer);
    return {
      id: item.id || `${Date.now()}-${index}`,
      name: fileName,
      type: item.type || (ext === ".pdf" ? "pdf" : "image"),
      mimeType: item.mimeType || parsed.mimeType,
      filePath,
      savedAt: new Date().toISOString()
    };
  });

  const existingEvidence = Array.isArray(fine.evidenceItems)
    ? fine.evidenceItems.filter((item) => !item.dataUrl)
    : [];
  const record = {
    ...fine,
    evidenceItems: [...existingEvidence, ...savedEvidence],
    evidenceFileNames: [...existingEvidence, ...savedEvidence].map((item) => item.name).filter(Boolean),
    oneDriveFolder: fineFolder,
    updatedAt: new Date().toISOString()
  };
  writeJsonSafely(path.join(fineFolder, "fine_record.json"), JSON.stringify(record, null, 2), "fine-record");
  return {
    folder: fineFolder,
    evidenceItems: record.evidenceItems
  };
}

function saveTrainingRecord(payload) {
  const record = payload.record || {};
  const document = payload.document || null;
  const employeeName = safeFileName(record.employee || "Employee", "Employee");
  const year = String(record.completedDate || record.expiryDate || new Date().getFullYear()).slice(0, 4);
  const trainingFolder = path.join(employeesRootDir, employeeName, "Training and Qualifications", year);
  fs.mkdirSync(trainingFolder, { recursive: true });

  let savedDocument = null;
  if (document && document.dataUrl) {
    const parsed = bufferFromDataUrl(document.dataUrl);
    const ext = extensionFromMime(document.mimeType || parsed.mimeType, document.name);
    const expiryLabel = record.noExpiry ? "No Expiry" : record.expiryDate || "No Expiry";
    const fileBase = safeFileName(
      `${record.employee || "Employee"} - ${record.course || "Training"} - ${record.completedDate || "No Date"} - ${expiryLabel}`,
      "training-document"
    );
    let fileName = `${fileBase}${ext}`;
    let filePath = path.join(trainingFolder, fileName);
    let version = 2;
    while (fs.existsSync(filePath)) {
      fileName = `${fileBase} - v${version}${ext}`;
      filePath = path.join(trainingFolder, fileName);
      version += 1;
    }
    fs.writeFileSync(filePath, parsed.buffer);
    savedDocument = {
      id: document.id || record.id || `${Date.now()}`,
      name: fileName,
      type: document.type || (ext === ".pdf" ? "pdf" : "image"),
      mimeType: document.mimeType || parsed.mimeType,
      filePath,
      savedAt: new Date().toISOString()
    };
  }

  const savedRecord = {
    ...record,
    documentFileName: savedDocument?.name || record.documentFileName || record.certificate || "",
    oneDriveLocation: savedDocument?.filePath || record.oneDriveLocation || "",
    updatedAt: new Date().toISOString()
  };
  const data = readCommandCentreData();
  const normalisedRecord = normaliseTrainingRecord(savedRecord, data.staffProfiles || [], {
    now: savedRecord.updatedAt,
    today: savedRecord.updatedAt.slice(0, 10)
  });
  const recordFileName = safeFileName(`${normalisedRecord.trainingRecordId || normalisedRecord.id || timestampForFile()} - ${normalisedRecord.course || "Training record"}.json`, "training-record.json");
  writeJsonSafely(path.join(trainingFolder, recordFileName), JSON.stringify(normalisedRecord, null, 2), "training-record");
  return {
    folder: trainingFolder,
    record: normalisedRecord,
    document: savedDocument
  };
}

function saveComplianceRecord(payload) {
  const record = payload.record || {};
  const document = payload.document || null;
  const complianceType = safeFileName(record.complianceType || "Other", "Other");
  const year = String(record.expiryDate || record.startDate || new Date().getFullYear()).slice(0, 4);
  const currentFolder = path.join(companyComplianceDir, complianceType, year, "Current");
  const archiveFolder = path.join(companyComplianceDir, complianceType, year, "Archive");
  fs.mkdirSync(currentFolder, { recursive: true });
  fs.mkdirSync(archiveFolder, { recursive: true });

  let savedDocument = null;
  if (document && document.dataUrl) {
    const parsed = bufferFromDataUrl(document.dataUrl);
    const ext = extensionFromMime(document.mimeType || parsed.mimeType, document.name);
    const expiryLabel = record.noExpiry ? "No Expiry" : record.expiryDate || "No Expiry";
    const fileBase = safeFileName(
      `${record.title || "Compliance"} - ${record.provider || "Provider"} - ${expiryLabel}`,
      "compliance-document"
    );
    let fileName = `${fileBase}${ext}`;
    let filePath = path.join(currentFolder, fileName);
    let version = 2;
    while (fs.existsSync(filePath)) {
      fileName = `${fileBase} - v${version}${ext}`;
      filePath = path.join(currentFolder, fileName);
      version += 1;
    }
    fs.writeFileSync(filePath, parsed.buffer);
    savedDocument = {
      id: document.id || record.id || `${Date.now()}`,
      name: fileName,
      type: document.type || (ext === ".pdf" ? "pdf" : "document"),
      mimeType: document.mimeType || parsed.mimeType,
      filePath,
      savedAt: new Date().toISOString()
    };
  }

  const savedRecord = {
    ...record,
    documentFileName: savedDocument?.name || record.documentFileName || "",
    supportingDocumentName: savedDocument?.name || record.supportingDocumentName || record.documentFileName || "",
    oneDriveLocation: savedDocument?.filePath || record.oneDriveLocation || "",
    archiveFolder,
    updatedAt: new Date().toISOString()
  };
  const recordFileName = safeFileName(`${savedRecord.recordId || savedRecord.id || timestampForFile()} - ${savedRecord.title || "Compliance record"}.json`, "compliance-record.json");
  writeJsonSafely(path.join(currentFolder, recordFileName), JSON.stringify(savedRecord, null, 2), "compliance-record");
  return {
    folder: currentFolder,
    archiveFolder,
    record: savedRecord,
    document: savedDocument
  };
}

function saveAssetRecord(payload) {
  const asset = payload.asset || {};
  const documents = Array.isArray(payload.documents) ? payload.documents : [];
  const category = safeFileName(asset.category || "Other", "Other");
  const assetFolderName = safeFileName(`${asset.asset || "Asset"} - ${asset.assetId || asset.id || timestampForFile()}`, "Asset");
  const assetFolder = path.join(assetsRootDir, category, assetFolderName);
  const photosFolder = path.join(assetFolder, "Photos");
  const documentsFolder = path.join(assetFolder, "Documents");
  const inspectionsFolder = path.join(assetFolder, "Inspections");
  const servicesFolder = path.join(assetFolder, "Services");
  const repairsFolder = path.join(assetFolder, "Repairs");
  const archiveFolder = path.join(assetFolder, "Archive");
  [photosFolder, documentsFolder, inspectionsFolder, servicesFolder, repairsFolder, archiveFolder].forEach((folder) => fs.mkdirSync(folder, { recursive: true }));

  const savedDocuments = documents.map((item, index) => {
    const parsed = bufferFromDataUrl(item.dataUrl);
    const ext = extensionFromMime(item.mimeType || parsed.mimeType, item.name);
    const targetFolder = item.type === "image" ? photosFolder : documentsFolder;
    const baseName = safeFileName(item.name || `asset-document-${index + 1}${ext}`, `asset-document-${index + 1}${ext}`);
    const stem = baseName.toLowerCase().endsWith(ext) ? baseName.slice(0, -ext.length) : baseName;
    let fileName = `${stem}${ext}`;
    let filePath = path.join(targetFolder, fileName);
    let version = 2;
    while (fs.existsSync(filePath)) {
      fileName = `${stem} - v${version}${ext}`;
      filePath = path.join(targetFolder, fileName);
      version += 1;
    }
    fs.writeFileSync(filePath, parsed.buffer);
    return {
      id: item.id || `${Date.now()}-${index}`,
      name: fileName,
      type: item.type || (ext === ".pdf" ? "pdf" : "file"),
      mimeType: item.mimeType || parsed.mimeType,
      filePath,
      savedAt: new Date().toISOString()
    };
  });

  const existingDocuments = Array.isArray(asset.documents)
    ? asset.documents.filter((item) => !item.dataUrl)
    : [];
  const record = {
    ...asset,
    documents: [...existingDocuments, ...savedDocuments],
    documentFileNames: [...existingDocuments, ...savedDocuments].map((item) => item.name).filter(Boolean),
    oneDriveFolder: assetFolder,
    updatedAt: new Date().toISOString()
  };
  writeJsonSafely(path.join(assetFolder, "asset_record.json"), JSON.stringify(record, null, 2), "asset-record");
  return {
    folder: assetFolder,
    documents: record.documents,
    record
  };
}

function vehicleRecordFolders(vehicle = {}) {
  const registration = safeFileName(vehicle.registration || vehicle.vehicleId || "Vehicle", "Vehicle");
  const vehicleId = safeFileName(vehicle.vehicleId || "No Vehicle ID", "No Vehicle ID");
  const rootFolder = path.join(vehicleRecordsRootDir, `${registration} - ${vehicleId}`);
  const documentsFolder = path.join(rootFolder, "Documents");
  const maintenanceFolder = path.join(rootFolder, "Maintenance");
  const archiveFolder = path.join(rootFolder, "Archive");
  [rootFolder, documentsFolder, maintenanceFolder, archiveFolder].forEach((folder) => fs.mkdirSync(folder, { recursive: true }));
  return { rootFolder, documentsFolder, maintenanceFolder, archiveFolder };
}

function saveVehicleEvidenceFile(targetFolder, evidence = {}, fallbackBase = "vehicle-document") {
  if (!evidence || !evidence.dataUrl) return null;
  const parsed = bufferFromDataUrl(evidence.dataUrl);
  const allowed = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
  const mimeType = evidence.mimeType || parsed.mimeType;
  if (!allowed.includes(mimeType)) throw new Error("Unsupported vehicle document file type.");
  if (parsed.buffer.length > 15 * 1024 * 1024) throw new Error("Vehicle document file is too large.");
  const ext = extensionFromMime(mimeType, evidence.name);
  const originalName = safeFileName(evidence.name || `${fallbackBase}${ext}`, `${fallbackBase}${ext}`);
  const stem = originalName.toLowerCase().endsWith(ext) ? originalName.slice(0, -ext.length) : originalName;
  let fileName = `${stem}${ext}`;
  let filePath = path.join(targetFolder, fileName);
  let version = 2;
  while (fs.existsSync(filePath)) {
    fileName = `${stem} - v${version}${ext}`;
    filePath = path.join(targetFolder, fileName);
    version += 1;
  }
  fs.writeFileSync(filePath, parsed.buffer);
  return {
    fileName,
    originalFileName: evidence.name || fileName,
    mimeType,
    fileSize: parsed.buffer.length,
    storageLocation: filePath,
    savedAt: new Date().toISOString()
  };
}

function phase09dFindVehicle(data, vehicleId) {
  data.vehicles = normaliseVehicleCollection(data.vehicles || []);
  return data.vehicles.find((vehicle) => textValue(vehicle.vehicleId) === textValue(vehicleId));
}

function phase09dExpiryActionId(vehicleId, documentId) {
  return `ACT-VEHICLE-DOCUMENT-${crypto.createHash("sha1").update(`${vehicleId}|${documentId}|expiry`).digest("hex").slice(0, 12).toUpperCase()}`;
}

function phase09dSyncExpiryAction(data, vehicle, documentRecord) {
  data.actionItems = Array.isArray(data.actionItems) ? data.actionItems : [];
  const status = vehicleDocumentStatus(documentRecord);
  const actionId = phase09dExpiryActionId(vehicle.vehicleId, documentRecord.documentId);
  const existing = data.actionItems.find((item) => item.actionId === actionId);
  const needsAction = ["Expired", "Expiring Soon"].includes(status.label);
  if (!needsAction) {
    if (existing && !["Completed", "Closed"].includes(existing.status)) {
      existing.status = "Closed";
      existing.completedAt = existing.completedAt || new Date().toISOString();
    }
    return null;
  }
  if (existing) {
    existing.status = status.label === "Expired" ? "Action Required" : "New";
    existing.priority = status.label === "Expired" ? "High" : "Medium";
    existing.dueDate = documentRecord.expiryDate || "";
    existing.title = `${vehicle.registration} - ${documentRecord.documentType} ${status.label}`;
    return existing;
  }
  const now = new Date().toISOString();
  const action = {
    actionId,
    type: "Vehicle Document Expiry",
    priority: status.label === "Expired" ? "High" : "Medium",
    title: `${vehicle.registration} - ${documentRecord.documentType} ${status.label}`,
    description: `${documentRecord.title} ${status.label.toLowerCase()}${documentRecord.expiryDate ? ` on ${documentRecord.expiryDate}` : ""}.`,
    status: status.label === "Expired" ? "Action Required" : "New",
    raisedAt: now,
    raisedByUserId: "Kingswood Hub",
    assignedToUserId: documentRecord.owner || "",
    vehicleId: vehicle.vehicleId,
    documentId: documentRecord.documentId,
    dueDate: documentRecord.expiryDate || "",
    auditTrail: [{ action: "Vehicle document expiry action created", by: "Kingswood Hub", at: now, status: status.label }]
  };
  data.actionItems.push(action);
  return action;
}

function assetExportRows(records = []) {
  return records.map((item) => [
    item.asset || "",
    item.assetId || "",
    item.category || "",
    item.assignedTo || "",
    item.vehicleOrLocation || "",
    item.condition || "",
    item.status || "",
    item.nextInspectionDue || "",
    item.nextServiceDue || "",
    item.nextPatDue || "",
    item.serialNumber || "",
    item.purchaseDate || "",
    item.purchaseCost || ""
  ]);
}

function assetCsv(records = []) {
  const headers = ["Asset", "Asset ID", "Category", "Assigned to", "Vehicle or location", "Condition", "Status", "Next inspection", "Next service", "Next PAT", "Serial number", "Purchase date", "Purchase cost"];
  return [headers, ...assetExportRows(records)]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");
}

function assetXlsx(records = []) {
  const rows = [
    ["Kingswood (London) Ltd"],
    ["Assets, Tools & Equipment Register"],
    [`Date generated: ${new Date().toLocaleDateString("en-GB")}`],
    [],
    ["Asset", "Asset ID", "Category", "Assigned to", "Vehicle or location", "Condition", "Status", "Next inspection", "Next service", "Next PAT", "Serial number", "Purchase date", "Purchase cost"],
    ...assetExportRows(records)
  ];
  return simpleXlsx(rows, "Asset Register");
}

function exportAssets(payload) {
  const format = payload.format === "xlsx" ? "xlsx" : "csv";
  const records = Array.isArray(payload.records) ? payload.records : [];
  const year = String(new Date().getFullYear());
  const exportDir = path.join(assetsRootDir, "Exports", year);
  fs.mkdirSync(exportDir, { recursive: true });
  const fileName = `Kingswood Asset Register ${year}.${format}`;
  const filePath = path.join(exportDir, fileName);
  if (format === "xlsx") {
    fs.writeFileSync(filePath, assetXlsx(records));
  } else {
    writeJsonSafely(filePath, assetCsv(records), "asset-register-export");
  }
  return { fileName, filePath, folder: exportDir };
}

function exportTrainingMatrix(payload) {
  const year = String(payload.year || new Date().getFullYear());
  const format = payload.format === "xlsx" ? "xlsx" : "csv";
  const records = Array.isArray(payload.records) ? payload.records : [];
  const exportDir = path.join(trainingMatrixExportsDir, year);
  fs.mkdirSync(exportDir, { recursive: true });
  const fileName = `Kingswood Training Matrix ${year}.${format}`;
  const filePath = path.join(exportDir, fileName);
  if (format === "xlsx") {
    fs.writeFileSync(filePath, trainingXlsx(year, records));
  } else {
    writeJsonSafely(filePath, trainingCsv(records), "training-matrix-export");
  }
  return { fileName, filePath, folder: exportDir };
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

const phase05bSessions = new Map();
const phase05bSessionCookie = "kw_phase5b_session";
const phase05bSessionTtlMs = 30 * 60 * 1000;
const phase10DirectorSessions = new Map();
const phase10DirectorSessionCookie = "kw_phase10_director_session";
const phase10DirectorSessionTtlMs = 30 * 60 * 1000;
const phase10DirectorPins = Object.freeze({
  Kevin: "1969",
  Alex: "1981"
});
const phase05bPilotContext = Object.freeze({
  userId: "USR-TECH-IAN-DICKENS",
  staffId: "STAFF-20260716-001",
  technicianId: "TECH-20260716-001",
  role: "Technician",
  fullName: "Ian Dickens",
  displayName: "Ian D"
});
const phase073dApprovedTechnicianIdsByStaffId = Object.freeze({
  "STAFF-20260716-001": "TECH-20260716-001",
  "STAFF-20260716-002": "TECH-20260716-002",
  "STAFF-20260716-003": "TECH-20260716-003",
  "STAFF-20260716-004": "TECH-20260716-004",
  "STAFF-20260716-005": "TECH-20260716-005",
  "STAFF-20260716-006": "TECH-20260716-006",
  "STAFF-20260716-007": "TECH-20260716-007",
  "STAFF-20260716-008": "TECH-20260716-008",
  "STAFF-20260716-009": "TECH-20260716-009"
});
const phase05dReportSubmissions = new Map();
const phase05bSourceRecords = Object.freeze({
  technician: {
    technicianId: phase05bPilotContext.technicianId,
    staffId: phase05bPilotContext.staffId,
    name: "Ian Dickens",
    status: "Active",
    appAccessStatus: "Phase 5B server session read-only test",
    assignedVehicleId: "VEH-PHASE05A-001",
    pinSet: true
  },
  jobs: [
    {
      jobId: "JOB-PHASE05A-IAN-001",
      jobReference: "KW-PH5A-001",
      jobDate: "2026-07-17",
      slot: "AM",
      clientName: "Phase 5A Test Client",
      mainClient: "Ark",
      jobTitle: "Proofing works",
      siteName: "Phase 5A Test Site",
      address: "Phase 5A Test House, Orpington",
      postcode: "BR6 0AA",
      contactName: "Site Manager",
      contactTelephone: "01689 000000",
      accessInstructions: "Report to reception and ask for the site manager before starting.",
      jobInstructions: "Inspect and complete proofing works to the rear service riser and external pipe entry points.",
      previousVisitNotes: "Previous visit identified possible rodent ingress around the service penetrations.",
      status: "Sent to Tech",
      assignedTechnicianId: phase05bPilotContext.technicianId,
      ramsIds: ["RAMS-PHASE05A-IAN-001"],
      documentIds: ["DOC-PHASE05A-IAN-001"],
      officeNotes: "Office-only note must not appear in the Technician App.",
      valuationCost: 450
    },
    {
      jobId: "JOB-PHASE05A-OTHER-001",
      jobReference: "KW-PH5A-002",
      jobDate: "2026-07-17",
      slot: "PM",
      clientName: "Other Technician Client",
      jobTitle: "Other technician job",
      address: "Other Test House",
      postcode: "BR6 0BB",
      status: "Sent to Tech",
      assignedTechnicianId: "TECH-20260716-002",
      ramsIds: ["RAMS-PHASE05A-OTHER-001"],
      documentIds: ["DOC-PHASE05A-OTHER-001"]
    }
  ],
  rams: [
    {
      ramsId: "RAMS-PHASE05A-IAN-001",
      jobId: "JOB-PHASE05A-IAN-001",
      title: "Phase 5A Proofing RAMS",
      status: "Sent",
      documentId: "DOC-PHASE05A-RAMS-001",
      readRequired: true
    },
    {
      ramsId: "RAMS-PHASE05A-OTHER-001",
      jobId: "JOB-PHASE05A-OTHER-001",
      title: "Other Technician RAMS",
      status: "Sent",
      documentId: "DOC-PHASE05A-OTHER-001"
    }
  ],
  documents: [
    {
      documentId: "DOC-PHASE05A-IAN-001",
      ownerType: "Job",
      ownerId: "JOB-PHASE05A-IAN-001",
      documentType: "Job Sheet",
      fileName: "Phase 5A Ian Dickens job sheet.pdf",
      friendlyUrl: "/docs/phase-05a/phase-05a-ian-dickens-readonly-feed.json",
      storageLocation: "C:/internal/path/must/not/export",
      status: "Active"
    },
    {
      documentId: "DOC-PHASE05A-RAMS-001",
      ownerType: "RAMS",
      ownerId: "RAMS-PHASE05A-IAN-001",
      documentType: "RAMS",
      fileName: "Phase 5A Ian Dickens RAMS.pdf",
      friendlyUrl: "/docs/phase-05a/phase-05a-ian-dickens-readonly-feed.json",
      status: "Active"
    },
    {
      documentId: "DOC-PHASE05A-OTHER-001",
      ownerType: "Job",
      ownerId: "JOB-PHASE05A-OTHER-001",
      documentType: "Job Sheet",
      fileName: "Other technician job sheet.pdf",
      status: "Active"
    }
  ],
  holidays: {
    staffId: phase05bPilotContext.staffId,
    entitlementDays: 28,
    usedDays: 0,
    remainingDays: 28,
    companyHolidayDeductions: 0,
    currentYear: 2026,
    requests: []
  },
  notifications: []
});

const phase05bLoginAliases = Object.freeze({
  "ian d": "Ian Dickens",
  "ian dickens": "Ian Dickens",
  "iain m": "Iain Morgan",
  "iain morgan": "Iain Morgan",
  "james c": "James Church",
  "james church": "James Church",
  "bill s": "William Scott",
  "william s": "William Scott",
  "william scott": "William Scott",
  "leigh s": "Leigh Styles",
  "leigh styles": "Leigh Styles",
  "aaron g": "Aaron Gray",
  "aaron gray": "Aaron Gray",
  "ross h": "Ross Hunt",
  "ross hunt": "Ross Hunt",
  "lee k": "Lee Knight",
  "lee knight": "Lee Knight",
  "russell p": "Russell Pinder",
  "russell pinder": "Russell Pinder"
});

function phase05bUserIdForStaff(staff = {}) {
  const source = textValue(staff.name || staff.staffId || "technician")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `USR-TECH-${source || "TECHNICIAN"}`;
}

function phase05bResolveTechnicianContext(selectedName = "") {
  const data = readCommandCentreData();
  const selectedKey = textValue(selectedName).toLowerCase();
  const fullName = phase05bLoginAliases[selectedKey] || textValue(selectedName);
  const staff = (data.staffProfiles || []).find((profile) =>
    textValue(profile.name).toLowerCase() === fullName.toLowerCase()
    && textValue(profile.role) === "Technician"
    && textValue(profile.status || "Active") === "Active"
    && textValue(profile.staffId)
    && textValue(profile.technicianId)
  );
  if (!staff) return null;
  const technician = (data.technicians || []).find((profile) =>
    textValue(profile.staffId) === textValue(staff.staffId)
    || textValue(profile.technicianId) === textValue(staff.technicianId)
    || textValue(profile.name || profile.fullName || profile.technicianName).toLowerCase() === textValue(staff.name).toLowerCase()
  );
  if (!technician || textValue(technician.technicianId) !== textValue(staff.technicianId)) return null;
  return {
    userId: textValue(staff.userId || technician.userId || phase05bUserIdForStaff(staff)),
    staffId: textValue(staff.staffId),
    technicianId: textValue(staff.technicianId),
    role: "Technician",
    fullName: textValue(staff.name),
    displayName: textValue(selectedName || staff.name)
  };
}

function phase05bTechnicianRecordForContext(context = {}) {
  const data = readCommandCentreData();
  const record = (data.technicians || []).find((profile) =>
    textValue(profile.technicianId) === textValue(context.technicianId)
    || textValue(profile.staffId) === textValue(context.staffId)
  ) || {};
  const assignedVehicle = findActiveVehicleAssignment(data.vehicles || [], context.technicianId, context.staffId);
  return {
    technicianId: textValue(context.technicianId),
    staffId: textValue(context.staffId),
    name: textValue(record.name || record.fullName || record.technicianName || context.fullName),
    status: textValue(record.status || "Active"),
    appAccessStatus: textValue(record.appAccessStatus || "Active"),
    assignedVehicleId: textValue(assignedVehicle?.vehicleId || record.assignedVehicleId || record.vehicleId),
    lastAppActivityAt: textValue(record.lastAppActivityAt),
    pinSet: record.pinSet !== false
  };
}

function parseCookies(request) {
  return String(request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index === -1) return cookies;
      cookies[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return cookies;
    }, {});
}

function phase05bCookieValue(sessionId, maxAgeSeconds = Math.floor(phase05bSessionTtlMs / 1000)) {
  const safeId = encodeURIComponent(sessionId || "");
  return `${phase05bSessionCookie}=${safeId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

function createPhase05bSession(context, ttlMs = phase05bSessionTtlMs) {
  const sessionId = crypto.randomBytes(32).toString("base64url");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlMs);
  phase05bSessions.set(sessionId, {
    sessionId,
    context,
    selectedName: context.displayName,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  });
  return phase05bSessions.get(sessionId);
}

function getPhase05bSession(request) {
  const sessionId = parseCookies(request)[phase05bSessionCookie];
  const session = sessionId ? phase05bSessions.get(sessionId) : null;
  if (!session) return { ok: false, status: 401, message: "Valid technician session required." };
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    phase05bSessions.delete(sessionId);
    return { ok: false, status: 401, message: "Technician session has expired." };
  }
  return { ok: true, session };
}

function phase10CookieValue(sessionId, maxAgeSeconds = Math.floor(phase10DirectorSessionTtlMs / 1000)) {
  const safeId = encodeURIComponent(sessionId || "");
  return `${phase10DirectorSessionCookie}=${safeId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

function phase10DirectorContextForName(data, name) {
  const key = normaliseDirectorName(name);
  const expected = key ? DIRECTOR_STAFF[key] : null;
  if (!expected) return null;
  const staff = (data.staffProfiles || []).find((profile) =>
    directorTextValue(profile.staffId) === expected.staffId
    && directorTextValue(profile.role).toLowerCase() === "director"
  );
  if (!staff) return null;
  return {
    userId: directorTextValue(staff.userId || staff.staffId),
    staffId: staff.staffId,
    role: "Director",
    displayName: key,
    fullName: directorTextValue(staff.name || expected.name)
  };
}

function phase10DirectorIdentityFromRequest(request) {
  const header = request.headers["x-kingswood-user"];
  return directorTextValue(Array.isArray(header) ? header[0] : header);
}

function createPhase10DirectorSession(context, ttlMs = phase10DirectorSessionTtlMs) {
  const sessionId = crypto.randomBytes(32).toString("base64url");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlMs);
  phase10DirectorSessions.set(sessionId, {
    sessionId,
    context,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  });
  return phase10DirectorSessions.get(sessionId);
}

function getPhase10DirectorSession(request) {
  const sessionId = parseCookies(request)[phase10DirectorSessionCookie];
  const session = sessionId ? phase10DirectorSessions.get(sessionId) : null;
  if (session && new Date(session.expiresAt).getTime() > Date.now()) return { ok: true, session };
  if (session) {
    phase10DirectorSessions.delete(sessionId);
  }
  const commandCentreUser = phase10DirectorIdentityFromRequest(request);
  if (!commandCentreUser) return { ok: false, status: 401, message: "Authenticated Command Centre identity required." };
  const context = phase10DirectorContextForName(readCommandCentreData(), commandCentreUser);
  if (!context) return { ok: false, status: 403, message: "Director access is restricted to Kevin and Alex." };
  const newSession = createPhase10DirectorSession(context);
  return { ok: true, session: newSession, setCookie: phase10CookieValue(newSession.sessionId) };
}

function phase10ReadData() {
  if (!fs.existsSync(directorsAreaDataFile)) {
    return {
      schema: "kingswood.directorsArea.v1",
      legalEntities: [defaultKingswoodLegalEntity()],
      payrollPeriods: [],
      salaryAdvances: [],
      exportHistory: [],
      auditEvents: []
    };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(directorsAreaDataFile, "utf8") || "{}");
    const parsedLegalEntities = Array.isArray(parsed.legalEntities) ? parsed.legalEntities : [];
    const hasKingswood = parsedLegalEntities.some((entity) => directorTextValue(entity.legalEntityId) === KINGSWOOD_LONDON_LEGAL_ENTITY_ID);
    return {
      schema: "kingswood.directorsArea.v1",
      legalEntities: hasKingswood ? parsedLegalEntities : [defaultKingswoodLegalEntity(), ...parsedLegalEntities],
      payrollPeriods: Array.isArray(parsed.payrollPeriods) ? parsed.payrollPeriods : [],
      salaryAdvances: Array.isArray(parsed.salaryAdvances) ? parsed.salaryAdvances : [],
      exportHistory: Array.isArray(parsed.exportHistory) ? parsed.exportHistory : [],
      auditEvents: Array.isArray(parsed.auditEvents) ? parsed.auditEvents : []
    };
  } catch {
    return {
      schema: "kingswood.directorsArea.v1",
      legalEntities: [defaultKingswoodLegalEntity()],
      payrollPeriods: [],
      salaryAdvances: [],
      exportHistory: [],
      auditEvents: []
    };
  }
}

function phase10WriteData(data) {
  fs.mkdirSync(directorsAreaRootDir, { recursive: true });
  return writeJsonSafely(directorsAreaDataFile, `${JSON.stringify(data, null, 2)}\n`, "directors-area-data");
}

function revolutReadSecretFile(filePath) {
  const renderSecretPath = path.join("/etc/secrets", path.basename(filePath));
  const candidates = [filePath, renderSecretPath]
    .filter(Boolean)
    .filter((candidate, index, list) => list.indexOf(candidate) === index);
  const match = candidates.find((candidate) => fs.existsSync(candidate));
  if (!match) throw new Error("Revolut connection is not configured.");
  return fs.readFileSync(match, "utf8").trim();
}

function revolutBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function revolutClientAssertion() {
  const clientId = revolutReadSecretFile(revolutClientIdFile);
  const issuer = revolutReadSecretFile(revolutIssuerFile);
  const privateKey = revolutReadSecretFile(revolutPrivateKeyFile);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: issuer,
    sub: clientId,
    aud: "https://revolut.com",
    exp: now + 300
  };
  const signingInput = `${revolutBase64Url(JSON.stringify(header))}.${revolutBase64Url(JSON.stringify(payload))}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(privateKey);
  return `${signingInput}.${revolutBase64Url(signature)}`;
}

function revolutHttpsJson(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const requestOptions = {
      method: options.method || "GET",
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      headers: options.headers || {}
    };
    const apiRequest = https.request(requestOptions, (apiResponse) => {
      let body = "";
      apiResponse.setEncoding("utf8");
      apiResponse.on("data", (chunk) => { body += chunk; });
      apiResponse.on("end", () => {
        let parsed = null;
        try { parsed = body ? JSON.parse(body) : null; } catch { parsed = null; }
        resolve({ status: apiResponse.statusCode || 0, body: parsed });
      });
    });
    apiRequest.on("error", reject);
    apiRequest.setTimeout(30000, () => apiRequest.destroy(new Error("Revolut request timed out.")));
    if (options.body) apiRequest.write(options.body);
    apiRequest.end();
  });
}

function revolutReadTokens() {
  const renderBootstrapTokenFile = path.join("/etc/secrets", path.basename(revolutTokenFile));
  if (!fs.existsSync(revolutTokenFile) && fs.existsSync(renderBootstrapTokenFile)) {
    fs.mkdirSync(path.dirname(revolutTokenFile), { recursive: true });
    fs.copyFileSync(renderBootstrapTokenFile, revolutTokenFile);
  }
  if (!fs.existsSync(revolutTokenFile)) return null;
  return JSON.parse(fs.readFileSync(revolutTokenFile, "utf8") || "{}");
}

function revolutWriteTokens(tokens) {
  fs.mkdirSync(path.dirname(revolutTokenFile), { recursive: true });
  fs.writeFileSync(revolutTokenFile, `${JSON.stringify(tokens, null, 2)}\n`, "utf8");
}

async function revolutRefreshAccessToken(tokens) {
  if (!tokens?.refresh_token) throw new Error("Revolut refresh token is unavailable.");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_assertion_type: revolutClientAssertionType,
    client_assertion: revolutClientAssertion()
  }).toString();
  const result = await revolutHttpsJson(revolutTokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body)
    },
    body
  });
  if (result.status < 200 || result.status >= 300 || !result.body?.access_token) {
    throw new Error("Revolut token refresh failed.");
  }
  const nextTokens = {
    ...tokens,
    ...result.body,
    refresh_token: result.body.refresh_token || tokens.refresh_token
  };
  revolutWriteTokens(nextTokens);
  return nextTokens;
}

async function revolutFetchAccountsWithToken(accessToken) {
  return revolutHttpsJson(revolutAccountsEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}

async function revolutGbpBalanceSnapshot() {
  let tokens = revolutReadTokens();
  if (!tokens?.access_token) {
    return { ok: true, connected: false, status: "Not connected", message: "Revolut tokens are not stored yet." };
  }
  let result = await revolutFetchAccountsWithToken(tokens.access_token);
  if (result.status === 401 && tokens.refresh_token) {
    tokens = await revolutRefreshAccessToken(tokens);
    result = await revolutFetchAccountsWithToken(tokens.access_token);
  }
  if (result.status < 200 || result.status >= 300 || !Array.isArray(result.body)) {
    throw new Error("Revolut accounts request failed.");
  }
  const activeGbpAccount = result.body.find((account) =>
    String(account?.currency || "").toUpperCase() === "GBP"
    && String(account?.state || "").toLowerCase() === "active"
  );
  return {
    ok: true,
    connected: true,
    status: "Connected",
    currency: "GBP",
    availableBalance: activeGbpAccount ? Number(activeGbpAccount.balance || 0) : null,
    activeGbpAccountFound: Boolean(activeGbpAccount),
    lastUpdatedAt: new Date().toISOString(),
    accountIdentifiersDisplayed: false
  };
}

function phase10Audit(data, session, action, entityType, entityId, oldValue = null, newValue = null, reason = "") {
  const at = new Date().toISOString();
  data.auditEvents.push({
    auditEventId: auditEventIdFor(action, entityType, entityId, at, session.context.userId),
    entityType,
    entityId,
    action,
    performedByUserId: session.context.userId,
    performedByRole: "Director",
    performedAt: at,
    oldValue,
    newValue,
    reason,
    sourceApp: "Kingswood Hub",
    immutable: true
  });
}

function phase10MonthBounds(month) {
  const [year, monthNumber] = String(month || "").split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function phase10PayrollEligibleStaffIds(commandData = {}) {
  return new Set((commandData.staffProfiles || [])
    .filter(isPayrollActive)
    .map((staff) => directorTextValue(staff.staffId))
    .filter(Boolean));
}

function phase10SanitisePayrollPeriodForRead(commandData = {}, period = {}) {
  const eligibleStaffIds = phase10PayrollEligibleStaffIds(commandData);
  return {
    ...period,
    entries: (period.entries || []).filter((entry) => eligibleStaffIds.has(directorTextValue(entry.staffId)))
  };
}

function phase10SanitiseDirectorsDataForRead(commandData = {}, directorsData = {}) {
  const eligibleStaffIds = phase10PayrollEligibleStaffIds(commandData);
  return {
    ...directorsData,
    legalEntities: legalEntitiesForRead(directorsData),
    payrollPeriods: (directorsData.payrollPeriods || []).map((period) => phase10SanitisePayrollPeriodForRead(commandData, period)),
    salaryAdvances: (directorsData.salaryAdvances || []).filter((advance) => eligibleStaffIds.has(directorTextValue(advance.staffId)))
  };
}

function phase10UpdateLegalEntity(directorsData, legalEntityId, payload, session) {
  const current = findLegalEntity(directorsData, legalEntityId);
  if (!current) return { status: 404, body: { ok: false, message: "Legal entity not found." } };
  const next = normaliseLegalEntityRecord({
    ...current,
    ...payload,
    legalEntityId: current.legalEntityId,
    lastUpdatedBy: session.context.userId,
    lastUpdatedAt: new Date().toISOString()
  }, current);
  const errors = validateLegalEntityRecord(next);
  if (errors.length) return { status: 400, body: { ok: false, message: "Company details could not be saved.", errors } };
  const existing = Array.isArray(directorsData.legalEntities) ? directorsData.legalEntities : [];
  const index = existing.findIndex((entity) => directorTextValue(entity.legalEntityId) === directorTextValue(legalEntityId));
  if (index >= 0) existing[index] = next;
  else existing.push(next);
  directorsData.legalEntities = existing;
  phase10Audit(directorsData, session, "Company Details Updated", "LegalEntity", legalEntityId, current, next);
  phase10WriteData(directorsData);
  return { status: 200, body: { ok: true, legalEntity: next } };
}

function phase10BuildOverview(commandData, directorsData) {
  const readableDirectorsData = phase10SanitiseDirectorsDataForRead(commandData, directorsData);
  const activeStaff = (commandData.staffProfiles || []).filter(isActiveEmploymentRecord);
  const activeEmployees = activeStaff.filter(isEmployeePayrollRecord);
  const activeTechnicians = activeStaff.filter((staff) => directorTextValue(staff.role).toLowerCase().includes("technician"));
  const todayValue = localDateValue();
  const absentToday = (commandData.attendanceRecords || []).filter((record) => directorTextValue(record.date) === todayValue && !/present|working/i.test(directorTextValue(record.status)));
  const upcomingHolidays = (commandData.holidayRequests || [])
    .filter((request) => directorTextValue(request.status).toLowerCase() === "approved")
    .filter((request) => directorTextValue(request.from || request.startDate || request.date) >= todayValue)
    .sort((a, b) => directorTextValue(a.from || a.startDate || a.date).localeCompare(directorTextValue(b.from || b.startDate || b.date)))
    .slice(0, 8);
  const trainingAttention = (commandData.trainingMatrix || []).filter((record) => /expired|missing|expiring/i.test(directorTextValue(record.status || record.lifecycleStatus))).length;
  const vehicleAttention = (commandData.vehicleInspections || []).filter((record) => /defect|review/i.test(directorTextValue(record.status))).length;
  const payrollAttention = readableDirectorsData.payrollPeriods.filter((period) => period.status !== "Exported" && period.status !== "Superseded").length;
  const unresolvedPayrollExceptions = readableDirectorsData.payrollPeriods.reduce((sum, period) =>
    sum + (period.entries || []).reduce((count, entry) => count + (entry.exceptions || []).length, 0), 0);
  return {
    activeStaffCount: activeEmployees.length,
    activeTechnicianCount: activeTechnicians.length,
    absentToday,
    upcomingHolidays,
    recordsNeedingAttention: trainingAttention,
    payrollPeriodsNeedingReview: payrollAttention,
    unresolvedPayrollExceptions,
    seriousVehicleExceptions: vehicleAttention,
    holidayYears: [String(new Date().getFullYear()), String(new Date().getFullYear() + 1)],
    employees: phase10BuildEmployeeAbsenceOverview(commandData),
    directorActions: [
      ...(payrollAttention ? [`${payrollAttention} payroll period(s) need review or export.`] : []),
      ...(unresolvedPayrollExceptions ? [`${unresolvedPayrollExceptions} payroll exception(s) need a director decision.`] : []),
      ...(vehicleAttention ? [`${vehicleAttention} vehicle inspection item(s) need review.`] : [])
    ]
  };
}

function phase10BuildEmployeeAbsenceOverview(commandData) {
  const currentYear = String(new Date().getFullYear());
  const years = [currentYear, String(Number(currentYear) + 1)];
  const policy = commandData.holidayPolicy || commandData.companyHolidayPolicy || {};
  return (commandData.staffProfiles || [])
    .filter(isEmployeePayrollRecord)
    .map((staff) => {
      const staffId = directorTextValue(staff.staffId);
      const name = directorTextValue(staff.name);
      const entitlements = Object.fromEntries(years.map((year) => [year, calculateHolidayEntitlement(staff, {
        year,
        policy,
        holidayRequests: commandData.holidayRequests || [],
        actualHoursWorked: staff.actualHoursWorkedInLeaveYear
      })]));
      const entitlement = entitlements[currentYear];
      const allowance = Number(entitlement.calculatedEntitlement || staff.holidayAllowance || 0);
      const approved = (commandData.holidayRequests || []).filter((request) =>
        (directorTextValue(request.staffId) === staffId || directorTextValue(request.name) === name)
        && directorTextValue(request.status).toLowerCase() === "approved"
        && String(request.from || request.startDate || request.date || "").startsWith(currentYear)
      );
      const used = approved.reduce((sum, request) => sum + Number(request.days || 0), 0);
      const attendance = (commandData.attendanceRecords || []).filter((record) =>
        (directorTextValue(record.staffId) === staffId || directorTextValue(record.name) === name)
        && String(record.date || "").startsWith(currentYear)
      );
      return {
        staffId,
        name,
        role: directorTextValue(staff.role),
        employmentStatus: directorTextValue(staff.employmentStatus || staff.status || "Active"),
        holidayAllowance: allowance,
        holidayUsed: entitlement.approvedLeaveTaken,
        holidayBooked: entitlement.approvedFutureLeave,
        holidayRemaining: entitlement.remainingEntitlement,
        holidayUnit: entitlement.unit,
        holidaySetupStatus: entitlement.setupStatus,
        holidayMissingSetupFields: entitlement.missingSetupFields,
        holidayRuleVersion: entitlement.ruleVersion,
        holidayBreakdown: entitlement.breakdown,
        holidayEntitlementsByYear: entitlements,
        sicknessDays: attendance.filter((record) => /sick/i.test(directorTextValue(record.status || record.category))).length,
        otherAbsenceDays: attendance.filter((record) =>
          !/sick|holiday|annual leave/i.test(directorTextValue(record.status || record.category))
        ).length,
        unpaidLeave: attendance.filter((record) => /unpaid/i.test(directorTextValue(record.paidStatus))).length
      };
    });
}

function phase10AbsenceType(record = {}) {
  const text = directorTextValue(`${record.status || ""} ${record.category || ""} ${record.paidStatus || ""}`).toLowerCase();
  if (/holiday|annual leave|bank holiday/.test(text)) return "";
  if (/unpaid/.test(text)) return "Unpaid absence";
  if (/sick|illness|injury|fit note|return to work/.test(text)) return "Sick";
  if (/present|working/.test(text)) return "";
  return "Other authorised absence";
}

function phase10AbsenceAttention(record = {}) {
  const reasons = [];
  const type = phase10AbsenceType(record);
  if (type === "Sick" && record.returnToWorkCompleted === false) reasons.push("Return to Work check not completed");
  if (type === "Sick" && /fit note/i.test(directorTextValue(record.fitNoteRequired || record.notes)) && !directorTextValue(record.fitNote)) reasons.push("Fit note requires review");
  if (/injury|occupational/i.test(directorTextValue(record.category)) && directorTextValue(record.workplaceInjury) === "Yes" && !directorTextValue(record.workplaceIncident)) reasons.push("Workplace incident note missing");
  return reasons;
}

function phase10BuildTechnicianAbsenceSummary(commandData = {}, staff = {}, leaveYear = {}) {
  const staffId = directorTextValue(staff.staffId);
  const name = directorTextValue(staff.name);
  const bankHolidayDates = new Set(countedBankHolidays(staff, leaveYear).map((holiday) => holiday.date));
  const periods = (commandData.attendanceRecords || [])
    .filter((record) => directorTextValue(record.staffId) === staffId || (!directorTextValue(record.staffId) && directorTextValue(record.name) === name))
    .map((record) => {
      const type = phase10AbsenceType(record);
      if (!type) return null;
      const workingDays = phase10WorkingDaysForRecord(record, staff, leaveYear, bankHolidayDates);
      if (!workingDays) return null;
      const attention = phase10AbsenceAttention(record);
      return {
        recordId: directorTextValue(record.attendanceId || record.id),
        from: directorTextValue(record.startDate || record.from || record.date),
        to: directorTextValue(record.endDate || record.to || record.date || record.startDate || record.from),
        type,
        workingDays,
        attention
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.from.localeCompare(b.from));
  const sickDays = periods.filter((item) => item.type === "Sick").reduce((sum, item) => sum + item.workingDays, 0);
  const unpaidAbsenceDays = periods.filter((item) => item.type === "Unpaid absence").reduce((sum, item) => sum + item.workingDays, 0);
  const otherAuthorisedAbsenceDays = periods.filter((item) => item.type === "Other authorised absence").reduce((sum, item) => sum + item.workingDays, 0);
  return {
    totalAbsenceDays: sickDays + unpaidAbsenceDays + otherAuthorisedAbsenceDays,
    sickDays,
    otherAuthorisedAbsenceDays,
    unpaidAbsenceDays,
    periods,
    attention: periods.flatMap((period) => period.attention.map((reason) => ({ reason, recordId: period.recordId, from: period.from, to: period.to, type: period.type })))
  };
}

function phase10BuildTechnicianOverview(commandData, directorsData) {
  const currentYear = String(new Date().getFullYear());
  const policy = commandData.holidayPolicy || commandData.companyHolidayPolicy || {};
  return (commandData.staffProfiles || [])
    .filter((staff) => directorTextValue(staff.role).toLowerCase().includes("technician"))
    .map((staff) => {
      const staffId = directorTextValue(staff.staffId);
      const allowance = Number(staff.holidayAllowance || 0);
      const entitlement = calculateHolidayEntitlement(staff, {
        year: currentYear,
        policy,
        holidayRequests: commandData.holidayRequests || [],
        actualHoursWorked: staff.actualHoursWorkedInLeaveYear
      });
      const absenceSummary = phase10BuildTechnicianAbsenceSummary(commandData, staff, {
        start: entitlement.leaveYearStart,
        end: entitlement.leaveYearEnd
      });
      const vehicle = (commandData.vehicles || []).find((item) => directorTextValue(item.assignedStaffId) === staffId && directorTextValue(item.assignmentStatus || "Active") === "Active");
      const trainingWarnings = (commandData.trainingMatrix || []).filter((record) =>
        directorTextValue(record.staffId) === staffId && /expired|missing|expiring/i.test(directorTextValue(record.status || record.lifecycleStatus))
      ).length;
      return {
        staffId,
        technicianId: directorTextValue(staff.technicianId),
        name: directorTextValue(staff.name),
        employmentStatus: directorTextValue(staff.status || "Active"),
        payrollReference: directorTextValue(staff.payrollReference),
        holidayAllowance: entitlement.calculatedEntitlement || allowance,
        holidayUsed: entitlement.totalLeaveUsed ?? entitlement.approvedLeaveTaken ?? 0,
        holidayBooked: entitlement.approvedFutureLeave ?? 0,
        holidayRemaining: entitlement.remainingEntitlement,
        bankHolidaysCounted: entitlement.bankHolidaysCounted,
        employeeBookedLeaveTaken: entitlement.employeeBookedLeaveTaken,
        futureBookedLeave: entitlement.futureBookedLeave,
        absenceSummary,
        totalAbsenceDays: absenceSummary.totalAbsenceDays,
        sicknessDays: absenceSummary.sickDays,
        otherAbsenceDays: absenceSummary.otherAuthorisedAbsenceDays,
        overtimeAdditionalDays: 0,
        unpaidLeave: absenceSummary.unpaidAbsenceDays,
        assignedVehicle: vehicle ? `${vehicle.registration || ""} ${vehicle.vehicle || vehicle.makeModel || ""}`.trim() : "",
        assignedVehicleRegistration: directorTextValue(vehicle?.registration),
        assignedVehicleDescription: directorTextValue(vehicle?.vehicle || vehicle?.makeModel || vehicle?.description),
        trainingWarnings,
        payrollAttention: trainingWarnings > 0 || !directorTextValue(staff.payrollReference)
      };
    });
}

function phase10BuildPayrollPeriod(commandData, directorsData, month, session) {
  const periodId = payrollPeriodIdFor(month);
  const duplicate = directorsData.payrollPeriods.find((period) => period.payrollMonth === month && period.status !== "Superseded");
  if (duplicate) {
    return { status: 409, body: { ok: false, message: "An active payroll period already exists for this month.", period: duplicate } };
  }
  const now = new Date().toISOString();
  const bounds = phase10MonthBounds(month);
  const entries = buildPayrollSourceRows(commandData, directorsData, month);
  const period = {
    periodId,
    payrollMonth: month,
    status: "Draft",
    version: 1,
    periodStart: bounds.start,
    periodEnd: bounds.end,
    createdByUserId: session.context.userId,
    createdAt: now,
    updatedAt: now,
    sourceSnapshot: {
      staffProfiles: (commandData.staffProfiles || []).length,
      holidayRequests: (commandData.holidayRequests || []).length,
      attendanceRecords: (commandData.attendanceRecords || []).length,
      salaryAdvances: directorsData.salaryAdvances.filter((advance) => advance.payrollMonth === month).length
    },
    entries,
    approvals: [],
    exportIds: []
  };
  directorsData.payrollPeriods.push(period);
  phase10Audit(directorsData, session, "Payroll Period Created", "PayrollPeriod", periodId, null, { payrollMonth: month, version: 1 });
  phase10WriteData(directorsData);
  return { status: 200, body: { ok: true, period } };
}

function phase10FindPeriod(directorsData, periodId) {
  return directorsData.payrollPeriods.find((period) => directorTextValue(period.periodId) === directorTextValue(periodId));
}

function phase10AddSalaryAdvance(commandData, directorsData, periodId, payload, session) {
  const period = phase10FindPeriod(directorsData, periodId);
  if (!period) return { status: 404, body: { ok: false, message: "Payroll period not found." } };
  if (Number(payload.version) !== Number(period.version)) return { status: 409, body: { ok: false, message: "Payroll period has changed. Refresh before saving." } };
  const staffId = directorTextValue(payload.staffId);
  const staff = (commandData.staffProfiles || []).find((profile) => directorTextValue(profile.staffId) === staffId);
  const amount = Number(payload.amount);
  const datePaid = directorTextValue(payload.datePaid);
  const note = directorTextValue(payload.note);
  if (!staff) return { status: 400, body: { ok: false, message: "Known staff member required." } };
  if (!isPayrollActive(staff)) return { status: 400, body: { ok: false, message: "Salary advances can only be recorded for payroll-active employees." } };
  if (!Number.isFinite(amount) || amount <= 0) return { status: 400, body: { ok: false, message: "Salary advance amount must be positive." } };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePaid)) return { status: 400, body: { ok: false, message: "Valid date paid required." } };
  const advanceId = salaryAdvanceIdFor(staffId, period.payrollMonth, datePaid, amount, note);
  if (directorsData.salaryAdvances.some((advance) => advance.advanceId === advanceId && advance.status !== "Voided")) {
    return { status: 409, body: { ok: false, message: "This salary advance is already recorded.", advanceId } };
  }
  const now = new Date().toISOString();
  const advance = {
    advanceId,
    staffId,
    employee: directorTextValue(staff.name),
    amount: Number(amount.toFixed(2)),
    datePaid,
    payrollMonth: period.payrollMonth,
    note,
    status: "Active",
    recordedByUserId: session.context.userId,
    createdAt: now,
    updatedAt: now,
    includedInExport: false,
    exportVersion: ""
  };
  directorsData.salaryAdvances.push(advance);
  period.version += 1;
  period.updatedAt = now;
  period.entries = buildPayrollSourceRows(commandData, directorsData, period.payrollMonth);
  if (period.status === "Approved") period.status = "Ready for Review";
  phase10Audit(directorsData, session, "Salary Advance Recorded", "SalaryAdvance", advanceId, null, advance);
  phase10WriteData(directorsData);
  return { status: 200, body: { ok: true, advance, period } };
}

function phase10UpdatePeriodStatus(commandData, directorsData, periodId, payload, session) {
  const period = phase10FindPeriod(directorsData, periodId);
  if (!period) return { status: 404, body: { ok: false, message: "Payroll period not found." } };
  if (Number(payload.version) !== Number(period.version)) return { status: 409, body: { ok: false, message: "Payroll period has changed. Refresh before updating." } };
  const nextStatus = directorTextValue(payload.status);
  if (!PAYROLL_STATUSES.includes(nextStatus)) return { status: 400, body: { ok: false, message: "Invalid payroll status." } };
  if (nextStatus === period.status) return { status: 409, body: { ok: false, message: `Payroll period is already ${period.status}.` } };
  if (nextStatus === "Ready for Review" && period.status !== "Draft") {
    return { status: 400, body: { ok: false, message: "Only Draft payroll periods can be marked Ready for Review." } };
  }
  if (nextStatus === "Approved") {
    if (period.status !== "Ready for Review") {
      return { status: 400, body: { ok: false, message: "Only Ready for Review payroll periods can be approved." } };
    }
    const readablePeriod = phase10SanitisePayrollPeriodForRead(commandData, period);
    const unresolved = (readablePeriod.entries || []).reduce((sum, entry) => sum + (entry.exceptions || []).length, 0);
    if (unresolved && payload.acknowledgeUnresolved !== true) {
      return { status: 400, body: { ok: false, message: "Director acknowledgement is required while exceptions remain." } };
    }
    period.approvals = [
      ...(period.approvals || []),
      {
        approvedByUserId: session.context.userId,
        approvedByName: session.context.fullName,
        approvedAt: new Date().toISOString(),
        version: period.version,
        unresolvedExceptionsAcknowledged: Boolean(unresolved)
      }
    ];
  }
  if (nextStatus === "Exported" || nextStatus === "Superseded") {
    return { status: 400, body: { ok: false, message: `${nextStatus} is controlled by the export workflow and cannot be set manually.` } };
  }
  const oldStatus = period.status;
  period.status = nextStatus;
  period.version += 1;
  period.updatedAt = new Date().toISOString();
  phase10Audit(directorsData, session, "Payroll Status Changed", "PayrollPeriod", periodId, { status: oldStatus }, { status: nextStatus, version: period.version }, directorTextValue(payload.reason));
  phase10WriteData(directorsData);
  return { status: 200, body: { ok: true, period: phase10SanitisePayrollPeriodForRead(commandData, period) } };
}

function phase10PayrollWorkbook(commandData, period, directorsData, exportedAt, session) {
  const eligibleStaffIds = phase10PayrollEligibleStaffIds(commandData);
  const advances = directorsData.salaryAdvances.filter((advance) =>
    advance.payrollMonth === period.payrollMonth
    && advance.status === "Active"
    && eligibleStaffIds.has(directorTextValue(advance.staffId))
  );
  const readablePeriod = phase10SanitisePayrollPeriodForRead(commandData, period);
  const summaryEntries = readablePeriod.entries || [];
  const companyBranding = commandData.companyBranding || {};
  const legalEntity = findLegalEntity(directorsData, KINGSWOOD_LONDON_LEGAL_ENTITY_ID) || defaultKingswoodLegalEntity();
  const companyName = directorTextValue(legalEntity.legalCompanyName || companyBranding.companyName || "Kingswood (London) Ltd").replace(/^Kingswood London Ltd$/i, "Kingswood (London) Ltd");
  const tradingAddress = [...(legalEntity.tradingAddressLines || []), legalEntity.tradingTown, legalEntity.tradingPostcode].map(directorTextValue).filter(Boolean).join(", ");
  const registeredOfficeAddress = [...(legalEntity.registeredOfficeAddressLines || []), legalEntity.registeredOfficeTown, legalEntity.registeredOfficePostcode].map(directorTextValue).filter(Boolean).join(", ");
  const companyNumber = directorTextValue(legalEntity.companyRegistrationNumber);
  const vatNumber = directorTextValue(legalEntity.vatRegistrationNumber);
  const companyDetailRows = [
    ["Legal entity ID", legalEntity.legalEntityId, "legalEntities[].legalEntityId"],
    ["Trading address", tradingAddress, "legalEntities[].tradingAddressLines, tradingTown and tradingPostcode"],
    ["Registered office address", registeredOfficeAddress, "legalEntities[].registeredOfficeAddressLines, registeredOfficeTown and registeredOfficePostcode"],
    ["Company number", companyNumber, "legalEntities[].companyRegistrationNumber"],
    ["VAT number", vatNumber, "legalEntities[].vatRegistrationNumber"],
    ["Telephone", legalEntity.telephoneNumber, "legalEntities[].telephoneNumber"],
    ["General email", legalEntity.generalEmail, "legalEntities[].generalEmail"],
    ["Website", legalEntity.website, "legalEntities[].website"]
  ];
  const missingCompanyDetails = companyDetailRows.filter(([, value]) => !value);
  const generatedBy = directorTextValue(session?.context?.fullName || session?.context?.userId) || "Director";
  const approved = [...(period.approvals || [])].reverse()[0] || {};
  const approvedBy = directorTextValue(approved.approvedByName || approved.approvedByUserId) || "Not approved";
  const approvedAt = directorTextValue(approved.approvedAt) || "";
  const previousExports = (directorsData.exportHistory || []).filter((record) => record.periodId === period.periodId);
  const supersedes = previousExports.length ? previousExports.map((record) => record.fileName || record.exportId).join("; ") : "No previous export recorded";
  const workbookTitle = "Payroll Preparation Workbook";
  const accountantStatement = "The accountant remains responsible for payroll calculations and legal treatment. This workbook does not calculate gross pay, net pay, PAYE, National Insurance, pension, tax or statutory payment entitlement.";
  const titleRows = (sheetTitle) => [
    [{ value: companyName, style: "title" }, "", "", "", "", "", "", ""],
    [{ value: workbookTitle, style: "subtitle" }, "", "", "", "", "", "", ""],
    [{ value: tradingAddress || "Trading address not recorded", style: "note" }, "", "", "", "", "", "", ""],
    [{ value: "Company number", style: "metaLabel" }, { value: companyNumber || "Not recorded", style: "metaValue" }, { value: "VAT number", style: "metaLabel" }, { value: vatNumber || "Not recorded", style: "metaValue" }, "", "", "", ""],
    [],
    [{ value: "Worksheet", style: "metaLabel" }, { value: sheetTitle, style: "metaValue" }, { value: "Payroll month", style: "metaLabel" }, { value: period.payrollMonth, style: "metaValue" }, { value: "Export version", style: "metaLabel" }, { value: `v${period.version}`, style: "metaValue" }, "", ""],
    [{ value: "Approval status", style: "metaLabel" }, { value: period.status, style: "metaValue" }, { value: "Approved by", style: "metaLabel" }, { value: approvedBy, style: "metaValue" }, { value: "Approved", style: "metaLabel" }, approvedAt ? { value: approvedAt, type: "dateTime", style: "dateTime" } : { value: "Not approved", style: "metaValue" }, "", ""],
    [{ value: "Generated", style: "metaLabel" }, { value: exportedAt, type: "dateTime", style: "dateTime" }, { value: "Generated by", style: "metaLabel" }, { value: generatedBy, style: "metaValue" }, "", "", "", ""]
  ];
  const tableHeader = (headers) => headers.map((header) => ({ value: header, style: "header" }));
  const summaryHeaderRow = 9;
  const summaryDataStartRow = summaryHeaderRow + 1;
  const lastSummaryRow = Math.max(summaryDataStartRow, summaryDataStartRow + summaryEntries.length - 1);
  const summaryRows = [
    ...titleRows("Payroll Summary"),
    tableHeader(["Employee", "Payroll reference", "Employment status", "Normal days or hours", "Holiday", "Sickness", "Other paid absence", "Unpaid absence", "Overtime", "Additional days or hours", "Salary advances", "Other additions", "Other deductions", "Accountant notes", "Exception status"]),
    ...summaryEntries.map((entry, index) => [
      entry.employee,
      entry.payrollReference,
      entry.employmentStatus,
      entry.normalDaysHours,
      { value: entry.approvedHolidayDays, type: "number" },
      { value: entry.sickDays, type: "number" },
      { value: entry.otherPaidAbsenceDays, type: "number" },
      { value: entry.unpaidAbsenceDays, type: "number" },
      { value: entry.overtimeDays, type: "number" },
      { value: entry.additionalDaysHours, type: "number" },
      { value: entry.salaryAdvancesTotal, type: "currency", style: "currency" },
      { value: entry.otherAdditions || 0, type: "currency", style: "currency" },
      { value: (entry.otherDeductions || 0) + (entry.manualAdjustments < 0 ? Math.abs(entry.manualAdjustments) : 0), type: "currency", style: "currency" },
      { value: entry.notes, style: entry.notes ? "note" : "" },
      { value: (entry.exceptions || []).join("; "), style: (entry.exceptions || []).length ? "exception" : (index % 2 ? "alternate" : "") }
    ]),
    [
      { value: "Totals", style: "total" },
      "", "", "",
      { formula: `SUM(E${summaryDataStartRow}:E${lastSummaryRow})`, value: 0, type: "number", style: "total" },
      { formula: `SUM(F${summaryDataStartRow}:F${lastSummaryRow})`, value: 0, type: "number", style: "total" },
      { formula: `SUM(G${summaryDataStartRow}:G${lastSummaryRow})`, value: 0, type: "number", style: "total" },
      { formula: `SUM(H${summaryDataStartRow}:H${lastSummaryRow})`, value: 0, type: "number", style: "total" },
      { formula: `SUM(I${summaryDataStartRow}:I${lastSummaryRow})`, value: 0, type: "number", style: "total" },
      { formula: `SUM(J${summaryDataStartRow}:J${lastSummaryRow})`, value: 0, type: "number", style: "total" },
      { formula: `SUM(K${summaryDataStartRow}:K${lastSummaryRow})`, value: 0, type: "currency", style: "totalCurrency" },
      { formula: `SUM(L${summaryDataStartRow}:L${lastSummaryRow})`, value: 0, type: "currency", style: "totalCurrency" },
      { formula: `SUM(M${summaryDataStartRow}:M${lastSummaryRow})`, value: 0, type: "currency", style: "totalCurrency" },
      "", ""
    ]
  ];
  const payrollReferenceByStaffId = Object.fromEntries(summaryEntries.map((entry) => [entry.staffId, entry.payrollReference]));
  const advanceRows = [
    ...titleRows("Salary Advances"),
    tableHeader(["Advance ID", "Employee", "Payroll reference", "Staff ID", "Amount", "Date paid", "Payroll month", "Reason/note", "Recorded by", "Included export version", "Lifecycle state"]),
    ...advances.map((advance) => [advance.advanceId, advance.employee, payrollReferenceByStaffId[advance.staffId] || "", advance.staffId, { value: advance.amount, type: "currency", style: "currency" }, { value: advance.datePaid, type: "date", style: "date" }, advance.payrollMonth, { value: advance.note, style: advance.note ? "note" : "" }, advance.recordedByUserId, String(period.version), advance.status || "Active"])
  ];
  const payrollStaffIds = new Set(summaryEntries.map((entry) => entry.staffId));
  const staffNameById = Object.fromEntries((commandData.staffProfiles || []).map((staff) => [directorTextValue(staff.staffId), directorTextValue(staff.name)]));
  const absenceDetailRows = [];
  (commandData.holidayRequests || [])
    .filter((request) => payrollStaffIds.has(directorTextValue(request.staffId)))
    .filter((request) => directorTextValue(request.status).toLowerCase() === "approved")
    .filter((request) => daysInMonthRange(request.startDate || request.from || request.date, request.endDate || request.to || request.date, period.payrollMonth) > 0)
    .forEach((request) => {
      const staffId = directorTextValue(request.staffId);
      absenceDetailRows.push([
        staffNameById[staffId] || request.name,
        directorTextValue(payrollReferenceByStaffId[staffId] || staffId),
        "Holiday",
        { value: request.startDate || request.from || request.date, type: "date", style: "date" },
        { value: request.endDate || request.to || request.date, type: "date", style: "date" },
        { value: daysInMonthRange(request.startDate || request.from || request.date, request.endDate || request.to || request.date, period.payrollMonth), type: "number" },
        "Paid",
        request.status,
        request.requestId || request.holidayRequestId || request.id
      ]);
    });
  (commandData.attendanceRecords || [])
    .filter((record) => payrollStaffIds.has(directorTextValue(record.staffId)) && dateInMonth(record.date, period.payrollMonth))
    .forEach((record) => {
      const staffId = directorTextValue(record.staffId);
      absenceDetailRows.push([
        staffNameById[staffId] || record.name,
        directorTextValue(payrollReferenceByStaffId[staffId] || staffId),
        directorTextValue(record.status || record.category || record.type || "Attendance"),
        { value: record.date, type: "date", style: "date" },
        { value: record.endDate || record.to || record.date, type: "date", style: "date" },
        { value: Number(record.days || record.hours || record.value || 1), type: "number" },
        directorTextValue(record.paidStatus) || "Not recorded",
        directorTextValue(record.approvalStatus || record.status) || "Recorded",
        record.attendanceId || record.id || record.sourceReference
      ]);
    });
  const absenceRows = [
    ...titleRows("Absence Detail"),
    tableHeader(["Employee", "Staff ID or payroll ref", "Absence type", "Start date", "End date", "Days/hours", "Paid status", "Approval/status", "Source reference"]),
    ...absenceDetailRows
  ];
  const standardRowHeights = { 1: 28, 2: 24, 3: 32, 4: 22, 5: 7, 6: 22, 7: 22, 8: 22, 9: 38 };
  const compactWorkbookRowHeights = (rows, wrappedColumns = []) => {
    const heights = { ...standardRowHeights };
    rows.forEach((row, index) => {
      const rowNumber = index + 1;
      if (rowNumber <= summaryHeaderRow) return;
      const longestWrappedValue = wrappedColumns.reduce((longest, columnIndex) => {
        const cell = Array.isArray(row) ? row[columnIndex] : "";
        const value = cell && typeof cell === "object" && !Array.isArray(cell) ? cell.value : cell;
        return Math.max(longest, directorTextValue(value).length);
      }, 0);
      if (longestWrappedValue > 130) heights[rowNumber] = 66;
      else if (longestWrappedValue > 90) heights[rowNumber] = 54;
      else if (longestWrappedValue > 55) heights[rowNumber] = 40;
    });
    return heights;
  };
  return multiSheetXlsx([
    { name: "Payroll Summary", rows: summaryRows, columnWidths: [24, 18, 18, 16, 13, 18, 14, 19, 10, 16, 14, 14, 14, 38, 42], headerRow: 9, freezeRow: 9, merges: ["A1:H1", "A2:H2", "A3:H3"], rowHeights: compactWorkbookRowHeights(summaryRows, [13, 14]), printTitleRows: "$9:$9" },
    { name: "Salary Advances", rows: advanceRows, columnWidths: [20, 23, 17, 18, 12, 18, 14, 34, 17, 18, 15], headerRow: 9, freezeRow: 9, merges: ["A1:H1", "A2:H2", "A3:H3"], rowHeights: compactWorkbookRowHeights(advanceRows, [7]), printTitleRows: "$9:$9" },
    { name: "Absence Detail", rows: absenceRows, columnWidths: [23, 18, 16, 14, 14, 18, 13, 18, 24], headerRow: 9, freezeRow: 9, merges: ["A1:H1", "A2:H2", "A3:H3"], rowHeights: compactWorkbookRowHeights(absenceRows, [8]), printTitleRows: "$9:$9" }
  ]);
}

function phase10ExportPayrollPeriod(commandData, directorsData, periodId, payload, session) {
  const period = phase10FindPeriod(directorsData, periodId);
  if (!period) return { status: 404, body: { ok: false, message: "Payroll period not found." } };
  if (Number(payload.version) !== Number(period.version)) return { status: 409, body: { ok: false, message: "Payroll period has changed. Refresh before exporting." } };
  if (!["Approved", "Exported"].includes(period.status)) return { status: 400, body: { ok: false, message: "Payroll period must be approved before export." } };
  const exportedAt = new Date().toISOString();
  const exportId = payrollExportIdFor(period.periodId, period.version, exportedAt);
  const exportDir = path.join(directorsPayrollExportDir, period.payrollMonth);
  fs.mkdirSync(exportDir, { recursive: true });
  const fileName = safeFileName(`Kingswood Payroll Preparation - ${period.payrollMonth} - v${period.version}`, "payroll-preparation") + ".xlsx";
  const filePath = path.join(exportDir, fileName);
  fs.writeFileSync(filePath, phase10PayrollWorkbook(commandData, period, directorsData, exportedAt, session));
  const exportRecord = {
    exportId,
    periodId: period.periodId,
    payrollMonth: period.payrollMonth,
    version: period.version,
    fileName,
    filePath,
    exportedByUserId: session.context.userId,
    exportedAt,
    status: "Exported"
  };
  directorsData.exportHistory.push(exportRecord);
  period.status = "Exported";
  period.exportIds = [...(period.exportIds || []), exportId];
  period.updatedAt = exportedAt;
  const eligibleStaffIds = phase10PayrollEligibleStaffIds(commandData);
  directorsData.salaryAdvances
    .filter((advance) =>
      advance.payrollMonth === period.payrollMonth
      && advance.status === "Active"
      && eligibleStaffIds.has(directorTextValue(advance.staffId))
    )
    .forEach((advance) => {
      advance.includedInExport = true;
      advance.exportVersion = String(period.version);
      advance.updatedAt = exportedAt;
    });
  phase10Audit(directorsData, session, "Payroll Workbook Exported", "PayrollPeriod", periodId, null, { exportId, fileName, version: period.version });
  phase10WriteData(directorsData);
  return { status: 200, body: { ok: true, export: { ...exportRecord, filePath: undefined }, period: phase10SanitisePayrollPeriodForRead(commandData, period) } };
}

function phase073dResolveTechnicianIdForJob(job = {}, data = {}, context = {}) {
  const explicit = textValue(job.assignedTechnicianId || job.technicianId);
  if (explicit) return explicit;
  const staffId = textValue(job.assignedStaffId || job.staffId);
  if (staffId && staffId === textValue(context.staffId)) return textValue(context.technicianId);
  if (staffId && phase073dApprovedTechnicianIdsByStaffId[staffId]) return phase073dApprovedTechnicianIdsByStaffId[staffId];
  const technicianName = textValue(job.technician);
  const staff = (data.staffProfiles || []).find((profile) => textValue(profile.name) === technicianName);
  if (staff && textValue(staff.staffId) === textValue(context.staffId)) return textValue(context.technicianId);
  if (staff && phase073dApprovedTechnicianIdsByStaffId[textValue(staff.staffId)]) return phase073dApprovedTechnicianIdsByStaffId[textValue(staff.staffId)];
  return "";
}

function phase073dHubJobId(job = {}) {
  return textValue(job.jobId || job.id || job.number || job.jobNumber);
}

function phase073dNormaliseDispatchStatus(value = "") {
  const status = textValue(value).toLowerCase();
  if (status.includes("withdrawal acknowledged")) return "Withdrawal acknowledged";
  if (status.includes("withdrawal") || status.includes("withdrawn")) return "Withdrawal sent";
  if (status.includes("cancellation acknowledged")) return "Cancellation acknowledged";
  if (status.includes("cancellation")) return "Cancellation sent";
  if (status.includes("cancelled") || status.includes("cancel")) return "Cancellation sent";
  if (status.includes("change acknowledged")) return "Change acknowledged";
  if (status.includes("change") || status.includes("changed")) return "Change sent";
  if (status.includes("unable")) return "Unable";
  if (status.includes("accept")) return "Accepted";
  if (status.includes("acknowledged")) return "Accepted";
  if (status.includes("received") || status.includes("available") || status.includes("sent")) return "Sent to Technician App";
  if (status.includes("complete")) return "Completed - Report Submitted";
  return textValue(value || "Not sent");
}

function phase073dHubJobIsDelivered(job = {}) {
  const status = textValue(job.dispatchStatus || job.deliveryStatus || job.status).toLowerCase();
  return Boolean(job.sentToTech || job.publishedToTech)
    || ["sent", "received", "acknowledged", "accepted", "unable", "change", "cancel", "withdraw"].some((state) => status.includes(state));
}

function phase073dMapHubJob(job = {}, data = {}, context = {}) {
  const assignedTechnicianId = phase073dResolveTechnicianIdForJob(job, data, context);
  const dispatchStatus = phase073dNormaliseDispatchStatus(job.dispatchStatus || job.deliveryStatus || job.status || "Sent to Technician App");
  return {
    jobId: phase073dHubJobId(job),
    jobReference: textValue(job.number || job.jobReference || job.jobNumber || job.id),
    jobDate: textValue(job.date || job.jobDate),
    slot: textValue(job.slot || job.jobSlot || job.session),
    clientName: textValue(job.client || job.clientName),
    mainClient: textValue(job.mainClient || job.client),
    jobTitle: textValue(job.title || job.jobTitle || job.address || "Assigned job"),
    siteName: textValue(job.siteName || job.client),
    address: textValue(job.address),
    postcode: textValue(job.postcode),
    contactName: textValue(job.contactName || job.contact),
    contactTelephone: textValue(job.contactTelephone || job.residentPhone || job.phone),
    accessInstructions: textValue(job.accessInstructions),
    jobInstructions: textValue(job.jobInstructions || job.jobDetails),
    previousVisitNotes: textValue(job.previousVisitNotes),
    reportNotes: textValue(job.reportNotes),
    jobDescription: textValue(job.jobDescription || job.jobDetails || job.reportNotes),
    status: dispatchStatus,
    dispatchStatus,
    deliveryStatus: dispatchStatus,
    reportId: textValue(job.reportId),
    reportSubmittedAt: textValue(job.reportSubmittedAt || job.completedAt),
    completedAt: textValue(job.completedAt),
    oneDriveReportFolder: textValue(job.oneDriveReportFolder),
    dispatchVersion: Number(job.dispatchVersion || 1),
    dispatchSentAt: textValue(job.dispatchSentAt || job.sentToTechAt),
    dispatchReceivedAt: textValue(job.dispatchReceivedAt),
    dispatchAcknowledgedAt: textValue(job.dispatchAcknowledgedAt),
    dispatchAcknowledgedVersion: Number(job.dispatchAcknowledgedVersion || 0),
    dispatchResponseVersion: Number(job.dispatchResponseVersion || job.dispatchAcknowledgedVersion || 0),
    dispatchAvailableAt: textValue(job.dispatchAvailableAt || job.dispatchReceivedAt),
    dispatchAvailableVersion: Number(job.dispatchAvailableVersion || job.dispatchReceivedVersion || 0),
    dispatchRunningOrder: Number(job.dispatchRunningOrder || job.runningOrder || 0),
    technicianAcceptedAt: textValue(job.technicianAcceptedAt || job.dispatchAcknowledgedAt),
    technicianUnableAt: textValue(job.technicianUnableAt),
    technicianUnableReason: textValue(job.technicianUnableReason),
    technicianResponse: textValue(job.technicianResponse || (dispatchStatus === "Accepted" ? "Accepted" : dispatchStatus === "Unable" ? "Unable" : "")),
    sentToTech: Boolean(job.sentToTech || job.status === "Sent to Tech"),
    publishedToTech: Boolean(job.publishedToTech || job.status === "Sent to Tech"),
    changeReason: textValue(job.dispatchChangeReason || job.changeReason),
    changeSummary: Array.isArray(job.dispatchChangeSummary) ? job.dispatchChangeSummary : [],
    changeAcknowledgedAt: textValue(job.changeAcknowledgedAt),
    changeAcknowledgedVersion: Number(job.changeAcknowledgedVersion || 0),
    cancellationReason: textValue(job.dispatchCancellationReason || job.cancellationReason),
    cancellationAcknowledgedAt: textValue(job.cancellationAcknowledgedAt),
    cancellationAcknowledgedVersion: Number(job.cancellationAcknowledgedVersion || 0),
    cancelledAt: textValue(job.cancelledAt || job.dispatchCancelledAt),
    withdrawalReason: textValue(job.dispatchWithdrawalReason || job.withdrawalReason),
    withdrawalAcknowledgedAt: textValue(job.withdrawalAcknowledgedAt),
    withdrawalAcknowledgedVersion: Number(job.withdrawalAcknowledgedVersion || 0),
    replacementTechnicianName: textValue(job.replacementTechnicianName),
    assignedTechnicianId,
    ramsIds: Array.isArray(job.ramsIds) ? job.ramsIds : [],
    documentIds: Array.isArray(job.documentIds) ? job.documentIds : []
  };
}

function phase073eWithdrawalJobsForSession(data = {}, context = {}) {
  const technicianId = textValue(context?.technicianId);
  if (!technicianId) return [];
  const withdrawalJobs = [];
  (data.jobs || []).forEach((job) => {
    if (!phase073dHubJobIsDelivered(job)) return;
    const withdrawals = Array.isArray(job.dispatchWithdrawals) ? job.dispatchWithdrawals : [];
    withdrawals
      .filter((withdrawal) => textValue(withdrawal.fromTechnicianId) === technicianId)
      .forEach((withdrawal) => {
        const base = phase073dMapHubJob(job, data, context);
        const version = Number(withdrawal.version || job.dispatchVersion || 1);
        const acknowledgedAt = textValue(withdrawal.acknowledgedAt);
        withdrawalJobs.push({
          ...base,
          assignedTechnicianId: technicianId,
          status: acknowledgedAt ? "Withdrawal acknowledged" : "Withdrawal sent",
          dispatchStatus: acknowledgedAt ? "Withdrawal acknowledged" : "Withdrawal sent",
          deliveryStatus: acknowledgedAt ? "Withdrawal acknowledged" : "Withdrawal sent",
          dispatchVersion: version,
          dispatchSentAt: textValue(withdrawal.sentAt || job.dispatchSentAt),
          dispatchRunningOrder: Number(withdrawal.previousRunningOrder || 0),
          technicianAcceptedAt: "",
          technicianUnableAt: "",
          technicianUnableReason: "",
          technicianResponse: "",
          dispatchResponseVersion: 0,
          dispatchAcknowledgedAt: "",
          dispatchAcknowledgedVersion: 0,
          withdrawalReason: textValue(withdrawal.reason),
          withdrawalAcknowledgedAt: acknowledgedAt,
          withdrawalAcknowledgedVersion: Number(withdrawal.acknowledgedVersion || 0),
          replacementTechnicianName: textValue(withdrawal.toTechnicianName)
        });
      });
  });
  return withdrawalJobs;
}

function phase073dBuildSourceRecordsForSession(session) {
  const data = readCommandCentreData();
  const assignedVehicle = findActiveVehicleAssignment(data.vehicles || [], session.context?.technicianId, session.context?.staffId);
  const hubJobs = (data.jobs || [])
    .filter(phase073dHubJobIsDelivered)
    .map((job) => phase073dMapHubJob(job, data, session.context))
    .filter((job) => job.jobId && job.assignedTechnicianId)
    .sort((a, b) => {
      const aOrder = Number(a.dispatchRunningOrder || 9999);
      const bOrder = Number(b.dispatchRunningOrder || 9999);
      return String(a.jobDate || "").localeCompare(String(b.jobDate || ""))
        || aOrder - bOrder
        || String(a.slot || "").localeCompare(String(b.slot || ""))
        || String(a.jobReference || a.jobId).localeCompare(String(b.jobReference || b.jobId));
    });
  const scheduleDelivery = {};
  (data.jobDispatchSchedules || [])
    .filter((schedule) => textValue(schedule.technicianId) === textValue(session.context?.technicianId))
    .forEach((schedule) => {
      const date = textValue(schedule.date || schedule.workDate);
      if (!date) return;
      scheduleDelivery[date] = {
        scheduleId: textValue(schedule.scheduleId),
        technicianId: textValue(schedule.technicianId),
        date,
        status: phase073dNormaliseDispatchStatus(schedule.status || "Sent to Technician App"),
        sent: true,
        sentAt: textValue(schedule.sentAt),
        sentBy: textValue(schedule.sentBy),
        scheduleVersion: Number(schedule.scheduleVersion || 1),
        jobCount: Number(schedule.jobCount || (Array.isArray(schedule.jobIds) ? schedule.jobIds.length : 0)),
        jobIds: Array.isArray(schedule.jobIds) ? schedule.jobIds : []
      };
    });
  return {
    ...phase05bSourceRecords,
    technician: phase05bTechnicianRecordForContext(session.context),
    vehicle: assignedVehicle ? {
      ...assignedVehicle,
      status: textValue(assignedVehicle.status || assignedVehicle.tracker || "Active"),
      assignedTechnicianId: textValue(assignedVehicle.assignedTechnicianId),
      assignedStaffId: textValue(assignedVehicle.assignedStaffId)
    } : null,
    jobs: [
      ...(phase05bSourceRecords.jobs || []),
      ...hubJobs,
      ...phase073eWithdrawalJobsForSession(data, session.context)
    ],
    scheduleDelivery,
    holidays: {
      ...(phase05bSourceRecords.holidays || {}),
      staffId: textValue(session.context?.staffId)
    }
  };
}

function phase073dAddAuditEvent(data, action, entityId, performedByUserId, performedByRole, newValue = {}) {
  const now = new Date().toISOString();
  const auditEventId = `AUD-${String(action || "JOB").replace(/[^A-Z0-9]/gi, "-").toUpperCase()}-${entityId}-${newValue.dispatchVersion || "0"}`;
  data.universalAuditEvents = Array.isArray(data.universalAuditEvents) ? data.universalAuditEvents : [];
  if (data.universalAuditEvents.some((event) => event.auditEventId === auditEventId)) return false;
  data.universalAuditEvents.push({
    auditEventId,
    entityType: "Job",
    entityId,
    action,
    performedByUserId,
    performedByRole,
    performedAt: now,
    sourceApp: performedByRole === "Technician" ? "Technician App" : "Kingswood Hub",
    newValue
  });
  return true;
}

function phase09aAddVehicleAuditEvent(data, action, entityId, officeContext = {}, previousValue = {}, newValue = {}) {
  const now = new Date().toISOString();
  data.universalAuditEvents = Array.isArray(data.universalAuditEvents) ? data.universalAuditEvents : [];
  data.universalAuditEvents.push({
    auditEventId: `AUD-VEHICLE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    entityType: "Vehicle",
    entityId,
    action,
    performedByUserId: textValue(officeContext.userId || officeContext.name || "Kingswood Office"),
    performedByRole: textValue(officeContext.role || "Office"),
    performedAt: now,
    sourceApp: textValue(officeContext.sourceApp || "Kingswood Hub"),
    oldValue: previousValue,
    newValue
  });
}

function phase09aAssignVehicle(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to manage vehicle assignments." } };
  data.vehicles = normaliseVehicleCollection(data.vehicles || []);
  const vehicleId = textValue(payload.vehicleId);
  const previous = data.vehicles.find((vehicle) => textValue(vehicle.vehicleId) === vehicleId);
  const result = applyVehicleAssignment(data, payload, officeContext);
  if (!result.ok) return { status: result.status || 400, body: { ok: false, message: result.message || "Vehicle assignment could not be saved." } };
  phase09aAddVehicleAuditEvent(data, result.action, vehicleId, officeContext, previous || {}, result.vehicle || {});
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, vehicle: result.vehicle, action: result.action } };
}

function phase09StaffComplianceAddAuditEvent(data, action, entityType, entityId, officeContext = {}, previousValue = {}, newValue = {}) {
  const now = new Date().toISOString();
  data.universalAuditEvents = Array.isArray(data.universalAuditEvents) ? data.universalAuditEvents : [];
  data.universalAuditEvents.push({
    auditEventId: `AUD-STAFF-COMPLIANCE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    entityType,
    entityId,
    action,
    performedByUserId: textValue(officeContext.userId || officeContext.name || "Kingswood Office"),
    performedByRole: textValue(officeContext.role || "Office"),
    performedAt: now,
    sourceApp: "Kingswood Hub",
    oldValue: previousValue,
    newValue
  });
}

function phase09StaffComplianceFindTraining(data, trainingRecordId) {
  const id = textValue(trainingRecordId);
  return (data.trainingMatrix || []).find((record) => textValue(record.trainingRecordId || record.id) === id);
}

function phase09StaffComplianceListStaff(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to view staff compliance records." } };
  const rollup = buildStaffComplianceRollup(data, textValue(payload.staffId), { today: new Date().toISOString().slice(0, 10) });
  if (!rollup) return { status: 404, body: { ok: false, message: "Staff record was not found." } };
  return { status: 200, body: { ok: true, rollup } };
}

function phase09StaffComplianceSaveTraining(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to manage training records." } };
  data.staffProfiles = Array.isArray(data.staffProfiles) ? data.staffProfiles : [];
  data.trainingMatrix = Array.isArray(data.trainingMatrix) ? data.trainingMatrix : [];
  const now = new Date().toISOString();
  const incoming = normaliseTrainingRecord(payload.record || {}, data.staffProfiles, { now, today: now.slice(0, 10) });
  const staff = data.staffProfiles.find((profile) => textValue(profile.staffId) === incoming.staffId);
  if (!staff) return { status: 400, body: { ok: false, message: "Choose a valid staff record before saving training." } };
  if (!incoming.course || !incoming.completedDate) return { status: 400, body: { ok: false, message: "Training name and completed date are required." } };
  if (!incoming.noExpiry && !incoming.expiryDate && !["Not Applicable", "Missing / Not Recorded"].includes(incoming.lifecycleStatus)) {
    return { status: 400, body: { ok: false, message: "Enter an expiry date, choose No expiry or mark the record Not Applicable." } };
  }
  incoming.trainingRecordId = incoming.trainingRecordId || trainingRecordIdFor(incoming);
  incoming.id = incoming.id || incoming.trainingRecordId;
  incoming.employee = staff.name;
  incoming.updatedAt = now;
  incoming.createdAt = incoming.createdAt || now;
  const status = normaliseTrainingRecordStatus(incoming, now.slice(0, 10));
  incoming.status = status.label;
  incoming.statusCategory = status.className;
  const index = data.trainingMatrix.findIndex((record) => textValue(record.trainingRecordId || record.id) === incoming.trainingRecordId);
  const previous = index >= 0 ? { ...data.trainingMatrix[index] } : {};
  if (index >= 0) data.trainingMatrix[index] = { ...data.trainingMatrix[index], ...incoming };
  else data.trainingMatrix.push(incoming);
  syncTrainingActionItems(data, incoming, { now, today: now.slice(0, 10) });
  phase09StaffComplianceAddAuditEvent(data, index >= 0 ? "Training Record Updated" : "Training Record Added", "TrainingRecord", incoming.trainingRecordId, officeContext, previous, incoming);
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, record: incoming } };
}

function phase09StaffComplianceReplaceTrainingEvidence(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to replace training evidence." } };
  const record = phase09StaffComplianceFindTraining(data, payload.trainingRecordId);
  if (!record) return { status: 404, body: { ok: false, message: "Training record was not found." } };
  const previous = { ...record };
  const now = new Date().toISOString();
  record.evidenceHistory = Array.isArray(record.evidenceHistory) ? record.evidenceHistory : [];
  if (record.documentFileName || record.oneDriveLocation) {
    record.evidenceHistory.push({
      documentFileName: record.documentFileName || "",
      oneDriveLocation: record.oneDriveLocation || "",
      replacedAt: now,
      replacedBy: officeContext.name
    });
  }
  record.documentFileName = textValue(payload.documentFileName || payload.fileName || record.documentFileName);
  record.certificate = record.documentFileName;
  record.oneDriveLocation = textValue(payload.oneDriveLocation || payload.storageLocation || record.oneDriveLocation);
  record.updatedAt = now;
  phase09StaffComplianceAddAuditEvent(data, "Training Evidence Replaced", "TrainingRecord", textValue(record.trainingRecordId || record.id), officeContext, previous, record);
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, record } };
}

function phase09StaffComplianceLifecycle(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to update training lifecycle." } };
  const record = phase09StaffComplianceFindTraining(data, payload.trainingRecordId);
  if (!record) return { status: 404, body: { ok: false, message: "Training record was not found." } };
  const nextStatus = textValue(payload.lifecycleStatus || payload.status);
  if (!["Superseded", "Inactive", "Not Applicable"].includes(nextStatus)) {
    return { status: 400, body: { ok: false, message: "Choose Superseded, Inactive or Not Applicable." } };
  }
  const previous = { ...record };
  const now = new Date().toISOString();
  record.lifecycleStatus = nextStatus;
  record.status = nextStatus;
  record.statusCategory = "muted";
  record.lifecycleReason = textValue(payload.reason || record.lifecycleReason);
  record.updatedAt = now;
  record.history = Array.isArray(record.history) ? record.history : [];
  record.history.push({ action: `Marked ${nextStatus}`, by: officeContext.name, at: now, reason: record.lifecycleReason });
  syncTrainingActionItems(data, record, { now, today: now.slice(0, 10) });
  phase09StaffComplianceAddAuditEvent(data, `Training Record Marked ${nextStatus}`, "TrainingRecord", textValue(record.trainingRecordId || record.id), officeContext, previous, record);
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, record } };
}

function phase09bInspectionRecords(data = {}) {
  data.vehicleInspectionRecords = Array.isArray(data.vehicleInspectionRecords) ? data.vehicleInspectionRecords : [];
  return data.vehicleInspectionRecords;
}

function phase09bInspectionState(session) {
  const data = readCommandCentreData();
  const assignedVehicle = findActiveVehicleAssignment(data.vehicles || [], session.context?.technicianId, session.context?.staffId);
  const state = vehicleWeeklyCheckState({
    assignedVehicle,
    records: phase09bInspectionRecords(data)
  });
  return {
    ok: true,
    assignedVehicle: assignedVehicle ? {
      vehicleId: assignedVehicle.vehicleId,
      registration: assignedVehicle.registration,
      vehicle: assignedVehicle.vehicle,
      status: assignedVehicle.status || "Active"
    } : null,
    checklist: VEHICLE_CHECKLIST_ITEMS,
    state
  };
}

function phase09bDefectActionId(inspectionId, itemId) {
  return `ACT-VEHICLE-DEFECT-${crypto.createHash("sha1").update(`${inspectionId}|${itemId}`).digest("hex").slice(0, 12).toUpperCase()}`;
}

function phase09bSubmitInspection(session, payload = {}) {
  const data = readCommandCentreData();
  data.vehicles = normaliseVehicleCollection(data.vehicles || []);
  const assignedVehicle = findActiveVehicleAssignment(data.vehicles || [], session.context?.technicianId, session.context?.staffId);
  if (!assignedVehicle) return { status: 400, body: { ok: false, message: "No vehicle is assigned to this technician." } };

  const records = phase09bInspectionRecords(data);
  const requirement = vehicleWeeklyCheckState({ assignedVehicle, records });
  const weekStart = requirement.inspectionWeekStart;
  if (!requirement.required) {
    return { status: 409, body: { ok: false, message: "This week's vehicle check has already been submitted.", inspectionId: requirement.submitted?.inspectionId || "" } };
  }
  const duplicate = records.find((record) =>
    textValue(record.vehicleId) === textValue(assignedVehicle.vehicleId)
    && textValue(record.inspectionWeekStart) === textValue(weekStart)
  );
  if (duplicate) {
    return { status: 409, body: { ok: false, message: "This week's vehicle check has already been submitted.", inspectionId: duplicate.inspectionId } };
  }

  const errors = vehicleInspectionValidationErrors(payload);
  if (errors.length) return { status: 400, body: { ok: false, message: "Vehicle check is incomplete.", errors } };

  const answers = normaliseChecklistAnswers(payload.answers);
  const defects = defectAnswers(answers);
  const safetyCritical = defects.some((defect) => defect.safetyCritical);
  const inspectionId = inspectionIdFor(assignedVehicle.vehicleId, weekStart, session.context.technicianId);
  const now = new Date().toISOString();
  const inspection = {
    inspectionId,
    vehicleId: assignedVehicle.vehicleId,
    registration: assignedVehicle.registration,
    vehicle: assignedVehicle.vehicle || "",
    staffId: session.context.staffId,
    technicianId: session.context.technicianId,
    technicianName: session.context.fullName,
    inspectionWeekStart: weekStart,
    inspectionDateTime: now,
    submittedAt: now,
    currentMileage: Number(payload.currentMileage),
    status: defects.length ? "Defects Reported" : "Submitted",
    safetyCritical,
    vehicleSnapshot: {
      vehicleId: assignedVehicle.vehicleId,
      registration: assignedVehicle.registration,
      vehicle: assignedVehicle.vehicle || "",
      status: assignedVehicle.status || "Active",
      assignedStaffId: assignedVehicle.assignedStaffId,
      assignedTechnicianId: assignedVehicle.assignedTechnicianId,
      assignmentUpdatedAt: assignedVehicle.assignmentUpdatedAt || ""
    },
    checklist: answers,
    defects: defects.map((defect) => ({
      defectId: phase09bDefectActionId(inspectionId, defect.itemId),
      itemId: defect.itemId,
      label: defect.label,
      explanation: defect.explanation,
      photoName: defect.photoName,
      photoAttached: defect.photoAttached,
      safetyCritical: defect.safetyCritical,
      status: "Open"
    })),
    readOnlyForTechnician: true
  };

  records.push(inspection);
  data.actionItems = Array.isArray(data.actionItems) ? data.actionItems : [];
  inspection.defects.forEach((defect) => {
    data.actionItems.push({
      actionId: defect.defectId,
      type: "Vehicle Defect",
      priority: defect.safetyCritical ? "High" : "Medium",
      title: `${assignedVehicle.registration} - ${defect.label}`,
      description: defect.explanation,
      status: "New",
      raisedAt: now,
      raisedByUserId: session.context.userId,
      assignedToUserId: "",
      vehicleId: assignedVehicle.vehicleId,
      inspectionId,
      staffId: session.context.staffId,
      technicianId: session.context.technicianId,
      auditTrail: []
    });
  });
  phase09aAddVehicleAuditEvent(data, "Vehicle Inspection Submitted", inspectionId, {
    userId: session.context.userId,
    role: "Technician",
    sourceApp: "Technician App"
  }, {}, {
    vehicleId: assignedVehicle.vehicleId,
    inspectionWeekStart: weekStart,
    defectCount: defects.length,
    safetyCritical
  });
  inspection.defects.forEach((defect) => {
    phase09aAddVehicleAuditEvent(data, "Vehicle Defect Reported", defect.defectId, {
      userId: session.context.userId,
      role: "Technician",
      sourceApp: "Technician App"
    }, {}, {
      inspectionId,
      vehicleId: assignedVehicle.vehicleId,
      itemId: defect.itemId,
      safetyCritical: defect.safetyCritical
    });
  });
  phase06a2WriteCommandCentreData(data);
  return {
    status: 200,
    body: {
      ok: true,
      inspectionId,
      status: inspection.status,
      safetyCritical,
      message: safetyCritical
        ? "Vehicle check submitted. Safety-critical defect reported: do not continue using the vehicle. Contact Kingswood Office immediately."
        : "Vehicle check submitted."
    }
  };
}

const phase09cInspectionReviewStatuses = Object.freeze(["Awaiting Review", "Action Required", "In Progress", "Resolved", "No Action Required", "Reviewed"]);
const phase09cDefectReviewStatuses = Object.freeze(["Awaiting Review", "Action Required", "In Progress", "Resolved", "No Action Required"]);

function phase09cNormaliseStatus(value, allowed, fallback = "Awaiting Review") {
  const supplied = textValue(value);
  return allowed.find((status) => status.toLowerCase() === supplied.toLowerCase()) || fallback;
}

function phase09cInspectionDefects(inspection = {}) {
  return Array.isArray(inspection.defects) ? inspection.defects : [];
}

function phase09cInspectionReviewStatus(inspection = {}) {
  return textValue(inspection.officeReviewStatus || inspection.reviewStatus || "Awaiting Review");
}

function phase09cActionStatusForDefectStatus(status) {
  return {
    "Awaiting Review": "New",
    "Action Required": "Action Required",
    "In Progress": "In Progress",
    "Resolved": "Completed",
    "No Action Required": "Closed"
  }[status] || "New";
}

function phase09cBuildInspectionSummary(data, inspection = {}) {
  const defects = phase09cInspectionDefects(inspection);
  const vehicle = (data.vehicles || []).find((item) => textValue(item.vehicleId) === textValue(inspection.vehicleId));
  return {
    inspectionId: textValue(inspection.inspectionId),
    vehicleId: textValue(inspection.vehicleId),
    registration: textValue(inspection.registration || inspection.vehicleSnapshot?.registration || vehicle?.registration),
    vehicle: textValue(inspection.vehicle || inspection.vehicleSnapshot?.vehicle || vehicle?.vehicle),
    technicianId: textValue(inspection.technicianId),
    staffId: textValue(inspection.staffId),
    technicianName: textValue(inspection.technicianName),
    inspectionWeekStart: textValue(inspection.inspectionWeekStart),
    submittedAt: textValue(inspection.submittedAt || inspection.inspectionDateTime),
    status: textValue(inspection.status),
    officeReviewStatus: phase09cInspectionReviewStatus(inspection),
    safetyCritical: Boolean(inspection.safetyCritical),
    defectCount: defects.length,
    openDefectCount: defects.filter((defect) => !["Resolved", "No Action Required"].includes(textValue(defect.reviewStatus || defect.status))).length
  };
}

function phase09cBuildInspectionDetail(data, inspection = {}) {
  const summary = phase09cBuildInspectionSummary(data, inspection);
  const defects = phase09cInspectionDefects(inspection).map((defect) => ({
    ...defect,
    reviewStatus: textValue(defect.reviewStatus || defect.status || "Awaiting Review"),
    linkedAction: (data.actionItems || []).find((item) => textValue(item.actionId) === textValue(defect.defectId)) || null
  }));
  const audit = (data.universalAuditEvents || [])
    .filter((event) => textValue(event.entityId) === textValue(inspection.inspectionId) || defects.some((defect) => textValue(defect.defectId) === textValue(event.entityId)))
    .sort((a, b) => textValue(a.performedAt).localeCompare(textValue(b.performedAt)));
  return {
    ...summary,
    currentMileage: inspection.currentMileage ?? null,
    vehicleSnapshot: inspection.vehicleSnapshot || null,
    checklist: Array.isArray(inspection.checklist) ? inspection.checklist : [],
    defects,
    officeReviewNote: textValue(inspection.officeReviewNote),
    reviewedByUserId: textValue(inspection.reviewedByUserId),
    reviewedByName: textValue(inspection.reviewedByName),
    reviewedAt: textValue(inspection.reviewedAt),
    audit
  };
}

function phase09cListVehicleInspections(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to review vehicle inspections." } };
  const summaries = phase09bInspectionRecords(data)
    .map((inspection) => phase09cBuildInspectionSummary(data, inspection))
    .sort((a, b) => {
      const priorityA = a.safetyCritical ? 0 : a.officeReviewStatus === "Awaiting Review" ? 1 : a.defectCount ? 2 : 3;
      const priorityB = b.safetyCritical ? 0 : b.officeReviewStatus === "Awaiting Review" ? 1 : b.defectCount ? 2 : 3;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return textValue(b.submittedAt).localeCompare(textValue(a.submittedAt));
    });
  return { status: 200, body: { ok: true, inspections: summaries } };
}

function phase09cGetVehicleInspection(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to review vehicle inspections." } };
  const inspectionId = textValue(payload.inspectionId);
  const inspection = phase09bInspectionRecords(data).find((record) => textValue(record.inspectionId) === inspectionId);
  if (!inspection) return { status: 404, body: { ok: false, message: "Vehicle inspection was not found." } };
  return { status: 200, body: { ok: true, inspection: phase09cBuildInspectionDetail(data, inspection) } };
}

function phase09cReviewVehicleInspection(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to review vehicle inspections." } };
  const inspectionId = textValue(payload.inspectionId);
  const inspection = phase09bInspectionRecords(data).find((record) => textValue(record.inspectionId) === inspectionId);
  if (!inspection) return { status: 404, body: { ok: false, message: "Vehicle inspection was not found." } };

  const now = new Date().toISOString();
  const previous = {
    officeReviewStatus: phase09cInspectionReviewStatus(inspection),
    officeReviewNote: textValue(inspection.officeReviewNote),
    reviewedAt: textValue(inspection.reviewedAt),
    reviewedByUserId: textValue(inspection.reviewedByUserId)
  };
  const status = phase09cNormaliseStatus(payload.officeReviewStatus, phase09cInspectionReviewStatuses, previous.officeReviewStatus || "Awaiting Review");
  inspection.officeReviewStatus = status;
  inspection.officeReviewNote = textValue(payload.officeReviewNote);
  inspection.reviewedByUserId = officeContext.userId;
  inspection.reviewedByName = officeContext.name;
  inspection.reviewedAt = now;
  inspection.reviewUpdatedAt = now;
  inspection.reviewHistory = Array.isArray(inspection.reviewHistory) ? inspection.reviewHistory : [];
  inspection.reviewHistory.push({
    at: now,
    by: officeContext.userId,
    name: officeContext.name,
    status,
    note: inspection.officeReviewNote
  });

  phase09aAddVehicleAuditEvent(data, "Vehicle Inspection Review Updated", inspectionId, officeContext, previous, {
    officeReviewStatus: status,
    officeReviewNote: inspection.officeReviewNote,
    reviewedAt: now,
    reviewedByUserId: officeContext.userId
  });
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, inspection: phase09cBuildInspectionDetail(data, inspection) } };
}

function phase09cReviewVehicleDefect(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to review vehicle defects." } };
  const inspectionId = textValue(payload.inspectionId);
  const defectId = textValue(payload.defectId);
  const inspection = phase09bInspectionRecords(data).find((record) => textValue(record.inspectionId) === inspectionId);
  if (!inspection) return { status: 404, body: { ok: false, message: "Vehicle inspection was not found." } };
  const defect = phase09cInspectionDefects(inspection).find((item) => textValue(item.defectId) === defectId);
  if (!defect) return { status: 404, body: { ok: false, message: "Vehicle defect was not found." } };

  const now = new Date().toISOString();
  const previous = {
    reviewStatus: textValue(defect.reviewStatus || defect.status || "Awaiting Review"),
    responsiblePerson: textValue(defect.responsiblePerson),
    targetDate: textValue(defect.targetDate),
    resolutionNote: textValue(defect.resolutionNote || defect.officeAssessment)
  };
  const reviewStatus = phase09cNormaliseStatus(payload.status || payload.reviewStatus, phase09cDefectReviewStatuses, previous.reviewStatus);
  defect.reviewStatus = reviewStatus;
  defect.status = reviewStatus;
  defect.responsiblePerson = textValue(payload.responsiblePerson);
  defect.targetDate = textValue(payload.targetDate);
  defect.resolutionNote = textValue(payload.resolutionNote);
  defect.officeAssessment = defect.resolutionNote;
  defect.reviewedByUserId = officeContext.userId;
  defect.reviewedByName = officeContext.name;
  defect.reviewedAt = now;
  defect.updatedAt = now;
  if (["Resolved", "No Action Required"].includes(reviewStatus)) {
    defect.resolvedAt = now;
    defect.resolvedByUserId = officeContext.userId;
  }
  defect.reviewHistory = Array.isArray(defect.reviewHistory) ? defect.reviewHistory : [];
  defect.reviewHistory.push({
    at: now,
    by: officeContext.userId,
    name: officeContext.name,
    status: reviewStatus,
    note: defect.resolutionNote
  });

  data.actionItems = Array.isArray(data.actionItems) ? data.actionItems : [];
  const action = data.actionItems.find((item) => textValue(item.actionId) === defectId);
  if (action) {
    action.status = phase09cActionStatusForDefectStatus(reviewStatus);
    action.assignedToUserId = defect.responsiblePerson || action.assignedToUserId || "";
    action.dueDate = defect.targetDate || action.dueDate || "";
    if (["Resolved", "No Action Required"].includes(reviewStatus)) action.completedAt = action.completedAt || now;
    action.auditTrail = Array.isArray(action.auditTrail) ? action.auditTrail : [];
    action.auditTrail.push({
      action: "Vehicle defect review updated",
      by: officeContext.userId,
      at: now,
      status: reviewStatus,
      note: defect.resolutionNote
    });
  }

  phase09aAddVehicleAuditEvent(data, "Vehicle Defect Review Updated", defectId, officeContext, previous, {
    inspectionId,
    vehicleId: inspection.vehicleId,
    reviewStatus,
    responsiblePerson: defect.responsiblePerson,
    targetDate: defect.targetDate,
    resolutionNote: defect.resolutionNote
  });
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, defect, inspection: phase09cBuildInspectionDetail(data, inspection) } };
}

function phase09dVehicleDetail(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to view vehicle records." } };
  const vehicle = phase09dFindVehicle(data, payload.vehicleId);
  if (!vehicle) return { status: 404, body: { ok: false, message: "Vehicle was not found." } };
  const documents = Array.isArray(vehicle.vehicleDocuments) ? vehicle.vehicleDocuments : [];
  const maintenance = Array.isArray(vehicle.maintenanceRecords) ? vehicle.maintenanceRecords : [];
  const inspections = phase09bInspectionRecords(data).filter((record) => textValue(record.vehicleId) === textValue(vehicle.vehicleId));
  const defectIds = inspections.flatMap((record) => phase09cInspectionDefects(record).map((defect) => textValue(defect.defectId)));
  const audit = (data.universalAuditEvents || []).filter((event) =>
    textValue(event.entityId) === textValue(vehicle.vehicleId)
    || documents.some((document) => textValue(document.documentId) === textValue(event.entityId))
    || maintenance.some((record) => textValue(record.maintenanceId) === textValue(event.entityId))
    || inspections.some((record) => textValue(record.inspectionId) === textValue(event.entityId))
    || defectIds.includes(textValue(event.entityId))
  );
  return {
    status: 200,
    body: {
      ok: true,
      vehicle: {
        ...vehicle,
        vehicleDocuments: documents.map((document) => ({ ...document, calculatedStatus: vehicleDocumentStatus(document) })),
        maintenanceRecords: maintenance,
        inspectionHistory: inspections,
        audit
      }
    }
  };
}

function phase09dAddVehicleDocument(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to manage vehicle documents." } };
  const errors = validateVehicleDocumentPayload(payload);
  if (errors.length) return { status: 400, body: { ok: false, message: errors.join(" "), errors } };
  const vehicle = phase09dFindVehicle(data, payload.vehicleId);
  if (!vehicle) return { status: 404, body: { ok: false, message: "Vehicle was not found." } };
  vehicle.vehicleDocuments = Array.isArray(vehicle.vehicleDocuments) ? vehicle.vehicleDocuments : [];
  const now = new Date().toISOString();
  const folders = vehicleRecordFolders(vehicle);
  const documentType = normaliseVehicleDocumentType(payload.documentType);
  const documentRecord = {
    documentId: vehicleDocumentIdFor(vehicle.vehicleId, payload),
    vehicleId: vehicle.vehicleId,
    documentType,
    title: textValue(payload.title),
    issueDate: textValue(payload.issueDate),
    expiryDate: textValue(payload.noExpiry ? "" : payload.expiryDate),
    noExpiry: Boolean(payload.noExpiry),
    reference: textValue(payload.reference),
    notes: textValue(payload.notes),
    owner: textValue(payload.owner || officeContext.name),
    reminderDays: Number(payload.reminderDays || VEHICLE_DOCUMENT_DEFAULT_REMINDER_DAYS),
    status: textValue(payload.status || "Current"),
    version: 1,
    createdAt: now,
    createdBy: officeContext.userId,
    updatedAt: now,
    updatedBy: officeContext.userId,
    history: []
  };
  if (vehicle.vehicleDocuments.some((document) => textValue(document.documentId) === documentRecord.documentId)) {
    return { status: 409, body: { ok: false, message: "This vehicle document already exists." } };
  }
  try {
    const savedFile = saveVehicleEvidenceFile(folders.documentsFolder, payload.document, `${vehicle.registration} - ${documentType}`);
    if (savedFile) Object.assign(documentRecord, savedFile);
  } catch (error) {
    return { status: 400, body: { ok: false, message: error.message || "Vehicle document upload failed." } };
  }
  documentRecord.status = vehicleDocumentStatus(documentRecord).label;
  documentRecord.history.push({ action: "Document added", by: officeContext.userId, at: now, version: 1, storageLocation: documentRecord.storageLocation || "" });
  vehicle.vehicleDocuments.push(documentRecord);
  vehicle.updatedAt = now;
  phase09dSyncExpiryAction(data, vehicle, documentRecord);
  phase09aAddVehicleAuditEvent(data, "Vehicle Document Added", documentRecord.documentId, officeContext, {}, documentRecord);
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, document: documentRecord, vehicleId: vehicle.vehicleId } };
}

function phase09dUpdateVehicleDocument(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to manage vehicle documents." } };
  const vehicle = phase09dFindVehicle(data, payload.vehicleId);
  if (!vehicle) return { status: 404, body: { ok: false, message: "Vehicle was not found." } };
  vehicle.vehicleDocuments = Array.isArray(vehicle.vehicleDocuments) ? vehicle.vehicleDocuments : [];
  const documentRecord = vehicle.vehicleDocuments.find((document) => textValue(document.documentId) === textValue(payload.documentId));
  if (!documentRecord) return { status: 404, body: { ok: false, message: "Vehicle document was not found." } };
  const previous = { ...documentRecord };
  const now = new Date().toISOString();
  if (payload.action === "supersede") {
    documentRecord.status = "Superseded";
    documentRecord.supersededAt = now;
    documentRecord.supersededBy = officeContext.userId;
  } else {
    const nextType = normaliseVehicleDocumentType(payload.documentType || documentRecord.documentType);
    if (!nextType) return { status: 400, body: { ok: false, message: "A valid document type is required." } };
    documentRecord.documentType = nextType;
    documentRecord.title = textValue(payload.title || documentRecord.title);
    documentRecord.issueDate = textValue(payload.issueDate ?? documentRecord.issueDate);
    documentRecord.expiryDate = textValue(payload.noExpiry ? "" : payload.expiryDate ?? documentRecord.expiryDate);
    documentRecord.noExpiry = Boolean(payload.noExpiry ?? documentRecord.noExpiry);
    documentRecord.reference = textValue(payload.reference ?? documentRecord.reference);
    documentRecord.notes = textValue(payload.notes ?? documentRecord.notes);
    documentRecord.owner = textValue(payload.owner || documentRecord.owner || officeContext.name);
    documentRecord.reminderDays = Number(payload.reminderDays || documentRecord.reminderDays || VEHICLE_DOCUMENT_DEFAULT_REMINDER_DAYS);
    documentRecord.status = ["Superseded", "Inactive"].includes(previous.status)
      ? previous.status
      : vehicleDocumentStatus(documentRecord).label;
  }
  documentRecord.updatedAt = now;
  documentRecord.updatedBy = officeContext.userId;
  documentRecord.history = Array.isArray(documentRecord.history) ? documentRecord.history : [];
  documentRecord.history.push({ action: payload.action === "supersede" ? "Document superseded" : "Metadata changed", by: officeContext.userId, at: now, version: documentRecord.version || 1 });
  vehicle.updatedAt = now;
  phase09dSyncExpiryAction(data, vehicle, documentRecord);
  phase09aAddVehicleAuditEvent(data, payload.action === "supersede" ? "Vehicle Document Superseded" : "Vehicle Document Metadata Changed", documentRecord.documentId, officeContext, previous, documentRecord);
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, document: documentRecord, vehicleId: vehicle.vehicleId } };
}

function phase09dReplaceVehicleDocument(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to replace vehicle documents." } };
  const vehicle = phase09dFindVehicle(data, payload.vehicleId);
  if (!vehicle) return { status: 404, body: { ok: false, message: "Vehicle was not found." } };
  vehicle.vehicleDocuments = Array.isArray(vehicle.vehicleDocuments) ? vehicle.vehicleDocuments : [];
  const documentRecord = vehicle.vehicleDocuments.find((document) => textValue(document.documentId) === textValue(payload.documentId));
  if (!documentRecord) return { status: 404, body: { ok: false, message: "Vehicle document was not found." } };
  if (!payload.document?.dataUrl) return { status: 400, body: { ok: false, message: "Replacement file is required." } };
  const previous = { ...documentRecord };
  const now = new Date().toISOString();
  const folders = vehicleRecordFolders(vehicle);
  let savedFile;
  try {
    savedFile = saveVehicleEvidenceFile(folders.documentsFolder, payload.document, `${vehicle.registration} - ${documentRecord.documentType}`);
  } catch (error) {
    return { status: 400, body: { ok: false, message: error.message || "Replacement upload failed." } };
  }
  documentRecord.previousVersions = Array.isArray(documentRecord.previousVersions) ? documentRecord.previousVersions : [];
  documentRecord.previousVersions.push({
    version: documentRecord.version || 1,
    fileName: documentRecord.fileName || "",
    originalFileName: documentRecord.originalFileName || "",
    storageLocation: documentRecord.storageLocation || "",
    replacedAt: now,
    replacedBy: officeContext.userId
  });
  Object.assign(documentRecord, savedFile);
  documentRecord.version = Number(documentRecord.version || 1) + 1;
  documentRecord.status = vehicleDocumentStatus(documentRecord).label;
  documentRecord.updatedAt = now;
  documentRecord.updatedBy = officeContext.userId;
  documentRecord.history = Array.isArray(documentRecord.history) ? documentRecord.history : [];
  documentRecord.history.push({ action: "Document replaced", by: officeContext.userId, at: now, version: documentRecord.version, storageLocation: documentRecord.storageLocation || "" });
  vehicle.updatedAt = now;
  phase09dSyncExpiryAction(data, vehicle, documentRecord);
  phase09aAddVehicleAuditEvent(data, "Vehicle Document Replaced", documentRecord.documentId, officeContext, previous, documentRecord);
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, document: documentRecord, vehicleId: vehicle.vehicleId } };
}

function phase09dAddMaintenanceRecord(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to manage vehicle maintenance." } };
  const errors = validateVehicleMaintenancePayload(payload);
  if (errors.length) return { status: 400, body: { ok: false, message: errors.join(" "), errors } };
  const vehicle = phase09dFindVehicle(data, payload.vehicleId);
  if (!vehicle) return { status: 404, body: { ok: false, message: "Vehicle was not found." } };
  vehicle.maintenanceRecords = Array.isArray(vehicle.maintenanceRecords) ? vehicle.maintenanceRecords : [];
  const now = new Date().toISOString();
  const eventType = normaliseMaintenanceEventType(payload.eventType);
  const record = {
    maintenanceId: vehicleMaintenanceIdFor(vehicle.vehicleId, payload),
    vehicleId: vehicle.vehicleId,
    eventType,
    date: textValue(payload.date),
    mileage: Number(payload.mileage || 0),
    supplier: textValue(payload.supplier),
    description: textValue(payload.description),
    cost: payload.cost === "" || payload.cost === undefined ? "" : Number(payload.cost || 0),
    followUpDate: textValue(payload.followUpDate),
    officeNote: textValue(payload.officeNote),
    recordedBy: officeContext.userId,
    recordedAt: now,
    updatedAt: now,
    history: [{ action: "Maintenance record added", by: officeContext.userId, at: now }]
  };
  if (vehicle.maintenanceRecords.some((item) => textValue(item.maintenanceId) === record.maintenanceId)) {
    return { status: 409, body: { ok: false, message: "This maintenance record already exists." } };
  }
  const folders = vehicleRecordFolders(vehicle);
  try {
    const savedFile = saveVehicleEvidenceFile(folders.maintenanceFolder, payload.evidence, `${vehicle.registration} - ${eventType}`);
    if (savedFile) record.evidence = savedFile;
  } catch (error) {
    return { status: 400, body: { ok: false, message: error.message || "Maintenance evidence upload failed." } };
  }
  vehicle.maintenanceRecords.push(record);
  vehicle.updatedAt = now;
  phase09aAddVehicleAuditEvent(data, "Vehicle Maintenance Record Added", record.maintenanceId, officeContext, {}, record);
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, record, vehicleId: vehicle.vehicleId } };
}

function phase073dMarkJobsAvailableForSession(session) {
  const data = readCommandCentreData();
  const now = new Date().toISOString();
  let changed = 0;
  data.jobs = (data.jobs || []).map((job) => {
    let nextJob = job;
    const withdrawals = Array.isArray(nextJob.dispatchWithdrawals) ? nextJob.dispatchWithdrawals : [];
    const updatedWithdrawals = withdrawals.map((withdrawal) => {
      if (textValue(withdrawal.fromTechnicianId) !== textValue(session.context.technicianId)) return withdrawal;
      const version = Number(withdrawal.version || nextJob.dispatchVersion || 1);
      if (Number(withdrawal.availableVersion || 0) === version) return withdrawal;
      changed += 1;
      phase073dAddAuditEvent(data, "Withdrawal Made Available To Technician App", phase073dHubJobId(nextJob), session.context.userId, "Technician", { dispatchVersion: version, withdrawalId: textValue(withdrawal.withdrawalId) });
      return {
        ...withdrawal,
        availableAt: now,
        availableVersion: version
      };
    });
    if (updatedWithdrawals.some((withdrawal, index) => withdrawal !== withdrawals[index])) {
      nextJob = {
        ...nextJob,
        dispatchWithdrawals: updatedWithdrawals,
        dispatchHistory: [
          ...(Array.isArray(nextJob.dispatchHistory) ? nextJob.dispatchHistory : []),
          {
            event: "Withdrawal Available to Technician App",
            version: Number(nextJob.dispatchVersion || 1),
            at: now,
            by: session.context.userId,
            source: "Technician App feed download"
          }
        ]
      };
    }
    if (!phase073dHubJobIsDelivered(nextJob)) return nextJob;
    const mapped = phase073dMapHubJob(nextJob, data, session.context);
    if (mapped.assignedTechnicianId !== session.context.technicianId) return nextJob;
    const version = Number(nextJob.dispatchVersion || 1);
    if (Number(nextJob.dispatchAvailableVersion || nextJob.dispatchReceivedVersion || 0) === version) return nextJob;
    const currentStatus = phase073dNormaliseDispatchStatus(nextJob.dispatchStatus || nextJob.deliveryStatus || nextJob.status || "Sent to Technician App");
    changed += 1;
    const updated = {
      ...nextJob,
      dispatchStatus: currentStatus,
      deliveryStatus: currentStatus,
      dispatchAvailableAt: now,
      dispatchAvailableVersion: version,
      dispatchHistory: [
        ...(Array.isArray(job.dispatchHistory) ? job.dispatchHistory : []),
        {
          event: "Available to Technician App",
          version,
          at: now,
          by: session.context.userId,
          source: "Technician App feed download"
        }
      ]
    };
    phase073dAddAuditEvent(data, "Dispatch Made Available To Technician App", phase073dHubJobId(nextJob), session.context.userId, "Technician", { dispatchVersion: version, dispatchStatus: currentStatus });
    return updated;
  });
  if (changed) phase06a2WriteCommandCentreData(data);
  return changed;
}

function phase073dResolveOfficeContext(data, payload = {}) {
  const name = textValue(payload.officeUserName || payload.requestedBy || payload.userName);
  const staff = (data.staffProfiles || []).find((profile) => textValue(profile.name).toLowerCase() === name.toLowerCase());
  const role = textValue(staff?.role || payload.officeRole);
  const allowedBuiltIn = ["kevin", "kev", "kevin eastman", "alex", "alex lancaster", "jodie", "jodie wilkinson"].includes(name.toLowerCase());
  const allowedRole = ["director", "admin", "office", "manager"].includes(role.toLowerCase());
  if (!allowedBuiltIn && !allowedRole) return null;
  return {
    userId: textValue(staff?.userId || staff?.staffId || `USR-OFFICE-${name.replace(/[^A-Z0-9]/gi, "-").toUpperCase()}`),
    name: name || textValue(staff?.name) || "Kingswood Office",
    role: role || (["kevin", "alex", "kevin eastman", "alex lancaster"].includes(name.toLowerCase()) ? "Director" : "Office")
  };
}

function phase073dValidateJobForDispatch(job, data, officeContext) {
  const jobId = phase073dHubJobId(job);
  if (!jobId) return "Job has no stable jobId.";
  const date = textValue(job.date || job.jobDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Job work date is missing or invalid.";
  const assignedTechnicianId = phase073dResolveTechnicianIdForJob(job, data, {});
  if (!assignedTechnicianId) return "Assigned technician could not be resolved safely.";
  if (!officeContext) return "Office dispatch permission could not be confirmed.";
  return "";
}

function phase073dScheduleId(technicianId, date) {
  return `SCHED-${technicianId}-${date}`.replace(/[^A-Z0-9-]/gi, "-").toUpperCase();
}

const phase073eTechnicianVisibleFields = Object.freeze([
  ["date", "Work date"],
  ["slot", "Appointment slot"],
  ["dispatchRunningOrder", "Running order"],
  ["technician", "Assigned technician"],
  ["client", "Client"],
  ["mainClient", "Client group"],
  ["address", "Address"],
  ["postcode", "Postcode"],
  ["residentPhone", "Contact telephone"],
  ["contactName", "Contact name"],
  ["contactTelephone", "Contact telephone"],
  ["accessInstructions", "Access instructions"],
  ["jobDetails", "Work description"],
  ["jobInstructions", "Job instructions"],
  ["reportNotes", "Reporting requirements"],
  ["title", "Work category"]
]);

const phase073eCommercialFields = Object.freeze([
  "price",
  "agreedPrice",
  "cost",
  "amount",
  "valuation",
  "valuationAmount",
  "valuationGroup",
  "invoiceStatus",
  "invoiceNumber",
  "commercialHistory",
  "reportedAt",
  "reportId",
  "oneDriveReportFolder",
  "photos",
  "photoUrls",
  "cloudinaryUrls"
]);

function phase073eSafeText(value = "") {
  return textValue(value).slice(0, 180);
}

function phase073eVisibleChanges(previous = {}, next = {}) {
  return phase073eTechnicianVisibleFields
    .map(([field, label]) => {
      const before = phase073eSafeText(previous[field]);
      const after = phase073eSafeText(next[field]);
      if (before === after) return null;
      return { field, label, previous: before, next: after };
    })
    .filter(Boolean);
}

function phase073eJobIsCompletedOrReported(job = {}) {
  const status = textValue(job.status || job.report || job.completed).toLowerCase();
  return Boolean(job.reportId || job.oneDriveReportFolder || job.completedReport || job.reportSubmittedAt)
    || status.includes("completed")
    || status.includes("report submitted");
}

function phase073ePreserveCommercialFields(current = {}, next = {}) {
  const output = { ...next };
  phase073eCommercialFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(current, field)) output[field] = current[field];
  });
  return output;
}

function phase073eUpdatePlannerForJob(data, job) {
  if (!Array.isArray(data.weeklyPlanner)) return;
  const jobId = phase073dHubJobId(job);
  data.weeklyPlanner = data.weeklyPlanner.map((slot) => {
    const slotJobId = textValue(slot.jobId);
    const slotJobNumber = textValue(slot.jobNumber);
    if ((slotJobId && slotJobId === jobId) || (slotJobNumber && slotJobNumber === textValue(job.number))) {
      return {
        ...slot,
        date: textValue(job.date || job.jobDate) || slot.date,
        technician: textValue(job.technician) || slot.technician,
        session: textValue(job.slot || job.session) || slot.session,
        slot: textValue(job.slot || job.session) || slot.slot,
        status: textValue(job.status) || slot.status,
        task: textValue(job.postcode || job.title || job.address || job.number) || slot.task,
        jobId,
        jobNumber: textValue(job.number || slot.jobNumber),
        dispatchStatus: phase073dNormaliseDispatchStatus(job.dispatchStatus || job.deliveryStatus || job.status)
      };
    }
    return slot;
  });
}

function phase073eResolveTechnician(data = {}, input = {}) {
  const technicianId = textValue(input.technicianId || input.assignedTechnicianId || input.toTechnicianId);
  const staffId = textValue(input.staffId || input.assignedStaffId || input.toStaffId);
  const name = textValue(input.name || input.technician || input.toTechnicianName);
  const profiles = Array.isArray(data.technicianProfiles) ? data.technicianProfiles : [];
  const staffProfiles = Array.isArray(data.staffProfiles) ? data.staffProfiles : [];
  const profile = profiles.find((item) => {
    if (technicianId && textValue(item.technicianId) === technicianId) return true;
    if (staffId && textValue(item.staffId) === staffId) return true;
    if (name && textValue(item.name).toLowerCase() === name.toLowerCase()) return true;
    return false;
  });
  const staff = staffProfiles.find((item) => {
    if (profile?.staffId && textValue(item.staffId) === textValue(profile.staffId)) return true;
    if (staffId && textValue(item.staffId) === staffId) return true;
    if (name && textValue(item.name).toLowerCase() === name.toLowerCase()) return true;
    return false;
  });
  const resolvedTechnicianId = textValue(profile?.technicianId || technicianId || (staff?.staffId ? phase073dApprovedTechnicianIdsByStaffId[textValue(staff.staffId)] : ""));
  const resolvedStaffId = textValue(profile?.staffId || staff?.staffId || staffId);
  const resolvedName = textValue(profile?.name || staff?.name || name);
  if (!resolvedTechnicianId || !resolvedStaffId || !resolvedName) return null;
  const status = textValue(profile?.status || staff?.status || "Active").toLowerCase();
  const appAccessStatus = textValue(profile?.appAccessStatus || "Enabled").toLowerCase();
  if (status && status !== "active") return null;
  if (appAccessStatus && ["disabled", "inactive", "blocked"].includes(appAccessStatus)) return null;
  return {
    technicianId: resolvedTechnicianId,
    staffId: resolvedStaffId,
    name: resolvedName
  };
}

function phase073eJobRunningOrderForTechnician(data = {}, technicianId = "", date = "", excludeJobId = "") {
  const jobs = (data.jobs || [])
    .filter((job) => phase073dHubJobId(job) !== excludeJobId)
    .filter((job) => textValue(job.date || job.jobDate) === date)
    .filter((job) => phase073dResolveTechnicianIdForJob(job, data, {}) === technicianId)
    .filter((job) => !textValue(job.dispatchStatus || job.status).toLowerCase().includes("cancel"));
  return jobs.length + 1;
}

function phase073eScheduleJobSnapshot(job = {}) {
  const snapshot = {};
  phase073eTechnicianVisibleFields.forEach(([field]) => {
    snapshot[field] = phase073eSafeText(job[field]);
  });
  snapshot.technician = phase073eSafeText(job.technician);
  snapshot.assignedTechnicianId = phase073eSafeText(job.assignedTechnicianId || job.technicianId);
  return snapshot;
}

function phase073eSnapshotChanged(previous = {}, job = {}) {
  const next = phase073eScheduleJobSnapshot(job);
  return phase073eTechnicianVisibleFields
    .filter(([field]) => Object.prototype.hasOwnProperty.call(previous, field))
    .some(([field]) => phase073eSafeText(previous[field]) !== phase073eSafeText(next[field]));
}

function phase073eDuplicateValues(values = []) {
  const seen = new Set();
  return values.some((value) => {
    const key = textValue(value);
    if (!key) return false;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}

function phase073eReassignJob(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to reassign dispatched jobs." } };
  const jobId = textValue(payload.jobId || payload.id);
  const current = (data.jobs || []).find((job) => phase073dHubJobId(job) === jobId);
  if (!current) return { status: 404, body: { ok: false, message: "Job instruction is unavailable." } };
  if (!phase073dHubJobIsDelivered(current)) return { status: 409, body: { ok: false, message: "This job has not been dispatched yet." } };
  if (phase073eJobIsCompletedOrReported(current)) return { status: 409, body: { ok: false, message: "Completed or reported jobs require a separate office correction process." } };
  const currentVersion = Number(current.dispatchVersion || 1);
  const suppliedIdempotencyKey = textValue(payload.idempotencyKey);
  if (suppliedIdempotencyKey) {
    const existingAssignment = (current.dispatchAssignments || []).find((entry) => textValue(entry.idempotencyKey) === suppliedIdempotencyKey);
    if (existingAssignment) {
      return { status: 200, body: { ok: true, idempotent: true, jobId, dispatchVersion: Number(existingAssignment.version || currentVersion), dispatchStatus: current.dispatchStatus || "Sent to Technician App" } };
    }
  }
  if (Number(payload.baseVersion || currentVersion) !== currentVersion) return { status: 409, body: { ok: false, message: "This job has changed since it was opened. Refresh and try again." } };
  const reason = textValue(payload.reason);
  if (reason.length < 3) return { status: 400, body: { ok: false, message: "Please provide a reassignment reason." } };
  const fromTechnicianId = phase073dResolveTechnicianIdForJob(current, data, {});
  if (!fromTechnicianId) return { status: 400, body: { ok: false, message: "Current technician could not be resolved safely." } };
  const toTechnician = phase073eResolveTechnician(data, {
    technicianId: payload.toTechnicianId || payload.technicianId,
    staffId: payload.toStaffId || payload.staffId,
    name: payload.toTechnicianName || payload.technician
  });
  if (!toTechnician) return { status: 400, body: { ok: false, message: "Replacement technician could not be resolved safely." } };
  if (toTechnician.technicianId === fromTechnicianId) return { status: 409, body: { ok: false, message: "The job is already assigned to this technician." } };
  const fromStaffId = textValue(current.assignedStaffId || current.staffId);
  const fromTechnicianName = textValue(current.technician);
  const nextVersion = currentVersion + 1;
  const now = new Date().toISOString();
  const idempotencyKey = suppliedIdempotencyKey || textValue(`REASSIGN-${jobId}-${currentVersion}-${fromTechnicianId}-${toTechnician.technicianId}`);
  if ((current.dispatchAssignments || []).some((entry) => textValue(entry.idempotencyKey) === idempotencyKey && Number(entry.version || 0) === nextVersion)) {
    return { status: 200, body: { ok: true, idempotent: true, jobId, dispatchVersion: nextVersion, dispatchStatus: current.dispatchStatus || "Sent to Technician App" } };
  }
  const withdrawalId = `WD-${jobId}-${nextVersion}-${fromTechnicianId}`.replace(/[^A-Z0-9-]/gi, "-").toUpperCase();
  const reassigned = phase073ePreserveCommercialFields(current, {
    ...current,
    assignedStaffId: toTechnician.staffId,
    assignedTechnicianId: toTechnician.technicianId,
    technician: toTechnician.name,
    status: "Sent to Tech",
    sentToTech: true,
    publishedToTech: true,
    dispatchStatus: "Sent to Technician App",
    deliveryStatus: "Sent to Technician App",
    dispatchVersion: nextVersion,
    dispatchSentAt: now,
    sentToTechAt: now,
    dispatchRunningOrder: phase073eJobRunningOrderForTechnician(data, toTechnician.technicianId, textValue(current.date || current.jobDate), jobId),
    dispatchAvailableAt: "",
    dispatchAvailableVersion: 0,
    dispatchReceivedAt: "",
    dispatchReceivedVersion: 0,
    dispatchResponseVersion: 0,
    dispatchAcknowledgedAt: "",
    dispatchAcknowledgedVersion: 0,
    technicianAcceptedAt: "",
    technicianUnableAt: "",
    technicianUnableReason: "",
    technicianResponse: "",
    dispatchReassignmentReason: reason,
    reassignedAt: now,
    reassignedBy: officeContext.name,
    originalTechnicianId: textValue(current.originalTechnicianId || fromTechnicianId),
    originalTechnicianName: textValue(current.originalTechnicianName || fromTechnicianName),
    dispatchWithdrawals: [
      ...(Array.isArray(current.dispatchWithdrawals) ? current.dispatchWithdrawals : []),
      {
        withdrawalId,
        jobId,
        version: nextVersion,
        fromTechnicianId,
        fromStaffId,
        fromTechnicianName,
        toTechnicianId: toTechnician.technicianId,
        toStaffId: toTechnician.staffId,
        toTechnicianName: toTechnician.name,
        reason,
        sentAt: now,
        acknowledgedAt: "",
        acknowledgedVersion: 0,
        previousRunningOrder: Number(current.dispatchRunningOrder || 0),
        idempotencyKey
      }
    ],
    dispatchAssignments: [
      ...(Array.isArray(current.dispatchAssignments) ? current.dispatchAssignments : []),
      {
        event: "Reassigned",
        version: nextVersion,
        at: now,
        by: officeContext.name,
        fromTechnicianId,
        fromStaffId,
        fromTechnicianName,
        toTechnicianId: toTechnician.technicianId,
        toStaffId: toTechnician.staffId,
        toTechnicianName: toTechnician.name,
        reason,
        idempotencyKey
      }
    ],
    dispatchHistory: [
      ...(Array.isArray(current.dispatchHistory) ? current.dispatchHistory : []),
      { event: "Withdrawn From Technician", version: nextVersion, at: now, by: officeContext.name, technicianId: fromTechnicianId, reason },
      { event: "Replacement Assignment Sent", version: nextVersion, at: now, by: officeContext.name, technicianId: toTechnician.technicianId, reason }
    ]
  });
  data.jobs = (data.jobs || []).map((job) => phase073dHubJobId(job) === jobId ? reassigned : job);
  phase073eUpdatePlannerForJob(data, reassigned);
  phase073dAddAuditEvent(data, "Job Reassigned", jobId, officeContext.userId, officeContext.role, { dispatchVersion: nextVersion, fromTechnicianId, toTechnicianId: toTechnician.technicianId, reason });
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, jobId, dispatchVersion: nextVersion, dispatchStatus: "Sent to Technician App", withdrawalId, fromTechnicianId, toTechnicianId: toTechnician.technicianId } };
}

function phase073eCommitJobChange(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to change dispatched jobs." } };
  const jobId = textValue(payload.jobId || payload.updatedJob?.jobId || payload.updatedJob?.id);
  const current = (data.jobs || []).find((job) => phase073dHubJobId(job) === jobId);
  if (!current) return { status: 404, body: { ok: false, message: "Job instruction is unavailable." } };
  if (!phase073dHubJobIsDelivered(current)) return { status: 409, body: { ok: false, message: "This job has not been dispatched yet." } };
  if (phase073eJobIsCompletedOrReported(current)) return { status: 409, body: { ok: false, message: "Completed or reported jobs require a separate office correction process." } };
  const baseVersion = Number(payload.baseVersion || 0);
  const currentVersion = Number(current.dispatchVersion || 1);
  if (baseVersion && baseVersion !== currentVersion) return { status: 409, body: { ok: false, message: "This job changed elsewhere. Reload and review the latest version." } };
  const reason = textValue(payload.reason);
  if (reason.length < 3) return { status: 400, body: { ok: false, message: "Please provide a short change reason." } };
  const candidate = phase073ePreserveCommercialFields(current, { ...current, ...(payload.updatedJob || {}) });
  candidate.jobId = jobId;
  candidate.id = candidate.id || current.id || jobId;
  const changes = phase073eVisibleChanges(current, candidate);
  if (!changes.length) return { status: 409, body: { ok: false, message: "No technician-visible job change was detected." } };
  const nextVersion = currentVersion + 1;
  const now = new Date().toISOString();
  const updated = {
    ...candidate,
    sentToTech: true,
    publishedToTech: true,
    status: "Sent to Tech",
    dispatchStatus: "Change sent",
    deliveryStatus: "Change sent",
    dispatchVersion: nextVersion,
    dispatchSentAt: now,
    dispatchChangeReason: reason,
    dispatchChangeSummary: changes,
    dispatchAvailableAt: "",
    dispatchAvailableVersion: 0,
    dispatchResponseVersion: 0,
    technicianResponse: "",
    technicianAcceptedAt: "",
    technicianUnableAt: "",
    technicianUnableReason: "",
    dispatchHistory: [
      ...(Array.isArray(current.dispatchHistory) ? current.dispatchHistory : []),
      { event: "Amended dispatch created", version: nextVersion, at: now, by: officeContext.name, reason, changes }
    ]
  };
  data.jobs = (data.jobs || []).map((job) => phase073dHubJobId(job) === jobId ? updated : job);
  phase073eUpdatePlannerForJob(data, updated);
  phase073dAddAuditEvent(data, "Amended Dispatch Created", jobId, officeContext.userId, officeContext.role, { dispatchVersion: nextVersion, reason, changes });
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, jobId, dispatchVersion: nextVersion, dispatchStatus: "Change sent", changes } };
}

function phase073eCancelJob(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to cancel dispatched jobs." } };
  const jobId = textValue(payload.jobId || payload.id);
  const current = (data.jobs || []).find((job) => phase073dHubJobId(job) === jobId);
  if (!current) return { status: 404, body: { ok: false, message: "Job instruction is unavailable." } };
  if (!phase073dHubJobIsDelivered(current)) return { status: 409, body: { ok: false, message: "This job has not been dispatched yet." } };
  if (phase073eJobIsCompletedOrReported(current)) return { status: 409, body: { ok: false, message: "Completed or reported jobs cannot be cancelled through dispatch." } };
  const baseVersion = Number(payload.baseVersion || 0);
  const currentVersion = Number(current.dispatchVersion || 1);
  if (baseVersion && baseVersion !== currentVersion) return { status: 409, body: { ok: false, message: "This job changed elsewhere. Reload and review the latest version." } };
  const reason = textValue(payload.reason);
  if (reason.length < 3) return { status: 400, body: { ok: false, message: "Please provide a cancellation reason." } };
  const currentStatus = phase073dNormaliseDispatchStatus(current.dispatchStatus || current.deliveryStatus || current.status);
  if (currentStatus.includes("Cancellation")) {
    return { status: 200, body: { ok: true, jobId, alreadyCancelled: true, dispatchVersion: Number(current.dispatchVersion || 1), dispatchStatus: currentStatus } };
  }
  const nextVersion = currentVersion + 1;
  const now = new Date().toISOString();
  const updated = {
    ...current,
    status: "Cancelled",
    sentToTech: true,
    publishedToTech: true,
    dispatchStatus: "Cancellation sent",
    deliveryStatus: "Cancellation sent",
    dispatchVersion: nextVersion,
    dispatchSentAt: now,
    cancelledAt: now,
    dispatchCancelledAt: now,
    dispatchCancellationReason: reason,
    dispatchAvailableAt: "",
    dispatchAvailableVersion: 0,
    dispatchResponseVersion: 0,
    dispatchHistory: [
      ...(Array.isArray(current.dispatchHistory) ? current.dispatchHistory : []),
      { event: "Job cancellation created", version: nextVersion, at: now, by: officeContext.name, reason }
    ]
  };
  data.jobs = (data.jobs || []).map((job) => phase073dHubJobId(job) === jobId ? updated : job);
  phase073eUpdatePlannerForJob(data, updated);
  phase073dAddAuditEvent(data, "Job Cancellation Created", jobId, officeContext.userId, officeContext.role, { dispatchVersion: nextVersion, reason });
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, jobId, dispatchVersion: nextVersion, dispatchStatus: "Cancellation sent", reason } };
}

function phase073dDispatchJobs(payload = {}) {
  const data = readCommandCentreData();
  const officeContext = phase073dResolveOfficeContext(data, payload);
  if (!officeContext) return { status: 403, body: { ok: false, message: "You are not authorised to dispatch jobs." } };
  const mode = textValue(payload.mode || (payload.jobId ? "single" : "schedule"));
  const date = textValue(payload.date || payload.workDate);
  const hasRequestedJobIds = Array.isArray(payload.jobIds);
  const requestedJobIds = Array.isArray(payload.jobIds) ? payload.jobIds.map(textValue).filter(Boolean) : [];
  const requestedRunningOrder = Array.isArray(payload.runningOrder) ? payload.runningOrder.map(textValue).filter(Boolean) : requestedJobIds;
  if (mode !== "single" && requestedJobIds.length && phase073eDuplicateValues(requestedJobIds)) {
    return { status: 400, body: { ok: false, message: "Replacement schedule contains duplicate jobs." } };
  }
  if (mode !== "single" && requestedRunningOrder.length && phase073eDuplicateValues(requestedRunningOrder)) {
    return { status: 400, body: { ok: false, message: "Replacement schedule contains duplicate running-order values." } };
  }
  let selectedJobs = [];
  if (mode === "single") {
    const jobId = textValue(payload.jobId || payload.id);
    selectedJobs = (data.jobs || []).filter((job) => phase073dHubJobId(job) === jobId);
  } else if (hasRequestedJobIds) {
    const requestedSet = new Set(requestedJobIds);
    selectedJobs = (data.jobs || []).filter((job) => requestedSet.has(phase073dHubJobId(job)));
    if (selectedJobs.length !== requestedSet.size) return { status: 404, body: { ok: false, message: "One or more replacement schedule jobs could not be found." } };
  } else {
    selectedJobs = (data.jobs || []).filter((job) => {
      if (textValue(job.date || job.jobDate) !== date) return false;
      const technicianId = phase073dResolveTechnicianIdForJob(job, data, {});
      if (payload.technicianId && technicianId !== textValue(payload.technicianId)) return false;
      return Boolean(technicianId);
    });
  }
  if (mode === "single" && !selectedJobs.length) return { status: 404, body: { ok: false, message: "Job instruction is unavailable." } };
  const validationErrors = selectedJobs.map((job) => phase073dValidateJobForDispatch(job, data, officeContext)).filter(Boolean);
  if (validationErrors.length) return { status: 400, body: { ok: false, message: validationErrors[0] } };
  if (mode !== "single" && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: 400, body: { ok: false, message: "Schedule work date is missing or invalid." } };
  }
  const now = new Date().toISOString();
  let changed = 0;
  const dispatched = [];
  data.jobs = (data.jobs || []).map((job) => {
    if (!selectedJobs.some((selected) => phase073dHubJobId(selected) === phase073dHubJobId(job))) return job;
    const jobId = phase073dHubJobId(job);
    const version = Number(job.dispatchVersion || 1);
    const alreadySent = Boolean(job.sentToTech || job.publishedToTech);
    const technicianId = phase073dResolveTechnicianIdForJob(job, data, {});
    const runningOrder = selectedJobs
      .filter((candidate) => phase073dResolveTechnicianIdForJob(candidate, data, {}) === technicianId)
      .sort((a, b) => String(a.slot || "").localeCompare(String(b.slot || "")) || String(a.number || a.title || "").localeCompare(String(b.number || b.title || "")))
      .findIndex((candidate) => phase073dHubJobId(candidate) === jobId) + 1;
    if (!alreadySent) changed += 1;
    const dispatchHistory = Array.isArray(job.dispatchHistory) ? job.dispatchHistory : [];
    if (!dispatchHistory.some((entry) => entry.event === "Dispatch Created" && Number(entry.version || 0) === version)) {
      dispatchHistory.push({ event: "Dispatch Created", version, at: now, by: officeContext.name, source: "Kingswood Hub" });
      phase073dAddAuditEvent(data, "Dispatch Created", jobId, officeContext.userId, officeContext.role, { dispatchVersion: version, dispatchStatus: "Sent to Technician App" });
    }
    dispatched.push({ jobId, technicianId, alreadySent, dispatchStatus: "Sent to Technician App", dispatchSentAt: job.dispatchSentAt || now, dispatchVersion: version });
    return {
      ...job,
      assignedStaffId: job.assignedStaffId || (data.staffProfiles || []).find((staff) => textValue(staff.name) === textValue(job.technician))?.staffId || "",
      assignedTechnicianId: job.assignedTechnicianId || technicianId,
      sentToTech: true,
      publishedToTech: true,
      status: "Sent to Tech",
      dispatchStatus: "Sent to Technician App",
      deliveryStatus: "Sent to Technician App",
      dispatchVersion: version,
      dispatchSentAt: job.dispatchSentAt || now,
      sentToTechAt: job.sentToTechAt || job.dispatchSentAt || now,
      dispatchSentBy: job.dispatchSentBy || officeContext.name,
      dispatchRunningOrder: job.dispatchRunningOrder || runningOrder,
      dispatchHistory
    };
  });
  if (mode !== "single") {
    const replaceSchedule = payload.replace === true || payload.replaceSchedule === true || textValue(payload.mode).toLowerCase() === "replacement";
    const replacementReason = textValue(payload.reason || payload.replacementReason);
    if (replaceSchedule && replacementReason.length < 3) return { status: 400, body: { ok: false, message: "Please provide a replacement schedule reason." } };
    const jobsByTechnician = new Map();
    selectedJobs
      .sort((a, b) => {
        const aIndex = requestedRunningOrder.length ? requestedRunningOrder.indexOf(phase073dHubJobId(a)) : -1;
        const bIndex = requestedRunningOrder.length ? requestedRunningOrder.indexOf(phase073dHubJobId(b)) : -1;
        if (aIndex >= 0 || bIndex >= 0) return (aIndex < 0 ? 9999 : aIndex) - (bIndex < 0 ? 9999 : bIndex);
        return String(a.slot || "").localeCompare(String(b.slot || "")) || String(a.number || a.title || "").localeCompare(String(b.number || b.title || ""));
      })
      .forEach((job) => {
      const technicianId = phase073dResolveTechnicianIdForJob(job, data, {});
      if (!jobsByTechnician.has(technicianId)) jobsByTechnician.set(technicianId, []);
      jobsByTechnician.get(technicianId).push(phase073dHubJobId(job));
    });
    if (!selectedJobs.length && payload.technicianId) jobsByTechnician.set(textValue(payload.technicianId), []);
    data.jobDispatchSchedules = Array.isArray(data.jobDispatchSchedules) ? data.jobDispatchSchedules : [];
    jobsByTechnician.forEach((jobIds, technicianId) => {
      const scheduleId = phase073dScheduleId(technicianId, date);
      const existingIndex = data.jobDispatchSchedules.findIndex((schedule) => schedule.scheduleId === scheduleId);
      if (existingIndex >= 0) {
        if (!replaceSchedule) return;
        const currentSchedule = data.jobDispatchSchedules[existingIndex];
        const scheduleVersion = Number(currentSchedule.scheduleVersion || 1) + 1;
        const previousJobIds = Array.isArray(currentSchedule.jobIds) ? currentSchedule.jobIds.map(textValue).filter(Boolean) : [];
        const previousSnapshots = currentSchedule.jobSnapshots && typeof currentSchedule.jobSnapshots === "object" ? currentSchedule.jobSnapshots : {};
        const addedJobIds = jobIds.filter((jobId) => !previousJobIds.includes(jobId));
        const removedJobIds = previousJobIds.filter((jobId) => !jobIds.includes(jobId));
        const unchangedJobIds = jobIds.filter((jobId) => previousJobIds.includes(jobId));
        const reorderedJobIds = unchangedJobIds.filter((jobId, index) => previousJobIds.indexOf(jobId) !== jobIds.indexOf(jobId));
        const changedJobIds = unchangedJobIds.filter((jobId) => {
          const job = (data.jobs || []).find((item) => phase073dHubJobId(item) === jobId);
          return job && previousSnapshots[jobId] && phase073eSnapshotChanged(previousSnapshots[jobId], job);
        });
        data.jobs = (data.jobs || []).map((job) => {
          const jobId = phase073dHubJobId(job);
          if (!previousJobIds.includes(jobId) && !jobIds.includes(jobId)) return job;
          const currentJobVersion = Number(job.dispatchVersion || 1);
          const runningOrder = jobIds.indexOf(jobId) + 1;
          if (removedJobIds.includes(jobId)) {
            const withdrawalId = `WD-${jobId}-${currentJobVersion + 1}-${technicianId}`.replace(/[^A-Z0-9-]/gi, "-").toUpperCase();
            return phase073ePreserveCommercialFields(job, {
              ...job,
              dispatchVersion: currentJobVersion + 1,
              dispatchStatus: "Withdrawal sent",
              deliveryStatus: "Withdrawal sent",
              status: "Sent to Tech",
              dispatchWithdrawalReason: replacementReason,
              dispatchWithdrawals: [
                ...(Array.isArray(job.dispatchWithdrawals) ? job.dispatchWithdrawals : []),
                {
                  withdrawalId,
                  jobId,
                  version: currentJobVersion + 1,
                  fromTechnicianId: technicianId,
                  fromStaffId: textValue(job.assignedStaffId || job.staffId),
                  fromTechnicianName: textValue(job.technician),
                  reason: replacementReason,
                  sentAt: now,
                  acknowledgedAt: "",
                  acknowledgedVersion: 0,
                  previousRunningOrder: Number(job.dispatchRunningOrder || 0)
                }
              ],
              dispatchHistory: [
                ...(Array.isArray(job.dispatchHistory) ? job.dispatchHistory : []),
                { event: "Withdrawn By Replacement Schedule", version: currentJobVersion + 1, at: now, by: officeContext.name, reason: replacementReason }
              ]
            });
          }
          if (!jobIds.includes(jobId)) return job;
          const materialChanged = changedJobIds.includes(jobId);
          const newlyAdded = addedJobIds.includes(jobId);
          const nextVersion = materialChanged || newlyAdded ? currentJobVersion + 1 : currentJobVersion;
          return phase073ePreserveCommercialFields(job, {
            ...job,
            sentToTech: true,
            publishedToTech: true,
            status: "Sent to Tech",
            dispatchStatus: materialChanged ? "Change sent" : "Sent to Technician App",
            deliveryStatus: materialChanged ? "Change sent" : "Sent to Technician App",
            dispatchVersion: nextVersion,
            dispatchSentAt: materialChanged || newlyAdded ? now : job.dispatchSentAt || now,
            sentToTechAt: job.sentToTechAt || now,
            dispatchRunningOrder: runningOrder,
            dispatchAvailableAt: materialChanged || newlyAdded ? "" : job.dispatchAvailableAt,
            dispatchAvailableVersion: materialChanged || newlyAdded ? 0 : Number(job.dispatchAvailableVersion || 0),
            dispatchResponseVersion: materialChanged || newlyAdded ? 0 : Number(job.dispatchResponseVersion || 0),
            dispatchAcknowledgedAt: materialChanged || newlyAdded ? "" : job.dispatchAcknowledgedAt || "",
            dispatchAcknowledgedVersion: materialChanged || newlyAdded ? 0 : Number(job.dispatchAcknowledgedVersion || 0),
            technicianAcceptedAt: materialChanged || newlyAdded ? "" : job.technicianAcceptedAt || "",
            technicianUnableAt: materialChanged || newlyAdded ? "" : job.technicianUnableAt || "",
            technicianUnableReason: materialChanged || newlyAdded ? "" : job.technicianUnableReason || "",
            technicianResponse: materialChanged || newlyAdded ? "" : job.technicianResponse || "",
            dispatchChangeReason: materialChanged ? replacementReason : job.dispatchChangeReason || "",
            dispatchChangeSummary: materialChanged ? phase073eVisibleChanges(previousSnapshots[jobId] || {}, job) : Array.isArray(job.dispatchChangeSummary) ? job.dispatchChangeSummary : [],
            dispatchHistory: [
              ...(Array.isArray(job.dispatchHistory) ? job.dispatchHistory : []),
              { event: newlyAdded ? "Added By Replacement Schedule" : materialChanged ? "Changed By Replacement Schedule" : reorderedJobIds.includes(jobId) ? "Reordered By Replacement Schedule" : "Retained By Replacement Schedule", version: nextVersion, at: now, by: officeContext.name, reason: replacementReason, runningOrder }
            ]
          });
        });
        const jobSnapshots = {};
        jobIds.forEach((jobId) => {
          const job = (data.jobs || []).find((item) => phase073dHubJobId(item) === jobId);
          if (job) jobSnapshots[jobId] = phase073eScheduleJobSnapshot(job);
        });
        data.jobDispatchSchedules[existingIndex] = {
          ...currentSchedule,
          status: "Sent to Technician App",
          sent: true,
          lastSentAt: now,
          replacedAt: now,
          replacementReason,
          scheduleVersion,
          jobCount: jobIds.length,
          jobIds,
          addedJobIds,
          removedJobIds,
          changedJobIds,
          reorderedJobIds,
          unchangedJobIds,
          jobSnapshots,
          history: [
            ...(Array.isArray(currentSchedule.history) ? currentSchedule.history : []),
            {
              event: "Replacement Schedule Sent",
              version: scheduleVersion,
              at: now,
              by: officeContext.name,
              reason: replacementReason,
              previousJobIds: Array.isArray(currentSchedule.jobIds) ? currentSchedule.jobIds : [],
              jobIds
            }
          ]
        };
        phase073dAddAuditEvent(data, "Replacement Schedule Sent", scheduleId, officeContext.userId, officeContext.role, { scheduleVersion, reason: replacementReason, jobIds });
        changed += 1;
        return;
      }
      const jobSnapshots = {};
      jobIds.forEach((jobId) => {
        const job = (data.jobs || []).find((item) => phase073dHubJobId(item) === jobId);
        if (job) jobSnapshots[jobId] = phase073eScheduleJobSnapshot(job);
      });
      data.jobDispatchSchedules.push({ scheduleId, technicianId, date, status: "Sent to Technician App", sent: true, sentAt: now, sentBy: officeContext.name, jobCount: jobIds.length, jobIds, jobSnapshots, scheduleVersion: 1 });
      changed += 1;
    });
  }
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, changed, dispatched, alreadySent: dispatched.every((item) => item.alreadySent) } };
}

function phase073dTechnicianJobResponse(session, payload = {}, responseType = "accept") {
  const data = readCommandCentreData();
  const jobId = textValue(payload.jobId || payload.id);
  const job = (data.jobs || []).find((item) => phase073dHubJobId(item) === jobId);
  if (!job) return { status: 404, body: { ok: false, message: "Job instruction is unavailable." } };
  if (!phase073dHubJobIsDelivered(job)) return { status: 409, body: { ok: false, message: "This job has not been sent to the Technician App." } };
  if (responseType === "withdrawal") {
    const version = Number(payload.dispatchVersion || job.dispatchVersion || 1);
    const withdrawals = Array.isArray(job.dispatchWithdrawals) ? job.dispatchWithdrawals : [];
    const withdrawal = withdrawals.find((item) => textValue(item.fromTechnicianId) === textValue(session.context.technicianId) && Number(item.version || 0) === version);
    if (!withdrawal) return { status: 403, body: { ok: false, message: "This withdrawal is not assigned to the authenticated technician." } };
    if (textValue(withdrawal.acknowledgedAt)) return { status: 409, body: { ok: false, message: "This withdrawal has already been acknowledged." } };
    const now = new Date().toISOString();
    const updatedWithdrawals = withdrawals.map((item) => item === withdrawal ? {
      ...item,
      acknowledgedAt: now,
      acknowledgedVersion: version,
      acknowledgedBy: session.context.userId
    } : item);
    const updated = {
      ...job,
      dispatchWithdrawals: updatedWithdrawals,
      dispatchHistory: [
        ...(Array.isArray(job.dispatchHistory) ? job.dispatchHistory : []),
        { event: "Technician acknowledged withdrawal", version, at: now, by: session.context.userId, source: "Technician App", withdrawalId: textValue(withdrawal.withdrawalId) }
      ]
    };
    data.jobs = (data.jobs || []).map((item) => phase073dHubJobId(item) === jobId ? updated : item);
    phase073dAddAuditEvent(data, "Technician Acknowledged Withdrawal", jobId, session.context.userId, "Technician", { dispatchVersion: version, withdrawalId: textValue(withdrawal.withdrawalId) });
    phase06a2WriteCommandCentreData(data);
    return { status: 200, body: { ok: true, jobId, dispatchStatus: "Withdrawal acknowledged", acknowledgedAt: now, dispatchVersion: version } };
  }
  const mapped = phase073dMapHubJob(job, data, session.context);
  if (mapped.assignedTechnicianId !== session.context.technicianId) {
    return { status: 403, body: { ok: false, message: "This job is not assigned to the authenticated technician." } };
  }
  const version = Number(job.dispatchVersion || 1);
  if (Number(payload.dispatchVersion || version) !== version) {
    return { status: 409, body: { ok: false, message: "This job instruction has been superseded. Refresh and review the latest version." } };
  }
  const currentDispatchStatus = phase073dNormaliseDispatchStatus(job.dispatchStatus || job.deliveryStatus || job.status);
  if (responseType === "change") {
    if (!currentDispatchStatus.includes("Change")) return { status: 409, body: { ok: false, message: "This job is not waiting for a change acknowledgement." } };
    if (Number(job.changeAcknowledgedVersion || 0) === version) return { status: 409, body: { ok: false, message: "This change has already been acknowledged." } };
    const now = new Date().toISOString();
    const updated = {
      ...job,
      dispatchStatus: "Change acknowledged",
      deliveryStatus: "Change acknowledged",
      changeAcknowledgedAt: now,
      changeAcknowledgedVersion: version,
      dispatchHistory: [
        ...(Array.isArray(job.dispatchHistory) ? job.dispatchHistory : []),
        { event: "Technician acknowledged change", version, at: now, by: session.context.userId, source: "Technician App" }
      ]
    };
    data.jobs = (data.jobs || []).map((item) => phase073dHubJobId(item) === jobId ? updated : item);
    phase073dAddAuditEvent(data, "Technician Acknowledged Change", jobId, session.context.userId, "Technician", { dispatchVersion: version });
    phase06a2WriteCommandCentreData(data);
    return { status: 200, body: { ok: true, jobId, dispatchStatus: "Change acknowledged", acknowledgedAt: now, dispatchVersion: version } };
  }
  if (responseType === "cancellation") {
    if (!currentDispatchStatus.includes("Cancellation")) return { status: 409, body: { ok: false, message: "This job is not waiting for a cancellation acknowledgement." } };
    if (Number(job.cancellationAcknowledgedVersion || 0) === version) return { status: 409, body: { ok: false, message: "This cancellation has already been acknowledged." } };
    const now = new Date().toISOString();
    const updated = {
      ...job,
      status: "Cancelled",
      dispatchStatus: "Cancellation acknowledged",
      deliveryStatus: "Cancellation acknowledged",
      cancellationAcknowledgedAt: now,
      cancellationAcknowledgedVersion: version,
      dispatchHistory: [
        ...(Array.isArray(job.dispatchHistory) ? job.dispatchHistory : []),
        { event: "Technician acknowledged cancellation", version, at: now, by: session.context.userId, source: "Technician App" }
      ]
    };
    data.jobs = (data.jobs || []).map((item) => phase073dHubJobId(item) === jobId ? updated : item);
    phase073dAddAuditEvent(data, "Technician Acknowledged Cancellation", jobId, session.context.userId, "Technician", { dispatchVersion: version });
    phase06a2WriteCommandCentreData(data);
    return { status: 200, body: { ok: true, jobId, dispatchStatus: "Cancellation acknowledged", acknowledgedAt: now, dispatchVersion: version } };
  }
  if (Number(job.dispatchResponseVersion || job.dispatchAcknowledgedVersion || 0) === version) {
    return { status: 409, body: { ok: false, message: "This job instruction has already had a technician response." } };
  }
  const reason = textValue(payload.reason || payload.unableReason);
  if (responseType === "unable" && reason.length < 3) {
    return { status: 400, body: { ok: false, message: "Please provide a short reason." } };
  }
  const now = new Date().toISOString();
  const dispatchStatus = responseType === "unable" ? "Unable" : "Accepted";
  const eventName = responseType === "unable" ? "Technician Unable" : "Technician Accepted";
  const updated = {
    ...job,
    dispatchStatus,
    deliveryStatus: dispatchStatus,
    technicianResponse: dispatchStatus,
    technicianAcceptedAt: responseType === "accept" ? now : job.technicianAcceptedAt || "",
    technicianUnableAt: responseType === "unable" ? now : job.technicianUnableAt || "",
    technicianUnableReason: responseType === "unable" ? reason : job.technicianUnableReason || "",
    dispatchResponseVersion: version,
    dispatchAcknowledgedAt: responseType === "accept" ? now : job.dispatchAcknowledgedAt || "",
    dispatchAcknowledgedVersion: responseType === "accept" ? version : Number(job.dispatchAcknowledgedVersion || 0),
    dispatchHistory: [
      ...(Array.isArray(job.dispatchHistory) ? job.dispatchHistory : []),
      {
        event: eventName,
        version,
        at: now,
        by: session.context.userId,
        source: "Technician App",
        reason
      }
    ]
  };
  data.jobs = (data.jobs || []).map((item) => phase073dHubJobId(item) === jobId ? updated : item);
  phase073dAddAuditEvent(data, eventName, jobId, session.context.userId, "Technician", { dispatchVersion: version, dispatchStatus, reason });
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, jobId, dispatchStatus, responseAt: now, reason, dispatchVersion: version } };
}

function phase05bFeedForSession(session) {
  const sourceRecords = phase073dBuildSourceRecordsForSession(session);
  return createTechnicianFeed(session.context, sourceRecords, {
    dataVersion: "phase-07-3d-job-dispatch-v1"
  });
}

function readCommandCentreData() {
  ensureHostedCommandDataReady();
  if (!fs.existsSync(dataFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8") || "{}");
  } catch {
    return {};
  }
}

function phase06a1DateRangeValues(from, to) {
  if (!from || !to) return [];
  const parseDate = (value) => {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return new Date("invalid");
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  };
  const start = parseDate(from);
  const end = parseDate(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function phase06a1IsWorkingWeekday(dateValue) {
  const [year, month, day] = String(dateValue || "").split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return false;
  const weekday = date.getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

function phase06a1WorkingDateRangeValues(from, to) {
  return phase06a1DateRangeValues(from, to).filter(phase06a1IsWorkingWeekday);
}

function phase06a1HolidayDaysForYear(request = {}, year) {
  const dates = phase06a1WorkingDateRangeValues(request.from, request.to)
    .filter((date) => date.startsWith(String(year)));
  if (!dates.length) return 0;
  if ((request.dayType === "Half day" || request.halfDay === true) && request.from === request.to && dates.length === 1) return 0.5;
  const statedDays = Number(request.days);
  if (Number.isFinite(statedDays) && statedDays > 0 && String(request.from || "").startsWith(String(year)) && String(request.to || "").startsWith(String(year))) {
    return statedDays;
  }
  return dates.length;
}

function phase06a1CompanyHolidayDaysForYear(data, year, compareDate = "") {
  const rows = [];
  (data.companyHolidays || []).forEach((holiday) => {
    phase06a1WorkingDateRangeValues(holiday.from, holiday.to)
      .filter((date) => date.startsWith(String(year)))
      .forEach((date) => rows.push({ date, days: 1 }));
  });
  (data.ukBankHolidays || [])
    .filter((holiday) => String(holiday.date || "").startsWith(String(year)))
    .forEach((holiday) => rows.push({ date: holiday.date, days: 1 }));
  const unique = new Map(rows.map((row) => [row.date, row]));
  const allRows = Array.from(unique.values());
  return allRows.reduce((sum, row) => sum + (row.days || 0), 0);
}

function phase06a1RecordYear(record = {}) {
  return String(record.year || record.date || record.from || record.to || "").slice(0, 4);
}

function phase06a1IsSickStatus(status) {
  return status === "Sick" || status === "Absent - Called in Sick";
}

function phase06a4AttendanceType(record = {}) {
  return record.type || record.attendanceType || record.status || "";
}

function phase06a4AttendanceStart(record = {}) {
  return record.startDate || record.date || record.from || "";
}

function phase06a4AttendanceEnd(record = {}) {
  if (record.ongoing === true || record.ongoing === "Yes") return "";
  return record.endDate || record.to || record.date || record.startDate || "";
}

function phase06a4AttendanceIsVoid(record = {}) {
  return String(record.status || "").toLowerCase() === "void" || record.voided === true;
}

function phase06a4AttendanceIsOngoing(record = {}) {
  return record.ongoing === true || record.ongoing === "Yes";
}

function phase06a4AttendanceAffectsYear(record = {}, year = "") {
  const start = phase06a4AttendanceStart(record);
  const end = phase06a4AttendanceEnd(record) || start;
  const dates = phase06a1WorkingDateRangeValues(start, end || start);
  return dates.some((date) => date.startsWith(String(year))) || phase06a1RecordYear(record) === String(year);
}

function phase06a4AttendanceWorkingDays(record = {}, year = "") {
  if (phase06a4AttendanceIsVoid(record)) return 0;
  const type = phase06a4AttendanceType(record);
  if (type === "Late") return 0;
  const stored = Number(record.workingDays ?? record.days);
  if (Number.isFinite(stored) && stored >= 0 && (!year || String(phase06a4AttendanceStart(record)).startsWith(String(year)))) {
    return stored;
  }
  const start = phase06a4AttendanceStart(record);
  const end = phase06a4AttendanceIsOngoing(record) ? new Date().toISOString().slice(0, 10) : (phase06a4AttendanceEnd(record) || start);
  const dates = phase06a1WorkingDateRangeValues(start, end).filter((date) => !year || date.startsWith(String(year)));
  if (!dates.length) return 0;
  if (record.dayType === "Half day" && start === end) return 0.5;
  return dates.length;
}

function phase06a4AnnualAttendanceSummary(rows = [], year = "") {
  const activeRows = rows.filter((record) => !phase06a4AttendanceIsVoid(record));
  const rowsByType = (type) => activeRows.filter((record) => phase06a4AttendanceType(record) === type);
  const sickRows = activeRows.filter((record) => phase06a1IsSickStatus(phase06a4AttendanceType(record)));
  return {
    sickDays: sickRows.reduce((sum, record) => sum + phase06a4AttendanceWorkingDays(record, year), 0),
    sicknessOccurrences: sickRows.length,
    lateOccurrences: rowsByType("Late").length,
    absentDays: rowsByType("Absent").reduce((sum, record) => sum + phase06a4AttendanceWorkingDays(record, year), 0),
    otherAuthorisedAbsenceDays: rowsByType("Other Authorised Absence").reduce((sum, record) => sum + phase06a4AttendanceWorkingDays(record, year), 0),
    unauthorisedAbsenceDays: rowsByType("Unauthorised Absence").reduce((sum, record) => sum + phase06a4AttendanceWorkingDays(record, year), 0)
  };
}

function phase06a4SafeAttendanceRecord(record = {}, year = "") {
  return {
    attendanceRecordId: textValue(record.attendanceRecordId || record.id),
    type: textValue(phase06a4AttendanceType(record)),
    startDate: textValue(phase06a4AttendanceStart(record)),
    endDate: phase06a4AttendanceIsOngoing(record) ? "" : textValue(phase06a4AttendanceEnd(record)),
    returnDate: textValue(record.returnDate || record.recoveryDate),
    ongoing: phase06a4AttendanceIsOngoing(record),
    dayType: textValue(record.dayType || "Full day"),
    workingDays: phase06a4AttendanceWorkingDays(record, year),
    minutesLate: Number(record.minutesLate || 0),
    status: phase06a4AttendanceIsVoid(record) ? "Void" : (phase06a4AttendanceIsOngoing(record) ? "Ongoing" : textValue(phase06a4AttendanceType(record)))
  };
}

function phase06a1StaffRecordMatches(record = {}, staff = {}) {
  if (record.staffId && staff.staffId) return record.staffId === staff.staffId;
  return !record.staffId && record.name && staff.name && record.name === staff.name;
}

function phase06a1HolidayStatus(request = {}) {
  return String(request.status || "").trim().toLowerCase();
}

function phase06a1BuildLeaveAttendance(session, yearInput) {
  const data = readCommandCentreData();
  const context = session.context || {};
  const currentYear = String(new Date().getFullYear());
  const selectedYear = String(yearInput || currentYear).replace(/[^0-9]/g, "").slice(0, 4) || currentYear;
  const staff = (data.staffProfiles || []).find((profile) => profile.staffId === context.staffId);
  const allYears = new Set([currentYear, selectedYear, String(Number(currentYear) - 1), String(Number(currentYear) - 2)]);

  (data.holidayRequests || []).forEach((request) => {
    if (phase06a1StaffRecordMatches(request, staff || {})) {
      if (request.from) allYears.add(String(request.from).slice(0, 4));
      if (request.to) allYears.add(String(request.to).slice(0, 4));
      if (request.year) allYears.add(String(request.year));
    }
  });
  (data.attendanceRecords || []).forEach((record) => {
    if (phase06a1StaffRecordMatches(record, staff || {}) && phase06a1RecordYear(record)) {
      allYears.add(phase06a1RecordYear(record));
    }
  });

  if (!staff) {
    return {
      ok: true,
      readOnly: true,
      year: selectedYear,
      availableYears: Array.from(allYears).filter(Boolean).sort().reverse(),
      leave: {
        available: false,
        message: "Holiday information unavailable."
      },
      attendance: {
        available: false,
        message: "No attendance records for this year."
      },
      notifications: []
    };
  }

  const todayValue = new Date().toISOString().slice(0, 10);
  const holidays = (data.holidayRequests || []).filter((request) => phase06a1StaffRecordMatches(request, staff));
  const yearHolidays = holidays.filter((request) => {
    const dates = phase06a1WorkingDateRangeValues(request.from, request.to);
    return dates.some((date) => date.startsWith(selectedYear)) || String(request.year || "") === selectedYear;
  });
  const attendanceRows = (data.attendanceRecords || []).filter((record) =>
    phase06a1StaffRecordMatches(record, staff) && phase06a4AttendanceAffectsYear(record, selectedYear)
  );

  const approvedRequests = yearHolidays.filter((request) => phase06a1HolidayStatus(request) === "approved");
  const pendingRequests = yearHolidays.filter((request) => ["pending", "requested", "awaiting approval"].includes(phase06a1HolidayStatus(request)));
  const approvedRequestIds = new Set(approvedRequests.map((request) => request.id || request.holidayRequestId).filter(Boolean));
  const legacyHolidayRows = attendanceRows.filter((record) =>
    record.status === "Holiday"
    && phase06a1IsWorkingWeekday(record.date)
    && record.source !== "holiday"
    && record.source !== "approved-holiday"
    && (!record.holidayRequestId || !approvedRequestIds.has(record.holidayRequestId))
  );
  const companyBankDays = phase06a1CompanyHolidayDaysForYear(data, selectedYear);
  const approvedTaken = approvedRequests
    .filter((request) => String(request.to || request.from || "") < todayValue)
    .reduce((sum, request) => sum + phase06a1HolidayDaysForYear(request, selectedYear), 0);
  const approvedBooked = approvedRequests
    .filter((request) => String(request.to || request.from || "") >= todayValue)
    .reduce((sum, request) => sum + phase06a1HolidayDaysForYear(request, selectedYear), 0);
  const legacyTaken = legacyHolidayRows
    .filter((record) => String(record.date || "") < todayValue)
    .reduce((sum, record) => sum + (record.dayType === "Half day" ? 0.5 : 1), 0);
  const legacyBooked = legacyHolidayRows
    .filter((record) => String(record.date || "") >= todayValue)
    .reduce((sum, record) => sum + (record.dayType === "Half day" ? 0.5 : 1), 0);
  const pending = pendingRequests.reduce((sum, request) => sum + phase06a1HolidayDaysForYear(request, selectedYear), 0);
  const entitlement = Number(staff.holidayAllowance || 28);
  const taken = approvedTaken + legacyTaken;
  const booked = approvedBooked + legacyBooked + companyBankDays;
  const nextApprovedHoliday = approvedRequests
    .filter((request) => String(request.to || request.from || "") >= todayValue)
    .sort((a, b) => String(a.from || "").localeCompare(String(b.from || "")))[0] || null;
  const attendanceSummary = phase06a4AnnualAttendanceSummary(attendanceRows, selectedYear);

  return {
    ok: true,
    readOnly: true,
    year: selectedYear,
    availableYears: Array.from(allYears).filter(Boolean).sort().reverse(),
    leave: {
      available: true,
      annualEntitlement: entitlement,
      taken,
      booked,
      pending,
      remaining: entitlement - taken - booked,
      nextApprovedHoliday: nextApprovedHoliday ? {
        from: nextApprovedHoliday.from,
        to: nextApprovedHoliday.to,
        workingDays: phase06a1HolidayDaysForYear(nextApprovedHoliday, selectedYear),
        dayType: nextApprovedHoliday.dayType || "Full day",
        dayPart: nextApprovedHoliday.dayPart || ""
      } : null
    },
    attendance: {
      available: attendanceRows.length > 0,
      message: attendanceRows.length ? "" : "No attendance records for this year.",
      ...attendanceSummary,
      history: attendanceRows
        .filter((record) => !phase06a4AttendanceIsVoid(record))
        .map((record) => phase06a4SafeAttendanceRecord(record, selectedYear))
        .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))
    },
    holidayRequests: yearHolidays
      .map((request) => ({
        holidayRequestId: textValue(request.holidayRequestId || request.id),
        from: textValue(request.from),
        to: textValue(request.to),
        workingDays: phase06a1HolidayDaysForYear(request, selectedYear),
        halfDay: request.halfDay === true || request.dayType === "Half day",
        submittedAt: textValue(request.submittedAt || request.submittedDate),
        status: textValue(request.status || "Pending")
      }))
      .sort((a, b) => String(b.submittedAt || b.from).localeCompare(String(a.submittedAt || a.from))),
    notifications: phase06a5TechnicianNotifications(data, staff)
  };
}

function phase06a2GenerateHolidayRequestId() {
  return `HOL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function phase06a5NotificationId(type = "NOTE", relatedEntityId = "") {
  const safeType = textValue(type || "NOTE").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 10) || "NOTE";
  const source = textValue(relatedEntityId || `${safeType}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
  return `NOT-${safeType}-${crypto.createHash("sha1").update(`${safeType}:${source}`).digest("hex").slice(0, 10).toUpperCase()}`;
}

function phase06a5CreateNotification(data, details = {}) {
  const notification = {
    notificationId: phase06a5NotificationId(details.type, details.relatedEntityId),
    type: textValue(details.type || "Information"),
    title: textValue(details.title || "Staff update"),
    message: textValue(details.message || ""),
    createdAt: textValue(details.createdAt || new Date().toISOString()),
    readAt: "",
    status: textValue(details.status || "Unread"),
    staffId: textValue(details.staffId),
    name: textValue(details.name || details.employee),
    employee: textValue(details.employee || details.name),
    relatedEntityType: textValue(details.relatedEntityType),
    relatedEntityId: textValue(details.relatedEntityId)
  };
  data.staffNotifications = Array.isArray(data.staffNotifications) ? data.staffNotifications : [];
  if (!data.staffNotifications.some((item) => textValue(item.notificationId) === notification.notificationId)) {
    data.staffNotifications.unshift(notification);
  }
  return notification;
}

function phase06a5SafeNotification(notification = {}) {
  return {
    notificationId: textValue(notification.notificationId),
    type: textValue(notification.type),
    title: textValue(notification.title),
    message: textValue(notification.message),
    createdAt: textValue(notification.createdAt),
    readAt: textValue(notification.readAt),
    status: notification.readAt ? "Read" : textValue(notification.status || "Unread"),
    relatedEntityType: textValue(notification.relatedEntityType),
    relatedEntityId: textValue(notification.relatedEntityId)
  };
}

function phase06a5TechnicianNotifications(data, staff) {
  return (data.staffNotifications || [])
    .filter((notification) => phase06a1StaffRecordMatches(notification, staff))
    .map(phase06a5SafeNotification)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function phase06a5MarkNotificationsRead(session, payload = {}, markAll = false) {
  const data = readCommandCentreData();
  const staff = phase06a2ResolveStaff(data, session);
  if (!staff) return { status: 404, body: { ok: false, message: "Notifications unavailable." } };
  const notificationId = textValue(payload.notificationId || payload.id);
  const now = new Date().toISOString();
  let changed = 0;
  data.staffNotifications = (data.staffNotifications || []).map((notification) => {
    const belongsToStaff = phase06a1StaffRecordMatches(notification, staff);
    const matchesTarget = markAll || textValue(notification.notificationId) === notificationId;
    if (belongsToStaff && matchesTarget && !notification.readAt) {
      changed += 1;
      return { ...notification, readAt: now, status: "Read" };
    }
    return notification;
  });
  if (!markAll && !changed) return { status: 404, body: { ok: false, message: "Record no longer exists." } };
  phase06a2WriteCommandCentreData(data);
  return { status: 200, body: { ok: true, changed } };
}

function phase06a2WriteCommandCentreData(data) {
  if (Array.isArray(data.vehicles)) {
    data.vehicles = normaliseVehicleCollection(data.vehicles);
  }
  writeJsonSafely(dataFile, `${JSON.stringify(data, null, 2)}\n`, "command-centre-data");
}

function phase06a2ResolveStaff(data, session) {
  return (data.staffProfiles || []).find((profile) => profile.staffId === session.context?.staffId) || null;
}

function phase073aCommunicationTypeForContent(content = {}) {
  const stored = normaliseCommunicationType(content.communicationType);
  if (stored) return stored;
  if (textValue(content.type) === "Toolbox Talk") return TOOLBOX_TALK_COMMUNICATION_TYPE;
  if (textValue(content.type) === "Announcement") return ANNOUNCEMENT_COMMUNICATION_TYPE;
  return "";
}

function phase073aValidateOperationalContentType(content = {}) {
  const communicationType = phase073aCommunicationTypeForContent(content);
  return validateActiveCommunicationType(communicationType);
}

function phase073aValidateToolboxTalkContent(content = {}) {
  const communicationType = phase073aCommunicationTypeForContent(content);
  const validation = validateActiveCommunicationType(communicationType);
  if (!validation.ok) return validation;
  if (validation.definition.communicationType !== TOOLBOX_TALK_COMMUNICATION_TYPE) {
    return { ok: false, reason: "unsupported" };
  }
  return validation;
}

function phase07IssueById(data, issueId) {
  return (data.tscIssueRecords || []).find((issue) => textValue(issue.issueId) === textValue(issueId)) || null;
}

function phase07ContentById(data, contentId) {
  return (data.tscMasterContent || []).find((item) => textValue(item.contentId) === textValue(contentId)) || null;
}

function phase07PublishedById(data, revisionId) {
  return (data.tscPublishedRevisions || []).find((revision) => textValue(revision.revisionId) === textValue(revisionId)) || null;
}

function phase07AssignmentStatus(assignment = {}, issue = {}) {
  if (assignment.completedAt || assignment.completedDateTime || assignment.status === "Completed") return "Completed";
  const dueDate = textValue(assignment.dueDate || issue.dueDate);
  if (dueDate && dueDate < localDateValue()) return "Overdue";
  if (assignment.openedAt || assignment.openedDateTime || assignment.status === "In Progress") return "In Progress";
  if (assignment.receivedAt) return "Received";
  return assignment.status || "Not Started";
}

function phase07SafeToolboxTalk(data, assignment = {}) {
  const issue = phase07IssueById(data, assignment.issueId);
  if (!issue || issue.status !== "Issued") return null;
  const content = phase07ContentById(data, issue.contentId || assignment.contentId);
  if (!content || !phase073aValidateToolboxTalkContent(content).ok) return null;
  const published = phase07PublishedById(data, issue.publishedRevisionId || assignment.publishedRevisionId);
  const snapshot = published?.immutableSnapshot || content || {};
  return {
    assignmentId: textValue(assignment.assignmentId),
    title: textValue(issue.title || snapshot.title),
    issueDate: textValue(issue.issueDate),
    dueDate: textValue(issue.dueDate || assignment.dueDate),
    fullContent: textValue(snapshot.fullContent || content?.fullContent),
    summary: textValue(snapshot.summary || content?.summary),
    revision: textValue(issue.revision || published?.revisionNumber || snapshot.revision),
    status: phase07AssignmentStatus(assignment, issue),
    viewedAt: textValue(assignment.openedAt || assignment.openedDateTime),
    receivedAt: textValue(assignment.receivedAt),
    completedAt: textValue(assignment.completedAt || assignment.completedDateTime),
    sender: textValue(issue.issuedBy || content.author || published?.publishedBy),
    sentAt: textValue(assignment.sentAt || assignment.assignedDateTime || issue.issuedAt || issue.issueDate),
    dailyReminder: issue.dailyReminder !== false,
    lastReminderDate: textValue(assignment.lastReminderDate)
  };
}

function phase07MarkToolboxTalksReceived(data, assignments = []) {
  const now = new Date().toISOString();
  let changed = 0;
  assignments.forEach(({ index, assignment }) => {
    if (!assignment.receivedAt) {
      data.tscAssignmentRecords[index] = {
        ...assignment,
        receivedAt: now,
        updatedAt: now
      };
      changed += 1;
    }
  });
  if (changed) phase06a2WriteCommandCentreData(data);
  return changed;
}

function phase07BuildTechnicianToolboxTalks(session, options = {}) {
  const data = readCommandCentreData();
  const staffId = textValue(session.context?.staffId);
  const matchedAssignments = (data.tscAssignmentRecords || [])
    .map((assignment, index) => {
      if (textValue(assignment.staffId || assignment.employeeId) !== staffId) return null;
      const safe = phase07SafeToolboxTalk(data, assignment);
      return safe ? { index, assignment } : null;
    })
    .filter(Boolean);
  if (options.markReceived) {
    phase07MarkToolboxTalksReceived(data, matchedAssignments);
  }
  const freshData = options.markReceived ? readCommandCentreData() : data;
  const talks = matchedAssignments
    .map(({ assignment }) => (freshData.tscAssignmentRecords || []).find((item) => textValue(item.assignmentId) === textValue(assignment.assignmentId)) || assignment)
    .map((assignment) => phase07SafeToolboxTalk(freshData, assignment))
    .filter(Boolean)
    .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
  const actionRequired = talks.filter((talk) => talk.status !== "Completed");
  return {
    ok: true,
    actionRequired,
    completed: talks.filter((talk) => talk.status === "Completed"),
    reminder: actionRequired.find((talk) => talk.dailyReminder && talk.status !== "Completed") || null
  };
}

function phase073bAnnouncementExpiry(issue = {}, content = {}) {
  return textValue(issue.expiresAt || issue.expiryDate || issue.dueDate || content.reviewDate).slice(0, 10);
}

function phase073bAnnouncementIsActive(issue = {}, content = {}) {
  if (!issue || issue.status !== "Issued") return false;
  if (!content || phase073aCommunicationTypeForContent(content) !== ANNOUNCEMENT_COMMUNICATION_TYPE) return false;
  const publishedDate = textValue(issue.issueDate || content.effectiveDate).slice(0, 10);
  const expiryDate = phase073bAnnouncementExpiry(issue, content);
  const todayValue = localDateValue();
  if (publishedDate && publishedDate > todayValue) return false;
  if (expiryDate && expiryDate < todayValue) return false;
  return phase073aValidateOperationalContentType(content).ok;
}

function phase073bSafeAnnouncement(data, assignment = {}) {
  const issue = phase07IssueById(data, assignment.issueId);
  const content = phase07ContentById(data, issue?.contentId || assignment.contentId);
  if (!phase073bAnnouncementIsActive(issue, content)) return null;
  const acknowledgementRequired = issue.acknowledgementRequired === true || assignment.acknowledgementRequired === true;
  const completed = assignment.completedAt || assignment.completedDateTime || assignment.status === "Completed";
  const viewedAt = textValue(assignment.viewedAt || assignment.openedAt || assignment.openedDateTime);
  const receivedAt = textValue(assignment.receivedAt);
  return {
    assignmentId: textValue(assignment.assignmentId),
    title: textValue(issue.title || content.title || "Announcement"),
    message: textValue(content.fullContent || content.message || content.summary),
    summary: textValue(content.summary),
    issueDate: textValue(issue.issueDate || content.effectiveDate),
    publishedDate: textValue(content.effectiveDate || issue.issueDate),
    expiryDate: phase073bAnnouncementExpiry(issue, content),
    acknowledgementRequired,
    viewedAt,
    receivedAt,
    status: completed ? "Acknowledged" : viewedAt ? "Viewed" : receivedAt ? "Received" : "Sent",
    completedAt: textValue(assignment.completedAt || assignment.completedDateTime),
    author: textValue(content.author || issue.issuedBy),
    sender: textValue(issue.issuedBy || content.author),
    sentAt: textValue(assignment.sentAt || assignment.assignedDateTime || issue.issuedAt || issue.issueDate),
    notes: textValue(issue.notes)
  };
}

function phase073bMarkAnnouncementsReceived(data, assignments = [], session) {
  const now = new Date().toISOString();
  let changed = 0;
  assignments.forEach(({ index, assignment, issue, content }) => {
    if (!assignment.receivedAt && phase073bAnnouncementIsActive(issue, content)) {
      data.tscAssignmentRecords[index] = {
        ...assignment,
        receivedAt: now,
        updatedAt: now
      };
      changed += 1;
    }
  });
  if (changed) {
    phase06a2WriteCommandCentreData(data);
  }
  return changed;
}

function phase073bBuildTechnicianAnnouncements(session, options = {}) {
  const data = readCommandCentreData();
  const staffId = textValue(session.context?.staffId);
  const matchedAssignments = (data.tscAssignmentRecords || [])
    .map((assignment, index) => {
      if (textValue(assignment.staffId || assignment.employeeId) !== staffId) return null;
      const issue = phase07IssueById(data, assignment.issueId);
      const content = phase07ContentById(data, issue?.contentId || assignment.contentId);
      return { index, assignment, issue, content };
    })
    .filter(Boolean)
    .filter(({ issue, content }) => phase073bAnnouncementIsActive(issue, content));
  if (options.markReceived) {
    phase073bMarkAnnouncementsReceived(data, matchedAssignments, session);
  }
  const freshData = options.markReceived ? readCommandCentreData() : data;
  const announcements = matchedAssignments
    .map(({ assignment }) => (freshData.tscAssignmentRecords || []).find((item) => textValue(item.assignmentId) === textValue(assignment.assignmentId)) || assignment)
    .map((assignment) => phase073bSafeAnnouncement(freshData, assignment))
    .filter(Boolean)
    .sort((a, b) => String(b.issueDate || "").localeCompare(String(a.issueDate || "")));
  return {
    ok: true,
    active: announcements,
    actionRequired: announcements.filter((announcement) => announcement.acknowledgementRequired && announcement.status !== "Acknowledged"),
    completed: announcements.filter((announcement) => announcement.status === "Acknowledged")
  };
}

function phase073bActionSummaryAnnouncements(session) {
  const payload = phase073bBuildTechnicianAnnouncements(session);
  const outstanding = payload.actionRequired || [];
  return {
    count: outstanding.length,
    overdue: 0,
    dueToday: outstanding.filter((announcement) => textValue(announcement.expiryDate) === localDateValue()).length,
    actionLabel: "View Announcements",
    target: "announcements"
  };
}

function phase07ActionSummaryToolbox(session) {
  const payload = phase07BuildTechnicianToolboxTalks(session);
  const outstanding = payload.actionRequired || [];
  return {
    count: outstanding.length,
    overdue: outstanding.filter((talk) => talk.status === "Overdue").length,
    dueToday: outstanding.filter((talk) => talk.status !== "Overdue" && textValue(talk.dueDate) === localDateValue()).length,
    actionLabel: "View Toolbox Talks",
    target: "training"
  };
}

function phase07CompletedTime(record = {}) {
  return textValue(
    record.completedAt
    || record.completedDateTime
    || record.completedDate
    || record.submittedAt
    || record.submittedDate
    || record.updatedAt
    || record.lastUpdated
  );
}

function phase07RecentToolboxActivity(session) {
  const payload = phase07BuildTechnicianToolboxTalks(session);
  return (payload.completed || [])
    .map((talk) => ({
      activityId: textValue(talk.assignmentId),
      type: "toolboxTalkAcknowledged",
      title: textValue(talk.title || "Toolbox Talk"),
      actionLabel: "Toolbox Talk Acknowledged",
      completedAt: phase07CompletedTime(talk),
      target: "training"
    }))
    .filter((item) => item.activityId && item.completedAt);
}

function phase073bRecentAnnouncementActivity(session) {
  const payload = phase073bBuildTechnicianAnnouncements(session);
  return (payload.completed || [])
    .map((announcement) => ({
      activityId: textValue(announcement.assignmentId),
      type: "announcementAcknowledged",
      title: textValue(announcement.title || "Announcement"),
      actionLabel: "Announcement Acknowledged",
      completedAt: phase07CompletedTime(announcement),
      target: "announcements"
    }))
    .filter((item) => item.activityId && item.completedAt);
}

function phase07ReportNeedsAction(job = {}) {
  const status = textValue(job.status).toLowerCase();
  if (!job.jobDate || job.jobDate > localDateValue()) return false;
  if (["completed", "completed - report submitted", "report submitted", "cancelled", "cancelled by office"].includes(status)) return false;
  if (job.completedAt || job.reportId) return false;
  return true;
}

function phase07ActionSummaryReports(session) {
  const technicianId = textValue(session.context?.technicianId);
  const staffId = textValue(session.context?.staffId);
  const data = readCommandCentreData();
  const hubJobs = (data.jobs || []).filter((job) =>
    textValue(job.assignedTechnicianId || job.technicianId) === technicianId
    || textValue(job.staffId || job.assignedStaffId) === staffId
  );
  const outstanding = hubJobs.filter(phase07ReportNeedsAction);
  return {
    count: outstanding.length,
    overdue: outstanding.filter((job) => textValue(job.jobDate) < localDateValue()).length,
    dueToday: outstanding.filter((job) => textValue(job.jobDate) === localDateValue()).length,
    actionLabel: "Complete Reports",
    target: "jobs"
  };
}

function phase07InspectionRecordStatus(record = {}) {
  return textValue(record.status || record.inspectionStatus || record.result).toLowerCase();
}

function phase07InspectionRecordDueDate(record = {}) {
  return textValue(record.dueDate || record.nextInspectionDue || record.inspectionDue || record.dateDue || record.scheduledDate).slice(0, 10);
}

function phase07InspectionComplete(record = {}) {
  const status = phase07InspectionRecordStatus(record);
  return ["completed", "complete", "submitted", "passed", "cancelled", "void", "not required"].includes(status)
    || Boolean(record.completedAt || record.submittedAt || record.completedDate || record.submittedDate);
}

function phase07InspectionBelongsToSession(record = {}, session, staff = {}) {
  const context = session.context || {};
  const assignedVehicle = findActiveVehicleAssignment(readCommandCentreData().vehicles || [], context.technicianId, context.staffId);
  const authorisedVehicleIds = new Set([
    assignedVehicle?.vehicleId,
    phase05bSourceRecords.technician?.assignedVehicleId,
    staff.vehicleId,
    staff.assignedVehicleId,
    staff.assignedVan,
    staff.van
  ].map(textValue).filter(Boolean));
  const recordVehicle = textValue(record.vehicleId || record.assignedVehicleId || record.vehicle || record.registration || record.van);
  if (textValue(record.staffId || record.employeeId) && textValue(record.staffId || record.employeeId) === textValue(context.staffId)) return true;
  if (textValue(record.technicianId) && textValue(record.technicianId) === textValue(context.technicianId)) return true;
  if (recordVehicle && authorisedVehicleIds.has(recordVehicle)) return true;
  return false;
}

function phase07ActionSummaryVehicleInspections(session) {
  const data = readCommandCentreData();
  const assignedVehicle = findActiveVehicleAssignment(data.vehicles || [], session.context?.technicianId, session.context?.staffId);
  const state = vehicleWeeklyCheckState({
    assignedVehicle,
    records: data.vehicleInspectionRecords || []
  });
  return {
    count: state.count,
    overdue: state.overdue,
    dueToday: state.dueToday,
    actionLabel: "Complete Vehicle Check",
    target: "vehicle-inspections",
    status: state.status,
    inspectionWeekStart: state.inspectionWeekStart || "",
    vehicleId: assignedVehicle?.vehicleId || ""
  };
}

function phase07RecentVehicleInspectionActivity(session) {
  const data = readCommandCentreData();
  const staff = (data.staffProfiles || []).find((profile) => textValue(profile.staffId) === textValue(session.context?.staffId)) || {};
  const inspectionRows = [
    ...(Array.isArray(data.vehicleInspectionRecords) ? data.vehicleInspectionRecords : []),
    ...(Array.isArray(data.vehicleInspections) ? data.vehicleInspections : []),
    ...(Array.isArray(data.inspectionRecords) ? data.inspectionRecords : [])
  ];
  return inspectionRows
    .filter((record) => phase07InspectionComplete(record) && phase07InspectionBelongsToSession(record, session, staff))
    .map((record) => ({
      activityId: textValue(record.inspectionId || record.vehicleInspectionId || record.id),
      type: "vehicleInspectionCompleted",
      title: textValue(record.title || record.inspectionTitle || record.vehicleName || record.registration || "Vehicle Inspection"),
      actionLabel: "Vehicle Inspection Completed",
      completedAt: phase07CompletedTime(record),
      target: "vehicle-inspections"
    }))
    .filter((item) => item.activityId && item.completedAt);
}

function phase07RecentReportActivity(session) {
  const technicianId = textValue(session.context?.technicianId);
  const staffId = textValue(session.context?.staffId);
  return Array.from(phase05dReportSubmissions.values())
    .filter((report) =>
      textValue(report.technicianId) === technicianId
      || textValue(report.staffId) === staffId
    )
    .map((report) => ({
      activityId: textValue(report.reportId),
      type: "reportSubmitted",
      title: textValue(report.jobTitle || report.reportTitle || report.jobReference || "Pest Control Report"),
      actionLabel: "Report Submitted",
      completedAt: phase07CompletedTime(report),
      target: "jobs"
    }))
    .filter((item) => item.activityId && item.completedAt);
}

function phase07RecentActivity(session) {
  const activityTime = (item) => {
    const parsed = Date.parse(textValue(item.completedAt));
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const unique = new Map();
  [
    ...phase07RecentToolboxActivity(session),
    ...phase073bRecentAnnouncementActivity(session),
    ...phase07RecentVehicleInspectionActivity(session),
    ...phase07RecentReportActivity(session)
  ].forEach((item) => {
    const key = `${textValue(item.type)}:${textValue(item.activityId)}`;
    if (key !== ":" && !unique.has(key)) unique.set(key, item);
  });
  return Array.from(unique.values())
    .sort((a, b) => activityTime(b) - activityTime(a))
    .slice(0, 6);
}

function phase07TechnicianActionSummary(session) {
  const categories = {
    toolboxTalks: phase07ActionSummaryToolbox(session),
    announcements: phase073bActionSummaryAnnouncements(session),
    vehicleInspections: phase07ActionSummaryVehicleInspections(session),
    reports: phase07ActionSummaryReports(session)
  };
  const total = Object.values(categories).reduce((sum, item) => sum + Number(item.count || 0), 0);
  return {
    ok: true,
    technician: {
      userId: textValue(session.context?.userId),
      staffId: textValue(session.context?.staffId),
      technicianId: textValue(session.context?.technicianId)
    },
    generatedAt: new Date().toISOString(),
    total,
    hasActions: total > 0,
    categories,
    recentActivity: phase07RecentActivity(session)
  };
}

function phase073bAnnouncementAssignment(data, session, assignmentId) {
  const staffId = textValue(session.context?.staffId);
  const index = (data.tscAssignmentRecords || []).findIndex((assignment) => textValue(assignment.assignmentId) === textValue(assignmentId));
  if (index < 0) return { error: { status: 404, body: { ok: false, message: "Announcement not found." } } };
  const assignment = data.tscAssignmentRecords[index];
  if (textValue(assignment.staffId || assignment.employeeId) !== staffId) {
    return { error: { status: 403, body: { ok: false, message: "This announcement is not assigned to you." } } };
  }
  const issue = phase07IssueById(data, assignment.issueId);
  const content = phase07ContentById(data, issue?.contentId || assignment.contentId);
  if (!phase073bAnnouncementIsActive(issue, content)) {
    return { error: { status: 404, body: { ok: false, message: "Announcement is no longer active." } } };
  }
  return { index, assignment, issue, content };
}

function phase073bViewAnnouncement(session, payload = {}) {
  const data = readCommandCentreData();
  const resolved = phase073bAnnouncementAssignment(data, session, textValue(payload.assignmentId));
  if (resolved.error) return resolved.error;
  const { index, assignment, issue, content } = resolved;
  const now = new Date().toISOString();
  if (!assignment.viewedAt && !assignment.openedAt && !assignment.openedDateTime) {
    const acknowledgementRequired = issue.acknowledgementRequired === true || assignment.acknowledgementRequired === true;
    data.tscAssignmentRecords[index] = {
      ...assignment,
      status: acknowledgementRequired ? "In Progress" : "Viewed",
      viewedAt: now,
      openedAt: assignment.openedAt || now,
      openedDateTime: assignment.openedDateTime || now,
      updatedAt: now
    };
    phase07AuditEvent(data, "Announcement Viewed", { ...issue, title: issue.title || content.title, assignmentId: assignment.assignmentId }, session, "Technician opened announcement.");
    phase06a2WriteCommandCentreData(data);
  }
  return { status: 200, body: { ok: true, announcements: phase073bBuildTechnicianAnnouncements(session) } };
}

function phase073bAcknowledgeAnnouncement(session, payload = {}) {
  const data = readCommandCentreData();
  const resolved = phase073bAnnouncementAssignment(data, session, textValue(payload.assignmentId));
  if (resolved.error) return resolved.error;
  const { index, assignment, issue, content } = resolved;
  const acknowledgementRequired = issue.acknowledgementRequired === true || assignment.acknowledgementRequired === true;
  if (!acknowledgementRequired) return { status: 400, body: { ok: false, message: "This announcement does not require acknowledgement." } };
  if (assignment.completedAt || assignment.completedDateTime || assignment.status === "Completed") {
    return { status: 409, body: { ok: false, message: "This announcement has already been acknowledged." } };
  }
  const now = new Date().toISOString();
  data.tscAssignmentRecords[index] = {
    ...assignment,
    status: "Completed",
    viewedAt: assignment.viewedAt || now,
    openedAt: assignment.openedAt || now,
    openedDateTime: assignment.openedDateTime || now,
    completedAt: now,
    completedDateTime: now,
    updatedAt: now
  };
  phase07AuditEvent(data, "Announcement Acknowledged", { ...issue, title: issue.title || content.title, assignmentId: assignment.assignmentId }, session, "Technician acknowledged announcement.");
  phase06a2WriteCommandCentreData(data);
  return {
    status: 200,
    body: {
      ok: true,
      message: "Announcement acknowledged.",
      announcements: phase073bBuildTechnicianAnnouncements(session)
    }
  };
}

function phase07AuditEvent(data, action, record, session, notes = "") {
  const now = new Date().toISOString();
  const event = {
    auditEventId: `AUD-${now.slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    dateTime: now,
    user: session.context?.fullName || session.selectedName || "Technician",
    role: "Technician",
    module: "Training, Safety & Compliance",
    action,
    affectedRecord: record.title || record.documentId || "Toolbox Talk",
    recordId: record.assignmentId || record.issueId || record.evidenceId || "",
    previousValue: null,
    newValue: record,
    notes
  };
  data.universalAuditEvents = Array.isArray(data.universalAuditEvents) ? data.universalAuditEvents : [];
  data.universalAuditEvents.unshift(event);
  return event.auditEventId;
}

function phase07ViewToolboxTalk(session, payload = {}) {
  const data = readCommandCentreData();
  const staffId = textValue(session.context?.staffId);
  const assignmentId = textValue(payload.assignmentId);
  const index = (data.tscAssignmentRecords || []).findIndex((assignment) => textValue(assignment.assignmentId) === assignmentId);
  if (index < 0) return { status: 404, body: { ok: false, message: "Toolbox Talk not found." } };
  const assignment = data.tscAssignmentRecords[index];
  if (textValue(assignment.staffId || assignment.employeeId) !== staffId) return { status: 403, body: { ok: false, message: "This Toolbox Talk is not assigned to you." } };
  const issue = phase07IssueById(data, assignment.issueId);
  if (!issue) return { status: 404, body: { ok: false, message: "Toolbox Talk issue not found." } };
  const content = phase07ContentById(data, issue.contentId);
  if (!content || !phase073aValidateToolboxTalkContent(content).ok) {
    return { status: 400, body: { ok: false, message: "Toolbox Talk is unavailable." } };
  }
  if (!assignment.openedAt && !assignment.openedDateTime) {
    const now = new Date().toISOString();
    data.tscAssignmentRecords[index] = {
      ...assignment,
      receivedAt: assignment.receivedAt || now,
      openedAt: now,
      openedDateTime: now,
      status: assignment.status === "Not Started" ? "In Progress" : assignment.status,
      updatedAt: now
    };
    phase07AuditEvent(data, "Toolbox Talk Viewed", { ...issue, assignmentId }, session, "Technician opened Toolbox Talk.");
    phase06a2WriteCommandCentreData(data);
  }
  return { status: 200, body: { ok: true, toolboxTalks: phase07BuildTechnicianToolboxTalks(session) } };
}

function phase07AcknowledgeToolboxTalk(session, payload = {}) {
  const data = readCommandCentreData();
  const staffId = textValue(session.context?.staffId);
  const assignmentId = textValue(payload.assignmentId);
  const index = (data.tscAssignmentRecords || []).findIndex((assignment) => textValue(assignment.assignmentId) === assignmentId);
  if (index < 0) return { status: 404, body: { ok: false, message: "Toolbox Talk not found." } };
  const assignment = data.tscAssignmentRecords[index];
  if (textValue(assignment.staffId || assignment.employeeId) !== staffId) return { status: 403, body: { ok: false, message: "This Toolbox Talk is not assigned to you." } };
  if (assignment.completedAt || assignment.completedDateTime || assignment.status === "Completed") {
    return { status: 409, body: { ok: false, message: "This Toolbox Talk has already been acknowledged." } };
  }
  const issue = phase07IssueById(data, assignment.issueId);
  if (!issue) return { status: 404, body: { ok: false, message: "Toolbox Talk issue not found." } };
  const content = phase07ContentById(data, issue.contentId);
  if (!content || !phase073aValidateToolboxTalkContent(content).ok) {
    return { status: 400, body: { ok: false, message: "Toolbox Talk is unavailable." } };
  }
  const published = phase07PublishedById(data, issue.publishedRevisionId);
  const now = new Date().toISOString();
  const evidence = {
    evidenceId: `TSC-EVD-${now.slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    assignmentId,
    issueId: issue.issueId,
    employeeId: staffId,
    evidenceType: "Acknowledgement",
    evidenceStatus: "Accepted",
    createdDateTime: now,
    submittedDateTime: now,
    completionMethod: "Technician App",
    result: "Acknowledged",
    passFail: "Pass",
    acknowledgementText: `I acknowledge that I have read and understood ${issue.title || content?.title || "this Toolbox Talk"}.`,
    appVersion: textValue(payload.appVersion),
    deviceInformation: textValue(payload.deviceInformation),
    authenticatedUserId: textValue(session.context?.userId),
    sourceSystem: "Technician App",
    publishedRevisionId: textValue(issue.publishedRevisionId || published?.revisionId),
    contentSnapshotReference: textValue(published?.revisionId || issue.publishedRevisionId),
    auditEventId: ""
  };
  const auditId = phase07AuditEvent(data, "Toolbox Talk Acknowledged", { ...evidence, title: issue.title, assignmentId }, session, "Technician acknowledged Toolbox Talk.");
  evidence.auditEventId = auditId;
  data.tscEvidenceRecords = Array.isArray(data.tscEvidenceRecords) ? data.tscEvidenceRecords : [];
  data.tscEvidenceRecords.unshift(evidence);
  data.tscAssignmentRecords[index] = {
    ...assignment,
    status: "Completed",
    openedAt: assignment.openedAt || now,
    openedDateTime: assignment.openedDateTime || now,
    completedAt: now,
    completedDateTime: now,
    updatedAt: now
  };
  phase07AuditEvent(data, "Toolbox Talk Completed", { ...issue, assignmentId }, session, "Assignment completed by acknowledgement.");
  phase06a2WriteCommandCentreData(data);
  return {
    status: 200,
    body: {
      ok: true,
      message: "Toolbox Talk acknowledged.",
      toolboxTalks: phase07BuildTechnicianToolboxTalks(session)
    }
  };
}

function phase06a2RequestedWorkingDays(from, to, halfDay) {
  const dates = phase06a1WorkingDateRangeValues(from, to);
  if (halfDay === true) {
    return from === to && dates.length === 1 ? 0.5 : 0;
  }
  return dates.length;
}

function phase06a2DateRangesOverlap(aFrom, aTo, bFrom, bTo) {
  if (!aFrom || !aTo || !bFrom || !bTo) return false;
  return String(aFrom) <= String(bTo) && String(bFrom) <= String(aTo);
}

function phase06a2SubmitHolidayRequest(session, payload = {}) {
  const data = readCommandCentreData();
  const staff = phase06a2ResolveStaff(data, session);
  if (!staff) {
    return { status: 404, body: { ok: false, message: "Holiday information unavailable." } };
  }

  const from = textValue(payload.from || payload.startDate);
  const to = textValue(payload.to || payload.endDate);
  const halfDay = payload.halfDay === true || payload.halfDay === "true";
  const note = textValue(payload.note || payload.technicianNote).slice(0, 1000);
  const todayValue = localDateValue();
  const errors = [];

  if (!from) errors.push("Start date missing.");
  if (!to) errors.push("End date missing.");
  if ((from && from < todayValue) || (to && to < todayValue)) errors.push("Holiday requests cannot be submitted for dates in the past.");
  if (from && to && to < from) errors.push("End date cannot be before start date.");
  if (halfDay && from && to && from !== to) errors.push("Half day requests must use the same start and end date.");

  const workingDays = phase06a2RequestedWorkingDays(from, to, halfDay);
  if (from && to && workingDays <= 0) errors.push("Holiday request must include at least one working day.");

  const existingRequests = (data.holidayRequests || []).filter((request) => phase06a1StaffRecordMatches(request, staff));
  const overlap = existingRequests.find((request) => {
    const status = phase06a1HolidayStatus(request);
    if (!["pending", "approved"].includes(status)) return false;
    return phase06a2DateRangesOverlap(from, to, request.from, request.to);
  });
  if (overlap) errors.push("Request overlaps existing pending or approved leave.");

  const leaveSummary = phase06a1BuildLeaveAttendance(session, String(from || to || new Date().getFullYear()).slice(0, 4));
  const exceedsEntitlement = workingDays > Number(leaveSummary.leave?.remaining || 0);

  if (errors.length) {
    return {
      status: 400,
      body: {
        ok: false,
        message: errors.join(" "),
        errors
      }
    };
  }

  const now = new Date().toISOString();
  const request = {
    holidayRequestId: phase06a2GenerateHolidayRequestId(),
    staffId: staff.staffId,
    name: staff.name,
    employee: staff.name,
    year: String(from).slice(0, 4),
    from,
    to,
    days: workingDays,
    workingDays,
    dayType: halfDay ? "Half day" : "Full day",
    halfDay,
    technicianNote: note,
    notes: note,
    submittedAt: now,
    submittedDate: now.slice(0, 10),
    status: "Pending",
    createdBy: "Technician",
    createdByUserId: session.context.userId,
    createdByTechnicianId: session.context.technicianId,
    auditTrail: [
      {
        action: "Created",
        by: "Technician",
        userId: session.context.userId,
        at: now
      }
    ]
  };

  data.holidayRequests = [...(data.holidayRequests || []), request];
  phase06a5CreateNotification(data, {
    type: "Holiday Request Submitted",
    title: "Holiday request submitted",
    message: `${staff.name} submitted annual leave for ${from} to ${to}.`,
    staffId: staff.staffId,
    name: staff.name,
    relatedEntityType: "HolidayRequest",
    relatedEntityId: request.holidayRequestId,
    status: "Pending"
  });
  phase06a2WriteCommandCentreData(data);

  return {
    status: 200,
    body: {
      ok: true,
      request: {
        holidayRequestId: request.holidayRequestId,
        from: request.from,
        to: request.to,
        workingDays: request.workingDays,
        halfDay: request.halfDay,
        note: request.technicianNote,
        submittedAt: request.submittedAt,
        status: request.status
      },
      exceedsEntitlement
    }
  };
}

function phase06a2CancelHolidayRequest(session, payload = {}) {
  const data = readCommandCentreData();
  const staff = phase06a2ResolveStaff(data, session);
  if (!staff) {
    return { status: 404, body: { ok: false, message: "Holiday information unavailable." } };
  }
  const requestId = textValue(payload.holidayRequestId || payload.id);
  const index = (data.holidayRequests || []).findIndex((request) =>
    phase06a1StaffRecordMatches(request, staff)
    && textValue(request.holidayRequestId || request.id) === requestId
  );
  if (index < 0) {
    return { status: 404, body: { ok: false, message: "Holiday request not found." } };
  }
  const request = data.holidayRequests[index];
  if (phase06a1HolidayStatus(request) !== "pending") {
    return { status: 400, body: { ok: false, message: "Only pending holiday requests can be cancelled." } };
  }
  const now = new Date().toISOString();
  data.holidayRequests[index] = {
    ...request,
    status: "Cancelled",
    cancelledAt: now,
    cancelledBy: "Technician",
    auditTrail: [
      ...(Array.isArray(request.auditTrail) ? request.auditTrail : []),
      {
        action: "Cancelled",
        by: "Technician",
        userId: session.context.userId,
        at: now
      }
    ]
  };
  phase06a2WriteCommandCentreData(data);
  return {
    status: 200,
    body: {
      ok: true,
      request: {
        holidayRequestId: requestId,
        status: "Cancelled"
      }
    }
  };
}

function phase05eHubReportStatus() {
  const completedReports = Array.from(phase05dReportSubmissions.values()).map((report) => ({
    jobId: report.jobId,
    jobReference: report.jobReference,
    jobDate: report.jobDate,
    slot: report.slot,
    clientName: report.clientName,
    jobTitle: report.jobTitle,
    siteName: report.siteName,
    address: report.address,
    postcode: report.postcode,
    technician: report.technician,
    technicianId: report.technicianId,
    staffId: report.staffId,
    reportId: report.reportId,
    submittedAt: report.submittedAt,
    recommendations: report.recommendations,
    photoCount: report.photoCount,
    oneDriveFolder: report.oneDriveFolder,
    status: "Completed - Report Submitted"
  }));

  return {
    ok: true,
    phase: "Phase 5E",
    readOnly: true,
    completedReports
  };
}

function pathInside(parentPath, childPath) {
  const parent = path.resolve(parentPath).toLowerCase();
  const child = path.resolve(childPath).toLowerCase();
  const relative = path.relative(parent, child);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function phase05eTestLaunchResponse(executable, args) {
  return {
    status: 200,
    body: {
      ok: true,
      validated: true,
      launchAccepted: true,
      launchSuppressed: true,
      launch: {
        executable,
        args
      }
    }
  };
}

function launchExplorerForFolder(folderPath) {
  const executable = process.env.PHASE05E_EXPLORER_EXECUTABLE || "explorer.exe";
  const args = [folderPath];

  if (process.env.PHASE05E_DISABLE_FOLDER_LAUNCH === "1") {
    return Promise.resolve(phase05eTestLaunchResponse(executable, args));
  }

  const effectivePlatform = process.env.PHASE05E_FORCE_PLATFORM || process.platform;
  if (effectivePlatform !== "win32") {
    return Promise.resolve({
      status: 501,
      body: {
        ok: false,
        code: "folder_opening_requires_windows",
        message: "Unable to open the OneDrive folder."
      }
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const child = execFile(executable, args, {
      windowsHide: false,
      shell: false,
      timeout: 3000,
      maxBuffer: 1024 * 32
    }, (error, stdout, stderr) => {
      if (!error) return;
      finish({
        status: 500,
        body: {
          ok: false,
          code: "folder_open_failed",
          message: "Unable to open the OneDrive folder.",
          detail: textValue(error.message),
          exitCode: error.code ?? null,
          stderr: textValue(stderr).slice(0, 500)
        }
      });
    });

    child.once("spawn", () => {
      finish({
        status: 200,
        body: {
          ok: true,
          validated: true,
          launchAccepted: true,
          executable,
          argumentCount: args.length
        }
      });
    });

    child.once("error", (error) => {
      finish({
        status: 500,
        body: {
          ok: false,
          code: "folder_open_failed",
          message: "Unable to open the OneDrive folder.",
          detail: textValue(error.message)
        }
      });
    });
  });
}

async function phase05eOpenReportFolder(payload = {}) {
  if (payload.oneDriveFolder || payload.folder || payload.path || payload.filePath) {
    return {
      status: 400,
      body: {
        ok: false,
        code: "browser_path_rejected",
        message: "Unable to open the OneDrive folder."
      }
    };
  }

  const reportId = textValue(payload.reportId);
  if (!reportId) {
    return {
      status: 400,
      body: {
        ok: false,
        code: "report_id_required",
        message: "Unable to open the OneDrive folder."
      }
    };
  }

  const report = phase05dReportSubmissions.get(reportId);
  if (!report) {
    return {
      status: 404,
      body: {
        ok: false,
        code: "report_not_found",
        message: "Unable to open the OneDrive folder."
      }
    };
  }

  const recordedFolder = textValue(report.oneDriveFolder);
  if (!recordedFolder) {
    return {
      status: 404,
      body: {
        ok: false,
        code: "report_folder_missing",
        message: "Unable to open the OneDrive folder."
      }
    };
  }

  const resolvedFolder = path.resolve(recordedFolder);
  const resolvedRoot = path.resolve(fieldReportsRootDir);
  if (!pathInside(resolvedRoot, resolvedFolder)) {
    return {
      status: 403,
      body: {
        ok: false,
        code: "report_folder_outside_approved_root",
        message: "Unable to open the OneDrive folder."
      }
    };
  }

  if (!fs.existsSync(resolvedFolder) || !fs.statSync(resolvedFolder).isDirectory()) {
    return {
      status: 404,
      body: {
        ok: false,
        code: "report_folder_not_found",
        message: "Unable to open the OneDrive folder."
      }
    };
  }

  return launchExplorerForFolder(resolvedFolder);
}

function sendJson(response, status, payload, headers = jsonHeaders) {
  response.writeHead(status, { ...headers, "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function textValue(value) {
  return String(value ?? "").trim();
}

function phase05ePublicReportMetadata(report) {
  return {
    reportId: textValue(report.reportId),
    jobId: textValue(report.jobId),
    jobReference: textValue(report.jobReference),
    jobDate: textValue(report.jobDate),
    slot: textValue(report.slot),
    clientName: textValue(report.clientName),
    jobTitle: textValue(report.jobTitle),
    siteName: textValue(report.siteName),
    address: textValue(report.address),
    postcode: textValue(report.postcode),
    technician: textValue(report.technician),
    technicianId: textValue(report.technicianId),
    staffId: textValue(report.staffId),
    submittedAt: textValue(report.submittedAt),
    recommendations: textValue(report.recommendations),
    photoCount: Number(report.photoCount || 0),
    oneDriveFolder: textValue(report.oneDriveFolder),
    status: "Completed - Report Submitted"
  };
}

function persistPhase05eReportMetadata() {
  const payload = {
    schema: "kingswood.phase05e.completedReportMetadata.v1",
    updatedAt: new Date().toISOString(),
    reports: Array.from(phase05dReportSubmissions.values()).map(phase05ePublicReportMetadata)
  };
  writeJsonSafely(completedReportMetadataFile, JSON.stringify(payload, null, 2), "completed-report-metadata");
}

function restorePhase05eCompletedJobState(report) {
  const job = (phase05bSourceRecords.jobs || []).find((item) => {
    return (report.jobId && item.jobId === report.jobId) || (report.jobReference && item.jobReference === report.jobReference);
  });
  if (!job) return false;
  job.status = "Completed";
  job.completedAt = report.submittedAt || job.completedAt || new Date().toISOString();
  job.reportId = report.reportId || job.reportId;
  return true;
}

function parseLegacyFieldReportText(reportText) {
  const valueAfter = (label) => {
    const match = String(reportText || "").match(new RegExp(`^${label}:\\s*(.+)$`, "mi"));
    return textValue(match?.[1]);
  };
  const recommendations = String(reportText || "").split(/RECOMMENDATIONS\s*-+/i)[1]?.split(/Photos Uploaded:/i)[0] || "";
  return {
    jobTitle: valueAfter("Job"),
    technician: valueAfter("Tech"),
    address: valueAfter("Address"),
    clientName: valueAfter("Client"),
    jobDate: valueAfter("Date"),
    photoCount: Number(valueAfter("Photos Uploaded") || 0),
    submittedAt: valueAfter("Submitted"),
    recommendations: textValue(recommendations)
  };
}

function legacyReportMatchScore(job, legacyReport) {
  let score = 0;
  const reportAddress = legacyReport.address.toLowerCase();
  if (legacyReport.jobTitle && textValue(job.jobTitle).toLowerCase() === legacyReport.jobTitle.toLowerCase()) score += 2;
  if (legacyReport.clientName && textValue(job.clientName).toLowerCase() === legacyReport.clientName.toLowerCase()) score += 2;
  if (legacyReport.technician && /ian d|ian dickens/i.test(legacyReport.technician) && job.assignedTechnicianId === phase05bPilotContext.technicianId) score += 2;
  if (job.postcode && reportAddress.includes(textValue(job.postcode).toLowerCase())) score += 2;
  if (job.address && reportAddress.includes(textValue(job.address).toLowerCase().split(",")[0])) score += 1;
  return score;
}

function recoverPhase05eMetadataFromOneDriveFallback() {
  if (!fs.existsSync(fieldReportsRootDir)) return { recovered: 0, skipped: 0 };
  let recovered = 0;
  let skipped = 0;
  const folders = fs.readdirSync(fieldReportsRootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(fieldReportsRootDir, entry.name));

  folders.forEach((folder) => {
    const reportFile = path.join(folder, "REPORT.txt");
    if (!fs.existsSync(reportFile)) return;
    try {
      const legacyReport = parseLegacyFieldReportText(fs.readFileSync(reportFile, "utf8"));
      const matches = (phase05bSourceRecords.jobs || [])
        .map((job) => ({ job, score: legacyReportMatchScore(job, legacyReport) }))
        .filter((match) => match.score >= 6)
        .sort((a, b) => b.score - a.score);
      if (matches.length !== 1) {
        skipped += 1;
        return;
      }
      const job = matches[0].job;
      if (Array.from(phase05dReportSubmissions.values()).some((report) => report.jobId === job.jobId && report.oneDriveFolder === folder)) {
        return;
      }
      const reportId = `RPT-RECOVERED-${crypto.createHash("sha1").update(folder).digest("hex").slice(0, 12).toUpperCase()}`;
      phase05dReportSubmissions.set(reportId, {
        reportId,
        jobId: job.jobId,
        jobReference: job.jobReference,
        jobDate: job.jobDate || legacyReport.jobDate,
        slot: job.slot,
        clientName: job.clientName || legacyReport.clientName,
        jobTitle: job.jobTitle || legacyReport.jobTitle,
        siteName: job.siteName,
        address: job.address,
        postcode: job.postcode,
        technicianId: job.assignedTechnicianId,
        staffId: phase05bPilotContext.staffId,
        technician: "Ian D",
        submittedAt: legacyReport.submittedAt || new Date(fs.statSync(reportFile).mtime).toISOString(),
        photoCount: legacyReport.photoCount,
        recommendations: legacyReport.recommendations,
        oneDriveFolder: folder,
        recoveredFrom: "OneDrive legacy report fallback"
      });
      restorePhase05eCompletedJobState({ reportId, jobId: job.jobId, submittedAt: legacyReport.submittedAt });
      recovered += 1;
    } catch {
      skipped += 1;
    }
  });
  if (recovered) persistPhase05eReportMetadata();
  return { recovered, skipped };
}

function hydratePhase05eReportMetadata() {
  let recovered = 0;
  let skipped = 0;
  try {
    if (fs.existsSync(completedReportMetadataFile)) {
      const data = JSON.parse(fs.readFileSync(completedReportMetadataFile, "utf8"));
      const reports = Array.isArray(data.reports) ? data.reports : [];
      reports.forEach((raw) => {
        const report = phase05ePublicReportMetadata(raw);
        if (!report.reportId || !report.jobId) {
          skipped += 1;
          return;
        }
        phase05dReportSubmissions.set(report.reportId, report);
        restorePhase05eCompletedJobState(report);
        recovered += 1;
      });
    }
    const fallback = recoverPhase05eMetadataFromOneDriveFallback();
    return { recovered: recovered + fallback.recovered, skipped: skipped + fallback.skipped };
  } catch (error) {
    console.warn("Phase 5E report metadata recovery skipped:", error.message);
    const fallback = recoverPhase05eMetadataFromOneDriveFallback();
    return { recovered: fallback.recovered, skipped: skipped + fallback.skipped, error: error.message };
  }
}

function hasMeaningfulValue(value) {
  return textValue(value).length > 0;
}

function reportValidationErrors(payload = {}) {
  const report = payload.report || {};
  const fields = report.fields || {};
  const errors = [];

  [
    ["visitDate", "Date of visit"],
    ["vulnerablePeople", "Vulnerable people"],
    ["healthRisk", "Health risk"],
    ["location", "Infestation location"],
    ["housekeeping", "Housekeeping"],
    ["techReport", "Kingswood Tech Report"]
  ].forEach(([field, label]) => {
    if (!hasMeaningfulValue(fields[field])) errors.push(`${label} is required. Enter N/A where it does not apply.`);
  });

  if (!Array.isArray(fields.pestTypes) || fields.pestTypes.length === 0) {
    errors.push("Type of pest is required.");
  }

  const photoUrls = Array.isArray(payload.photoUrls) ? payload.photoUrls.filter(hasMeaningfulValue) : [];
  if (photoUrls.length < 6) errors.push("At least 6 successfully uploaded photos are required.");
  if (photoUrls.length > 20) errors.push("Maximum 20 photos allowed.");

  if (!hasMeaningfulValue(payload.reportId)) errors.push("Stable reportId is required.");
  if (!hasMeaningfulValue(payload.jobId)) errors.push("jobId is required.");
  if (payload.photoUploadComplete !== true) errors.push("Photo upload must complete before submission.");
  if (payload.oneDriveSaveComplete !== true) errors.push("The report must be saved to the existing OneDrive workflow before completion.");

  return errors;
}

function submitPhase05dReport(session, payload = {}) {
  const context = session.context;
  const job = (phase05bSourceRecords.jobs || []).find((item) => item.jobId === payload.jobId);
  if (!job) return { status: 404, body: { ok: false, code: "job_not_found", message: "Job not found." } };
  if (job.assignedTechnicianId !== context.technicianId) {
    return { status: 403, body: { ok: false, code: "access_denied", message: "You are not authorised to report against this job." } };
  }

  const errors = reportValidationErrors(payload);
  if (errors.length) {
    return { status: 422, body: { ok: false, code: "validation_failed", message: errors[0], errors } };
  }

  const reportId = textValue(payload.reportId);
  const existing = phase05dReportSubmissions.get(reportId);
  if (existing) {
    if (existing.jobId !== job.jobId || existing.technicianId !== context.technicianId) {
      return { status: 409, body: { ok: false, code: "report_id_conflict", message: "This report ID is already linked to another submission." } };
    }
    return {
      status: 200,
      body: {
        ok: true,
        duplicateSafe: true,
        reportId,
        jobId: job.jobId,
        technicianId: context.technicianId,
        jobStatus: job.status,
        completedAt: existing.submittedAt || job.completedAt || ""
      }
    };
  }

  const completedAt = new Date().toISOString();
  job.status = "Completed";
  job.completedAt = completedAt;
  job.reportId = reportId;

  phase05dReportSubmissions.set(reportId, {
    reportId,
    jobId: job.jobId,
    jobReference: job.jobReference,
    jobDate: job.jobDate,
    slot: job.slot,
    clientName: job.clientName,
    jobTitle: job.jobTitle,
    siteName: job.siteName,
    address: job.address,
    postcode: job.postcode,
    technicianId: context.technicianId,
    staffId: context.staffId,
    technician: "Ian D",
    submittedAt: completedAt,
    photoCount: payload.photoUrls.length,
    recommendations: textValue(payload.report?.fields?.recommendations),
    oneDriveFolder: textValue(payload.oneDriveFolder),
    fieldKeys: Object.keys(payload.report?.fields || {})
  });
  persistPhase05eReportMetadata();

  return {
    status: 200,
    body: {
      ok: true,
      reportId,
      jobId: job.jobId,
      technicianId: context.technicianId,
      jobStatus: "Completed",
      completedAt
    }
  };
}

function localRamsDraft(payload) {
  const job = payload.job || {};
  const source = String(payload.source || payload.scope || "Site-specific works to be reviewed before starting.").trim();
  const lowerSource = source.toLowerCase();
  const hasCosHH = /coshh|chemical|rodenticide|insecticide|biocide|bait|sds/.test(lowerSource);
  const hasBio = /guano|dropping|droppings|bird|rodent|weils|weil|psittacosis|biological/.test(lowerSource);
  const hasHeight = /ladder|tower|mewp|height|roof|access/.test(lowerSource);
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

  if (hasCosHH) {
    hazards.unshift({
      hazard: "COSHH / chemical exposure",
      who: "Technicians, site staff, residents and members of the public through contact, inhalation or accidental exposure.",
      controls: "Relevant Safety Data Sheet (SDS) to be attached. Minimum PPE: nitrile gloves, minimum 0.4mm thickness, and suitable RPE such as FFP3 disposable mask or half-mask with ABEK1 filters.",
      further: "Confirm product label, COSHH assessment, application area and exclusion arrangements before use.",
      owner: job.technician || "Assigned technician",
      due: job.date || new Date().toISOString().slice(0, 10)
    });
  }

  if (hasBio) {
    hazards.unshift({
      hazard: "Biological hazards from bird guano or rodent droppings",
      who: "Technicians and others nearby through airborne dust, pathogens, Weil's disease or Psittacosis.",
      controls: "Guano or droppings must be thoroughly treated with a professional biocide spray before disturbance to suppress airborne dust and pathogens.",
      further: "Segregate the area, use suitable PPE/RPE and double-bag contaminated waste for controlled disposal.",
      owner: job.technician || "Assigned technician",
      due: job.date || new Date().toISOString().slice(0, 10)
    });
  }

  if (hasHeight) {
    hazards.unshift({
      hazard: "Working at height",
      who: "Technicians through falls from ladders, towers or access equipment; others from falling tools or materials.",
      controls: "Ladders to be used for short-duration, low-risk tasks only, fully secured on level ground, maintaining 3 points of contact at all times.",
      further: "Inspect access equipment before use and stop work if conditions are unsuitable.",
      owner: job.technician || "Assigned technician",
      due: job.date || new Date().toISOString().slice(0, 10)
    });
  }

  return {
    title: `${job.address || "Job"} RAMS`,
    scope: payload.scope || `Carry out the planned works at ${job.address || "the job address"} in line with Kingswood procedures.`,
    ppe: hasCosHH
      ? ["Safety boots", "Hi-vis", "Eye protection", "Nitrile gloves minimum 0.4mm thickness", "FFP3 disposable mask or half-mask with ABEK1 filters"]
      : ["Safety boots", "Gloves", "Hi-vis", "Eye protection as required"],
    equipment: ["Hand tools", "Access equipment", "Proofing materials", "Waste bags"],
    hazards,
    method: [
      "Step 1: Arrival & Induction - Operative reports to the principal contractor's site office, presents RAMS, signs in and completes mandatory site safety inductions.",
      "Step 2: Area Segregation - Set up physical barriers, warning signs or lockable bait stations to exclude other trades and members of the public from the work zone.",
      "Step 3: Execution & Control - Complete the pest control or proofing works using the agreed tools, PPE and controls, with spill kit active and available where substances are used.",
      "Step 4: Waste Mitigation - Spent chemical containers, contaminated PPE and biological debris such as bird guano will be double-bagged, removed from site and disposed of under hazardous waste consignment procedures."
    ]
  };
}

async function openAiRamsDraft(payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { aiUsed: false, draft: localRamsDraft(payload) };
  }

  const prompt = [
    "Create a professional UK RAMS draft for Kingswood (London) Ltd for a main contractor construction or facilities management site.",
    "The user is Kevin Eastman, Director of Kingswood (London) Ltd.",
    "The draft must be site-specific, practical, and suitable for strict principal contractor review.",
    "Use clear UK English. Avoid Americanisms, vague corporate jargon, legal claims not supported by the input, or invented site facts.",
    "Explicitly include the following statutory frameworks in substance through the generated sections: The Management of Health and Safety at Work Regulations 1999 Regulation 3; COSHH Regulations 2002 for biocide, rodenticide and insecticide applications; Work at Height Regulations 2005 for ladders, towers or MEWP work; Personal Protective Equipment at Work (Amendment) Regulations 2022 including the same PPE duties for core employees and limb (b) workers.",
    "The method array must be chronological and include these four steps: Step 1 Arrival & Induction; Step 2 Area Segregation; Step 3 Execution & Control; Step 4 Waste Mitigation.",
    "If chemical, COSHH, rodenticide, insecticide, biocide or SDS hazards appear, include SDS attachment wording and minimum PPE: nitrile gloves minimum 0.4mm thickness plus appropriate RPE such as FFP3 mask or half-mask with ABEK1 filters.",
    "If biological hazards, bird guano or rodent droppings appear, include pre-treatment with professional biocide spray before disturbance to suppress airborne dust and pathogens including Weil's disease and Psittacosis.",
    "If ladders, towers, MEWP or working at height appear, include: Ladders to be used for short-duration, low-risk tasks only, fully secured on level ground, maintaining 3 points of contact at all times.",
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
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
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

async function saveRamsPdf(payload) {
  const year = safeFileName(payload.year || String(new Date().getFullYear()), "2026");
  const client = safeFileName(payload.client || "Client", "Client");
  const jobRef = safeFileName(payload.jobRef || "Job", "Job");
  const title = safeFileName(payload.title || "RAMS", "RAMS");
  const datedDir = path.join(ramsDocumentDir, year, client);
  fs.mkdirSync(datedDir, { recursive: true });

  const fileBase = safeFileName(`${jobRef} - ${title}`, "RAMS");
  const pdfPath = path.join(datedDir, `${fileBase}.pdf`);
  const htmlPath = path.join(datedDir, `${fileBase}.html`);
  const html = String(payload.html || "");

  if (!html.trim()) {
    throw new Error("No RAMS HTML was provided.");
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
        top: "14mm",
        right: "14mm",
        bottom: "16mm",
        left: "14mm"
      }
    });
    await browser.close();
    return {
      saved: true,
      fileType: "pdf",
      filePath: pdfPath,
      relativePath: path.relative(root, pdfPath)
    };
  } catch (error) {
    fs.writeFileSync(htmlPath, html, "utf8");
    return {
      saved: true,
      fileType: "html",
      filePath: htmlPath,
      relativePath: path.relative(root, htmlPath),
      message: `PDF rendering failed, but an editable HTML RAMS was saved. ${error.message}`
    };
  }
}

const server = http.createServer((request, response) => {
  const routePath = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`).pathname;

  if (request.method === "OPTIONS") {
    response.writeHead(204, dynamicJsonHeaders(request));
    response.end();
    return;
  }

  if (routePath === "/healthz" && request.method === "GET") {
    response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (routePath === "/technician-app.html" && request.method === "GET") {
    serveExistingTechnicianApp(response);
    return;
  }

  if (routePath === "/api/phase-10/director-login" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const payload = JSON.parse(body || "{}");
        const directorKey = normaliseDirectorName(payload.name);
        const data = readCommandCentreData();
        const context = phase10DirectorContextForName(data, directorKey);
        if (!context || phase10DirectorPins[directorKey] !== directorTextValue(payload.pin)) {
          sendJson(response, 403, { ok: false, message: "Director access is restricted to Kevin and Alex." }, dynamicJsonHeaders(request));
          return;
        }
        const session = createPhase10DirectorSession(context);
        sendJson(response, 200, { ok: true, director: context, expiresAt: session.expiresAt }, {
          ...dynamicJsonHeaders(request),
          "Set-Cookie": phase10CookieValue(session.sessionId)
        });
      })
      .catch((error) => sendJson(response, 400, { ok: false, message: error.message || "Director login failed." }, dynamicJsonHeaders(request)));
    return;
  }

  if (routePath === "/api/phase-10/director-logout" && request.method === "POST") {
    const sessionId = parseCookies(request)[phase10DirectorSessionCookie];
    if (sessionId) phase10DirectorSessions.delete(sessionId);
    sendJson(response, 200, { ok: true }, {
      ...dynamicJsonHeaders(request),
      "Set-Cookie": phase10CookieValue("", 0)
    });
    return;
  }

  if (routePath === "/api/phase-10/director-session" && request.method === "GET") {
    const sessionResult = getPhase10DirectorSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    sendJson(response, 200, { ok: true, director: sessionResult.session.context, expiresAt: sessionResult.session.expiresAt }, {
      ...dynamicJsonHeaders(request),
      ...(sessionResult.setCookie ? { "Set-Cookie": sessionResult.setCookie } : {})
    });
    return;
  }

  if (routePath === "/api/phase-10/overview" && request.method === "GET") {
    const sessionResult = getPhase10DirectorSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    const commandData = readCommandCentreData();
    const directorsData = phase10ReadData();
    const readableDirectorsData = phase10SanitiseDirectorsDataForRead(commandData, directorsData);
    sendJson(response, 200, {
      ok: true,
      overview: phase10BuildOverview(commandData, directorsData),
      technicians: phase10BuildTechnicianOverview(commandData, directorsData),
      legalEntities: readableDirectorsData.legalEntities,
      payrollPeriods: readableDirectorsData.payrollPeriods.map((period) => ({
        periodId: period.periodId,
        payrollMonth: period.payrollMonth,
        status: period.status,
        version: period.version,
        updatedAt: period.updatedAt,
        exceptionCount: (period.entries || []).reduce((sum, entry) => sum + (entry.exceptions || []).length, 0),
        staffCount: (period.entries || []).length
      })),
      exportHistory: readableDirectorsData.exportHistory.map((item) => ({
        exportId: item.exportId,
        periodId: item.periodId,
        payrollMonth: item.payrollMonth,
        version: item.version,
        fileName: item.fileName,
        exportedAt: item.exportedAt,
        exportedByUserId: item.exportedByUserId,
        status: item.status
      }))
    }, dynamicJsonHeaders(request));
    return;
  }

  if (routePath === "/api/revolut/gbp-balance" && request.method === "GET") {
    const sessionResult = getPhase10DirectorSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    revolutGbpBalanceSnapshot()
      .then((snapshot) => {
        sendJson(response, 200, snapshot, {
          ...dynamicJsonHeaders(request),
          ...(sessionResult.setCookie ? { "Set-Cookie": sessionResult.setCookie } : {})
        });
      })
      .catch((error) => {
        sendJson(response, 502, {
          ok: false,
          connected: false,
          status: "Unavailable",
          message: error.message || "Revolut balance is unavailable.",
          accountIdentifiersDisplayed: false
        }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (routePath === "/api/phase-10/company-details" && request.method === "GET") {
    const sessionResult = getPhase10DirectorSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    const directorsData = phase10ReadData();
    sendJson(response, 200, {
      ok: true,
      legalEntity: findLegalEntity(directorsData, KINGSWOOD_LONDON_LEGAL_ENTITY_ID),
      legalEntities: legalEntitiesForRead(directorsData)
    }, dynamicJsonHeaders(request));
    return;
  }

  if (routePath === "/api/phase-10/company-details" && request.method === "POST") {
    const sessionResult = getPhase10DirectorSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const result = phase10UpdateLegalEntity(phase10ReadData(), KINGSWOOD_LONDON_LEGAL_ENTITY_ID, JSON.parse(body || "{}"), sessionResult.session);
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => sendJson(response, 400, { ok: false, message: error.message || "Company details could not be saved." }, dynamicJsonHeaders(request)));
    return;
  }

  if (routePath === "/api/phase-10/payroll-periods" && request.method === "POST") {
    const sessionResult = getPhase10DirectorSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const payload = JSON.parse(body || "{}");
        const result = phase10BuildPayrollPeriod(readCommandCentreData(), phase10ReadData(), directorTextValue(payload.payrollMonth), sessionResult.session);
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => sendJson(response, 400, { ok: false, message: error.message || "Payroll period could not be created." }, dynamicJsonHeaders(request)));
    return;
  }

  if (routePath.startsWith("/api/phase-10/payroll-periods/") && request.method === "GET") {
    const sessionResult = getPhase10DirectorSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    const periodId = decodeURIComponent(routePath.split("/").pop() || "");
    const commandData = readCommandCentreData();
    const directorsData = phase10ReadData();
    const period = phase10FindPeriod(directorsData, periodId);
    sendJson(response, period ? 200 : 404, period ? { ok: true, period: phase10SanitisePayrollPeriodForRead(commandData, period) } : { ok: false, message: "Payroll period not found." }, dynamicJsonHeaders(request));
    return;
  }

  if (routePath.match(/^\/api\/phase-10\/payroll-periods\/[^/]+\/advance$/) && request.method === "POST") {
    const sessionResult = getPhase10DirectorSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const periodId = decodeURIComponent(routePath.split("/").at(-2));
        const result = phase10AddSalaryAdvance(readCommandCentreData(), phase10ReadData(), periodId, JSON.parse(body || "{}"), sessionResult.session);
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => sendJson(response, 400, { ok: false, message: error.message || "Salary advance could not be saved." }, dynamicJsonHeaders(request)));
    return;
  }

  if (routePath.match(/^\/api\/phase-10\/payroll-periods\/[^/]+\/status$/) && request.method === "POST") {
    const sessionResult = getPhase10DirectorSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const periodId = decodeURIComponent(routePath.split("/").at(-2));
        const result = phase10UpdatePeriodStatus(readCommandCentreData(), phase10ReadData(), periodId, JSON.parse(body || "{}"), sessionResult.session);
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => sendJson(response, 400, { ok: false, message: error.message || "Payroll status could not be updated." }, dynamicJsonHeaders(request)));
    return;
  }

  if (routePath.match(/^\/api\/phase-10\/payroll-periods\/[^/]+\/export$/) && request.method === "POST") {
    const sessionResult = getPhase10DirectorSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const periodId = decodeURIComponent(routePath.split("/").at(-2));
        const result = phase10ExportPayrollPeriod(readCommandCentreData(), phase10ReadData(), periodId, JSON.parse(body || "{}"), sessionResult.session);
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => sendJson(response, 400, { ok: false, message: error.message || "Payroll export could not be created." }, dynamicJsonHeaders(request)));
    return;
  }

  if (routePath.startsWith("/api/phase-10/exports/") && routePath.endsWith("/download") && request.method === "GET") {
    const sessionResult = getPhase10DirectorSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    const exportId = decodeURIComponent(routePath.split("/").at(-2));
    const exportRecord = phase10ReadData().exportHistory.find((item) => item.exportId === exportId);
    if (!exportRecord || !exportRecord.filePath || !fs.existsSync(exportRecord.filePath)) {
      sendJson(response, 404, { ok: false, message: "Payroll export not found." }, dynamicJsonHeaders(request));
      return;
    }
    response.writeHead(200, {
      "Content-Type": types[".xlsx"],
      "Content-Disposition": `attachment; filename="${path.basename(exportRecord.filePath).replace(/"/g, "")}"`,
      "Cache-Control": "no-store"
    });
    fs.createReadStream(exportRecord.filePath).pipe(response);
    return;
  }

  if (request.url === "/api/phase-05b/technician-login" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const payload = JSON.parse(body || "{}");
        const selectedName = String(payload.selectedName || payload.name || "").trim();
        const context = phase05bResolveTechnicianContext(selectedName);
        if (!context) {
          sendJson(response, 403, {
            authenticated: false,
            message: "Technician access is not available for this user."
          }, dynamicJsonHeaders(request));
          return;
        }
        const session = createPhase05bSession(context);
        sendJson(response, 200, {
          authenticated: true,
          readOnly: true,
          displayName: context.displayName,
          technicianName: context.fullName,
          expiresAt: session.expiresAt
        }, {
          ...dynamicJsonHeaders(request),
          "Set-Cookie": phase05bCookieValue(session.sessionId)
        });
      })
      .catch((error) => {
        sendJson(response, 400, {
          authenticated: false,
          message: error.message || "Could not start technician session."
        }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url.startsWith("/api/phase-05b/technician-feed") && request.method === "GET") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    try {
      phase073dMarkJobsAvailableForSession(sessionResult.session);
      const feed = phase05bFeedForSession(sessionResult.session);
      sendJson(response, 200, { ok: true, feed }, dynamicJsonHeaders(request));
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || "Could not build technician feed." }, dynamicJsonHeaders(request));
    }
    return;
  }

  if (request.url === "/api/phase-07/jobs/dispatch" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase073dDispatchJobs(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Job dispatch could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-07/jobs/change" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase073eCommitJobChange(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Job change could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-07/jobs/cancel" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase073eCancelJob(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Job cancellation could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-07/jobs/reassign" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase073eReassignJob(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Job reassignment could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-09a/vehicle-assignment" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase09aAssignVehicle(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Vehicle assignment could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (routePath.startsWith("/api/phase-09/staff-compliance/") && request.method === "GET") {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    const staffId = decodeURIComponent(routePath.split("/").pop() || "");
    const result = phase09StaffComplianceListStaff({
      staffId,
      officeUserName: url.searchParams.get("officeUserName"),
      officeRole: url.searchParams.get("officeRole")
    });
    sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
    return;
  }

  if (request.url === "/api/phase-09/training-records" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase09StaffComplianceSaveTraining(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Training record could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-09/training-records/replace-evidence" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase09StaffComplianceReplaceTrainingEvidence(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Training evidence could not be replaced." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-09/training-records/lifecycle" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase09StaffComplianceLifecycle(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Training lifecycle could not be updated." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (routePath === "/api/phase-09c/vehicle-inspections" && request.method === "GET") {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    const result = phase09cListVehicleInspections({
      officeUserName: url.searchParams.get("officeUserName"),
      officeRole: url.searchParams.get("officeRole")
    });
    sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
    return;
  }

  if (routePath.startsWith("/api/phase-09c/vehicle-inspections/") && request.method === "GET") {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    const inspectionId = decodeURIComponent(routePath.split("/").pop() || "");
    const result = phase09cGetVehicleInspection({
      inspectionId,
      officeUserName: url.searchParams.get("officeUserName"),
      officeRole: url.searchParams.get("officeRole")
    });
    sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
    return;
  }

  if (request.url === "/api/phase-09c/vehicle-inspections/review" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase09cReviewVehicleInspection(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Vehicle inspection review could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-09c/vehicle-defects/review" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase09cReviewVehicleDefect(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Vehicle defect review could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (routePath.startsWith("/api/phase-09d/vehicles/") && request.method === "GET") {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    const vehicleId = decodeURIComponent(routePath.split("/").pop() || "");
    const result = phase09dVehicleDetail({
      vehicleId,
      officeUserName: url.searchParams.get("officeUserName"),
      officeRole: url.searchParams.get("officeRole")
    });
    sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
    return;
  }

  if (request.url === "/api/phase-09d/vehicle-documents" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase09dAddVehicleDocument(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Vehicle document could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-09d/vehicle-documents/update" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase09dUpdateVehicleDocument(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Vehicle document metadata could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-09d/vehicle-documents/replace" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase09dReplaceVehicleDocument(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Vehicle document could not be replaced." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-09d/vehicle-maintenance" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
        const result = phase09dAddMaintenanceRecord(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Vehicle maintenance record could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if ((request.url === "/api/phase-07/jobs/accept" || request.url === "/api/phase-07/jobs/unable" || request.url === "/api/phase-07/jobs/acknowledge-change" || request.url === "/api/phase-07/jobs/acknowledge-cancellation" || request.url === "/api/phase-07/jobs/acknowledge-withdrawal" || request.url === "/api/phase-07/jobs/acknowledge") && request.method === "POST") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const responseType = request.url.endsWith("/unable")
          ? "unable"
          : request.url.endsWith("/acknowledge-change")
            ? "change"
            : request.url.endsWith("/acknowledge-cancellation")
              ? "cancellation"
              : request.url.endsWith("/acknowledge-withdrawal")
                ? "withdrawal"
                : "accept";
        const result = phase073dTechnicianJobResponse(sessionResult.session, JSON.parse(body || "{}"), responseType);
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Job response could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url.startsWith("/api/phase-06a1/leave-attendance") && request.method === "GET") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    try {
      const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
      const payload = phase06a1BuildLeaveAttendance(sessionResult.session, url.searchParams.get("year"));
      sendJson(response, 200, payload, dynamicJsonHeaders(request));
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || "Leave and attendance information is unavailable."
      }, dynamicJsonHeaders(request));
    }
    return;
  }

  if (request.url === "/api/phase-06a2/holiday-request" && request.method === "POST") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const result = phase06a2SubmitHolidayRequest(sessionResult.session, JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, {
          ok: false,
          message: error.message || "Holiday request could not be submitted."
        }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-06a2/holiday-request/cancel" && request.method === "POST") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const result = phase06a2CancelHolidayRequest(sessionResult.session, JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, {
          ok: false,
          message: error.message || "Holiday request could not be cancelled."
        }, dynamicJsonHeaders(request));
    });
    return;
  }

  if (request.url === "/api/phase-06a5/notifications/read" && request.method === "POST") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const result = phase06a5MarkNotificationsRead(sessionResult.session, JSON.parse(body || "{}"), false);
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch(() => {
        sendJson(response, 400, { ok: false, message: "Unable to update notification." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-06a5/notifications/read-all" && request.method === "POST") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const result = phase06a5MarkNotificationsRead(sessionResult.session, JSON.parse(body || "{}"), true);
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch(() => {
        sendJson(response, 400, { ok: false, message: "Unable to update notifications." }, dynamicJsonHeaders(request));
    });
    return;
  }

  if (request.url === "/api/phase-07/toolbox-talks" && request.method === "GET") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    try {
      sendJson(response, 200, phase07BuildTechnicianToolboxTalks(sessionResult.session, { markReceived: true }), dynamicJsonHeaders(request));
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || "Toolbox Talks are unavailable." }, dynamicJsonHeaders(request));
    }
    return;
  }

  if (routePath === "/api/technician-action-summary" && request.method === "GET") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    try {
      sendJson(response, 200, phase07TechnicianActionSummary(sessionResult.session), dynamicJsonHeaders(request));
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || "Action summary is unavailable." }, dynamicJsonHeaders(request));
    }
    return;
  }

  if (request.url === "/api/phase-09b/weekly-vehicle-check" && request.method === "GET") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    sendJson(response, 200, phase09bInspectionState(sessionResult.session), dynamicJsonHeaders(request));
    return;
  }

  if (request.url === "/api/phase-09b/weekly-vehicle-check" && request.method === "POST") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const result = phase09bSubmitInspection(sessionResult.session, JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Vehicle check could not be submitted." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-07/toolbox-talks/view" && request.method === "POST") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const result = phase07ViewToolboxTalk(sessionResult.session, JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Toolbox Talk view could not be recorded." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-07/toolbox-talks/acknowledge" && request.method === "POST") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const result = phase07AcknowledgeToolboxTalk(sessionResult.session, JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Toolbox Talk acknowledgement could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-07/announcements" && request.method === "GET") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    try {
      sendJson(response, 200, phase073bBuildTechnicianAnnouncements(sessionResult.session, { markReceived: true }), dynamicJsonHeaders(request));
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || "Announcements are unavailable." }, dynamicJsonHeaders(request));
    }
    return;
  }

  if (request.url === "/api/phase-07/announcements/view" && request.method === "POST") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const result = phase073bViewAnnouncement(sessionResult.session, JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Announcement view could not be recorded." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-07/announcements/acknowledge" && request.method === "POST") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, { ok: false, message: sessionResult.message }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const result = phase073bAcknowledgeAnnouncement(sessionResult.session, JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, { ok: false, message: error.message || "Announcement acknowledgement could not be saved." }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-05d/technician-report-submit" && request.method === "POST") {
    const sessionResult = getPhase05bSession(request);
    if (!sessionResult.ok) {
      sendJson(response, sessionResult.status, {
        ok: false,
        code: "session_required",
        message: sessionResult.message
      }, dynamicJsonHeaders(request));
      return;
    }
    readRequestBody(request)
      .then((body) => {
        const payload = JSON.parse(body || "{}");
        const result = submitPhase05dReport(sessionResult.session, payload);
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch((error) => {
        sendJson(response, 400, {
          ok: false,
          code: "malformed_submission",
          message: error.message || "Could not read report submission."
        }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-05e/hub-report-status" && request.method === "GET") {
    sendJson(response, 200, phase05eHubReportStatus(), dynamicJsonHeaders(request));
    return;
  }

  if (request.url === "/api/phase-05e/open-report-folder" && request.method === "POST") {
    readRequestBody(request)
      .then(async (body) => {
        const result = await phase05eOpenReportFolder(JSON.parse(body || "{}"));
        sendJson(response, result.status, result.body, dynamicJsonHeaders(request));
      })
      .catch(() => {
        sendJson(response, 400, {
          ok: false,
          code: "malformed_open_folder_request",
          message: "Unable to open the OneDrive folder."
        }, dynamicJsonHeaders(request));
      });
    return;
  }

  if (request.url === "/api/phase-05b/technician-logout" && request.method === "POST") {
    const sessionId = parseCookies(request)[phase05bSessionCookie];
    if (sessionId) phase05bSessions.delete(sessionId);
    sendJson(response, 200, { ok: true }, {
      ...dynamicJsonHeaders(request),
      "Set-Cookie": phase05bCookieValue("", 0)
    });
    return;
  }

  if (request.url === "/api/phase-05b/test-expired-session" && request.method === "POST") {
    if (process.env.NODE_ENV === "production") {
      sendJson(response, 404, { ok: false }, dynamicJsonHeaders(request));
      return;
    }
    const session = createPhase05bSession(phase05bPilotContext, -1000);
    sendJson(response, 200, { ok: true, expiresAt: session.expiresAt }, {
      ...dynamicJsonHeaders(request),
      "Set-Cookie": phase05bCookieValue(session.sessionId, 1)
    });
    return;
  }

  if (request.url.startsWith("/api/local-file") && request.method === "GET") {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    const filePath = url.searchParams.get("path") || "";
    if (!filePath || !fs.existsSync(filePath)) {
      response.writeHead(404, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ message: "File not found" }));
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream",
      "Content-Disposition": `inline; filename="${path.basename(filePath).replace(/"/g, "")}"`,
      "Cache-Control": "no-store"
    });
    fs.createReadStream(filePath).pipe(response);
    return;
  }

  if (request.url === "/api/export-training-matrix" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => exportTrainingMatrix(JSON.parse(body || "{}")))
      .then((result) => {
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: true, ...result }));
      })
      .catch((error) => {
        response.writeHead(500, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: false, message: error.message || "Could not export training matrix" }));
      });
    return;
  }

  if (request.url === "/api/data" && request.method === "GET") {
    const commandCentreUser = phase10DirectorIdentityFromRequest(request);
    if (!commandCentreUser) {
      sendJson(response, 401, { ok: false, message: "Authenticated Command Centre identity required." }, dynamicJsonHeaders(request));
      return;
    }
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
    const commandCentreUser = phase10DirectorIdentityFromRequest(request);
    if (!commandCentreUser) {
      sendJson(response, 401, { saved: false, message: "Authenticated Command Centre identity required." }, dynamicJsonHeaders(request));
      return;
    }
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        const existing = readCommandCentreData();
        if (commandDataLooksUnsafeToSave(parsed, existing)) {
          response.writeHead(409, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ saved: false, message: "Hosted data save rejected because the submitted data is incomplete." }));
          return;
        }
        const migrated = migrateKevinDirectorAccess(parsed);
        const safeData = migrated.data;
        if (Array.isArray(parsed.vehicles)) {
          safeData.vehicles = normaliseVehicleCollection(parsed.vehicles);
        }
        const backupPath = writeJsonSafely(dataFile, `${JSON.stringify(safeData, null, 2)}\n`, "command-centre-data");
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

  if (request.url === "/api/save-rams-pdf" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => saveRamsPdf(JSON.parse(body || "{}")))
      .then((result) => {
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result));
      })
      .catch((error) => {
        response.writeHead(500, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: false, message: error.message || "Could not save RAMS document" }));
      });
    return;
  }

  if (request.url === "/api/staff-records" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => saveStaffRecords(JSON.parse(body || "{}")))
      .then((result) => {
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: true, ...result }));
      })
      .catch((error) => {
        response.writeHead(500, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: false, message: error.message || "Could not save staff records" }));
      });
    return;
  }

  if (request.url === "/api/save-fine-record" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => saveFineRecord(JSON.parse(body || "{}")))
      .then((result) => {
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: true, ...result }));
      })
      .catch((error) => {
        response.writeHead(500, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: false, message: error.message || "Could not save fine record" }));
      });
    return;
  }

  if (request.url === "/api/save-training-record" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => saveTrainingRecord(JSON.parse(body || "{}")))
      .then((result) => {
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: true, ...result }));
      })
      .catch((error) => {
        response.writeHead(500, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: false, message: error.message || "Could not save training record" }));
      });
    return;
  }

  if (request.url === "/api/save-compliance-record" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => saveComplianceRecord(JSON.parse(body || "{}")))
      .then((result) => {
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: true, ...result }));
      })
      .catch((error) => {
        response.writeHead(500, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: false, message: error.message || "Could not save compliance record" }));
      });
    return;
  }

  if (request.url === "/api/save-asset-record" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => saveAssetRecord(JSON.parse(body || "{}")))
      .then((result) => {
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: true, ...result }));
      })
      .catch((error) => {
        response.writeHead(500, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: false, message: error.message || "Could not save asset record" }));
      });
    return;
  }

  if (request.url === "/api/export-assets" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => exportAssets(JSON.parse(body || "{}")))
      .then((result) => {
        response.writeHead(200, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: true, ...result }));
      })
      .catch((error) => {
        response.writeHead(500, { ...jsonHeaders, "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ saved: false, message: error.message || "Could not export asset register" }));
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
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
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

const phase05eRecoveryResult = hydratePhase05eReportMetadata();
if (phase05eRecoveryResult.recovered || phase05eRecoveryResult.error) {
  console.log(`Phase 5E report metadata recovery: ${phase05eRecoveryResult.recovered} recovered, ${phase05eRecoveryResult.skipped || 0} skipped${phase05eRecoveryResult.error ? ` (${phase05eRecoveryResult.error})` : ""}.`);
}

server.listen(port, host);
