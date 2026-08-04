"use strict";

const { generateStableId, hasStableId } = require("./id-generator");

function textValue(value) {
  return String(value ?? "").trim();
}

function normaliseVehicleRegistration(value = "") {
  return textValue(value).toUpperCase().replace(/\s+/g, "");
}

function stableVehicleIdForRecord(record = {}) {
  const existing = textValue(record.vehicleId);
  if (hasStableId(existing, "VEH")) return existing;
  const registration = normaliseVehicleRegistration(record.registration || record.reg || record.numberPlate);
  const descriptor = textValue(record.vehicle || record.make || record.model || "vehicle");
  return generateStableId("VEH", [registration || descriptor, descriptor], { namespace: "kingswood-vehicles" });
}

function normaliseVehicleRecord(record = {}) {
  const vehicleId = stableVehicleIdForRecord(record);
  const registration = textValue(record.registration || record.reg || record.numberPlate).toUpperCase();
  const assignedStaffId = textValue(record.assignedStaffId || record.assignedDriverStaffId || record.staffId);
  const assignedTechnicianId = textValue(record.assignedTechnicianId || record.technicianId);
  const assignmentStatus = textValue(record.assignmentStatus || (assignedStaffId || assignedTechnicianId ? "Active" : ""));
  return {
    ...record,
    vehicleId,
    registration,
    assignedStaffId,
    assignedTechnicianId,
    assignmentStatus
  };
}

function normaliseVehicleCollection(vehicles = []) {
  return (Array.isArray(vehicles) ? vehicles : []).map(normaliseVehicleRecord);
}

function findActiveVehicleAssignment(vehicles = [], technicianId = "", staffId = "") {
  const safeTechnicianId = textValue(technicianId);
  const safeStaffId = textValue(staffId);
  return normaliseVehicleCollection(vehicles).find((vehicle) => {
    const active = textValue(vehicle.assignmentStatus || (vehicle.assignedTechnicianId || vehicle.assignedStaffId ? "Active" : "")).toLowerCase() !== "removed";
    if (!active) return false;
    return (safeTechnicianId && textValue(vehicle.assignedTechnicianId) === safeTechnicianId)
      || (safeStaffId && textValue(vehicle.assignedStaffId) === safeStaffId);
  }) || null;
}

function validateVehicleAssignment(data = {}, payload = {}) {
  const vehicles = normaliseVehicleCollection(data.vehicles || []);
  const vehicleId = textValue(payload.vehicleId);
  const technicianId = textValue(payload.technicianId);
  const staffId = textValue(payload.staffId);
  const remove = Boolean(payload.remove);
  const vehicle = vehicles.find((item) => textValue(item.vehicleId) === vehicleId);
  if (!vehicle) return { ok: false, status: 404, message: "Vehicle record was not found." };
  if (remove) return { ok: true, vehicle };
  if (!technicianId || !staffId) {
    return { ok: false, status: 400, message: "Choose a valid active technician before assigning this vehicle." };
  }
  const staff = (data.staffProfiles || []).find((profile) =>
    textValue(profile.staffId) === staffId
    && textValue(profile.technicianId) === technicianId
    && textValue(profile.role) === "Technician"
    && textValue(profile.status || "Active") === "Active"
  );
  const technician = (data.technicians || []).find((profile) =>
    textValue(profile.staffId) === staffId
    && textValue(profile.technicianId) === technicianId
    && textValue(profile.status || "Active") === "Active"
  );
  if (!staff || !technician) {
    return { ok: false, status: 400, message: "Technician and staff records do not match an active Kingswood technician." };
  }
  const vehicleAssignedElsewhere = vehicles.find((item) =>
    item !== vehicle
    && textValue(item.vehicleId) === vehicleId
    && textValue(item.assignmentStatus || (item.assignedTechnicianId || item.assignedStaffId ? "Active" : "")).toLowerCase() !== "removed"
    && ((textValue(item.assignedTechnicianId) && textValue(item.assignedTechnicianId) !== technicianId)
      || (textValue(item.assignedStaffId) && textValue(item.assignedStaffId) !== staffId))
  );
  if (vehicleAssignedElsewhere) {
    return { ok: false, status: 409, message: "This vehicle is already assigned to another technician." };
  }
  const technicianAssignedElsewhere = vehicles.find((item) =>
    textValue(item.vehicleId) !== vehicleId
    && textValue(item.assignmentStatus || (item.assignedTechnicianId || item.assignedStaffId ? "Active" : "")).toLowerCase() !== "removed"
    && (textValue(item.assignedTechnicianId) === technicianId || textValue(item.assignedStaffId) === staffId)
  );
  if (technicianAssignedElsewhere) {
    return { ok: false, status: 409, message: "This technician is already assigned to another active vehicle." };
  }
  return { ok: true, vehicle, staff, technician };
}

function applyVehicleAssignment(data = {}, payload = {}, officeContext = {}) {
  const validation = validateVehicleAssignment(data, payload);
  if (!validation.ok) return validation;
  const now = new Date().toISOString();
  const vehicleId = textValue(payload.vehicleId);
  const remove = Boolean(payload.remove);
  const previousVehicle = validation.vehicle;
  const action = remove ? "Vehicle Assignment Removed" : (previousVehicle.assignedTechnicianId || previousVehicle.assignedStaffId ? "Vehicle Assignment Changed" : "Vehicle Assigned");
  data.vehicles = normaliseVehicleCollection(data.vehicles || []).map((vehicle) => {
    if (textValue(vehicle.vehicleId) !== vehicleId) return vehicle;
    return {
      ...vehicle,
      assignedTechnicianId: remove ? "" : textValue(payload.technicianId),
      assignedStaffId: remove ? "" : textValue(payload.staffId),
      assignmentStatus: remove ? "Removed" : "Active",
      assignedAt: remove ? textValue(vehicle.assignedAt) : now,
      assignmentUpdatedAt: now,
      assignmentUpdatedBy: textValue(officeContext.userId || officeContext.name || "Kingswood Office"),
      driver: remove ? textValue(vehicle.driver) : textValue(validation.staff?.name || vehicle.driver),
      assignmentHistory: [
        ...(Array.isArray(vehicle.assignmentHistory) ? vehicle.assignmentHistory : []),
        {
          action,
          at: now,
          by: textValue(officeContext.userId || officeContext.name || "Kingswood Office"),
          fromStaffId: textValue(previousVehicle.assignedStaffId),
          fromTechnicianId: textValue(previousVehicle.assignedTechnicianId),
          toStaffId: remove ? "" : textValue(payload.staffId),
          toTechnicianId: remove ? "" : textValue(payload.technicianId)
        }
      ]
    };
  });
  return { ok: true, status: 200, vehicle: data.vehicles.find((item) => textValue(item.vehicleId) === vehicleId), action };
}

module.exports = {
  applyVehicleAssignment,
  findActiveVehicleAssignment,
  normaliseVehicleCollection,
  normaliseVehicleRecord,
  normaliseVehicleRegistration,
  stableVehicleIdForRecord,
  validateVehicleAssignment
};
