"use strict";

const HOLIDAY_RULE_VERSION = "UK-WTR-2024-BANK-HOLIDAY-INCLUSIVE-V2";

const ENGLAND_WALES_BANK_HOLIDAYS = Object.freeze([
  { title: "New Year's Day substitute day", date: "2022-01-03" },
  { title: "Good Friday", date: "2022-04-15" },
  { title: "Easter Monday", date: "2022-04-18" },
  { title: "Early May bank holiday", date: "2022-05-02" },
  { title: "Spring bank holiday", date: "2022-06-02" },
  { title: "Platinum Jubilee bank holiday", date: "2022-06-03" },
  { title: "Summer bank holiday", date: "2022-08-29" },
  { title: "State Funeral of Queen Elizabeth II", date: "2022-09-19" },
  { title: "Boxing Day", date: "2022-12-26" },
  { title: "Christmas Day substitute day", date: "2022-12-27" },
  { title: "New Year's Day substitute day", date: "2023-01-02" },
  { title: "Good Friday", date: "2023-04-07" },
  { title: "Easter Monday", date: "2023-04-10" },
  { title: "Early May bank holiday", date: "2023-05-01" },
  { title: "Bank holiday for the coronation of King Charles III", date: "2023-05-08" },
  { title: "Spring bank holiday", date: "2023-05-29" },
  { title: "Summer bank holiday", date: "2023-08-28" },
  { title: "Christmas Day", date: "2023-12-25" },
  { title: "Boxing Day", date: "2023-12-26" },
  { title: "New Year's Day", date: "2024-01-01" },
  { title: "Good Friday", date: "2024-03-29" },
  { title: "Easter Monday", date: "2024-04-01" },
  { title: "Early May bank holiday", date: "2024-05-06" },
  { title: "Spring bank holiday", date: "2024-05-27" },
  { title: "Summer bank holiday", date: "2024-08-26" },
  { title: "Christmas Day", date: "2024-12-25" },
  { title: "Boxing Day", date: "2024-12-26" },
  { title: "New Year's Day", date: "2025-01-01" },
  { title: "Good Friday", date: "2025-04-18" },
  { title: "Easter Monday", date: "2025-04-21" },
  { title: "Early May bank holiday", date: "2025-05-05" },
  { title: "Spring bank holiday", date: "2025-05-26" },
  { title: "Summer bank holiday", date: "2025-08-25" },
  { title: "Christmas Day", date: "2025-12-25" },
  { title: "Boxing Day", date: "2025-12-26" },
  { title: "New Year's Day", date: "2026-01-01" },
  { title: "Good Friday", date: "2026-04-03" },
  { title: "Easter Monday", date: "2026-04-06" },
  { title: "Early May bank holiday", date: "2026-05-04" },
  { title: "Spring bank holiday", date: "2026-05-25" },
  { title: "Summer bank holiday", date: "2026-08-31" },
  { title: "Christmas Day", date: "2026-12-25" },
  { title: "Boxing Day substitute day", date: "2026-12-28" },
  { title: "New Year's Day", date: "2027-01-01" },
  { title: "Good Friday", date: "2027-03-26" },
  { title: "Easter Monday", date: "2027-03-29" },
  { title: "Early May bank holiday", date: "2027-05-03" },
  { title: "Spring bank holiday", date: "2027-05-31" },
  { title: "Summer bank holiday", date: "2027-08-30" },
  { title: "Christmas Day substitute day", date: "2027-12-27" },
  { title: "Boxing Day substitute day", date: "2027-12-28" },
  { title: "New Year's Day substitute day", date: "2028-01-03" },
  { title: "Good Friday", date: "2028-04-14" },
  { title: "Easter Monday", date: "2028-04-17" },
  { title: "Early May bank holiday", date: "2028-05-01" },
  { title: "Spring bank holiday", date: "2028-05-29" },
  { title: "Summer bank holiday", date: "2028-08-28" },
  { title: "Christmas Day", date: "2028-12-25" },
  { title: "Boxing Day", date: "2028-12-26" },
  { title: "New Year's Day", date: "2029-01-01" },
  { title: "Good Friday", date: "2029-03-30" },
  { title: "Easter Monday", date: "2029-04-02" },
  { title: "Early May bank holiday", date: "2029-05-07" },
  { title: "Spring bank holiday", date: "2029-05-28" },
  { title: "Summer bank holiday", date: "2029-08-27" },
  { title: "Christmas Day", date: "2029-12-25" },
  { title: "Boxing Day", date: "2029-12-26" },
  { title: "New Year's Day", date: "2030-01-01" },
  { title: "Good Friday", date: "2030-04-19" },
  { title: "Easter Monday", date: "2030-04-22" },
  { title: "Early May bank holiday", date: "2030-05-06" },
  { title: "Spring bank holiday", date: "2030-05-27" },
  { title: "Summer bank holiday", date: "2030-08-26" },
  { title: "Christmas Day", date: "2030-12-25" },
  { title: "Boxing Day", date: "2030-12-26" }
]);

function textValue(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isoDate(value) {
  const text = textValue(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function daysBetweenInclusive(start, end) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return 0;
  return Math.round((endDate - startDate) / 86400000) + 1;
}

function isoWeekday(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return -1;
  return date.getUTCDay();
}

function dateRangeValues(start, end) {
  const values = [];
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return values;
  for (const cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    values.push(cursor.toISOString().slice(0, 10));
  }
  return values;
}

function overlapDays(start, end, rangeStart, rangeEnd) {
  const actualStart = isoDate(start) > isoDate(rangeStart) ? isoDate(start) : isoDate(rangeStart);
  const actualEnd = isoDate(end || start) < isoDate(rangeEnd) ? isoDate(end || start) : isoDate(rangeEnd);
  return actualStart && actualEnd ? daysBetweenInclusive(actualStart, actualEnd) : 0;
}

function leaveYearFor(year, staff = {}, policy = {}) {
  const start = isoDate(staff.leaveYearStartDate)
    || isoDate(staff.leaveYearStart)
    || isoDate(policy.leaveYearStartDate)
    || isoDate(policy.leaveYearStart)
    || "";
  const end = isoDate(staff.leaveYearEndDate)
    || isoDate(staff.leaveYearEnd)
    || isoDate(policy.leaveYearEndDate)
    || isoDate(policy.leaveYearEnd)
    || "";
  if (start && end) return { start, end };
  return { start: `${year}-01-01`, end: `${year}-12-31`, unresolved: "Leave year dates are not recorded authoritatively." };
}

function rounded(value, policy = {}) {
  const mode = textValue(policy.roundingPolicy || "nearest-half-day").toLowerCase();
  if (mode === "none") return Number(value.toFixed(4));
  if (mode === "nearest-hour") return Math.round(value);
  if (mode === "up-half-day") return Math.ceil(value * 2) / 2;
  return Math.round(value * 2) / 2;
}

function normalWorkingWeekdays(staff = {}) {
  if (Array.isArray(staff.normalWorkingWeekdays) && staff.normalWorkingWeekdays.length) {
    return new Set(staff.normalWorkingWeekdays.map((day) => Number(day)).filter((day) => day >= 0 && day <= 6));
  }
  const pattern = textValue(staff.normalWorkingPattern).toLowerCase();
  const namedDays = [
    ["sunday", 0],
    ["monday", 1],
    ["tuesday", 2],
    ["wednesday", 3],
    ["thursday", 4],
    ["friday", 5],
    ["saturday", 6]
  ];
  if (/mon(day)?\s*(to|-)\s*fri(day)?|monday to friday|weekdays/.test(pattern)) return new Set([1, 2, 3, 4, 5]);
  const matched = namedDays.filter(([name]) => pattern.includes(name)).map(([, day]) => day);
  if (matched.length) return new Set(matched);
  const contractedDays = Math.round(numberValue(staff.contractedWorkingDaysPerWeek || staff.normalWorkingDays));
  return new Set([1, 2, 3, 4, 5, 6, 0].slice(0, Math.max(0, Math.min(contractedDays, 7))));
}

function bankHolidayEventsForLeaveYear(leaveYear = {}, calendar = ENGLAND_WALES_BANK_HOLIDAYS) {
  return calendar
    .filter((holiday) => isoDate(holiday.date) && holiday.date >= leaveYear.start && holiday.date <= leaveYear.end)
    .map((holiday) => ({ title: textValue(holiday.title || "Bank holiday"), date: holiday.date }));
}

function countedBankHolidays(staff = {}, leaveYear = {}, calendar = ENGLAND_WALES_BANK_HOLIDAYS) {
  const weekdays = normalWorkingWeekdays(staff);
  return bankHolidayEventsForLeaveYear(leaveYear, calendar)
    .filter((holiday) => weekdays.has(isoWeekday(holiday.date)));
}

function requestDaysInLeaveYear(request = {}, leaveYear = {}, staff = {}, excludedDates = new Set()) {
  const start = isoDate(request.startDate || request.from || request.date);
  const end = isoDate(request.endDate || request.to || request.date || start);
  if (!start) return 0;
  const weekdays = normalWorkingWeekdays(staff);
  const workingDates = dateRangeValues(start, end)
    .filter((date) => date >= leaveYear.start && date <= leaveYear.end)
    .filter((date) => weekdays.has(isoWeekday(date)))
    .filter((date) => !excludedDates.has(date));
  if (request.dayType === "Half day" && workingDates.length === 1) return 0.5;
  if (workingDates.length) return workingDates.length;
  const explicit = Number(request.days || request.workingDays);
  if (Number.isFinite(explicit) && start >= leaveYear.start && end <= leaveYear.end) return explicit;
  return overlapDays(start, end, leaveYear.start, leaveYear.end);
}

function approvedLeaveBreakdown(staff = {}, holidayRequests = [], leaveYear = {}, excludedDates = new Set()) {
  const staffId = textValue(staff.staffId);
  const name = textValue(staff.name);
  const approved = [];
  const futureApproved = [];
  const ignored = [];
  const today = new Date().toISOString().slice(0, 10);
  holidayRequests.forEach((request) => {
    const matches = textValue(request.staffId) === staffId || (!textValue(request.staffId) && textValue(request.name) === name);
    if (!matches) return;
    const days = requestDaysInLeaveYear(request, leaveYear, staff, excludedDates);
    if (!days) return;
    const status = textValue(request.status).toLowerCase();
    if (status === "approved") {
      const start = isoDate(request.startDate || request.from || request.date);
      (start > today ? futureApproved : approved).push({ requestId: textValue(request.holidayRequestId || request.id), days });
    } else if (["pending", "rejected", "declined", "cancelled", "canceled"].includes(status)) {
      ignored.push({ requestId: textValue(request.holidayRequestId || request.id), status: request.status, days });
    }
  });
  return {
    approvedTaken: approved.reduce((sum, item) => sum + item.days, 0),
    approvedFuture: futureApproved.reduce((sum, item) => sum + item.days, 0),
    ignored
  };
}

function manualAdjustmentTotal(staff = {}, leaveYear = {}) {
  const adjustments = Array.isArray(staff.holidayAdjustments) ? staff.holidayAdjustments : [];
  return adjustments
    .filter((adjustment) => textValue(adjustment.leaveYearStart || adjustment.year) === leaveYear.start || textValue(adjustment.year) === leaveYear.start.slice(0, 4))
    .reduce((sum, adjustment) => sum + numberValue(adjustment.amount || adjustment.days || adjustment.hours), 0);
}

function manualAdjustmentAuditIssues(staff = {}, leaveYear = {}) {
  const adjustments = Array.isArray(staff.holidayAdjustments) ? staff.holidayAdjustments : [];
  return adjustments
    .filter((adjustment) => textValue(adjustment.leaveYearStart || adjustment.year) === leaveYear.start || textValue(adjustment.year) === leaveYear.start.slice(0, 4))
    .flatMap((adjustment) => {
      const missing = [];
      if (!textValue(adjustment.directorUserId || adjustment.reviewedBy || adjustment.createdBy)) missing.push("Manual adjustment missing director.");
      if (!textValue(adjustment.reason)) missing.push("Manual adjustment missing reason.");
      if (!textValue(adjustment.previousValue)) missing.push("Manual adjustment missing previous value.");
      if (!textValue(adjustment.newValue)) missing.push("Manual adjustment missing new value.");
      if (!isoDate(String(adjustment.timestamp || adjustment.createdAt || "").slice(0, 10))) missing.push("Manual adjustment missing timestamp.");
      return missing;
    });
}

function requiredSetupFields(staff = {}, policy = {}) {
  const missing = [];
  if (!isoDate(staff.employmentStartDate)) missing.push("Employment start date");
  if (!textValue(staff.employmentStatus || staff.status)) missing.push("Active employee status");
  if (!textValue(staff.staffCategory || staff.role)) missing.push("Office or technician classification");
  if (staff.payrollActive !== true && staff.payrollActive !== false) missing.push("Payroll-active status");
  if (!numberValue(staff.contractedWorkingDaysPerWeek || staff.normalWorkingDays)) missing.push("Contracted working days per week");
  if (!numberValue(staff.contractedHoursPerWeek || staff.normalHours)) missing.push("Contracted hours per week");
  if (!textValue(staff.workingPatternType)) missing.push("Regular-hours, irregular-hours or part-year classification");
  if (!textValue(staff.normalWorkingPattern)) missing.push("Normal working pattern");
  if (!textValue(staff.contractualAnnualHolidayEntitlement) && !textValue(staff.holidayAllowance)) missing.push("Contractual annual holiday entitlement");
  if (staff.bankHolidaysIncluded !== true && staff.bankHolidaysIncluded !== false && policy.bankHolidaysIncluded !== true && policy.bankHolidaysIncluded !== false) missing.push("Whether bank holidays are included");
  if (!isoDate(staff.leaveYearStartDate) && !isoDate(policy.leaveYearStartDate)) missing.push("Applicable leave-year start date");
  if (!isoDate(staff.leaveYearEndDate) && !isoDate(policy.leaveYearEndDate)) missing.push("Applicable leave-year end date");
  return missing;
}

function calculateHolidayEntitlement(staff = {}, options = {}) {
  const year = String(options.year || new Date().getFullYear());
  const policy = options.policy || {};
  const leaveYear = leaveYearFor(year, staff, policy);
  const bankHolidaysIncluded = staff.bankHolidaysIncluded ?? policy.bankHolidaysIncluded ?? "";
  const bankHolidayCalendar = Array.isArray(options.bankHolidays)
    ? options.bankHolidays
    : Array.isArray(policy.bankHolidays)
      ? policy.bankHolidays
      : ENGLAND_WALES_BANK_HOLIDAYS;
  const bankHolidays = bankHolidaysIncluded === true ? countedBankHolidays(staff, leaveYear, bankHolidayCalendar) : [];
  const bankHolidayDates = new Set(bankHolidays.map((holiday) => holiday.date));
  const missing = requiredSetupFields(staff, policy);
  if (leaveYear.unresolved && !missing.includes("Applicable leave-year start date")) missing.push("Applicable leave-year start date");
  if (leaveYear.unresolved && !missing.includes("Applicable leave-year end date")) missing.push("Applicable leave-year end date");

  const workingPatternType = textValue(staff.workingPatternType).toLowerCase();
  const contractedDays = numberValue(staff.contractedWorkingDaysPerWeek || staff.normalWorkingDays);
  const contractedHours = numberValue(staff.contractedHoursPerWeek || staff.normalHours);
  const statutoryDays = Math.min(contractedDays * 5.6, 28);
  const contractualEntitlement = numberValue(staff.contractualAnnualHolidayEntitlement || staff.holidayAllowance);
  let entitlement = Math.max(statutoryDays, contractualEntitlement || statutoryDays);
  let unit = textValue(staff.holidayEntitlementUnit || "days").toLowerCase() === "hours" ? "hours" : "days";
  const breakdown = [];
  breakdown.push(`Rule version: ${HOLIDAY_RULE_VERSION}`);
  breakdown.push(`Statutory minimum: 5.6 weeks, capped at 28 days for five or more working days.`);

  if (workingPatternType.includes("irregular") || workingPatternType.includes("part-year")) {
    const leaveYearStartsAfterReform = leaveYear.start >= "2024-04-01";
    if (!leaveYearStartsAfterReform) {
      missing.push("Irregular/part-year leave year requires authorised pre-April-2024 policy.");
    } else {
      unit = "hours";
      const actualHours = numberValue(options.actualHoursWorked || staff.actualHoursWorkedInLeaveYear);
      if (!actualHours) missing.push("Actual hours worked for irregular-hours/part-year accrual");
      const contractWeeks = contractualEntitlement && contractedDays ? contractualEntitlement / contractedDays : 5.6;
      const workingWeeks = Math.max(52 - contractWeeks, 1);
      const accrualPercentage = (contractWeeks / workingWeeks) * 100;
      entitlement = actualHours * (accrualPercentage / 100);
      breakdown.push(`Irregular/part-year accrual: ${accrualPercentage.toFixed(2)}% of actual hours worked.`);
    }
  } else if (unit === "hours") {
    const averageDay = contractedDays ? contractedHours / contractedDays : 0;
    entitlement *= averageDay;
    breakdown.push(`Regular-hours entitlement converted to hours using ${averageDay.toFixed(2)} average hours per working day.`);
  }

  const employmentStart = isoDate(staff.employmentStartDate);
  const employmentEnd = isoDate(staff.employmentEndDate);
  if (employmentStart || employmentEnd) {
    const effectiveStart = employmentStart && employmentStart > leaveYear.start ? employmentStart : leaveYear.start;
    const effectiveEnd = employmentEnd && employmentEnd < leaveYear.end ? employmentEnd : leaveYear.end;
    const totalYearDays = daysBetweenInclusive(leaveYear.start, leaveYear.end);
    const employedDays = overlapDays(effectiveStart, effectiveEnd, leaveYear.start, leaveYear.end);
    if (totalYearDays && employedDays && employedDays < totalYearDays) {
      entitlement *= employedDays / totalYearDays;
      breakdown.push(`Pro-rated for ${employedDays} employed days in the leave year.`);
    }
  }

  const adjustment = manualAdjustmentTotal(staff, leaveYear);
  const adjustmentAuditIssues = manualAdjustmentAuditIssues(staff, leaveYear);
  if (adjustment) breakdown.push(`Manual authorised adjustment applied: ${adjustment}.`);
  const leave = approvedLeaveBreakdown(staff, options.holidayRequests || [], leaveYear, bankHolidayDates);
  const adjustedEntitlement = rounded(entitlement + adjustment, policy);
  const bankHolidayCount = unit === "hours"
    ? bankHolidays.length * (contractedDays ? contractedHours / contractedDays : 0)
    : bankHolidays.length;
  const bankHolidayDeduction = rounded(bankHolidayCount, policy);
  const totalLeaveUsed = rounded(bankHolidayDeduction + leave.approvedTaken, policy);
  const totalLeaveCommitted = rounded(bankHolidayDeduction + leave.approvedTaken + leave.approvedFuture, policy);
  return {
    staffId: textValue(staff.staffId),
    year,
    leaveYearStart: leaveYear.start,
    leaveYearEnd: leaveYear.end,
    ruleVersion: HOLIDAY_RULE_VERSION,
    unit,
    setupStatus: missing.length ? "Setup required" : "Ready",
    missingSetupFields: missing,
    manualAdjustmentAuditIssues: adjustmentAuditIssues,
    statutoryEntitlement: rounded(statutoryDays, policy),
    contractualEntitlement: contractualEntitlement || "",
    calculatedEntitlement: adjustedEntitlement,
    totalAnnualEntitlement: adjustedEntitlement,
    bankHolidaysCounted: bankHolidayDeduction,
    bankHolidayDates: bankHolidays,
    approvedLeaveTaken: leave.approvedTaken,
    employeeBookedLeaveTaken: leave.approvedTaken,
    approvedFutureLeave: leave.approvedFuture,
    futureBookedLeave: leave.approvedFuture,
    totalLeaveUsed,
    remainingEntitlement: rounded(adjustedEntitlement - totalLeaveCommitted, policy),
    pendingRejectedCancelledExcluded: leave.ignored.length,
    bankHolidaysIncluded,
    breakdown: [
      ...breakdown,
      `Total annual entitlement: ${adjustedEntitlement} ${unit}.`,
      `Bank holidays counted: ${bankHolidayDeduction} ${unit}.`,
      `Employee-booked leave taken: ${leave.approvedTaken} ${unit}.`,
      `Future booked leave: ${leave.approvedFuture} ${unit}.`,
      `Remaining entitlement: ${rounded(adjustedEntitlement - totalLeaveCommitted, policy)} ${unit}.`
    ]
  };
}

module.exports = {
  ENGLAND_WALES_BANK_HOLIDAYS,
  HOLIDAY_RULE_VERSION,
  calculateHolidayEntitlement,
  countedBankHolidays,
  requiredSetupFields
};
