const COMMUNICATION_TYPES = Object.freeze({
  toolbox_talk: Object.freeze({
    communicationType: "toolbox_talk",
    displayName: "Toolbox Talk",
    status: "active"
  }),
  announcement: Object.freeze({
    communicationType: "announcement",
    displayName: "Announcement",
    status: "active"
  })
});

function normaliseCommunicationType(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function communicationTypeDefinition(value) {
  return COMMUNICATION_TYPES[normaliseCommunicationType(value)] || null;
}

function validateActiveCommunicationType(value) {
  const definition = communicationTypeDefinition(value);
  if (!definition) {
    return { ok: false, reason: "unsupported" };
  }
  if (definition.status !== "active") {
    return { ok: false, reason: "inactive" };
  }
  return { ok: true, definition };
}

module.exports = {
  COMMUNICATION_TYPES,
  TOOLBOX_TALK_COMMUNICATION_TYPE: "toolbox_talk",
  ANNOUNCEMENT_COMMUNICATION_TYPE: "announcement",
  normaliseCommunicationType,
  communicationTypeDefinition,
  validateActiveCommunicationType
};
