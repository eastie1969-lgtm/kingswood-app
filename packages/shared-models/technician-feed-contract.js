"use strict";

const CONTRACT_VERSION = "tech-feed-v1.0";
const SOURCE_SYSTEM = "Kingswood Connect Hub";

const TECHNICIAN_FEED_SCHEMA = Object.freeze({
  contractVersion: CONTRACT_VERSION,
  requiredEnvelopeFields: [
    "contractVersion",
    "generatedAt",
    "userId",
    "staffId",
    "technicianId",
    "sourceSystem",
    "dataVersion",
  ],
  sections: {
    technician: {
      required: ["technicianId", "staffId", "name", "status", "appAccessStatus"],
      optional: ["assignedVehicleId", "lastAppActivityAt", "pinSet"],
      permission: "own technician profile summary only",
    },
    jobs: {
      required: ["jobId", "jobDate", "slot", "address", "postcode", "status"],
      optional: [
        "jobReference",
        "clientName",
        "jobTitle",
        "mainClient",
        "siteName",
        "contactName",
        "contactTelephone",
        "accessInstructions",
        "jobInstructions",
        "previousVisitNotes",
        "reportNotes",
        "jobDescription",
        "reportId",
        "reportSubmittedAt",
        "completedAt",
        "oneDriveReportFolder",
        "ramsIds",
        "documentIds",
        "changeLog",
      ],
      permission: "assignedTechnicianId must equal authenticated technicianId",
      excludes: ["officeNotes", "valuationCost", "clientFinancials", "otherTechnicianData"],
    },
    cancellations: {
      required: ["jobId", "cancelledAt", "reasonVisibleToTechnician"],
      optional: ["replacementJobId"],
      permission: "assigned technician only",
    },
    rams: {
      required: ["ramsId", "title", "status"],
      optional: ["jobId", "documentId", "reviewDate", "readRequired"],
      permission: "RAMS linked to own assigned jobs only",
    },
    documents: {
      required: ["documentId", "ownerType", "ownerId", "documentType", "fileName", "status"],
      optional: ["mimeType", "fileSize", "version", "friendlyUrl"],
      permission: "documents linked to own jobs, own RAMS, own training or own vehicle only",
      excludes: ["storageLocationRaw", "directorsDocuments", "payrollDocuments"],
    },
    holidays: {
      required: ["staffId", "entitlementDays", "usedDays", "remainingDays", "requests"],
      optional: ["companyHolidayDeductions", "currentYear"],
      permission: "own staffId only",
    },
    messages: {
      required: ["messageId", "threadId", "senderId", "createdAt", "body", "status"],
      optional: ["attachments", "priority", "readAt"],
      permission: "authenticated technician must be a thread member",
    },
    toolboxTalks: {
      required: ["toolboxTalkId", "title", "assignedAt", "status"],
      optional: ["deadline", "documentIds", "requiresSignature", "acknowledgedAt", "signedAt"],
      permission: "assigned technician only",
    },
    trainingAcknowledgements: {
      required: ["trainingRecordId", "title", "status"],
      optional: ["expiryDate", "documentId", "acknowledgedAt"],
      permission: "own staffId only",
    },
    vehicle: {
      required: ["vehicleId", "registration", "status"],
      optional: ["vehicle", "make", "model", "assignedStaffId", "assignedTechnicianId", "inspectionRequirements", "nextInspectionDue"],
      permission: "assigned vehicle only",
    },
    notifications: {
      required: ["notificationId", "type", "priority", "title", "message", "createdAt", "status"],
      optional: ["relatedEntityType", "relatedEntityId", "expiresAt", "readAt"],
      permission: "recipientUserId, recipientRole or recipient technician must match authenticated user",
    },
    sync: {
      required: ["syncStatus", "lastSuccessfulSyncAt"],
      optional: ["pendingCount", "lastError"],
      permission: "own device/session only",
    },
  },
  forbiddenSections: [
    "fullStaffList",
    "payroll",
    "salary",
    "directorsArea",
    "confidentialHr",
    "valuations",
    "clientFinancialInformation",
    "officeOnlyNotes",
    "unrestrictedCompanyDocuments",
  ],
});

function assertAuthenticatedTechnician(context) {
  if (!context || !context.userId || !context.staffId || !context.technicianId) {
    throw new Error("Authenticated technician context is required.");
  }
  if (context.role !== "Technician") {
    throw new Error("Technician feed requires Technician role.");
  }
}

function assertOwnTechnicianRecord(context, technician) {
  assertAuthenticatedTechnician(context);
  if (!technician || technician.technicianId !== context.technicianId || technician.staffId !== context.staffId) {
    throw new Error("Technician profile does not belong to authenticated technician.");
  }
}

function isOwnJob(context, job) {
  return Boolean(job && job.assignedTechnicianId === context.technicianId);
}

function isDeliveredJob(job) {
  const status = String(job?.dispatchStatus || job?.deliveryStatus || job?.status || "").toLowerCase();
  return Boolean(job?.sentToTech || job?.publishedToTech)
    || ["sent", "received", "acknowledged", "changed", "cancelled", "withdrawal", "withdrawn", "completed"].some((state) => status.includes(state));
}

function createTechnicianFeed(context, records, options = {}) {
  assertAuthenticatedTechnician(context);
  const technician = records.technician;
  assertOwnTechnicianRecord(context, technician);

  const ownJobs = (records.jobs || []).filter((job) => isOwnJob(context, job) && isDeliveredJob(job));
  const ownJobIds = new Set(ownJobs.map((job) => job.jobId));
  const ownRamsIds = new Set(ownJobs.flatMap((job) => job.ramsIds || []));
  const ownDocumentIds = new Set(ownJobs.flatMap((job) => job.documentIds || []));

  return {
    contractVersion: CONTRACT_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    userId: context.userId,
    staffId: context.staffId,
    technicianId: context.technicianId,
    sourceSystem: SOURCE_SYSTEM,
    dataVersion: options.dataVersion || "test-data-v1",
    technician: sanitiseTechnician(technician),
    jobs: ownJobs.map(sanitiseJob),
    cancellations: (records.cancellations || []).filter((item) => ownJobIds.has(item.jobId)).map(sanitiseCancellation),
    rams: (records.rams || []).filter((item) => ownRamsIds.has(item.ramsId) || ownJobIds.has(item.jobId)).map(sanitiseRams),
    documents: (records.documents || [])
      .filter((item) => ownDocumentIds.has(item.documentId) || ownJobIds.has(item.ownerId) || ownRamsIds.has(item.ownerId) || item.ownerId === context.staffId)
      .map(sanitiseDocument),
    holidays: sanitiseHolidays(records.holidays, context.staffId),
    messages: (records.messages || []).filter((item) => (item.participantIds || []).includes(context.userId)).map(sanitiseMessage),
    toolboxTalks: (records.toolboxTalks || []).filter((item) => (item.assignedTechnicianIds || []).includes(context.technicianId)).map(sanitiseToolboxTalk),
    trainingAcknowledgements: (records.trainingAcknowledgements || []).filter((item) => item.staffId === context.staffId).map(sanitiseTraining),
    vehicle: records.vehicle && (records.vehicle.assignedTechnicianId === context.technicianId || records.vehicle.assignedStaffId === context.staffId) ? sanitiseVehicle(records.vehicle) : null,
    notifications: (records.notifications || []).filter((item) => item.recipientUserId === context.userId || item.recipientTechnicianId === context.technicianId).map(sanitiseNotification),
    scheduleDelivery: sanitiseScheduleDelivery(records.scheduleDelivery, context.technicianId),
    sync: {
      syncStatus: "Ready",
      lastSuccessfulSyncAt: options.generatedAt || new Date().toISOString(),
      pendingCount: 0,
    },
  };
}

function sanitiseTechnician(item) {
  return pick(item, ["technicianId", "staffId", "name", "status", "appAccessStatus", "assignedVehicleId", "lastAppActivityAt", "pinSet"]);
}

function sanitiseJob(item) {
  return pick(item, [
    "jobId",
    "jobDate",
    "slot",
    "address",
    "postcode",
    "status",
    "dispatchStatus",
    "deliveryStatus",
    "dispatchVersion",
    "dispatchSentAt",
    "dispatchReceivedAt",
    "dispatchAcknowledgedAt",
    "dispatchAcknowledgedVersion",
    "dispatchResponseVersion",
    "dispatchAvailableAt",
    "dispatchAvailableVersion",
    "dispatchRunningOrder",
    "technicianAcceptedAt",
    "technicianUnableAt",
    "technicianUnableReason",
    "technicianResponse",
    "sentToTech",
    "publishedToTech",
    "changeReason",
    "changeSummary",
    "changeAcknowledgedAt",
    "changeAcknowledgedVersion",
    "cancellationReason",
    "cancellationAcknowledgedAt",
    "cancellationAcknowledgedVersion",
    "cancelledAt",
    "withdrawalReason",
    "withdrawalAcknowledgedAt",
    "withdrawalAcknowledgedVersion",
    "replacementTechnicianName",
    "assignedTechnicianId",
    "jobReference",
    "clientName",
    "jobTitle",
    "mainClient",
    "siteName",
    "contactName",
    "contactTelephone",
    "accessInstructions",
    "jobInstructions",
    "previousVisitNotes",
    "reportNotes",
    "jobDescription",
    "reportId",
    "reportSubmittedAt",
    "completedAt",
    "oneDriveReportFolder",
    "ramsIds",
    "documentIds",
    "changeLog",
  ]);
}

function sanitiseCancellation(item) {
  return pick(item, ["jobId", "cancelledAt", "reasonVisibleToTechnician", "replacementJobId"]);
}

function sanitiseRams(item) {
  return pick(item, ["ramsId", "jobId", "title", "status", "documentId", "reviewDate", "readRequired"]);
}

function sanitiseDocument(item) {
  return pick(item, ["documentId", "ownerType", "ownerId", "documentType", "fileName", "mimeType", "fileSize", "version", "status", "friendlyUrl"]);
}

function sanitiseHolidays(item, staffId) {
  if (!item || item.staffId !== staffId) return null;
  return pick(item, ["staffId", "entitlementDays", "usedDays", "remainingDays", "companyHolidayDeductions", "currentYear", "requests"]);
}

function sanitiseMessage(item) {
  return pick(item, ["messageId", "threadId", "senderId", "createdAt", "body", "status", "attachments", "priority", "readAt"]);
}

function sanitiseToolboxTalk(item) {
  return pick(item, ["toolboxTalkId", "title", "assignedAt", "status", "deadline", "documentIds", "requiresSignature", "acknowledgedAt", "signedAt"]);
}

function sanitiseTraining(item) {
  return pick(item, ["trainingRecordId", "title", "status", "expiryDate", "documentId", "acknowledgedAt"]);
}

function sanitiseVehicle(item) {
  return pick(item, ["vehicleId", "registration", "vehicle", "make", "model", "status", "assignedStaffId", "assignedTechnicianId", "inspectionRequirements", "nextInspectionDue"]);
}

function sanitiseNotification(item) {
  return pick(item, ["notificationId", "type", "priority", "title", "message", "createdAt", "status", "relatedEntityType", "relatedEntityId", "expiresAt", "readAt"]);
}

function sanitiseScheduleDelivery(item, technicianId) {
  if (!item || typeof item !== "object") return {};
  const output = {};
  Object.entries(item).forEach(([key, value]) => {
    if (!value || typeof value !== "object") return;
    if (value.technicianId && value.technicianId !== technicianId) return;
    output[key] = pick(value, ["scheduleId", "technicianId", "date", "status", "sent", "sentAt", "sentBy", "scheduleVersion", "jobCount", "jobIds"]);
  });
  return output;
}

function pick(source, fields) {
  const output = {};
  for (const field of fields) {
    if (source && Object.prototype.hasOwnProperty.call(source, field)) output[field] = source[field];
  }
  return output;
}

module.exports = {
  CONTRACT_VERSION,
  SOURCE_SYSTEM,
  TECHNICIAN_FEED_SCHEMA,
  createTechnicianFeed,
};
