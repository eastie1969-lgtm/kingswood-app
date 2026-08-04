"use strict";

const crypto = require("crypto");

const DIRECTOR_STAFF = Object.freeze({
  Kevin: { staffId: "STAFF-20260716-012", name: "Kevin Eastman", role: "Director" },
  Alex: { staffId: "STAFF-20260716-011", name: "Alex Lancaster", role: "Director" }
});

const PAYROLL_STATUSES = Object.freeze(["Draft", "Ready for Review", "Approved", "Exported", "Superseded"]);
const KINGSWOOD_LONDON_LEGAL_ENTITY_ID = "LE-KWL-13950997";
const SUPPORTED_LOGO_EXTENSIONS = Object.freeze([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

function textValue(value) {
  return String(value ?? "").trim();
}

function normaliseStatus(value) {
  return textValue(value).toLowerCase().replace(/[\s_-]+/g, " ");
}

function stableHash(parts = []) {
  return crypto
    .createHash("sha256")
    .update(parts.map((part) => textValue(part).toLowerCase()).join("|"))
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
}

function payrollPeriodIdFor(month) {
  const safeMonth = textValue(month);
  if (!/^\d{4}-\d{2}$/.test(safeMonth)) throw new Error("Payroll month must use YYYY-MM.");
  return `PAY-${safeMonth}-${stableHash(["payroll-period", safeMonth])}`;
}

function salaryAdvanceIdFor(staffId, payrollMonth, datePaid, amount, note = "") {
  return `ADV-${stableHash(["salary-advance", staffId, payrollMonth, datePaid, Number(amount).toFixed(2), note])}`;
}

function payrollExportIdFor(periodId, version, exportedAt) {
  return `PEX-${stableHash(["payroll-export", periodId, version, exportedAt])}`;
}

function auditEventIdFor(action, entityType, entityId, at, performedByUserId) {
  return `AUD-${stableHash(["director-audit", action, entityType, entityId, at, performedByUserId])}`;
}

function defaultKingswoodLegalEntity(updatedBy = "") {
  const now = new Date().toISOString();
  return {
    legalEntityId: KINGSWOOD_LONDON_LEGAL_ENTITY_ID,
    legalCompanyName: "Kingswood (London) Ltd",
    tradingName: "Kingswood (London) Ltd",
    tradingAddressLines: ["Unit 1, Suite R", "Lagoon Road"],
    tradingTown: "Orpington",
    tradingPostcode: "BR5 3QX",
    registeredOfficeAddressLines: ["The Old Barn", "Off Wood Street", "Swanley Village"],
    registeredOfficeTown: "Swanley",
    registeredOfficePostcode: "BR7 7PA",
    companyRegistrationNumber: "13950997",
    vatRegistrationNumber: "415 4212 35",
    telephoneNumber: "01689 490204",
    generalEmail: "info@kingswoodlondon.co.uk",
    website: "www.kingswoodlondonltd.com",
    approvedLogoReference: "assets/kingswood-silver-logo.png",
    documentFooterText: "Kingswood (London) Ltd | Company registration number 13950997 | VAT registration number 415 4212 35",
    status: "Active",
    lastUpdatedBy: textValue(updatedBy) || "System",
    lastUpdatedAt: now
  };
}

function normaliseUkPostcode(value) {
  const compact = textValue(value).toUpperCase().replace(/\s+/g, "");
  if (!compact) return "";
  if (compact.length <= 3) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

function normaliseWebsite(value) {
  return textValue(value).replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
}

function normaliseLegalEntityRecord(record = {}, fallback = defaultKingswoodLegalEntity()) {
  const legalEntityId = textValue(record.legalEntityId || fallback.legalEntityId);
  return {
    legalEntityId,
    legalCompanyName: textValue(record.legalCompanyName || record.companyName || fallback.legalCompanyName),
    tradingName: textValue(record.tradingName || fallback.tradingName),
    tradingAddressLines: Array.isArray(record.tradingAddressLines)
      ? record.tradingAddressLines.map(textValue).filter(Boolean)
      : Array.isArray(fallback.tradingAddressLines) ? fallback.tradingAddressLines : [],
    tradingTown: textValue(record.tradingTown || fallback.tradingTown),
    tradingPostcode: normaliseUkPostcode(record.tradingPostcode || fallback.tradingPostcode),
    registeredOfficeAddressLines: Array.isArray(record.registeredOfficeAddressLines)
      ? record.registeredOfficeAddressLines.map(textValue).filter(Boolean)
      : Array.isArray(fallback.registeredOfficeAddressLines) ? fallback.registeredOfficeAddressLines : [],
    registeredOfficeTown: textValue(record.registeredOfficeTown || fallback.registeredOfficeTown),
    registeredOfficePostcode: normaliseUkPostcode(record.registeredOfficePostcode || fallback.registeredOfficePostcode),
    companyRegistrationNumber: textValue(record.companyRegistrationNumber || record.companyNumber || fallback.companyRegistrationNumber),
    vatRegistrationNumber: textValue(record.vatRegistrationNumber || record.vatNumber || fallback.vatRegistrationNumber),
    telephoneNumber: textValue(record.telephoneNumber || record.mainTelephone || fallback.telephoneNumber),
    generalEmail: textValue(record.generalEmail || record.email || fallback.generalEmail).toLowerCase(),
    website: normaliseWebsite(record.website || fallback.website),
    approvedLogoReference: textValue(record.approvedLogoReference || record.logo || fallback.approvedLogoReference),
    documentFooterText: textValue(record.documentFooterText || fallback.documentFooterText),
    status: textValue(record.status || fallback.status || "Active"),
    lastUpdatedBy: textValue(record.lastUpdatedBy || fallback.lastUpdatedBy),
    lastUpdatedAt: textValue(record.lastUpdatedAt || fallback.lastUpdatedAt)
  };
}

function validateLegalEntityRecord(record = {}) {
  const errors = [];
  if (!textValue(record.legalEntityId)) errors.push("Legal entity ID is required.");
  if (!textValue(record.legalCompanyName)) errors.push("Legal company name is required.");
  if (!textValue(record.tradingName)) errors.push("Trading name is required.");
  if (!Array.isArray(record.tradingAddressLines) || !record.tradingAddressLines.some((line) => textValue(line))) errors.push("Trading address lines are required.");
  if (!textValue(record.tradingTown)) errors.push("Trading town is required.");
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(textValue(record.tradingPostcode))) errors.push("Trading postcode must be a valid UK postcode.");
  if (!Array.isArray(record.registeredOfficeAddressLines) || !record.registeredOfficeAddressLines.some((line) => textValue(line))) errors.push("Registered office address lines are required.");
  if (!textValue(record.registeredOfficeTown)) errors.push("Registered office town is required.");
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(textValue(record.registeredOfficePostcode))) errors.push("Registered office postcode must be a valid UK postcode.");
  if (!/^[A-Z0-9]{2,12}$/i.test(textValue(record.companyRegistrationNumber))) errors.push("Company registration number must be stored as text and contain only letters or numbers.");
  if (!/^[0-9 ]{5,20}$/.test(textValue(record.vatRegistrationNumber))) errors.push("VAT registration number must contain numbers and spaces only.");
  if (!/^[0-9 +()]{8,24}$/.test(textValue(record.telephoneNumber))) errors.push("Telephone number must be stored as text and use telephone characters only.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(textValue(record.generalEmail))) errors.push("General email address is invalid.");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(normaliseWebsite(record.website))) errors.push("Website is invalid.");
  const logo = textValue(record.approvedLogoReference);
  const lowerLogo = logo.toLowerCase();
  if (!logo) errors.push("Approved logo reference is required.");
  if (/[<>:"|?*]/.test(logo) || lowerLogo.includes("..") || /^[a-z]+:/i.test(logo)) errors.push("Approved logo reference must be a safe project-relative path.");
  if (logo && !SUPPORTED_LOGO_EXTENSIONS.some((extension) => lowerLogo.endsWith(extension))) errors.push("Approved logo must use a supported image type.");
  if (!["active", "inactive"].includes(textValue(record.status).toLowerCase())) errors.push("Status must be Active or Inactive.");
  return errors;
}

function legalEntitiesForRead(directorsData = {}) {
  const entities = Array.isArray(directorsData.legalEntities) ? directorsData.legalEntities : [];
  const hasKingswood = entities.some((entity) => textValue(entity.legalEntityId) === KINGSWOOD_LONDON_LEGAL_ENTITY_ID);
  return (hasKingswood ? entities : [defaultKingswoodLegalEntity(), ...entities])
    .map((entity) => normaliseLegalEntityRecord(entity));
}

function findLegalEntity(directorsData = {}, legalEntityId = KINGSWOOD_LONDON_LEGAL_ENTITY_ID) {
  return legalEntitiesForRead(directorsData).find((entity) => textValue(entity.legalEntityId) === textValue(legalEntityId)) || null;
}

function normaliseDirectorName(value) {
  const name = textValue(value).toLowerCase();
  if (["kev", "kevin", "kevin eastman"].includes(name)) return "Kevin";
  if (["alex", "alex lancaster"].includes(name)) return "Alex";
  return "";
}

function isDirectorStaff(staff = {}) {
  const role = textValue(staff.role).toLowerCase();
  return role === "director" && Object.values(DIRECTOR_STAFF).some((director) => director.staffId === staff.staffId);
}

function excelSafeText(value) {
  const text = textValue(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function daysBetweenInclusive(start, end) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return 0;
  return Math.round((endDate - startDate) / 86400000) + 1;
}

function dateInMonth(dateValue, month) {
  return textValue(dateValue).startsWith(`${month}-`);
}

function isActiveEmploymentRecord(staff = {}) {
  const status = normaliseStatus(staff.employmentStatus || staff.status || "Active");
  if (!status || status === "active") return true;
  return !/(inactive|left|leaver|archived|archive|test|fictional|deleted|void|superseded)/i.test(status);
}

function isDirectorAuthority(staff = {}) {
  if (staff.directorAccessAuthority === true) return true;
  const role = textValue(staff.role).toLowerCase();
  return role === "director" && Object.values(DIRECTOR_STAFF).some((director) => director.staffId === staff.staffId);
}

function isEmployeePayrollRecord(staff = {}) {
  if (!textValue(staff.staffId)) return false;
  if (!isActiveEmploymentRecord(staff)) return false;
  if (staff.approvedMasterList === false) return false;
  if (isDirectorAuthority(staff)) return false;
  if (textValue(staff.role).toLowerCase() === "director") return false;
  return true;
}

function isPayrollActive(staff = {}) {
  if (!isEmployeePayrollRecord(staff)) return false;
  if (staff.payrollActive !== true) return false;
  if (textValue(staff.payrollStatus).toLowerCase() === "inactive") return false;
  return true;
}

function daysInMonthRange(from, to, month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = new Date(year, monthNumber - 1, 1);
  const monthEnd = new Date(year, monthNumber, 0);
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to || from}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const clippedStart = start > monthStart ? start : monthStart;
  const clippedEnd = end < monthEnd ? end : monthEnd;
  if (clippedEnd < clippedStart) return 0;
  return daysBetweenInclusive(clippedStart.toISOString().slice(0, 10), clippedEnd.toISOString().slice(0, 10));
}

function buildPayrollSourceRows(commandData = {}, directorsData = {}, payrollMonth) {
  const staffProfiles = Array.isArray(commandData.staffProfiles) ? commandData.staffProfiles : [];
  const holidayRequests = Array.isArray(commandData.holidayRequests) ? commandData.holidayRequests : [];
  const attendanceRecords = Array.isArray(commandData.attendanceRecords) ? commandData.attendanceRecords : [];
  const salaryAdvances = Array.isArray(directorsData.salaryAdvances) ? directorsData.salaryAdvances : [];
  return staffProfiles
    .filter(isPayrollActive)
    .map((staff) => {
      const staffId = textValue(staff.staffId);
      const approvedHolidayDays = holidayRequests
        .filter((request) => textValue(request.staffId) === staffId || textValue(request.name) === textValue(staff.name))
        .filter((request) => textValue(request.status).toLowerCase() === "approved")
        .reduce((sum, request) => sum + daysInMonthRange(request.startDate || request.from || request.date, request.endDate || request.to || request.date, payrollMonth), 0);
      const monthAttendance = attendanceRecords.filter((record) =>
        (textValue(record.staffId) === staffId || textValue(record.name) === textValue(staff.name)) && dateInMonth(record.date, payrollMonth)
      );
      const sickDays = monthAttendance.filter((record) => /sick/i.test(textValue(record.status) || textValue(record.category))).length;
      const paidAbsenceDays = monthAttendance.filter((record) => /paid/i.test(textValue(record.paidStatus))).length;
      const unpaidAbsenceDays = monthAttendance.filter((record) => /unpaid/i.test(textValue(record.paidStatus))).length;
      const otherAbsenceDays = monthAttendance.filter((record) =>
        !/sick/i.test(textValue(record.status) || textValue(record.category))
        && !/holiday|annual leave/i.test(textValue(record.status) || textValue(record.category))
      ).length;
      const overtimeDays = monthAttendance
        .filter((record) => /overtime/i.test(`${textValue(record.status)} ${textValue(record.category)} ${textValue(record.type)} ${textValue(record.attendanceType)}`))
        .reduce((sum, record) => sum + Number(record.days || record.hours || record.value || 1), 0);
      const additionalDaysHours = monthAttendance
        .filter((record) => /additional/i.test(`${textValue(record.status)} ${textValue(record.category)} ${textValue(record.type)} ${textValue(record.attendanceType)}`))
        .reduce((sum, record) => sum + Number(record.days || record.hours || record.value || 1), 0);
      const staffAdvances = salaryAdvances.filter((advance) =>
        textValue(advance.staffId) === staffId && textValue(advance.payrollMonth) === payrollMonth && textValue(advance.status || "Active") === "Active"
      );
      const exceptions = [];
      if (!staffId) exceptions.push("Missing stable staffId.");
      if (!textValue(staff.payrollReference)) exceptions.push("Payroll reference not recorded.");
      if (!textValue(staff.normalWorkingDays) && !textValue(staff.normalHours)) exceptions.push("Normal days/hours not recorded.");
      if (otherAbsenceDays && monthAttendance.some((record) => !textValue(record.paidStatus) && !/sick/i.test(textValue(record.status)))) {
        exceptions.push("Some absence has no explicit paid/unpaid status.");
      }
      return {
        staffId,
        employee: textValue(staff.name),
        role: textValue(staff.role),
        employmentStatus: textValue(staff.status || "Active"),
        payrollReference: textValue(staff.payrollReference),
        normalDaysHours: textValue(staff.normalWorkingDays || staff.normalHours),
        approvedHolidayDays,
        sickDays,
        otherPaidAbsenceDays: paidAbsenceDays,
        unpaidAbsenceDays,
        otherAbsenceDays,
        overtimeDays,
        additionalDaysHours,
        overtimeAdditionalDays: overtimeDays + additionalDaysHours,
        salaryAdvancesTotal: staffAdvances.reduce((sum, advance) => sum + Number(advance.amount || 0), 0),
        otherAdditions: Number(staff.otherPayrollAdditions || staff.otherAdditions || 0),
        otherDeductions: Number(staff.otherPayrollDeductions || staff.otherDeductions || 0),
        manualAdjustments: Number(staff.manualPayrollAdjustment || staff.manualAdjustments || 0),
        notes: textValue(staff.accountantNote || staff.payrollNote),
        exceptions
      };
    });
}

module.exports = {
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
  isDirectorAuthority,
  isDirectorStaff,
  isEmployeePayrollRecord,
  isPayrollActive,
  legalEntitiesForRead,
  normaliseLegalEntityRecord,
  normaliseDirectorName,
  payrollExportIdFor,
  payrollPeriodIdFor,
  salaryAdvanceIdFor,
  stableHash,
  textValue,
  validateLegalEntityRecord
};
