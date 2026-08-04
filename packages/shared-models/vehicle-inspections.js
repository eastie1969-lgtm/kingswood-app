"use strict";

const { generateStableId } = require("./id-generator");

const VEHICLE_CHECKLIST_ITEMS = Object.freeze([
  { itemId: "dashboard-warning-lights", label: "No dashboard warning lights", visibleDefect: false },
  { itemId: "tyres", label: "Tyres appear safe and correctly inflated", visibleDefect: true },
  { itemId: "external-lights", label: "External lights are working", visibleDefect: false },
  { itemId: "windscreen-mirrors", label: "Windscreen and mirrors are undamaged", visibleDefect: true },
  { itemId: "wipers-washers", label: "Wipers and washers are working", visibleDefect: false },
  { itemId: "brakes", label: "Brakes are operating normally", visibleDefect: false, safetyCritical: true },
  { itemId: "steering", label: "Steering is operating normally", visibleDefect: false, safetyCritical: true },
  { itemId: "number-plates", label: "Number plates are present and readable", visibleDefect: true },
  { itemId: "bodywork-damage", label: "No new bodywork damage", visibleDefect: true },
  { itemId: "fluid-leaks", label: "No visible fluid leaks", visibleDefect: true, safetyCritical: true },
  { itemId: "first-aid-kit", label: "First-aid kit is present", visibleDefect: false },
  { itemId: "fire-extinguisher", label: "Fire extinguisher is present and in date, where fitted", visibleDefect: false },
  { itemId: "secure-storage", label: "Tools, equipment and chemicals are stored securely", visibleDefect: true, safetyCritical: true },
  { itemId: "clean-safe", label: "Vehicle is reasonably clean and safe to use", visibleDefect: true }
]);

const VEHICLE_CHECK_RESULTS = Object.freeze(["Pass", "Defect", "Not applicable"]);

function textValue(value) {
  return String(value ?? "").trim();
}

function londonDateValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function mondayOfWeek(dateValue = londonDateValue()) {
  const [year, month, day] = textValue(dateValue).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date.toISOString().slice(0, 10);
}

function nextMonday(dateValue = londonDateValue()) {
  const monday = new Date(`${mondayOfWeek(dateValue)}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() + 7);
  return monday.toISOString().slice(0, 10);
}

function addWeeks(dateValue, weeks = 0) {
  const monday = new Date(`${mondayOfWeek(dateValue)}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() + (Number(weeks) || 0) * 7);
  return monday.toISOString().slice(0, 10);
}

function inspectionWeekStartForDate(date = new Date()) {
  return mondayOfWeek(londonDateValue(date));
}

function weekStartFromOptionalDate(value, fallbackWeekStart) {
  const safeValue = textValue(value);
  if (!safeValue) return fallbackWeekStart;
  const date = new Date(safeValue);
  if (Number.isNaN(date.getTime())) return fallbackWeekStart;
  return mondayOfWeek(londonDateValue(date));
}

function inspectionIdFor(vehicleId, inspectionWeekStart, technicianId = "") {
  return generateStableId("VEH", ["weekly-check", vehicleId, inspectionWeekStart, technicianId], { namespace: "kingswood-vehicle-inspections" });
}

function normaliseChecklistAnswers(answers = []) {
  const byId = new Map((Array.isArray(answers) ? answers : []).map((answer) => [textValue(answer.itemId), answer]));
  return VEHICLE_CHECKLIST_ITEMS.map((item) => {
    const answer = byId.get(item.itemId) || {};
    return {
      itemId: item.itemId,
      label: item.label,
      result: textValue(answer.result),
      explanation: textValue(answer.explanation),
      photoName: textValue(answer.photoName || answer.photoFileName),
      photoAttached: Boolean(answer.photoAttached || answer.photoDataUrl || answer.photoName || answer.photoFileName),
      safetyCritical: Boolean(answer.safetyCritical || item.safetyCritical),
      visibleDefect: Boolean(answer.visibleDefect || item.visibleDefect)
    };
  });
}

function vehicleInspectionValidationErrors(payload = {}) {
  const errors = [];
  const mileage = Number(payload.currentMileage);
  if (!Number.isFinite(mileage) || mileage < 0) errors.push("Current mileage is required.");
  const answers = normaliseChecklistAnswers(payload.answers);
  answers.forEach((answer) => {
    if (!VEHICLE_CHECK_RESULTS.includes(answer.result)) {
      errors.push(`${answer.label} must be answered.`);
    }
    if (answer.result === "Defect") {
      if (!answer.explanation) errors.push(`${answer.label} defect requires an explanation.`);
      if (answer.visibleDefect && !answer.photoAttached) errors.push(`${answer.label} visible defect requires a photograph.`);
    }
  });
  return errors;
}

function submittedInspectionForWeek(records = [], vehicleId, inspectionWeekStart) {
  return (Array.isArray(records) ? records : []).find((record) =>
    textValue(record.vehicleId) === textValue(vehicleId)
    && textValue(record.inspectionWeekStart) === textValue(inspectionWeekStart)
    && ["submitted", "completed", "complete", "passed", "defects reported"].includes(textValue(record.status || "Submitted").toLowerCase())
  ) || null;
}

function vehicleWeeklyCheckState({ assignedVehicle, records = [], now = new Date() } = {}) {
  if (!assignedVehicle || !assignedVehicle.vehicleId) {
    return { required: false, status: "No Vehicle Assigned", count: 0, overdue: 0, dueToday: 0 };
  }
  const currentWeekStart = inspectionWeekStartForDate(now);
  const firstRequiredWeek = weekStartFromOptionalDate(assignedVehicle.assignedAt || assignedVehicle.assignmentUpdatedAt, currentWeekStart);
  let inspectionWeekStart = firstRequiredWeek > currentWeekStart ? currentWeekStart : firstRequiredWeek;
  let submitted = null;
  while (inspectionWeekStart <= currentWeekStart) {
    submitted = submittedInspectionForWeek(records, assignedVehicle.vehicleId, inspectionWeekStart);
    if (!submitted) break;
    if (inspectionWeekStart === currentWeekStart) {
      const overdueFrom = nextMonday(inspectionWeekStart);
      return { required: false, status: "Submitted", count: 0, overdue: 0, dueToday: 0, inspectionWeekStart, dueDate: inspectionWeekStart, overdueFrom, submitted };
    }
    inspectionWeekStart = addWeeks(inspectionWeekStart, 1);
  }
  const today = londonDateValue(now);
  const overdueFrom = nextMonday(inspectionWeekStart);
  const overdue = inspectionWeekStart < currentWeekStart || today >= overdueFrom;
  return {
    required: true,
    status: overdue ? "Overdue" : "Outstanding",
    count: 1,
    overdue: overdue ? 1 : 0,
    dueToday: overdue ? 0 : 1,
    inspectionWeekStart,
    dueDate: inspectionWeekStart,
    overdueFrom
  };
}

function defectAnswers(answers = []) {
  return normaliseChecklistAnswers(answers).filter((answer) => answer.result === "Defect");
}

module.exports = {
  VEHICLE_CHECKLIST_ITEMS,
  VEHICLE_CHECK_RESULTS,
  addWeeks,
  defectAnswers,
  inspectionIdFor,
  inspectionWeekStartForDate,
  londonDateValue,
  mondayOfWeek,
  nextMonday,
  normaliseChecklistAnswers,
  submittedInspectionForWeek,
  textValue,
  vehicleInspectionValidationErrors,
  vehicleWeeklyCheckState
};
