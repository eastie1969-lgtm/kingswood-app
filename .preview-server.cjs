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

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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
  files.forEach(({ name, content }) => {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
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
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
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

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
      holidayAllowance: 28,
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
  const recordFileName = safeFileName(`${savedRecord.trainingRecordId || savedRecord.id || timestampForFile()} - ${savedRecord.course || "Training record"}.json`, "training-record.json");
  writeJsonSafely(path.join(trainingFolder, recordFileName), JSON.stringify(savedRecord, null, 2), "training-record");
  return {
    folder: trainingFolder,
    record: savedRecord,
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

server.listen(port, host);
