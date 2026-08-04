"use strict";

const { generateStableId } = require("./id-generator");

const ALLOWED_TECHNICIAN_EVENT_TYPES = Object.freeze([
  "JobAccepted",
  "UnableToComplete",
  "ReportSubmitted",
  "PhotoUploaded",
  "SignatureCaptured",
  "RecommendationRaised",
  "HolidayRequested",
  "ToolboxTalkAcknowledged",
  "ToolboxTalkSigned",
  "VehicleInspectionSubmitted",
  "MessageSent",
]);

const REJECTED_MANUAL_STATUS_EVENTS = Object.freeze([
  "EnRoute",
  "Arrived",
  "WorkStarted",
  "WorkCompleted",
  "Travelling",
  "NearSite",
  "OnSite",
  "LeftSite",
]);

const TECHNICIAN_RETURN_EVENT_SCHEMA = Object.freeze({
  required: [
    "eventId",
    "eventType",
    "technicianId",
    "staffId",
    "relatedEntityType",
    "relatedEntityId",
    "occurredAt",
    "sourceApp",
    "payload",
    "correlationId",
    "syncStatus",
  ],
  optional: ["deviceId"],
  allowedEventTypes: ALLOWED_TECHNICIAN_EVENT_TYPES,
  rejectedManualStatusEvents: REJECTED_MANUAL_STATUS_EVENTS,
  syncStatuses: ["Pending", "Synced", "Failed", "Rejected"],
});

function createTechnicianEvent(eventType, context, relatedEntityType, relatedEntityId, payload = {}, options = {}) {
  const occurredAt = options.occurredAt || new Date().toISOString();
  const correlationId = options.correlationId || generateStableId("EVT", [eventType, context.technicianId, relatedEntityId, occurredAt]);
  const event = {
    eventId: options.eventId || generateStableId("EVT", [eventType, context.technicianId, relatedEntityId, occurredAt, options.deviceId || "no-device"]),
    eventType,
    technicianId: context.technicianId,
    staffId: context.staffId,
    relatedEntityType,
    relatedEntityId,
    occurredAt,
    sourceApp: "Technician App",
    payload,
    correlationId,
    syncStatus: options.syncStatus || "Pending",
  };
  if (options.deviceId) event.deviceId = options.deviceId;
  return event;
}

function validateTechnicianEvent(event, context) {
  const errors = [];

  if (!event || typeof event !== "object") return { valid: false, errors: ["Event object is required."] };
  for (const field of TECHNICIAN_RETURN_EVENT_SCHEMA.required) {
    if (event[field] === undefined || event[field] === null || event[field] === "") errors.push(`${field} is required.`);
  }
  if (REJECTED_MANUAL_STATUS_EVENTS.includes(event.eventType)) {
    errors.push(`${event.eventType} is rejected. Travel and work status must be derived by tracking/geofencing, not manual buttons.`);
  }
  if (!ALLOWED_TECHNICIAN_EVENT_TYPES.includes(event.eventType)) {
    errors.push(`${event.eventType} is not an allowed technician event.`);
  }
  if (context) {
    if (event.technicianId !== context.technicianId) errors.push("technicianId does not match authenticated technician.");
    if (event.staffId !== context.staffId) errors.push("staffId does not match authenticated technician.");
  }

  validatePayload(event, errors);
  return { valid: errors.length === 0, errors };
}

function validatePayload(event, errors) {
  const payload = event.payload || {};
  switch (event.eventType) {
    case "JobAccepted":
      requireRelated(event, "Job", errors);
      break;
    case "UnableToComplete":
      requireRelated(event, "Job", errors);
      if (!payload.reason) errors.push("UnableToComplete requires a reason.");
      break;
    case "ReportSubmitted":
      requireRelated(event, "Job", errors);
      if (!payload.reportId) errors.push("ReportSubmitted requires reportId.");
      break;
    case "PhotoUploaded":
      if (!payload.jobId && !payload.reportId) errors.push("PhotoUploaded requires jobId or reportId.");
      if (!payload.document || !payload.document.documentId || !payload.document.fileName) errors.push("PhotoUploaded requires document metadata.");
      break;
    case "SignatureCaptured":
      if (!payload.signatureDocumentId && !payload.signatureDataRef) errors.push("SignatureCaptured requires a signature reference.");
      break;
    case "RecommendationRaised":
      if (!payload.title || !payload.description) errors.push("RecommendationRaised requires title and description.");
      break;
    case "HolidayRequested":
      requireRelated(event, "HolidayRequest", errors);
      if (!payload.from || !payload.to || payload.days === undefined) errors.push("HolidayRequested requires from, to and days.");
      break;
    case "ToolboxTalkAcknowledged":
      requireRelated(event, "ToolboxTalk", errors);
      break;
    case "ToolboxTalkSigned":
      requireRelated(event, "ToolboxTalk", errors);
      if (!payload.signature || !payload.signedAt) errors.push("ToolboxTalkSigned requires signature and timestamp.");
      break;
    case "VehicleInspectionSubmitted":
      requireRelated(event, "Vehicle", errors);
      if (!payload.vehicleId || !payload.result) errors.push("VehicleInspectionSubmitted requires vehicleId and inspection result.");
      break;
    case "MessageSent":
      if (!payload.recipientUserId && !payload.threadId) errors.push("MessageSent requires a recipient or valid threadId.");
      if (!payload.body) errors.push("MessageSent requires message body.");
      break;
  }
}

function requireRelated(event, expectedType, errors) {
  if (event.relatedEntityType !== expectedType) errors.push(`${event.eventType} must relate to ${expectedType}.`);
  if (!event.relatedEntityId) errors.push(`${event.eventType} requires relatedEntityId.`);
}

module.exports = {
  ALLOWED_TECHNICIAN_EVENT_TYPES,
  REJECTED_MANUAL_STATUS_EVENTS,
  TECHNICIAN_RETURN_EVENT_SCHEMA,
  createTechnicianEvent,
  validateTechnicianEvent,
};
