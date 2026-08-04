"use strict";

const TECHNICIAN_ACCESS_RULES = Object.freeze({
  authentication: [
    "Request must include a verified authenticated user identity.",
    "Authenticated user must map to exactly one StaffMember.",
    "Technician feed requires a TechnicianProfile linked to the same staffId.",
  ],
  ownershipChecks: {
    staff: "staffId must equal authenticated staffId.",
    technician: "technicianId must equal authenticated technicianId.",
    job: "assignedTechnicianId must equal authenticated technicianId.",
    rams: "RAMS must be linked to a job assigned to the authenticated technician or directly assigned to technicianId.",
    document: "document owner must be an authorised own job, own report, own RAMS, own staff record, own training record or assigned vehicle.",
    message: "authenticated user must be a member of the message thread.",
    toolboxTalk: "toolbox talk assignment must include authenticated technicianId.",
    vehicle: "vehicle must be assigned to authenticated technicianId or staffId.",
    holiday: "holiday staffId must equal authenticated staffId.",
    notification: "notification must target authenticated user, role or technician.",
  },
  forbidden: [
    "Do not rely on hidden menu items.",
    "Do not rely on browser-side filtering.",
    "Do not accept technicianId or staffId from request body without verifying against the authenticated session.",
    "Do not allow a technician to request another technician's records by changing URL parameters.",
    "Do not include payroll, directors area, salary, valuations, confidential HR or office-only notes in technician feeds.",
  ],
});

function canAccessRecord(context, recordType, record) {
  if (!context || context.role !== "Technician" || !context.staffId || !context.technicianId) return false;
  if (!record) return false;

  switch (recordType) {
    case "StaffMember":
      return record.staffId === context.staffId;
    case "TechnicianProfile":
      return record.staffId === context.staffId && record.technicianId === context.technicianId;
    case "Job":
      return record.assignedTechnicianId === context.technicianId;
    case "Report":
      return record.technicianId === context.technicianId || record.staffId === context.staffId;
    case "HolidayRequest":
      return record.staffId === context.staffId;
    case "Vehicle":
      return record.assignedTechnicianId === context.technicianId || record.assignedDriverStaffId === context.staffId;
    case "Message":
      return (record.participantIds || []).includes(context.userId);
    case "ToolboxTalk":
      return (record.assignedTechnicianIds || []).includes(context.technicianId);
    case "Notification":
      return record.recipientUserId === context.userId || record.recipientTechnicianId === context.technicianId;
    default:
      return false;
  }
}

module.exports = {
  TECHNICIAN_ACCESS_RULES,
  canAccessRecord,
};
