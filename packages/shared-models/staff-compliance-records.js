"use strict";

const { generateStableId } = require("./id-generator");

const TRAINING_RECORD_STATUSES = Object.freeze([
  "Current",
  "Expiring Soon",
  "Expired",
  "Missing / Not Recorded",
  "Not Applicable",
  "Superseded",
  "Inactive",
  "No Expiry",
]);

const TRAINING_ACTION_STATUSES = Object.freeze({
  open: "New",
  closed: "Closed",
});

const trainingStatusPriority = Object.freeze({
  Expired: 1,
  "Expiring Soon": 2,
  "Missing / Not Recorded": 3,
  Current: 4,
  "No Expiry": 5,
  "Not Applicable": 6,
  Superseded: 7,
  Inactive: 8,
});

function textValue(value) {
  return String(value ?? "").trim();
}

function parseIsoDate(value) {
  const text = textValue(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(dateValue, todayValue = new Date().toISOString().slice(0, 10)) {
  const target = parseIsoDate(dateValue);
  const today = parseIsoDate(todayValue);
  if (!target || !today) return 9999;
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function trainingRecordIdFor(record = {}) {
  return generateStableId("DOC", [
    "staff-training",
    record.staffId || record.employee,
    record.course || record.training || record.name,
    record.provider,
    record.completedDate,
    record.expiryDate || (record.noExpiry ? "no-expiry" : ""),
    record.certificateNumber || record.licenceNumber,
  ], { namespace: "kingswood-staff-training-records" });
}

function trainingActionIdFor(record = {}) {
  return generateStableId("ACT", [
    "staff-training-action",
    record.trainingRecordId || record.id,
    record.staffId || record.employee,
    record.course,
  ], { namespace: "kingswood-staff-training-records" });
}

function normaliseTrainingRecordStatus(record = {}, todayValue) {
  const lifecycle = textValue(record.lifecycleStatus || record.recordStatus || record.status);
  if (["Not Applicable", "Superseded", "Inactive", "Missing / Not Recorded"].includes(lifecycle)) {
    return { label: lifecycle, className: lifecycle === "Missing / Not Recorded" ? "warning" : "muted", days: 9999 };
  }
  if (record.noExpiry || textValue(record.expiryDate).toLowerCase() === "no expiry" || !textValue(record.expiryDate)) {
    return { label: "No Expiry", className: "ok", days: 9999 };
  }
  const days = daysUntil(record.expiryDate, todayValue);
  if (days < 0) return { label: "Expired", className: "urgent", days };
  if (days <= 60) return { label: "Expiring Soon", className: "warning", days };
  return { label: "Current", className: "ok", days };
}

function normaliseTrainingRecord(record = {}, staffProfiles = [], options = {}) {
  const staff = staffProfiles.find((profile) =>
    (record.staffId && textValue(profile.staffId) === textValue(record.staffId))
    || (record.employee && textValue(profile.name).toLowerCase() === textValue(record.employee).toLowerCase())
  );
  const base = {
    ...record,
    id: textValue(record.id || record.trainingRecordId),
    trainingRecordId: textValue(record.trainingRecordId || record.id),
    staffId: textValue(record.staffId || staff?.staffId),
    employee: textValue(record.employee || staff?.name),
    course: textValue(record.course || record.training || record.name),
    provider: textValue(record.provider),
    certificateNumber: textValue(record.certificateNumber || record.licenceNumber),
    noExpiry: Boolean(record.noExpiry || textValue(record.expiryDate).toLowerCase() === "no expiry"),
    certificate: textValue(record.certificate || record.documentFileName),
    documentFileName: textValue(record.documentFileName || record.certificate),
    oneDriveLocation: textValue(record.oneDriveLocation || record.documentLocation),
    lifecycleStatus: textValue(record.lifecycleStatus || record.recordStatus || record.status),
    createdAt: textValue(record.createdAt || options.now),
    updatedAt: textValue(record.updatedAt || record.createdAt || options.now),
    year: textValue(record.year || record.completedDate || record.expiryDate || options.today || "").slice(0, 4),
  };
  if (!base.trainingRecordId) base.trainingRecordId = trainingRecordIdFor(base);
  if (!base.id) base.id = base.trainingRecordId;
  const status = normaliseTrainingRecordStatus(base, options.today);
  return {
    ...base,
    status: status.label,
    statusCategory: status.className,
  };
}

function compareTrainingRecords(a = {}, b = {}) {
  const statusA = trainingStatusPriority[a.status] || 99;
  const statusB = trainingStatusPriority[b.status] || 99;
  if (statusA !== statusB) return statusA - statusB;
  return textValue(a.course).localeCompare(textValue(b.course));
}

function buildStaffComplianceRollup(data = {}, staffId = "", options = {}) {
  const staffProfiles = Array.isArray(data.staffProfiles) ? data.staffProfiles : [];
  const staff = staffProfiles.find((profile) => textValue(profile.staffId) === textValue(staffId));
  if (!staff) return null;
  const trainingRecords = (data.trainingMatrix || [])
    .map((record) => normaliseTrainingRecord(record, staffProfiles, options))
    .filter((record) => record.staffId === staff.staffId)
    .sort(compareTrainingRecords);
  const toolboxAssignments = (data.tscAssignmentRecords || [])
    .filter((assignment) => textValue(assignment.staffId || assignment.employeeId) === staff.staffId);
  const evidence = (data.tscEvidenceRecords || [])
    .filter((record) => textValue(record.staffId || record.employeeId) === staff.staffId);
  const assets = (data.assets || [])
    .filter((asset) => textValue(asset.assignedStaffId || asset.staffId) === staff.staffId);
  const vehicle = (data.vehicles || [])
    .find((item) => textValue(item.assignedStaffId) === staff.staffId || (staff.technicianId && textValue(item.assignedTechnicianId) === textValue(staff.technicianId))) || null;
  const openActions = (data.actionItems || [])
    .filter((item) => textValue(item.staffId || item.assignedStaffId || item.assignedToUserId) === staff.staffId && !["Closed", "Completed", "Resolved"].includes(textValue(item.status)));
  const audit = (data.universalAuditEvents || [])
    .filter((event) => textValue(event.entityId) === staff.staffId || textValue(event.staffId) === staff.staffId || textValue(event.recordId) === staff.staffId)
    .slice(-20)
    .reverse();
  return { staff, trainingRecords, toolboxAssignments, evidence, assets, vehicle, openActions, audit };
}

function syncTrainingActionItems(data = {}, record = {}, options = {}) {
  data.actionItems = Array.isArray(data.actionItems) ? data.actionItems : [];
  const status = normaliseTrainingRecordStatus(record, options.today);
  const actionId = trainingActionIdFor(record);
  const existing = data.actionItems.find((item) => textValue(item.actionId) === actionId);
  const needsAction = ["Expired", "Expiring Soon", "Missing / Not Recorded"].includes(status.label);
  if (!needsAction) {
    if (existing && existing.status !== TRAINING_ACTION_STATUSES.closed) {
      existing.status = TRAINING_ACTION_STATUSES.closed;
      existing.completedAt = options.now || new Date().toISOString();
      existing.auditTrail = [...(existing.auditTrail || []), { action: "Closed by training record status", at: existing.completedAt, status: status.label }];
      return { changed: true, actionId, closed: true };
    }
    return { changed: false, actionId, closed: false };
  }
  if (existing) return { changed: false, actionId, existing: true };
  data.actionItems.push({
    actionId,
    type: "Compliance Expiry",
    priority: status.label === "Expired" ? "High" : "Medium",
    title: `${record.course || "Training"} ${status.label}`,
    description: `${record.employee || "Staff member"} training record requires office review.`,
    staffId: record.staffId || "",
    assignedStaffId: record.staffId || "",
    relatedEntityType: "TrainingRecord",
    relatedEntityId: record.trainingRecordId || record.id || "",
    status: TRAINING_ACTION_STATUSES.open,
    raisedAt: options.now || new Date().toISOString(),
    dueDate: record.expiryDate || "",
    auditTrail: [{ action: "Created from training record status", at: options.now || new Date().toISOString(), status: status.label }]
  });
  return { changed: true, actionId, created: true };
}

module.exports = {
  TRAINING_RECORD_STATUSES,
  buildStaffComplianceRollup,
  normaliseTrainingRecord,
  normaliseTrainingRecordStatus,
  syncTrainingActionItems,
  trainingActionIdFor,
  trainingRecordIdFor,
};
