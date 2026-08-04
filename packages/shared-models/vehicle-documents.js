"use strict";

const crypto = require("crypto");
const { generateStableId } = require("./id-generator");

const VEHICLE_DOCUMENT_TYPES = Object.freeze([
  "MOT",
  "Insurance",
  "Road Tax",
  "Breakdown Cover",
  "Lease / Finance",
  "V5C / Registration",
  "Service Record",
  "Repair Record",
  "Inspection Record",
  "Warranty",
  "Recovery Information",
  "Other"
]);

const VEHICLE_MAINTENANCE_EVENT_TYPES = Object.freeze([
  "Service",
  "Repair",
  "Maintenance",
  "Inspection",
  "MOT",
  "Tyres",
  "Breakdown",
  "Other"
]);

const VEHICLE_DOCUMENT_STATUSES = Object.freeze([
  "Current",
  "Expiring Soon",
  "Expired",
  "Superseded",
  "Inactive",
  "Not Applicable"
]);

const VEHICLE_DOCUMENT_DEFAULT_REMINDER_DAYS = 60;

function textValue(value) {
  return String(value ?? "").trim();
}

function normaliseVehicleDocumentType(value) {
  const supplied = textValue(value);
  return VEHICLE_DOCUMENT_TYPES.find((type) => type.toLowerCase() === supplied.toLowerCase()) || "";
}

function normaliseMaintenanceEventType(value) {
  const supplied = textValue(value);
  return VEHICLE_MAINTENANCE_EVENT_TYPES.find((type) => type.toLowerCase() === supplied.toLowerCase()) || "";
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysUntil(dateValue, now = new Date()) {
  if (!dateValue) return Number.POSITIVE_INFINITY;
  const target = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date(`${localDateValue(now)}T00:00:00`);
  return Math.ceil((target - today) / 86400000);
}

function vehicleDocumentStatus(document = {}, now = new Date()) {
  const status = textValue(document.status);
  if (status === "Superseded" || status === "Inactive" || status === "Not Applicable") {
    return { label: status, value: status, className: status === "Superseded" ? "warning" : "ok", days: Number.POSITIVE_INFINITY };
  }
  if (document.noExpiry || !document.expiryDate) {
    return { label: "Current", value: "Current", className: "ok", days: Number.POSITIVE_INFINITY };
  }
  const days = daysUntil(document.expiryDate, now);
  if (days < 0) return { label: "Expired", value: "Expired", className: "urgent", days };
  const reminderDays = Number(document.reminderDays || VEHICLE_DOCUMENT_DEFAULT_REMINDER_DAYS);
  if (days <= reminderDays) return { label: "Expiring Soon", value: "Expiring Soon", className: "warning", days };
  return { label: "Current", value: "Current", className: "ok", days };
}

function vehicleDocumentIdFor(vehicleId, document = {}) {
  if (textValue(document.documentId).startsWith("DOC-")) return textValue(document.documentId);
  return generateStableId("DOC", [
    "vehicle-document",
    vehicleId,
    document.documentType,
    document.title,
    document.issueDate,
    document.expiryDate,
    document.reference,
    document.originalFileName || document.fileName || document.document?.name || crypto.randomUUID()
  ]);
}

function vehicleMaintenanceIdFor(vehicleId, record = {}) {
  if (textValue(record.maintenanceId).startsWith("DOC-")) return textValue(record.maintenanceId);
  return generateStableId("DOC", [
    "vehicle-maintenance",
    vehicleId,
    record.eventType,
    record.date,
    record.mileage,
    record.supplier,
    record.description,
    record.evidence?.originalFileName || record.evidence?.fileName || crypto.randomUUID()
  ]);
}

function validateVehicleDocumentPayload(payload = {}) {
  const errors = [];
  if (!textValue(payload.vehicleId)) errors.push("Vehicle ID is required.");
  if (!normaliseVehicleDocumentType(payload.documentType)) errors.push("A valid document type is required.");
  if (!textValue(payload.title)) errors.push("Document title is required.");
  if (!payload.noExpiry && !textValue(payload.expiryDate) && ["MOT", "Insurance", "Breakdown Cover", "Warranty"].includes(normaliseVehicleDocumentType(payload.documentType))) {
    errors.push("Expiry date is required for this document type unless marked not applicable.");
  }
  return errors;
}

function validateVehicleMaintenancePayload(payload = {}) {
  const errors = [];
  if (!textValue(payload.vehicleId)) errors.push("Vehicle ID is required.");
  if (!normaliseMaintenanceEventType(payload.eventType)) errors.push("A valid event type is required.");
  if (!textValue(payload.date)) errors.push("Event date is required.");
  if (!textValue(payload.description)) errors.push("Description is required.");
  return errors;
}

module.exports = {
  VEHICLE_DOCUMENT_DEFAULT_REMINDER_DAYS,
  VEHICLE_DOCUMENT_STATUSES,
  VEHICLE_DOCUMENT_TYPES,
  VEHICLE_MAINTENANCE_EVENT_TYPES,
  daysUntil,
  normaliseMaintenanceEventType,
  normaliseVehicleDocumentType,
  validateVehicleDocumentPayload,
  validateVehicleMaintenancePayload,
  vehicleDocumentIdFor,
  vehicleDocumentStatus,
  vehicleMaintenanceIdFor
};
