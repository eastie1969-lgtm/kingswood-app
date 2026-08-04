"use strict";

const crypto = require("crypto");

const ID_PREFIXES = Object.freeze({
  User: "USR",
  StaffMember: "STAFF",
  TechnicianProfile: "TECH",
  Job: "JOB",
  Client: "CLIENT",
  Vehicle: "VEH",
  Report: "RPT",
  HolidayRequest: "HOL",
  RAMS: "RAMS",
  Document: "DOC",
  Notification: "NOT",
  ActionItem: "ACT",
  DomainEvent: "EVT",
  AuditEvent: "AUD",
});

const REQUIRED_PREFIXES = Object.freeze([
  "JOB",
  "STAFF",
  "TECH",
  "CLIENT",
  "VEH",
  "RPT",
  "HOL",
  "RAMS",
  "DOC",
  "NOT",
  "ACT",
  "EVT",
  "AUD",
]);

function normalisePrefix(prefix) {
  const value = String(prefix || "").trim().toUpperCase();
  if (!REQUIRED_PREFIXES.includes(value) && !Object.values(ID_PREFIXES).includes(value)) {
    throw new Error(`Unsupported Kingswood ID prefix: ${prefix}`);
  }
  return value;
}

function canonicalFingerprint(parts) {
  return parts
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== "")
    .map((part) => String(part).trim().toLowerCase())
    .join("|");
}

function generateStableId(prefix, fingerprintParts, options = {}) {
  const safePrefix = normalisePrefix(prefix);
  const seed = canonicalFingerprint(fingerprintParts);
  const namespace = options.namespace || "kingswood-connect";
  const digest = crypto
    .createHash("sha256")
    .update(`${namespace}|${safePrefix}|${seed}`)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
  return `${safePrefix}-${digest}`;
}

function hasStableId(value, prefix) {
  if (!value || typeof value !== "string") return false;
  const safePrefix = normalisePrefix(prefix);
  return value.toUpperCase().startsWith(`${safePrefix}-`);
}

module.exports = {
  ID_PREFIXES,
  REQUIRED_PREFIXES,
  canonicalFingerprint,
  generateStableId,
  hasStableId,
};

