const storageKey = "kingswood-hub-rams";
const authStorageKey = "kingswood-hub-user";
const sectionStorageKey = "kingswood-hub-section";
const staffPendingStorageKey = "kingswood-staff-records-pending";
const staffLastSavedStorageKey = "kingswood-staff-records-last-saved";
const finesPendingStorageKey = "kingswood-fines-pending";
const oneDrivePendingStorageKey = "kingswood-hub-onedrive-pending";
const oneDriveLastSavedStorageKey = "kingswood-hub-onedrive-last-saved";
const oneDriveAutoSyncIntervalMs = 30000;
const appVersion = "259";
const reviewModeParam = "review";
const reviewMode = new URLSearchParams(window.location.search).get(reviewModeParam) === "1";
let selectedStaffIndex = 0;
let activeStaffTab = "overview";
let fineEvidenceDraft = [];
let trainingDocumentDraft = null;
let complianceDocumentDraft = null;
let assetDocumentDraft = [];
let activeTrainingFilter = "all";
let activeTrainingYear = String(new Date().getFullYear());
let activeComplianceFilter = "all";
let activeHolidayPlannerMonth = localIsoDate().slice(0, 7);
let activeDirectorTab = "overview";
let directorsAreaState = null;
let activeDirectorPayrollPeriod = "";
let activeDirectorPayrollFocus = "";
let activeDirectorPerformancePeriod = "this-month";
let activeDirectorPerformanceTechnician = "";
let expandedHolidayPlannerDay = "";
let oneDriveLiveDataLoaded = false;
let oneDriveAutoSyncTimer = null;
let oneDriveAutoSyncRunning = false;
let trackingMode = "test";
let trackingMapViews = new Map();
let trackingMoveTimer = null;
let selectedTrackingVehicleId = "kw-test-1";
let technicianGeofenceTestMode = true;
let technicianGeofenceTestLocations = {};
let lastWeatherCode = null;
const weatherThemeStorageKey = "kingswood-header-weather-preview";
const seasonalThemeStorageKey = "kingswood-header-seasonal-preview";
const christmasThemeEndDateStorageKey = "kingswood-header-christmas-end-date";
let weatherThemePreviewValue = "live";
let seasonalThemePreviewValue = "none";
const technicianGeofenceRadiusMiles = 0.5;
let testTrackingVehicles = [
  {
    id: "kw-test-1",
    technician: "Dave",
    registration: "KW21 HUB",
    lat: 51.3741,
    lng: 0.0972,
    speed: 18,
    status: "Driving",
    routeBearing: 0.00045
  },
  {
    id: "kw-test-2",
    technician: "Sarah Test",
    registration: "KW23 VAN",
    lat: 51.4054,
    lng: 0.0148,
    speed: 0,
    status: "Stopped",
    routeBearing: -0.00025
  },
  {
    id: "kw-test-3",
    technician: "Ian D",
    registration: "KW19 PCO",
    lat: 51.3254,
    lng: 0.0335,
    speed: 0,
    status: "Offline",
    routeBearing: 0.0002
  }
];
const authorisedUsers = {
  Jodie: "1991"
};

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localIsoDate(date);
}

const today = localIsoDate();
const tomorrowDate = new Date();
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrow = localIsoDate(tomorrowDate);

function formatOneDriveSaveTime(value) {
  if (!value) return "Waiting for first save";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Last saved time unknown";
  return `Last saved ${date.toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function oneDrivePendingBackup() {
  return localStorage.getItem(oneDrivePendingStorageKey);
}

function updateOneDriveHeaderStatus(status, detail = "") {
  if (!storageStatus) return;
  const lastSaved = localStorage.getItem(oneDriveLastSavedStorageKey) || "";
  const safeStatus = status || (oneDrivePendingBackup()
    ? "Local backup pending"
    : oneDriveLiveDataLoaded
      ? "Live OneDrive data loaded"
      : "OneDrive unavailable");
  const statusMap = {
    "Live OneDrive data loaded": { label: "OneDrive Live", state: "synced" },
    "OneDrive save complete": { label: "OneDrive Live", state: "synced" },
    "Saving to OneDrive": { label: "Saving", state: "saving" },
    "Local backup pending": { label: "Save pending", state: "pending" },
    "OneDrive unavailable": { label: "Offline", state: "offline" }
  };
  const display = statusMap[safeStatus] || { label: "Error", state: "error" };
  const statusDetail = display.state === "synced"
    ? formatOneDriveSaveTime(lastSaved)
    : detail || (display.state === "pending"
      ? "Local backup kept safely"
      : display.state === "saving"
        ? "Writing office data"
        : "OneDrive not connected");
  storageStatus.innerHTML = `<span class="onedrive-status-line"><span class="status-dot" aria-hidden="true"></span>${escapeHtml(display.label)}</span><span class="last-saved-line">${escapeHtml(statusDetail)}</span>`;
  storageStatus.dataset.status = display.state;
}

function keepPendingOneDriveBackup(payload, reason = "OneDrive save failed") {
  localStorage.setItem(oneDrivePendingStorageKey, JSON.stringify({
    savedAt: new Date().toISOString(),
    reason,
    payload
  }));
  updateOneDriveHeaderStatus("Local backup pending", "Data has not been safely saved to OneDrive yet");
}

function clearPendingOneDriveBackup() {
  localStorage.removeItem(oneDrivePendingStorageKey);
}

async function retryPendingOneDriveBackup({ silent = true } = {}) {
  if (oneDriveAutoSyncRunning || !oneDrivePendingBackup()) return false;
  oneDriveAutoSyncRunning = true;
  try {
    const saved = await saveCommandData();
    if (!saved && !silent) {
      await kcInfo("OneDrive is still unavailable. A local backup is pending and will keep retrying automatically.");
    }
    return saved;
  } finally {
    oneDriveAutoSyncRunning = false;
  }
}

function startOneDriveAutoSync() {
  if (oneDriveAutoSyncTimer) return;
  oneDriveAutoSyncTimer = window.setInterval(() => {
    retryPendingOneDriveBackup({ silent: true });
  }, oneDriveAutoSyncIntervalMs);
  window.addEventListener("online", () => retryPendingOneDriveBackup({ silent: true }));
  window.addEventListener("focus", () => retryPendingOneDriveBackup({ silent: true }));
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const starterRams = [
  {
    id: crypto.randomUUID(),
    title: "Proofing Works RAMS",
    client: "Ark",
    job: "ARK-1042 - Camden proofing works",
    status: "attached",
    sentDate: "",
    notes: "Attached to job. Needs sending to client before attendance."
  },
  {
    id: crypto.randomUUID(),
    title: "Working at Height RAMS",
    client: "JG Pest Control",
    job: "JGP-2077 - Warehouse high bay inspection",
    status: "sent",
    sentDate: "2026-06-28",
    notes: "Sent to client and technician."
  },
  {
    id: crypto.randomUUID(),
    title: "Rodent Treatment RAMS",
    client: "Private",
    job: "PRI-5521 - Residential mouse treatment",
    status: "draft",
    sentDate: "",
    notes: "Draft awaiting office check."
  }
];

let jobs = [
  {
    date: today,
    number: "ARK-1042",
    title: "Proofing works - Camden",
    client: "Ark",
    address: "Camden High Street, NW1",
    technician: "Dan",
    status: "Urgent",
    report: "Awaiting"
  },
  {
    date: today,
    number: "JGP-2077",
    title: "Warehouse inspection",
    client: "JG Pest Control",
    address: "Park Royal, NW10",
    technician: "Mason",
    status: "Booked",
    report: "Not due"
  },
  {
    date: tomorrow,
    number: "HA-3190",
    title: "Block survey",
    client: "Housing Association",
    address: "Brixton Road, SW9",
    technician: "Aiden",
    status: "Booked",
    report: "Not due"
  },
  {
    date: tomorrow,
    number: "PRI-5521",
    title: "Residential treatment",
    client: "Private",
    address: "Wimbledon, SW19",
    technician: "Dan",
    status: "RAMS needed",
    report: "Not due"
  }
];

let vehicles = [
  {
    registration: "KW21 HUB",
    vehicle: "Ford Transit Custom",
    driver: "Dan",
    mot: "2026-07-18",
    service: "2026-07-26",
    insurance: "2026-08-02",
    tracker: "Active"
  },
  {
    registration: "KW19 PCO",
    vehicle: "Vauxhall Vivaro",
    driver: "Mason",
    mot: "2026-09-12",
    service: "2026-06-20",
    insurance: "2026-07-20",
    tracker: "Pending"
  },
  {
    registration: "KW23 VAN",
    vehicle: "Ford Ranger",
    driver: "Aiden",
    mot: "2027-01-10",
    service: "2026-11-15",
    insurance: "2026-12-01",
    tracker: "Active"
  }
];

let technicians = [
  {
    name: "Dan",
    role: "Senior Technician",
    phone: "Company phone issued",
    van: "KW21 HUB",
    location: "Camden",
    training: "Working at Height expires 2026-08-15"
  },
  {
    name: "Mason",
    role: "Technician",
    phone: "Company phone issued",
    van: "KW19 PCO",
    location: "Park Royal",
    training: "PPE review due 2026-07-10"
  },
  {
    name: "Aiden",
    role: "Technician",
    phone: "Company phone issued",
    van: "KW23 VAN",
    location: "Brixton",
    training: "Driving licence check due 2026-09-01"
  }
];

let staffProfiles = [
  {
    name: "Dan",
    role: "Senior Technician",
    phone: "07700 900101",
    email: "dan@kingswood.example",
    emergencyContact: "Sam - 07700 900201",
    assignedVan: "KW21 HUB",
    trainingRecords: "Working at Height, First Aid",
    qualifications: "BPCA Level 2, IPAF",
    drivingLicence: "Checked 2026-03-01, expires 2028-03-01",
    ppeIssued: "Boots, hi-vis, gloves, respirator",
    holidayAllowance: 28,
    holidayUsed: 8,
    notes: "Approved for high access works."
  },
  {
    name: "Mason",
    role: "Technician",
    phone: "07700 900102",
    email: "mason@kingswood.example",
    emergencyContact: "Kelly - 07700 900202",
    assignedVan: "KW19 PCO",
    trainingRecords: "PPE refresh booked, toolbox talks complete",
    qualifications: "BPCA Level 2",
    drivingLicence: "Checked 2026-01-20, expires 2027-01-20",
    ppeIssued: "Boots, hi-vis, gloves",
    holidayAllowance: 28,
    holidayUsed: 12,
    notes: "Fit note upload area needed for sickness records."
  },
  {
    name: "Aiden",
    role: "Technician",
    phone: "07700 900103",
    email: "aiden@kingswood.example",
    emergencyContact: "Chris - 07700 900203",
    assignedVan: "KW23 VAN",
    trainingRecords: "Driving licence check due, ladder safety complete",
    qualifications: "Trainee technician",
    drivingLicence: "Checked 2025-09-01, expires 2026-09-01",
    ppeIssued: "Boots, hi-vis, gloves, helmet",
    holidayAllowance: 28,
    holidayUsed: 5,
    notes: "Pair with senior technician on complex jobs."
  },
  {
    name: "Kev",
    role: "Admin",
    phone: "07700 900104",
    email: "office@kingswood.example",
    emergencyContact: "Office record needed",
    assignedVan: "None",
    trainingRecords: "Office systems, compliance admin",
    qualifications: "Admin",
    drivingLicence: "Not required for role",
    ppeIssued: "Office visitor PPE",
    holidayAllowance: 28,
    holidayUsed: 4,
    notes: "Can approve holidays and update attendance."
  }
];

let attendanceRecords = [
  { date: today, name: "Dan", status: "Present", returnToWorkNotes: "", fitNote: "" },
  { date: today, name: "Mason", status: "Sick", returnToWorkNotes: "Return to work note required when back.", fitNote: "Fit note may be needed if sickness continues." },
  { date: today, name: "Aiden", status: "Holiday", returnToWorkNotes: "", fitNote: "" },
  { date: today, name: "Kev", status: "Present", returnToWorkNotes: "", fitNote: "" },
  { date: tomorrow, name: "Dan", status: "Training", returnToWorkNotes: "", fitNote: "" },
  { date: tomorrow, name: "Mason", status: "Present", returnToWorkNotes: "", fitNote: "" },
  { date: tomorrow, name: "Aiden", status: "Present", returnToWorkNotes: "", fitNote: "" }
];

let holidayRequests = [
  { name: "Aiden", from: today, to: today, days: 1, status: "Approved" },
  { name: "Mason", from: "2026-07-15", to: "2026-07-19", days: 5, status: "Pending" },
  { name: "Dan", from: "2026-08-03", to: "2026-08-07", days: 5, status: "Declined" }
];

let staffNotifications = [];
let tscMasterContent = [];
let tscPublishedRevisions = [];
let tscIssueRecords = [];
let tscAssignmentRecords = [];
let tscEvidenceRecords = [];
let universalAuditEvents = [];
let selectedTscIssueId = "";
let tscIssueSaveInProgress = false;
let companyHolidays = [];
let leaveAllowanceResetYear = "";

const tscCommunicationTypes = Object.freeze({
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
const TSC_TOOLBOX_TALK_COMMUNICATION_TYPE = "toolbox_talk";
const TSC_ANNOUNCEMENT_COMMUNICATION_TYPE = "announcement";

const ukBankHolidays = [
  { title: "New Year's Day substitute day", date: "2022-01-03", type: "Bank holiday" },
  { title: "Good Friday", date: "2022-04-15", type: "Bank holiday" },
  { title: "Easter Monday", date: "2022-04-18", type: "Bank holiday" },
  { title: "Early May bank holiday", date: "2022-05-02", type: "Bank holiday" },
  { title: "Spring bank holiday", date: "2022-06-02", type: "Bank holiday" },
  { title: "Platinum Jubilee bank holiday", date: "2022-06-03", type: "Bank holiday" },
  { title: "Summer bank holiday", date: "2022-08-29", type: "Bank holiday" },
  { title: "State Funeral of Queen Elizabeth II", date: "2022-09-19", type: "Bank holiday" },
  { title: "Boxing Day", date: "2022-12-26", type: "Bank holiday" },
  { title: "Christmas Day substitute day", date: "2022-12-27", type: "Bank holiday" },
  { title: "New Year's Day substitute day", date: "2023-01-02", type: "Bank holiday" },
  { title: "Good Friday", date: "2023-04-07", type: "Bank holiday" },
  { title: "Easter Monday", date: "2023-04-10", type: "Bank holiday" },
  { title: "Early May bank holiday", date: "2023-05-01", type: "Bank holiday" },
  { title: "Bank holiday for the coronation of King Charles III", date: "2023-05-08", type: "Bank holiday" },
  { title: "Spring bank holiday", date: "2023-05-29", type: "Bank holiday" },
  { title: "Summer bank holiday", date: "2023-08-28", type: "Bank holiday" },
  { title: "Christmas Day", date: "2023-12-25", type: "Bank holiday" },
  { title: "Boxing Day", date: "2023-12-26", type: "Bank holiday" },
  { title: "New Year's Day", date: "2024-01-01", type: "Bank holiday" },
  { title: "Good Friday", date: "2024-03-29", type: "Bank holiday" },
  { title: "Easter Monday", date: "2024-04-01", type: "Bank holiday" },
  { title: "Early May bank holiday", date: "2024-05-06", type: "Bank holiday" },
  { title: "Spring bank holiday", date: "2024-05-27", type: "Bank holiday" },
  { title: "Summer bank holiday", date: "2024-08-26", type: "Bank holiday" },
  { title: "Christmas Day", date: "2024-12-25", type: "Bank holiday" },
  { title: "Boxing Day", date: "2024-12-26", type: "Bank holiday" },
  { title: "New Year's Day", date: "2025-01-01", type: "Bank holiday" },
  { title: "Good Friday", date: "2025-04-18", type: "Bank holiday" },
  { title: "Easter Monday", date: "2025-04-21", type: "Bank holiday" },
  { title: "Early May bank holiday", date: "2025-05-05", type: "Bank holiday" },
  { title: "Spring bank holiday", date: "2025-05-26", type: "Bank holiday" },
  { title: "Summer bank holiday", date: "2025-08-25", type: "Bank holiday" },
  { title: "Christmas Day", date: "2025-12-25", type: "Bank holiday" },
  { title: "Boxing Day", date: "2025-12-26", type: "Bank holiday" },
  { title: "New Year's Day", date: "2026-01-01", type: "Bank holiday" },
  { title: "Good Friday", date: "2026-04-03", type: "Bank holiday" },
  { title: "Easter Monday", date: "2026-04-06", type: "Bank holiday" },
  { title: "Early May bank holiday", date: "2026-05-04", type: "Bank holiday" },
  { title: "Spring bank holiday", date: "2026-05-25", type: "Bank holiday" },
  { title: "Summer bank holiday", date: "2026-08-31", type: "Bank holiday" },
  { title: "Christmas Day", date: "2026-12-25", type: "Bank holiday" },
  { title: "Boxing Day substitute day", date: "2026-12-28", type: "Bank holiday" },
  { title: "New Year's Day", date: "2027-01-01", type: "Bank holiday" },
  { title: "Good Friday", date: "2027-03-26", type: "Bank holiday" },
  { title: "Easter Monday", date: "2027-03-29", type: "Bank holiday" },
  { title: "Early May bank holiday", date: "2027-05-03", type: "Bank holiday" },
  { title: "Spring bank holiday", date: "2027-05-31", type: "Bank holiday" },
  { title: "Summer bank holiday", date: "2027-08-30", type: "Bank holiday" },
  { title: "Christmas Day substitute day", date: "2027-12-27", type: "Bank holiday" },
  { title: "Boxing Day substitute day", date: "2027-12-28", type: "Bank holiday" },
  { title: "New Year's Day substitute day", date: "2028-01-03", type: "Bank holiday" },
  { title: "Good Friday", date: "2028-04-14", type: "Bank holiday" },
  { title: "Easter Monday", date: "2028-04-17", type: "Bank holiday" },
  { title: "Early May bank holiday", date: "2028-05-01", type: "Bank holiday" },
  { title: "Spring bank holiday", date: "2028-05-29", type: "Bank holiday" },
  { title: "Summer bank holiday", date: "2028-08-28", type: "Bank holiday" },
  { title: "Christmas Day", date: "2028-12-25", type: "Bank holiday" },
  { title: "Boxing Day", date: "2028-12-26", type: "Bank holiday" },
  { title: "New Year's Day", date: "2029-01-01", type: "Bank holiday" },
  { title: "Good Friday", date: "2029-03-30", type: "Bank holiday" },
  { title: "Easter Monday", date: "2029-04-02", type: "Bank holiday" },
  { title: "Early May bank holiday", date: "2029-05-07", type: "Bank holiday" },
  { title: "Spring bank holiday", date: "2029-05-28", type: "Bank holiday" },
  { title: "Summer bank holiday", date: "2029-08-27", type: "Bank holiday" },
  { title: "Christmas Day", date: "2029-12-25", type: "Bank holiday" },
  { title: "Boxing Day", date: "2029-12-26", type: "Bank holiday" },
  { title: "New Year's Day", date: "2030-01-01", type: "Bank holiday" },
  { title: "Good Friday", date: "2030-04-19", type: "Bank holiday" },
  { title: "Easter Monday", date: "2030-04-22", type: "Bank holiday" },
  { title: "Early May bank holiday", date: "2030-05-06", type: "Bank holiday" },
  { title: "Spring bank holiday", date: "2030-05-27", type: "Bank holiday" },
  { title: "Summer bank holiday", date: "2030-08-26", type: "Bank holiday" },
  { title: "Christmas Day", date: "2030-12-25", type: "Bank holiday" },
  { title: "Boxing Day", date: "2030-12-26", type: "Bank holiday" }
];

let trainingMatrix = [
  { employee: "Dan", course: "Working at Height", provider: "Internal", completedDate: "2026-02-10", expiryDate: "2026-08-15", certificate: "On file", notes: "Required for high access works." },
  { employee: "Mason", course: "BPCA Level 2", provider: "BPCA", completedDate: "2025-09-12", expiryDate: "2027-09-12", certificate: "On file", notes: "Core technician qualification." },
  { employee: "Aiden", course: "Ladder Safety", provider: "Internal", completedDate: "2026-03-05", expiryDate: "2027-03-05", certificate: "On file", notes: "Refresher complete." }
];

const companyDocumentCategories = ["Insurance", "Legal", "Policy", "Template", "Correspondence"];
const criticalDocumentCategories = ["Insurance"];
const complianceTypes = ["Insurance", "Accreditation", "Policy Review", "Office Compliance", "Certificate", "Other"];
const accreditationOptions = ["SafeContractor", "Add other accreditation"];
const assetCategories = ["Machinery", "Power tools", "Hand tools", "Ladders", "Access equipment", "Pest control equipment", "Sprayers", "Testing equipment", "Cameras", "PPE equipment", "Vehicle equipment", "Office equipment", "Other"];
const assetConditions = ["New", "Good", "Fair", "Poor", "Damaged"];
const assetStatuses = ["In use", "In storage", "Needs inspection", "Needs repair", "Out of service", "Lost", "Disposed"];
const assetPowerSources = ["Mains powered", "Battery powered", "Petrol", "Diesel", "Manual", "Not applicable"];
let activeAssetFilter = "all";
const allowedComplianceLegacyCategories = ["Company"];
const disallowedComplianceTerms = ["mot", "vehicle", "van servicing", "technician driving licence", "bpca", "ppe", "ladder", "rams"];
const documentSecurityUidAllowList = {
  Kevin: "FIREBASE_UID_TO_ADD",
  Alex: "FIREBASE_UID_TO_ADD",
  Jodie: "FIREBASE_UID_TO_ADD"
};

let companyDocuments = [
  {
    title: "Public Liability Insurance",
    category: "Insurance",
    oneDriveLink: "OneDrive - Kingswood / Company Documents / Insurance / Public Liability",
    issueDate: "2026-01-01",
    expiryDate: "2026-12-31",
    owner: "Kevin",
    lastUpdatedBy: "Kevin",
    createdAt: "2026-07-07",
    updatedAt: "2026-07-07"
  },
  {
    title: "Health & Safety Policy",
    category: "Policy",
    oneDriveLink: "OneDrive - Kingswood / Company Documents / Policies / Health and Safety Policy",
    issueDate: "2026-01-01",
    expiryDate: "",
    owner: "Kevin",
    lastUpdatedBy: "Kevin",
    createdAt: "2026-07-07",
    updatedAt: "2026-07-07"
  }
];

let assets = [
  ["Roof ladder", "Ladders", "Dan", "2026-07-05", "Inspection due"],
  ["Gas monitor 01", "Gas monitors", "Stores", "2026-08-21", "OK"],
  ["Harness kit A", "Harnesses", "Aiden", "2026-07-12", "Inspection due"],
  ["Inspection camera", "Cameras", "Mason", "2026-10-03", "OK"]
];

let complianceItems = [
  {
    id: "COMP-PL-2026",
    complianceType: "Insurance",
    title: "Public liability insurance",
    provider: "Kingswood insurer",
    certificateNumber: "To be added",
    startDate: "2026-01-01",
    expiryDate: "2026-08-02",
    noExpiry: false,
    responsiblePerson: "Kevin",
    reminderDays: 60,
    notes: "Company-level insurance renewal tracker.",
    documentFileName: "",
    oneDriveLocation: "",
    history: [],
    audit: [{ action: "created", by: "System", at: "2026-07-09T00:00:00.000Z" }],
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z"
  },
  {
    id: "COMP-FIRE-2026",
    complianceType: "Office Compliance",
    title: "Fire extinguisher inspections",
    provider: "Service contractor",
    certificateNumber: "To be added",
    startDate: "2026-01-01",
    expiryDate: "2026-06-15",
    noExpiry: false,
    responsiblePerson: "Kevin",
    reminderDays: 60,
    notes: "Office compliance check.",
    documentFileName: "",
    oneDriveLocation: "",
    history: [],
    audit: [{ action: "created", by: "System", at: "2026-07-09T00:00:00.000Z" }],
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z"
  }
];

let fines = [
  {
    date: "2026-06-18",
    registration: "KW21 HUB",
    driver: "Dan",
    location: "Camden High Street",
    type: "Parking ticket",
    amount: 65,
    deadline: "2026-07-02",
    status: "New",
    notes: "Check loading bay evidence before deciding whether to appeal.",
    evidence: "Photo needed"
  },
  {
    date: "2026-06-21",
    registration: "KW19 PCO",
    driver: "Mason",
    location: "Central London",
    type: "Congestion charge",
    amount: 15,
    deadline: "2026-06-30",
    status: "Paid",
    notes: "Paid by office card.",
    evidence: "Receipt saved"
  },
  {
    date: "2026-06-24",
    registration: "KW23 VAN",
    driver: "Aiden",
    location: "Dartford Crossing",
    type: "Dart Charge issue",
    amount: 35,
    deadline: "2026-07-08",
    status: "Appealed",
    notes: "Account payment issue. Awaiting response.",
    evidence: "Ticket photo uploaded"
  },
  {
    date: "2026-06-10",
    registration: "KW19 PCO",
    driver: "Mason",
    location: "Wandsworth",
    type: "Bus lane fine",
    amount: 130,
    deadline: "2026-06-24",
    status: "Deducted from wages",
    notes: "Agreed deduction after review.",
    evidence: "Council letter saved"
  }
];

let valuations = [];
let weeklyPlanner = [];

let clients = [
  ["Ark", "Contacts, addresses, previous jobs, reports, photos, invoices, notes"],
  ["JG Pest Control", "Contacts, shared jobs, documents, reports, photos"],
  ["Private", "Residential contacts, addresses, recommendations, invoices"],
  ["Housing Associations", "Blocks, contacts, reports, visits, proofing history"]
];

let integrationFeeds = {
  technicianApp: null,
  adminApp: null,
  connectV12: null,
  lastPublished: ""
};

let emailTemplates = [
  { name: "RAMS to client", subject: "RAMS documents for upcoming works", body: "Please find the RAMS documents for the booked Kingswood works attached." }
];

let reportTemplates = [
  { name: "Standard job report", description: "Default report layout for photos, proofing, recommendations and signature." }
];

let ramsTemplates = [
  { title: "Standard RAMS template", description: "Reusable RAMS structure for common pest control works." }
];

let companyBranding = {
  companyName: "Kingswood London Ltd",
  logo: "assets/kingswood-silver-logo.png",
  navy: "#1F3766",
  orange: "#C07820"
};

let activeSettingsPanel = "core";
let activePlannerWeek = "";
let initialSectionApplied = false;

const setupActions = [
  ["Jobs", "Create jobs, assign technicians, set dates", "diary"],
  ["Weekly Planner", "Office screen planner by technician and day", "weekly-planner"],
  ["Valuations", "Imported job values, reports and checked status", "valuations"],
  ["Staff", "People, sickness, holiday, training, PPE", "staff"],
  ["Training", "Matrix, expiry dates, qualifications", "training"],
  ["Vehicles", "Vans, MOT, tax, insurance, servicing", "vehicles"],
  ["Compliance", "Renewals, inspections, certificates", "compliance"],
  ["RAMS", "Templates, job RAMS, sent dates", "rams"],
  ["Documents", "Policies, COSHH, certificates, toolbox talks", "documents"],
  ["Clients", "Contacts, addresses, job history", "clients"],
  ["Assets", "Ladders, tools, harnesses, inspections", "assets"]
];

const settings = [
  { id: "core", title: "Core Data", description: "Staff, vehicles, clients, assets, jobs, RAMS, and documents" },
  { id: "users", title: "Users", description: "Admin, technician, and office access" },
  { id: "permissions", title: "Permissions", description: "Control who can view and edit each area" },
  { id: "email", title: "Email Templates", description: "Client RAMS emails and reminder emails" },
  { id: "reports", title: "Report Templates", description: "Standard report layouts" },
  { id: "rams", title: "RAMS Templates", description: "Reusable RAMS document templates" },
  { id: "branding", title: "Company Branding", description: "Logo, colours, and document footer details" },
  { id: "themes", title: "Header Theme Preview", description: "Safely preview weather and seasonal header styles" },
  { id: "storage", title: "Data Storage", description: "OneDrive-backed Hub storage status" }
];

const dashboardCardMeta = {
  jobsTodayCount: ["calendar", "Booked in for today", "jobs"],
  jobsTomorrowCount: ["calendar", "Next working day", "jobs"],
  reportsDueCount: ["file-text", "Reports waiting", "reports"],
  ramsToSendDashboardCount: ["file-check", "RAMS awaiting issue", "RAMS"],
  urgentAttentionCount: ["alert", "Items needing action", "items"],
  vehicleAlertCount: ["truck", "Vehicle items to check", "alerts"],
  motReminderCount: ["clipboard", "MOT dates due soon", "MOTs"],
  insuranceReminderCount: ["shield", "Insurance dates due soon", "items"],
  complianceDueCount: ["shield-alert", "Due within 30 days", "due"],
  complianceOverdueCount: ["alert", "Overdue compliance", "overdue"],
  fineDeadlineCount: ["receipt", "Charge deadlines soon", "deadlines"],
  openFineCount: ["receipt", "Open vehicle charges", "open"],
  staffAvailableCount: ["user-check", "Ready for work", "available"],
  staffUnavailableCount: ["users", "Sick, holiday or training", "unavailable"]
};

const settingsCardMeta = [
  ["database", () => `${jobs.length + weeklyPlanner.length + valuations.length + vehicles.length + staffProfiles.length + clients.length + assets.length + companyDocuments.length + ramsItems.length} records`],
  ["users", () => `${staffProfiles.length} users`],
  ["lock", () => "Role based"],
  ["mail", () => `${emailTemplates.length} templates`],
  ["file-text", () => `${reportTemplates.length} templates`],
  ["file-check", () => `${ramsTemplates.length} templates`],
  ["palette", () => "Logo added"],
  ["palette", () => "Preview only"],
  ["database", () => "OneDrive"]
];

const setupCardMeta = {
  diary: ["calendar", () => `${jobs.length} jobs`, () => false],
  "weekly-planner": ["screen", () => `${weeklyPlanner.length} slots`, () => weeklyPlanner.some(isPlannerItemUnavailable)],
  valuations: ["pound", () => `${valuations.length} records`, () => valuations.some((item) => isReportOutstanding(item) || !isYes(item.completed))],
  staff: ["users", () => `${staffProfiles.length} staff`, () => staffProfiles.some((staff) => isUnavailableStatus(attendanceFor(staff.name, today).status))],
  training: ["clipboard", () => `${trainingMatrix.length} records`, () => trainingMatrix.some((record) => trainingStatus(record).className !== "ok")],
  vehicles: ["truck", () => `${vehicles.length} vehicles`, () => vehicles.some((vehicle) => vehicle.tracker !== "Active" || isReminderDate(vehicle.mot) || isReminderDate(vehicle.insurance))],
  compliance: ["shield-alert", () => `${complianceRecords().length} items`, () => complianceRecords().some((item) => complianceStatus(item).className !== "green")],
  rams: ["file-check", () => `${ramsItems.length} RAMS`, () => ramsItems.some((item) => item.status !== "sent")],
  documents: ["folder", () => `${companyDocuments.length} docs`, () => false],
  clients: ["building", () => `${clients.length} clients`, () => false],
  assets: ["package", () => `${assets.length} assets`, () => assets.some((asset) => asAssetObject(asset).status !== "OK")]
};

const tableBody = document.querySelector("#ramsTableBody");
const dialog = document.querySelector("#ramsDialog");
const form = document.querySelector("#ramsForm");
const dataDialog = document.querySelector("#dataDialog");
const dataForm = document.querySelector("#dataForm");
const dataFields = document.querySelector("#dataFields");
const dataDialogTitle = document.querySelector("#dataDialogTitle");
const dataSaveButton = document.querySelector("#dataSaveButton");
const dataSaveSystemButton = document.querySelector("#dataSaveSystemButton");
const dataDialogStatus = document.querySelector("#dataDialogStatus");
const kcDialog = document.querySelector("#kcDialog");
const kcDialogTitle = document.querySelector("#kcDialogTitle");
const kcDialogMessage = document.querySelector("#kcDialogMessage");
const kcDialogActions = document.querySelector("#kcDialogActions");
const kcDialogClose = document.querySelector("#kcDialogClose");
const kcDialogInputWrap = document.querySelector("#kcDialogInputWrap");
const kcDialogInput = document.querySelector("#kcDialogInput");
const kcDialogInputLabel = document.querySelector("#kcDialogInputLabel");
const dataCollectionInput = document.querySelector("#dataCollectionInput");
const dataIndexInput = document.querySelector("#dataIndexInput");
const jobDetailDialog = document.querySelector("#jobDetailDialog");
const jobDetailTitle = document.querySelector("#jobDetailTitle");
const jobDetailContent = document.querySelector("#jobDetailContent");
const closeJobDetailButton = document.querySelector("#closeJobDetailButton");
const staffDetailDialog = document.querySelector("#staffDetailDialog");
const staffDetailTitle = document.querySelector("#staffDetailTitle");
const staffDetailBody = document.querySelector("#staffDetailBody");
const closeStaffDetailButton = document.querySelector("#closeStaffDetailButton");
const sickCallDialog = document.querySelector("#sickCallDialog");
const sickCallForm = document.querySelector("#sickCallForm");
const sickCallTitle = document.querySelector("#sickCallTitle");
const sickCallName = document.querySelector("#sickCallName");
const sickCallCategory = document.querySelector("#sickCallCategory");
const sickCallWorkInjury = document.querySelector("#sickCallWorkInjury");
const sickCallIncidentNote = document.querySelector("#sickCallIncidentNote");
const sickCallInjuryWrap = document.querySelector("#sickCallInjuryWrap");
const sickCallIncidentWrap = document.querySelector("#sickCallIncidentWrap");
const attendanceDialog = document.querySelector("#attendanceDialog");
const attendanceForm = document.querySelector("#attendanceForm");
const attendanceDialogTitle = document.querySelector("#attendanceDialogTitle");
const attendanceRecordIndex = document.querySelector("#attendanceRecordIndex");
const attendanceStaffName = document.querySelector("#attendanceStaffName");
const attendanceEmployeeDisplay = document.querySelector("#attendanceEmployeeDisplay");
const attendanceTypeInput = document.querySelector("#attendanceTypeInput");
const attendanceStartDate = document.querySelector("#attendanceStartDate");
const attendanceEndDate = document.querySelector("#attendanceEndDate");
const attendanceOngoingInput = document.querySelector("#attendanceOngoingInput");
const attendanceReturnDate = document.querySelector("#attendanceReturnDate");
const attendanceDayType = document.querySelector("#attendanceDayType");
const attendanceWorkingDays = document.querySelector("#attendanceWorkingDays");
const attendanceScheduledStart = document.querySelector("#attendanceScheduledStart");
const attendanceActualArrival = document.querySelector("#attendanceActualArrival");
const attendanceMinutesLate = document.querySelector("#attendanceMinutesLate");
const attendanceOfficeNote = document.querySelector("#attendanceOfficeNote");
const attendanceConfidentialNote = document.querySelector("#attendanceConfidentialNote");
const attendanceCorrectionReasonWrap = document.querySelector("#attendanceCorrectionReasonWrap");
const attendanceCorrectionReason = document.querySelector("#attendanceCorrectionReason");
const attendanceVoidButton = document.querySelector("#attendanceVoidButton");
const attendanceSaveButton = document.querySelector("#attendanceSaveButton");
const valuationGraphDialog = document.querySelector("#valuationGraphDialog");
const valuationGraphContent = document.querySelector("#valuationGraphContent");
const valuationGraphSubtitle = document.querySelector("#valuationGraphSubtitle");
const closeValuationGraphButton = document.querySelector("#closeValuationGraphButton");
const certificateViewerDialog = document.querySelector("#certificateViewerDialog");
const certificateViewerTitle = document.querySelector("#certificateViewerTitle");
const certificateViewerPreview = document.querySelector("#certificateViewerPreview");
let activeCertificateRecord = null;
const addButton = document.querySelector("#addRamsButton");
const buildRamsButton = document.querySelector("#buildRamsButton");
const ramsBuilderDialog = document.querySelector("#ramsBuilderDialog");
const ramsBuildClient = document.querySelector("#ramsBuildClient");
const ramsBuildJobRef = document.querySelector("#ramsBuildJobRef");
const ramsBuildAddress = document.querySelector("#ramsBuildAddress");
const ramsBuildPostcode = document.querySelector("#ramsBuildPostcode");
const ramsBuildTechnician = document.querySelector("#ramsBuildTechnician");
const ramsBuildDate = document.querySelector("#ramsBuildDate");
const ramsBuildTitle = document.querySelector("#ramsBuildTitle");
const ramsBuildScope = document.querySelector("#ramsBuildScope");
const ramsBuildSource = document.querySelector("#ramsBuildSource");
const ramsBuildPpe = document.querySelector("#ramsBuildPpe");
const ramsBuildEquipment = document.querySelector("#ramsBuildEquipment");
const ramsBuilderPreview = document.querySelector("#ramsBuilderPreview");
const generateRamsPreviewButton = document.querySelector("#generateRamsPreviewButton");
const aiRamsDraftButton = document.querySelector("#aiRamsDraftButton");
const aiRamsStatus = document.querySelector("#aiRamsStatus");
const openRamsPrintButton = document.querySelector("#openRamsPrintButton");
const saveBuiltRamsButton = document.querySelector("#saveBuiltRamsButton");
const proofingRawNotes = document.querySelector("#proofingRawNotes");
const proofingStatus = document.querySelector("#proofingStatus");
const proofingFields = {
  clientName: document.querySelector("#proofingClientName"),
  propertyAddress: document.querySelector("#proofingPropertyAddress"),
  dateOfWorks: document.querySelector("#proofingDateOfWorks"),
  operativeName: document.querySelector("#proofingOperativeName"),
  areaOfWorks: document.querySelector("#proofingAreaOfWorks"),
  hygieneLevel: document.querySelector("#proofingHygieneLevel"),
  rodentActivity: document.querySelector("#proofingRodentActivity"),
  jobStatus: document.querySelector("#proofingJobStatus"),
  summary: document.querySelector("#proofingSummary"),
  worksCarriedOut: document.querySelector("#proofingWorksCarriedOut"),
  materialsUsed: document.querySelector("#proofingMaterialsUsed"),
  findingsRecommendations: document.querySelector("#proofingFindingsRecommendations")
};
const proofingBeforePhotosInput = document.querySelector("#proofingBeforePhotos");
const proofingAfterPhotosInput = document.querySelector("#proofingAfterPhotos");
const proofingBeforeGrid = document.querySelector("#proofingBeforeGrid");
const proofingAfterGrid = document.querySelector("#proofingAfterGrid");
const proofingReportPreview = document.querySelector("#proofingReportPreview");
const savedProofingReports = document.querySelector("#savedProofingReports");
const proofingSavedCount = document.querySelector("#proofingSavedCount");
const clearNativeProofingReport = document.querySelector("#clearNativeProofingReport");
const parseNativeProofingNotes = document.querySelector("#parseNativeProofingNotes");
const previewNativeProofingReport = document.querySelector("#previewNativeProofingReport");
const saveNativeProofingReport = document.querySelector("#saveNativeProofingReport");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const globalSearch = document.querySelector("#globalSearch");
const storageStatus = document.querySelector("#storageStatus");
const syncNowButton = document.querySelector("#syncNowButton");
const staffOneDriveStatus = document.querySelector("#staffOneDriveStatus");
const liveDateTime = document.querySelector("#liveDateTime");
const liveTime = document.querySelector("#liveTime");
const liveDate = document.querySelector("#liveDate");
const weatherCurrent = document.querySelector("#weatherCurrent");
const weatherSummary = document.querySelector("#weatherSummary");
const authScreen = document.querySelector("#authScreen");
const pinForm = document.querySelector("#pinForm");
const loginNameInput = document.querySelector("#loginNameInput");
const pinInput = document.querySelector("#pinInput");
const pinMessage = document.querySelector("#pinMessage");
const userGreeting = document.querySelector("#userGreeting");
const signedInUser = document.querySelector("#signedInUser");
const lockHubButton = document.querySelector("#lockHubButton");
const mobileMenuButton = document.querySelector("#mobileMenuButton");
const publishFeedsButton = document.querySelector("#publishFeedsButton");
const refreshFeedsButton = document.querySelector("#refreshFeedsButton");
const integrationStatus = document.querySelector("#integrationStatus");
const resetStatus = document.querySelector("#resetStatus");

const fields = {
  id: document.querySelector("#editingId"),
  title: document.querySelector("#titleInput"),
  client: document.querySelector("#clientInput"),
  job: document.querySelector("#jobInput"),
  technician: document.querySelector("#ramsTechnicianInput"),
  status: document.querySelector("#statusInput"),
  sentDate: document.querySelector("#sentDateInput"),
  techSentDate: document.querySelector("#techSentDateInput"),
  techReadDate: document.querySelector("#techReadDateInput"),
  reviewDate: document.querySelector("#reviewDateInput"),
  fileLocation: document.querySelector("#ramsFileInput"),
  notes: document.querySelector("#notesInput")
};

function kcAsk({ message, buttons = [{ label: "OK", value: "ok", style: "primary" }], input = null } = {}) {
  if (!kcDialog || !kcDialogMessage || !kcDialogActions) {
    return Promise.resolve(buttons[buttons.length - 1]?.value || "ok");
  }
  const previousFocus = document.activeElement;
  kcDialogMessage.textContent = message || "";
  kcDialogActions.innerHTML = "";
  kcDialog.returnValue = "";
  if (kcDialogTitle) kcDialogTitle.textContent = "Kingswood Connect says";
  if (input) {
    kcDialogInputWrap?.classList.remove("hidden");
    if (kcDialogInputLabel) kcDialogInputLabel.textContent = input.label || "Response";
    if (kcDialogInput) {
      kcDialogInput.value = input.value || "";
      kcDialogInput.placeholder = input.placeholder || "";
    }
  } else {
    kcDialogInputWrap?.classList.add("hidden");
    if (kcDialogInput) kcDialogInput.value = "";
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      if (kcDialog.open) kcDialog.close(value);
      kcDialog.removeEventListener("cancel", onCancel);
      kcDialog.removeEventListener("close", onClose);
      kcDialogClose?.removeEventListener("click", onCloseClick);
      if (previousFocus && typeof previousFocus.focus === "function") {
        window.setTimeout(() => previousFocus.focus(), 0);
      }
      resolve(input && value === "submit" ? (kcDialogInput?.value || "") : value);
    };
    const onCancel = (event) => {
      event.preventDefault();
      finish("cancel");
    };
    const onClose = () => {
      finish(kcDialog.returnValue || "cancel");
    };
    const onCloseClick = (event) => {
      event.preventDefault();
      finish("cancel");
    };
    kcDialog.addEventListener("cancel", onCancel);
    kcDialog.addEventListener("close", onClose);
    kcDialogClose?.addEventListener("click", onCloseClick);
    kcDialogActions.append(...buttons.map((buttonConfig) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = buttonConfig.label;
      button.className = buttonConfig.style === "danger" ? "kc-danger" : buttonConfig.style === "secondary" ? "kc-secondary" : "kc-primary";
      button.addEventListener("click", () => finish(buttonConfig.value));
      return button;
    }));
    kcDialog.showModal();
    window.setTimeout(() => (input ? kcDialogInput : kcDialogActions.querySelector("button"))?.focus(), 0);
  });
}

function kcInfo(message) {
  return kcAsk({ message });
}

async function kcYesNo(message) {
  const result = await kcAsk({
    message,
    buttons: [
      { label: "No", value: "no", style: "secondary" },
      { label: "Yes", value: "yes", style: "primary" }
    ]
  });
  return result === "yes";
}

async function kcConfirmAction(message, continueLabel = "Continue", danger = false) {
  const result = await kcAsk({
    message,
    buttons: [
      { label: "Cancel", value: "cancel", style: "secondary" },
      { label: continueLabel, value: "continue", style: danger ? "danger" : "primary" }
    ]
  });
  return result === "continue";
}

function kcInput(message, label = "Reason", value = "") {
  return kcAsk({
    message,
    input: { label, value },
    buttons: [
      { label: "Cancel", value: "cancel", style: "secondary" },
      { label: "Continue", value: "submit", style: "primary" }
    ]
  });
}

const dataModels = {
  jobs: {
    title: "Job",
    get: () => jobs,
    set: (items) => { jobs = items; },
    fields: [
      ["date", "Date", "date"],
      ["slot", "Job slot", "job-slot-select"],
      ["number", "Job reference number"],
      ["title", "Job title", "job-title-select"],
      ["client", "Client"],
      ["mainClient", "Main Client", "main-client-select"],
      ["siteCategory", "Site category", "site-category-select"],
      ["address", "Address"],
      ["postcode", "Postcode"],
      ["residentPhone", "Resident phone"],
      ["technician", "Technician", "job-technician-select"],
      ["rpeRequired", "Mandatory RPE required", "checkbox"],
      ["jobDetails", "Work instructions / job details", "snippet-textarea"],
      ["reportNotes", "Report notes", "textarea"],
      ["photos", "Pre-work images or reference screenshots", "snippet-textarea"],
      ["cost", "Valuation cost", "number"]
    ]
  },
  planner: {
    title: "Planner Item",
    get: () => weeklyPlanner,
    set: (items) => { weeklyPlanner = items; },
    fields: [
      ["date", "Date", "date"],
      ["technician", "Technician", "staff-select"],
      ["session", "Session", "session-select"],
      ["type", "Type", "planner-type-select"],
      ["jobAction", "Job action", "planner-action-select"],
      ["reassignTo", "Reassign to", "job-technician-select"],
      ["task", "Notes", "textarea"]
    ]
  },
  vehicles: {
    title: "Vehicle",
    get: () => vehicles,
    set: (items) => { vehicles = items; },
    fields: [
      ["vehicleId", "Vehicle ID", "readonly-vehicle-id"],
      ["registration", "Registration"],
      ["vehicle", "Vehicle"],
      ["driver", "Assigned driver", "staff-select"],
      ["status", "Vehicle status"],
      ["mot", "MOT expiry", "date"],
      ["service", "Service due", "date"],
      ["insurance", "Insurance expiry", "date"],
      ["tracker", "Tracker status"]
    ]
  },
  compliance: {
    title: "Compliance Item",
    get: () => complianceRecords(),
    set: (items) => {
      const outsideComplianceCentre = complianceItems.filter((item) => !isCompanyLevelCompliance(item));
      complianceItems = [...outsideComplianceCentre, ...items];
    },
    fields: [
      ["complianceType", "Compliance type", "compliance-type-select"],
      ["accreditationName", "Accreditation", "accreditation-select"],
      ["customAccreditationName", "Accreditation name"],
      ["title", "Title"],
      ["provider", "Provider or issuing body"],
      ["certificateNumber", "Policy or certificate number"],
      ["startDate", "Start date", "date"],
      ["expiryDate", "Expiry or review date", "date"],
      ["noExpiry", "No expiry", "checkbox"],
      ["responsiblePerson", "Responsible person", "office-owner-select"],
      ["reminderDays", "Reminder period", "number"],
      ["supportingDocument", "Supporting document", "compliance-document"],
      ["notes", "Notes", "textarea"]
    ]
  },
  fines: {
    title: "Fine or Charge",
    get: () => fines,
    set: (items) => { fines = items; },
    fields: [
      ["date", "Date", "date"],
      ["registration", "Vehicle registration", "vehicle-registration-select"],
      ["driver", "Driver", "staff-select"],
      ["location", "Location"],
      ["type", "Fine type", "fine-type-select"],
      ["customType", "Custom fine description"],
      ["amount", "Amount", "number"],
      ["deadline", "Deadline", "date"],
      ["status", "Status", "fine-status-select"],
      ["reference", "Fine reference number"],
      ["evidenceItems", "Evidence", "fine-evidence"],
      ["notes", "Notes", "textarea"]
    ]
  },
  valuations: {
    title: "Valuation",
    get: () => valuations,
    set: (items) => { valuations = items; },
    fields: [
      ["date", "Date", "date"],
      ["address", "Address"],
      ["postcode", "Postcode"],
      ["arkRef", "Ark job ref"],
      ["client", "Client"],
      ["mainClient", "Valuation group", "valuation-group-select"],
      ["technician", "Technician", "staff-select"],
      ["completed", "Completed? y/n"],
      ["reportReceived", "Report received? y/n"],
      ["cost", "Cost", "number"],
      ["checked", "Ark report completed? y/n"],
      ["notes", "Notes", "textarea"]
    ]
  },
  staff: {
    title: "Staff Member",
    get: () => staffProfiles,
    set: (items) => { staffProfiles = items; },
    fields: [
      ["name", "Name"],
      ["role", "Role", "role-select"],
      ["phone", "Phone"],
      ["email", "Email", "email"],
      ["techPin", "Tech app PIN", "password"],
      ["emergencyContact", "Emergency contact"],
      ["nextOfKin", "Next of kin"],
      ["assignedVan", "Assigned van"],
      ["incidentHistory", "Internal accident / incident log history", "textarea"],
      ["trainingRecords", "Training records", "textarea"],
      ["qualifications", "Qualifications", "textarea"],
      ["drivingLicence", "Driving licence details", "textarea"],
      ["holidayAllowance", "Holiday allowance", "number"],
      ["holidayUsed", "Holiday used", "number"],
      ["notes", "Notes", "textarea"]
    ]
  },
  attendance: {
    title: "Attendance Record",
    get: () => attendanceRecords,
    set: (items) => { attendanceRecords = items; },
    fields: [
      ["date", "Date", "date"],
      ["name", "Staff member", "staff-select"],
      ["status", "Status", "attendance-status-select"],
      ["category", "Functional H&S category", "absence-category-select"],
      ["recoveryDate", "Logged recovery / return date", "date"],
      ["workplaceInjury", "Was this injury sustained during an onsite work activity for Kingswood?", "yes-no-select"],
      ["workplaceIncident", "Incident log / management note", "textarea"],
      ["returnToWorkCompleted", "Return to Work Health Declaration Completed", "checkbox"],
      ["returnToWorkNotes", "Return to work notes", "textarea"],
      ["fitNote", "Fit note / file note", "textarea"]
    ]
  },
  holidays: {
    title: "Holiday Request",
    get: () => holidayRequests,
    set: (items) => { holidayRequests = items; },
    fields: [
      ["name", "Staff member", "staff-select"],
      ["from", "From", "date"],
      ["to", "To", "date"],
      ["dayType", "Day Type", "holiday-day-type-select"],
      ["dayPart", "AM / PM", "holiday-day-part-select"],
      ["days", "Days", "holiday-days-number"],
      ["status", "Status"],
      ["notes", "Notes", "textarea"]
    ]
  },
  companyHolidays: {
    title: "Company Holiday / Shutdown",
    get: () => companyHolidays,
    set: (items) => { companyHolidays = items; },
    fields: [
      ["title", "Title"],
      ["from", "From", "date"],
      ["to", "To", "date"],
      ["days", "Days", "number"],
      ["type", "Type"]
    ]
  },
  training: {
    title: "Training Record",
    get: () => trainingMatrix,
    set: (items) => { trainingMatrix = items; },
    fields: [
      ["employee", "Employee", "staff-select"],
      ["course", "Training / qualification"],
      ["provider", "Provider"],
      ["certificateNumber", "Certificate / licence number"],
      ["completedDate", "Completed date", "date"],
      ["expiryDate", "Expiry date", "date"],
      ["noExpiry", "No expiry", "checkbox"],
      ["lifecycleStatus", "Lifecycle status", "training-lifecycle-select"],
      ["trainingDocument", "Certificate / document", "training-document"],
      ["notes", "Notes", "textarea"]
    ]
  },
  technicians: {
    title: "Technician",
    get: () => technicians,
    set: (items) => { technicians = items; },
    fields: [
      ["name", "Name"],
      ["role", "Role"],
      ["phone", "Phone"],
      ["van", "Assigned van"],
      ["location", "Location"],
      ["training", "Training"]
    ]
  },
  clients: {
    title: "Client",
    get: () => clients.map(asCardObject),
    set: (items) => { clients = items; },
    fields: [
      ["title", "Client"],
      ["description", "Details", "textarea"]
    ]
  },
  documents: {
    title: "Company Document",
    get: () => companyDocuments.map(asCompanyDocument),
    set: (items) => { companyDocuments = items; },
    fields: [
      ["title", "Document title"],
      ["category", "Category", "company-document-category-select"],
      ["oneDriveLink", "OneDrive link / file path"],
      ["issueDate", "Issue date", "date"],
      ["expiryDate", "Expiry date", "date"],
      ["owner", "Owner", "office-owner-select"]
    ]
  },
  assets: {
    title: "Asset",
    get: () => assets.map(asAssetObject),
    set: (items) => { assets = items; },
    fields: [
      ["assetSectionDetails", "Asset Details", "section-heading"],
      ["asset", "Asset name"],
      ["assetId", "Asset ID", "readonly-text"],
      ["category", "Category", "asset-category-select"],
      ["make", "Make"],
      ["model", "Model"],
      ["serialNumber", "Serial number"],
      ["description", "Description", "textarea"],
      ["assetSectionOwnership", "Ownership", "section-heading"],
      ["purchaseDate", "Purchase date", "date"],
      ["purchaseCost", "Purchase cost", "number"],
      ["supplier", "Supplier"],
      ["warrantyExpiry", "Warranty expiry", "date"],
      ["assetSectionLocation", "Location and Responsibility", "section-heading"],
      ["assignedStaffId", "Assigned to employee", "asset-employee-select"],
      ["vehicleId", "Stored in vehicle", "asset-vehicle-select"],
      ["otherLocation", "Other location"],
      ["assetSectionCondition", "Condition and Status", "section-heading"],
      ["condition", "Condition", "asset-condition-select"],
      ["status", "Status", "asset-status-select"],
      ["powerSource", "Power source", "asset-power-source-select"],
      ["assetSectionMaintenance", "Inspection and Maintenance", "section-heading"],
      ["inspectionRequired", "Inspection required", "yes-no-select"],
      ["inspectionFrequency", "Inspection frequency"],
      ["lastInspectionDate", "Last inspection date", "date"],
      ["nextInspectionDue", "Next inspection due", "date"],
      ["serviceRequired", "Service required", "yes-no-select"],
      ["serviceFrequency", "Service frequency"],
      ["lastServiceDate", "Last service date", "date"],
      ["nextServiceDue", "Next service due", "date"],
      ["patTestingRequired", "PAT testing required", "yes-no-select"],
      ["lastPatDate", "Last PAT test date", "date"],
      ["nextPatDue", "Next PAT test due", "date"],
      ["patResult", "PAT test result", "asset-pat-result-select"],
      ["assetSectionDocuments", "Photos and Documents", "section-heading"],
      ["assetDocuments", "Photos and documents", "asset-documents"]
    ]
  },
  emailTemplates: {
    title: "Email Template",
    get: () => emailTemplates,
    set: (items) => { emailTemplates = items; },
    fields: [
      ["name", "Template name"],
      ["subject", "Subject"],
      ["body", "Email body", "textarea"]
    ]
  },
  reportTemplates: {
    title: "Report Template",
    get: () => reportTemplates,
    set: (items) => { reportTemplates = items; },
    fields: [
      ["name", "Template name"],
      ["description", "Details", "textarea"]
    ]
  },
  ramsTemplates: {
    title: "RAMS Template",
    get: () => ramsTemplates,
    set: (items) => { ramsTemplates = items; },
    fields: [
      ["title", "Template title"],
      ["description", "Details", "textarea"]
    ]
  },
  branding: {
    title: "Company Branding",
    get: () => [companyBranding],
    set: (items) => { companyBranding = items[0] || companyBranding; },
    fields: [
      ["companyName", "Company name"],
      ["logo", "Logo file"],
      ["navy", "Navy colour"],
      ["orange", "Orange colour"]
    ]
  }
};

function asCardObject(item) {
  return Array.isArray(item) ? { title: item[0], description: item[1] } : item;
}

function asCompanyDocument(item) {
  if (Array.isArray(item)) {
    return {
      title: item[0] || "Company document",
      category: "Policy",
      oneDriveLink: item[1] || "",
      issueDate: "",
      expiryDate: "",
      owner: "Kevin",
      lastUpdatedBy: "Kevin",
      createdAt: today,
      updatedAt: today
    };
  }
  return {
    title: item.title || "Company document",
    category: companyDocumentCategories.includes(item.category) ? item.category : "Policy",
    oneDriveLink: item.oneDriveLink || item.description || item.fileLocation || "",
    issueDate: item.issueDate || "",
    expiryDate: item.expiryDate || "",
    owner: item.owner || "Kevin",
    lastUpdatedBy: item.lastUpdatedBy || item.owner || "Kevin",
    createdAt: item.createdAt || today,
    updatedAt: item.updatedAt || today
  };
}

function asAssetObject(item) {
  const source = Array.isArray(item)
    ? { asset: item[0], category: item[1], heldBy: item[2], inspectionDue: item[3], status: item[4] }
    : { ...item };
  const assetName = source.asset || source.name || "Asset";
  const assetId = source.assetId || source.id || generateAssetId(assetName);
  const legacyStatus = source.status === "OK" ? "In use" : source.status || "In use";
  const legacyCondition = source.condition || (legacyStatus === "Needs repair" || legacyStatus === "Out of service" ? "Poor" : "Good");
  return {
    ...source,
    id: source.id || assetId,
    assetId,
    asset: assetName,
    category: assetCategories.includes(source.category) ? source.category : (source.category || "Other"),
    make: source.make || "",
    model: source.model || "",
    serialNumber: source.serialNumber || "",
    description: source.description || "",
    purchaseDate: source.purchaseDate || "",
    purchaseCost: Number(source.purchaseCost || 0),
    supplier: source.supplier || "",
    warrantyExpiry: source.warrantyExpiry || "",
    assignedStaffId: source.assignedStaffId || staffIdFromName(source.heldBy) || "",
    vehicleId: source.vehicleId || vehicleIdFromRegistration(source.vehicle || source.registration) || "",
    otherLocation: source.otherLocation || (!staffIdFromName(source.heldBy) && source.heldBy ? source.heldBy : ""),
    condition: assetConditions.includes(source.condition) ? source.condition : legacyCondition,
    status: assetStatuses.includes(legacyStatus) ? legacyStatus : "In use",
    powerSource: assetPowerSources.includes(source.powerSource) ? source.powerSource : "Not applicable",
    inspectionRequired: source.inspectionRequired || (source.inspectionDue ? "Yes" : "No"),
    inspectionFrequency: source.inspectionFrequency || "",
    lastInspectionDate: source.lastInspectionDate || "",
    nextInspectionDue: source.nextInspectionDue || source.inspectionDue || "",
    serviceRequired: source.serviceRequired || "No",
    serviceFrequency: source.serviceFrequency || "",
    lastServiceDate: source.lastServiceDate || "",
    nextServiceDue: source.nextServiceDue || "",
    patTestingRequired: source.patTestingRequired || "No",
    lastPatDate: source.lastPatDate || "",
    nextPatDue: source.nextPatDue || "",
    patResult: source.patResult || "",
    documents: Array.isArray(source.documents) ? source.documents : [],
    history: Array.isArray(source.history) ? source.history : [{
      action: "Imported / normalised",
      by: currentUserName(),
      at: new Date().toISOString(),
      notes: "Existing asset record preserved in the upgraded register."
    }],
    createdAt: source.createdAt || today,
    updatedAt: source.updatedAt || today
  };
}

function generateAssetId(name = "Asset") {
  const prefix = String(name || "Asset").replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "AST";
  const existing = assets.map((item) => asRawAssetId(item)).filter(Boolean);
  let counter = existing.length + 1;
  let next = `AST-${prefix}-${String(counter).padStart(4, "0")}`;
  while (existing.includes(next)) {
    counter += 1;
    next = `AST-${prefix}-${String(counter).padStart(4, "0")}`;
  }
  return next;
}

function asRawAssetId(item) {
  if (Array.isArray(item)) return "";
  return item.assetId || item.id || "";
}

function staffIdFromName(name = "") {
  if (!name) return "";
  const match = staffProfiles.find((staff) => staff.name === name);
  return match?.staffId || "";
}

function vehicleIdFromRegistration(registration = "") {
  if (!registration) return "";
  const match = vehicles.map(asVehicleObject).find((vehicle) => vehicle.registration === registration);
  return match?.vehicleId || match?.registration || "";
}

function normaliseVehicleRegistration(value = "") {
  return String(value || "").toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
}

function stableVehicleIdForUi(vehicle = {}) {
  if (String(vehicle.vehicleId || "").startsWith("VEH-")) return vehicle.vehicleId;
  const registration = normaliseVehicleRegistration(vehicle.registration || vehicle.reg || vehicle.numberPlate);
  if (registration) return `VEH-${registration}`;
  const descriptor = String(vehicle.vehicle || "vehicle").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `VEH-${descriptor || Date.now()}`;
}

function normaliseVehicleForUi(vehicle = {}) {
  return {
    ...vehicle,
    vehicleId: stableVehicleIdForUi(vehicle),
    status: vehicle.status || "Active",
    assignedStaffId: vehicle.assignedStaffId || vehicle.assignedDriverStaffId || vehicle.staffId || "",
    assignedTechnicianId: vehicle.assignedTechnicianId || vehicle.technicianId || "",
    assignmentStatus: vehicle.assignmentStatus || (vehicle.assignedStaffId || vehicle.assignedTechnicianId ? "Active" : "")
  };
}

function staffNameFromId(staffId = "") {
  if (!staffId) return "";
  return staffProfiles.find((staff) => staff.staffId === staffId)?.name || "";
}

function vehicleFromId(vehicleId = "") {
  if (!vehicleId) return null;
  return vehicles.map(asVehicleObject).find((vehicle) => (vehicle.vehicleId || vehicle.registration) === vehicleId) || null;
}

function assetHolderLabel(item) {
  const staffName = staffNameFromId(item.assignedStaffId);
  if (staffName) return staffName;
  const vehicle = vehicleFromId(item.vehicleId);
  if (vehicle) return `Vehicle: ${vehicle.registration}`;
  return item.otherLocation || "Office / storage";
}

function assetVehicleOrLocationLabel(item) {
  const vehicle = vehicleFromId(item.vehicleId);
  if (vehicle) return vehicle.registration;
  return item.otherLocation || (item.assignedStaffId ? "With employee" : "Office / storage");
}

function assetDueState(dateValue, warningDays = 30) {
  if (!dateValue) return { label: "Not set", className: "draft", days: Infinity };
  const days = daysUntil(dateValue);
  if (days < 0) return { label: "Overdue", className: "urgent", days };
  if (days <= warningDays) return { label: "Due soon", className: "warning", days };
  return { label: "Current", className: "ok", days };
}

function assetNeedsInspection(item) {
  const asset = asAssetObject(item);
  return asset.inspectionRequired === "Yes" && assetDueState(asset.nextInspectionDue).className !== "ok";
}

function assetNeedsService(item) {
  const asset = asAssetObject(item);
  return asset.serviceRequired === "Yes" && assetDueState(asset.nextServiceDue).className !== "ok";
}

function assetPatOverdue(item) {
  const asset = asAssetObject(item);
  if (asset.powerSource !== "Mains powered" || asset.patTestingRequired !== "Yes") return false;
  return assetDueState(asset.nextPatDue).className === "urgent";
}

function isCriticalCompanyDocument(documentRecord) {
  const title = String(documentRecord.title || "").toLowerCase();
  return criticalDocumentCategories.includes(documentRecord.category)
    || title.includes("safecontractor")
    || title.includes("public liability")
    || title.includes("employers liability")
    || title.includes("employer liability");
}

function companyDocumentStatus(documentRecord) {
  const item = asCompanyDocument(documentRecord);
  if (!item.expiryDate) {
    return { label: "Active", value: "active", days: Infinity, tier: "No expiry", className: "ok" };
  }
  const days = daysUntil(item.expiryDate);
  const critical = isCriticalCompanyDocument(item);
  if (days < 0) {
    return { label: "Expired", value: "expired", days, tier: critical ? "Critical" : "Standard", className: "danger" };
  }
  const threshold = critical ? 90 : 30;
  if (days <= threshold) {
    return { label: "Expiring", value: "expiring", days, tier: critical ? "Critical" : "Standard", className: critical ? "danger" : "warning" };
  }
  return { label: "Active", value: "active", days, tier: critical ? "Critical" : "Standard", className: "ok" };
}

function companyDocumentAlerts() {
  return companyDocuments.map(asCompanyDocument)
    .map((item) => ({ item, status: companyDocumentStatus(item) }))
    .filter(({ status }) => status.value !== "active")
    .sort((a, b) => a.status.days - b.status.days);
}

function companyDocumentReminderSummary() {
  const docs = companyDocuments.map(asCompanyDocument);
  const alerts = docs.map((item) => ({ item, status: companyDocumentStatus(item) }));
  return {
    total: docs.length,
    criticalExpiring: alerts.filter(({ status }) => status.value === "expiring" && status.tier === "Critical").length,
    standardExpiring: alerts.filter(({ status }) => status.value === "expiring" && status.tier === "Standard").length,
    expired: alerts.filter(({ status }) => status.value === "expired").length,
    within90: alerts.filter(({ status }) => Number.isFinite(status.days) && status.days >= 0 && status.days <= 90).length,
    within60: alerts.filter(({ status }) => Number.isFinite(status.days) && status.days >= 0 && status.days <= 60).length,
    within30: alerts.filter(({ status }) => Number.isFinite(status.days) && status.days >= 0 && status.days <= 30).length
  };
}

function staffNames() {
  return [...new Set(staffProfiles
    .filter((staff) => String(staff.status || "Active").toLowerCase() !== "left")
    .filter((staff) => String(staff.role || "").toLowerCase().includes("technician") || staff.technicianId)
    .map((staff) => staff.name)
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function renderSelectField(key, label, value, options, displayLabel = (option) => option) {
  const optionValues = [...new Set([value, ...options].filter(Boolean))];
  return `
    <label>
      ${label}
      <select data-field="${key}">
        <option value="">-- Select --</option>
        ${optionValues.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(displayLabel(option))}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderCheckboxField(key, label, value) {
  return `
    <label class="checkbox-field full-width">
      <input data-field="${key}" type="checkbox" ${value === true || value === "true" || value === "on" ? "checked" : ""}>
      <span>${label}</span>
    </label>
  `;
}

function renderJobTechnicianField(key, label, value, jobDate = today) {
  const optionValues = [...new Set([value, ...staffNames()].filter(Boolean))];
  return `
    <label>
      ${label}
      <select data-field="${key}" data-job-technician-select>
        <option value="">-- Select --</option>
        ${optionValues.map((option) => {
          const attendance = attendanceFor(option, jobDate || today);
          const locked = isUnavailableStatus(attendance.status) && option !== value;
          const suffix = locked ? ` - unavailable (${attendance.status})` : "";
          return `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""} ${locked ? "disabled" : ""}>${escapeHtml(option + suffix)}</option>`;
        }).join("")}
      </select>
    </label>
  `;
}

function dataDialogProgressMessage(collection = "") {
  const messages = {
    jobs: "Checking job details...",
    clients: "Checking client details...",
    vehicles: "Checking vehicle details...",
    compliance: "Checking compliance details...",
    training: "Checking training details...",
    staff: "Checking staff details...",
    holidays: "Checking holiday details...",
    companyHolidays: "Checking company holiday details...",
    planner: "Checking planner details...",
    attendance: "Checking attendance details...",
    documents: "Checking document details...",
    assets: "Checking asset details...",
    fines: "Checking fine details..."
  };
  return messages[collection] || "Checking details...";
}

function iconSvg(name) {
  const icons = {
    alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 2.4 17.7A2 2 0 0 0 4.1 21h15.8a2 2 0 0 0 1.7-3.3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    bell: '<path d="M10 21h4"/><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
    building: '<path d="M3 21h18"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M9 7h1"/><path d="M14 7h1"/><path d="M9 11h1"/><path d="M14 11h1"/><path d="M9 15h1"/><path d="M14 15h1"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/>',
    clipboard: '<path d="M9 3h6l1 2h3v16H5V5h3l1-2Z"/><path d="M9 12h6"/><path d="M9 16h6"/>',
    dashboard: '<rect x="3" y="3" width="7" height="8" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    "file-check": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-5"/>',
    "file-text": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
    package: '<path d="m21 8-9-5-9 5 9 5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    palette: '<path d="M12 22a10 10 0 1 1 10-10c0 2-1 3-3 3h-2a2 2 0 0 0-2 2c0 2-1 5-3 5Z"/><path d="M7 10h.01"/><path d="M10 7h.01"/><path d="M14 7h.01"/><path d="M17 10h.01"/>',
    pound: '<path d="M18 7.5a5 5 0 0 0-9.5 2.2V21"/><path d="M6 13h9"/><path d="M6 21h12"/>',
    receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-3 2-3-2-3 2-3-2-3 2Z"/><path d="M8 9h8"/><path d="M8 13h6"/>',
    screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 16v5"/>',
    settings: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-2 .3 1.7 1.7 0 0 0-.5 1.4H9a1.7 1.7 0 0 0-.5-1.4 1.7 1.7 0 0 0-2-.3l-.2.1-2-3.4.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.4-1V9a1.7 1.7 0 0 0 1.4-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 2-.3A1.7 1.7 0 0 0 9 1h6a1.7 1.7 0 0 0 .5 1.4 1.7 1.7 0 0 0 2 .3l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.4 1v6a1.7 1.7 0 0 0-1.3 1Z"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    "shield-alert": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    truck: '<path d="M3 6h11v10H3Z"/><path d="M14 10h4l3 3v3h-7Z"/><path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
    "user-check": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>'
  };

  return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.dashboard}</svg>`;
}

function iconShell(name) {
  return `<span class="card-icon" aria-hidden="true">${iconSvg(name)}</span>`;
}

function navIconShell(name) {
  return `<span class="nav-icon" aria-hidden="true">${iconSvg(name)}</span>`;
}

function installNavIcons() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    if (button.querySelector(".nav-icon")) return;
    button.innerHTML = `${navIconShell(button.dataset.icon)}<span>${escapeHtml(button.textContent.trim())}</span>`;
  });
}

function setSidebarGroupOpen(group, open) {
  if (!group) return;
  const toggle = group.querySelector(".nav-group-toggle");
  const panel = group.querySelector(".nav-group-panel");
  group.classList.toggle("open", open);
  toggle?.setAttribute("aria-expanded", open ? "true" : "false");
  if (panel) panel.hidden = !open;
}

function syncSidebarGroupsForSection(sectionId) {
  const activeGroup = sectionId ? document.querySelector(`.nav-group .nav-button[data-section="${CSS.escape(sectionId)}"]`)?.closest(".nav-group") : null;
  document.querySelectorAll(".nav-group").forEach((group) => {
    setSidebarGroupOpen(group, group === activeGroup);
  });
}

function updateLiveDateTime() {
  const now = new Date();
  if (liveTime) {
    liveTime.textContent = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(now);
  }
  if (liveDate) {
    liveDate.textContent = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(now);
  }
  if (liveDateTime) liveDateTime.textContent = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(now);
}

function weatherDescription(code) {
  const descriptions = {
    0: "Clear",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Cloudy",
    45: "Fog",
    48: "Freezing fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    95: "Thunder",
    96: "Thunder and hail",
    99: "Thunder and hail"
  };
  return descriptions[Number(code)] || "Weather";
}

async function updateOrpingtonWeather() {
  if (!weatherCurrent || !weatherSummary) return;

  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=51.3746&longitude=0.0986&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FLondon&forecast_days=1";
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Weather unavailable");
    const data = await response.json();
    const currentTemp = Math.round(Number(data?.current?.temperature_2m));
    const description = weatherDescription(data?.current?.weather_code);
    const high = Math.round(Number(data?.daily?.temperature_2m_max?.[0]));
    const low = Math.round(Number(data?.daily?.temperature_2m_min?.[0]));
    const rainChance = Number(data?.daily?.precipitation_probability_max?.[0]);
    const rainText = Number.isFinite(rainChance) ? ` | Rain ${rainChance}%` : "";

    lastWeatherCode = data?.current?.weather_code;
    weatherCurrent.textContent = `${currentTemp}°C ${description}`;
    weatherSummary.textContent = `H ${high}° / L ${low}°${rainText}`;
    applyDashboardHeaderTheme(lastWeatherCode);
  } catch {
    weatherCurrent.textContent = "Weather unavailable";
    weatherSummary.textContent = "Will refresh automatically";
    applyDashboardHeaderTheme();
  }
}

function applyDashboardHeaderTheme(weatherCode = lastWeatherCode) {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;
  if (weatherCode !== undefined && weatherCode !== null) {
    lastWeatherCode = weatherCode;
  }
  topbar.dataset.headerTheme = resolveHeaderTheme(lastWeatherCode);
  topbar.dataset.headerMode = isHeaderPreviewMode() ? "preview" : "live";
  syncHeaderSceneEffects(topbar);
  updateHeaderPreviewBadge();
}

function syncHeaderSceneEffects(topbar) {
  syncSunnyEffect(topbar);
  syncRainEffect(topbar);
  syncSnowEffect(topbar);
  syncEasterPetals(topbar);
  syncHalloweenEffects(topbar);
}

function syncSunnyEffect(topbar) {
  const weatherLayer = topbar?.querySelector(".scene-weather");
  if (!weatherLayer) return;
  const shouldShowSunny =
    topbar.dataset.headerTheme === "clear" &&
    selectedSeasonalThemePreview() === "none";
  topbar.classList.toggle("sunny-preview-active", shouldShowSunny);
  if (!shouldShowSunny) {
    weatherLayer.querySelectorAll(".sunny-light-layer").forEach((layer) => layer.remove());
    return;
  }
  if (weatherLayer.querySelector(".sunny-light-layer")) return;
  const layer = document.createElement("span");
  layer.className = "sunny-light-layer";
  weatherLayer.appendChild(layer);
}

function syncRainEffect(topbar) {
  const weatherLayer = topbar?.querySelector(".scene-weather");
  if (!weatherLayer) return;
  const shouldShowRain =
    topbar.dataset.headerTheme === "rain" &&
    selectedSeasonalThemePreview() === "none";
  topbar.classList.toggle("rain-preview-active", shouldShowRain);
  topbar.classList.toggle("rain-effect-active", shouldShowRain);
  if (!shouldShowRain) {
    weatherLayer.querySelectorAll(".rain-layer").forEach((layer) => layer.remove());
    return;
  }
  if (
    weatherLayer.querySelectorAll(".rain-layer").length === 3 &&
    weatherLayer.querySelectorAll(".rain-drop").length === rainDropLayout.length
  ) {
    return;
  }
  weatherLayer.querySelectorAll(".rain-layer").forEach((layer) => layer.remove());
  const layers = {
    background: document.createElement("span"),
    midground: document.createElement("span"),
    foreground: document.createElement("span")
  };
  Object.entries(layers).forEach(([name, layer]) => {
    layer.className = `rain-layer rain-${name}`;
    weatherLayer.appendChild(layer);
  });
  rainDropLayout.forEach((dropData) => {
    const drop = document.createElement("span");
    drop.className = "rain-drop";
    Object.entries(dropData.styles).forEach(([key, value]) => {
      drop.style.setProperty(key, value);
    });
    layers[dropData.layer].appendChild(drop);
  });
}

function syncSnowEffect(topbar) {
  const weatherLayer = topbar?.querySelector(".scene-weather");
  if (!weatherLayer) return;
  const shouldShowSnow =
    topbar.dataset.headerTheme === "snow" &&
    selectedSeasonalThemePreview() === "none";
  topbar.classList.toggle("snow-preview-active", shouldShowSnow);
  if (!shouldShowSnow) {
    weatherLayer.querySelectorAll(".weather-snow-layer").forEach((layer) => layer.remove());
    return;
  }
  if (
    weatherLayer.querySelectorAll(".weather-snow-layer").length === 3 &&
    weatherLayer.querySelectorAll(".weather-snow-flake").length === snowFlakeLayout.length
  ) {
    return;
  }
  weatherLayer.querySelectorAll(".weather-snow-layer").forEach((layer) => layer.remove());
  const layers = {
    background: document.createElement("span"),
    midground: document.createElement("span"),
    foreground: document.createElement("span")
  };
  Object.entries(layers).forEach(([name, layer]) => {
    layer.className = `weather-snow-layer weather-snow-${name}`;
    weatherLayer.appendChild(layer);
  });
  snowFlakeLayout.forEach((flakeData) => {
    const flake = document.createElement("span");
    flake.className = "weather-snow-flake";
    Object.entries(flakeData.styles).forEach(([key, value]) => {
      flake.style.setProperty(key, value);
    });
    layers[flakeData.layer].appendChild(flake);
  });
}

function syncEasterPetals(topbar) {
  const weatherLayer = topbar?.querySelector(".scene-weather");
  if (!weatherLayer) return;
  if (topbar.dataset.headerTheme !== "easter") {
    weatherLayer.querySelectorAll(".easter-petal").forEach((petal) => petal.remove());
    return;
  }
  const existing = weatherLayer.querySelectorAll(".easter-petal");
  if (existing.length === easterPetalLayout.length) return;
  weatherLayer.querySelectorAll(".easter-petal").forEach((petal) => petal.remove());
  easterPetalLayout.forEach((petalData) => {
    const petal = document.createElement("span");
    petal.className = `easter-petal ${petalData.depth}`;
    Object.entries(petalData.styles).forEach(([key, value]) => {
      petal.style.setProperty(key, value);
    });
    weatherLayer.appendChild(petal);
  });
}

function syncHalloweenEffects(topbar) {
  const weatherLayer = topbar?.querySelector(".scene-weather");
  if (!weatherLayer) return;
  if (topbar.dataset.headerTheme !== "halloween") {
    weatherLayer.querySelectorAll(".halloween-mist, .halloween-glow, .halloween-bat").forEach((item) => item.remove());
    return;
  }
  const existingBats = weatherLayer.querySelectorAll(".halloween-bat");
  const hasMist = Boolean(weatherLayer.querySelector(".halloween-mist"));
  const hasGlow = Boolean(weatherLayer.querySelector(".halloween-glow"));
  if (existingBats.length === halloweenBatLayout.length && hasMist && hasGlow) return;
  weatherLayer.querySelectorAll(".halloween-mist, .halloween-glow, .halloween-bat").forEach((item) => item.remove());
  const mist = document.createElement("span");
  mist.className = "halloween-mist";
  weatherLayer.appendChild(mist);
  const glow = document.createElement("span");
  glow.className = "halloween-glow";
  weatherLayer.appendChild(glow);
  halloweenBatLayout.forEach((batData) => {
    const bat = document.createElement("span");
    bat.className = "halloween-bat";
    Object.entries(batData).forEach(([key, value]) => {
      bat.style.setProperty(key, value);
    });
    weatherLayer.appendChild(bat);
  });
}

function buildRainDropLayout() {
  const drops = [];
  const addDrops = (layer, count, options) => {
    for (let index = 0; index < count; index += 1) {
      const left = (options.leftSeed + index * options.leftStep) % 104;
      const length = options.minLength + ((index * options.lengthStep) % options.lengthRange);
      const opacity = (options.minOpacity + ((index * options.opacityStep) % options.opacityRange)) / 100;
      const duration = (options.minDuration + ((index * options.durationStep) % options.durationRange)) / 100;
      const delay = -((index * options.delayStep) % options.delayRange) / 100;
      const drift = options.drift - ((index * 3) % options.driftVariance);
      drops.push({
        layer,
        styles: {
          "--left": `${left}%`,
          "--h": `${length}px`,
          "--w": `${options.width + ((index * options.widthStep) % options.widthRange) / 10}px`,
          "--angle": `${options.angle + ((index * options.angleStep) % options.angleRange) - options.angleOffset}deg`,
          "--opacity": opacity.toFixed(2),
          "--duration": `${duration.toFixed(2)}s`,
          "--delay": `${delay.toFixed(2)}s`,
          "--drift": `${drift}px`
        }
      });
    }
  };
  addDrops("background", 46, {
    leftSeed: 3,
    leftStep: 19,
    minLength: 9,
    lengthRange: 8,
    lengthStep: 5,
    width: .6,
    widthRange: 4,
    widthStep: 1,
    angle: 10,
    angleRange: 7,
    angleStep: 2,
    angleOffset: 2,
    minOpacity: 10,
    opacityRange: 10,
    opacityStep: 7,
    minDuration: 165,
    durationRange: 80,
    durationStep: 17,
    delayRange: 260,
    delayStep: 31,
    drift: -30,
    driftVariance: 10
  });
  addDrops("midground", 28, {
    leftSeed: 7,
    leftStep: 29,
    minLength: 15,
    lengthRange: 13,
    lengthStep: 7,
    width: .8,
    widthRange: 5,
    widthStep: 2,
    angle: 12,
    angleRange: 9,
    angleStep: 4,
    angleOffset: 3,
    minOpacity: 22,
    opacityRange: 18,
    opacityStep: 11,
    minDuration: 105,
    durationRange: 58,
    durationStep: 19,
    delayRange: 210,
    delayStep: 37,
    drift: -40,
    driftVariance: 14
  });
  addDrops("foreground", 9, {
    leftSeed: 11,
    leftStep: 41,
    minLength: 26,
    lengthRange: 16,
    lengthStep: 9,
    width: 1,
    widthRange: 6,
    widthStep: 3,
    angle: 13,
    angleRange: 11,
    angleStep: 5,
    angleOffset: 4,
    minOpacity: 30,
    opacityRange: 18,
    opacityStep: 13,
    minDuration: 78,
    durationRange: 34,
    durationStep: 17,
    delayRange: 180,
    delayStep: 43,
    drift: -52,
    driftVariance: 18
  });
  return drops;
}

const rainDropLayout = buildRainDropLayout();

function buildSnowFlakeLayout() {
  const flakes = [];
  const addFlakes = (layer, count, options) => {
    for (let index = 0; index < count; index += 1) {
      const left = (options.leftSeed + index * options.leftStep) % 104;
      const size = options.minSize + ((index * options.sizeStep) % options.sizeRange) / 10;
      const opacity = (options.minOpacity + ((index * options.opacityStep) % options.opacityRange)) / 100;
      const duration = (options.minDuration + ((index * options.durationStep) % options.durationRange)) / 10;
      const delay = -((index * options.delayStep) % options.delayRange) / 10;
      const driftA = options.driftA - ((index * 5) % options.driftVariance);
      const driftB = options.driftB + ((index * 7) % options.driftVariance);
      const endX = options.endX - ((index * 3) % options.endVariance);
      flakes.push({
        layer,
        styles: {
          "--left": `${left}%`,
          "--size": `${size.toFixed(1)}px`,
          "--opacity": opacity.toFixed(2),
          "--duration": `${duration.toFixed(1)}s`,
          "--delay": `${delay.toFixed(1)}s`,
          "--drift-a": `${driftA}px`,
          "--drift-b": `${driftB}px`,
          "--end-x": `${endX}px`,
          "--blur": `${options.blur}px`,
          "--scale": (options.scale + ((index * options.scaleStep) % options.scaleRange) / 100).toFixed(2),
          "--spin": `${options.spin + ((index * options.spinStep) % options.spinRange)}deg`
        }
      });
    }
  };
  addFlakes("background", 34, {
    leftSeed: 2,
    leftStep: 17,
    minSize: 18,
    sizeRange: 12,
    sizeStep: 5,
    minOpacity: 14,
    opacityRange: 13,
    opacityStep: 7,
    minDuration: 210,
    durationRange: 95,
    durationStep: 19,
    delayRange: 280,
    delayStep: 31,
    driftA: 12,
    driftB: -8,
    endX: 20,
    driftVariance: 24,
    endVariance: 18,
    blur: .2,
    scale: .7,
    scaleRange: 18,
    scaleStep: 5,
    spin: 55,
    spinRange: 80,
    spinStep: 11
  });
  addFlakes("midground", 22, {
    leftSeed: 8,
    leftStep: 29,
    minSize: 24,
    sizeRange: 16,
    sizeStep: 7,
    minOpacity: 25,
    opacityRange: 18,
    opacityStep: 9,
    minDuration: 155,
    durationRange: 70,
    durationStep: 17,
    delayRange: 230,
    delayStep: 37,
    driftA: -16,
    driftB: 18,
    endX: -24,
    driftVariance: 34,
    endVariance: 25,
    blur: .35,
    scale: .84,
    scaleRange: 22,
    scaleStep: 7,
    spin: 70,
    spinRange: 110,
    spinStep: 13
  });
  addFlakes("foreground", 8, {
    leftSeed: 13,
    leftStep: 43,
    minSize: 34,
    sizeRange: 18,
    sizeStep: 9,
    minOpacity: 34,
    opacityRange: 15,
    opacityStep: 8,
    minDuration: 115,
    durationRange: 44,
    durationStep: 13,
    delayRange: 170,
    delayStep: 41,
    driftA: 22,
    driftB: -18,
    endX: 30,
    driftVariance: 36,
    endVariance: 28,
    blur: .85,
    scale: .94,
    scaleRange: 18,
    scaleStep: 6,
    spin: 95,
    spinRange: 140,
    spinStep: 17
  });
  return flakes;
}

const snowFlakeLayout = buildSnowFlakeLayout();

const easterPetalLayout = [
  { depth: "depth-far", styles: { "--left": "8%", "--w": "4px", "--h": "7px", "--opacity": ".34", "--scale": ".78", "--duration": "24s", "--delay": "-15s", "--mid-x": "18px", "--late-x": "4px", "--end-x": "26px", "--start-rot": "12deg", "--mid-rot": "88deg", "--late-rot": "170deg", "--end-rot": "252deg" } },
  { depth: "depth-mid", styles: { "--left": "18%", "--w": "5px", "--h": "8px", "--opacity": ".44", "--scale": ".9", "--duration": "19s", "--delay": "-9s", "--mid-x": "-12px", "--late-x": "10px", "--end-x": "-18px", "--start-rot": "-24deg", "--mid-rot": "54deg", "--late-rot": "138deg", "--end-rot": "230deg" } },
  { depth: "depth-near", styles: { "--left": "29%", "--w": "7px", "--h": "11px", "--opacity": ".58", "--scale": "1", "--duration": "16s", "--delay": "-4s", "--mid-x": "22px", "--late-x": "-7px", "--end-x": "34px", "--start-rot": "34deg", "--mid-rot": "116deg", "--late-rot": "204deg", "--end-rot": "306deg" } },
  { depth: "depth-far", styles: { "--left": "38%", "--w": "4px", "--h": "7px", "--opacity": ".3", "--scale": ".72", "--duration": "28s", "--delay": "-21s", "--mid-x": "-8px", "--late-x": "-20px", "--end-x": "-4px", "--start-rot": "6deg", "--mid-rot": "68deg", "--late-rot": "142deg", "--end-rot": "216deg" } },
  { depth: "depth-mid", styles: { "--left": "49%", "--w": "6px", "--h": "9px", "--opacity": ".42", "--scale": ".92", "--duration": "21s", "--delay": "-13s", "--mid-x": "16px", "--late-x": "29px", "--end-x": "10px", "--start-rot": "-18deg", "--mid-rot": "80deg", "--late-rot": "188deg", "--end-rot": "286deg" } },
  { depth: "depth-near", styles: { "--left": "61%", "--w": "8px", "--h": "12px", "--opacity": ".52", "--scale": "1", "--duration": "17s", "--delay": "-7s", "--mid-x": "-18px", "--late-x": "6px", "--end-x": "-28px", "--start-rot": "22deg", "--mid-rot": "112deg", "--late-rot": "194deg", "--end-rot": "300deg" } },
  { depth: "depth-far", styles: { "--left": "72%", "--w": "4px", "--h": "7px", "--opacity": ".32", "--scale": ".78", "--duration": "26s", "--delay": "-18s", "--mid-x": "10px", "--late-x": "-10px", "--end-x": "20px", "--start-rot": "-10deg", "--mid-rot": "62deg", "--late-rot": "136deg", "--end-rot": "218deg" } },
  { depth: "depth-mid", styles: { "--left": "84%", "--w": "5px", "--h": "8px", "--opacity": ".4", "--scale": ".86", "--duration": "20s", "--delay": "-3s", "--mid-x": "-14px", "--late-x": "-2px", "--end-x": "-22px", "--start-rot": "28deg", "--mid-rot": "96deg", "--late-rot": "176deg", "--end-rot": "260deg" } },
  { depth: "depth-near", styles: { "--left": "93%", "--w": "7px", "--h": "11px", "--opacity": ".5", "--scale": ".96", "--duration": "18s", "--delay": "-11s", "--mid-x": "-26px", "--late-x": "-8px", "--end-x": "-36px", "--start-rot": "-30deg", "--mid-rot": "76deg", "--late-rot": "166deg", "--end-rot": "278deg" } },
  { depth: "depth-far", styles: { "--left": "54%", "--w": "4px", "--h": "6px", "--opacity": ".28", "--scale": ".68", "--duration": "30s", "--delay": "-26s", "--mid-x": "6px", "--late-x": "18px", "--end-x": "0px", "--start-rot": "14deg", "--mid-rot": "84deg", "--late-rot": "150deg", "--end-rot": "232deg" } },
  { depth: "depth-mid", styles: { "--left": "12%", "--w": "5px", "--h": "9px", "--opacity": ".38", "--scale": ".84", "--duration": "23s", "--delay": "-1s", "--mid-x": "20px", "--late-x": "-4px", "--end-x": "28px", "--start-rot": "-8deg", "--mid-rot": "70deg", "--late-rot": "162deg", "--end-rot": "244deg" } },
  { depth: "depth-near", styles: { "--left": "77%", "--w": "7px", "--h": "10px", "--opacity": ".48", "--scale": ".94", "--duration": "15s", "--delay": "-5s", "--mid-x": "15px", "--late-x": "-16px", "--end-x": "24px", "--start-rot": "18deg", "--mid-rot": "120deg", "--late-rot": "210deg", "--end-rot": "318deg" } }
];

const halloweenBatLayout = [
  { "--left": "3%", "--top": "31%", "--w": "20px", "--h": "10px", "--opacity": ".5", "--scale": ".88", "--duration": "28s", "--delay": "-18s", "--start-x": "-160px", "--start-y": "2px", "--mid-x": "390px", "--mid-y": "-12px", "--end-x": "760px", "--end-y": "8px", "--start-rot": "-4deg", "--mid-rot": "7deg", "--end-rot": "-6deg" },
  { "--left": "18%", "--top": "24%", "--w": "16px", "--h": "8px", "--opacity": ".38", "--scale": ".72", "--duration": "34s", "--delay": "-7s", "--start-x": "-190px", "--start-y": "10px", "--mid-x": "260px", "--mid-y": "2px", "--end-x": "640px", "--end-y": "-10px", "--start-rot": "6deg", "--mid-rot": "-5deg", "--end-rot": "4deg" },
  { "--left": "45%", "--top": "28%", "--w": "18px", "--h": "9px", "--opacity": ".42", "--scale": ".78", "--duration": "31s", "--delay": "-24s", "--start-x": "-120px", "--start-y": "-4px", "--mid-x": "210px", "--mid-y": "15px", "--end-x": "560px", "--end-y": "0px", "--start-rot": "-8deg", "--mid-rot": "8deg", "--end-rot": "-4deg" },
  { "--left": "70%", "--top": "21%", "--w": "14px", "--h": "7px", "--opacity": ".32", "--scale": ".64", "--duration": "38s", "--delay": "-14s", "--start-x": "-260px", "--start-y": "4px", "--mid-x": "20px", "--mid-y": "-9px", "--end-x": "300px", "--end-y": "5px", "--start-rot": "4deg", "--mid-rot": "-8deg", "--end-rot": "5deg" }
];

const allowedWeatherThemePreviews = new Set(["live", "standard", "clear", "rain", "snow"]);
const allowedSeasonalThemePreviews = new Set(["none", "christmas", "easter", "halloween"]);

function isThemePreviewPageActive() {
  return document.querySelector("#settings")?.classList.contains("active") && activeSettingsPanel === "themes";
}

function selectedWeatherThemePreview() {
  const value = isThemePreviewPageActive() ? weatherThemePreviewValue : "live";
  return allowedWeatherThemePreviews.has(value) ? value : "live";
}

function selectedSeasonalThemePreview() {
  const value = isThemePreviewPageActive() ? seasonalThemePreviewValue : "none";
  return allowedSeasonalThemePreviews.has(value) ? value : "none";
}

function isHeaderPreviewMode() {
  const seasonalPreview = selectedSeasonalThemePreview();
  const weatherPreview = selectedWeatherThemePreview();
  return (seasonalPreview && seasonalPreview !== "none") || (weatherPreview && weatherPreview !== "live");
}

function resolveHeaderTheme(weatherCode = lastWeatherCode) {
  const seasonalPreview = selectedSeasonalThemePreview();
  if (seasonalPreview && seasonalPreview !== "none") return seasonalPreview;
  const weatherPreview = selectedWeatherThemePreview();
  if (weatherPreview && weatherPreview !== "live") return weatherPreview;
  const seasonalTheme = dashboardSeasonalTheme(new Date());
  if (seasonalTheme) return seasonalTheme;
  return dashboardWeatherTheme(weatherCode) || "standard";
}

function headerThemeLabel(value) {
  const labels = {
    live: "Live weather automatic",
    standard: "Standard Kingswood header",
    clear: "Sunny",
    rain: "Rain",
    snow: "Snow",
    none: "None",
    christmas: "Christmas",
    easter: "Easter",
    halloween: "Halloween"
  };
  return labels[value] || value || "None";
}

function updateHeaderPreviewBadge() {
  const badge = document.querySelector("#weatherThemePreviewBadge");
  if (!badge) return;
  const weatherPreview = selectedWeatherThemePreview();
  const seasonalPreview = selectedSeasonalThemePreview();
  const isPreview = isHeaderPreviewMode();
  badge.classList.toggle("hidden", !isPreview);
  if (!isPreview) {
    badge.textContent = "Preview mode";
    return;
  }
  if (seasonalPreview && seasonalPreview !== "none") {
    badge.textContent = `Preview: ${headerThemeLabel(seasonalPreview)}`;
  } else if (weatherPreview && weatherPreview !== "live") {
    badge.textContent = `Preview: ${headerThemeLabel(weatherPreview)}`;
  }
}

function updateHeaderSceneMotionState() {
  document.body.classList.toggle("header-scene-paused", document.hidden);
}

function setWeatherThemePreview(value) {
  weatherThemePreviewValue = allowedWeatherThemePreviews.has(value) ? value : "live";
  applyDashboardHeaderTheme(lastWeatherCode);
  updateThemePreviewControls();
}

function setSeasonalThemePreview(value) {
  seasonalThemePreviewValue = allowedSeasonalThemePreviews.has(value) ? value : "none";
  applyDashboardHeaderTheme(lastWeatherCode);
  updateThemePreviewControls();
}

function resetHeaderThemePreview() {
  weatherThemePreviewValue = "live";
  seasonalThemePreviewValue = "none";
  applyDashboardHeaderTheme(lastWeatherCode);
  updateThemePreviewControls();
}

function clearLegacyHeaderPreviewStorage() {
  try {
    localStorage.removeItem(weatherThemeStorageKey);
    localStorage.removeItem(seasonalThemeStorageKey);
  } catch {
    // Ignore private browsing or restricted storage failures.
  }
}

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromInputValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function defaultChristmasThemeEndDate(year = new Date().getFullYear()) {
  const date = new Date(year, 11, 24);
  date.setDate(date.getDate() - 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }
  return dateInputValue(date);
}

function christmasThemeEndDate(year = new Date().getFullYear()) {
  const stored = localStorage.getItem(christmasThemeEndDateStorageKey);
  const storedDate = dateFromInputValue(stored);
  if (storedDate && storedDate.getFullYear() === year) return stored;
  return defaultChristmasThemeEndDate(year);
}

function setChristmasThemeEndDate(value) {
  const date = dateFromInputValue(value);
  if (date && date.getMonth() === 11) {
    localStorage.setItem(christmasThemeEndDateStorageKey, dateInputValue(date));
  } else {
    localStorage.removeItem(christmasThemeEndDateStorageKey);
  }
  applyDashboardHeaderTheme(lastWeatherCode);
  updateThemePreviewControls();
}

function updateThemePreviewControls() {
  const weatherSelect = document.querySelector("#weatherThemePreviewSelect");
  const seasonalSelect = document.querySelector("#seasonalThemePreviewSelect");
  const christmasEndDateInput = document.querySelector("#christmasThemeEndDateInput");
  const status = document.querySelector("#themePreviewStatus");
  if (weatherSelect) weatherSelect.value = selectedWeatherThemePreview();
  if (seasonalSelect) seasonalSelect.value = selectedSeasonalThemePreview();
  if (christmasEndDateInput) christmasEndDateInput.value = christmasThemeEndDate();
  if (status) {
    const seasonalPreview = selectedSeasonalThemePreview();
    const weatherPreview = selectedWeatherThemePreview();
    const active = seasonalPreview !== "none"
      ? headerThemeLabel(seasonalPreview)
      : headerThemeLabel(weatherPreview);
    status.textContent = `Header preview: ${active}. Real Orpington weather data is still unchanged.`;
  }
}

function dashboardSeasonalTheme(date) {
  const current = dateOnly(date);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const christmasStart = new Date(date.getFullYear(), 11, 1);
  const christmasEnd = dateFromInputValue(christmasThemeEndDate(date.getFullYear()));
  if (christmasEnd && current >= christmasStart && current <= christmasEnd) return "christmas";

  const easter = easterSunday(date.getFullYear());
  const diffDays = Math.round((current - dateOnly(easter)) / 86400000);
  if (diffDays >= -6 && diffDays <= 1) return "easter";

  if (month === 10 && day >= 29 && day <= 31) return "halloween";
  return "";
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function dashboardWeatherTheme(code) {
  const value = Number(code);
  if ([0, 1].includes(value)) return "clear";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(value)) return "snow";
  return "standard";
}

function greetingForNow(name) {
  const hour = new Date().getHours();
  const dayPart = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${dayPart}, ${name}`;
}

function isReviewMode() {
  return reviewMode;
}

function reviewModeUrl(sectionId = "dashboard") {
  const url = new URL(location.href);
  url.searchParams.set(reviewModeParam, "1");
  url.searchParams.set("section", sectionId);
  url.searchParams.set("v", appVersion);
  return url.toString();
}

function applyReviewModeShell() {
  if (!isReviewMode()) return;
  document.body.classList.add("review-mode");
  document.body.classList.remove("locked");
  authScreen?.setAttribute("aria-hidden", "true");
  if (userGreeting) userGreeting.textContent = "Review mode - read only";
  if (signedInUser) signedInUser.textContent = "Review mode";
  if (lockHubButton) {
    lockHubButton.textContent = "Read only";
    lockHubButton.disabled = true;
  }
  if (!document.querySelector("#reviewModeBanner")) {
    const banner = document.createElement("div");
    banner.id = "reviewModeBanner";
    banner.className = "review-mode-banner";
    banner.innerHTML = "<strong>REVIEW MODE</strong><span>Read-only layout inspection. Live data cannot be changed.</span>";
    document.body.prepend(banner);
  }
}

function reviewModeMessage() {
  kcInfo("Review Mode is read only. Create, edit, delete, upload, approve and save actions are disabled.");
}

function reviewModeBlockedAction(target) {
  if (!isReviewMode()) return false;
  const actionSelector = [
    "[data-manage]",
    "[data-edit-record]",
    "[data-delete-record]",
    "[data-training-lifecycle]",
    "[data-approve-holiday]",
    "[data-decline-holiday]",
    "[data-clear-data]",
    "[data-asset-action]",
    "[data-renew-compliance]",
    "[data-replace-training-certificate]",
    "[data-replace-compliance-document]",
    "[data-replace-asset-document]",
    "[data-technician-geofence]",
    "[data-technician-geofence-toggle]",
    "[data-remove-proofing-photo]",
    "[data-remove-fine-evidence]",
    "[data-remove-asset-document]",
    "[data-remove-training-document]",
    "[data-remove-compliance-document]",
    "#syncNowButton",
    "#saveBuiltRamsButton",
    "#aiRamsDraftButton",
    "#saveNativeProofingReport",
    "#parseNativeProofingNotes",
    "#clearNativeProofingReport",
    "#exportTrainingCsvButton",
    "#exportTrainingExcelButton",
    "#exportAssetsCsvButton",
    "#exportAssetsExcelButton",
    "#exportArkCsvButton",
    "#exportJgCsvButton",
    "#exportOtherCsvButton",
    "#generateArkValuationButton",
    "#generateJgValuationButton",
    "#generateOtherValuationButton"
  ].join(",");
  return Boolean(target.closest(actionSelector));
}

function maskReviewModeSensitiveSections() {
  if (!isReviewMode()) return;
  const staffSection = document.querySelector("#staff");
  if (staffSection && !staffSection.dataset.reviewMasked) {
    staffSection.dataset.reviewMasked = "true";
    staffSection.innerHTML = `
      <div class="review-redacted-panel">
        <span class="status warning">REVIEW MODE</span>
        <h2>Staff Management Hidden</h2>
        <p>Employee records, emergency contacts, absence records and personal information are hidden in temporary review mode.</p>
        <p>This page remains available in the live office system after normal PIN sign-in.</p>
      </div>
    `;
  }
  const settingsSection = document.querySelector("#settings");
  if (settingsSection && !settingsSection.dataset.reviewMasked) {
    settingsSection.dataset.reviewMasked = "true";
    settingsSection.innerHTML = `
      <div class="review-redacted-panel">
        <span class="status warning">REVIEW MODE</span>
        <h2>Settings Hidden</h2>
        <p>Storage, reset, configuration and permission controls are hidden during read-only design review.</p>
      </div>
    `;
  }
}

let directorSession = null;
let directorExpiryTimer = null;
let directorAuthGeneration = 0;
let directorLogoutPromise = Promise.resolve();

function clearDirectorSession() {
  directorAuthGeneration += 1;
  directorSession = null;
  window.clearTimeout(directorExpiryTimer);
  directorExpiryTimer = null;
  directorsAreaState = null;
  document.querySelector("#directorsContent")?.replaceChildren();
  showDirectorsLocked("Please sign in with your director PIN.");
  dashboardRevolutLastSuccess = null;
  dashboardRevolutBalanceLoadedAt = 0;
  stopDashboardRevolutAutoRefresh();
  document.querySelector("#dashboardRevolutCard")?.classList.add("hidden");
  setDashboardRevolutText("Unavailable", "", "Last updated: not yet");
}

function acceptDirectorSession(result) {
  directorSession = result;
  window.clearTimeout(directorExpiryTimer);
  directorExpiryTimer = window.setTimeout(() => lockHub(), Math.max(0, Date.parse(result.expiresAt) - Date.now()));
}

function unlockHub(name) {
  if (isReviewMode()) {
    applyReviewModeShell();
    return;
  }
  localStorage.setItem(authStorageKey, name);
  document.body.classList.remove("locked");
  authScreen?.setAttribute("aria-hidden", "true");
  if (userGreeting) userGreeting.textContent = greetingForNow(name);
  if (signedInUser) signedInUser.textContent = name;
  if (pinInput) pinInput.value = "";
  if (loginNameInput) loginNameInput.value = name;
  if (pinMessage) pinMessage.textContent = "";
  syncDirectorsMenuVisibility();
}

function lockHub() {
  if (isReviewMode()) {
    applyReviewModeShell();
    return;
  }
  const csrfToken = directorSession?.csrfToken;
  clearDirectorSession();
  if (csrfToken) {
    directorLogoutPromise = fetch("/api/phase-10/director-logout", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: "{}"
    }).catch(() => {});
  }
  localStorage.removeItem(authStorageKey);
  document.body.classList.add("locked");
  authScreen?.removeAttribute("aria-hidden");
  if (signedInUser) signedInUser.textContent = "Signed out";
  if (userGreeting) userGreeting.textContent = "Locked";
  if (pinInput) {
    pinInput.value = "";
    pinInput.focus();
  }
  if (loginNameInput) {
    loginNameInput.value = "";
    loginNameInput.focus();
  }
  syncDirectorsMenuVisibility();
}

function currentUserName() {
  if (isReviewMode()) return "Review Mode";
  return localStorage.getItem(authStorageKey) || "Kevin";
}

async function initialiseAuth() {
  if (isReviewMode()) {
    applyReviewModeShell();
    return;
  }
  const rememberedUser = localStorage.getItem(authStorageKey);
  if (rememberedUser && isDirectorLocalUser(rememberedUser)) {
    try {
      const result = await directorsApi("/director-session");
      acceptDirectorSession(result);
      unlockHub(result.director.displayName);
      if (document.body.dataset.activeSection === "directors") await refreshDirectorsArea();
      if (document.body.dataset.activeSection === "dashboard") startDashboardRevolutAutoRefresh({ immediate: true });
    } catch {
      lockHub();
    }
  } else if (rememberedUser) {
    unlockHub(rememberedUser);
  } else {
    lockHub();
  }
}

function badgeClass(attention) {
  return attention ? "card-badge attention" : "card-badge";
}

function enhanceDashboardCards() {
  document.querySelectorAll(".metric").forEach((metric) => {
    if (metric.querySelector(".metric-heading")) return;
    const value = metric.querySelector("strong");
    const title = metric.querySelector(".dashboard-kpi-title")?.textContent.trim()
      || metric.querySelector("span:not(.dashboard-card-icon)")?.textContent.trim()
      || metric.querySelector("span")?.textContent.trim()
      || "Metric";
    const icon = metric.querySelector(".dashboard-card-icon")?.textContent.trim() || "";
    const action = metric.querySelector("small")?.textContent.trim() || "";
    const meta = dashboardCardMeta[value.id] || ["dashboard", "Live dashboard count", "items"];
    metric.dataset.countId = value.id;
    if (metric.classList.contains("dashboard-kpi-card")) {
      metric.innerHTML = `
        <div class="metric-heading kw-card-header">
          <span class="metric-title kw-label">${icon ? `<span class="dashboard-card-icon">${escapeHtml(icon)}</span>` : ""}${escapeHtml(title)}</span>
        </div>
        <strong class="metric-value kw-metric" id="${value.id}">${escapeHtml(value.textContent)}</strong>
        ${action ? `<small>${escapeHtml(action)}</small>` : ""}
      `;
    } else {
      metric.innerHTML = `
        <div class="metric-heading kw-card-header">
          <span class="metric-title kw-label">${icon ? `<span class="dashboard-card-icon">${escapeHtml(icon)}</span>` : ""}${escapeHtml(title)}</span>
          <span class="metric-inline kw-sub-label"><i aria-hidden="true"></i><span id="${value.id}Badge">0 ${meta[2]}</span></span>
        </div>
        <p class="metric-subtitle kw-card-hint">${escapeHtml(meta[1])}</p>
        <strong class="metric-value kw-metric" id="${value.id}">${escapeHtml(value.textContent)}</strong>
        ${action ? `<small>${escapeHtml(action)}</small>` : ""}
      `;
    }
  });
}

function updateDashboardBadges() {
  Object.entries(dashboardCardMeta).forEach(([id, meta]) => {
    const value = Number(document.querySelector(`#${id}`)?.textContent || 0);
    const badge = document.querySelector(`#${id}Badge`);
    const card = document.querySelector(`[data-count-id="${id}"]`);
    if (!badge || !card) return;
    const inline = badge.closest(".metric-inline");
    badge.textContent = `${value} ${meta[2]}`;
    inline?.classList.toggle("attention", value > 0 && (card.classList.contains("warning") || card.classList.contains("urgent") || card.classList.contains("overdue")));
  });
}

function technicianJob(job) {
  const attendance = attendanceFor(job.technician, job.date);
  const restriction = activeSicknessRestrictionFor(job.technician, job.date);
  return {
    date: job.date,
    jobNumber: job.number,
    title: job.title,
    client: job.client,
    mainClient: job.mainClient || job.client || "",
    address: job.address,
    postcode: job.postcode || "",
    technician: job.technician,
    jobSlot: job.slot || "",
    residentPhone: job.residentPhone || "",
    jobDetails: job.jobDetails || "",
    reportNotes: job.reportNotes || "",
    screenshots: job.photos || "",
    status: job.status,
    report: job.report,
    navigationSearch: job.address,
    availabilityWarning: isUnavailableStatus(attendance.status)
      ? `${job.technician} is marked as ${attendance.status}`
      : restriction?.type === "food-premises" && jobIsFoodPremises(job)
        ? restriction.message
        : restriction?.type === "rpe-warning" && jobRequiresRpe(job)
          ? restriction.message
          : "",
    rams: ramsItems
      .filter((item) => item.job.includes(job.number) || item.job.includes(job.title) || item.client === job.client)
      .map((item) => ({
        title: item.title,
        client: item.client,
        status: item.status,
        sentDate: item.sentDate,
        notes: item.notes
      }))
  };
}

function buildTechnicianFeed() {
  const currentYear = String(new Date().getFullYear());
  const sentJobs = jobs.filter((job) => job.status === "Sent to Tech");
  const individualTechnicianApps = staffProfiles.map((staff) => {
    const summary = staffLeaveSummary(staff, currentYear);
    const staffHolidayRequests = holidayRequests
      .filter((request) => request.staffId === staff.staffId || request.name === staff.name)
      .map((request) => ({
        id: request.id || "",
        from: request.from || "",
        to: request.to || "",
        days: request.days || 0,
        status: request.status || "Pending",
        notes: request.notes || "",
        submittedDate: request.submittedDate || "",
        approvedDate: request.approvedDate || "",
        declinedDate: request.declinedDate || "",
        declineReason: request.declineReason || ""
      }));
    return {
      staffId: staff.staffId,
      name: staff.name,
      activeStatus: publicStaffStatus(staff.name, today),
      holidayAllowance: `${summary.holidayAllowance} days entitlement`,
      personalHolidaysApprovedAndTaken: `${summary.holidayTaken} days approved/taken`,
      companyBankHolidayDeductions: `${summary.companyBankDeductions} company/bank holiday days deducted`,
      remainingHolidayBalance: `${summary.holidayRemaining} days remaining`,
      totalSickDaysRegistered: `${summary.sickDays} sick days registered in ${currentYear}`,
      holidayRequests: staffHolidayRequests
    };
  });
  return {
    app: "Kingswood Technician App",
    source: "Kingswood Command Centre",
    publishedAt: new Date().toISOString(),
    jobs: sentJobs.map(technicianJob),
    individualTechnicianApps,
    staffAvailability: staffProfiles.map((staff) => {
      const attendance = attendanceFor(staff.name, today);
      const restriction = activeSicknessRestrictionFor(staff.name, today);
      const summary = staffLeaveSummary(staff, currentYear);
      return {
        name: staff.name,
        staffId: staff.staffId,
        role: staff.role,
        phone: staff.phone,
        assignedVan: staff.assignedVan,
        todayStatus: attendance.status,
        availableToday: !isUnavailableStatus(attendance.status),
        activeStatus: publicStaffStatus(staff.name, today),
        activeRestriction: restriction ? {
          type: restriction.type,
          label: restriction.label,
          message: restriction.message
        } : null,
        leaveSummary: {
          year: summary.year,
          holidayAllowance: summary.holidayAllowance,
          holidayTaken: summary.holidayTaken,
          holidayRemaining: summary.holidayRemaining,
          sickDays: summary.sickDays,
          companyHolidayDays: summary.companyBankDeductions
        }
      };
    }),
    vehicles: vehicles.map((vehicle) => ({
      registration: vehicle.registration,
      vehicle: vehicle.vehicle,
      driver: vehicle.driver,
      tracker: vehicle.tracker
    })),
    documents: companyDocuments.map(asCardObject),
    alerts: [
      ...ramsItems.filter((item) => item.status !== "sent").map((item) => `RAMS to send: ${item.title} for ${item.client}`),
      ...sentJobs.filter((job) => job.status === "Urgent").map((job) => `Urgent job: ${job.number} - ${job.title}`)
    ]
  };
}

function buildAdminFeed() {
  const compliance = complianceRecords().map((item) => ({ ...item, status: complianceStatus(item) }));
  return {
    app: "Kingswood Admin App",
    source: "Kingswood Command Centre",
    publishedAt: new Date().toISOString(),
    dashboard: {
      jobsToday: jobs.filter((job) => job.date === today).length,
      jobsTomorrow: jobs.filter((job) => job.date === tomorrow).length,
      urgentJobs: jobs.filter((job) => job.status === "Urgent").length,
      reportsAwaiting: jobs.filter((job) => job.report === "Awaiting").length,
      ramsToSend: ramsItems.filter((item) => item.status !== "sent").length,
      complianceDue: compliance.filter((item) => item.status.className === "amber").length,
      complianceOverdue: compliance.filter((item) => item.status.className === "red").length,
      vehicleAlerts: vehicles.filter((vehicle) => vehicle.tracker !== "Active" || isReminderDate(vehicle.mot) || isReminderDate(vehicle.insurance)).length,
      openFines: fines.filter(isFineOpen).length
    },
    jobs,
    ramsItems,
    compliance,
    vehicles,
    staffProfiles,
    attendanceRecords,
    holidayRequests,
    staffNotifications,
    companyHolidays,
    fines,
    clients: clients.map(asCardObject),
    assets: assets.map(asAssetObject),
    companyDocuments: companyDocuments.map(asCardObject)
  };
}

function buildConnectV12Feed() {
  const sentJobs = jobs.filter((job) => job.status === "Sent to Tech");
  const clientNames = [...new Set([
    ...clients.map((client) => asCardObject(client).title),
    ...jobs.map((job) => job.client)
  ].filter(Boolean))];
  const jobTitles = [...new Set(jobs.map((job) => job.title).filter(Boolean))];
  const techniciansByName = Object.fromEntries(technicians.map((tech) => [tech.name, tech]));

  return {
    app: "Kingswood Connect",
    version: "1.2",
    source: "Kingswood Command Centre",
    publishedAt: new Date().toISOString(),
    refreshKey: "v12",
    adminUrl: "http://localhost:8001/?view=admin&refresh=v12",
    techUrl: "http://localhost:8001/?view=tech&refresh=v12",
    dropdowns: {
      clients: clientNames,
      jobTitles,
      technicians: technicians.map((tech) => tech.name),
      jobSlots: ["AM", "PM", "All day", "Urgent"],
      rams: ramsItems.map((item) => item.title)
    },
    admin: {
      jobs: jobs.map((job) => ({
        id: job.number,
        jobNumber: job.number,
        jobDate: job.date,
        jobSlot: job.slot || "",
        client: job.client,
        mainClient: job.mainClient || job.client || "",
        jobTitle: job.title,
        address: job.address,
        postcode: job.postcode || "",
        technician: job.technician,
        status: job.status,
        reportStatus: job.report,
        ramsStatus: ramsItems.some((item) => item.status === "sent" && (item.job.includes(job.number) || item.client === job.client)) ? "sent" : ramsItems.some((item) => item.job.includes(job.number) || item.client === job.client) ? "attached" : "needed",
        screenshots: job.photos || "",
        residentPhone: job.residentPhone || "",
        jobDetails: job.jobDetails || ""
      })),
      clients: clientNames,
      ramsItems,
      compliance: complianceRecords().map((item) => ({ ...item, status: complianceStatus(item) }))
    },
    tech: {
      jobs: sentJobs.map((job) => {
        const tech = techniciansByName[job.technician] || {};
        const assignedRams = ramsItems.filter((item) => item.job.includes(job.number) || item.job.includes(job.title) || item.client === job.client);
        return {
          id: job.number,
          jobNumber: job.number,
          jobDate: job.date,
          jobSlot: job.slot || "",
          client: job.client,
          mainClient: job.mainClient || job.client || "",
          jobTitle: job.title,
          address: job.address,
          postcode: job.postcode || "",
          technician: job.technician,
          technicianPhone: tech.phone || "",
          van: tech.van || "",
          navigationSearch: job.address,
          residentPhone: job.residentPhone || "",
          jobDetails: job.jobDetails || "",
          reportNotes: job.reportNotes || "",
          screenshots: job.photos || "",
          ramsStatus: assignedRams.some((item) => item.status === "sent") ? "sent" : assignedRams.length ? "attached" : "needed",
          rams: assignedRams,
          reportStatus: job.report,
          status: job.status
        };
      })
    }
  };
}

function integrationSummary(feed) {
  if (!feed) {
    return "Not published";
  }

  const date = new Date(feed.publishedAt || integrationFeeds.lastPublished);
  return Number.isNaN(date.getTime()) ? "Published" : `Published ${date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`;
}

function renderIntegrationFeeds() {
  if (!document.querySelector("#technicianFeedIcon")) return;
  document.querySelector("#technicianFeedIcon").innerHTML = iconSvg("user-check");
  document.querySelector("#adminFeedIcon").innerHTML = iconSvg("dashboard");

  const technicianFeed = integrationFeeds.technicianApp;
  const adminFeed = integrationFeeds.adminApp;
  const techBadge = document.querySelector("#technicianFeedBadge");
  const adminBadge = document.querySelector("#adminFeedBadge");

  techBadge.textContent = integrationSummary(technicianFeed);
  techBadge.className = badgeClass(Boolean(technicianFeed));
  adminBadge.textContent = integrationSummary(adminFeed);
  adminBadge.className = badgeClass(Boolean(adminFeed));

  document.querySelector("#technicianFeedList").innerHTML = `
    <span><strong>${jobs.length}</strong> jobs available to technicians</span>
    <span><strong>${ramsItems.length}</strong> RAMS records attached/available</span>
    <span><strong>${companyDocuments.length}</strong> company document records</span>
  `;

  document.querySelector("#adminFeedList").innerHTML = `
    <span><strong>${jobs.length}</strong> jobs in diary</span>
    <span><strong>${complianceRecords().length}</strong> compliance records</span>
    <span><strong>${vehicles.length}</strong> vehicles and ${staffProfiles.length} staff</span>
  `;
}

function renderConnectedApps() {
  if (!document.querySelector("#connectedTechIcon")) return;
  document.querySelector("#connectedTechIcon").innerHTML = iconSvg("user-check");
  document.querySelector("#connectedAdminIcon").innerHTML = iconSvg("dashboard");

  const technicianFeed = integrationFeeds.technicianApp || buildTechnicianFeed();
  const adminFeed = integrationFeeds.adminApp || buildAdminFeed();
  const connectFeed = integrationFeeds.connectV12 || buildConnectV12Feed();
  const techBadge = document.querySelector("#connectedTechBadge");
  const adminBadge = document.querySelector("#connectedAdminBadge");

  techBadge.textContent = `${technicianFeed.jobs.length} jobs`;
  techBadge.className = badgeClass(technicianFeed.alerts.length > 0);
  adminBadge.textContent = `${connectFeed.admin.jobs.length} v1.2 jobs`;
  adminBadge.className = badgeClass(adminFeed.dashboard.complianceDue > 0 || adminFeed.dashboard.complianceOverdue > 0 || adminFeed.dashboard.openFines > 0);

  document.querySelector("#connectedTechPreview").innerHTML = technicianFeed.jobs.slice(0, 5).map((job) => (
    listRow(job.jobNumber, `${job.date} | ${job.technician} | ${job.address}`, job.availabilityWarning || job.status)
  )).join("") || '<p class="empty-state">No technician jobs ready yet.</p>';

  document.querySelector("#connectedAdminPreview").innerHTML = [
    listRow("Jobs today", `${adminFeed.dashboard.jobsToday} booked today, ${adminFeed.dashboard.jobsTomorrow} tomorrow`, "Diary"),
    listRow("Compliance", `${adminFeed.dashboard.complianceDue} due soon, ${adminFeed.dashboard.complianceOverdue} overdue`, adminFeed.dashboard.complianceOverdue ? "Red" : adminFeed.dashboard.complianceDue ? "Amber" : "OK"),
    listRow("Vehicles", `${vehicles.length} vehicles, ${adminFeed.dashboard.vehicleAlerts} alerts`, adminFeed.dashboard.vehicleAlerts ? "Pending" : "OK"),
    listRow("Fines and charges", `${adminFeed.dashboard.openFines} open charges`, adminFeed.dashboard.openFines ? "Pending" : "OK")
  ].join("");
}

async function publishIntegrationFeeds() {
  integrationFeeds = {
    technicianApp: buildTechnicianFeed(),
    adminApp: buildAdminFeed(),
    connectV12: buildConnectV12Feed(),
    lastPublished: new Date().toISOString()
  };

  if (integrationStatus) integrationStatus.textContent = "Publishing shared feeds to OneDrive data...";
  const saved = await saveCommandData();

  try {
    const response = await fetch("/api/publish-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(integrationFeeds, null, 2)
    });
    if (integrationStatus) {
      integrationStatus.textContent = response.ok
        ? "Published shared Technician and Admin feeds into the OneDrive data folder."
        : "Saved inside the main Hub data file. Separate feed files will publish when opened with the launcher.";
    }
  } catch {
    if (integrationStatus) integrationStatus.textContent = "Saved inside the main Hub data file. Separate feed files will publish when opened with the launcher.";
  }

  renderIntegrationFeeds();
  renderConnectedApps();
  return saved;
}

function buildStaffRecordsPayload() {
  ensureStaffRecordIds();
  const currentYear = String(new Date().getFullYear());
  return {
    source: "Kingswood Connect Command Centre",
    generatedAt: new Date().toISOString(),
    currentYear,
    staffProfiles,
    holidayRequests,
    approvedHolidays: holidayRequests.filter((request) => request.status === "Approved"),
    sicknessAbsence: attendanceRecords.filter((record) => isSickCallStatus(record.status) || ["Sick", "Absent", "Absent - Called in Sick"].includes(record.status)),
    attendanceRecords,
    staffNotifications,
    trainingRecords: trainingMatrix,
    companyHolidays
  };
}

function updateStaffOneDriveStatus(message = "") {
  const lastSaved = localStorage.getItem(staffLastSavedStorageKey) || "";
  const pending = localStorage.getItem(staffPendingStorageKey);
  const text = message || (pending
    ? "Staff records not safely saved to OneDrive yet"
    : lastSaved
      ? `Last saved to OneDrive: ${new Date(lastSaved).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
      : "Staff records waiting for first OneDrive save");
  if (staffOneDriveStatus) staffOneDriveStatus.textContent = text;
}

async function warnStaffOneDriveSaveFailed() {
  updateStaffOneDriveStatus("Staff records not safely saved to OneDrive yet");
  await kcInfo("Staff Management data has not been safely saved to OneDrive yet. A local backup has been kept in this browser. Please start Kingswood Hub with the launcher and check OneDrive sync before relying on this as the live office record.");
}

async function syncStaffRecordsFolder({ warnOnFailure = false } = {}) {
  const payload = buildStaffRecordsPayload();
  localStorage.setItem(staffPendingStorageKey, JSON.stringify(payload));
  updateStaffOneDriveStatus("Saving staff records to OneDrive...");
  try {
    const response = await fetch("/api/staff-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload, null, 2)
    });
    if (!response.ok) throw new Error("Staff records endpoint failed");
    const savedAt = new Date().toISOString();
    localStorage.removeItem(staffPendingStorageKey);
    localStorage.setItem(staffLastSavedStorageKey, savedAt);
    updateStaffOneDriveStatus();
    return true;
  } catch (error) {
    if (warnOnFailure) await warnStaffOneDriveSaveFailed();
    else updateStaffOneDriveStatus();
    return false;
  }
}

function blankIntegrationFeeds() {
  integrationFeeds = {
    technicianApp: null,
    adminApp: null,
    connectV12: null,
    lastPublished: ""
  };
}

function clearDataCollection(collection) {
  const clearers = {
    jobs: () => {
      jobs = [];
      attendanceRecords = [];
      holidayRequests = [];
    },
    vehicles: () => {
      vehicles = [];
    },
    staff: () => {
      staffProfiles = [];
      technicians = [];
      attendanceRecords = [];
      holidayRequests = [];
      companyHolidays = [];
      trainingMatrix = [];
    },
    training: () => {
      trainingMatrix = [];
    },
    valuations: () => {
      valuations = [];
    },
    planner: () => {
      weeklyPlanner = [];
    },
    rams: () => {
      ramsItems = [];
    },
    all: () => {
      ramsItems = [];
      jobs = [];
      vehicles = [];
      technicians = [];
      staffProfiles = [];
      attendanceRecords = [];
      holidayRequests = [];
      trainingMatrix = [];
      companyDocuments = [];
      assets = [];
      complianceItems = [];
      fines = [];
      valuations = [];
      weeklyPlanner = [];
      emailTemplates = [];
      reportTemplates = [];
      ramsTemplates = [];
      clients = [];
    }
  };

  clearers[collection]?.();
  blankIntegrationFeeds();
}

async function clearStarterData(collection) {
  const labels = {
    jobs: "sample jobs, attendance and holiday records",
    vehicles: "sample vehicles",
    staff: "sample staff, technicians, attendance and holidays",
    training: "sample training records",
    valuations: "imported valuation records",
    planner: "imported weekly planner records",
    rams: "sample RAMS",
    all: "all starter data"
  };

  const confirmed = await kcConfirmAction(`Clear ${labels[collection]}? This cannot be undone from inside the Hub.`, "Continue", true);
  if (!confirmed) {
    return;
  }

  clearDataCollection(collection);
  resetStatus.textContent = `Cleared ${labels[collection]}. Saving to OneDrive...`;
  render();
  await saveCommandData();
  resetStatus.textContent = `Cleared ${labels[collection]}. You can start entering real data now.`;
}

function fieldValue(item, key) {
  return item?.[key] ?? "";
}

function staffSlug(value) {
  return String(value || "staff")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36) || "staff";
}

function stablePhase9Hash(parts) {
  const source = parts
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== "")
    .map((part) => String(part).trim().toLowerCase())
    .join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

function generateTrainingRecordId(record = {}) {
  return `DOC-TRN-${stablePhase9Hash([
    "staff-training",
    record.staffId || record.employee,
    record.course || record.training || record.name,
    record.provider,
    record.completedDate,
    record.expiryDate || (record.noExpiry ? "no-expiry" : ""),
    record.certificateNumber || record.licenceNumber
  ])}`;
}

function trainingActionId(record = {}) {
  return `ACT-TRN-${stablePhase9Hash([
    "staff-training-action",
    record.trainingRecordId || record.id,
    record.staffId || record.employee,
    record.course
  ])}`;
}

function syncTrainingExpiryActions() {
  const now = new Date().toISOString();
  trainingMatrix.forEach((record) => {
    const status = trainingStatus(record);
    const actionId = trainingActionId(record);
    const existing = actionItems.find((item) => item.actionId === actionId);
    const needsAction = ["Expired", "Expiring Soon", "Missing / Not Recorded"].includes(status.label);
    if (!needsAction) {
      if (existing && !["Closed", "Completed", "Resolved"].includes(existing.status)) {
        existing.status = "Closed";
        existing.completedAt = now;
        existing.auditTrail = [...(existing.auditTrail || []), { action: "Closed by training status", at: now, status: status.label }];
      }
      return;
    }
    if (existing) return;
    actionItems.push({
      actionId,
      type: "Compliance Expiry",
      priority: status.label === "Expired" ? "High" : "Medium",
      title: `${record.course || "Training"} ${status.label}`,
      description: `${record.employee || "Staff member"} training record requires office review.`,
      staffId: record.staffId || "",
      assignedStaffId: record.staffId || "",
      relatedEntityType: "TrainingRecord",
      relatedEntityId: record.trainingRecordId || record.id || "",
      status: "New",
      raisedAt: now,
      dueDate: record.expiryDate || "",
      auditTrail: [{ action: "Created from training status", at: now, status: status.label }]
    });
  });
}

function ensureStaffRecordIds() {
  const used = new Set();
  staffProfiles = staffProfiles.map((staff, index) => {
    let staffId = staff.staffId || `KW-${staffSlug(staff.name)}-${String(index + 1).padStart(3, "0")}`;
    while (used.has(staffId)) staffId = `${staffId}-${index + 1}`;
    used.add(staffId);
    return { ...staff, staffId };
  });
  const idByName = new Map(staffProfiles.map((staff) => [staff.name, staff.staffId]));
  holidayRequests = holidayRequests.map((request) => ({
    ...request,
    staffId: request.staffId || idByName.get(request.name) || "",
    year: request.year || String(new Date(request.from || today).getFullYear()),
    submittedDate: request.submittedDate || today,
    status: request.status || "Pending"
  }));
  attendanceRecords = attendanceRecords.map((record) => ({
    ...record,
    attendanceRecordId: record.attendanceRecordId || record.id || generateAttendanceRecordId({ staffId: idByName.get(record.name), name: record.name }, record.date || record.startDate || today),
    type: record.type || record.attendanceType || record.status || "Present",
    staffId: record.staffId || idByName.get(record.name) || "",
    year: record.year || String(new Date(record.startDate || record.date || today).getFullYear())
  }));
  trainingMatrix = trainingMatrix.map((record) => {
    const linkedStaff = staffProfiles.find((staff) => staff.staffId === record.staffId)
      || staffProfiles.find((staff) => staff.name === record.employee);
    const normalisedRecord = {
      ...record,
      staffId: record.staffId || linkedStaff?.staffId || "",
      employee: record.employee || linkedStaff?.name || ""
    };
    const id = record.id || record.trainingRecordId || generateTrainingRecordId(normalisedRecord);
    return {
      ...record,
      id,
      trainingRecordId: id,
      staffId: normalisedRecord.staffId || idByName.get(record.employee) || "",
      employee: normalisedRecord.employee || staffProfiles.find((staff) => staff.staffId === record.staffId)?.name || "",
      course: record.course || record.training || record.name || "",
      provider: record.provider || "",
      certificateNumber: record.certificateNumber || record.licenceNumber || "",
      noExpiry: Boolean(record.noExpiry || record.expiryDate === "No Expiry"),
      certificate: record.certificate || record.documentFileName || "",
      documentFileName: record.documentFileName || record.certificate || "",
      oneDriveLocation: record.oneDriveLocation || record.documentLocation || "",
      lifecycleStatus: record.lifecycleStatus || record.recordStatus || "",
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
      year: record.year || String(new Date(record.completedDate || record.expiryDate || today).getFullYear())
    };
  });
}

let ramsItems = loadRams();
let activeBuiltRamsId = "";
let proofingReports = [];
let proofingPhotos = { before: [], after: [] };
let phase05eCompletedReports = [];
let phase05eReportRefreshTimer = null;
let jobDispatchSchedules = [];
let vehicleInspectionRecords = [];
let actionItems = [];
const historyPageSizeStorageKey = "kingswoodJobHistoryPageSize";
let historyCurrentPage = 1;
let historySearchDebounceTimer = null;
let historyExcludedUnusableCount = 0;

function commandData() {
  ensureStaffRecordIds();
  normalisePlannerItems();
  syncStaffTrainingFromMatrix();
  syncTrainingExpiryActions();
  syncTechniciansFromStaff();
  syncValuationsFromJobs();
  normaliseTscCommunicationTypes();
  return {
    ramsItems,
    proofingReports,
    jobs,
    vehicles,
    technicians,
    staffProfiles,
    attendanceRecords,
    holidayRequests,
    tscMasterContent,
    tscPublishedRevisions,
    tscIssueRecords,
    tscAssignmentRecords,
    tscEvidenceRecords,
    universalAuditEvents,
    companyHolidays,
    trainingMatrix,
    weeklyPlanner,
    jobDispatchSchedules,
    vehicleInspectionRecords,
    actionItems,
    emailTemplates,
    reportTemplates,
    ramsTemplates,
    companyBranding,
    companyDocuments,
    assets,
    complianceItems,
    fines,
    valuations,
    clients,
    integrationFeeds,
    leaveAllowanceResetYear,
    savedAt: new Date().toISOString()
  };
}

const hostedCommandDataArrayKeys = [
  "ramsItems",
  "proofingReports",
  "jobs",
  "vehicles",
  "technicians",
  "staffProfiles",
  "attendanceRecords",
  "holidayRequests",
  "staffNotifications",
  "tscMasterContent",
  "tscPublishedRevisions",
  "tscIssueRecords",
  "tscAssignmentRecords",
  "tscEvidenceRecords",
  "universalAuditEvents",
  "companyHolidays",
  "trainingMatrix",
  "weeklyPlanner",
  "jobDispatchSchedules",
  "vehicleInspectionRecords",
  "actionItems",
  "emailTemplates",
  "reportTemplates",
  "ramsTemplates",
  "companyDocuments",
  "assets",
  "complianceItems",
  "fines",
  "valuations",
  "clients"
];

function completeHostedCommandData(data = {}) {
  return hostedCommandDataArrayKeys.reduce((complete, key) => {
    if (!Array.isArray(complete[key])) complete[key] = [];
    return complete;
  }, { ...data });
}

function applyCommandData(data) {
  if (Array.isArray(data.ramsItems)) ramsItems = data.ramsItems;
  if (Array.isArray(data.proofingReports)) proofingReports = data.proofingReports;
  if (Array.isArray(data.jobs)) jobs = data.jobs;
  if (Array.isArray(data.vehicles)) vehicles = data.vehicles;
  if (Array.isArray(data.technicians)) technicians = data.technicians;
  if (Array.isArray(data.staffProfiles)) staffProfiles = data.staffProfiles;
  if (Array.isArray(data.attendanceRecords)) attendanceRecords = data.attendanceRecords;
  if (Array.isArray(data.holidayRequests)) holidayRequests = data.holidayRequests;
  if (Array.isArray(data.staffNotifications)) staffNotifications = data.staffNotifications;
  if (Array.isArray(data.tscMasterContent)) tscMasterContent = data.tscMasterContent;
  if (Array.isArray(data.tscPublishedRevisions)) tscPublishedRevisions = data.tscPublishedRevisions;
  if (Array.isArray(data.tscIssueRecords)) tscIssueRecords = data.tscIssueRecords;
  if (Array.isArray(data.tscAssignmentRecords)) tscAssignmentRecords = data.tscAssignmentRecords;
  if (Array.isArray(data.tscEvidenceRecords)) tscEvidenceRecords = data.tscEvidenceRecords;
  if (Array.isArray(data.universalAuditEvents)) universalAuditEvents = data.universalAuditEvents;
  if (Array.isArray(data.companyHolidays)) companyHolidays = data.companyHolidays;
  if (Array.isArray(data.trainingMatrix)) trainingMatrix = data.trainingMatrix;
  if (Array.isArray(data.weeklyPlanner)) weeklyPlanner = data.weeklyPlanner;
  if (Array.isArray(data.jobDispatchSchedules)) jobDispatchSchedules = data.jobDispatchSchedules;
  if (Array.isArray(data.vehicleInspectionRecords)) vehicleInspectionRecords = data.vehicleInspectionRecords;
  if (Array.isArray(data.actionItems)) actionItems = data.actionItems;
  if (Array.isArray(data.emailTemplates)) emailTemplates = data.emailTemplates;
  if (Array.isArray(data.reportTemplates)) reportTemplates = data.reportTemplates;
  if (Array.isArray(data.ramsTemplates)) ramsTemplates = data.ramsTemplates;
  if (data.companyBranding && typeof data.companyBranding === "object") companyBranding = data.companyBranding;
  if (Array.isArray(data.companyDocuments)) companyDocuments = data.companyDocuments;
  if (Array.isArray(data.assets)) assets = data.assets;
  if (Array.isArray(data.complianceItems)) complianceItems = data.complianceItems;
  if (Array.isArray(data.fines)) fines = data.fines;
  if (Array.isArray(data.valuations)) valuations = data.valuations;
  if (Array.isArray(data.clients)) clients = data.clients;
  if (data.integrationFeeds && typeof data.integrationFeeds === "object") integrationFeeds = data.integrationFeeds;
  if (data.leaveAllowanceResetYear) leaveAllowanceResetYear = String(data.leaveAllowanceResetYear);
  ensureStaffRecordIds();
  normaliseTscCommunicationTypes();
}

function enforceAnnualLeaveRenewal() {
  const currentYear = String(new Date().getFullYear());
  if (leaveAllowanceResetYear === currentYear) return false;
  staffProfiles = staffProfiles.map((staff) => ({
    ...staff,
    holidayAllowance: 28,
    holidayAllowanceYear: currentYear
  }));
  leaveAllowanceResetYear = currentYear;
  return true;
}

function hubApiUrls(path) {
  if (location.protocol !== "file:") {
    return [path];
  }
  return [
    `http://127.0.0.1:8126${path}`,
    `http://127.0.0.1:8123${path}`,
    `http://127.0.0.1:8125${path}`
  ];
}

async function fetchFirstHubApi(path, options = {}) {
  for (const url of hubApiUrls(path)) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
    } catch {
      // Try the next local Hub server port.
    }
  }
  return null;
}

function commandCentreApiOptions(options = {}) {
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      "X-Kingswood-User": currentUserName()
    }
  };
}

async function loadPhase05eCompletedReports() {
  const response = await fetchFirstHubApi("/api/phase-05e/hub-report-status", { cache: "no-store" });
  if (!response) {
    phase05eCompletedReports = [];
    return;
  }

  try {
    const data = await response.json();
    phase05eCompletedReports = Array.isArray(data.completedReports) ? data.completedReports : [];
  } catch {
    phase05eCompletedReports = [];
  }
}

function phase05eReportKey() {
  return JSON.stringify(phase05eCompletedReports.map((report) => ({
    reportId: report.reportId,
    jobId: report.jobId,
    status: report.status,
    oneDriveFolder: report.oneDriveFolder
  })));
}

function startPhase05eReportRefresh() {
  if (phase05eReportRefreshTimer) return;
  phase05eReportRefreshTimer = setInterval(async () => {
    if (document.hidden) return;
    const before = phase05eReportKey();
    await loadPhase05eCompletedReports();
    if (phase05eReportKey() !== before) {
      render();
    }
  }, 30000);
}

function redirectFileViewToHub(apiUrl) {
  if (location.protocol !== "file:" || !apiUrl) return false;
  const hubUrl = new URL(apiUrl);
  const target = new URL("/index.html", hubUrl.origin);
  target.search = location.search;
  target.hash = location.hash;
  location.replace(target.toString());
  return true;
}

async function loadCommandData() {
  clearLegacyHeaderPreviewStorage();
  let leaveResetChanged = false;
  startOneDriveAutoSync();
  startPhase05eReportRefresh();
  updateOneDriveHeaderStatus("OneDrive unavailable", "Checking OneDrive storage");
  if (location.protocol === "file:") {
    try {
      const serverResponse = await fetchFirstHubApi("/api/data", commandCentreApiOptions({ cache: "no-store" }));
      if (redirectFileViewToHub(serverResponse?.url)) return;
      const response = serverResponse || await fetch("data/command-centre-data.json", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        if (Object.keys(data).length > 0) {
          applyCommandData(serverResponse ? completeHostedCommandData(data) : data);
          leaveResetChanged = enforceAnnualLeaveRenewal();
          oneDriveLiveDataLoaded = Boolean(serverResponse);
          updateOneDriveHeaderStatus(
            serverResponse ? "Live OneDrive data loaded" : "OneDrive unavailable",
            serverResponse ? "" : "Loaded local file only"
          );
          if (leaveResetChanged) {
            await saveCommandData();
          }
        } else {
          oneDriveLiveDataLoaded = false;
          updateOneDriveHeaderStatus("OneDrive unavailable", "Start Kingswood Hub to save to OneDrive");
          enforceAnnualLeaveRenewal();
        }
      } else {
        oneDriveLiveDataLoaded = false;
        updateOneDriveHeaderStatus("OneDrive unavailable", "Start Kingswood Hub to save to OneDrive");
      }
    } catch {
      oneDriveLiveDataLoaded = false;
      updateOneDriveHeaderStatus("OneDrive unavailable", "Start Kingswood Hub to save to OneDrive");
    }
    await loadPhase05eCompletedReports();
    render();
    applyInitialSectionFromUrl();
    return;
  }

  try {
    const response = await fetch("/api/data", commandCentreApiOptions({ cache: "no-store" }));
    const data = await response.json();

    if (Object.keys(data).length > 0) {
      applyCommandData(completeHostedCommandData(data));
      leaveResetChanged = enforceAnnualLeaveRenewal();
      const valuationSyncChanged = syncValuationsFromJobs();
      oneDriveLiveDataLoaded = true;
      updateOneDriveHeaderStatus(oneDrivePendingBackup() ? "Local backup pending" : "Live OneDrive data loaded");
      if (valuationSyncChanged || leaveResetChanged) {
        await saveCommandData();
      }
    } else {
      oneDriveLiveDataLoaded = true;
      updateOneDriveHeaderStatus("Saving to OneDrive", "Creating live OneDrive data file");
      enforceAnnualLeaveRenewal();
      await saveCommandData();
    }
  } catch {
    oneDriveLiveDataLoaded = false;
    updateOneDriveHeaderStatus(oneDrivePendingBackup() ? "Local backup pending" : "OneDrive unavailable", "Using local browser backup only");
  }

  await loadPhase05eCompletedReports();
  render();
  applyInitialSectionFromUrl();
}

function applyInitialSectionFromUrl() {
  if (initialSectionApplied) return;
  initialSectionApplied = true;
  const params = new URLSearchParams(location.search);
  const storedSection = localStorage.getItem(sectionStorageKey) || "";
  const requestedSection = params.get("section") || (params.has("planner") ? "weekly-planner" : "") || storedSection;
  if (requestedSection && document.querySelector(`#${CSS.escape(requestedSection)}`)) {
    showSection(requestedSection);
  }
}

async function saveCommandData() {
  if (isReviewMode()) {
    updateOneDriveHeaderStatus("Live OneDrive data loaded", "Review mode - saving disabled");
    return false;
  }
  const payload = commandData();
  localStorage.setItem(storageKey, JSON.stringify(ramsItems));
  updateOneDriveHeaderStatus("Saving to OneDrive", "Writing live office data");

  if (location.protocol === "file:") {
    const response = await fetchFirstHubApi("/api/data", commandCentreApiOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload, null, 2)
    }));
    if (!response) {
      keepPendingOneDriveBackup(payload, "OneDrive helper unavailable");
      await syncStaffRecordsFolder({ warnOnFailure: true });
      return false;
    }
    const staffSaved = await syncStaffRecordsFolder({ warnOnFailure: true });
    if (!staffSaved) {
      keepPendingOneDriveBackup(payload, "Staff records did not save to OneDrive");
      return false;
    }
    const savedAt = new Date().toISOString();
    clearPendingOneDriveBackup();
    localStorage.setItem(oneDriveLastSavedStorageKey, savedAt);
    oneDriveLiveDataLoaded = true;
    updateOneDriveHeaderStatus("OneDrive save complete", formatOneDriveSaveTime(savedAt));
    return true;
  }

  try {
    const response = await fetch("/api/data", commandCentreApiOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload, null, 2)
    }));

    if (!response.ok) {
      keepPendingOneDriveBackup(payload, "OneDrive data save failed");
      return false;
    }
    const staffSaved = await syncStaffRecordsFolder({ warnOnFailure: true });
    if (!staffSaved) {
      keepPendingOneDriveBackup(payload, "Staff records did not save to OneDrive");
      return false;
    }
    const savedAt = new Date().toISOString();
    clearPendingOneDriveBackup();
    localStorage.setItem(oneDriveLastSavedStorageKey, savedAt);
    oneDriveLiveDataLoaded = true;
    updateOneDriveHeaderStatus("OneDrive save complete", formatOneDriveSaveTime(savedAt));
    return true;
  } catch {
    keepPendingOneDriveBackup(payload, "OneDrive unavailable");
    await syncStaffRecordsFolder({ warnOnFailure: true });
    return false;
  }
}

async function syncNow() {
  if (isReviewMode()) {
    await reviewModeMessage();
    return false;
  }
  if (oneDrivePendingBackup()) {
    const confirmed = await kcConfirmAction(
      "A local backup is pending. Sync now will write this Hub data back to OneDrive. Continue only if this is the latest office record.",
      "Continue"
    );
    if (!confirmed) return false;
  }
  const saved = await publishIntegrationFeeds();
  if (saved) {
    await kcInfo("OneDrive save complete.");
  } else {
    updateOneDriveHeaderStatus("Local backup pending", "Data has not been safely saved to OneDrive yet");
    await kcInfo("OneDrive is unavailable or did not confirm the save. A local backup is pending and the Hub has not marked this as safely saved.");
  }
  return saved;
}

function loadRams() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) {
    return starterRams;
  }

  try {
    return JSON.parse(saved);
  } catch {
    return starterRams;
  }
}

function saveRams() {
  if (isReviewMode()) return false;
  saveCommandData();
}

function asVehicleObject(vehicle) {
  if (Array.isArray(vehicle)) {
    return normaliseVehicleForUi({
      registration: vehicle[0] || "",
      vehicle: vehicle[1] || "",
      driver: vehicle[2] || "",
      mot: vehicle[3] || "",
      service: vehicle[4] || "",
      insurance: vehicle[5] || "",
      tracker: vehicle[6] || ""
    });
  }
  return normaliseVehicleForUi(vehicle || {});
}

async function saveFineToOneDrive(item) {
  const evidenceToSave = fineEvidenceDraft.map((entry) => ({ ...entry }));
  const payload = {
    fine: {
      ...item,
      type: item.type === "Other" && item.customType ? item.customType : item.type,
      evidenceFileNames: evidenceToSave.map((entry) => entry.name).filter(Boolean)
    },
    evidence: evidenceToSave.filter((entry) => entry.dataUrl)
  };

  try {
    const response = await fetch("/api/save-fine-record", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "OneDrive helper did not confirm the save.");
    if (!result.saved) throw new Error(result.message || "OneDrive helper did not confirm the save.");
    item.oneDriveFolder = result.folder;
    item.evidenceItems = result.evidenceItems || evidenceToSave.map(({ dataUrl, ...entry }) => entry);
    item.evidenceFileNames = item.evidenceItems.map((entry) => entry.name).filter(Boolean);
    item.evidence = item.evidenceFileNames.join(", ");
    fineEvidenceDraft = item.evidenceItems.map((entry) => ({ ...entry, saved: true }));
    localStorage.removeItem(finesPendingStorageKey);
    return true;
  } catch (error) {
    localStorage.setItem(finesPendingStorageKey, JSON.stringify({ savedAt: new Date().toISOString(), payload }));
    await kcInfo(`Fine data has not been safely saved to OneDrive yet. A pending local copy has been kept. ${error.message || "Please start Kingswood Hub with the launcher and try saving again."}`);
    return false;
  }
}

async function saveTrainingDocumentToOneDrive(item) {
  const staff = staffProfiles.find((profile) => profile.staffId === item.staffId || profile.name === item.employee);
  const payload = {
    record: {
      ...item,
      employee: item.employee || staff?.name || "",
      staffId: item.staffId || staff?.staffId || ""
    },
    document: trainingDocumentDraft?.dataUrl ? trainingDocumentDraft : null
  };

  try {
    const response = await fetch("/api/save-training-record", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.saved) throw new Error(result.message || "OneDrive helper did not confirm the training save.");
    item.oneDriveLocation = result.document?.filePath || result.record?.oneDriveLocation || item.oneDriveLocation || "";
    item.documentFileName = result.document?.name || item.documentFileName || item.certificate || "";
    item.certificate = item.documentFileName || item.certificate || "";
    item.updatedAt = new Date().toISOString();
    trainingDocumentDraft = result.document ? { ...result.document, saved: true } : trainingDocumentDraft;
    return true;
  } catch (error) {
    keepPendingOneDriveBackup(commandData(), "Training document save failed");
    await kcInfo(`Training record has not been safely saved to OneDrive yet. A local backup has been kept. ${error.message || "Please start Kingswood Hub with the launcher and try saving again."}`);
    return false;
  }
}

async function saveComplianceDocumentToOneDrive(item, { renewal = false } = {}) {
  const payload = {
    record: item,
    document: complianceDocumentDraft?.dataUrl ? complianceDocumentDraft : null,
    renewal
  };

  try {
    const response = await fetch("/api/save-compliance-record", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.saved) throw new Error(result.message || "OneDrive helper did not confirm the compliance save.");
    item.oneDriveLocation = result.document?.filePath || result.record?.oneDriveLocation || item.oneDriveLocation || "";
    item.documentFileName = result.document?.name || item.documentFileName || "";
    item.supportingDocumentName = item.documentFileName;
    item.updatedAt = new Date().toISOString();
    complianceDocumentDraft = result.document ? { ...result.document, saved: true } : complianceDocumentDraft;
    return true;
  } catch (error) {
    keepPendingOneDriveBackup(commandData(), "Compliance document save failed");
    await kcInfo(`Compliance record has not been safely saved to OneDrive yet. A local backup has been kept. ${error.message || "Please start Kingswood Hub with the launcher and try saving again."}`);
    return false;
  }
}

async function saveAssetToOneDrive(item) {
  const documentsToSave = assetDocumentDraft.filter((entry) => entry.dataUrl && !entry.saved).map((entry) => ({ ...entry }));
  const payload = {
    asset: {
      ...item,
      documents: assetDocumentDraft.map((entry) => ({ ...entry }))
    },
    documents: documentsToSave,
    user: currentUserName()
  };
  updateOneDriveHeaderStatus("Saving to OneDrive", "Saving asset register");
  try {
    const response = await fetch("/api/save-asset-record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.saved) throw new Error(result.message || "OneDrive helper did not confirm the asset save.");
    item.documents = result.documents || item.documents || [];
    item.oneDriveFolder = result.folder || item.oneDriveFolder || "";
    item.updatedAt = new Date().toISOString();
    assetDocumentDraft = item.documents.map((entry) => ({ ...entry, saved: true }));
    updateOneDriveHeaderStatus("OneDrive save complete", formatOneDriveSaveTime(new Date().toISOString()));
    return true;
  } catch (error) {
    keepPendingOneDriveBackup(commandData(), "Asset record failed to save");
    updateOneDriveHeaderStatus("Local backup pending", "Asset not saved to OneDrive");
    await kcInfo(`Asset data has not been safely saved to OneDrive yet. A local backup has been kept. ${error.message || "Please start Kingswood Hub with the launcher and try saving again."}`);
    return false;
  }
}

function openDataDialog(collection, index = "", seed = {}) {
  const model = dataModels[collection];
  if (!model) return;

  const item = index === "" ? seed : model.get()[Number(index)];
  dataCollectionInput.value = collection;
  dataIndexInput.value = index;
  dataDialogTitle.textContent = `${index === "" ? "Add" : "Edit"} ${model.title}`;
  dataDialog.classList.toggle("fines-dialog", collection === "fines");
  setDataDialogStatus("");
  if (dataSaveButton) {
    dataSaveButton.textContent = collection === "jobs" ? "Send to Tech App" : "Save";
    dataSaveButton.value = collection === "jobs" ? "send-tech" : "default";
    dataSaveButton.disabled = false;
  }
  if (dataSaveSystemButton) {
    dataSaveSystemButton.hidden = collection !== "jobs";
    dataSaveSystemButton.disabled = false;
  }
  dataFields.innerHTML = model.fields.map(([key, label, type = "text"]) => {
    if (type === "section-heading") {
      return `<div class="form-section-heading full-width">${escapeHtml(label)}</div>`;
    }
    const value = escapeHtml(fieldValue(item, key));
    const full = type === "textarea" ? " full-width" : "";
    if (type === "checkbox") {
      return renderCheckboxField(key, label, fieldValue(item, key));
    }
    if (type === "staff-select") {
      return renderSelectField(key, label, fieldValue(item, key), staffNames());
    }
    if (type === "vehicle-registration-select") {
      const options = vehicles.map((vehicle) => asVehicleObject(vehicle).registration).filter(Boolean);
      if (options.length) {
        return renderSelectField(key, label, fieldValue(item, key), options);
      }
      return `
        <label class="${full}">
          ${label}
          <input data-field="${key}" type="text" value="${value}" placeholder="Enter vehicle registration">
        </label>
      `;
    }
    if (type === "readonly-text") {
      return `
        <label>
          ${label}
          <input data-field="${key}" type="text" value="${value || escapeHtml(generateAssetId(fieldValue(item, "asset") || "Asset"))}" readonly>
        </label>
      `;
    }
    if (type === "readonly-vehicle-id") {
      const vehicleIdValue = value || (fieldValue(item, "registration") ? escapeHtml(stableVehicleIdForUi(item || {})) : "Generated on save");
      return `
        <label>
          ${label}
          <input data-field="${key}" type="text" value="${vehicleIdValue}" readonly>
        </label>
      `;
    }
    if (type === "asset-category-select") {
      return renderSelectField(key, label, fieldValue(item, key) || "Power tools", assetCategories);
    }
    if (type === "asset-condition-select") {
      return renderSelectField(key, label, fieldValue(item, key) || "Good", assetConditions);
    }
    if (type === "asset-status-select") {
      return renderSelectField(key, label, fieldValue(item, key) || "In use", assetStatuses);
    }
    if (type === "asset-power-source-select") {
      return renderSelectField(key, label, fieldValue(item, key) || "Not applicable", assetPowerSources);
    }
    if (type === "asset-pat-result-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["Pass", "Fail", "Advisory", "Not tested"]);
    }
    if (type === "asset-employee-select") {
      const staffOptions = staffProfiles.filter((staff) => staff.status !== "Left");
      const options = ["", ...staffOptions.map((staff) => staff.staffId || staff.name)];
      return renderSelectField(key, label, fieldValue(item, key), options, (option) => staffOptions.find((staff) => (staff.staffId || staff.name) === option)?.name || option || "Not assigned");
    }
    if (type === "asset-vehicle-select") {
      const vehicleOptions = vehicles.map(asVehicleObject);
      const options = ["", ...vehicleOptions.map((vehicle) => vehicle.vehicleId || vehicle.registration)];
      return renderSelectField(key, label, fieldValue(item, key), options, (option) => {
        const vehicle = vehicleOptions.find((item) => (item.vehicleId || item.registration) === option);
        return vehicle ? `${vehicle.registration || vehicle.vehicle}` : option || "Not stored in vehicle";
      });
    }
    if (type === "fine-type-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["Parking", "Congestion Charge", "ULEZ", "Speeding", "Bus Lane", "Moving Traffic", "Dart Charge", "Other"]);
    }
    if (type === "fine-status-select") {
      return renderSelectField(key, label, fieldValue(item, key) || "New", ["New", "Awaiting Driver", "Under Review", "Appealed", "Awaiting Payment", "Paid", "Cancelled"]);
    }
    if (type === "training-lifecycle-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["", "Current", "Missing / Not Recorded", "Not Applicable", "Superseded", "Inactive"], (option) => option || "Calculated from expiry");
    }
    if (type === "holiday-day-type-select") {
      return renderSelectField(key, label, fieldValue(item, key) || "Full day", ["Full day", "Half day"]);
    }
    if (type === "holiday-day-part-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["AM", "PM"]);
    }
    if (type === "holiday-days-number") {
      return `
        <label>
          ${label}
          <span class="inline-field-action">
            <input data-field="${key}" type="number" step="0.5" value="${value}" readonly>
            <button class="secondary-button compact-button" type="button" data-holiday-days-override>Override</button>
          </span>
        </label>
      `;
    }
    if (type === "fine-evidence") {
      const existingEvidence = normaliseFineEvidence(item);
      fineEvidenceDraft = existingEvidence.map((entry) => ({ ...entry, saved: true }));
      return `
        <section class="full-width fine-evidence-field">
          <div class="fine-evidence-drop" tabindex="0" role="button" aria-label="Paste or drag fine evidence here">
            <strong>Paste or drag fine evidence here</strong>
            <span>Accepts Snipping Tool screenshots, images and PDF documents.</span>
          </div>
          <div id="fineEvidencePreview" class="fine-evidence-preview"></div>
        </section>
      `;
    }
    if (type === "training-document") {
      trainingDocumentDraft = normaliseTrainingDocument(item);
      return `
        <section class="full-width training-document-field">
          <div class="training-document-drop" tabindex="0" role="button" aria-label="Add training certificate or document">
            <strong>Paste, select or drag certificate here</strong>
            <span>Accepts PDF, JPG, JPEG and PNG documents.</span>
            <input id="trainingDocumentInput" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden>
          </div>
          <div id="trainingDocumentPreview" class="training-document-preview"></div>
        </section>
      `;
    }
    if (type === "compliance-document") {
      complianceDocumentDraft = normaliseComplianceDocument(item);
      return `
        <section class="full-width training-document-field compliance-document-field">
          <div class="training-document-drop compliance-document-drop" tabindex="0" role="button" aria-label="Add compliance supporting document">
            <strong>Paste, select or drag supporting document here</strong>
            <span>Accepts PDF, images, Word and Excel documents.</span>
            <input id="complianceDocumentInput" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
          </div>
          <div id="complianceDocumentPreview" class="training-document-preview"></div>
        </section>
      `;
    }
    if (type === "asset-documents") {
      assetDocumentDraft = normaliseAssetDocuments(item);
      return `
        <section class="full-width training-document-field asset-document-field">
          <div class="training-document-drop asset-document-drop" tabindex="0" role="button" aria-label="Add asset photos or documents">
            <strong>Paste, select or drag asset photos and documents here</strong>
            <span>Accepts Snipping Tool screenshots, PDF, images, Word and Excel documents.</span>
            <input id="assetDocumentInput" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
          </div>
          <div id="assetDocumentPreview" class="training-document-preview"></div>
        </section>
      `;
    }
    if (type === "job-technician-select") {
      return renderJobTechnicianField(key, label, fieldValue(item, key), fieldValue(item, "date") || today);
    }
    if (type === "attendance-status-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["Present", "Absent - Called in Sick", "Sick", "Holiday", "Training", "Unpaid leave", "Late", "Absent"]);
    }
    if (type === "absence-category-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["Gastrointestinal (Vomiting/Diarrhoea)", "Respiratory / Chest", "Musculoskeletal / Physical Injury", "General Illness", "Annual Leave", "Occupational Sick Leave / Industrial Injury"]);
    }
    if (type === "yes-no-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["No", "Yes"]);
    }
    if (type === "role-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["Technician", "Senior Technician", "Trainee Technician", "Admin", "Manager", "Director"]);
    }
    if (type === "company-document-category-select") {
      return renderSelectField(key, label, fieldValue(item, key), companyDocumentCategories);
    }
    if (type === "compliance-type-select") {
      return renderSelectField(key, label, fieldValue(item, key), complianceTypes);
    }
    if (type === "accreditation-select") {
      return renderSelectField(key, label, fieldValue(item, key), accreditationOptions);
    }
    if (type === "office-owner-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["Kevin", "Alex", "Jodie"]);
    }
    if (type === "session-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["AM", "PM"]);
    }
    if (type === "job-slot-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["AM", "PM"]);
    }
    if (type === "job-title-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["Proofing", "Bird work", "Plumbing", "Bulk clearance", "Rodenticide treatment", "Other"]);
    }
    if (type === "main-client-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["Ark", "JG Pest Control", "Private", "Vergo", "Other"]);
    }
    if (type === "valuation-group-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["Ark", "JG Pest Control", "Private", "Vergo", "Other"]);
    }
    if (type === "site-category-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["Residential", "Commercial Kitchen", "Food Premises", "Catering", "Construction Site", "Office", "Warehouse", "External Area", "Other"]);
    }
    if (type === "planner-type-select") {
      return renderSelectField(key, label, fieldValue(item, key) || plannerTypeFromItem(item), ["Holiday", "Provisional", "Sick", "Other"]);
    }
    if (type === "planner-action-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["Reassign job", "Cancel job"]);
    }
    if (type === "snippet-textarea") {
      const placeholder = key === "photos"
        ? "Paste or drag pre-work reference images here, or type image notes."
        : "Paste or type the job instructions, access notes or work details.";
      const hint = key === "photos"
        ? "Accepts pasted screenshots or dragged image files."
        : "Use this for written job-pack information. Reference images belong in the image field below.";
      return `
        <label class="full-width snippet-label">
          ${label}
          <textarea class="snippet-target" data-field="${key}" data-snippet-field="${key}" rows="4" placeholder="${escapeHtml(placeholder)}">${value}</textarea>
          <span class="field-hint">${escapeHtml(hint)}</span>
        </label>
      `;
    }
    if (type === "textarea") {
      return `
        <label class="${full}">
          ${label}
          <textarea data-field="${key}" rows="3">${value}</textarea>
        </label>
      `;
    }
    return `
      <label class="${full}">
        ${label}
        <input data-field="${key}" type="${type}" value="${value}">
      </label>
    `;
  }).join("");
  setupSnippetFields();
  setupFineEvidenceField(collection);
  setupTrainingDocumentField(collection);
  setupComplianceDocumentField(collection);
  setupTrainingExpiryFields(collection);
  setupComplianceExpiryFields(collection);
  setupComplianceAccreditationFields(collection);
  setupAssetDocumentField(collection);
  setupAssetConditionalFields(collection);
  setupSmartDataDialog(collection);
  dataDialog.showModal();
  if (collection === "fines") {
    renderFineEvidencePreview();
  }
  if (collection === "training") {
    renderTrainingDocumentPreview();
  }
  if (collection === "compliance") {
    renderComplianceDocumentPreview();
  }
  if (collection === "assets") {
    renderAssetDocumentPreview();
  }
}

function setupTrainingExpiryFields(collection) {
  if (collection !== "training") return;
  const noExpiryField = dataFields.querySelector('[data-field="noExpiry"]');
  const expiryField = dataFields.querySelector('[data-field="expiryDate"]');
  const refresh = () => {
    if (!noExpiryField || !expiryField) return;
    expiryField.disabled = noExpiryField.checked;
    if (noExpiryField.checked) expiryField.value = "";
  };
  noExpiryField?.addEventListener("change", refresh);
  refresh();
}

function appendSnippetToField(textarea, file) {
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const stamp = new Date().toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const current = textarea.value.trim();
    const entry = `[Screenshot ${stamp} - ${file.name || "pasted image"}]\n${reader.result}`;
    textarea.value = current ? `${current}\n\n${entry}` : entry;
  });
  reader.readAsDataURL(file);
}

function setupSnippetFields() {
  dataFields.querySelectorAll("[data-snippet-field]").forEach((textarea) => {
    textarea.addEventListener("paste", (event) => {
      const files = Array.from(event.clipboardData?.files || []);
      files.forEach((file) => appendSnippetToField(textarea, file));
    });
    textarea.addEventListener("dragover", (event) => {
      event.preventDefault();
      textarea.classList.add("snippet-dragover");
    });
    textarea.addEventListener("dragleave", () => {
      textarea.classList.remove("snippet-dragover");
    });
    textarea.addEventListener("drop", (event) => {
      event.preventDefault();
      textarea.classList.remove("snippet-dragover");
      Array.from(event.dataTransfer?.files || []).forEach((file) => appendSnippetToField(textarea, file));
    });
  });
}

function normaliseFineEvidence(fine = {}) {
  if (Array.isArray(fine.evidenceItems)) return fine.evidenceItems;
  if (Array.isArray(fine.evidenceFiles)) return fine.evidenceFiles;
  if (typeof fine.evidence === "string" && fine.evidence.trim()) {
    return [{ name: fine.evidence.trim(), type: "note", saved: true }];
  }
  return [];
}

function normaliseTrainingDocument(record = {}) {
  const name = record.documentFileName || record.certificate || "";
  if (!name && !record.oneDriveLocation) return null;
  return {
    id: record.documentId || record.id || crypto.randomUUID(),
    name,
    type: /\.(png|jpe?g)$/i.test(name) ? "image" : /\.pdf$/i.test(name) ? "pdf" : "document",
    filePath: record.oneDriveLocation || "",
    saved: true
  };
}

function trainingDocumentType(file) {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("image/") || /\.(png|jpe?g)$/i.test(name)) return "image";
  return "";
}

function readTrainingDocumentFile(file) {
  return new Promise((resolve) => {
    const kind = trainingDocumentType(file);
    if (!kind) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve({
        id: crypto.randomUUID(),
        name: file.name || `training-document-${Date.now()}.${kind === "pdf" ? "pdf" : "png"}`,
        type: kind,
        mimeType: file.type || (kind === "pdf" ? "application/pdf" : "image/png"),
        dataUrl: reader.result,
        addedAt: new Date().toISOString()
      });
    });
    reader.readAsDataURL(file);
  });
}

async function setTrainingDocumentFile(file) {
  const entry = await readTrainingDocumentFile(file);
  if (!entry) {
    await kcInfo("Please add a PDF, JPG, JPEG or PNG training document.");
    return;
  }
  trainingDocumentDraft = entry;
  renderTrainingDocumentPreview();
}

function renderTrainingDocumentPreview() {
  const target = dataFields.querySelector("#trainingDocumentPreview");
  if (!target) return;
  if (!trainingDocumentDraft) {
    target.innerHTML = '<p class="empty-state compact-empty">No certificate selected.</p>';
    return;
  }
  const isImage = trainingDocumentDraft.type === "image" && trainingDocumentDraft.dataUrl;
  target.innerHTML = `
    <article class="training-document-item">
      ${isImage ? `<img src="${trainingDocumentDraft.dataUrl}" alt="">` : `<span class="document-chip">${escapeHtml(trainingDocumentDraft.type === "pdf" ? "PDF" : "DOC")}</span>`}
      <div>
        <strong>${escapeHtml(trainingDocumentDraft.name || "Training document")}</strong>
        <p>${trainingDocumentDraft.saved ? "Saved to OneDrive" : "Certificate attached"}</p>
      </div>
      <div class="record-actions">
        ${trainingDocumentDraft.dataUrl ? '<button class="secondary-button" type="button" data-open-training-document>Open</button>' : ""}
        <button class="danger-button" type="button" data-remove-training-document>Remove</button>
      </div>
    </article>
  `;
}

function setupTrainingDocumentField(collection) {
  if (collection !== "training") return;
  const drop = dataFields.querySelector(".training-document-drop");
  const input = dataFields.querySelector("#trainingDocumentInput");
  if (!drop || !input) return;
  drop.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) setTrainingDocumentFile(file);
    input.value = "";
  });
  drop.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop.classList.add("is-over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("is-over");
    const file = event.dataTransfer?.files?.[0];
    if (file) setTrainingDocumentFile(file);
  });
  drop.addEventListener("paste", (event) => {
    const file = Array.from(event.clipboardData?.files || [])[0];
    if (file) setTrainingDocumentFile(file);
  });
}

function setupComplianceExpiryFields(collection) {
  if (collection !== "compliance") return;
  const noExpiryField = dataFields.querySelector('[data-field="noExpiry"]');
  const expiryField = dataFields.querySelector('[data-field="expiryDate"]');
  const refresh = () => {
    if (!noExpiryField || !expiryField) return;
    expiryField.disabled = noExpiryField.checked;
    if (noExpiryField.checked) expiryField.value = "";
  };
  noExpiryField?.addEventListener("change", refresh);
  refresh();
}

function setupComplianceAccreditationFields(collection) {
  if (collection !== "compliance") return;
  const typeField = dataFields.querySelector('[data-field="complianceType"]');
  const accreditationField = dataFields.querySelector('[data-field="accreditationName"]');
  const customField = dataFields.querySelector('[data-field="customAccreditationName"]');
  const titleField = dataFields.querySelector('[data-field="title"]');
  const accreditationWrap = accreditationField?.closest("label");
  const customWrap = customField?.closest("label");
  const refresh = () => {
    const isAccreditation = typeField?.value === "Accreditation";
    if (accreditationWrap) accreditationWrap.hidden = !isAccreditation;
    if (customWrap) customWrap.hidden = !isAccreditation || accreditationField?.value !== "Add other accreditation";
    if (isAccreditation && accreditationField?.value === "SafeContractor" && titleField && !titleField.value.trim()) {
      titleField.value = "SafeContractor accreditation";
    }
  };
  typeField?.addEventListener("change", refresh);
  accreditationField?.addEventListener("change", () => {
    if (accreditationField.value === "SafeContractor" && titleField) titleField.value = "SafeContractor accreditation";
    if (accreditationField.value === "Add other accreditation" && titleField && titleField.value === "SafeContractor accreditation") titleField.value = "";
    refresh();
  });
  refresh();
}

function normaliseComplianceDocument(record = {}) {
  const name = record.documentFileName || record.supportingDocumentName || "";
  if (!name && !record.oneDriveLocation) return null;
  return {
    id: record.documentId || record.id || crypto.randomUUID(),
    name,
    type: /\.(png|jpe?g)$/i.test(name) ? "image" : /\.pdf$/i.test(name) ? "pdf" : "document",
    filePath: record.oneDriveLocation || "",
    saved: true
  };
}

function complianceDocumentType(file) {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("image/") || /\.(png|jpe?g)$/i.test(name)) return "image";
  if (/\.(doc|docx|xls|xlsx)$/i.test(name)) return "document";
  return "";
}

function readComplianceDocumentFile(file) {
  return new Promise((resolve) => {
    const kind = complianceDocumentType(file);
    if (!kind) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve({
        id: crypto.randomUUID(),
        name: file.name || `compliance-document-${Date.now()}`,
        type: kind,
        mimeType: file.type || "application/octet-stream",
        dataUrl: reader.result,
        addedAt: new Date().toISOString()
      });
    });
    reader.readAsDataURL(file);
  });
}

async function setComplianceDocumentFile(file) {
  const entry = await readComplianceDocumentFile(file);
  if (!entry) {
    await kcInfo("Please add a PDF, JPG, JPEG, PNG, Word or Excel document.");
    return;
  }
  complianceDocumentDraft = entry;
  renderComplianceDocumentPreview();
}

function renderComplianceDocumentPreview() {
  const target = dataFields.querySelector("#complianceDocumentPreview");
  if (!target) return;
  if (!complianceDocumentDraft) {
    target.innerHTML = '<p class="empty-state compact-empty">No supporting document selected.</p>';
    return;
  }
  const isImage = complianceDocumentDraft.type === "image" && complianceDocumentDraft.dataUrl;
  target.innerHTML = `
    <article class="training-document-item">
      ${isImage ? `<img src="${complianceDocumentDraft.dataUrl}" alt="">` : `<span class="document-chip">${escapeHtml(complianceDocumentDraft.type === "pdf" ? "PDF" : "DOC")}</span>`}
      <div>
        <strong>${escapeHtml(complianceDocumentDraft.name || "Compliance document")}</strong>
        <p>${complianceDocumentDraft.saved ? "Saved to OneDrive" : "Supporting document attached"}</p>
      </div>
      <div class="record-actions">
        ${complianceDocumentDraft.dataUrl ? '<button class="secondary-button" type="button" data-open-compliance-document>Open</button>' : ""}
        <button class="danger-button" type="button" data-remove-compliance-document>Remove</button>
      </div>
    </article>
  `;
}

function setupComplianceDocumentField(collection) {
  if (collection !== "compliance") return;
  const drop = dataFields.querySelector(".compliance-document-drop");
  const input = dataFields.querySelector("#complianceDocumentInput");
  if (!drop || !input) return;
  drop.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) setComplianceDocumentFile(file);
    input.value = "";
  });
  drop.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop.classList.add("is-over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("is-over");
    const file = event.dataTransfer?.files?.[0];
    if (file) setComplianceDocumentFile(file);
  });
  drop.addEventListener("paste", (event) => {
    const file = Array.from(event.clipboardData?.files || [])[0];
    if (file) setComplianceDocumentFile(file);
  });
}

function assetDocumentType(file) {
  const type = file.type || "";
  if (type.startsWith("image/")) return "image";
  if (type.includes("pdf")) return "pdf";
  if (type.includes("word") || /\.(doc|docx)$/i.test(file.name || "")) return "word";
  if (type.includes("excel") || type.includes("spreadsheet") || /\.(xls|xlsx)$/i.test(file.name || "")) return "excel";
  return "";
}

function normaliseAssetDocuments(asset = {}) {
  return Array.isArray(asset.documents) ? asset.documents : [];
}

function addAssetDocumentFiles(files) {
  const entries = Array.from(files || []);
  const allowed = entries.filter((file) => assetDocumentType(file));
  if (!allowed.length) {
    kcInfo("Please add PDF, JPG, JPEG, PNG, Word or Excel asset documents.");
    return;
  }
  allowed.forEach((file) => {
    const kind = assetDocumentType(file);
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      assetDocumentDraft.push({
        id: crypto.randomUUID(),
        name: file.name || `asset-document-${Date.now()}`,
        type: kind,
        mimeType: file.type || "",
        dataUrl: reader.result,
        saved: false
      });
      renderAssetDocumentPreview();
    });
    reader.readAsDataURL(file);
  });
}

function renderAssetDocumentPreview() {
  const target = dataFields.querySelector("#assetDocumentPreview");
  if (!target) return;
  target.innerHTML = assetDocumentDraft.length
    ? assetDocumentDraft.map((item, index) => {
      const isImage = item.type === "image" && item.dataUrl;
      const label = item.type === "pdf" ? "PDF" : item.type === "word" ? "DOC" : item.type === "excel" ? "XLS" : "IMG";
      return `
        <article class="training-document-item">
          ${isImage ? `<img src="${escapeHtml(item.dataUrl)}" alt="">` : `<span class="document-chip">${label}</span>`}
          <div>
            <strong>${escapeHtml(item.name || "Asset document")}</strong>
            <p>${item.saved ? "Saved to OneDrive" : "Ready to save"}</p>
            <div class="record-actions">
              ${item.dataUrl ? `<button class="secondary-button" type="button" data-open-asset-document="${index}">Open</button>` : ""}
              <button class="danger-button" type="button" data-remove-asset-document="${index}">Remove</button>
            </div>
          </div>
        </article>
      `;
    }).join("")
    : '<p class="empty-state compact-empty">No asset photos or documents attached yet.</p>';
}

function setupAssetDocumentField(collection) {
  if (collection !== "assets") return;
  const drop = dataFields.querySelector(".asset-document-drop");
  const input = dataFields.querySelector("#assetDocumentInput");
  if (!drop || !input) return;
  drop.addEventListener("click", () => input.click());
  input.addEventListener("change", () => addAssetDocumentFiles(input.files || []));
  drop.addEventListener("paste", (event) => {
    const files = Array.from(event.clipboardData?.files || []);
    if (files.length) {
      event.preventDefault();
      addAssetDocumentFiles(files);
    }
  });
  drop.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop.classList.add("drag-over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("drag-over");
    addAssetDocumentFiles(event.dataTransfer?.files || []);
  });
}

function setupAssetConditionalFields(collection) {
  if (collection !== "assets") return;
  const inspectionRequired = dataFields.querySelector('[data-field="inspectionRequired"]');
  const serviceRequired = dataFields.querySelector('[data-field="serviceRequired"]');
  const powerSource = dataFields.querySelector('[data-field="powerSource"]');
  const patRequired = dataFields.querySelector('[data-field="patTestingRequired"]');
  const toggleField = (key, visible) => {
    dataFields.querySelector(`[data-field="${key}"]`)?.closest("label")?.classList.toggle("hidden", !visible);
  };
  const refresh = () => {
    const showInspection = inspectionRequired?.value === "Yes";
    ["inspectionFrequency", "lastInspectionDate", "nextInspectionDue"].forEach((key) => toggleField(key, showInspection));
    const showService = serviceRequired?.value === "Yes";
    ["serviceFrequency", "lastServiceDate", "nextServiceDue"].forEach((key) => toggleField(key, showService));
    const showPat = powerSource?.value === "Mains powered";
    toggleField("patTestingRequired", showPat);
    const showPatDetails = showPat && patRequired?.value === "Yes";
    ["lastPatDate", "nextPatDue", "patResult"].forEach((key) => toggleField(key, showPatDetails));
    if (!showPat && patRequired) patRequired.value = "No";
  };
  [inspectionRequired, serviceRequired, powerSource, patRequired].forEach((field) => field?.addEventListener("change", refresh));
  refresh();
}

function fineEvidenceType(file) {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("image/") || /\.(png|jpe?g)$/i.test(name)) return "image";
  return "";
}

function readFineEvidenceFile(file) {
  return new Promise((resolve) => {
    const kind = fineEvidenceType(file);
    if (!kind) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve({
        id: crypto.randomUUID(),
        name: file.name || `${kind}-evidence-${Date.now()}.${kind === "pdf" ? "pdf" : "png"}`,
        type: kind,
        mimeType: file.type || (kind === "pdf" ? "application/pdf" : "image/png"),
        dataUrl: reader.result,
        addedAt: new Date().toISOString()
      });
    });
    reader.readAsDataURL(file);
  });
}

async function addFineEvidenceFiles(files) {
  const entries = await Promise.all(Array.from(files || []).map(readFineEvidenceFile));
  const valid = entries.filter(Boolean);
  if (!valid.length) {
    await kcInfo("Please add JPG, JPEG, PNG or PDF evidence files only.");
    return;
  }
  fineEvidenceDraft.push(...valid);
  renderFineEvidencePreview();
}

function renderFineEvidencePreview() {
  const target = dataFields.querySelector("#fineEvidencePreview");
  if (!target) return;
  target.innerHTML = fineEvidenceDraft.length
    ? fineEvidenceDraft.map((item, index) => {
      const isImage = item.type === "image" && item.dataUrl;
      const openValue = item.dataUrl ? ` data-open-fine-evidence="${index}"` : "";
      return `
        <article class="fine-evidence-item">
          ${isImage ? `<img src="${escapeHtml(item.dataUrl)}" alt="${escapeHtml(item.name)}">` : `<div class="fine-evidence-file">${item.type === "pdf" ? "PDF" : "FILE"}</div>`}
          <div>
            <strong>${escapeHtml(item.name || "Evidence")}</strong>
            <p>${escapeHtml(item.saved ? "Saved evidence" : "Ready to save")}</p>
            <div class="record-actions">
              ${item.dataUrl ? `<button class="secondary-button" type="button"${openValue}>Open</button>` : ""}
              <button class="danger-button" type="button" data-remove-fine-evidence="${index}">Remove</button>
            </div>
          </div>
        </article>
      `;
    }).join("")
    : '<p class="empty-state compact-empty">No evidence added yet.</p>';
}

function setupFineEvidenceField(collection) {
  if (collection !== "fines") return;
  const drop = dataFields.querySelector(".fine-evidence-drop");
  if (!drop) return;
  drop.addEventListener("paste", (event) => {
    const files = Array.from(event.clipboardData?.files || []);
    if (files.length) {
      event.preventDefault();
      addFineEvidenceFiles(files);
    }
  });
  drop.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop.classList.add("drag-over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("drag-over");
    addFineEvidenceFiles(event.dataTransfer?.files || []);
  });
}

function setupSmartDataDialog(collection) {
  if (collection === "jobs" || collection === "planner") {
    const dateField = dataFields.querySelector('[data-field="date"]');
    const technicianField = dataFields.querySelector("[data-job-technician-select]");
    dateField?.addEventListener("change", () => {
      if (!technicianField) return;
      const current = technicianField.value;
      const key = technicianField.dataset.field || "technician";
      const label = key === "reassignTo" ? "Reassign to" : "Technician";
      const wrapper = technicianField.closest("label");
      if (!wrapper) return;
      wrapper.outerHTML = renderJobTechnicianField(key, label, current, dateField.value || today);
    });
  }

  if (collection === "holidays") {
    const fromField = dataFields.querySelector('[data-field="from"]');
    const toField = dataFields.querySelector('[data-field="to"]');
    const dayTypeField = dataFields.querySelector('[data-field="dayType"]');
    const dayPartField = dataFields.querySelector('[data-field="dayPart"]');
    const dayPartWrap = dayPartField?.closest("label");
    const daysField = dataFields.querySelector('[data-field="days"]');
    const refreshHolidayTiming = () => {
      const sameDay = fromField?.value && toField?.value && fromField.value === toField.value;
      if (dayTypeField && dayTypeField.value === "Half day" && !sameDay) {
        dayTypeField.value = "Full day";
      }
      if (dayPartWrap) {
        dayPartWrap.classList.toggle("hidden", dayTypeField?.value !== "Half day");
      }
      if (dayPartField && dayTypeField?.value === "Half day" && !dayPartField.value) {
        dayPartField.value = "AM";
      }
      const calculated = holidayCalculatedDays({
        from: fromField?.value,
        to: toField?.value,
        dayType: dayTypeField?.value,
        dayPart: dayPartField?.value
      });
      if (daysField && daysField.dataset.holidayDaysOverride !== "true") {
        daysField.step = "0.5";
        daysField.readOnly = true;
        daysField.value = calculated || "";
      }
    };
    [fromField, toField, dayTypeField, dayPartField].forEach((field) => field?.addEventListener("change", refreshHolidayTiming));
    dataFields.querySelector("[data-holiday-days-override]")?.addEventListener("click", () => {
      if (!daysField) return;
      daysField.dataset.holidayDaysOverride = "true";
      daysField.readOnly = false;
      daysField.focus();
    });
    refreshHolidayTiming();
  }

  if (collection !== "attendance") return;
  const statusField = dataFields.querySelector('[data-field="status"]');
  const categoryField = dataFields.querySelector('[data-field="category"]');
  const recoveryDateField = dataFields.querySelector('[data-field="recoveryDate"]')?.closest("label");
  const workplaceInjuryField = dataFields.querySelector('[data-field="workplaceInjury"]')?.closest("label");
  const incidentField = dataFields.querySelector('[data-field="workplaceIncident"]')?.closest("label");
  const returnToWorkField = dataFields.querySelector('[data-field="returnToWorkCompleted"]')?.closest("label");
  const setCategoryOptions = (options, fallback = "") => {
    if (!categoryField) return;
    const current = categoryField.value;
    const nextValue = options.includes(current) ? current : fallback;
    categoryField.innerHTML = `<option value="">-- Select --</option>${options.map((option) => `<option value="${escapeHtml(option)}" ${option === nextValue ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}`;
  };

  const refreshAbsenceFields = () => {
    const status = statusField?.value || "";
    if (status === "Holiday") {
      setCategoryOptions(["Annual Leave"], "Annual Leave");
    } else if (isSickCallStatus(status)) {
      setCategoryOptions(["Gastrointestinal (Vomiting/Diarrhoea)", "Respiratory / Chest", "Musculoskeletal / Physical Injury", "General Illness"], categoryField?.value || "General Illness");
    } else {
      setCategoryOptions(["General Illness", "Annual Leave", "Occupational Sick Leave / Industrial Injury"], categoryField?.value || "");
    }
    const selectedCategory = categoryField?.value || "";
    const isSick = isSickCallStatus(status);
    const isMusculoskeletal = selectedCategory === "Musculoskeletal / Physical Injury";
    const isOccupational = selectedCategory === "Occupational Sick Leave / Industrial Injury" || (isMusculoskeletal && dataFields.querySelector('[data-field="workplaceInjury"]')?.value === "Yes");
    if (recoveryDateField) {
      recoveryDateField.classList.toggle("field-required-attention", isSick && (selectedCategory === "Gastrointestinal (Vomiting/Diarrhoea)" || selectedCategory === "Respiratory / Chest"));
    }
    if (workplaceInjuryField) {
      workplaceInjuryField.classList.toggle("hidden", !isMusculoskeletal);
      workplaceInjuryField.classList.toggle("field-required-attention", isMusculoskeletal);
    }
    if (incidentField) {
      incidentField.classList.toggle("field-required-attention", isOccupational);
      incidentField.querySelector("textarea").placeholder = isOccupational
        ? "Add the internal incident log reference and brief management note. Do not record private medical detail."
        : "Management note only. Do not record private medical detail.";
    }
    if (returnToWorkField) {
      returnToWorkField.classList.toggle("field-required-attention", isSick);
    }
  };

  statusField?.addEventListener("change", refreshAbsenceFields);
  categoryField?.addEventListener("change", refreshAbsenceFields);
  dataFields.querySelector('[data-field="workplaceInjury"]')?.addEventListener("change", refreshAbsenceFields);
  refreshAbsenceFields();
}

function dateRangeValues(from, to) {
  if (!from || !to) return [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(localIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function isWorkingWeekday(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function workingDateRangeValues(from, to) {
  return dateRangeValues(from, to).filter(isWorkingWeekday);
}

function holidayCalculatedDays(item = {}) {
  const dates = workingDateRangeValues(item.from, item.to);
  if (!dates.length) return 0;
  return item.dayType === "Half day" && item.from === item.to ? 0.5 : dates.length;
}

const managedAttendanceTypes = [
  "Sick",
  "Late",
  "Absent",
  "Other Authorised Absence",
  "Unauthorised Absence"
];

function attendanceRecordId(record = {}) {
  return record.attendanceRecordId || record.id || "";
}

function generateAttendanceRecordId(staff = {}, startDate = today) {
  const stamp = String(startDate || today).replace(/-/g, "");
  const staffPart = String(staff.staffId || staff.name || "STAFF").replace(/[^A-Z0-9]+/gi, "").slice(-8).toUpperCase() || "STAFF";
  return `ATT-${stamp}-${staffPart}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
}

function attendanceType(record = {}) {
  return record.type || record.attendanceType || record.status || "";
}

function attendanceStart(record = {}) {
  return record.startDate || record.date || record.from || "";
}

function attendanceEnd(record = {}) {
  if (record.ongoing === true || record.ongoing === "Yes") return "";
  return record.endDate || record.to || record.date || record.startDate || "";
}

function attendanceIsVoid(record = {}) {
  return String(record.status || "").toLowerCase() === "void" || record.voided === true;
}

function attendanceIsOngoing(record = {}) {
  return record.ongoing === true || record.ongoing === "Yes";
}

function attendanceMatchesStaff(record = {}, staff = {}) {
  if (record.staffId && staff.staffId) return record.staffId === staff.staffId;
  return record.name && staff.name && record.name === staff.name;
}

function attendanceRecordYear(record = {}) {
  return String(record.year || attendanceStart(record) || attendanceEnd(record) || "").slice(0, 4);
}

function attendanceRecordAffectsYear(record = {}, year = String(new Date().getFullYear())) {
  const start = attendanceStart(record);
  const end = attendanceEnd(record) || start;
  const dates = workingDateRangeValues(start, end || start);
  return dates.some((date) => date.startsWith(String(year))) || attendanceRecordYear(record) === String(year);
}

function calculateAttendanceWorkingDays(record = {}, year = "") {
  if (attendanceIsVoid(record)) return 0;
  const type = attendanceType(record);
  if (type === "Late") return 0;
  const stored = Number(record.workingDays ?? record.days);
  if (Number.isFinite(stored) && stored >= 0 && (!year || String(attendanceStart(record)).startsWith(String(year)))) {
    return stored;
  }
  const start = attendanceStart(record);
  const end = attendanceIsOngoing(record) ? today : (attendanceEnd(record) || start);
  const dates = workingDateRangeValues(start, end).filter((date) => !year || date.startsWith(String(year)));
  if (!dates.length) return 0;
  if (record.dayType === "Half day" && start === end) return 0.5;
  return dates.length;
}

function attendanceDateLabel(record = {}) {
  const start = attendanceStart(record);
  const end = attendanceEnd(record);
  if (!start) return "Date not set";
  if (attendanceIsOngoing(record)) return `${formatDateUk(start)} to Ongoing`;
  if (end && end !== start) return `${formatDateUk(start)} to ${formatDateUk(end)}`;
  return formatDateUk(start);
}

function staffAttendanceRecords(staff, year = String(new Date().getFullYear()), includeVoid = true) {
  return attendanceRecords
    .filter((record) => attendanceMatchesStaff(record, staff))
    .filter((record) => attendanceRecordAffectsYear(record, year))
    .filter((record) => includeVoid || !attendanceIsVoid(record))
    .sort((a, b) => String(attendanceStart(b)).localeCompare(String(attendanceStart(a))));
}

function annualAttendanceSummary(staff, year = String(new Date().getFullYear())) {
  const rows = staffAttendanceRecords(staff, year, false);
  const byType = (type) => rows.filter((record) => attendanceType(record) === type);
  const sickRows = rows.filter((record) => isSickCallStatus(attendanceType(record)));
  return {
    year,
    sickDays: sickRows.reduce((sum, record) => sum + calculateAttendanceWorkingDays(record, year), 0),
    sicknessOccurrences: sickRows.length,
    lateOccurrences: byType("Late").length,
    absentDays: byType("Absent").reduce((sum, record) => sum + calculateAttendanceWorkingDays(record, year), 0),
    otherAuthorisedAbsenceDays: byType("Other Authorised Absence").reduce((sum, record) => sum + calculateAttendanceWorkingDays(record, year), 0),
    unauthorisedAbsenceDays: byType("Unauthorised Absence").reduce((sum, record) => sum + calculateAttendanceWorkingDays(record, year), 0)
  };
}

function attendanceAuditEntry(action, previousValues, newValues, reason = "") {
  return {
    action,
    by: currentUserName(),
    at: new Date().toISOString(),
    previousValues,
    newValues,
    reason
  };
}

function normaliseHolidayRequestTiming(item = {}) {
  const sameDay = item.from && item.to && item.from === item.to;
  if (item.dayType !== "Half day" || !sameDay) {
    item.dayType = "Full day";
    item.dayPart = "";
  } else if (!["AM", "PM"].includes(item.dayPart)) {
    item.dayPart = "AM";
  }
  const calculated = holidayCalculatedDays(item);
  if (item.dayType === "Half day") {
    item.days = 0.5;
  } else if (!Number(item.days)) {
    item.days = calculated;
  }
  return item;
}

function countConsecutiveOccupationalSickDays(name, dateValue) {
  if (!name || !dateValue) return 0;
  const recordDates = new Set(attendanceRecords
    .filter((record) => record.name === name && isSickCallStatus(record.status) && (record.category === "Occupational Sick Leave / Industrial Injury" || (record.category === "Musculoskeletal / Physical Injury" && record.workplaceInjury === "Yes")))
    .map((record) => record.date));
  recordDates.add(dateValue);

  const start = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  let count = 1;
  const check = new Date(start);
  check.setDate(check.getDate() - 1);
  while (recordDates.has(localIsoDate(check))) {
    count += 1;
    check.setDate(check.getDate() - 1);
  }
  check.setTime(start.getTime());
  check.setDate(check.getDate() + 1);
  while (recordDates.has(localIsoDate(check))) {
    count += 1;
    check.setDate(check.getDate() + 1);
  }
  return count;
}

async function validateAttendanceRecord(item) {
  if (["Holiday", "Sick", "Absent"].includes(item.status) && !item.category) {
    await kcInfo("Please choose an absence category before saving this absence.");
    return false;
  }
  if (item.status === "Absent - Called in Sick" && !item.category) {
    await kcInfo("Please choose a functional H&S category for this sick call-in.");
    return false;
  }
  if (item.category === "Annual Leave" && item.status !== "Holiday") {
    await kcInfo("Annual Leave must be recorded with the Holiday status.");
    return false;
  }
  if (isSickCallStatus(item.status) && item.category === "Annual Leave") {
    await kcInfo("Please choose one of the four functional H&S sick call-in categories, not Annual Leave.");
    return false;
  }
  if (isSickCallStatus(item.status) && item.category === "Gastrointestinal (Vomiting/Diarrhoea)" && !item.recoveryDate) {
    await kcInfo("Please enter the logged recovery / return date so the 48-hour food premises restriction can be applied.");
    return false;
  }
  if (isSickCallStatus(item.status) && item.category === "Respiratory / Chest" && !item.recoveryDate) {
    await kcInfo("Please enter the logged recovery / return date so the fitness-for-duty warning can be applied.");
    return false;
  }
  if (isSickCallStatus(item.status) && item.category === "Musculoskeletal / Physical Injury" && !item.workplaceInjury) {
    await kcInfo("Please confirm whether this injury was sustained during an onsite work activity for Kingswood.");
    return false;
  }
  if (item.category === "Musculoskeletal / Physical Injury" && item.workplaceInjury === "Yes" && !item.workplaceIncident) {
    await kcInfo("Please add the internal Incident Log reference for this onsite work injury.");
    return false;
  }
  if (item.category === "Occupational Sick Leave / Industrial Injury" && !item.workplaceIncident) {
    await kcInfo("Please confirm whether this illness/injury was caused by an onsite incident or chemical/biological exposure.");
    return false;
  }
  if (item.status === "Present") {
    const previousSick = attendanceRecords
      .filter((record) => record.name === item.name && record.status === "Sick" && record.date < item.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (previousSick && !item.returnToWorkCompleted) {
      await kcInfo("Return to Work Health Declaration Completed must be ticked before returning a sick employee to Present Today.");
      return false;
    }
  }
  if ((item.category === "Occupational Sick Leave / Industrial Injury" || (item.category === "Musculoskeletal / Physical Injury" && item.workplaceInjury === "Yes")) && countConsecutiveOccupationalSickDays(item.name, item.date) > 7) {
    await kcInfo("CRITICAL: Employee absent for >7 days due to workplace injury/illness. Evaluate if a RIDDOR notification to the HSE is required.");
  }
  return true;
}

async function validateJobTechnicianAvailability(item) {
  if (!item.technician || !item.date) return true;
  const attendance = attendanceFor(item.technician, item.date);
  if (isUnavailableStatus(attendance.status)) {
    await kcInfo(`${item.technician} is marked as ${attendance.status} on ${formatDateUk(item.date)} and cannot be allocated to this job.`);
    return false;
  }
  const restriction = activeSicknessRestrictionFor(item.technician, item.date);
  if (restriction?.type === "food-premises" && jobIsFoodPremises(item)) {
    await kcInfo(`${item.technician} is restricted from Food Premises, Commercial Kitchen and Catering work on ${formatDateUk(item.date)}.`);
    return false;
  }
  if (restriction?.type === "rpe-warning" && jobRequiresRpe(item)) {
    await kcInfo("Verify the operative is fully fit for the planned task before work commences.");
  }
  return true;
}

function plannerItemForJob(job) {
  const item = {
    date: job.date,
    technician: job.technician,
    session: job.slot || "AM",
    type: "Other",
    task: job.postcode || job.title || job.client || job.number || "JOB",
    source: "job-dispatch",
    jobNumber: job.number || "",
    jobId: job.id || ""
  };
  return applyPlannerMetadata(item);
}

function findPlannerSlot(item) {
  return weeklyPlanner.findIndex((slot) =>
    slot.date === item.date
    && slot.technician === item.technician
    && (slot.session || "AM") === (item.session || "AM")
  );
}

function approvedLeaveForTechnicianSlot(technician, date, session = "AM") {
  return approvedHolidayPlannerEntries(plannerWeekLabelFromStart(plannerWeekStartForDate(date)))
    .find((entry) => entry.technician === technician && entry.date === date && entry.session === session);
}

function setDataDialogStatus(message = "", type = "") {
  if (!dataDialogStatus) return;
  dataDialogStatus.textContent = message;
  dataDialogStatus.className = `dialog-status-message${type ? ` ${type}` : ""}`;
}

async function validateJobDispatchFields(item, sendingToTech) {
  const requiredFields = [
    ["date", "Date"],
    ["slot", "Job slot"],
    ["number", "Job reference number"],
    ["title", "Job title"],
    ["client", "Client"],
    ["mainClient", "Main Client"],
    ["address", "Address"],
    ["postcode", "Postcode"]
  ];
  if (sendingToTech) {
    requiredFields.push(["technician", "Technician"]);
  }
  const missing = requiredFields
    .filter(([key]) => !String(item[key] || "").trim())
    .map(([, label]) => label);
  if (item.slot && !["AM", "PM"].includes(item.slot)) {
    missing.push("Job slot must be AM or PM");
  }
  if (!missing.length) return true;
  const message = `Please complete before ${sendingToTech ? "sending to the tech app" : "saving"}:\n- ${missing.join("\n- ")}`;
  setDataDialogStatus(message.replace(/\n/g, " "), "error");
  await kcInfo(message);
  return false;
}

async function confirmSendJobToTech(item) {
  const lines = [
    "Send this job to the technician app?",
    "",
    `${formatDateUk(item.date)} ${item.slot}`,
    item.technician,
    item.address,
    item.postcode || item.title || item.client,
    "",
    "This will also update the Weekly Planner."
  ].filter((line) => line !== undefined && line !== null);
  return kcConfirmAction(lines.join("\n"), "Continue");
}

async function addJobToWeeklyPlanner(job) {
  if (!job.date || !job.technician || !job.slot) {
    await kcInfo("Please choose a date, technician and AM/PM job slot before sending to the tech app.");
    return false;
  }
  const plannerItem = plannerItemForJob(job);
  const approvedLeave = approvedLeaveForTechnicianSlot(job.technician, job.date, job.slot || "AM");
  if (approvedLeave) {
    const decision = await kcAsk({
      message: `${job.technician} is on approved annual leave on ${formatDateUk(job.date)} for the ${job.slot || "AM"} slot.\n\nYou can continue if this is operationally necessary, but the Weekly Planner will show a leave/job conflict for office review.`,
      buttons: [
        { label: "Cancel", value: "cancel", style: "secondary" },
        { label: "Continue", value: "continue", style: "primary" }
      ]
    });
    if (decision !== "continue") {
      await kcInfo("Job not sent. Choose another technician or slot, then press Send to Tech App again.");
      return false;
    }
  }
  weeklyPlanner = weeklyPlanner.filter((slot) => !(slot.source === "job-dispatch" && slot.jobNumber && slot.jobNumber === plannerItem.jobNumber));
  const existingIndex = findPlannerSlot(plannerItem);
  if (existingIndex >= 0) {
    const existing = weeklyPlanner[existingIndex];
    const overwrite = await kcAsk({
      message: `${job.technician} already has this ${job.slot} slot booked on ${formatDateUk(job.date)}:\n\n${plannerText(existing)}\n\nDo you want to overwrite this planner slot?`,
      buttons: [
        { label: "Cancel", value: "cancel", style: "secondary" },
        { label: "Overwrite", value: "overwrite", style: "danger" }
      ]
    });
    if (overwrite === "overwrite") {
      weeklyPlanner[existingIndex] = plannerItem;
    } else {
      await kcInfo("Job not sent. Choose another date, technician or AM/PM slot, then press Send to Tech App again.");
      return false;
    }
  } else {
    weeklyPlanner.unshift(plannerItem);
  }
  activePlannerWeek = plannerItem.week;
  return true;
}

function normaliseJobDispatchStatus(value = "") {
  const status = String(value || "").toLowerCase();
  if (status.includes("withdrawal acknowledged")) return "Withdrawal acknowledged";
  if (status.includes("withdrawal") || status.includes("withdrawn")) return "Withdrawal sent";
  if (status.includes("cancellation acknowledged")) return "Cancellation acknowledged";
  if (status.includes("cancellation") || status.includes("cancel")) return "Cancellation sent";
  if (status.includes("change acknowledged")) return "Change acknowledged";
  if (status.includes("change") || status.includes("changed")) return "Change sent";
  if (status.includes("unable")) return "Unable";
  if (status.includes("accept") || status.includes("acknowledged")) return "Accepted";
  if (status.includes("sent") || status.includes("received") || status.includes("available")) return "Sent to Technician App";
  return value || "Not sent";
}

function applyJobDispatchMetadata(job, event = "Sent to Technician App", reason = "") {
  if (!job) return job;
  const now = new Date().toISOString();
  const currentVersion = Number(job.dispatchVersion || 0);
  const version = currentVersion || 1;
  const staffId = staffIdFromName(job.technician);
  job.assignedStaffId = job.assignedStaffId || staffId;
  job.sentToTech = true;
  job.publishedToTech = true;
  job.status = "Sent to Tech";
  job.dispatchStatus = normaliseJobDispatchStatus(event);
  job.deliveryStatus = job.dispatchStatus;
  job.dispatchVersion = version;
  job.dispatchSentAt = job.dispatchSentAt || job.sentToTechAt || now;
  job.sentToTechAt = job.sentToTechAt || job.dispatchSentAt;
  const history = Array.isArray(job.dispatchHistory) ? job.dispatchHistory : [];
  if (!history.some((item) => item.event === "Dispatch Created" && Number(item.version || 0) === version)) {
    history.push({
      event: "Dispatch Created",
      version,
      at: now,
      by: currentUserName(),
      reason
    });
  }
  job.dispatchHistory = history;
  return job;
}

const jobDispatchMaterialFields = ["date", "slot", "number", "title", "client", "mainClient", "address", "postcode", "residentPhone", "technician", "jobDetails", "reportNotes", "photos"];

const jobDispatchMaterialLabels = {
  date: "Work date",
  slot: "Appointment slot",
  number: "Job reference",
  title: "Work category",
  client: "Client",
  mainClient: "Client group",
  address: "Address",
  postcode: "Postcode",
  residentPhone: "Contact telephone",
  technician: "Technician",
  jobDetails: "Work description",
  reportNotes: "Reporting requirements",
  photos: "Attachments"
};

function jobDispatchIsSent(job = {}) {
  const status = String(job.dispatchStatus || job.deliveryStatus || job.status || "").toLowerCase();
  return Boolean(job.sentToTech || job.publishedToTech)
    || ["sent", "received", "acknowledged", "accepted", "unable"].some((state) => status.includes(state));
}

function jobDispatchHasMaterialChange(previousItem = {}, nextItem = {}) {
  if (!previousItem || !nextItem || !jobDispatchIsSent(previousItem)) return false;
  return jobDispatchMaterialFields.some((field) => String(previousItem[field] ?? "") !== String(nextItem[field] ?? ""));
}

function jobDispatchHasTechnicianChange(previousItem = {}, nextItem = {}) {
  if (!previousItem || !nextItem || !jobDispatchIsSent(previousItem)) return false;
  return String(previousItem.technician ?? "") !== String(nextItem.technician ?? "")
    || String(previousItem.assignedStaffId ?? "") !== String(nextItem.assignedStaffId ?? "")
    || String(previousItem.assignedTechnicianId ?? "") !== String(nextItem.assignedTechnicianId ?? "");
}

function jobDispatchMaterialChanges(previousItem = {}, nextItem = {}) {
  if (!previousItem || !nextItem) return [];
  return jobDispatchMaterialFields
    .filter((field) => String(previousItem[field] ?? "") !== String(nextItem[field] ?? ""))
    .map((field) => ({
      field,
      label: jobDispatchMaterialLabels[field] || field,
      previous: String(previousItem[field] ?? "").slice(0, 140),
      next: String(nextItem[field] ?? "").slice(0, 140)
    }));
}

function dispatchJobsForDate(dateValue) {
  return jobs.filter((job) => String(job.date || job.jobDate || "") === dateValue && String(job.technician || "").trim());
}

function dispatchStatusTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function plannerDispatchResultsHtml(rows = []) {
  if (!rows.length) return '<p class="empty-state compact-empty">No sent job instructions for this week yet.</p>';
  return `
    <div class="planner-dispatch-header">
      <span>Technician / job</span>
      <span>Sent</span>
      <span>Available</span>
      <span>Technician response</span>
      <span>Status</span>
      <span>Actions</span>
    </div>
    ${rows.map((job) => `
      <div class="planner-dispatch-row">
        <div><strong>${escapeHtml(job.technician || "Technician")}</strong><br><span>${escapeHtml(job.number || job.title || job.address || "Job")}</span></div>
        <span>${escapeHtml(dispatchStatusTime(job.dispatchSentAt || job.sentToTechAt))}</span>
        <span>${escapeHtml(dispatchStatusTime(job.dispatchAvailableAt || job.dispatchReceivedAt))}</span>
        <span>${escapeHtml(job.technicianUnableReason ? `Unable: ${job.technicianUnableReason}` : job.technicianAcceptedAt || job.dispatchAcknowledgedAt ? `Accepted ${dispatchStatusTime(job.technicianAcceptedAt || job.dispatchAcknowledgedAt)}` : "-")}</span>
        <span class="status ${job.technicianUnableAt ? "warning" : job.technicianAcceptedAt || job.dispatchAcknowledgedAt ? "ok" : "sent-tech"}">${escapeHtml(job.technicianUnableAt ? "Unable: reason supplied" : normaliseJobDispatchStatus(job.dispatchStatus || "Sent to Technician App"))}</span>
        <span class="record-actions">
          <button class="secondary-button" type="button" data-job-dispatch-change="${escapeHtml(job.jobId || job.id || job.number || "")}">Mark changed</button>
          <button class="danger-button" type="button" data-job-dispatch-cancel="${escapeHtml(job.jobId || job.id || job.number || "")}">Cancel</button>
        </span>
      </div>
    `).join("")}
  `;
}

function renderPlannerDispatchResults(selectedWeek = activePlannerWeek || plannerCurrentWeek()) {
  const panel = document.querySelector("#plannerDispatchResults");
  if (!panel) return;
  const selectedWeekStart = plannerWeekStartFromLabel(selectedWeek);
  const weekDates = new Set(plannerWeekDays(selectedWeekStart).map((day) => day.date));
  const rows = jobs
    .filter((job) => (job.sentToTech || job.publishedToTech || job.dispatchStatus) && weekDates.has(String(job.date || job.jobDate || "")))
    .sort((a, b) => `${a.date || ""}${a.slot || ""}${a.technician || ""}`.localeCompare(`${b.date || ""}${b.slot || ""}${b.technician || ""}`));
  panel.hidden = false;
  panel.innerHTML = `
    <div class="panel-heading compact-heading">
      <div>
        <h3>Technician Delivery Results</h3>
        <p class="panel-note">Sent instructions and deliberate technician responses for this week.</p>
      </div>
    </div>
    ${plannerDispatchResultsHtml(rows)}
  `;
}

async function dispatchJobsViaHelper(payload) {
  const response = await fetch("/api/phase-07/jobs/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      officeUserName: currentUserName()
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || "Job dispatch could not be saved.");
  return result;
}

async function sendJobChangeViaHelper(previousItem, item, reason) {
  const response = await fetch("/api/phase-07/jobs/change", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: previousItem.jobId || previousItem.id || previousItem.number,
      baseVersion: Number(previousItem.dispatchVersion || 1),
      reason,
      previousJob: previousItem,
      updatedJob: item,
      officeUserName: currentUserName()
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || "Job change could not be saved.");
  return result;
}

async function cancelJobViaHelper(job, reason) {
  const response = await fetch("/api/phase-07/jobs/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: job.jobId || job.id || job.number,
      baseVersion: Number(job.dispatchVersion || 1),
      reason,
      officeUserName: currentUserName()
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || "Job cancellation could not be saved.");
  return result;
}

async function reassignJobViaHelper(previousItem, item, reason) {
  const response = await fetch("/api/phase-07/jobs/reassign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: previousItem.jobId || previousItem.id || previousItem.number,
      baseVersion: Number(previousItem.dispatchVersion || 1),
      toStaffId: item.assignedStaffId || staffIdFromName(item.technician),
      toTechnicianName: item.technician,
      reason,
      officeUserName: currentUserName()
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || "Job reassignment failed.");
  return result;
}

function findJobByDispatchId(jobId = "") {
  const target = String(jobId || "");
  return jobs.find((job) => String(job.jobId || job.id || job.number || "") === target) || null;
}

async function markJobDispatchChanged(jobId) {
  const job = findJobByDispatchId(jobId);
  if (!job) return;
  await kcInfo("Open the job record and edit the changed details. The Hub will ask for a change reason before sending the amended version.");
}

async function cancelJobDispatch(jobId) {
  const job = findJobByDispatchId(jobId);
  if (!job) return;
  const reason = await kcInput("Why is this dispatched job being cancelled?", "Cancellation reason", "");
  if (!reason || reason === "cancel") return;
  const confirmed = await kcConfirmAction(`Cancel this dispatched job?\n\n${job.technician || "Technician"}\n${formatDateUk(job.date)} ${job.slot || ""}\n${job.client || ""}\n${job.address || job.postcode || ""}\n\nReason: ${reason}`, "Cancel Job");
  if (!confirmed) return;
  try {
    await cancelJobViaHelper(job, String(reason));
    await loadCommandData();
    render();
    await kcInfo("Cancellation sent to the Technician App.");
  } catch (error) {
    await kcInfo(error.message || "Job cancellation failed. No cancellation status has been applied.");
  }
}

async function sendScheduleToTechnicians(dateValue, label) {
  const scheduleJobs = dispatchJobsForDate(dateValue);
  const scheduleJobIds = scheduleJobs.map((job) => job.jobId || job.id || job.number).filter(Boolean);
  const existingSchedules = jobDispatchSchedules.filter((schedule) => schedule.date === dateValue || schedule.workDate === dateValue);
  const previousJobIds = Array.from(new Set(existingSchedules.flatMap((schedule) => Array.isArray(schedule.jobIds) ? schedule.jobIds : [])));
  const replacingSchedule = existingSchedules.length > 0;
  const clientList = Array.from(new Set(scheduleJobs.map((job) => job.client || job.mainClient || "Client not set"))).slice(0, 5).join(", ");
  let replacementReason = "";
  if (replacingSchedule) {
    replacementReason = await kcInput(`Why is ${label}'s sent schedule being replaced?`, "Replacement reason", "");
    if (!replacementReason || replacementReason === "cancel") return false;
  }
  const addedCount = scheduleJobIds.filter((jobId) => !previousJobIds.includes(jobId)).length;
  const removedCount = previousJobIds.filter((jobId) => !scheduleJobIds.includes(jobId)).length;
  const confirmed = await kcConfirmAction(replacingSchedule
    ? `Replace ${label}'s sent schedule?\n\nPrevious sent jobs: ${previousJobIds.length}\nReplacement jobs: ${scheduleJobIds.length}\nAdded: ${addedCount}\nRemoved: ${removedCount}\n\nReason: ${replacementReason}\n\nWithdrawn jobs will require technician acknowledgement. Added or changed jobs will create fresh Technician App actions.`
    : `Send ${label}'s assigned schedule to technicians?\n\n${scheduleJobs.length} job instruction${scheduleJobs.length === 1 ? "" : "s"} will be made visible in the Technician App.${clientList ? `\nClients: ${clientList}` : "\nThis will record an explicit empty schedule if no jobs are assigned."}`, replacingSchedule ? "Replace Schedule" : "Send Schedule");
  if (!confirmed) return false;
  try {
    const result = await dispatchJobsViaHelper(replacingSchedule
      ? { mode: "replacement", date: dateValue, replaceSchedule: true, reason: replacementReason, jobIds: scheduleJobIds }
      : { mode: "schedule", date: dateValue });
    await loadCommandData();
    render();
    await kcInfo(replacingSchedule
      ? `${label}'s replacement schedule sent to the Technician App.`
      : result.alreadySent
      ? `${label}'s schedule was already sent. No duplicate dispatch was created.`
      : `${label}'s schedule sent to the Technician App.`);
    return true;
  } catch (error) {
    await kcInfo(error.message || "Schedule dispatch failed. No sent status has been applied.");
    return false;
  }
}

function removeJobFromWeeklyPlanner(job) {
  if (!job?.number) return;
  weeklyPlanner = weeklyPlanner.filter((slot) => !(slot.source === "job-dispatch" && slot.jobNumber === job.number));
}

function applyApprovedHolidayRequest(request) {
  if (request.status !== "Approved") return;
  normaliseHolidayRequestTiming(request);
  const requestId = request.id || request.holidayRequestId || "";
  workingDateRangeValues(request.from, request.to).forEach((date) => {
    const existing = attendanceRecords.find((record) => record.name === request.name && record.date === date);
    const holidayRecord = {
      date,
      name: request.name,
      status: "Holiday",
      category: "Annual Leave",
      dayType: request.dayType || "Full day",
      dayPart: request.dayPart || "",
      days: request.dayType === "Half day" ? 0.5 : 1,
      returnToWorkCompleted: false,
      returnToWorkNotes: "Approved annual leave.",
      fitNote: "",
      source: "holiday",
      holidayRequestId: requestId
    };
    if (existing) Object.assign(existing, holidayRecord);
    else attendanceRecords.push(holidayRecord);
  });
}

function addApprovedHolidayToPlanner(request) {
  // Approved leave is derived into the Weekly Planner at render time from
  // holidayRequests. This legacy hook remains intentionally empty so the
  // approval workflow keeps calling the same function without creating
  // duplicate planner availability records.
  void request;
}

function staffRecordForNotification(staffId = "", name = "") {
  return staffProfiles.find((staff) => staffId && staff.staffId === staffId)
    || staffProfiles.find((staff) => name && staff.name === name)
    || {};
}

function staffNotificationId(type = "NOTE", relatedEntityId = "") {
  const safeType = String(type || "NOTE").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 10) || "NOTE";
  const source = relatedEntityId || `${safeType}-${Date.now()}-${Math.random()}`;
  let hash = 0;
  String(source).split("").forEach((char) => {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  });
  return `NOT-${safeType}-${Math.abs(hash).toString(36).toUpperCase()}`;
}

function addStaffNotification({
  type,
  title,
  message,
  staffId = "",
  name = "",
  relatedEntityType = "",
  relatedEntityId = "",
  status = ""
}) {
  const staff = staffRecordForNotification(staffId, name);
  const resolvedStaffId = staffId || staff.staffId || "";
  const resolvedName = name || staff.name || "Employee";
  const notification = {
    notificationId: staffNotificationId(type, relatedEntityId || `${resolvedStaffId}-${title}-${message}`),
    type: type || "Information",
    title: title || "Staff update",
    message: message || "",
    createdAt: new Date().toISOString(),
    readAt: "",
    status: status || "Unread",
    staffId: resolvedStaffId,
    name: resolvedName,
    employee: resolvedName,
    relatedEntityType,
    relatedEntityId
  };
  if (!staffNotifications.some((item) => item.notificationId === notification.notificationId)) {
    staffNotifications.unshift(notification);
  }
  return notification;
}

function staffNotificationStatusClass(status = "") {
  const normalised = String(status || "").toLowerCase();
  if (normalised.includes("approved")) return "approved";
  if (normalised.includes("declined") || normalised.includes("void") || normalised.includes("unauthorised")) return "declined";
  if (normalised.includes("pending") || normalised.includes("ongoing") || normalised.includes("late")) return "pending";
  if (normalised.includes("sick") || normalised.includes("absent")) return "declined";
  if (normalised.includes("cancel")) return "cancelled";
  return "approved";
}

function staffNotificationTime(value = "") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderStaffActivityNotifications() {
  const target = document.querySelector("#staffActivityNotifications");
  if (!target) return;
  const items = staffNotifications
    .filter((item) => ["Holiday Request Submitted", "Holiday Approved", "Holiday Declined", "Attendance Record Added", "Attendance Record Corrected"].includes(item.type))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 6);
  target.innerHTML = items.length ? items.map((item) => `
    <button class="staff-activity-item" type="button" data-open-staff-notification="${escapeHtml(item.notificationId)}">
      <span class="staff-activity-time">${escapeHtml(staffNotificationTime(item.createdAt))}</span>
      <span class="staff-activity-main">
        <strong>${escapeHtml(item.name || item.employee || "Employee")}</strong>
        <em>${escapeHtml(item.title || item.type)}</em>
      </span>
      <span class="holiday-status ${staffNotificationStatusClass(item.status || item.type)}">${escapeHtml(item.status || "Unread")}</span>
    </button>
  `).join("") : '<p class="empty-state compact-empty">No recent leave or attendance activity.</p>';
}

function openStaffNotification(notificationId) {
  const item = staffNotifications.find((notification) => notification.notificationId === notificationId);
  if (!item) return;
  const staffIndex = staffProfiles.findIndex((staff) =>
    (item.staffId && staff.staffId === item.staffId) || (item.name && staff.name === item.name)
  );
  if (staffIndex >= 0) selectedStaffIndex = staffIndex;
  activeStaffTab = item.relatedEntityType === "AttendanceRecord" ? "attendance" : "holidays";
  showSection("staff");
  renderStaff();
  setTimeout(() => document.querySelector("#staffProfileTabBody")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
}

async function approveHolidayRequest(index) {
  const request = holidayRequests[Number(index)];
  if (!request) return;
  if (request.status !== "Pending") {
    await kcInfo(`This holiday request is already ${request.status || "not pending"} and cannot be changed.`);
    return;
  }
  const response = await kcInput("Add an optional response to the technician for approving this holiday request.", "Office response");
  if (response === "cancel") return;
  const previousRequest = { ...request };
  const previousPlanner = [...weeklyPlanner];
  const previousNotifications = [...staffNotifications];
  const previousStatus = request.status || "Pending";
  const decisionAt = new Date().toISOString();
  request.status = "Approved";
  request.approvedBy = currentUserName();
  request.approvedDate = today;
  request.decisionDateTime = decisionAt;
  request.officeResponse = response || "";
  request.declineReason = "";
  request.workingDays = request.workingDays || request.days || holidayCalculatedDays(request);
  request.days = request.workingDays;
  request.year = request.year || String(new Date(request.from || today).getFullYear());
  request.auditTrail = [
    ...(Array.isArray(request.auditTrail) ? request.auditTrail : []),
    {
      action: "Approved",
      by: currentUserName(),
      at: decisionAt,
      previousStatus,
      newStatus: "Approved",
      officeResponse: request.officeResponse
    }
  ];
  addApprovedHolidayToPlanner(request);
  addStaffNotification({
    type: "Holiday Approved",
    title: "Holiday approved",
    message: `${request.name} leave approved for ${formatDateUk(request.from)} to ${formatDateUk(request.to || request.from)}.`,
    staffId: request.staffId || "",
    name: request.name,
    relatedEntityType: "HolidayRequest",
    relatedEntityId: request.holidayRequestId || request.id || "",
    status: "Approved"
  });
  const saved = await publishIntegrationFeeds();
  if (!saved) {
    Object.assign(request, previousRequest);
    weeklyPlanner = previousPlanner;
    staffNotifications = previousNotifications;
    render();
    return;
  }
  render();
  await kcInfo("Holiday request approved. Staff records, Weekly Planner and technician feed have been updated.");
}

async function declineHolidayRequest(index) {
  const request = holidayRequests[Number(index)];
  if (!request) return;
  if (request.status !== "Pending") {
    await kcInfo(`This holiday request is already ${request.status || "not pending"} and cannot be changed.`);
    return;
  }
  const response = await kcInput("Add an optional response to the technician for declining this holiday request.", "Office response");
  if (response === "cancel") return;
  const previousRequest = { ...request };
  const previousNotifications = [...staffNotifications];
  const previousStatus = request.status || "Pending";
  const decisionAt = new Date().toISOString();
  request.status = "Declined";
  request.declinedBy = currentUserName();
  request.declinedDate = today;
  request.decisionDateTime = decisionAt;
  request.officeResponse = response || "";
  request.declineReason = response || "";
  request.workingDays = request.workingDays || request.days || holidayCalculatedDays(request);
  request.days = request.workingDays;
  request.year = request.year || String(new Date(request.from || today).getFullYear());
  request.auditTrail = [
    ...(Array.isArray(request.auditTrail) ? request.auditTrail : []),
    {
      action: "Declined",
      by: currentUserName(),
      at: decisionAt,
      previousStatus,
      newStatus: "Declined",
      officeResponse: request.officeResponse
    }
  ];
  addStaffNotification({
    type: "Holiday Declined",
    title: "Holiday declined",
    message: `${request.name} leave declined for ${formatDateUk(request.from)} to ${formatDateUk(request.to || request.from)}.`,
    staffId: request.staffId || "",
    name: request.name,
    relatedEntityType: "HolidayRequest",
    relatedEntityId: request.holidayRequestId || request.id || "",
    status: "Declined"
  });
  const saved = await publishIntegrationFeeds();
  if (!saved) {
    Object.assign(request, previousRequest);
    staffNotifications = previousNotifications;
    render();
    return;
  }
  render();
  await kcInfo("Holiday request declined. No holiday has been deducted and the Weekly Planner has not been changed.");
}

function refreshSickCallDialog() {
  const category = sickCallCategory?.value || "";
  const isInjury = category === "Musculoskeletal / Physical Injury";
  sickCallInjuryWrap?.classList.toggle("hidden", !isInjury);
  sickCallIncidentWrap?.classList.toggle("hidden", !(isInjury && sickCallWorkInjury?.value === "Yes"));
}

function openSickCallDialog(name) {
  if (!sickCallDialog || !sickCallForm) return;
  sickCallForm.reset();
  sickCallName.value = name;
  sickCallTitle.textContent = `${name} - Sick Call-In`;
  refreshSickCallDialog();
  sickCallDialog.showModal();
}

async function saveSickCallIn() {
  const name = sickCallName?.value || "";
  const category = sickCallCategory?.value || "";
  const workplaceInjury = sickCallWorkInjury?.value || "";
  const workplaceIncident = sickCallIncidentNote?.value.trim() || "";
  if (!name || !category) {
    await kcInfo("Please choose a symptom category.");
    return false;
  }
  if (category === "Musculoskeletal / Physical Injury" && !workplaceInjury) {
    await kcInfo("Please confirm whether this injury was sustained during an onsite work activity for Kingswood.");
    return false;
  }
  if (category === "Musculoskeletal / Physical Injury" && workplaceInjury === "Yes" && !workplaceIncident) {
    await kcInfo("Please add the internal Incident Log reference.");
    return false;
  }

  const item = {
    date: today,
    name,
    status: "Absent - Called in Sick",
    category,
    recoveryDate: category === "Gastrointestinal (Vomiting/Diarrhoea)" || category === "Respiratory / Chest" ? today : "",
    workplaceInjury: category === "Musculoskeletal / Physical Injury" ? workplaceInjury : "",
    workplaceIncident: category === "Musculoskeletal / Physical Injury" ? workplaceIncident : "",
    returnToWorkCompleted: false,
    returnToWorkNotes: "Sick call-in logged from Attendance Today.",
    fitNote: "",
    source: "attendance-today"
  };

  if (!(await validateAttendanceRecord(item))) return false;
  const existingIndex = attendanceRecords.findIndex((record) => record.name === name && record.date === today);
  if (existingIndex >= 0) attendanceRecords[existingIndex] = { ...attendanceRecords[existingIndex], ...item };
  else attendanceRecords.unshift(item);
  const staff = staffRecordForNotification("", name);
  addStaffNotification({
    type: existingIndex >= 0 ? "Attendance Record Corrected" : "Attendance Record Added",
    title: existingIndex >= 0 ? "Attendance corrected" : "Attendance recorded",
    message: `${name} marked as Absent - Called in Sick.`,
    staffId: staff.staffId || "",
    name,
    relatedEntityType: "AttendanceRecord",
    relatedEntityId: item.attendanceRecordId || `${name}-${today}`,
    status: item.status
  });
  await publishIntegrationFeeds();
  render();
  return true;
}

function refreshAttendanceDialog() {
  if (!attendanceTypeInput || !attendanceDialog) return;
  const type = attendanceTypeInput.value;
  const isLate = type === "Late";
  const isSick = type === "Sick";
  const isOngoing = attendanceOngoingInput?.value === "Yes";
  attendanceDialog.querySelectorAll(".attendance-range-field, .attendance-return-field, .attendance-day-field, .attendance-days-field")
    .forEach((field) => field.classList.toggle("hidden", isLate));
  attendanceDialog.querySelectorAll(".attendance-late-field")
    .forEach((field) => field.classList.toggle("hidden", !isLate));
  attendanceDialog.querySelectorAll(".attendance-ongoing-field")
    .forEach((field) => field.classList.toggle("hidden", !isSick));
  if (attendanceEndDate) attendanceEndDate.disabled = isLate || isOngoing;
  if (attendanceReturnDate) attendanceReturnDate.disabled = isLate || isOngoing;
  if (isLate && attendanceWorkingDays) attendanceWorkingDays.value = "0";
  if (!isLate) refreshAttendanceWorkingDays();
}

function refreshAttendanceWorkingDays() {
  if (!attendanceWorkingDays || !attendanceStartDate) return;
  const type = attendanceTypeInput?.value || "";
  if (type === "Late") {
    attendanceWorkingDays.value = "0";
    return;
  }
  const start = attendanceStartDate.value;
  const end = attendanceOngoingInput?.value === "Yes" ? today : (attendanceEndDate?.value || start);
  const dates = workingDateRangeValues(start, end || start);
  const days = attendanceDayType?.value === "Half day" && start === end ? 0.5 : dates.length;
  attendanceWorkingDays.value = String(days || 0);
}

function attendanceFormWorkingDaysFromFields(type, start, end, dayType) {
  if (type === "Late") return 0;
  const dates = workingDateRangeValues(start, end || start);
  if (!dates.length) return 0;
  return dayType === "Half day" && start === end ? 0.5 : dates.length;
}

function openAttendanceDialog(staffName, recordIndex = "") {
  if (!attendanceDialog || !attendanceForm) return;
  const staff = staffProfiles.find((item) => item.name === staffName) || {};
  const existing = recordIndex === "" ? null : attendanceRecords[Number(recordIndex)];
  const record = existing || {
    name: staffName,
    staffId: staff.staffId || "",
    type: "Sick",
    status: "Sick",
    startDate: today,
    date: today,
    endDate: today,
    returnDate: "",
    ongoing: false,
    dayType: "Full day",
    workingDays: 1,
    officeNotes: "",
    confidentialNote: false
  };

  attendanceForm.reset();
  attendanceRecordIndex.value = recordIndex;
  attendanceStaffName.value = staffName;
  attendanceEmployeeDisplay.value = staffName;
  attendanceDialogTitle.textContent = recordIndex === "" ? `Log Attendance - ${staffName}` : `Correct Attendance - ${staffName}`;
  attendanceTypeInput.value = attendanceType(record) || "Sick";
  attendanceStartDate.value = attendanceStart(record) || today;
  attendanceEndDate.value = attendanceEnd(record) || attendanceStartDate.value;
  attendanceOngoingInput.value = attendanceIsOngoing(record) ? "Yes" : "No";
  attendanceReturnDate.value = record.returnDate || record.recoveryDate || "";
  attendanceDayType.value = record.dayType || (record.halfDay ? "Half day" : "Full day");
  attendanceWorkingDays.value = String(calculateAttendanceWorkingDays(record) || 0);
  attendanceScheduledStart.value = record.scheduledStartTime || "";
  attendanceActualArrival.value = record.actualArrivalTime || "";
  attendanceMinutesLate.value = record.minutesLate || "";
  attendanceOfficeNote.value = record.officeNotes || record.returnToWorkNotes || record.notes || "";
  attendanceConfidentialNote.value = record.confidentialNote || record.confidential ? "Yes" : "No";
  attendanceCorrectionReason.value = "";
  attendanceCorrectionReasonWrap?.classList.toggle("hidden", recordIndex === "");
  attendanceVoidButton?.classList.toggle("hidden", recordIndex === "" || attendanceIsVoid(record));
  attendanceSaveButton.textContent = recordIndex === "" ? "Save Attendance" : (attendanceIsOngoing(record) ? "Save / Close Sickness" : "Save Correction");
  refreshAttendanceDialog();
  attendanceDialog.showModal();
}

function attendanceFormRecordFromFields(previous = null) {
  const staffName = attendanceStaffName?.value || "";
  const staff = staffProfiles.find((item) => item.name === staffName) || {};
  const type = attendanceTypeInput?.value || "Sick";
  const start = attendanceStartDate?.value || today;
  const ongoing = type === "Sick" && attendanceOngoingInput?.value === "Yes";
  const end = type === "Late" || ongoing ? "" : (attendanceEndDate?.value || start);
  const dayType = type === "Late" ? "Partial day" : (attendanceDayType?.value || "Full day");
  const workingDays = attendanceFormWorkingDaysFromFields(type, start, ongoing ? today : (end || start), dayType);
  const now = new Date().toISOString();
  const id = attendanceRecordId(previous || {}) || generateAttendanceRecordId(staff, start);
  return {
    ...(previous || {}),
    attendanceRecordId: id,
    id,
    staffId: staff.staffId || previous?.staffId || "",
    name: staffName,
    type,
    status: type,
    date: start,
    startDate: start,
    endDate: end,
    returnDate: type === "Sick" && !ongoing ? (attendanceReturnDate?.value || "") : "",
    recoveryDate: type === "Sick" && !ongoing ? (attendanceReturnDate?.value || end || start) : "",
    ongoing,
    dayType,
    workingDays,
    days: workingDays,
    scheduledStartTime: type === "Late" ? (attendanceScheduledStart?.value || "") : "",
    actualArrivalTime: type === "Late" ? (attendanceActualArrival?.value || "") : "",
    minutesLate: type === "Late" ? Number(attendanceMinutesLate?.value || 0) : 0,
    officeNotes: attendanceOfficeNote?.value.trim() || "",
    confidentialNote: attendanceConfidentialNote?.value === "Yes",
    recordedBy: previous?.recordedBy || currentUserName(),
    recordedAt: previous?.recordedAt || now,
    updatedBy: currentUserName(),
    updatedAt: now,
    year: String(new Date(`${start}T00:00:00`).getFullYear()),
    source: previous?.source || "office-attendance"
  };
}

async function saveAttendanceDialog(action = "default") {
  const index = attendanceRecordIndex?.value || "";
  const previous = index === "" ? null : attendanceRecords[Number(index)];
  const previousNotifications = [...staffNotifications];
  if (action === "void" && !previous) return false;
  const reason = attendanceCorrectionReason?.value.trim() || "";
  if (previous && !reason) {
    await kcInfo("Please enter a reason so the correction audit trail is complete.");
    return false;
  }

  if (action === "void") {
    const next = {
      ...previous,
      status: "Void",
      voided: true,
      voidedBy: currentUserName(),
      voidedAt: new Date().toISOString(),
      updatedBy: currentUserName(),
      updatedAt: new Date().toISOString(),
      auditTrail: [
        ...(Array.isArray(previous.auditTrail) ? previous.auditTrail : []),
        attendanceAuditEntry("Void", { status: previous.status, voided: previous.voided || false }, { status: "Void", voided: true }, reason)
      ]
    };
    attendanceRecords[Number(index)] = next;
    addStaffNotification({
      type: "Attendance Record Corrected",
      title: "Attendance corrected",
      message: `${next.name} attendance record was voided.`,
      staffId: next.staffId || "",
      name: next.name,
      relatedEntityType: "AttendanceRecord",
      relatedEntityId: attendanceRecordId(next),
      status: "Void"
    });
  } else {
    const next = attendanceFormRecordFromFields(previous);
    if (!next.name || !next.startDate) {
      await kcInfo("Please complete the employee and date before saving attendance.");
      return false;
    }
    if (!managedAttendanceTypes.includes(next.type)) {
      await kcInfo("Please choose a supported attendance type.");
      return false;
    }
    if (next.type !== "Late" && !next.ongoing && next.endDate && next.endDate < next.startDate) {
      await kcInfo("End date cannot be before the start date.");
      return false;
    }
    if (next.type !== "Late" && Number(next.workingDays) <= 0) {
      await kcInfo("Attendance must affect at least one working day, or half a working day.");
      return false;
    }
    const previousSnapshot = previous ? {
      type: previous.type || previous.status,
      startDate: previous.startDate || previous.date,
      endDate: previous.endDate || previous.to,
      returnDate: previous.returnDate || previous.recoveryDate,
      dayType: previous.dayType,
      workingDays: previous.workingDays,
      minutesLate: previous.minutesLate,
      officeNotes: previous.officeNotes || previous.returnToWorkNotes,
      confidentialNote: previous.confidentialNote
    } : null;
    const newSnapshot = {
      type: next.type,
      startDate: next.startDate,
      endDate: next.endDate,
      returnDate: next.returnDate,
      dayType: next.dayType,
      workingDays: next.workingDays,
      minutesLate: next.minutesLate,
      officeNotes: next.officeNotes,
      confidentialNote: next.confidentialNote
    };
    next.auditTrail = [
      ...(Array.isArray(previous?.auditTrail) ? previous.auditTrail : []),
      attendanceAuditEntry(previous ? (previous.ongoing && !next.ongoing ? "Closed Ongoing Sickness" : "Corrected") : "Created", previousSnapshot, newSnapshot, reason)
    ];
    if (index === "") attendanceRecords.unshift(next);
    else attendanceRecords[Number(index)] = next;
    addStaffNotification({
      type: previous ? "Attendance Record Corrected" : "Attendance Record Added",
      title: previous ? "Attendance updated" : "Attendance recorded",
      message: `${next.name} attendance recorded as ${next.status || next.type}.`,
      staffId: next.staffId || "",
      name: next.name,
      relatedEntityType: "AttendanceRecord",
      relatedEntityId: attendanceRecordId(next),
      status: next.status || next.type
    });
  }

  const saved = await publishIntegrationFeeds();
  if (!saved) {
    staffNotifications = previousNotifications;
    return false;
  }
  attendanceDialog?.close();
  render();
  await kcInfo(action === "void" ? "Attendance record voided. It remains in the history but is excluded from totals." : "Attendance record saved.");
  return true;
}

async function saveDataDialog(action = "default") {
  const collection = dataCollectionInput.value;
  const index = dataIndexInput.value;
  const model = dataModels[collection];
  if (!model) return;

  const previousItem = index === "" ? null : { ...model.get()[Number(index)] };
  const item = index === "" ? {} : { ...previousItem };
  let sendingToTech = false;
  let changingSentJob = false;
  let reassigningSentJob = false;
  let pendingJobChangeReason = "";
  let pendingJobReassignmentReason = "";
  model.fields.forEach(([key, , type = "text"]) => {
    const input = dataFields.querySelector(`[data-field="${key}"]`);
    if (!input) return;
    item[key] = type === "number" || type === "holiday-days-number"
      ? Number(input.value || 0)
      : type === "checkbox"
        ? input.checked
        : input.value.trim();
  });
  if (collection === "jobs") {
    sendingToTech = action === "send-tech";
    reassigningSentJob = !sendingToTech && jobDispatchHasTechnicianChange(previousItem, item);
    changingSentJob = !sendingToTech && !reassigningSentJob && jobDispatchHasMaterialChange(previousItem, item);
    if (!(await validateJobDispatchFields(item, sendingToTech))) {
      return false;
    }
    item.status = sendingToTech || changingSentJob ? "Sent to Tech" : "Draft";
    item.report = item.report || "Not due";
    item.completed = item.completed || "n";
    item.updatedAt = new Date().toISOString();
    if (sendingToTech) {
      applyJobDispatchMetadata(item, "Sent");
    } else if (reassigningSentJob) {
      const reason = await kcInput("Why is this dispatched job being reassigned?", "Reassignment reason", "");
      if (!reason || reason === "cancel") return false;
      pendingJobReassignmentReason = String(reason).trim();
      const confirmed = await kcConfirmAction(`Reassign this dispatched job?\n\nFrom: ${previousItem.technician || "Current technician"}\nTo: ${item.technician || "Replacement technician"}\n${formatDateUk(item.date)} ${item.slot || ""}\n${item.client || ""}\n${item.address || item.postcode || ""}\n\nReason: ${pendingJobReassignmentReason}\n\nThe original technician will receive a withdrawal notice and the replacement technician will receive the latest job version.`, "Reassign Job");
      if (!confirmed) return false;
    } else if (changingSentJob) {
      const changes = jobDispatchMaterialChanges(previousItem, item);
      const reason = await kcInput("Why is this dispatched job being changed?", "Change reason", "");
      if (!reason || reason === "cancel") return false;
      pendingJobChangeReason = String(reason).trim();
      const summary = changes.map((change) => `${change.label}: ${change.previous || "-"} -> ${change.next || "-"}`).join("\n");
      const confirmed = await kcConfirmAction(`Send amended job version?\n\n${item.technician || "Technician"}\n${formatDateUk(item.date)} ${item.slot || ""}\n${item.client || ""}\n${item.address || item.postcode || ""}\n\nChanges:\n${summary}\n\nReason: ${pendingJobChangeReason}`, "Send Change");
      if (!confirmed) return false;
    } else {
      item.savedAt = item.savedAt || new Date().toISOString();
    }
    if (!(await validateJobTechnicianAvailability(item))) {
      return false;
    }
    if (sendingToTech && !(await confirmSendJobToTech(item))) {
      setDataDialogStatus("Job not sent. You can keep editing or save it as a draft.", "error");
      return false;
    }
    if (sendingToTech && !(await addJobToWeeklyPlanner(item))) {
      return false;
    }
    if (!sendingToTech && !changingSentJob && !reassigningSentJob) {
      removeJobFromWeeklyPlanner(item);
    }
  }
  if (collection === "attendance") {
    if (!(await validateAttendanceRecord(item))) {
      return false;
    }
  }
  if (collection === "vehicles") {
    if (!item.registration || !item.vehicle) {
      await kcInfo("Please complete the vehicle registration and vehicle description.");
      return false;
    }
    const normalisedVehicle = normaliseVehicleForUi(item);
    Object.assign(item, normalisedVehicle);
    item.status = item.status || "Active";
    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();
  }
  if (collection === "clients") {
    if (!item.title) {
      setDataDialogStatus("Please enter the client name.", "error");
      await kcInfo("Please enter the client name before saving.");
      return false;
    }
    item.description = item.description || "";
  }
  if (collection === "documents") {
    if (!companyDocumentCategories.includes(item.category)) {
      await kcInfo("Please choose a valid Company Documents category.");
      return false;
    }
    if (!item.title || !item.oneDriveLink || !item.issueDate || !item.owner) {
      await kcInfo("Please complete the title, category, OneDrive link, issue date and owner.");
      return false;
    }
    item.lastUpdatedBy = currentUserName();
    item.updatedAt = today;
    item.createdAt = item.createdAt || today;
    item.status = companyDocumentStatus(item).value;
  }
  if (collection === "compliance") {
    if (!complianceTypes.includes(item.complianceType)) {
      await kcInfo("Please choose a valid compliance type.");
      return false;
    }
    if (item.complianceType === "Accreditation") {
      if (!accreditationOptions.includes(item.accreditationName)) {
        await kcInfo("Please choose SafeContractor or Add other accreditation.");
        return false;
      }
      if (item.accreditationName === "Add other accreditation" && !item.customAccreditationName) {
        await kcInfo("Please enter the accreditation name.");
        return false;
      }
      const accreditationTitle = item.accreditationName === "SafeContractor" ? "SafeContractor accreditation" : `${item.customAccreditationName} accreditation`;
      item.title = item.title || accreditationTitle;
      item.provider = item.provider || (item.accreditationName === "SafeContractor" ? "SafeContractor" : item.customAccreditationName);
    } else {
      item.accreditationName = "";
      item.customAccreditationName = "";
    }
    if (!item.title || !item.responsiblePerson || !item.startDate) {
      await kcInfo("Please complete the compliance type, title, start date and responsible person.");
      return false;
    }
    item.noExpiry = Boolean(item.noExpiry);
    if (!item.noExpiry && !item.expiryDate) {
      await kcInfo("Please enter an expiry or review date, or tick No expiry.");
      return false;
    }
    item.id = item.id || item.recordId || `COMP-${Date.now()}`;
    item.recordId = item.id;
    item.reminderDays = Number(item.reminderDays || 60);
    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    item.status = complianceStatus(item).label;
    item.audit = Array.isArray(item.audit) ? item.audit : [];
    item.audit.push({
      action: index === "" ? "created" : "edited",
      by: currentUserName(),
      at: new Date().toISOString()
    });
    setDataDialogStatus("Saving compliance document to OneDrive...", "");
    const savedComplianceDocument = await saveComplianceDocumentToOneDrive(item);
    if (!savedComplianceDocument) return false;
    setDataDialogStatus("Saved to OneDrive", "success");
  }
  if (collection === "fines") {
    if (!item.date || !item.registration || !item.driver || !item.type || !item.deadline) {
      await kcInfo("Please complete the date, vehicle registration, driver, fine type and deadline.");
      return false;
    }
    if (item.type === "Other" && !item.customType) {
      await kcInfo("Please enter the custom fine description.");
      return false;
    }
    item.id = item.id || `FINE-${Date.now()}`;
    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    item.createdBy = item.createdBy || currentUserName();
    item.evidenceItems = normaliseFineEvidence(item);
  }
  if (collection === "training") {
    const staff = staffProfiles.find((profile) => profile.name === item.employee || profile.staffId === item.staffId);
    if (!staff || !item.course || !item.completedDate) {
      await kcInfo("Please choose an employee and complete the training name and completed date.");
      return false;
    }
    const lifecycleStatus = String(item.lifecycleStatus || "").trim();
    if (!item.noExpiry && !item.expiryDate && !["Not Applicable", "Missing / Not Recorded"].includes(lifecycleStatus)) {
      await kcInfo("Please enter an expiry date, or tick No expiry.");
      return false;
    }
    item.staffId = staff.staffId;
    item.employee = staff.name;
    item.id = item.id || item.trainingRecordId || generateTrainingRecordId(item);
    item.trainingRecordId = item.id;
    item.noExpiry = Boolean(item.noExpiry);
    if (item.noExpiry) item.expiryDate = "";
    item.year = item.year || String(new Date(item.completedDate || today).getFullYear());
    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    item.status = trainingStatus(item).label;
    setDataDialogStatus("Saving certificate to OneDrive...", "");
    const savedTrainingDocument = await saveTrainingDocumentToOneDrive(item);
    if (!savedTrainingDocument) return false;
    setDataDialogStatus("Saved to OneDrive", "success");
  }
  if (collection === "assets") {
    if (!item.asset || !item.category || !item.condition || !item.status || !item.powerSource) {
      await kcInfo("Please complete the asset name, category, condition, status and power source.");
      return false;
    }
    item.id = item.id || item.assetId || generateAssetId(item.asset);
    item.assetId = item.assetId || item.id;
    item.purchaseCost = Number(item.purchaseCost || 0);
    if (item.powerSource !== "Mains powered") {
      item.patTestingRequired = "No";
      item.lastPatDate = "";
      item.nextPatDue = "";
      item.patResult = "";
    }
    if (item.inspectionRequired !== "Yes") {
      item.inspectionFrequency = "";
      item.lastInspectionDate = "";
      item.nextInspectionDue = "";
    }
    if (item.serviceRequired !== "Yes") {
      item.serviceFrequency = "";
      item.lastServiceDate = "";
      item.nextServiceDue = "";
    }
    item.documents = assetDocumentDraft.map((entry) => ({ ...entry }));
    item.history = Array.isArray(item.history) ? item.history : [];
    item.history.push({
      action: index === "" ? "Asset created" : "Asset updated",
      by: currentUserName(),
      at: new Date().toISOString(),
      holder: assetHolderLabel(item),
      status: item.status,
      condition: item.condition
    });
    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    setDataDialogStatus("Saving asset to OneDrive...", "");
    const savedAsset = await saveAssetToOneDrive(item);
    if (!savedAsset) return false;
    setDataDialogStatus("Asset saved to OneDrive", "success");
  }
  if (collection === "holidays") {
    const dates = workingDateRangeValues(item.from, item.to);
    if (!dates.length) {
      await kcInfo("Please enter a valid holiday date range.");
      return false;
    }
    normaliseHolidayRequestTiming(item);
    if (item.dayType === "Half day" && item.from !== item.to) {
      await kcInfo("Half-day holidays can only be used when From and To are the same date. This request has been changed to Full day.");
      item.dayType = "Full day";
      item.dayPart = "";
      item.days = dates.length;
    }
    const staff = staffProfiles.find((profile) => profile.name === item.name || profile.staffId === item.staffId);
    item.id = item.id || `HOL-${Date.now()}`;
    item.staffId = item.staffId || staff?.staffId || "";
    item.name = item.name || staff?.name || "";
    item.year = item.year || String(new Date(item.from || today).getFullYear());
    item.submittedDate = item.submittedDate || today;
    item.days = Number(item.days || holidayCalculatedDays(item) || dates.length);
    if (!item.status) item.status = "Pending";
  }
  if (collection === "companyHolidays") {
    const dates = workingDateRangeValues(item.from, item.to);
    if (!dates.length) {
      await kcInfo("Please enter a valid company holiday date range.");
      return false;
    }
    item.days = item.days || dates.length;
    if (!item.type) item.type = "Company holiday";
  }
  if (collection === "planner") {
    if (previousItem?.task && !previousItem.originalTask) {
      item.originalTask = previousItem.task;
    }
    if (!(await validatePlannerJobDecision(item, previousItem))) {
      return false;
    }
    item.task = plannerStatusLabel(item);
    applyPlannerMetadata(item);
  }

  if (collection === "jobs" && reassigningSentJob) {
    try {
      await reassignJobViaHelper(previousItem, item, pendingJobReassignmentReason);
      await loadCommandData();
      render();
      await kcInfo("Job reassigned. The previous technician has been sent a withdrawal notice.");
      return true;
    } catch (error) {
      await kcInfo(error.message || "Job reassignment failed. No reassignment has been sent.");
      return false;
    }
  }

  if (collection === "jobs" && changingSentJob) {
    try {
      await sendJobChangeViaHelper(previousItem, item, pendingJobChangeReason);
      await loadCommandData();
      render();
      await kcInfo("Amended job version sent to the Technician App.");
      return true;
    } catch (error) {
      await kcInfo(error.message || "Job change failed. No amended version has been sent.");
      return false;
    }
  }

  const items = [...model.get()];
  if (index === "") {
    items.unshift(item);
  } else {
    items[Number(index)] = item;
  }
  if (collection === "planner") {
    items.unshift(...applyPlannerJobAction(item, previousItem));
  }

  model.set(items);
  if (collection === "holidays") {
    applyApprovedHolidayRequest(item);
  }
  if (collection === "planner") {
    syncAttendanceFromPlanner();
  }
  if (collection === "training") {
    syncStaffTrainingFromMatrix();
  }
  if (collection === "staff" || collection === "training") {
    syncTechniciansFromStaff();
  }
  if (collection === "fines") {
    const savedFine = await saveFineToOneDrive(item);
    if (!savedFine) return false;
  }
  if (collection === "jobs" && action !== "send-tech") {
    const saved = await saveCommandData();
    if (!saved) return false;
    await kcInfo("Job saved to system.");
  } else if (collection === "jobs" && action === "send-tech") {
    const saved = await publishIntegrationFeeds();
    if (!saved) return false;
    try {
      await dispatchJobsViaHelper({ mode: "single", jobId: item.jobId || item.id || item.number });
      await loadCommandData();
      await kcInfo("Job sent to the Technician App.");
    } catch (error) {
      await kcInfo(error.message || "Job was saved, but the helper did not confirm the Technician App dispatch.");
      return false;
    }
  } else if (collection === "jobs" || collection === "planner" || collection === "attendance" || collection === "holidays" || collection === "companyHolidays" || collection === "staff") {
    const saved = await publishIntegrationFeeds();
    if (!saved) return false;
  } else {
    const saved = await saveCommandData();
    if (!saved) return false;
    if (collection === "fines") {
      await kcInfo("Fine saved to OneDrive.");
    }
  }
  render();
  if (["emailTemplates", "reportTemplates", "ramsTemplates", "branding"].includes(collection)) {
    renderSettingsDetail();
  }
  return true;
}

async function deleteDataRecord(collection, index) {
  const model = dataModels[collection];
  if (!model) return;

  const previousItems = [...model.get()];
  const items = model.get().filter((_, itemIndex) => itemIndex !== Number(index));
  model.set(items);
  if (collection === "planner") {
    syncAttendanceFromPlanner();
  }
  if (collection === "training") {
    syncStaffTrainingFromMatrix();
  }
  if (collection === "staff" || collection === "training") {
    syncTechniciansFromStaff();
  }
  const saved = await saveCommandData();
  if (!saved) {
    model.set(previousItems);
    render();
    return;
  }
  render();
}

function statusLabel(status) {
  const labels = {
    draft: "Draft",
    attached: "Attached",
    sent: "Sent",
    "sent-client": "Sent",
    "sent-tech": "Sent",
    read: "Sent",
    review: "Needs review"
  };
  return labels[status] || "Draft";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function daysUntil(dateValue) {
  const oneDay = 24 * 60 * 60 * 1000;
  const parseLocalDate = (value) => {
    const [year, month, day] = String(value || "").slice(0, 10).split("-").map(Number);
    if (!year || !month || !day) return null;
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const target = parseLocalDate(dateValue);
  const baseline = parseLocalDate(today);
  if (!target || !baseline) return Number.POSITIVE_INFINITY;
  return Math.ceil((target - baseline) / oneDay);
}

function isReminderDate(dateValue) {
  const days = daysUntil(dateValue);
  return Number.isFinite(days) && days <= 45;
}

function vehicleExpiryStatus(dateValue, reminderDays = 45) {
  if (!dateValue) return { label: "-", className: "neutral", days: Number.POSITIVE_INFINITY };
  const days = daysUntil(dateValue);
  if (!Number.isFinite(days)) return { label: String(dateValue), className: "neutral", days };
  if (days < 0) return { label: formatDateUk(dateValue), className: "urgent", days };
  if (days <= reminderDays) return { label: formatDateUk(dateValue), className: "warning", days };
  return { label: formatDateUk(dateValue), className: "ok", days };
}

function complianceStatus(item) {
  if (item.noExpiry || !item.expiryDate) {
    return {
      label: "No Expiry",
      className: "neutral",
      days: Infinity,
      reminder: "No expiry date"
    };
  }
  const days = daysUntil(item.expiryDate);
  if (days < 0) {
    return {
      label: "Overdue",
      className: "red",
      days,
      reminder: `${Math.abs(days)} days overdue`
    };
  }
  const warningDays = Number(item.reminderDays || 60);
  if (days <= warningDays) {
    return {
      label: "Due Soon",
      className: "amber",
      days,
      reminder: `Due in ${days} days`
    };
  }
  return {
    label: "Current",
    className: "green",
    days,
    reminder: `More than ${warningDays} days remaining`
  };
}

function asComplianceRecord(item) {
  if (Array.isArray(item)) {
    return {
      legacy: true,
      type: item[0] || "",
      name: item[1] || "",
      category: item[2] || "",
      owner: item[3] || "",
      dueDate: item[4] || "",
      complianceType: item[2] === "Company" ? "Office Compliance" : item[2] || "Other",
      title: item[0] || "Compliance item",
      provider: item[1] || "",
      certificateNumber: "",
      startDate: "",
      expiryDate: item[4] || "",
      noExpiry: false,
      responsiblePerson: item[3] || "Kevin",
      reminderDays: 60,
      notes: "",
      documentFileName: "",
      oneDriveLocation: "",
      history: [],
      audit: [],
      createdAt: "",
      updatedAt: ""
    };
  }
  return {
    ...item,
    id: item.id || item.recordId || `COMP-${Date.now()}`,
    recordId: item.recordId || item.id || "",
    complianceType: complianceTypes.includes(item.complianceType) ? item.complianceType : item.category === "Company" ? "Office Compliance" : "Other",
    title: item.title || item.name || item.type || "Compliance item",
    provider: item.provider || item.issuingBody || item.name || "",
    certificateNumber: item.certificateNumber || item.policyNumber || "",
    startDate: item.startDate || item.issueDate || "",
    expiryDate: item.expiryDate || item.reviewDate || item.dueDate || "",
    noExpiry: Boolean(item.noExpiry),
    responsiblePerson: item.responsiblePerson || item.owner || "Kevin",
    reminderDays: Number(item.reminderDays || 60),
    notes: item.notes || "",
    documentFileName: item.documentFileName || item.supportingDocumentName || "",
    oneDriveLocation: item.oneDriveLocation || item.documentLocation || "",
    history: Array.isArray(item.history) ? item.history : [],
    audit: Array.isArray(item.audit) ? item.audit : [],
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || ""
  };
}

function isCompanyLevelCompliance(item) {
  const record = asComplianceRecord(item);
  if (record.legacy && !allowedComplianceLegacyCategories.includes(record.category)) return false;
  const haystack = `${record.complianceType} ${record.title} ${record.provider} ${record.category || ""}`.toLowerCase();
  return !disallowedComplianceTerms.some((term) => haystack.includes(term));
}

function complianceRecords() {
  return complianceItems.filter(isCompanyLevelCompliance).map(asComplianceRecord);
}

function filteredCompliance() {
  const term = document.querySelector("#complianceSearch")?.value.trim().toLowerCase() || "";
  const category = document.querySelector("#complianceCategoryFilter")?.value || "all";
  const status = document.querySelector("#complianceStatusFilter")?.value || "all";
  const owner = document.querySelector("#complianceOwnerFilter")?.value || "all";
  const expiry = document.querySelector("#complianceExpiryFilter")?.value || "all";

  return complianceRecords().filter((item) => {
    const itemStatus = complianceStatus(item);
    const searchable = `${item.complianceType} ${item.title} ${item.provider} ${item.certificateNumber} ${item.responsiblePerson}`.toLowerCase();
    const matchesSearch = !term || searchable.includes(term);
    const matchesCategory = category === "all" || item.complianceType === category;
    const matchesStatus = (activeComplianceFilter === "all" || itemStatus.label === activeComplianceFilter)
      && (status === "all" || itemStatus.label === status);
    const matchesOwner = owner === "all" || item.responsiblePerson === owner;
    const matchesExpiry = expiry === "all" || (Number.isFinite(itemStatus.days) && itemStatus.days >= 0 && itemStatus.days <= Number(expiry));
    return matchesSearch && matchesCategory && matchesStatus && matchesOwner && matchesExpiry;
  });
}

function isFineOpen(fine) {
  return fine.status !== "Paid" && fine.status !== "Deducted from wages" && fine.status !== "Cancelled";
}

function isFineDeadlineSoon(fine) {
  const days = daysUntil(fine.deadline);
  return isFineOpen(fine) && days >= 0 && days <= 14;
}

function fineDeadlineLabel(fine) {
  const days = daysUntil(fine.deadline);
  if (!isFineOpen(fine)) {
    return "Closed";
  }
  if (days < 0) {
    return `${Math.abs(days)} days overdue`;
  }
  if (days === 0) {
    return "Due today";
  }
  return `Due in ${days} days`;
}

function fineStatusClass(fine) {
  if (fine.status === "Cancelled") {
    return "draft";
  }
  if (!isFineOpen(fine)) {
    return "ok";
  }
  if (daysUntil(fine.deadline) < 0) {
    return "urgent";
  }
  if (isFineDeadlineSoon(fine)) {
    return "warning";
  }
  return "attached";
}

function fineTypeLabel(fine) {
  return fine.type === "Other" && fine.customType ? fine.customType : fine.type;
}

function fineEvidenceLabel(fine) {
  const items = normaliseFineEvidence(fine);
  if (items.length) return `${items.length} item${items.length === 1 ? "" : "s"}`;
  return fine.evidence || "No evidence";
}

function money(value) {
  const amount = Number(value) || 0;
  return `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateUk(dateValue) {
  if (!dateValue) return "-";
  const [year, month, day] = String(dateValue).slice(0, 10).split("-");
  if (!year || !month || !day) return String(dateValue);
  return `${day}/${month}/${year}`;
}

function formatLeaveNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, "");
}

function formatDateTimeUk(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return formatDateUk(dateValue);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateTimeUkShort(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return formatDateTimeUk(dateValue);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).replace(",", "");
}

function monthKey(dateValue = today) {
  return String(dateValue || "").slice(0, 7);
}

function monthLabel(dateValue = today) {
  const [year, month] = monthKey(dateValue).split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function lastWorkingDayOfMonth(dateValue = today) {
  const [year, month] = monthKey(dateValue).split("-").map(Number);
  const date = new Date(year, month, 0);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }
  return date.toLocaleDateString("en-GB");
}

function ordinalDay(day) {
  if (day > 3 && day < 21) return `${day}th`;
  const suffixes = { 1: "st", 2: "nd", 3: "rd" };
  return `${day}${suffixes[day % 10] || "th"}`;
}

function plannerWeekStartForDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return localIsoDate(date);
}

function plannerWeekLabelFromStart(weekStart) {
  const [year, month, day] = String(weekStart || "").split("-");
  if (!year || !month || !day) return "";
  return `WC ${day}.${month}.${year}`;
}

function plannerDayLabel(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
  return `${weekday} ${ordinalDay(date.getDate())}`;
}

function applyPlannerMetadata(item) {
  if (!item.date) return item;
  item.weekStart = plannerWeekStartForDate(item.date);
  item.week = plannerWeekLabelFromStart(item.weekStart);
  item.day = plannerDayLabel(item.date);
  item.session = item.session || "AM";
  item.type = item.type || plannerTypeFromItem(item);
  return item;
}

function normalisePlannerItems() {
  weeklyPlanner.forEach(applyPlannerMetadata);
}

function syncAttendanceFromPlanner() {
  const grouped = new Map();
  weeklyPlanner.filter((item) => item.source !== "approved-holiday").forEach((item) => {
    const status = plannerAttendanceStatus(item);
    if (!status || !item.technician || !item.date) return;
    const key = `${item.technician}|${item.date}`;
    const current = grouped.get(key);
    const priority = { Sick: 3, Holiday: 2, Training: 1 };
    if (!current || priority[status] > priority[current.status]) {
      grouped.set(key, {
        date: item.date,
        name: item.technician,
        status,
        returnToWorkNotes: status === "Sick" ? "Planner marked sick." : "",
        fitNote: "",
        source: "planner"
      });
    }
  });

  attendanceRecords = attendanceRecords.filter((record) => record.source !== "planner");
  grouped.forEach((record) => {
    const existing = attendanceRecords.find((item) => item.name === record.name && item.date === record.date);
    if (existing) {
      existing.status = record.status;
      existing.source = "planner";
      if (!existing.returnToWorkNotes) existing.returnToWorkNotes = record.returnToWorkNotes;
    } else {
      attendanceRecords.push(record);
    }
  });
}

function isJgClient(client) {
  const text = String(client || "").toLowerCase();
  return text.includes("jg") || text.includes("pest control");
}

function isPrivateClient(client) {
  return String(client || "").toLowerCase().includes("private");
}

function isVergoClient(client) {
  return String(client || "").toLowerCase().includes("vergo");
}

function valuationMainClientGroup(item) {
  const mainClient = String(item?.mainClient || "").toLowerCase();
  const text = `${mainClient} ${item?.client || ""} ${item?.type || ""}`.toLowerCase();

  if (mainClient.includes("ark")) return "ark";
  if (mainClient.includes("jg") || mainClient.includes("pest control")) return "jg";
  if (mainClient.includes("vergo")) return "vergo";
  if (mainClient.includes("other") || mainClient.includes("private")) return "other";

  if (item?.sourceSheet) return "ark";
  if (item?.source === "Hub job diary") {
    if (text.includes("jg") || text.includes("pest control")) return "jg";
    if (text.includes("vergo")) return "vergo";
    if (text.includes("other") || text.includes("private")) return "other";
    return "ark";
  }
  if (text.includes("jg") || text.includes("pest control")) return "jg";
  if (text.includes("vergo")) return "vergo";
  if (text.includes("other")) return "other";
  return "ark";
}

const clientAccentMap = {
  "client:jg-pest-control": { key: "jg", label: "JG Pest Control", className: "client-accent-jg", badgeClassName: "jg" },
  "client:kingswood-direct": { key: "kingswood", label: "Kingswood direct work", className: "client-accent-kingswood", badgeClassName: "kingswood" },
  "client:vergo": { key: "vergo", label: "Vergo", className: "client-accent-vergo", badgeClassName: "vergo" }
};

function normaliseClientKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clientAccentForJob(job = {}) {
  const clientId = normaliseClientKey(job.clientId || job.mainClientId);
  const clientName = String(job.client || job.clientName || job.mainClient || "No client").trim();
  const clientNameKey = normaliseClientKey(clientName);
  const idMatches = [
    clientId,
    clientId ? `client:${clientId}` : ""
  ];
  for (const key of idMatches) {
    if (clientAccentMap[key]) {
      return { ...clientAccentMap[key], displayName: clientName };
    }
  }
  if (clientNameKey.includes("jg-pest-control") || clientNameKey === "jg" || clientNameKey.startsWith("jg-")) {
    return { ...clientAccentMap["client:jg-pest-control"], displayName: clientName };
  }
  if (clientNameKey.includes("kingswood")) {
    return { ...clientAccentMap["client:kingswood-direct"], displayName: clientName };
  }
  if (clientNameKey.includes("vergo")) {
    return { ...clientAccentMap["client:vergo"], displayName: clientName };
  }
  return { key: "neutral", label: "Other client", className: "client-accent-neutral", badgeClassName: "other", displayName: clientName };
}

function jobClientType(job) {
  const accent = clientAccentForJob(job);
  return {
    label: accent.displayName || accent.label,
    className: accent.badgeClassName || accent.key,
    accentClassName: accent.className,
    key: accent.key
  };
}

function isAdminPrivateJob(job) {
  return (isPrivateClient(job.mainClient) || isPrivateClient(job.client)) && !job.sourceSheet;
}

function monthlyValuationTotals() {
  const currentMonth = monthKey();
  return valuationTotalsForMonth(currentMonth);
}

function valuationTotalsForMonth(targetMonth) {
  const totals = { ark: 0, jg: 0, private: 0, vergo: 0 };

  valuations
    .filter((item) => monthKey(item.date) === targetMonth)
    .forEach((item) => {
      const group = valuationMainClientGroup(item);
      if (group === "jg") {
        totals.jg += Number(item.cost || 0);
        return;
      }
      if (group === "ark") {
        totals.ark += Number(item.cost || 0);
        return;
      }
      if (group === "vergo") {
        totals.vergo += Number(item.cost || 0);
        return;
      }
      totals.private += Number(item.cost || 0);
    });

  jobs
    .filter((job) => monthKey(job.date) === targetMonth && isAdminPrivateJob(job))
    .forEach((job) => {
      totals.private += Number(job.cost || 0);
    });

  return totals;
}

function valuationTotalForRows(rows) {
  return rows.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
}

function isYes(value) {
  return String(value || "").trim().toLowerCase().startsWith("y");
}

function isNo(value) {
  return String(value || "").trim().toLowerCase().startsWith("n");
}

function valuationStatusLabel(value) {
  return isYes(value) ? "Yes" : "No";
}

function isReportOutstanding(valuation) {
  return !isYes(valuation.reportReceived);
}

function isArkReportComplete(valuation) {
  return isYes(valuation.checked) || valuation.arkReportCompleted === true;
}

function valuationRowClass(valuation) {
  if (isArkReportComplete(valuation)) {
    return "valuation-checked";
  }
  if (isReportOutstanding(valuation)) {
    return "valuation-awaiting-report";
  }
  return "valuation-report-received";
}

function valuationKey(item) {
  return [
    item.number || item.arkRef || "",
    item.address || "",
    item.postcode || "",
    item.client || ""
  ].join("|").toLowerCase().trim();
}

function phase05eReportForJob(job) {
  if (!job) return null;
  if (job.phase05eReport?.reportId) return job.phase05eReport;
  const jobId = String(job.jobId || job.id || "").trim();
  const jobReference = String(job.number || job.reference || job.jobReference || "").trim();
  const matches = phase05eCompletedReports
    .filter((report) => {
      return (jobId && report.jobId === jobId) || (jobReference && report.jobReference === jobReference);
    })
    .filter((report) => report.reportId && report.oneDriveFolder);
  if (!matches.length) return null;
  return matches.sort((a, b) => new Date(b.submittedAt || b.createdAt || b.jobDate || 0) - new Date(a.submittedAt || a.createdAt || a.jobDate || 0))[0];
}

function phase05eReportJob(report) {
  return {
    id: report.jobId,
    jobId: report.jobId,
    number: report.jobReference,
    reference: report.jobReference,
    date: report.jobDate,
    slot: report.slot,
    client: report.clientName,
    title: report.jobTitle || report.siteName || "Technician job",
    address: report.address || report.siteName || "",
    postcode: report.postcode || "",
    technician: report.technician || "",
    status: report.status || "Completed - Report Submitted",
    report: "Report Received",
    reportNotes: "Authenticated technician report received.",
    completed: "y",
    reportReceived: "y",
    phase05eReadOnly: true,
    phase05eReport: report
  };
}

function phase05eReportJobs() {
  const unmatchedReports = phase05eCompletedReports
    .filter((report) => !jobs.some((job) => {
      const jobId = String(job.jobId || job.id || "").trim();
      const reference = String(job.number || job.reference || job.jobReference || "").trim();
      return (jobId && jobId === report.jobId) || (reference && reference === report.jobReference);
    }));
  const latestByJob = new Map();
  unmatchedReports.forEach((report) => {
    const key = String(report.jobId || report.jobReference || report.reportId || "").trim();
    if (!key) return;
    const current = latestByJob.get(key);
    const reportTime = new Date(report.submittedAt || report.createdAt || report.jobDate || 0).getTime() || 0;
    const currentTime = new Date(current?.submittedAt || current?.createdAt || current?.jobDate || 0).getTime() || 0;
    if (!current || reportTime >= currentTime) {
      latestByJob.set(key, report);
    }
  });
  return [...latestByJob.values()].map(phase05eReportJob);
}

function dashboardJobSource() {
  const testTechnicianNames = dashboardTestTechnicianNames();
  return jobs
    .concat(phase05eReportJobs())
    .filter((job) => !isDashboardTestRecord(job))
    .filter((job) => !testTechnicianNames.has(String(job.technician || "").trim()));
}

function jobReportReceived(job) {
  if (phase05eReportForJob(job)) return true;
  const report = String(job.report || "").toLowerCase();
  return report.includes("received") || report.includes("complete") || report.includes("done") || report === "y";
}

function jobCompleted(job) {
  if (phase05eReportForJob(job)) {
    return true;
  }
  if (isYes(job.completed)) {
    return true;
  }
  if (isNo(job.completed)) {
    return false;
  }
  const status = String(job.status || "").toLowerCase();
  return status.includes("complete") || status === "done" || jobReportReceived(job);
}

function splitJobAttachments(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderJobAttachments(job) {
  const attachments = splitJobAttachments(job.photos || job.pictures || job.images || job.evidence);
  if (!attachments.length) {
    const report = phase05eReportForJob(job);
    const reportPhotoCount = Number(report?.photoCount);
    if (Number.isFinite(reportPhotoCount) && reportPhotoCount > 0) {
      return `<p class="job-detail-empty">Photos submitted: ${escapeHtml(String(reportPhotoCount))}</p>`;
    }
    return `<p class="job-detail-empty">No pictures have been attached yet.</p>`;
  }

  return `
    <div class="job-attachment-list">
      ${attachments.map((item) => {
        const isImage = /\.(png|jpe?g|gif|webp|bmp)$/i.test(item);
        const isLink = /^https?:\/\//i.test(item);
        if (isImage || isLink) {
          return `<a href="${escapeHtml(item)}" target="_blank" rel="noopener">${escapeHtml(item)}</a>`;
        }
        return `<span>${escapeHtml(item)}</span>`;
      }).join("")}
    </div>
  `;
}

function renderCompletedReportMetadata(job) {
  const report = phase05eReportForJob(job);
  if (!report) return "";

  const reportId = String(report.reportId || "").trim();
  const photoCount = Number(report.photoCount);
  const hasPhotoCount = Number.isFinite(photoCount);
  const hasRecommendations = report.recommendations ? "Yes" : "No";
  const actionButtons = [
    reportId ? `<button class="secondary-button compact-button" type="button" data-view-phase05e-report="${escapeHtml(reportId)}">View Report</button>` : "",
    reportId && report.oneDriveFolder ? `<button class="secondary-button compact-button" type="button" data-open-report-folder="${escapeHtml(reportId)}">Open OneDrive Folder</button>` : ""
  ].filter(Boolean).join("");

  return `
    <section class="job-detail-section job-report-metadata">
      <h3>Completed Technician Report</h3>
      <div class="job-report-meta-grid">
        ${historyMetaItem("Report status", report.status || "Completed - Report Submitted")}
        ${historyMetaItem("Report ID", reportId)}
        ${historyMetaItem("Submitted date and time", report.submittedAt ? formatDateTimeUk(report.submittedAt) : "")}
        ${historyMetaItem("Reporting technician", report.technician || job.technician)}
        ${historyMetaItem("Photo count", hasPhotoCount ? String(photoCount) : "")}
        ${historyMetaItem("Recommendations present", hasRecommendations)}
      </div>
      ${actionButtons ? `<div class="history-card-actions">${actionButtons}</div>` : ""}
    </section>
  `;
}

function openJobDetail(index) {
  const job = jobs[Number(index)];
  if (!job) return;

  const completed = jobCompleted(job);
  const displayStatus = completed ? "Completed" : "Not Completed";
  const statusClass = completed ? "ok" : "urgent";
  const reportText = job.reportNotes || job.report || "No report has been added yet.";
  const type = jobClientType(job);

  jobDetailTitle.textContent = job.address || job.number || "Job Details";
  jobDetailContent.innerHTML = `
    <div class="job-detail-client-accent ${type.accentClassName}" data-client-accent="${escapeHtml(type.key)}">
      <span>Client</span>
      <strong>${escapeHtml(type.label || job.client || "No client")}</strong>
    </div>
    <div class="job-detail-grid">
      <article>
        <span>Date</span>
        <strong>${formatDateUk(job.date)}</strong>
      </article>
      <article>
        <span>Postcode</span>
        <strong>${escapeHtml(job.postcode || "-")}</strong>
      </article>
      <article>
        <span>Ref</span>
        <strong>${escapeHtml(job.number || "-")}</strong>
      </article>
      <article>
        <span>Type</span>
        <strong><span class="job-type-badge ${type.className}">${escapeHtml(type.label)}</span></strong>
      </article>
      <article>
        <span>Status</span>
        <strong><span class="status ${statusClass}">${escapeHtml(displayStatus)}</span></strong>
      </article>
      <article>
        <span>Client</span>
        <strong>${escapeHtml(job.client || "-")}</strong>
      </article>
      <article>
        <span>Technician</span>
        <strong>${escapeHtml(job.technician || "-")}</strong>
      </article>
    </div>
    <section class="job-detail-section">
      <h3>Report</h3>
      <p>${escapeHtml(reportText)}</p>
    </section>
    ${renderCompletedReportMetadata(job)}
    <section class="job-detail-section">
      <h3>Pictures</h3>
      ${renderJobAttachments(job)}
    </section>
  `;
  jobDetailDialog.showModal();
}

function openPhase05eReportDetail(reportId) {
  const report = phase05eCompletedReports.find((item) => item.reportId === reportId);
  if (!report) return;
  const job = phase05eReportJob(report);
  const type = jobClientType(job);
  jobDetailTitle.textContent = job.address || job.number || "Completed Report";
  jobDetailContent.innerHTML = `
    <div class="job-detail-client-accent ${type.accentClassName}" data-client-accent="${escapeHtml(type.key)}">
      <span>Client</span>
      <strong>${escapeHtml(type.label || job.client || "No client")}</strong>
    </div>
    <div class="job-detail-grid">
      <article>
        <span>Date</span>
        <strong>${formatDateUk(job.date)}</strong>
      </article>
      <article>
        <span>Postcode</span>
        <strong>${escapeHtml(job.postcode || "-")}</strong>
      </article>
      <article>
        <span>Ref</span>
        <strong>${escapeHtml(job.number || "-")}</strong>
      </article>
      <article>
        <span>Status</span>
        <strong><span class="status ok">Completed - Report Submitted</span></strong>
      </article>
      <article>
        <span>Client</span>
        <strong>${escapeHtml(job.client || "-")}</strong>
      </article>
      <article>
        <span>Technician</span>
        <strong>${escapeHtml(job.technician || "-")}</strong>
      </article>
    </div>
    ${renderCompletedReportMetadata(job)}
  `;
  jobDetailDialog.showModal();
}

function setupJobDateFilters() {
  const monthFilter = document.querySelector("#jobMonthFilter");
  const yearFilter = document.querySelector("#jobYearFilter");
  if (!monthFilter || !yearFilter) return;

  const selectedMonth = monthFilter.value || String(new Date().getMonth() + 1).padStart(2, "0");
  const selectedYear = yearFilter.value || String(new Date().getFullYear());
  const years = [...new Set(jobs.map((job) => String(job.date || "").slice(0, 4)).filter(Boolean))].sort();

  monthFilter.innerHTML = [
    `<option value="all">All months</option>`,
    ...monthNames.map((name, index) => `<option value="${String(index + 1).padStart(2, "0")}">${name}</option>`)
  ].join("");

  yearFilter.innerHTML = [
    `<option value="all">All years</option>`,
    ...years.map((year) => `<option value="${year}">${year}</option>`)
  ].join("");

  monthFilter.value = [...monthFilter.options].some((option) => option.value === selectedMonth) ? selectedMonth : "all";
  yearFilter.value = [...yearFilter.options].some((option) => option.value === selectedYear) ? selectedYear : "all";
}

function jobMatchesDateFilters(job) {
  const monthFilter = document.querySelector("#jobMonthFilter")?.value || "all";
  const yearFilter = document.querySelector("#jobYearFilter")?.value || "all";
  const date = String(job.date || "");
  const jobYear = date.slice(0, 4);
  const jobMonth = date.slice(5, 7);

  return (monthFilter === "all" || jobMonth === monthFilter) && (yearFilter === "all" || jobYear === yearFilter);
}

function normalisePostcode(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function syncValuationsFromJobs() {
  let changed = false;
  const existingKeys = new Map(valuations.map((item) => [valuationKey(item), item]));

  jobs.forEach((job) => {
    const key = valuationKey({
      number: job.number,
      address: job.address,
      postcode: job.postcode,
      client: job.client
    });
    const existing = existingKeys.get(key);

    if (!existing) {
      valuations.unshift({
        date: job.date || "",
        address: job.address || "",
        postcode: job.postcode || "",
        arkRef: job.number || "",
        client: job.client || "",
        mainClient: job.mainClient || job.client || "",
        technician: job.technician || "",
        completed: jobCompleted(job) ? "y" : "n",
        reportReceived: jobReportReceived(job) ? "y" : "n",
        cost: Number(job.cost || 0),
        checked: "",
        notes: job.title || "",
        source: "Hub job diary"
      });
      changed = true;
      return;
    }

    if (!existing.reportReceived && jobReportReceived(job)) {
      existing.reportReceived = "y";
      changed = true;
    }
    if (!isYes(existing.completed) && jobCompleted(job)) {
      existing.completed = "y";
      changed = true;
    }
    if (!existing.technician && job.technician) {
      existing.technician = job.technician;
      changed = true;
    }
    if ((job.mainClient || job.client) && existing.mainClient !== (job.mainClient || job.client)) {
      existing.mainClient = job.mainClient || job.client;
      changed = true;
    }
  });

  return changed;
}

function valuationClients() {
  return [...new Set(valuations.map((item) => item.client).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function syncValuationClientFilter() {
  const filter = document.querySelector("#valuationClientFilter");
  const current = filter.value;
  const options = valuationClients();
  const groupOptions = [
    ["group:ark", "Ark group"],
    ["group:jg", "JG Pest Control group"],
    ["group:private", "Private group"],
    ["group:vergo", "Vergo group"],
    ["group:other", "Other group"]
  ];
  filter.innerHTML = '<option value="all">All clients</option>'
    + groupOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")
    + options
    .map((client) => `<option value="${escapeHtml(client)}">${escapeHtml(client)}</option>`)
    .join("");
  filter.value = options.includes(current) || groupOptions.some(([value]) => value === current) ? current : "all";
}

function setupValuationDateFilters() {
  const monthFilter = document.querySelector("#valuationMonthFilter");
  const yearFilter = document.querySelector("#valuationYearFilter");
  if (!monthFilter || !yearFilter) return;

  const selectedMonth = monthFilter.value || String(new Date().getMonth() + 1).padStart(2, "0");
  const selectedYear = yearFilter.value || String(new Date().getFullYear());
  const years = [...new Set(valuations.map((item) => String(item.date || "").slice(0, 4)).filter(Boolean))].sort();

  monthFilter.innerHTML = monthNames
    .map((name, index) => `<option value="${String(index + 1).padStart(2, "0")}">${name}</option>`)
    .join("");

  yearFilter.innerHTML = years
    .map((year) => `<option value="${year}">${year}</option>`)
    .join("");

  if (!years.includes(selectedYear)) {
    yearFilter.innerHTML += `<option value="${selectedYear}">${selectedYear}</option>`;
  }

  monthFilter.value = [...monthFilter.options].some((option) => option.value === selectedMonth) ? selectedMonth : String(new Date().getMonth() + 1).padStart(2, "0");
  yearFilter.value = [...yearFilter.options].some((option) => option.value === selectedYear) ? selectedYear : String(new Date().getFullYear());
}

function selectedValuationMonthKey() {
  const month = document.querySelector("#valuationMonthFilter")?.value || String(new Date().getMonth() + 1).padStart(2, "0");
  const year = document.querySelector("#valuationYearFilter")?.value || String(new Date().getFullYear());
  return `${year}-${month}`;
}

function valuationMatchesDateFilters(item) {
  return monthKey(item.date) === selectedValuationMonthKey();
}

function valuationsForMonth(targetMonth = selectedValuationMonthKey()) {
  return valuations.filter((item) => monthKey(item.date) === targetMonth);
}

function valuationGroupRows(group, targetMonth = selectedValuationMonthKey()) {
  const monthRows = valuationsForMonth(targetMonth);
  if (group === "ark") {
    return monthRows.filter((item) => valuationMainClientGroup(item) === "ark");
  }
  if (group === "jg") {
    return monthRows.filter((item) => valuationMainClientGroup(item) === "jg");
  }
  if (group === "vergo") {
    return monthRows.filter((item) => valuationMainClientGroup(item) === "vergo");
  }
  if (group === "private") {
    return jobs
      .map((job, jobIndex) => ({ job, jobIndex }))
      .filter(({ job }) => monthKey(job.date) === targetMonth && isAdminPrivateJob(job))
      .map(({ job, jobIndex }) => ({
        date: job.date || "",
        address: job.address || "",
        postcode: job.postcode || "",
        arkRef: job.number || "",
        client: job.client || "Private",
        technician: job.technician || "",
        completed: jobCompleted(job) ? "y" : "n",
        reportReceived: jobReportReceived(job) ? "y" : "n",
        cost: Number(job.cost || 0),
        checked: "",
        notes: job.title || "",
        sourceJobIndex: jobIndex
      }));
  }
  if (group === "other") {
    return [
      ...monthRows.filter((item) => valuationMainClientGroup(item) === "other"),
      ...valuationGroupRows("private", targetMonth)
    ];
  }
  return monthRows;
}

function valuationGraphTotals(targetMonth = selectedValuationMonthKey()) {
  return {
    ark: valuationTotalForRows(valuationGroupRows("ark", targetMonth)),
    jg: valuationTotalForRows(valuationGroupRows("jg", targetMonth)),
    vergo: valuationTotalForRows(valuationGroupRows("vergo", targetMonth)),
    other: valuationTotalForRows(valuationGroupRows("other", targetMonth))
  };
}

function addMonthsToMonthKey(monthKeyValue, offset) {
  const [year, month] = String(monthKeyValue || monthKey()).split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shortMonthLabel(monthKeyValue) {
  const [year, month] = String(monthKeyValue).split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function rollingValuationGraphData(endMonth = selectedValuationMonthKey()) {
  return Array.from({ length: 12 }, (_, index) => {
    const key = addMonthsToMonthKey(endMonth, index - 11);
    const totals = valuationGraphTotals(key);
    return {
      key,
      label: shortMonthLabel(key),
      fullLabel: monthLabel(`${key}-01`),
      ...totals,
      total: totals.ark + totals.jg + totals.vergo + totals.other
    };
  });
}

function filteredValuations() {
  const term = document.querySelector("#valuationSearch").value.trim().toLowerCase();
  const client = document.querySelector("#valuationClientFilter").value;
  const status = document.querySelector("#valuationStatusFilter").value;

  return valuations.filter((item) => {
    const searchable = `${item.date} ${item.address} ${item.postcode} ${item.arkRef} ${item.client} ${item.technician} ${item.notes}`.toLowerCase();
    const matchesDate = valuationMatchesDateFilters(item);
    const matchesSearch = !term || searchable.includes(term);
    const matchesClient = client === "all"
      || (client.startsWith("group:") && valuationMainClientGroup(item) === client.replace("group:", ""))
      || item.client === client;
    const matchesStatus =
      status === "all" ||
      (status === "completed" && isYes(item.completed)) ||
      (status === "not-completed" && !isYes(item.completed)) ||
      (status === "report-outstanding" && isReportOutstanding(item));

    return matchesDate && matchesSearch && matchesClient && matchesStatus;
  });
}

function datePlusDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

function isSickCallStatus(status) {
  return status === "Sick" || status === "Absent - Called in Sick";
}

function isFoodPremisesCategory(category) {
  return ["Commercial Kitchen", "Food Premises", "Catering"].includes(category);
}

function jobIsFoodPremises(job = {}) {
  const text = `${job.siteCategory || ""} ${job.title || ""} ${job.client || ""} ${job.address || ""} ${job.jobDetails || ""}`.toLowerCase();
  return isFoodPremisesCategory(job.siteCategory) || /\b(commercial kitchen|food premises|catering|kitchen|restaurant|canteen|food prep)\b/.test(text);
}

function jobRequiresRpe(job = {}) {
  const text = `${job.title || ""} ${job.jobDetails || ""} ${job.reportNotes || ""}`.toLowerCase();
  return job.rpeRequired === true || job.rpeRequired === "true" || /\b(rpe|ffp3|half[-\s]?mask|respirator|abek)\b/.test(text);
}

function plannerCurrentWeekStart() {
  return plannerWeekStartForDate(localIsoDate());
}

function plannerWeekFromStart(weekStart) {
  return {
    week: plannerWeekLabelFromStart(weekStart),
    weekStart
  };
}

function plannerCurrentWeek() {
  return plannerWeekLabelFromStart(plannerCurrentWeekStart());
}

function plannerVisibleWeeks() {
  const currentStart = plannerCurrentWeekStart();
  const standardWeekStarts = [-7, 0, 7, 14].map((days) => datePlusDays(currentStart, days));
  return standardWeekStarts.map(plannerWeekFromStart);
}

function plannerWeekStartFromLabel(weekLabel) {
  const visible = plannerVisibleWeeks().find((item) => item.week === weekLabel);
  if (visible) return visible.weekStart;
  const existing = weeklyPlanner.find((item) => item.week === weekLabel);
  return existing?.weekStart || plannerCurrentWeekStart();
}

function plannerWeekDays(weekStart) {
  return [0, 1, 2, 3, 4].map((offset) => {
    const date = datePlusDays(weekStart, offset);
    return { date, label: plannerDayLabel(date) };
  });
}

function syncPlannerWeeks() {
  const weeks = plannerVisibleWeeks();
  const current = activePlannerWeek || plannerCurrentWeek();
  activePlannerWeek = weeks.some((item) => item.week === current) ? current : (weeks[0]?.week || "all");
  renderPlannerWeekTabs(weeks, activePlannerWeek);
}

function renderPlannerWeekTabs(weeks, selectedWeek) {
  const tabs = document.querySelector("#plannerWeekTabs");
  if (!tabs) return;
  const currentStart = plannerCurrentWeekStart();
  const standardLabels = new Map([
    [datePlusDays(currentStart, -7), "Previous week"],
    [currentStart, "Current week"],
    [datePlusDays(currentStart, 7), "Next week"],
    [datePlusDays(currentStart, 14), "Following week"]
  ]);
  tabs.innerHTML = weeks.map((item) => {
    const label = standardLabels.get(item.weekStart) || "Planned week";
    return `
      <button class="planner-week-tab ${item.week === selectedWeek ? "active" : ""}" type="button" data-planner-week="${escapeHtml(item.week)}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(item.week.replace("WC ", ""))}</strong>
      </button>
    `;
  }).join("");
}

function isPlannerUnavailable(task) {
  const text = String(task || "").toLowerCase();
  return text.includes("holiday") || text.includes("course") || text.includes("training") || text.includes("sick");
}

function plannerTypeFromItem(item) {
  const selected = String(item?.type || "").trim();
  if (["Holiday", "Provisional", "Sick", "Other"].includes(selected)) return selected;
  const text = String(item?.task || "").toLowerCase();
  if (text.includes("sick")) return "Sick";
  if (text.includes("holiday")) return "Holiday";
  if (text.includes("provisional")) return "Provisional";
  return "Other";
}

function plannerText(item) {
  const notes = String(item?.task || "").trim();
  if (notes) return notes;
  return plannerTypeFromItem(item).toUpperCase();
}

function isPlannerItemUnavailable(item) {
  return ["Holiday", "Sick"].includes(plannerTypeFromItem(item));
}

function plannerAttendanceStatus(item) {
  const type = plannerTypeFromItem(item);
  if (type === "Sick") return "Sick";
  if (type === "Holiday") return "Holiday";
  return "";
}

function plannerSlotClass(item) {
  const type = plannerTypeFromItem(item);
  if (type === "Sick") return "planner-sick";
  if (type === "Holiday") return "planner-unavailable";
  if (type === "Provisional") return "planner-provisional";
  if (type === "Other") return "planner-other";
  return "planner-other";
}

function plannerUnavailableSlotCount(items) {
  return new Set(items
    .filter(isPlannerItemUnavailable)
    .map((item) => `${item.technician}|${item.date}|${item.session}`)
  ).size;
}

function plannerStaffForHolidayRequest(request = {}) {
  return staffProfiles.find((staff) => request.staffId && staff.staffId === request.staffId)
    || staffProfiles.find((staff) => request.name && staff.name === request.name)
    || {};
}

function approvedHolidayPlannerEntries(selectedWeek = plannerCurrentWeek()) {
  const selectedWeekStart = plannerWeekStartFromLabel(selectedWeek);
  const weekDates = new Set(plannerWeekDays(selectedWeekStart).map((day) => day.date));
  return holidayRequests.flatMap((request, index) => {
    if (holidayPlannerStatus(request) !== "Approved") return [];
    const staff = plannerStaffForHolidayRequest(request);
    const technician = staff.name || request.name || "";
    if (!technician) return [];
    return workingDateRangeValues(request.from, request.to || request.from)
      .filter((date) => selectedWeek === "all" || weekDates.has(date))
      .flatMap((date) => {
        const sessions = request.dayType === "Half day" ? [request.dayPart || "AM"] : ["AM", "PM"];
        return sessions.map((session) => ({
          date,
          technician,
          session,
          fullDay: request.dayType !== "Half day",
          request,
          requestIndex: index,
          staffId: request.staffId || staff.staffId || "",
          label: request.dayType === "Half day" ? `Annual Leave ${session}` : "Annual Leave"
        }));
      });
  });
}

function plannerLeaveLookup(entries = []) {
  const lookup = new Map();
  entries.forEach((entry) => {
    const key = `${entry.technician}|${entry.date}|${entry.session}`;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key).push(entry);
  });
  return lookup;
}

function plannerDerivedUnavailableSlotCount(entries = []) {
  return new Set(entries.map((entry) => `${entry.technician}|${entry.date}|${entry.session}`)).size;
}

function plannerLeaveIndicator(entry, conflict = false) {
  if (!entry) return "";
  const dates = entry.request.to && entry.request.to !== entry.request.from
    ? `${formatDateUk(entry.request.from)} to ${formatDateUk(entry.request.to)}`
    : formatDateUk(entry.request.from);
  const sessionLabel = entry.fullDay ? "" : entry.session || "";
  return `
    <button class="planner-leave-indicator${entry.fullDay ? " full-day" : ""}${conflict ? " conflict" : ""}" type="button" data-weekly-leave-open="${entry.requestIndex}" title="${escapeHtml(`${entry.technician} | ${dates}`)}">
      <span>${escapeHtml(entry.label)}</span>
      ${sessionLabel ? `<strong>${escapeHtml(sessionLabel)}</strong>` : ""}
    </button>
  `;
}

function plannerLeaveConflictWarning(entry) {
  if (!entry) return "";
  return `
    <div class="planner-conflict-warning" role="note">
      Approved leave and assigned job
    </div>
  `;
}

function plannerStatusLabel(item) {
  return plannerTypeFromItem(item).toUpperCase();
}

function isPlannerStatusText(text) {
  return ["HOLIDAY", "SICK", "PROVISIONAL", "OTHER"].includes(String(text || "").trim().toUpperCase());
}

function plannerOriginalJobText(previousItem, nextItem) {
  return String(previousItem?.originalTask || previousItem?.task || nextItem?.task || "").trim();
}

function plannerHasOriginalJob(previousItem, nextItem) {
  const originalText = plannerOriginalJobText(previousItem, nextItem);
  return Boolean(originalText) && !isPlannerStatusText(originalText);
}

async function validatePlannerJobDecision(item, previousItem) {
  if (!previousItem || !["Holiday", "Sick"].includes(plannerTypeFromItem(item)) || !plannerHasOriginalJob(previousItem, item)) {
    return true;
  }
  if (!["Reassign job", "Cancel job"].includes(item.jobAction)) {
    await kcInfo("This slot has a job booked. Please choose whether to reassign or cancel the job.");
    return false;
  }
  if (item.jobAction === "Reassign job" && !item.reassignTo) {
    await kcInfo("Please choose the technician to reassign this job to.");
    return false;
  }
  return true;
}

function matchingJobsForPlannerItem(item, jobText = "") {
  const postcode = normalisePostcode(jobText || item?.task || "");
  return jobs.filter((job) => {
    const sameDate = !item?.date || job.date === item.date;
    const sameTech = !item?.technician || job.technician === item.technician;
    const samePostcode = !postcode || normalisePostcode(`${job.postcode || ""} ${job.address || ""} ${job.title || ""} ${job.number || ""}`).includes(postcode);
    return sameDate && sameTech && samePostcode;
  });
}

function applyPlannerJobAction(item, previousItem) {
  if (!item || !previousItem) return [];
  const action = item.jobAction || "";
  const originalJobText = plannerOriginalJobText(previousItem, item);
  if (originalJobText) item.originalTask = originalJobText;

  if (action === "Reassign job" && item.reassignTo) {
    const reassignedItem = {
      ...previousItem,
      technician: item.reassignTo,
      task: originalJobText,
      type: "Other",
      jobAction: "",
      reassignTo: "",
      originalTask: originalJobText
    };
    applyPlannerMetadata(reassignedItem);
    matchingJobsForPlannerItem(previousItem, originalJobText).forEach((job) => {
      job.technician = item.reassignTo;
    });
    return [reassignedItem];
  }

  if (action === "Cancel job") {
    const jobsToRemove = new Set(matchingJobsForPlannerItem(previousItem, originalJobText));
    jobs = jobs.filter((job) => !jobsToRemove.has(job));
  }

  return [];
}

function filteredPlannerItems() {
  const week = activePlannerWeek || plannerCurrentWeek();
  return weeklyPlanner.filter((item) => {
    const matchesWeek = week === "all" || item.week === week;
    return matchesWeek;
  });
}

function filteredFines() {
  const term = document.querySelector("#fineSearch").value.trim().toLowerCase();
  const status = document.querySelector("#fineStatusFilter").value;

  return fines.filter((fine) => {
    const searchable = `${fine.registration} ${fine.driver} ${fine.location} ${fineTypeLabel(fine)} ${fine.notes} ${fineEvidenceLabel(fine)}`.toLowerCase();
    const matchesSearch = !term || searchable.includes(term);
    const matchesStatus = status === "all" || fine.status === status;
    return matchesSearch && matchesStatus;
  });
}

function attendanceFor(name, dateValue) {
  return attendanceRecords.find((record) => record.name === name && record.date === dateValue) || {
    date: dateValue,
    name,
    status: "Present",
    returnToWorkNotes: "",
    fitNote: ""
  };
}

function isUnavailableStatus(status) {
  return status === "Sick" || status === "Absent - Called in Sick" || status === "Holiday" || status === "Training" || status === "Unpaid leave" || status === "Absent";
}

function activeSicknessRestrictionFor(name, dateValue = today) {
  const records = attendanceRecords
    .filter((record) => record.name === name && isSickCallStatus(record.status))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  for (const record of records) {
    if (record.category === "Gastrointestinal (Vomiting/Diarrhoea)" && record.recoveryDate) {
      const restrictionEnd = datePlusDays(record.recoveryDate, 2);
      if (dateValue >= record.recoveryDate && dateValue < restrictionEnd) {
        return {
          type: "food-premises",
          label: "Active - Restricted from Food Premises",
          message: "48-hour restriction after gastrointestinal illness. Do not allocate to Commercial Kitchen, Food Premises or Catering work."
        };
      }
    }
    if (record.category === "Respiratory / Chest" && record.recoveryDate) {
      const warningEnd = datePlusDays(record.recoveryDate, 3);
      if (dateValue >= record.recoveryDate && dateValue <= warningEnd) {
        return {
          type: "rpe-warning",
          label: "Active - fitness check needed",
          message: "Verify the operative is fully fit for the planned task before work commences."
        };
      }
    }
  }
  return null;
}

function publicStaffStatus(name, dateValue = today) {
  const attendance = attendanceFor(name, dateValue);
  const restriction = activeSicknessRestrictionFor(name, dateValue);
  if (restriction) return restriction.label;
  if (isUnavailableStatus(attendance.status)) return `Unavailable - ${attendance.status}`;
  return "Active";
}

function staffStatusClass(status) {
  if (status === "Present") {
    return "ok";
  }
  if (status === "Late" || status === "Training") {
    return "warning";
  }
  return "urgent";
}

function attendanceYear(record) {
  return String(record.date || "").slice(0, 4);
}

function normalWorkingWeekdaysForStaff(staff = {}) {
  if (Array.isArray(staff.normalWorkingWeekdays) && staff.normalWorkingWeekdays.length) {
    return new Set(staff.normalWorkingWeekdays.map((day) => Number(day)).filter((day) => day >= 0 && day <= 6));
  }
  const pattern = String(staff.normalWorkingPattern || "").toLowerCase();
  if (/mon(day)?\s*(to|-)\s*fri(day)?|monday to friday|weekdays/.test(pattern)) return new Set([1, 2, 3, 4, 5]);
  const namedDays = [
    ["sunday", 0],
    ["monday", 1],
    ["tuesday", 2],
    ["wednesday", 3],
    ["thursday", 4],
    ["friday", 5],
    ["saturday", 6]
  ];
  const matched = namedDays.filter(([name]) => pattern.includes(name)).map(([, day]) => day);
  if (matched.length) return new Set(matched);
  const contractedDays = Math.round(Number(staff.contractedWorkingDaysPerWeek || staff.normalWorkingDays || 5));
  return new Set([1, 2, 3, 4, 5, 6, 0].slice(0, Math.max(0, Math.min(contractedDays, 7))));
}

function isoWeekday(dateValue) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? -1 : date.getUTCDay();
}

function staffBankHolidayDatesForYear(staff = {}, year = String(new Date().getFullYear())) {
  const weekdays = normalWorkingWeekdaysForStaff(staff);
  return new Set(ukBankHolidays
    .filter((holiday) => holiday.date.startsWith(year) && weekdays.has(isoWeekday(holiday.date)))
    .map((holiday) => holiday.date));
}

function holidayRequestDaysForYear(request, year, staff = null, excludedDates = new Set()) {
  const weekdays = staff ? normalWorkingWeekdaysForStaff(staff) : new Set([1, 2, 3, 4, 5]);
  const dates = workingDateRangeValues(request.from, request.to || request.from)
    .filter((date) => date.startsWith(year))
    .filter((date) => weekdays.has(isoWeekday(date)))
    .filter((date) => !excludedDates.has(date));
  if (!dates.length) return 0;
  if (request.dayType === "Half day" && request.from === request.to && dates.length === 1) return 0.5;
  return Number(request.days) && String(request.from || "").startsWith(year) && String(request.to || "").startsWith(year)
    ? Math.min(Number(request.days), dates.length)
    : dates.length;
}

function holidayUsedForYear(name, year = String(new Date().getFullYear())) {
  const staff = staffProfiles.find((profile) => profile.name === name) || {};
  const bankHolidayDates = staffBankHolidayDatesForYear(staff, year);
  const approvedRequestIds = new Set();
  const approvedDays = holidayRequests
    .filter((request) => request.name === name && request.status === "Approved")
    .reduce((sum, request) => {
      if (request.id) approvedRequestIds.add(request.id);
      return sum + holidayRequestDaysForYear(request, year, staff, bankHolidayDates);
    }, 0);
  const legacyDays = attendanceRecords
    .filter((record) =>
      record.name === name
      && record.status === "Holiday"
      && attendanceYear(record) === year
      && isWorkingWeekday(record.date)
      && record.source !== "holiday"
      && record.source !== "approved-holiday"
      && (!record.holidayRequestId || !approvedRequestIds.has(record.holidayRequestId))
      && !bankHolidayDates.has(record.date)
    )
    .reduce((sum, record) => sum + (record.dayType === "Half day" ? 0.5 : 1), 0);
  return approvedDays + legacyDays + bankHolidayDates.size;
}

function companyHolidayDatesForYear(year = String(new Date().getFullYear())) {
  const dates = new Set();
  companyHolidays.forEach((holiday) => {
    workingDateRangeValues(holiday.from, holiday.to)
      .filter((date) => date.startsWith(year))
      .forEach((date) => dates.add(date));
  });
  ukBankHolidays
    .filter((holiday) => holiday.date.startsWith(year))
    .forEach((holiday) => dates.add(holiday.date));
  return dates;
}

function companyHolidayDaysForYear(year = String(new Date().getFullYear())) {
  return companyHolidayDatesForYear(year).size;
}

function holidayCalendarEntriesForYear(year = String(new Date().getFullYear())) {
  const bank = ukBankHolidays
    .filter((holiday) => holiday.date.startsWith(year))
    .map((holiday) => ({ title: holiday.title, date: holiday.date, type: holiday.type }));
  const company = companyHolidays.flatMap((holiday) => workingDateRangeValues(holiday.from, holiday.to)
    .filter((date) => date.startsWith(year))
    .map((date) => ({
      title: holiday.title || holiday.type || "Company holiday",
      date,
      type: holiday.type || "Company holiday"
    })));
  return [...bank, ...company].sort((a, b) => a.date.localeCompare(b.date));
}

function sicknessDaysForYear(name, year = String(new Date().getFullYear())) {
  return new Set(attendanceRecords
    .filter((record) => record.name === name && isSickCallStatus(record.status) && attendanceYear(record) === year)
    .map((record) => record.date)
  ).size;
}

function totalHolidayAllowanceForYear(year = String(new Date().getFullYear())) {
  return staffProfiles.reduce((sum, staff) => sum + Number(staff.holidayAllowance || 0), 0);
}

function totalHolidayUsedForYear(year = String(new Date().getFullYear())) {
  return staffProfiles.reduce((sum, staff) => sum + holidayUsedForYear(staff.name, year), 0);
}

function totalSickDaysForYear(year = String(new Date().getFullYear())) {
  return staffProfiles.reduce((sum, staff) => sum + sicknessDaysForYear(staff.name, year), 0);
}

function staffLeaveSummary(staff, year = String(new Date().getFullYear())) {
  const allowance = Number(staff.holidayAllowance || 28);
  const taken = holidayUsedForYear(staff.name, year);
  const companyBankDeductions = staffBankHolidayDatesForYear(staff, year).size;
  const attendanceSummary = annualAttendanceSummary(staff, year);
  return {
    year,
    holidayAllowance: allowance,
    holidayTaken: taken,
    companyBankDeductions,
    holidayRemaining: allowance - taken,
    sickDays: attendanceSummary.sickDays
  };
}

function incidentHistoryForStaff(staff) {
  const profileNotes = String(staff.incidentHistory || "").trim();
  const attendanceIncidents = attendanceRecords
    .filter((record) => record.name === staff.name && record.workplaceIncident)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((record) => `${formatDateUk(record.date)} - ${record.workplaceIncident}`);
  return [profileNotes, ...attendanceIncidents].filter(Boolean);
}

function occupationalRiddorAlerts() {
  const alerts = [];
  staffProfiles.forEach((staff) => {
    const dates = [...new Set(attendanceRecords
      .filter((record) => record.name === staff.name && isSickCallStatus(record.status) && (record.category === "Occupational Sick Leave / Industrial Injury" || (record.category === "Musculoskeletal / Physical Injury" && record.workplaceInjury === "Yes")))
      .map((record) => record.date)
      .filter(Boolean)
      .sort())];
    let streak = 0;
    let previous = null;
    dates.forEach((date) => {
      const current = new Date(`${date}T00:00:00`);
      const consecutive = previous && ((current - previous) / 86400000) === 1;
      streak = consecutive ? streak + 1 : 1;
      previous = current;
      if (streak > 7 && !alerts.some((alert) => alert.name === staff.name)) {
        alerts.push({
          name: staff.name,
          message: "CRITICAL: Employee absent for >7 days due to workplace injury/illness. Evaluate if a RIDDOR notification to the HSE is required."
        });
      }
    });
  });
  return alerts;
}

function trainingDaysForYear(name, year = String(new Date().getFullYear())) {
  return new Set(attendanceRecords
    .filter((record) => record.name === name && record.status === "Training" && attendanceYear(record) === year)
    .map((record) => record.date)
  ).size;
}

function staffAttendanceHistory(name, limit = 10) {
  return attendanceRecords
    .filter((record) => record.name === name)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, limit);
}

function openStaffDetail(index) {
  const staff = staffProfiles[Number(index)];
  if (!staff || !staffDetailDialog || !staffDetailTitle || !staffDetailBody) return;

  const currentYear = String(new Date().getFullYear());
  const attendance = attendanceFor(staff.name, today);
  const holidayAllowance = Number(staff.holidayAllowance || 28);
  const leaveSummary = staffLeaveSummary(staff, currentYear);
  const holidayUsed = leaveSummary.holidayTaken;
  const holidayRemaining = leaveSummary.holidayRemaining;
  const sicknessDays = leaveSummary.sickDays;
  const trainingDays = trainingDaysForYear(staff.name, currentYear);
  const companyHolidayDays = companyHolidayDaysForYear(currentYear);
  const history = staffAttendanceHistory(staff.name);
  const incidents = incidentHistoryForStaff(staff);

  staffDetailTitle.textContent = staff.name;
  staffDetailBody.innerHTML = `
    <section class="staff-profile-hero">
      <div>
        <span class="profile-kicker">${escapeHtml(staff.role || "Staff member")}</span>
        <h3>${escapeHtml(staff.name)} ${testRecordBadge(staff)}</h3>
        <p>${escapeHtml(staff.email || "No email")} | ${escapeHtml(staff.phone || "No phone")}</p>
      </div>
      <span class="status ${staffStatusClass(attendance.status)}">${escapeHtml(attendance.status)}</span>
    </section>

    <section class="staff-detail-grid">
      <article class="staff-detail-card">
        <span>Holiday used ${currentYear}</span>
        <strong>${holidayUsed}</strong>
        <p>${holidayRemaining} remaining from ${holidayAllowance} days</p>
      </article>
      <article class="staff-detail-card">
        <span>Company / bank holidays</span>
        <strong>${companyHolidayDays}</strong>
        <p>Included in the holiday balance</p>
      </article>
      <article class="staff-detail-card">
        <span>Sick days ${currentYear}</span>
        <strong>${sicknessDays}</strong>
        <p>General and occupational sickness records</p>
      </article>
      <article class="staff-detail-card">
        <span>Training days ${currentYear}</span>
        <strong>${trainingDays}</strong>
        <p>Training attendance logged in the Hub</p>
      </article>
      <article class="staff-detail-card">
        <span>Assigned van</span>
        <strong>${escapeHtml(staff.assignedVan || "Not set")}</strong>
        <p>Used for dispatch and availability checks</p>
      </article>
      <article class="staff-detail-card">
        <span>Emergency contact</span>
        <strong>${escapeHtml(staff.emergencyContact || "Not set")}</strong>
        <p>Keep this up to date</p>
      </article>
    </section>

    <section class="staff-work-records">
      <div class="panel-heading">
        <h3>Employee Records</h3>
      </div>
      <div class="staff-detail-grid">
        <article class="staff-detail-card">
          <span>Total holidays taken</span>
          <strong>${leaveSummary.holidayTaken}</strong>
          <p>Working weekdays only</p>
        </article>
        <article class="staff-detail-card">
          <span>Remaining leave</span>
          <strong>${leaveSummary.holidayRemaining}</strong>
          <p>Allowance ${leaveSummary.holidayAllowance}, bank/company ${leaveSummary.companyBankDeductions}</p>
        </article>
        <article class="staff-detail-card">
          <span>Total sick days</span>
          <strong>${leaveSummary.sickDays}</strong>
          <p>Registered in ${currentYear}</p>
        </article>
        <article class="staff-detail-card">
          <span>Emergency / next of kin</span>
          <strong>${escapeHtml(staff.emergencyContact || "Not set")}</strong>
          <p>${escapeHtml(staff.nextOfKin ? `Next of kin: ${staff.nextOfKin}` : "Next of kin not set")}</p>
        </article>
      </div>
    </section>

    <section class="staff-detail-grid">
      <article class="staff-detail-card staff-detail-wide">
        <span>Training and qualifications</span>
        <div class="staff-detail-lines">
          <p><strong>Training:</strong> ${escapeHtml(staff.trainingRecords || "Not set")}</p>
          <p><strong>Qualifications:</strong> ${escapeHtml(staff.qualifications || "Not set")}</p>
          <p><strong>Driving licence:</strong> ${escapeHtml(staff.drivingLicence || "Not set")}</p>
          <p><strong>Notes:</strong> ${escapeHtml(staff.notes || "No notes")}</p>
        </div>
      </article>
      <article class="staff-detail-card staff-detail-wide">
        <span>Internal Accident / Incident Log</span>
        <div class="staff-detail-lines">
          ${incidents.length ? incidents.map((incident) => `<p>${escapeHtml(incident)}</p>`).join("") : '<p>No internal accident or incident records logged.</p>'}
        </div>
      </article>
    </section>

    <section class="staff-detail-history">
      <div class="panel-heading">
        <h3>Recent Attendance</h3>
      </div>
      <div class="staff-history-list">
        ${history.length ? history.map((record) => `
          <div class="staff-history-row">
            <span>${formatDateUk(record.date)}</span>
            <strong>${escapeHtml(record.status)}</strong>
            <em>${escapeHtml(record.category || record.returnToWorkNotes || record.notes || "No notes")}</em>
          </div>
        `).join("") : '<p class="empty-state">No attendance history logged yet.</p>'}
      </div>
    </section>

    <div class="staff-detail-actions">
      <button class="primary-button" type="button" data-staff-detail-edit="${index}">Edit Staff Member</button>
      <button class="secondary-button" type="button" data-staff-detail-attendance="${escapeHtml(staff.name)}">Log Sick / Late / Absent</button>
      <button class="secondary-button" type="button" data-staff-detail-holiday="${escapeHtml(staff.name)}">Book Holiday</button>
    </div>
  `;
  staffDetailDialog.showModal();
}

function trainingStatus(record) {
  const lifecycleStatus = String(record.lifecycleStatus || record.recordStatus || "").trim();
  if (["Not Applicable", "Superseded", "Inactive", "Missing / Not Recorded"].includes(lifecycleStatus)) {
    return {
      label: lifecycleStatus,
      className: lifecycleStatus === "Missing / Not Recorded" ? "warning" : "muted",
      days: 9999
    };
  }
  if (record.noExpiry) {
    return { label: "No Expiry", className: "ok", days: 9999 };
  }
  const days = daysUntil(record.expiryDate);
  if (!record.expiryDate) {
    return { label: "No Expiry", className: "ok", days: 9999 };
  }
  if (days < 0) {
    return { label: "Expired", className: "urgent", days };
  }
  if (days <= 60) {
    return { label: "Expiring Soon", className: "warning", days };
  }
  return { label: "Current", className: "ok", days };
}

function syncStaffTrainingFromMatrix() {
  staffProfiles = staffProfiles.map((staff) => {
    const records = trainingMatrix.filter((record) => (record.staffId && record.staffId === staff.staffId) || record.employee === staff.name);
    if (records.length === 0) {
      return staff;
    }

    const trainingSummary = records
      .map((record) => `${record.course}${record.expiryDate ? ` expires ${record.expiryDate}` : ""}`)
      .join(", ");
    const qualificationSummary = records
      .map((record) => record.course)
      .join(", ");

    return {
      ...staff,
      trainingRecords: trainingSummary,
      qualifications: qualificationSummary
    };
  });
}

function staffLooksLikeTechnician(staff) {
  return `${staff.role} ${staff.notes}`.toLowerCase().includes("technician");
}

function syncTechniciansFromStaff() {
  const existingByName = Object.fromEntries(technicians.map((tech) => [tech.name, tech]));
  technicians = staffProfiles
    .filter(staffLooksLikeTechnician)
    .map((staff) => {
      const existing = existingByName[staff.name] || {};
      return {
        name: staff.name,
        staffId: staff.staffId || existing.staffId || "",
        technicianId: staff.technicianId || existing.technicianId || "",
        status: staff.status || existing.status || "Active",
        role: staff.role,
        phone: staff.phone,
        assignedVehicleId: existing.assignedVehicleId || staff.assignedVehicleId || "",
        van: staff.assignedVan || existing.van || "",
        location: existing.location || "Set location",
        training: staff.trainingRecords || existing.training || "",
        appAccessStatus: existing.appAccessStatus || "Active",
        lastAppActivityAt: existing.lastAppActivityAt || "",
        pinSet: existing.pinSet !== false
      };
    });
}

function technicianNameOptions() {
  const names = [
    ...technicians.map((tech) => tech.name),
    ...staffProfiles.filter(staffLooksLikeTechnician).map((staff) => staff.name),
    ...jobs.map((job) => job.technician)
  ]
    .map((name) => String(name || "").trim())
    .filter(Boolean);

  return ["N/A", ...[...new Set(names)].sort((a, b) => a.localeCompare(b))];
}

function populateTechnicianSelect(select, selectedValue = "N/A") {
  if (!select) return;
  const options = technicianNameOptions();
  const selected = selectedValue || select.value || "N/A";
  if (selected && !options.includes(selected)) {
    options.push(selected);
  }

  select.innerHTML = options
    .map((name) => `<option value="${escapeHtml(name)}"${name === selected ? " selected" : ""}>${escapeHtml(name)}</option>`)
    .join("");
}

function refreshTechnicianDropdowns() {
  populateTechnicianSelect(fields.technician, fields.technician?.value || "N/A");
  populateTechnicianSelect(ramsBuildTechnician, ramsBuildTechnician?.value || "N/A");
}

function filteredStaff() {
  const term = (document.querySelector("#staffSearch")?.value || "").trim().toLowerCase();
  const attendance = document.querySelector("#attendanceStatusFilter")?.value || "all";

  return staffProfiles.filter((staff) => {
    const todayRecord = attendanceFor(staff.name, today);
    const searchable = `${staff.name} ${staff.role} ${staff.assignedVan} ${staff.trainingRecords} ${staff.qualifications} ${staff.notes}`.toLowerCase();
    const matchesSearch = !term || searchable.includes(term);
    const matchesAttendance = attendance === "all" || todayRecord.status === attendance;
    return matchesSearch && matchesAttendance;
  });
}

function filteredRams() {
  const term = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;

  return ramsItems.filter((item) => {
    const searchable = `${item.title} ${item.client} ${item.job} ${item.technician || ""} ${item.fileLocation || ""}`.toLowerCase();
    const matchesSearch = !term || searchable.includes(term);
    const itemStatus = normaliseRamsStatus(item);
    const matchesStatus = status === "all" || itemStatus === status;
    return matchesSearch && matchesStatus;
  });
}

function renderSummary() {
  document.querySelector("#totalCount").textContent = ramsItems.length;
  document.querySelector("#attachedCount").textContent = ramsItems.filter((item) => item.job || ["attached", "sent", "sent-client", "sent-tech", "read"].includes(normaliseRamsStatus(item))).length;
  document.querySelector("#sentCount").textContent = ramsItems.filter((item) => item.sentDate || normaliseRamsStatus(item) === "sent-client" || normaliseRamsStatus(item) === "read").length;
  document.querySelector("#needsSendingCount").textContent = ramsItems.filter(ramsNeedsAction).length;
}

function syncDashboardJobFilters(defaultDate = today) {
  const dateFilter = document.querySelector("#dashboardJobDateFilter");
  const techFilter = document.querySelector("#dashboardTechnicianFilter");
  const statusFilter = document.querySelector("#dashboardStatusFilter");
  const dashboardJobs = dashboardJobSource();

  if (dateFilter && !dateFilter.value) {
    dateFilter.value = defaultDate;
  }

  if (techFilter) {
    const selected = techFilter.value || "all";
    const technicianNames = Array.from(new Set(
      technicians
        .filter((tech) => !isDashboardTestRecord(tech))
        .map((tech) => tech.name)
        .concat(dashboardJobs.map((job) => job.technician))
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
    techFilter.innerHTML = '<option value="all">All technicians</option>'
      + technicianNames.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    techFilter.value = technicianNames.includes(selected) ? selected : "all";
  }

  if (statusFilter) {
    const selected = statusFilter.value || "all";
    const statusNames = Array.from(new Set(dashboardJobs.map(dashboardJobStatusLabel).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    statusFilter.innerHTML = '<option value="all">All statuses</option>'
      + statusNames.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("");
    statusFilter.value = statusNames.includes(selected) ? selected : "all";
  }
}

function renderDashboard() {
  enhanceDashboardCards();
  const valuationTotals = monthlyValuationTotals();
  const gateJobs = reportGateJobs();
  const dashboardJobs = dashboardJobSource();
  const dashboardVehicles = vehicles.filter((vehicle) => !isDashboardTestRecord(vehicle));
  const todayJobs = dashboardJobs.filter((job) => job.date === today);
  const tomorrowJobs = dashboardJobs.filter((job) => job.date === tomorrow);
  syncDashboardJobFilters(today);
  const dashboardDate = document.querySelector("#dashboardJobDateFilter")?.value || today;
  const dashboardTechnician = document.querySelector("#dashboardTechnicianFilter")?.value || "all";
  const dashboardStatus = document.querySelector("#dashboardStatusFilter")?.value || "all";
  const dashboardDiaryJobs = dashboardJobs
    .filter((job) => job.date === dashboardDate)
    .filter((job) => dashboardTechnician === "all" || job.technician === dashboardTechnician)
    .filter((job) => dashboardStatus === "all" || dashboardJobStatusLabel(job) === dashboardStatus)
    .sort((a, b) => `${a.slot || a.jobSlot || a.session || ""}${a.number || ""}`.localeCompare(`${b.slot || b.jobSlot || b.session || ""}${b.number || ""}`));
  const awaitingReports = dashboardJobs.filter((job) => job.report === "Awaiting" || !jobReportReceived(job));
  const vehicleAlerts = dashboardVehicles.filter((vehicle) => vehicle.tracker !== "Active" || isReminderDate(vehicle.mot) || isReminderDate(vehicle.insurance) || isReminderDate(vehicle.service));
  const ramsNeedingAction = ramsItems.filter(ramsNeedsAction);
  const pendingHolidayRequests = holidayRequests.filter((request) => request.status === "Pending");
  document.querySelector("#jobsTodayCount").textContent = todayJobs.length;
  document.querySelector("#jobsTomorrowCount").textContent = tomorrowJobs.length;
  document.querySelector("#reportsDueCount").textContent = awaitingReports.length;
  const ramsDashboardCount = document.querySelector("#ramsToSendDashboardCount");
  if (ramsDashboardCount) ramsDashboardCount.textContent = ramsNeedingAction.length;
  document.querySelector("#valuationMonthLabel").textContent = monthLabel();
  document.querySelector("#valuationDueLabel").textContent = ` | Valuation due ${lastWorkingDayOfMonth()}`;
  document.querySelector("#arkMonthTotal").textContent = money(valuationTotals.ark);
  document.querySelector("#jgMonthTotal").textContent = money(valuationTotals.jg);
  document.querySelector("#privateMonthTotal").textContent = money(valuationTotals.private);
  document.querySelector("#vergoMonthTotal").textContent = money(valuationTotals.vergo);
  const valuationDashboardMonthTotal = document.querySelector("#valuationDashboardMonthTotal");
  if (valuationDashboardMonthTotal) {
    valuationDashboardMonthTotal.textContent = money(valuationTotals.ark + valuationTotals.jg + valuationTotals.private + valuationTotals.vergo);
  }
  document.querySelector("#vehicleAlertCount").textContent = vehicleAlerts.length;
  document.querySelector("#motReminderCount").textContent = dashboardVehicles.filter((vehicle) => isReminderDate(vehicle.mot)).length;
  document.querySelector("#insuranceReminderCount").textContent = dashboardVehicles.filter((vehicle) => isReminderDate(vehicle.insurance)).length;
  const documentSummary = companyDocumentReminderSummary();
  const criticalDocumentAlertCount = document.querySelector("#criticalDocumentAlertCount");
  const expiredDocumentAlertCount = document.querySelector("#expiredDocumentAlertCount");
  if (criticalDocumentAlertCount) criticalDocumentAlertCount.textContent = documentSummary.criticalExpiring;
  if (expiredDocumentAlertCount) expiredDocumentAlertCount.textContent = documentSummary.expired;
  const trainingRows = trainingMatrix.map((record) => ({ ...record, status: trainingStatus(record) }));
  const trainingExpiredDashboardCount = document.querySelector("#trainingExpiredDashboardCount");
  const trainingThirtyDayDashboardCount = document.querySelector("#trainingThirtyDayDashboardCount");
  if (trainingExpiredDashboardCount) trainingExpiredDashboardCount.textContent = trainingRows.filter((record) => record.status.className === "urgent").length;
  if (trainingThirtyDayDashboardCount) trainingThirtyDayDashboardCount.textContent = trainingRows.filter((record) => !record.noExpiry && record.status.days >= 0 && record.status.days <= 30).length;
  const compliance = complianceRecords().map((item) => ({ ...item, status: complianceStatus(item) }));
  const complianceDueSoon = compliance.filter((item) => Number.isFinite(item.status.days) && item.status.days >= 0 && item.status.days <= 30);
  const complianceOverdue = compliance.filter((item) => item.status.className === "red");
  document.querySelector("#complianceDueCount").textContent = complianceDueSoon.length;
  document.querySelector("#complianceOverdueCount").textContent = complianceOverdue.length;
  document.querySelector("#fineDeadlineCount").textContent = fines.filter(isFineDeadlineSoon).length;
  document.querySelector("#openFineCount").textContent = fines.filter(isFineOpen).length;
  const todayAttendance = staffProfiles.map((staff) => attendanceFor(staff.name, today));
  document.querySelector("#staffAvailableCount").textContent = todayAttendance.filter((record) => !isUnavailableStatus(record.status)).length;
  document.querySelector("#staffUnavailableCount").textContent = todayAttendance.filter((record) => isUnavailableStatus(record.status)).length;
  const urgentAttentionCount = gateJobs.length
    + ramsNeedingAction.length
    + complianceOverdue.length
    + vehicleAlerts.length
    + fines.filter(isFineDeadlineSoon).length
    + pendingHolidayRequests.length;
  const urgentAttentionTarget = document.querySelector("#urgentAttentionCount");
  if (urgentAttentionTarget) urgentAttentionTarget.textContent = urgentAttentionCount;
  setDashboardKpiAlertState("#urgentAttentionCount", urgentAttentionCount, "overdue");
  setDashboardKpiAlertState("#reportsDueCount", awaitingReports.length, "warning");
  setDashboardKpiAlertState("#ramsToSendDashboardCount", ramsNeedingAction.length, "warning");
  renderDashboardHolidayRequests();
  if (document.body.dataset.activeSection === "dashboard") {
    startDashboardRevolutAutoRefresh({ immediate: true });
  }

  const todayJobsTarget = document.querySelector("#dashboardTodayJobs");
  if (todayJobsTarget) {
    const emptyDiaryMessage = dashboardDate === today && dashboardTechnician === "all" && dashboardStatus === "all"
      ? "No jobs scheduled for today."
      : "No jobs match this view.";
    todayJobsTarget.innerHTML = dashboardDiaryJobs.length
      ? dashboardDiaryJobs
        .slice(0, 10)
        .map((job) => dashboardJobRow(job))
        .join("")
      : `<tr><td colspan="8"><p class="empty-state compact-empty">${emptyDiaryMessage}</p></td></tr>`;
  }

  const techStatusTarget = document.querySelector("#dashboardTechnicianStatus");
  if (techStatusTarget) {
    const visibleTechnicians = technicians.filter((tech) => !isDashboardTestRecord(tech));
    const technicianStates = visibleTechnicians.map((tech) => dashboardTechnicianState(tech));
    const connectedCount = technicianStates.filter((item) => item.state.key === "connected").length;
    const offlineCount = technicianStates.filter((item) => item.state.key === "offline").length;
    const onJobCount = technicianStates.filter((item) => item.currentJob).length;
    techStatusTarget.innerHTML = visibleTechnicians.length
      ? `
        <div class="dashboard-tech-summary" aria-label="Technician status summary">
          <strong>${connectedCount} connected</strong>
          <span>${offlineCount} offline</span>
          <span>${onJobCount} on jobs</span>
        </div>
        <div class="dashboard-tech-list">
          ${technicianStates
            .slice(0, 8)
            .map(({ tech, currentJob, state }) => dashboardTechnicianRow(tech, currentJob, state))
            .join("")}
        </div>
      `
      : '<p class="empty-state compact-empty">No technicians loaded yet.</p>';
  }

  const notificationTarget = document.querySelector("#dashboardNotifications");
  if (notificationTarget) {
    const notificationRows = [
      pendingHolidayRequests.length ? ["Holiday requests", `${pendingHolidayRequests.length} pending request${pendingHolidayRequests.length === 1 ? "" : "s"}`, "warning"] : null,
      trainingRows.filter((record) => record.status.className === "urgent").length ? ["Training expired", `${trainingRows.filter((record) => record.status.className === "urgent").length} expired record${trainingRows.filter((record) => record.status.className === "urgent").length === 1 ? "" : "s"}`, "urgent"] : null,
      complianceOverdue.length ? ["Compliance overdue", `${complianceOverdue.length} overdue item${complianceOverdue.length === 1 ? "" : "s"}`, "urgent"] : null
    ].filter(Boolean);
    notificationTarget.innerHTML = notificationRows.length
      ? notificationRows.map(([title, detail, badge]) => dashboardAlertRow(title, detail, badge)).join("")
      : '<p class="empty-state compact-empty">No urgent notifications.</p>';
  }

  const vehicleAlertTarget = document.querySelector("#dashboardVehicleAlerts");
  if (vehicleAlertTarget) {
    vehicleAlertTarget.innerHTML = vehicleAlerts.length
      ? vehicleAlerts
        .slice(0, 5)
        .map((vehicle) => {
          const issue = vehicle.tracker !== "Active" ? "Tracker check" : isReminderDate(vehicle.mot) ? "MOT reminder" : isReminderDate(vehicle.service) ? "Service reminder" : "Insurance reminder";
          return dashboardAlertRow(vehicle.registration || vehicle.vehicle || "Vehicle", `${issue} | ${vehicle.driver || "No driver"}`, "warning");
        })
        .join("")
      : '<p class="empty-state compact-empty">No vehicle alerts.</p>';
  }

  document.querySelector("#dashboardJobs").innerHTML = todayJobs.concat(tomorrowJobs)
    .map((job) => listRow(`${job.number} - ${job.title}`, `${job.date} | ${job.client} | ${job.technician}`, job.status))
    .join("");

  document.querySelector("#technicianLocations").innerHTML = technicians
    .map((tech) => listRow(tech.name, `${tech.location || "Location not available"} | ${tech.van || "No van"}`, tech.appStatus || "Not connected"))
    .join("");

  document.querySelector("#reportGateList").innerHTML = gateJobs.length
    ? gateJobs
      .slice(0, 8)
      .map((job) => listRow(
        `${job.technician || "Unassigned"} - report needed`,
        `${formatDateUk(job.date)} | ${job.number || "No ref"} | ${job.address || job.title || "Job"}`,
        "Blocks next work"
      ))
      .join("")
    : '<p class="empty-state">No report blocks. Tomorrow\'s work can be released.</p>';

  document.querySelector("#dashboardCompliance").innerHTML = compliance
    .filter((item) => item.status.className !== "green")
    .sort((a, b) => a.status.days - b.status.days)
    .slice(0, 6)
    .map((item) => dashboardAlertRow(`${item.complianceType} - ${item.title}`, `${item.responsiblePerson} | ${item.noExpiry ? "No expiry" : `Due ${formatDateUk(item.expiryDate)}`}`, item.status.className === "red" ? "urgent" : "warning"))
    .join("") || '<p class="empty-state compact-empty">No compliance reminders.</p>';

  updateDashboardBadges();
}

let dashboardRevolutBalanceLoading = false;
let dashboardRevolutBalanceLoadedAt = 0;
let dashboardRevolutBalanceTimer = null;
let dashboardRevolutLastSuccess = null;
const dashboardRevolutRefreshIntervalMs = 5 * 60 * 1000;

function setRevolutLowBalanceState(card, availableBalance) {
  if (!card) return false;
  const isLowBalance = Number.isFinite(Number(availableBalance)) && Number(availableBalance) < 100;
  card.classList.toggle("is-low-balance", isLowBalance);
  return isLowBalance;
}

function setDashboardRevolutText(balanceText, statusText, updatedText) {
  const balanceTarget = document.querySelector("#dashboardRevolutBalance");
  const statusTarget = document.querySelector("#dashboardRevolutStatus");
  const updatedTarget = document.querySelector("#dashboardRevolutUpdated");
  if (balanceTarget) balanceTarget.textContent = balanceText;
  if (statusTarget) {
    statusTarget.textContent = statusText === "Low balance" ? "Low balance" : "";
    statusTarget.classList.toggle("hidden", statusText !== "Low balance");
  }
  if (updatedTarget) updatedTarget.textContent = updatedText;
}

async function refreshDashboardRevolutBalance(options = {}) {
  const manual = options.manual === true;
  const force = options.force === true;
  const card = document.querySelector("#dashboardRevolutCard");
  if (!card) return;
  if (!isDirectorLocalUser() || !directorSession) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  const now = Date.now();
  if (!force && !manual && dashboardRevolutBalanceLoadedAt && now - dashboardRevolutBalanceLoadedAt < 60000) return;
  if (dashboardRevolutBalanceLoading) return;

  const authGeneration = directorAuthGeneration;
  dashboardRevolutBalanceLoading = true;
  setDashboardRevolutText(
    document.querySelector("#dashboardRevolutBalance")?.textContent || "Unavailable",
    "",
    document.querySelector("#dashboardRevolutUpdated")?.textContent || "Last updated: not yet"
  );

  try {
    const response = await fetch("/api/revolut/gbp-balance", {
      cache: "no-store",
      credentials: "same-origin"
    });
    const payload = await response.json().catch(() => ({}));
    if (authGeneration !== directorAuthGeneration) return;
    if ([401, 403].includes(response.status)) {
      lockHub();
      return;
    }
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || "Revolut balance is unavailable.");
    }
    dashboardRevolutBalanceLoadedAt = Date.now();
    const updatedLabel = payload.lastUpdatedAt
      ? `Last updated: ${formatDateTimeUkShort(payload.lastUpdatedAt)}`
      : "Last updated: just now";
    if (!payload.connected) {
      setRevolutLowBalanceState(card, NaN);
      setDashboardRevolutText("Unavailable", "", "Last updated: not yet");
    } else if (!payload.activeGbpAccountFound || !Number.isFinite(Number(payload.availableBalance))) {
      setRevolutLowBalanceState(card, NaN);
      setDashboardRevolutText("Unavailable", "", updatedLabel);
    } else {
      const isLowBalance = setRevolutLowBalanceState(card, payload.availableBalance);
      dashboardRevolutLastSuccess = {
        balanceText: money(payload.availableBalance),
        statusText: isLowBalance ? "Low balance" : payload.status || "Connected",
        updatedText: updatedLabel,
        availableBalance: payload.availableBalance
      };
      setDashboardRevolutText(dashboardRevolutLastSuccess.balanceText, dashboardRevolutLastSuccess.statusText, dashboardRevolutLastSuccess.updatedText);
    }
  } catch (error) {
    if (authGeneration !== directorAuthGeneration) return;
    if (dashboardRevolutLastSuccess) {
      setRevolutLowBalanceState(card, dashboardRevolutLastSuccess.availableBalance);
      setDashboardRevolutText(dashboardRevolutLastSuccess.balanceText, dashboardRevolutLastSuccess.statusText, dashboardRevolutLastSuccess.updatedText);
    } else {
      setRevolutLowBalanceState(card, NaN);
      setDashboardRevolutText("Unavailable", "", "Last updated: not yet");
    }
  } finally {
    dashboardRevolutBalanceLoading = false;
  }
}

function startDashboardRevolutAutoRefresh(options = {}) {
  const card = document.querySelector("#dashboardRevolutCard");
  if (!card || !isDirectorLocalUser() || !directorSession) return;
  if (options.immediate) {
    refreshDashboardRevolutBalance({ force: true });
  }
  if (dashboardRevolutBalanceTimer) return;
  dashboardRevolutBalanceTimer = window.setInterval(() => {
    if (document.body.dataset.activeSection !== "dashboard") {
      stopDashboardRevolutAutoRefresh();
      return;
    }
    refreshDashboardRevolutBalance({ force: true });
  }, dashboardRevolutRefreshIntervalMs);
}

function stopDashboardRevolutAutoRefresh() {
  if (document.body.dataset.activeSection !== "dashboard") {
    document.querySelector("#dashboardRevolutCard")?.classList.add("hidden");
  }
  if (!dashboardRevolutBalanceTimer) return;
  window.clearInterval(dashboardRevolutBalanceTimer);
  dashboardRevolutBalanceTimer = null;
}

function setDashboardKpiAlertState(selector, count, alertClassName) {
  const card = document.querySelector(selector)?.closest(".dashboard-kpi-card");
  if (!card) return;
  card.classList.remove("normal", "warning", "overdue", "has-alert");
  if (Number(count) > 0) {
    card.classList.add(alertClassName, "has-alert");
  } else {
    card.classList.add("normal");
  }
}

function dashboardJobRow(job) {
  const slot = job.slot || job.jobSlot || job.session || "No slot";
  const postcode = job.postcode || postcodeFromText(job.address) || "No postcode";
  const status = dashboardJobStatusLabel(job);
  const badgeClassName = dashboardStatusClass(status);
  const clientType = jobClientType(job);
  const action = job.phase05eReadOnly && job.phase05eReport?.reportId
    ? `<button class="secondary-button compact-alert-button" type="button" data-open-phase05e-report="${escapeHtml(job.phase05eReport.reportId)}">Open</button>`
    : '<button class="secondary-button compact-alert-button" type="button" data-jump-section="diary">Open</button>';
  return `
    <tr class="dashboard-job-row ${clientType.accentClassName}" data-client-accent="${escapeHtml(clientType.key)}">
      <td><span class="dashboard-row-slot">${escapeHtml(slot)}</span></td>
      <td><strong>${escapeHtml(job.number || job.reference || "No ref")}</strong></td>
      <td><span class="job-client-badge ${clientType.className}">${escapeHtml(clientType.label || job.client || "No client")}</span></td>
      <td><strong>${escapeHtml(job.title || job.address || "Job")}</strong></td>
      <td>${escapeHtml(postcode)}</td>
      <td>${escapeHtml(job.technician || "Unassigned")}</td>
      <td><span class="status ${badgeClassName}">${escapeHtml(status)}</span></td>
      <td>${action}</td>
    </tr>
  `;
}

function dashboardJobStatusLabel(job) {
  if (phase05eReportForJob(job)) return "Completed - Report Submitted";
  if (job.status) return job.status;
  if (job.report === "Awaiting" || !jobReportReceived(job)) return "Awaiting report";
  if (job.sentToTech || job.publishedToTech) return "Sent to Tech";
  return "Booked";
}

function dashboardStatusClass(status) {
  const normalised = String(status || "").toLowerCase();
  if (normalised.includes("urgent") || normalised.includes("not completed") || normalised.includes("overdue") || normalised.includes("attention")) return "urgent";
  if (normalised.includes("awaiting") || normalised.includes("rams") || normalised.includes("draft") || normalised.includes("saved")) return "warning";
  if (normalised.includes("complete") || normalised.includes("sent") || normalised.includes("booked")) return "ok";
  return "warning";
}

function isDashboardTestRecord(record) {
  const status = String(record?.status || "").toLowerCase();
  return record?.isTestRecord === true || status === "archived test" || status === "test only";
}

function dashboardTestTechnicianNames() {
  return new Set(
    technicians
      .concat(staffProfiles)
      .filter((record) => isDashboardTestRecord(record))
      .map((record) => String(record.name || "").trim())
      .filter(Boolean)
  );
}

function dashboardTechnicianState(tech) {
  const currentJob = jobs
    .filter((job) => job.technician === tech.name && job.date >= today)
    .sort((a, b) => `${a.date || ""}${a.slot || ""}`.localeCompare(`${b.date || ""}${b.slot || ""}`))[0];
  const attendance = attendanceFor(tech.name, today);
  const unavailable = isUnavailableStatus(attendance.status);
  const appStatus = tech.appStatus || tech.connectionStatus || "Not connected";
  const normalisedStatus = String(appStatus || "").toLowerCase();
  let state = { key: "uncertain", label: "Status unknown", className: "attention" };
  if (normalisedStatus.includes("fault") || normalisedStatus.includes("error")) {
    state = { key: "fault", label: "Fault", className: "urgent" };
  } else if (unavailable || normalisedStatus.includes("offline") || normalisedStatus.includes("not connected") || normalisedStatus.includes("disconnected")) {
    state = { key: "offline", label: "Offline", className: "offline" };
  } else if (normalisedStatus.includes("connected") || normalisedStatus.includes("online") || normalisedStatus.includes("active") || normalisedStatus.includes("available")) {
    state = { key: "connected", label: currentJob ? "On job" : "Available", className: "online" };
  }
  return { tech, currentJob, state };
}

function dashboardTechnicianRow(tech, currentJob, state) {
  const locationStatus = tech.locationStatus || tech.location || "Location not available";
  return `
    <article class="dashboard-row dashboard-tech-row">
      <span class="dashboard-status-dot ${state.className}"></span>
      <div class="dashboard-row-main">
        <strong>${escapeHtml(tech.name || "Technician")}</strong>
        <p>${escapeHtml(currentJob ? `${currentJob.slot || "Job"} | ${currentJob.postcode || postcodeFromText(currentJob.address) || currentJob.client || "Next job"}` : "No current job loaded")}</p>
      </div>
      <div class="dashboard-row-meta">
        <span>${escapeHtml(state.label)}</span>
        <small>${escapeHtml(locationStatus)}</small>
      </div>
    </article>
  `;
}

function dashboardAlertRow(title, detail, badgeClassName = "warning") {
  const label = badgeClassName === "urgent" ? "Action" : "Check";
  return `
    <article class="dashboard-row dashboard-alert-row">
      <div class="dashboard-row-main">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail)}</p>
      </div>
      <span class="status ${badgeClassName}">${label}</span>
    </article>
  `;
}

function postcodeFromText(value) {
  const match = String(value || "").toUpperCase().match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/);
  return match ? match[0] : "";
}

function renderDashboardHolidayRequests() {
  const target = document.querySelector("#dashboardHolidayRequests");
  if (!target) return;
  const pending = holidayRequests.filter((request) => request.status === "Pending");
  target.innerHTML = pending.length
    ? pending.map((request) => holidayRequestRow(request, holidayRequests.indexOf(request), true)).join("")
    : '<p class="empty-state">No pending holiday requests.</p>';
}

function holidayRequestRow(request, index, dashboardMode = false) {
  const staffIndex = staffProfiles.findIndex((staff) => staff.staffId === request.staffId || staff.name === request.name);
  const dates = `${formatDateUk(request.from)} to ${formatDateUk(request.to)}`;
  const submittedValue = request.submittedAt || request.submittedDate || request.createdAt || "";
  const submitted = submittedValue ? formatDateUk(String(submittedValue).slice(0, 10)) : "Not recorded";
  const days = request.workingDays || request.days || holidayCalculatedDays(request) || workingDateRangeValues(request.from, request.to).length || 0;
  const dayTypeLabel = request.dayType === "Half day" || request.halfDay === true ? ` | ${request.dayPart || "AM"} half day` : "";
  const status = request.status || "Pending";
  const actions = status === "Pending"
    ? `
      <button class="primary-button" type="button" data-approve-holiday="${index}">Approve</button>
      <button class="danger-button" type="button" data-decline-holiday="${index}">Decline</button>
    `
    : "";
  return `
    <article class="list-row holiday-request-row">
      <div>
        <strong>${escapeHtml(request.name || "Technician")}</strong>
        <p>${escapeHtml(`${dates}${dayTypeLabel} | ${days} day${Number(days) === 1 ? "" : "s"} | Submitted ${submitted}`)}</p>
        ${request.technicianNote || request.notes ? `<p>Technician note: ${escapeHtml(request.technicianNote || request.notes)}</p>` : ""}
        ${request.createdBy ? `<p>Created by: ${escapeHtml(request.createdBy)}</p>` : ""}
        ${request.officeResponse ? `<p>Office response: ${escapeHtml(request.officeResponse)}</p>` : ""}
        ${request.approvedBy ? `<p>Approved by ${escapeHtml(request.approvedBy)} on ${escapeHtml(formatDateUk(String(request.decisionDateTime || request.approvedDate || "").slice(0, 10)))}</p>` : ""}
        ${request.declinedBy ? `<p>Declined by ${escapeHtml(request.declinedBy)} on ${escapeHtml(formatDateUk(String(request.decisionDateTime || request.declinedDate || "").slice(0, 10)))}</p>` : ""}
        <div class="record-actions">
          ${actions}
          ${staffIndex >= 0 ? `<button class="secondary-button" type="button" data-view-staff="${staffIndex}">${dashboardMode ? "Open profile" : "Profile"}</button>` : ""}
        </div>
      </div>
      <span class="status ${status === "Approved" ? "ok" : status === "Declined" ? "urgent" : "warning"}">${escapeHtml(status)}</span>
    </article>
  `;
}

function reportGateJobs() {
  const yesterday = isoDaysAgo(1);
  return jobs
    .filter((job) => String(job.date || "") <= yesterday)
    .filter((job) => !jobReportReceived(job))
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}

function jobsWithUnavailableTechnicians() {
  return jobs.filter((job) => job.date >= today).filter((job) => {
    const attendance = attendanceFor(job.technician, job.date);
    return isUnavailableStatus(attendance.status);
  });
}

function adminRamsStatus(job) {
  const assigned = ramsItems.filter((item) => item.job.includes(job.number) || item.job.includes(job.title) || item.client === job.client);
  if (assigned.some((item) => ["sent", "sent-client", "sent-tech", "read"].includes(normaliseRamsStatus(item)))) return "RAMS sent";
  if (assigned.length) return "RAMS attached";
  return "RAMS needed";
}

function normaliseRamsStatus(item) {
  const status = item?.status || "draft";
  if (["sent", "sent-tech", "read"].includes(status)) return "sent-client";
  return status;
}

function ramsReviewDays(item) {
  if (!item?.reviewDate) return null;
  return daysUntil(item.reviewDate);
}

function ramsNeedsAction(item) {
  const status = normaliseRamsStatus(item);
  const reviewDays = ramsReviewDays(item);
  return status === "draft" || status === "attached" || status === "review" || !item.sentDate || (reviewDays !== null && reviewDays <= 30);
}

function ramsReviewBadge(item) {
  const days = ramsReviewDays(item);
  if (days === null) return '<span class="status draft">Not set</span>';
  if (days < 0) return `<span class="status urgent">Overdue</span><div class="table-subtext">${escapeHtml(item.reviewDate)}</div>`;
  if (days <= 30) return `<span class="status attached">Due soon</span><div class="table-subtext">${escapeHtml(item.reviewDate)}</div>`;
  return `<span class="status ok">${days} days</span><div class="table-subtext">${escapeHtml(item.reviewDate)}</div>`;
}

function renderRamsQueue(selector, items, emptyText, badgeBuilder) {
  const container = document.querySelector(selector);
  if (!container) return;
  container.innerHTML = items.length
    ? items.slice(0, 5).map((item) => listRow(item.title || "Untitled RAMS", `${item.client || "No client"} | ${item.job || "No job"}`, badgeBuilder(item))).join("")
    : `<p class="empty-state">${emptyText}</p>`;
}

function renderRamsActionQueues() {
  renderRamsQueue(
    "#ramsDocumentQueue",
    ramsItems
      .filter(ramsNeedsAction)
      .sort((a, b) => (ramsReviewDays(a) ?? 9999) - (ramsReviewDays(b) ?? 9999)),
    "No RAMS actions outstanding.",
    (item) => {
      const status = normaliseRamsStatus(item);
      if (status === "draft") return "Draft";
      if (!item.sentDate) return "Mark sent";
      const days = ramsReviewDays(item);
      if (days === null) return "No date";
      if (days < 0) return "Overdue";
      if (days <= 30) return "Review due";
      return statusLabel(status);
    }
  );
}

function selectedRamsBuildJob() {
  return {
    client: ramsBuildClient?.value.trim() || "",
    number: ramsBuildJobRef?.value.trim() || "",
    address: ramsBuildAddress?.value.trim() || "",
    postcode: ramsBuildPostcode?.value.trim() || "",
    title: ramsBuildPostcode?.value.trim() || "",
    technician: ramsBuildTechnician?.value || "N/A",
    date: ramsBuildDate?.value || today,
    jobTitle: ""
  };
}

function extractRamsLines() {
  return (ramsBuildSource?.value || "")
    .split(/\r?\n|•|-/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2)
    .slice(0, 18);
}

function classifyRamsLine(line) {
  const value = line.toLowerCase();
  if (value.includes("ladder") || value.includes("height") || value.includes("access")) return "Working at height / access";
  if (value.includes("drill") || value.includes("tool") || value.includes("electric")) return "Tools and equipment";
  if (value.includes("dust") || value.includes("debris") || value.includes("waste")) return "Dust, debris and waste";
  if (value.includes("resident") || value.includes("public") || value.includes("tenant")) return "Residents / public";
  if (value.includes("chemical") || value.includes("rodenticide") || value.includes("coshh")) return "Substances / COSHH";
  return "Site-specific hazard";
}

function buildRamsData() {
  const job = selectedRamsBuildJob() || {};
  const lines = extractRamsLines();
  const rawText = `${ramsBuildSource.value} ${ramsBuildScope.value} ${ramsBuildPpe.value} ${ramsBuildEquipment.value}`.toLowerCase();
  const hasCosHH = /coshh|chemical|rodenticide|insecticide|biocide|bait|sds/.test(rawText);
  const hasBio = /guano|dropping|droppings|bird|rodent|weils|weil|psittacosis|biological/.test(rawText);
  const hasHeight = /ladder|tower|mewp|height|roof|access/.test(rawText);
  const title = ramsBuildTitle.value.trim() || `${job.address || "Job"} RAMS`;
  const scope = ramsBuildScope.value.trim() || `Carry out ${job.jobTitle || job.title || "planned works"} at ${job.address || "the job address"}.`;
  const ppe = (ramsBuildPpe.value.trim() || (hasCosHH
    ? "Safety boots, hi-vis, eye protection, nitrile gloves minimum 0.4mm thickness, FFP3 disposable mask or half-mask with ABEK1 filters"
    : "Safety boots, gloves, hi-vis, eye protection as required")).split(",").map((item) => item.trim()).filter(Boolean);
  const equipment = (ramsBuildEquipment.value.trim() || "Hand tools, access equipment, proofing materials, waste bags").split(",").map((item) => item.trim()).filter(Boolean);
  const hazards = (lines.length ? lines : [
    "Access to work area and changing site conditions",
    "Use of hand tools and proofing materials",
    "Residents, staff or public near the work area"
  ]).slice(0, 6).map((line) => ({
    hazard: classifyRamsLine(line),
    who: "Technicians, residents, site staff and members of the public",
    controls: line,
    further: "Supervisor to review site conditions before work starts and stop work if the RAMS no longer match the site.",
    owner: job.technician || "Assigned technician",
    due: job.date || today
  }));

  if (hasCosHH) {
    hazards.unshift({
      hazard: "COSHH / chemical exposure",
      who: "Technicians, site staff, residents and members of the public through contact, inhalation or accidental exposure.",
      controls: "Relevant Safety Data Sheet (SDS) is to be attached. Minimum PPE: nitrile gloves, minimum 0.4mm thickness, and suitable RPE such as FFP3 disposable mask or half-mask with ABEK1 filters.",
      further: "Confirm product label, COSHH assessment, application area and exclusion arrangements before use.",
      owner: job.technician || "Assigned technician",
      due: job.date || today
    });
  }

  if (hasBio) {
    hazards.unshift({
      hazard: "Biological hazards from bird guano or rodent droppings",
      who: "Technicians and others nearby through airborne dust, pathogens, Weil's disease or Psittacosis.",
      controls: "Guano or droppings will be thoroughly treated with a professional biocide spray before disturbance to suppress airborne dust and pathogens.",
      further: "Segregate the area, use suitable PPE/RPE and double-bag contaminated waste for controlled disposal.",
      owner: job.technician || "Assigned technician",
      due: job.date || today
    });
  }

  if (hasHeight) {
    hazards.unshift({
      hazard: "Working at height",
      who: "Technicians through falls from ladders, towers or access equipment; others from falling tools or materials.",
      controls: "Ladders to be used for short-duration, low-risk tasks only, fully secured on level ground, maintaining 3 points of contact at all times.",
      further: "Inspect access equipment before use and stop work if conditions are unsuitable.",
      owner: job.technician || "Assigned technician",
      due: job.date || today
    });
  }

  const method = [
    "Step 1: Arrival & Induction - Operative reports to the principal contractor's site office, presents RAMS, signs in and completes mandatory site safety inductions.",
    "Step 2: Area Segregation - Set up physical barriers, warning signs or lockable bait stations to exclude other trades and members of the public from the work zone.",
    "Step 3: Execution & Control - Complete the specific pest control or proofing works using the agreed tools, PPE and controls, with spill kit active and available where substances are used.",
    "Step 4: Waste Mitigation - Spent chemical containers, contaminated PPE and biological debris such as bird guano will be double-bagged, removed from site and disposed of under hazardous waste consignment procedures."
  ];
  return { title, scope, ppe, equipment, hazards, method, job };
}

function normaliseAiList(items, fallback = []) {
  if (!Array.isArray(items)) return fallback;
  return items.map((item) => String(item || "").trim()).filter(Boolean);
}

function buildRamsDataFromAi(draft) {
  const job = selectedRamsBuildJob() || {};
  const fallback = buildRamsData();
  const hazards = Array.isArray(draft?.hazards) && draft.hazards.length
    ? draft.hazards.slice(0, 8).map((row) => ({
      hazard: row.hazard || "Site-specific hazard",
      who: row.who || "Technicians, residents, site staff and members of the public",
      controls: row.controls || "Review site conditions before work starts.",
      further: row.further || "Stop work and contact the office if conditions change.",
      owner: row.owner || job.technician || "Assigned technician",
      due: row.due || job.date || today
    }))
    : fallback.hazards;

  return {
    title: draft?.title || fallback.title,
    scope: draft?.scope || fallback.scope,
    ppe: normaliseAiList(draft?.ppe, fallback.ppe),
    equipment: normaliseAiList(draft?.equipment, fallback.equipment),
    method: normaliseAiList(draft?.method, fallback.method),
    hazards,
    job
  };
}

function applyAiRamsDraft(draft) {
  const data = buildRamsDataFromAi(draft);
  ramsBuildTitle.value = data.title;
  ramsBuildScope.value = data.scope;
  ramsBuildPpe.value = data.ppe.join(", ");
  ramsBuildEquipment.value = data.equipment.join(", ");
  ramsBuilderPreview.innerHTML = ramsDocumentHtml(data);
  return data;
}

async function requestAiRamsDraft() {
  const job = selectedRamsBuildJob();
  const source = ramsBuildSource.value.trim();
  if (!source && !ramsBuildScope.value.trim() && !job.address) {
    aiRamsStatus.textContent = "Add the job address, scope or pasted notes first.";
    return;
  }

  aiRamsDraftButton.disabled = true;
  aiRamsStatus.textContent = "AI is drafting the RAMS for review...";

  try {
    const response = await fetch("/api/ai-rams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job,
        scope: ramsBuildScope.value.trim(),
        source,
        ppe: ramsBuildPpe.value.trim(),
        equipment: ramsBuildEquipment.value.trim()
      })
    });
    const result = await response.json();
    if (!response.ok || !result.draft) {
      throw new Error(result.message || "AI RAMS drafting is not connected yet.");
    }

    applyAiRamsDraft(result.draft);
    aiRamsStatus.textContent = result.aiUsed
      ? "AI draft ready. Please review before saving or sending."
      : "Draft created locally. Add an OpenAI API key to use ChatGPT AI.";
  } catch (error) {
    const data = generateRamsPreview();
    aiRamsStatus.textContent = `${error.message} A standard preview has been generated for now.`;
    ramsBuilderPreview.innerHTML = ramsDocumentHtml(data);
  } finally {
    aiRamsDraftButton.disabled = false;
  }
}

function ramsDocumentHtml(data) {
  const job = data.job || {};
  const rows = data.hazards.map((row) => `
    <tr>
      <td>${escapeHtml(row.hazard)}</td>
      <td>${escapeHtml(row.who)}</td>
      <td>${escapeHtml(row.controls)}</td>
      <td>${escapeHtml(row.further)}</td>
      <td>${escapeHtml(row.owner)}</td>
      <td>${formatDateUk(row.due)}</td>
    </tr>
  `).join("");

  return `
    <article class="rams-print-document">
      <div class="report-masthead">
        <img class="report-logo" src="assets/kingswood-silver-logo.png" alt="">
        <div>
          <p class="brand-name">Kingswood (London) Ltd</p>
          <p class="brand-services">Pest Control | Bird Management | Property Maintenance</p>
        </div>
      </div>
      <h1>Risk Assessment & Method Statement</h1>
      <p class="subtitle">${escapeHtml(data.title)} - ${escapeHtml(job.address || "Site-specific works")}</p>
      <section class="metadata rams-metadata">
        <strong>Client:</strong><div>${escapeHtml(job.client || "Not set")}</div>
        <strong>Site Address:</strong><div>${escapeHtml(job.address || "Not set")}</div>
        <strong>Postcode:</strong><div>${escapeHtml(job.postcode || job.title || "Not set")}</div>
        <strong>Job Reference:</strong><div>${escapeHtml(job.number || "Not set")}</div>
        <strong>Lead Technician:</strong><div>${escapeHtml(job.technician || "Not assigned")}</div>
        <strong>Competency:</strong><div>RSPH Level 2 / BASIS PROMPT where applicable</div>
        <strong>Date of Works:</strong><div>${formatDateUk(job.date || today)}</div>
        <strong>Date Generated:</strong><div>${formatDateUk(today)}</div>
      </section>
      <section class="area-box">
        <span>Scope of Works</span>
        <strong>${escapeHtml(data.scope)}</strong>
      </section>
      <section>
        <h2>Regulatory References</h2>
        <ul class="rams-reference-list">
          <li>The Management of Health and Safety at Work Regulations 1999, Regulation 3: site-specific risk assessments.</li>
          <li>The Control of Substances Hazardous to Health Regulations 2002 for all biocide, rodenticide and insecticide applications.</li>
          <li>The Work at Height Regulations 2005 for ladder, tower or MEWP work during proofing installations.</li>
          <li>The Personal Protective Equipment at Work (Amendment) Regulations 2022, including identical PPE duties for core employees and limb (b) contract workers on site.</li>
        </ul>
      </section>
      <section>
        <h2>Risk Assessment</h2>
        <table>
          <thead>
            <tr>
              <th>What could cause harm</th>
              <th>Who might be harmed and how</th>
              <th>Controls already in place</th>
              <th>Further action required</th>
              <th>Action owner</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
      <section>
        <h2>Method Statement</h2>
        <ol>${data.method.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      </section>
      <section class="status-table rams-resource-table">
        <div><strong>PPE</strong>${data.ppe.map(escapeHtml).join(", ")}</div>
        <div><strong>Tools / Equipment</strong>${data.equipment.map(escapeHtml).join(", ")}</div>
        <div><strong>Document Status</strong>Pre-start review required before works commence</div>
      </section>
      <section>
        <h2>Emergency / Change Control</h2>
        <p>If site conditions change or the method needs to change, stop work and contact the office before continuing. This RAMS must be reviewed if the site no longer matches the document.</p>
      </section>
      <section class="rams-signoff-box">
        <h2>Proof of Communication & Audit Trail</h2>
        <p><strong>Digital Verification:</strong> This Site-Specific RAMS has been digitally reviewed, communicated, and signed off by the attending technician via Kingswood Connect prior to the commencement of any onsite works.</p>
      </section>
      <footer>
        <span>Prepared by Kingswood Connect</span>
        <span>Generated ${formatDateUk(today)}</span>
      </footer>
    </article>
  `;
}

function ramsPrintCss() {
  return `
    @page{size:A4;margin:16mm 22mm 18mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#222;font-size:9.8pt;line-height:1.32;margin:0;padding:0}
    .rams-print-document{background:#fff;margin:0 auto;max-width:180mm;padding:0}.report-masthead{align-items:center;border-bottom:1px solid #18384e;display:flex;gap:7mm;margin:0 0 9mm;padding-bottom:6mm}
    .report-logo{display:block;height:31mm;object-fit:contain;width:31mm}.brand-name{color:#18384e;font-family:Georgia,'Times New Roman',serif;font-size:18pt;font-weight:700;line-height:1.1;margin:0}
    .brand-services{color:#666;font-family:Georgia,'Times New Roman',serif;font-size:10pt;line-height:1.1;margin:.8mm 0 0}h1{color:#18384e;font-family:Georgia,'Times New Roman',serif;font-size:24pt;font-weight:700;margin:0 0 2mm}
    h2{border-bottom:1px solid #18384e;color:#070746;font-size:12.5pt;font-weight:700;margin:6mm 0 2.5mm;padding-bottom:1.4mm}.subtitle{color:#555;font-size:10.8pt;margin:0 0 5mm}
    .metadata{display:grid;gap:1.2mm 3mm;grid-template-columns:34mm 1fr;margin-bottom:6mm}.metadata strong,.status-table strong,.area-box span{color:#555;font-weight:700}.metadata div{margin:0}
    .area-box{background:#fbfbfc;border:1px solid #cfcfcf;margin:5mm 0 5.5mm;padding:3mm 3.5mm}.area-box span{display:block;font-size:8.5pt;margin-bottom:1.2mm}.area-box strong{color:#070746;font-size:12pt}
    .status-table{border:1px solid #cfcfcf;display:grid;grid-template-columns:repeat(3,1fr);margin:5mm 0 5.5mm}.status-table div{border-right:1px solid #cfcfcf;color:#070746;font-size:10pt;font-weight:700;min-height:13mm;padding:2.2mm 3mm}.status-table div:last-child{border-right:0}.status-table strong{display:block;font-size:8.5pt;margin-bottom:2mm}
    .rams-reference-list{margin:0;padding-left:5mm}.rams-reference-list li{margin:1.5mm 0}p{margin:0 0 2.6mm}ol{padding-left:6mm}li{margin:1.6mm 0}
    table{border-collapse:collapse;margin:3mm 0 5mm;width:100%}th{background:#0b1835;color:#fff;text-align:left;text-transform:uppercase}th,td{border:1px solid #cfd3dc;font-size:8.3pt;padding:1.8mm;vertical-align:top}
    .rams-signoff-box{background:#fbfbfc;border:1px solid #cfcfcf;margin-top:6mm;padding:3mm 3.5mm}.rams-signoff-box h2{margin-top:0}footer{border-top:1px solid #dbe5ee;color:#64748b;display:flex;justify-content:space-between;margin-top:7mm;padding-top:3mm}
    @media print{body{background:#fff;padding:0}.rams-print-document{border:0;max-width:none}button{display:none}}
  `;
}

function generateRamsPreview() {
  const data = buildRamsData();
  ramsBuilderPreview.innerHTML = ramsDocumentHtml(data);
  return data;
}

function hasRamsBuilderContent() {
  return [
    ramsBuildClient,
    ramsBuildJobRef,
    ramsBuildAddress,
    ramsBuildPostcode,
    ramsBuildTitle,
    ramsBuildScope,
    ramsBuildSource,
    ramsBuildPpe,
    ramsBuildEquipment
  ].some((field) => field?.value?.trim());
}

function refreshRamsLivePreview() {
  if (!ramsBuilderPreview) return;
  if (!hasRamsBuilderContent()) {
    ramsBuilderPreview.innerHTML = '<p class="empty-state">Paste or type the job information on the left. The preview will update here automatically.</p>';
    return;
  }
  generateRamsPreview();
}

function openRamsPrintView() {
  const data = generateRamsPreview();
  const html = ramsFullDocumentHtml(data, true);
  const printWindow = window.open("about:blank", "_blank");
  if (!printWindow) {
    aiRamsStatus.textContent = "The browser blocked the PDF window. Allow pop-ups for this Hub, then press Open PDF View again.";
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}

function ramsFullDocumentHtml(data, autoPrint = false) {
  return `<!doctype html><html><head><meta charset="utf-8"><base href="${location.origin}/"><title>${escapeHtml(data.title)}</title><style>${ramsPrintCss()}</style></head><body>${ramsDocumentHtml(data)}${autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));<\\/script>' : ""}</body></html>`;
}

async function saveBuiltRams() {
  const data = generateRamsPreview();
  const job = data.job || {};
  const safeClient = (job.client || "Client").replace(/[\\/:*?"<>|]/g, "-");
  const safeTitle = data.title.replace(/[\\/:*?"<>|]/g, "-");
  const jobRef = job.number || "Job";
  const html = ramsFullDocumentHtml(data);
  let fileLocation = `RAMS/${new Date().getFullYear()}/${safeClient}/${jobRef} - ${safeTitle}.pdf`;
  let saveMessage = "Built in the RAMS Builder and saved to the RAMS folder.";

  saveBuiltRamsButton.disabled = true;
  aiRamsStatus.textContent = "Saving RAMS document to the OneDrive RAMS folder...";

  try {
    const response = await fetch("/api/save-rams-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        client: job.client || "Client",
        jobRef,
        year: new Date().getFullYear(),
        html
      })
    });
    const result = await response.json();
    if (!response.ok || !result.saved) {
      throw new Error(result.message || "RAMS document could not be saved.");
    }
    fileLocation = result.relativePath || fileLocation;
    saveMessage = result.fileType === "pdf"
      ? "Built in the RAMS Builder and saved as a PDF in the RAMS folder."
      : `Built in the RAMS Builder and saved as HTML in the RAMS folder. ${result.message || ""}`.trim();
  } catch (error) {
    saveMessage = `${error.message} The RAMS record has still been saved in the Hub data.`;
    aiRamsStatus.textContent = saveMessage;
  }

  const existingIndex = activeBuiltRamsId ? ramsItems.findIndex((rams) => rams.id === activeBuiltRamsId) : -1;
  const existing = existingIndex >= 0 ? ramsItems[existingIndex] : {};
  const item = {
    id: existing.id || crypto.randomUUID(),
    title: data.title,
    client: job.client || "",
    job: [job.address, job.postcode || job.title, job.number].filter(Boolean).join(" | "),
    technician: job.technician || "",
    status: existing.status || "draft",
    sentDate: existing.sentDate || "",
    techSentDate: existing.techSentDate || "",
    techReadDate: existing.techReadDate || "",
    reviewDate: existing.reviewDate || "",
    fileLocation,
    notes: saveMessage,
    generatedHtml: html,
    builderSource: {
      client: job.client || "",
      jobRef,
      address: job.address || "",
      postcode: job.postcode || "",
      technician: job.technician || "N/A",
      date: job.date || today,
      title: data.title,
      scope: ramsBuildScope.value.trim(),
      source: ramsBuildSource.value.trim(),
      ppe: ramsBuildPpe.value.trim(),
      equipment: ramsBuildEquipment.value.trim()
    },
    revisionHistory: [
      ...(existing.revisionHistory || []),
      {
        date: new Date().toISOString(),
        note: existing.id ? "Revised in RAMS Builder" : "Created in RAMS Builder",
        fileLocation
      }
    ]
  };
  if (existingIndex >= 0) {
    ramsItems[existingIndex] = item;
  } else {
    ramsItems.unshift(item);
  }
  await saveCommandData();
  render();
  ramsBuilderDialog.close();
  activeBuiltRamsId = "";
  saveBuiltRamsButton.disabled = false;
}

function proofingLines(value = "") {
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:[-*]|\u2022)\s*/, ""))
    .filter(Boolean);
}

function proofingTitleCase(value = "") {
  return String(value).replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function proofingSetStatus(message, isError = false) {
  if (!proofingStatus) return;
  proofingStatus.textContent = message;
  proofingStatus.classList.toggle("error", isError);
}

function parseProofingNotesLocally() {
  const notes = proofingRawNotes?.value.trim() || "";
  if (!notes) {
    proofingSetStatus("Paste the operative notes first.", true);
    return;
  }

  const lines = proofingLines(notes);
  const text = notes.toLowerCase();
  const patterns = {
    clientName: /^\s*(?:client|customer|company)\s*[:\-]\s*(.+)$/i,
    propertyAddress: /^\s*(?:property\s*address|address|site)\s*[:\-]\s*(.+)$/i,
    operativeName: /^\s*(?:operative|technician|engineer)\s*[:\-]\s*(.+)$/i,
    areaOfWorks: /^\s*(?:area\s*of\s*works|area|location)\s*[:\-]\s*(.+)$/i,
    hygieneLevel: /^\s*(?:hygiene(?:\s*level)?|housekeeping)\s*[:\-]\s*(good|fair|poor)$/i,
    rodentActivity: /^\s*(?:rodent\s*activity|activity)\s*[:\-]\s*(low|moderate|high|no activity observed)$/i,
    jobStatus: /^\s*(?:status|job\s*status)\s*[:\-]\s*(complete|completed|further works required|monitoring recommended)$/i
  };

  lines.forEach((line) => {
    Object.entries(patterns).forEach(([key, pattern]) => {
      const match = line.match(pattern);
      if (match && proofingFields[key] && !proofingFields[key].value) {
        proofingFields[key].value = proofingTitleCase(match[1]);
      }
    });

    const dateMatch = line.match(/^\s*(?:date|date\s*of\s*works)\s*[:\-]\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\s*$/i);
    if (dateMatch && proofingFields.dateOfWorks && !proofingFields.dateOfWorks.value) {
      const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
      proofingFields.dateOfWorks.value = `${year.padStart(4, "0")}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
    }
  });

  if (!proofingFields.rodentActivity.value) {
    if (/\b(high|heavy|significant)\b.*\b(mouse|mice|rat|rodent|droppings|activity)\b/.test(text)) proofingFields.rodentActivity.value = "High";
    else if (/\b(low|minor|old|limited)\b.*\b(mouse|mice|rat|rodent|droppings|activity)\b/.test(text)) proofingFields.rodentActivity.value = "Low";
    else if (/\b(mouse|mice|rat|rodent|droppings|ingress)\b/.test(text)) proofingFields.rodentActivity.value = "Moderate";
  }

  if (!proofingFields.hygieneLevel.value) {
    if (/\b(poor hygiene|heavy rubbish|dirty|heavy debris|dog excrement)\b/.test(text)) proofingFields.hygieneLevel.value = "Poor";
    else if (/\b(rubbish|debris|some rubbish|moderate debris)\b/.test(text)) proofingFields.hygieneLevel.value = "Fair";
    else if (/\b(clean|good hygiene|no hygiene issue)\b/.test(text)) proofingFields.hygieneLevel.value = "Good";
  }

  if (!proofingFields.summary.value) {
    proofingFields.summary.value = "Kingswood attended site to inspect and complete pest proofing works as detailed below.";
  }
  if (!proofingFields.worksCarriedOut.value) {
    proofingFields.worksCarriedOut.value = lines
      .filter((line) => !Object.values(patterns).some((pattern) => pattern.test(line)))
      .slice(0, 8)
      .join("\n");
  }
  if (!proofingFields.findingsRecommendations.value) {
    proofingFields.findingsRecommendations.value = "All accessible work areas should be monitored and any further signs of activity reported for review.";
  }

  updateProofingPreview();
  proofingSetStatus("Report sections populated. Please review and edit before saving.");
}

function applyProofingDraft(draft) {
  if (!draft) return;
  Object.entries({
    clientName: draft.clientName,
    propertyAddress: draft.propertyAddress,
    dateOfWorks: draft.dateOfWorks,
    operativeName: draft.operativeName,
    areaOfWorks: draft.areaOfWorks,
    hygieneLevel: draft.hygieneLevel,
    rodentActivity: draft.rodentActivity,
    jobStatus: draft.jobStatus,
    summary: draft.summary,
    worksCarriedOut: Array.isArray(draft.worksCarriedOut) ? draft.worksCarriedOut.join("\n") : draft.worksCarriedOut,
    materialsUsed: Array.isArray(draft.materialsUsed) ? draft.materialsUsed.join("\n") : draft.materialsUsed,
    findingsRecommendations: draft.findingsRecommendations
  }).forEach(([key, value]) => {
    if (proofingFields[key] && value) {
      proofingFields[key].value = value;
    }
  });
  updateProofingPreview();
}

async function parseProofingNotesWithAi() {
  const notes = proofingRawNotes?.value.trim() || "";
  if (!notes) {
    proofingSetStatus("Paste the operative notes first.", true);
    return;
  }

  parseNativeProofingNotes.disabled = true;
  proofingSetStatus("Preparing the proofing report sections...");

  try {
    const response = await fetch("/api/ai-proofing-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes })
    });
    const result = await response.json();
    if (!response.ok || !result.draft) {
      throw new Error(result.message || "AI proofing report parsing is not available.");
    }
    applyProofingDraft(result.draft);
    proofingSetStatus(result.aiUsed
      ? "AI report sections populated. Please review and edit before saving."
      : "Report sections populated locally. Please review and edit before saving."
    );
  } catch (error) {
    parseProofingNotesLocally();
    proofingSetStatus("Report sections populated locally. Please review and edit before saving.", false);
  } finally {
    parseNativeProofingNotes.disabled = false;
  }
}

function collectProofingReport() {
  const data = Object.fromEntries(Object.entries(proofingFields).map(([key, field]) => [key, field?.value || ""]));
  data.rawNotes = proofingRawNotes?.value || "";
  data.worksCarriedOutList = proofingLines(data.worksCarriedOut);
  data.materialsUsedList = proofingLines(data.materialsUsed);
  data.beforePhotos = proofingPhotos.before;
  data.afterPhotos = proofingPhotos.after;
  data.createdAt = new Date().toISOString();
  return data;
}

function proofingReportHtml(report) {
  const works = report.worksCarriedOutList?.length ? report.worksCarriedOutList : ["Report details to be reviewed before issue."];
  const materials = report.materialsUsedList?.length ? report.materialsUsedList : ["As required for the works."];
  const photoSection = (title, photos) => photos?.length ? `
    <section class="page-break">
      <h2>${title}</h2>
      <p class="photo-intro">Photographic evidence recorded during the proofing visit.</p>
      <div class="proofing-print-photos">
        ${photos.map((photo) => `
          <figure class="photo-item">
            <div class="photo-frame"><img src="${photo.dataUrl}" alt=""></div>
            <figcaption class="caption">${escapeHtml(photo.caption || "")}</figcaption>
          </figure>
        `).join("")}
      </div>
    </section>
  ` : "";

  return `
    <article class="proofing-print-document">
      <div class="report-masthead">
        <img class="report-logo" src="assets/kingswood-silver-logo.png" alt="">
        <div>
          <p class="brand-name">Kingswood (London) Ltd</p>
          <p class="brand-services">Pest Proofing | Bird Management | Property Maintenance</p>
        </div>
      </div>
      <h1>Pest Proofing Report</h1>
      <p class="subtitle">Rodent ingress proofing - ${escapeHtml(report.areaOfWorks || "Area of works")}</p>
      <section class="metadata">
        <strong>Date of Works:</strong><div>${formatDateUk(report.dateOfWorks || today)}</div>
        <strong>Property Address:</strong><div>${escapeHtml(report.propertyAddress || "Not set")}</div>
        <strong>Operative:</strong><div>${escapeHtml(report.operativeName || "Not set")}</div>
        <strong>Company:</strong><div>Kingswood (London) Ltd</div>
        <strong>Client:</strong><div>${escapeHtml(report.clientName || "Not set")}</div>
      </section>
      <section class="area-box">
        <span>Area of Works</span>
        <strong>${escapeHtml(report.areaOfWorks || "Not set")}</strong>
      </section>
      <section><h2>Summary of Works</h2><p>${escapeHtml(report.summary || "")}</p></section>
      <section><h2>Works Carried Out</h2><div class="report-list">${works.map((item) => `<div class="report-line">${escapeHtml(item)}</div>`).join("")}</div></section>
      <section class="keep-together"><h2>Materials Used</h2><div class="report-list">${materials.map((item) => `<div class="report-line">${escapeHtml(item)}</div>`).join("")}</div></section>
      <section class="findings-block"><h2>Findings and Recommendations</h2><p class="findings-paragraph">${escapeHtml(report.findingsRecommendations || "")}</p></section>
      <section class="status-table">
        <div><strong>Hygiene Level</strong>${escapeHtml(report.hygieneLevel || "Not set")}</div>
        <div><strong>Rodent Activity</strong>${escapeHtml(report.rodentActivity || "Not set")}</div>
        <div><strong>Job Status</strong>${escapeHtml(report.jobStatus || "Draft")}</div>
      </section>
      ${photoSection("Before Photographs", report.beforePhotos)}
      ${photoSection("After Photographs", report.afterPhotos)}
    </article>
  `;
}

function updateProofingPreview() {
  if (!proofingReportPreview) return;
  proofingReportPreview.innerHTML = proofingReportHtml(collectProofingReport());
}

function proofingPrintCss() {
  return `
    @page{size:A4;margin:16mm 22mm 18mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#222;font-size:10.4pt;line-height:1.32;margin:0;padding:0}
    .proofing-print-document{background:#fff;margin:0 auto;max-width:180mm;padding:0}.report-masthead{align-items:center;border-bottom:1px solid #18384e;display:flex;gap:7mm;margin:0 0 9mm;padding-bottom:6mm}
    .report-logo{display:block;height:31mm;object-fit:contain;width:31mm}.brand-name{color:#18384e;font-family:Georgia,'Times New Roman',serif;font-size:18pt;font-weight:700;line-height:1.1;margin:0}
    .brand-services{color:#666;font-family:Georgia,'Times New Roman',serif;font-size:10pt;line-height:1.1;margin:.8mm 0 0}h1{color:#18384e;font-family:Georgia,'Times New Roman',serif;font-size:25pt;font-weight:700;margin:0 0 2mm}
    h2{border-bottom:1px solid #18384e;color:#070746;font-size:13pt;font-weight:700;margin:6mm 0 2.5mm;padding-bottom:1.4mm}.subtitle{color:#555;font-size:11.2pt;margin:0 0 5mm}
    .metadata{display:grid;gap:1.2mm 3mm;grid-template-columns:32mm 1fr;margin-bottom:6mm}.metadata strong,.status-table strong,.area-box span{color:#555;font-weight:700}.metadata div{margin:0}
    .area-box{background:#fbfbfc;border:1px solid #cfcfcf;margin:5mm 0 5.5mm;padding:3mm 3.5mm}.area-box span{display:block;font-size:8.5pt;margin-bottom:1.2mm}.area-box strong{color:#070746;font-size:13pt}
    .status-table{border:1px solid #cfcfcf;display:grid;grid-template-columns:repeat(3,1fr);margin:5mm 0 5.5mm}.status-table div{border-right:1px solid #cfcfcf;color:#070746;font-size:12pt;font-weight:700;min-height:12mm;padding:2.2mm 3mm}.status-table div:last-child{border-right:0}.status-table strong{display:block;font-size:8.5pt;margin-bottom:2mm}
    p{margin:0 0 2.6mm}.report-list{margin-bottom:4mm}.report-line{display:list-item;list-style-position:outside;margin:0 0 1mm 5mm}.keep-together,.photo-item{break-inside:avoid}.page-break{break-before:page}
    .photo-intro{margin-bottom:6mm}.proofing-print-photos{display:grid;gap:9mm 10mm;grid-template-columns:1fr 1fr}.photo-item{margin:0;min-height:88mm;text-align:center}.photo-frame{align-items:center;background:#f5f6f8;border:1px solid #cfd3dc;display:flex;height:74mm;justify-content:center;margin-bottom:3mm;overflow:hidden}.photo-frame img{max-height:74mm;max-width:100%;object-fit:contain}.caption{font-size:9pt;line-height:1.25}
    @media print{body{background:#fff;padding:0}.proofing-print-document{border:0;max-width:none}}
  `;
}

function openProofingPdfView() {
  const report = collectProofingReport();
  const html = proofingFullHtml(report, true);
  const printWindow = window.open("about:blank", "_blank");
  if (!printWindow) {
    proofingSetStatus("The browser blocked the PDF window. Allow pop-ups, then press PDF View again.", true);
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}

function proofingFullHtml(report, autoPrint = false) {
  return `<!doctype html><html><head><meta charset="utf-8"><base href="${location.origin}/"><title>Pest Proofing Report</title><style>${proofingPrintCss()}</style></head><body>${proofingReportHtml(report)}${autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));<\/script>' : ""}</body></html>`;
}

async function saveProofingReport() {
  const report = collectProofingReport();
  report.id = crypto.randomUUID();
  const fileName = `Pest_Proofing_Report_${(report.propertyAddress || "proofing-report").replace(/[\\/:*?"<>|]/g, "-")}`;
  report.fileLocation = `Kingswood Field Reports/Proofing Reports/${new Date().getFullYear()}/${fileName}.pdf`;
  proofingReports.unshift(report);
  await saveCommandData();
  renderProofingReports();
  proofingSetStatus("Saving PDF to OneDrive Field Reports...");
  try {
    const response = await fetch("/api/save-proofing-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName,
        html: proofingFullHtml(report, false)
      })
    });
    const result = await response.json();
    if (!response.ok || !result.saved) {
      throw new Error(result.message || "The report record was saved, but the PDF could not be created.");
    }
    report.fileLocation = result.pdfPath;
    await saveCommandData();
    renderProofingReports();
    proofingSetStatus(`Report saved to OneDrive: ${result.pdfPath}`);
  } catch (error) {
    proofingSetStatus(`${error.message} The report record is still saved in the Hub.`, true);
  }
}

async function clearProofingReport() {
  if (!(await kcConfirmAction("Clear this proofing report and start again?", "Continue", true))) return;
  proofingRawNotes.value = "";
  Object.values(proofingFields).forEach((field) => { if (field) field.value = ""; });
  proofingPhotos = { before: [], after: [] };
  if (proofingBeforePhotosInput) proofingBeforePhotosInput.value = "";
  if (proofingAfterPhotosInput) proofingAfterPhotosInput.value = "";
  updateProofingPreview();
  proofingSetStatus("Report cleared.");
}

function renderProofingReports() {
  if (!savedProofingReports) return;
  proofingSavedCount.textContent = `${proofingReports.length} saved`;
  savedProofingReports.innerHTML = proofingReports.slice(0, 8).map((report) => `
    <article class="list-row">
      <div>
        <strong>${escapeHtml(report.propertyAddress || "Proofing report")}</strong>
        <p>${formatDateUk(report.dateOfWorks || report.createdAt || today)} | ${escapeHtml(report.clientName || "No client")} | ${escapeHtml(report.operativeName || "No operative")}</p>
      </div>
      <span class="status ok">Saved</span>
    </article>
  `).join("") || '<p class="empty-state">No proofing reports saved yet.</p>';
}

function proofingGridFor(kind) {
  return kind === "after" ? proofingAfterGrid : proofingBeforeGrid;
}

function renderProofingPhotoCards(kind) {
  const grid = proofingGridFor(kind);
  if (!grid) return;
  grid.innerHTML = proofingPhotos[kind].map((photo, index) => `
    <article class="proofing-photo-card">
      <img src="${photo.dataUrl}" alt="">
      <textarea data-proofing-photo-caption="${kind}" data-index="${index}" rows="3">${escapeHtml(photo.caption || "")}</textarea>
      <button class="secondary-button" type="button" data-remove-proofing-photo="${kind}" data-index="${index}">Remove</button>
    </article>
  `).join("");
}

function fallbackProofingCaption(fileName, kind) {
  const cleanName = String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (cleanName && !/^image|photo|img/i.test(cleanName)) return proofingTitleCase(cleanName);
  return kind === "after"
    ? "Completed pest proofing works to restrict rodent ingress."
    : "Pre-proofing condition showing potential rodent ingress area.";
}

async function aiProofingPhotoCaption(dataUrl, kind, fileName) {
  try {
    const response = await fetch("/api/ai-proofing-photo-caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl: dataUrl, kind, fileName })
    });
    const result = await response.json();
    if (!response.ok || !result.caption) {
      throw new Error(result.message || "AI photo notes unavailable.");
    }
    return result.caption;
  } catch {
    return fallbackProofingCaption(fileName, kind);
  }
}

function readProofingPhotosFromFiles(files, kind, replace = false) {
  const selectedFiles = [...(files || [])].slice(0, 8);
  if (replace) proofingPhotos[kind] = [];
  proofingSetStatus(`Adding ${kind} photos and preparing AI notes...`);
  selectedFiles.forEach((file) => {
    const reader = new FileReader();
    reader.addEventListener("load", async () => {
      const photo = {
        dataUrl: reader.result,
        caption: "AI is preparing photo note..."
      };
      proofingPhotos[kind].push(photo);
      renderProofingPhotoCards(kind);
      updateProofingPreview();
      photo.caption = await aiProofingPhotoCaption(reader.result, kind, file.name);
      renderProofingPhotoCards(kind);
      updateProofingPreview();
      proofingSetStatus("Photo notes added. Please review/edit the preview before saving.");
    });
    reader.readAsDataURL(file);
  });
}

function readProofingPhotos(input, kind) {
  readProofingPhotosFromFiles(input.files, kind, false);
}

function adminJobRow(job, badge, detailOverride = "") {
  const index = jobs.indexOf(job);
  const detail = detailOverride || `${formatDateUk(job.date)} | ${job.slot || "No slot"} | ${job.client || "No client"} | ${job.technician || "Unassigned"}`;
  const badgeClassName = badge === "Reassign" || badge === "RAMS needed" ? "urgent" : badge === "Awaiting report" ? "warning" : "ok";
  return `
    <article class="list-row admin-job-row">
      <div>
        <strong>${escapeHtml(job.address || job.title || job.number || "Untitled job")}</strong>
        <p>${escapeHtml(detail)}</p>
      </div>
      <span class="status ${badgeClassName}">${escapeHtml(badge)}</span>
      <div class="record-actions always-visible-actions">${recordButtons("jobs", index)}</div>
    </article>
  `;
}

function renderAdminCentre() {
  if (!document.querySelector("#admin-centre")) return;
  const conflicts = jobsWithUnavailableTechnicians();
  const todayJobs = jobs.filter((job) => job.date === today);
  const activeJobs = jobs.filter((job) => job.date >= today);
  const awaitingReports = activeJobs.filter((job) => job.report === "Awaiting");
  const techReady = todayJobs.filter((job) => !isUnavailableStatus(attendanceFor(job.technician, job.date).status));

  const jobsTodayCount = document.querySelector("#adminJobsTodayCount");
  const reassignCount = document.querySelector("#adminReassignCount");
  const reportsAwaitingCount = document.querySelector("#adminReportsAwaitingCount");
  const techReadyCount = document.querySelector("#adminTechReadyCount");
  if (jobsTodayCount) jobsTodayCount.textContent = todayJobs.length;
  if (reassignCount) reassignCount.textContent = conflicts.length;
  if (reportsAwaitingCount) reportsAwaitingCount.textContent = awaitingReports.length;
  if (techReadyCount) techReadyCount.textContent = techReady.length;

  const actionJobs = document.querySelector("#adminActionJobs");
  if (actionJobs) actionJobs.innerHTML = conflicts.map((job) => {
    const attendance = attendanceFor(job.technician, job.date);
    return adminJobRow(job, "Reassign", `${formatDateUk(job.date)} | ${job.technician} marked ${attendance.status} | ${job.client || "No client"}`);
  }).join("") || '<p class="empty-state">No jobs currently need reassigning.</p>';

  const todayQueue = document.querySelector("#adminTodayQueue");
  if (todayQueue) todayQueue.innerHTML = todayJobs.map((job) => {
    const attendance = attendanceFor(job.technician, job.date);
    const badge = isUnavailableStatus(attendance.status) ? "Reassign" : adminRamsStatus(job);
    return adminJobRow(job, badge);
  }).join("") || '<p class="empty-state">No jobs booked for today.</p>';
}

function renderRamsTable() {
  const rows = filteredRams();
  tableBody.innerHTML = "";

  if (rows.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td class="empty-state" colspan="9">No RAMS found.</td>';
    tableBody.append(row);
    renderRamsActionQueues();
    return;
  }

  rows.forEach((item) => {
    const status = normaliseRamsStatus(item);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(item.title)}</strong>${item.fileLocation ? `<div class="table-subtext">${escapeHtml(item.fileLocation)}</div>` : ""}</td>
      <td>${escapeHtml(item.client)}</td>
      <td>${escapeHtml(item.job)}</td>
      <td>${escapeHtml(item.technician || "-")}</td>
      <td><span class="status ${status}">${statusLabel(status)}</span></td>
      <td>${item.sentDate || "-"}</td>
      <td>${ramsReviewBadge(item)}</td>
      <td>
        <div class="row-actions">
          ${item.builderSource || item.generatedHtml ? `<button class="secondary-button" type="button" data-action="revise" data-id="${item.id}">Revise</button>` : ""}
          <button class="secondary-button" type="button" data-action="edit" data-id="${item.id}">Edit</button>
          <button class="secondary-button" type="button" data-action="markSent" data-id="${item.id}">Mark sent</button>
          <button class="danger-button" type="button" data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      </td>
    `;
    tableBody.append(row);
  });
  renderRamsActionQueues();
}

function renderJobs() {
  setupJobDateFilters();
  const term = normalisePostcode(document.querySelector("#jobSearch").value);
  const rows = jobs.filter((job) => {
    const matchesSearch = !term || normalisePostcode(job.postcode || job.title || job.address).includes(term);
    return matchesSearch && jobMatchesDateFilters(job);
  });

  if (!rows.length) {
    document.querySelector("#jobsTableBody").innerHTML = `
      <tr>
        <td colspan="7" class="empty-table-message">No jobs found for this postcode, month and year.</td>
      </tr>
    `;
    return;
  }

  document.querySelector("#jobsTableBody").innerHTML = rows.map((job) => {
    const index = jobs.indexOf(job);
    const completed = jobCompleted(job);
    const displayStatus = completed ? "Completed" : "Not Completed";
    const statusClass = completed ? "ok" : "urgent";
    const type = jobClientType(job);

    return `
      <tr class="job-click-row" data-job-index="${index}">
        <td>${formatDateUk(job.date)}</td>
        <td><strong>${escapeHtml(job.address || "-")}</strong></td>
        <td><span class="job-postcode">${escapeHtml(job.postcode || "-")}</span></td>
        <td><span class="job-reference">${escapeHtml(job.number || "-")}</span></td>
        <td><span class="job-type-badge ${type.className}">${escapeHtml(type.label)}</span><span class="job-client-name">${escapeHtml(job.client || "-")}</span></td>
        <td>${escapeHtml(job.technician || "-")}</td>
        <td><span class="status job-status ${statusClass}">${escapeHtml(displayStatus || "-")}</span><div class="record-actions job-record-actions">${recordButtons("jobs", index)}</div></td>
      </tr>
    `;
  }).join("");
}

function activeTechnicianAssignmentOptions() {
  return staffProfiles
    .filter((staff) => staff.role === "Technician" && staff.status !== "Left" && staff.staffId && staff.technicianId)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function vehicleAssignedTechnician(vehicle = {}) {
  const staffId = vehicle.assignedStaffId || vehicle.assignedDriverStaffId || "";
  const technicianId = vehicle.assignedTechnicianId || "";
  return staffProfiles.find((staff) =>
    (staffId && staff.staffId === staffId)
    || (technicianId && staff.technicianId === technicianId)
  ) || null;
}

function vehicleAssignmentSelect(vehicle = {}, index = 0) {
  const assigned = vehicleAssignedTechnician(vehicle);
  const selected = assigned ? `${assigned.staffId}|${assigned.technicianId}` : "";
  const options = activeTechnicianAssignmentOptions();
  return `
    <div class="vehicle-assignment-control">
      <select data-vehicle-assignment-index="${index}" aria-label="Assigned technician for ${escapeHtml(vehicle.registration || "vehicle")}">
        <option value="">Not assigned</option>
        ${options.map((staff) => {
          const value = `${staff.staffId}|${staff.technicianId}`;
          return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(staff.name)}</option>`;
        }).join("")}
      </select>
      ${selected ? `<button class="secondary-button compact-button" type="button" data-remove-vehicle-assignment="${index}">Remove</button>` : ""}
    </div>
  `;
}

const vehicleInspectionReviewStatuses = ["Awaiting Review", "Action Required", "In Progress", "Resolved", "No Action Required", "Reviewed"];
const vehicleDefectReviewStatuses = ["Awaiting Review", "Action Required", "In Progress", "Resolved", "No Action Required"];
const vehicleDocumentTypes = ["MOT", "Insurance", "Road Tax", "Breakdown Cover", "Lease / Finance", "V5C / Registration", "Service Record", "Repair Record", "Inspection Record", "Warranty", "Recovery Information", "Other"];
const vehicleMaintenanceEventTypes = ["Service", "Repair", "Maintenance", "Inspection", "MOT", "Tyres", "Breakdown", "Other"];
const vehicleDocumentReminderDays = 60;
let activeVehicleRecordId = "";
let vehicleDocumentDraft = null;
let vehicleMaintenanceDraft = null;

function vehicleInspectionDefects(inspection = {}) {
  return Array.isArray(inspection.defects) ? inspection.defects : [];
}

function vehicleDocumentsFor(vehicle = {}) {
  return Array.isArray(vehicle.vehicleDocuments) ? vehicle.vehicleDocuments : [];
}

function vehicleMaintenanceFor(vehicle = {}) {
  return Array.isArray(vehicle.maintenanceRecords) ? vehicle.maintenanceRecords : [];
}

function vehicleDocumentStatusUi(documentRecord = {}) {
  const status = String(documentRecord.status || "");
  if (["Superseded", "Inactive", "Not Applicable"].includes(status)) {
    return { label: status, className: status === "Superseded" ? "warning" : "ok", days: Infinity };
  }
  if (documentRecord.noExpiry || !documentRecord.expiryDate) return { label: "Current", className: "ok", days: Infinity };
  const days = daysUntil(documentRecord.expiryDate);
  if (days < 0) return { label: "Expired", className: "urgent", days };
  if (days <= Number(documentRecord.reminderDays || vehicleDocumentReminderDays)) return { label: "Expiring Soon", className: "warning", days };
  return { label: "Current", className: "ok", days };
}

function vehicleDocumentTypeOptions(value = "") {
  return vehicleDocumentTypes.map((type) => `<option value="${escapeHtml(type)}" ${type === value ? "selected" : ""}>${escapeHtml(type)}</option>`).join("");
}

function vehicleMaintenanceTypeOptions(value = "") {
  return vehicleMaintenanceEventTypes.map((type) => `<option value="${escapeHtml(type)}" ${type === value ? "selected" : ""}>${escapeHtml(type)}</option>`).join("");
}

function readVehicleRecordFile(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(null);
      return;
    }
    const allowed = /^(application\/pdf|image\/jpeg|image\/png|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/msword|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel)$/i;
    const allowedName = /\.(pdf|png|jpe?g|docx?|xlsx?)$/i.test(file.name || "");
    if (!allowed.test(file.type || "") && !allowedName) {
      resolve({ error: "Please add a PDF, image, Word or Excel file." });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      resolve({ error: "Vehicle document files must be 15MB or smaller." });
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve({
        id: crypto.randomUUID(),
        name: file.name || `vehicle-document-${Date.now()}`,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size || 0,
        dataUrl: reader.result,
        addedAt: new Date().toISOString()
      });
    });
    reader.readAsDataURL(file);
  });
}

function vehicleInspectionReviewStatus(inspection = {}) {
  return inspection.officeReviewStatus || inspection.reviewStatus || "Awaiting Review";
}

function vehicleInspectionSortValue(inspection = {}) {
  const status = vehicleInspectionReviewStatus(inspection);
  const defects = vehicleInspectionDefects(inspection);
  const priority = inspection.safetyCritical ? 0 : status === "Awaiting Review" ? 1 : defects.length ? 2 : 3;
  return `${priority}-${9999999999999 - Date.parse(inspection.submittedAt || inspection.inspectionDateTime || 0)}`;
}

function filteredVehicleInspectionRecords() {
  const filter = document.querySelector("#vehicleInspectionReviewFilter")?.value || "awaiting";
  return [...vehicleInspectionRecords]
    .filter((inspection) => {
      const status = vehicleInspectionReviewStatus(inspection);
      const defects = vehicleInspectionDefects(inspection);
      if (filter === "awaiting") return status === "Awaiting Review";
      if (filter === "safety") return inspection.safetyCritical;
      if (filter === "defects") return defects.length > 0;
      if (filter === "no-defects") return defects.length === 0;
      if (filter === "reviewed") return status !== "Awaiting Review";
      return true;
    })
    .sort((a, b) => vehicleInspectionSortValue(a).localeCompare(vehicleInspectionSortValue(b)));
}

function vehicleInspectionStatusClass(status = "") {
  const label = String(status || "");
  if (label === "Resolved" || label === "No Action Required" || label === "Reviewed") return "ok";
  if (label === "In Progress") return "warning";
  if (label === "Action Required") return "urgent";
  return "warning";
}

function vehicleInspectionStatusOptions(value = "", statuses = vehicleInspectionReviewStatuses) {
  const selectedValue = value || statuses[0];
  return statuses.map((status) => `<option value="${escapeHtml(status)}" ${status === selectedValue ? "selected" : ""}>${escapeHtml(status)}</option>`).join("");
}

function vehicleInspectionLinkedAction(defect = {}, inspection = {}) {
  return actionItems.find((item) =>
    (defect.defectId && item.actionId === defect.defectId)
    || (item.inspectionId === inspection.inspectionId && item.vehicleId === inspection.vehicleId && item.title?.includes(defect.label || ""))
  ) || null;
}

function renderVehicleInspectionReviews() {
  const tableBody = document.querySelector("#vehicleInspectionReviewTableBody");
  if (!tableBody) return;
  const rows = filteredVehicleInspectionRecords();
  tableBody.innerHTML = rows.map((inspection) => {
    const defects = vehicleInspectionDefects(inspection);
    const status = vehicleInspectionReviewStatus(inspection);
    return `
      <tr>
        <td><strong>${escapeHtml(inspection.inspectionWeekStart ? formatDateUk(inspection.inspectionWeekStart) : inspection.inspectionId || "-")}</strong><br><span class="meta">${escapeHtml(inspection.inspectionId || "")}</span></td>
        <td>${escapeHtml(inspection.registration || inspection.vehicleSnapshot?.registration || "-")}<br><span class="meta">${escapeHtml(inspection.vehicle || inspection.vehicleSnapshot?.vehicle || "")}</span></td>
        <td>${escapeHtml(inspection.technicianName || inspection.technicianId || "-")}</td>
        <td>${escapeHtml(inspection.submittedAt ? formatDateTimeUk(inspection.submittedAt) : "-")}</td>
        <td><span class="status ${defects.length ? "urgent" : "ok"}">${defects.length ? `${defects.length} defect${defects.length === 1 ? "" : "s"}` : "No defects"}</span>${inspection.safetyCritical ? '<br><span class="status urgent">Safety-critical</span>' : ""}</td>
        <td><span class="status ${vehicleInspectionStatusClass(status)}">${escapeHtml(status)}</span></td>
        <td><button class="secondary-button compact-button" type="button" data-view-vehicle-inspection="${escapeHtml(inspection.inspectionId || "")}">Review</button></td>
      </tr>
    `;
  }).join("") || '<tr><td colspan="7">No submitted vehicle checks match this filter.</td></tr>';
}

function renderVehicleRecordDetail(vehicleId = activeVehicleRecordId) {
  const detail = document.querySelector("#vehicleRecordDetail");
  if (!detail) return;
  activeVehicleRecordId = vehicleId || "";
  if (!activeVehicleRecordId) {
    detail.innerHTML = "";
    return;
  }
  const vehicle = vehicles.map(asVehicleObject).find((item) => item.vehicleId === activeVehicleRecordId);
  if (!vehicle) {
    detail.innerHTML = "";
    return;
  }
  const assigned = vehicleAssignedTechnician(vehicle);
  const documents = vehicleDocumentsFor(vehicle).map((documentRecord) => ({ ...documentRecord, statusInfo: vehicleDocumentStatusUi(documentRecord) }));
  const maintenance = vehicleMaintenanceFor(vehicle).sort((a, b) => String(b.date || b.recordedAt || "").localeCompare(String(a.date || a.recordedAt || "")));
  const inspections = vehicleInspectionRecords.filter((record) => record.vehicleId === vehicle.vehicleId).sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
  const defectIds = inspections.flatMap((record) => vehicleInspectionDefects(record).map((defect) => defect.defectId));
  const auditRows = universalAuditEvents
    .filter((event) =>
      event.entityId === vehicle.vehicleId
      || documents.some((documentRecord) => documentRecord.documentId === event.entityId)
      || maintenance.some((record) => record.maintenanceId === event.entityId)
      || inspections.some((record) => record.inspectionId === event.entityId)
      || defectIds.includes(event.entityId)
    )
    .slice(-10)
    .reverse();
  detail.innerHTML = `
    <article class="vehicle-record-card">
      <div class="panel-heading compact-panel-heading">
        <div>
          <h3>${escapeHtml(vehicle.registration || "Vehicle Record")}</h3>
          <p class="section-support">${escapeHtml(vehicle.vehicle || "Vehicle")} | ${escapeHtml(vehicle.vehicleId || "")}</p>
        </div>
        <button class="secondary-button compact-button" type="button" data-close-vehicle-record>Close</button>
      </div>
      <div class="vehicle-record-grid">
        <div class="vehicle-record-field"><span>Assignment</span><strong>${escapeHtml(assigned?.name || "Not assigned")}</strong></div>
        <div class="vehicle-record-field"><span>Status</span><strong>${escapeHtml(vehicle.status || "Active")}</strong></div>
        <div class="vehicle-record-field"><span>MOT</span><strong>${escapeHtml(vehicle.mot ? formatDateUk(vehicle.mot) : "Not set")}</strong></div>
        <div class="vehicle-record-field"><span>Insurance</span><strong>${escapeHtml(vehicle.insurance ? formatDateUk(vehicle.insurance) : "Not set")}</strong></div>
        <div class="vehicle-record-field"><span>Documents</span><strong>${documents.length} record${documents.length === 1 ? "" : "s"}</strong></div>
        <div class="vehicle-record-field"><span>Inspections</span><strong>${inspections.length} submitted</strong></div>
      </div>
      <h4>Vehicle Documents</h4>
      <div class="vehicle-document-list">
        ${documents.map((documentRecord) => `
          <article class="vehicle-document-row">
            <div class="vehicle-record-actions">
              <strong>${escapeHtml(documentRecord.title || documentRecord.documentType || "Vehicle document")}</strong>
              <span class="status ${documentRecord.statusInfo.className}">${escapeHtml(documentRecord.statusInfo.label)}</span>
            </div>
            <p class="meta">${escapeHtml(documentRecord.documentType || "Other")} | ${documentRecord.expiryDate ? `Expires ${formatDateUk(documentRecord.expiryDate)}` : "No expiry"}${documentRecord.reference ? ` | Ref ${documentRecord.reference}` : ""}</p>
            <p class="meta">${escapeHtml(documentRecord.fileName || documentRecord.originalFileName || "No file attached")}${documentRecord.version ? ` | v${documentRecord.version}` : ""}</p>
            <div class="vehicle-record-actions">
              ${documentRecord.storageLocation ? `<button class="secondary-button compact-button" type="button" data-open-vehicle-document="${escapeHtml(documentRecord.documentId)}">Open</button>` : ""}
              <label class="secondary-button compact-button">
                Replace
                <input class="visually-hidden" type="file" data-replace-vehicle-document="${escapeHtml(documentRecord.documentId)}" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,image/*,application/pdf">
              </label>
              ${documentRecord.status !== "Superseded" ? `<button class="danger-button compact-button" type="button" data-supersede-vehicle-document="${escapeHtml(documentRecord.documentId)}">Supersede</button>` : ""}
            </div>
          </article>
        `).join("") || '<p class="empty-state compact-empty">No vehicle documents recorded.</p>'}
      </div>
      <form class="vehicle-record-form" data-vehicle-document-form="${escapeHtml(vehicle.vehicleId)}">
        <h4>Add Vehicle Document</h4>
        <div class="vehicle-form-grid">
          <label>Type<select name="documentType">${vehicleDocumentTypeOptions()}</select></label>
          <label>Title<input name="title" required></label>
          <label>Issue date<input name="issueDate" type="date"></label>
          <label>Expiry date<input name="expiryDate" type="date"></label>
          <label>Reference / policy<input name="reference"></label>
          <label>Reminder days<input name="reminderDays" type="number" min="1" value="${vehicleDocumentReminderDays}"></label>
        </div>
        <label>Note<textarea name="notes"></textarea></label>
        <label>Document file<input type="file" data-vehicle-document-file accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,image/*,application/pdf"></label>
        <p class="meta" id="vehicleDocumentDraftLabel">${vehicleDocumentDraft ? escapeHtml(vehicleDocumentDraft.name) : "No file selected."}</p>
        <button class="primary-button compact-button" type="submit">Save Document</button>
      </form>
      <h4>Service, Repair and Maintenance</h4>
      <div class="vehicle-maintenance-list">
        ${maintenance.map((record) => `
          <article class="vehicle-maintenance-row">
            <strong>${escapeHtml(record.eventType || "Vehicle event")} - ${escapeHtml(record.date ? formatDateUk(record.date) : "No date")}</strong>
            <p>${escapeHtml(record.description || "")}</p>
            <p class="meta">${escapeHtml(record.supplier || "No supplier")}${record.mileage ? ` | ${record.mileage} miles` : ""}${record.followUpDate ? ` | Follow-up ${formatDateUk(record.followUpDate)}` : ""}${record.evidence?.fileName ? ` | Evidence ${record.evidence.fileName}` : ""}</p>
          </article>
        `).join("") || '<p class="empty-state compact-empty">No service or maintenance history recorded.</p>'}
      </div>
      <form class="vehicle-record-form" data-vehicle-maintenance-form="${escapeHtml(vehicle.vehicleId)}">
        <h4>Add Service / Repair Record</h4>
        <div class="vehicle-form-grid">
          <label>Event type<select name="eventType">${vehicleMaintenanceTypeOptions()}</select></label>
          <label>Date<input name="date" type="date" required></label>
          <label>Mileage<input name="mileage" type="number" min="0"></label>
          <label>Supplier / garage<input name="supplier"></label>
          <label>Cost<input name="cost" type="number" min="0" step="0.01"></label>
          <label>Follow-up date<input name="followUpDate" type="date"></label>
        </div>
        <label>Description<textarea name="description" required></textarea></label>
        <label>Office note<textarea name="officeNote"></textarea></label>
        <label>Evidence file<input type="file" data-vehicle-maintenance-file accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,image/*,application/pdf"></label>
        <p class="meta" id="vehicleMaintenanceDraftLabel">${vehicleMaintenanceDraft ? escapeHtml(vehicleMaintenanceDraft.name) : "No evidence selected."}</p>
        <button class="secondary-button compact-button" type="submit">Save Service / Repair</button>
      </form>
      <h4>Weekly Inspection History</h4>
      <div class="vehicle-checklist-summary">
        ${inspections.map((record) => `<div class="vehicle-checklist-row"><strong>${escapeHtml(record.inspectionWeekStart ? formatDateUk(record.inspectionWeekStart) : record.inspectionId)}</strong><span class="status ${record.safetyCritical ? "urgent" : vehicleInspectionDefects(record).length ? "warning" : "ok"}">${vehicleInspectionDefects(record).length ? `${vehicleInspectionDefects(record).length} defect${vehicleInspectionDefects(record).length === 1 ? "" : "s"}` : "No defects"}</span><p class="meta">${escapeHtml(record.submittedAt ? formatDateTimeUk(record.submittedAt) : "")}</p></div>`).join("") || '<p class="empty-state compact-empty">No weekly inspections submitted for this vehicle.</p>'}
      </div>
      <h4>Audit</h4>
      <div class="vehicle-audit-list">
        ${auditRows.map((event) => `<div class="vehicle-audit-row"><strong>${escapeHtml(event.action || "Audit event")}</strong><br><span class="meta">${escapeHtml(event.performedAt ? formatDateTimeUk(event.performedAt) : "")} | ${escapeHtml(event.performedByUserId || "-")}</span></div>`).join("") || '<p class="empty-state compact-empty">No vehicle audit activity yet.</p>'}
      </div>
    </article>
  `;
}

function renderVehicleInspectionDetail(inspectionId = "") {
  const detail = document.querySelector("#vehicleInspectionReviewDetail");
  if (!detail) return;
  const inspection = vehicleInspectionRecords.find((record) => record.inspectionId === inspectionId);
  if (!inspection) {
    detail.innerHTML = "";
    return;
  }
  const defects = vehicleInspectionDefects(inspection);
  const auditRows = universalAuditEvents
    .filter((event) => event.entityId === inspection.inspectionId || defects.some((defect) => defect.defectId === event.entityId))
    .slice(-8)
    .reverse();
  detail.innerHTML = `
    <article class="vehicle-review-card">
      <h4>${escapeHtml(inspection.registration || "Vehicle check")} - ${escapeHtml(inspection.inspectionWeekStart ? formatDateUk(inspection.inspectionWeekStart) : inspection.inspectionId || "")}</h4>
      <div class="vehicle-review-grid">
        <div class="vehicle-review-field"><span>Vehicle</span><strong>${escapeHtml(`${inspection.registration || "-"} ${inspection.vehicle ? "| " + inspection.vehicle : ""}`)}</strong></div>
        <div class="vehicle-review-field"><span>Technician</span><strong>${escapeHtml(inspection.technicianName || inspection.technicianId || "-")}</strong></div>
        <div class="vehicle-review-field"><span>Submitted</span><strong>${escapeHtml(inspection.submittedAt ? formatDateTimeUk(inspection.submittedAt) : "-")}</strong></div>
        <div class="vehicle-review-field"><span>Mileage</span><strong>${escapeHtml(String(inspection.currentMileage || "-"))}</strong></div>
      </div>
      <form class="vehicle-review-form" data-vehicle-inspection-review-form="${escapeHtml(inspection.inspectionId || "")}">
        <label>
          Office review status
          <select name="officeReviewStatus">${vehicleInspectionStatusOptions(vehicleInspectionReviewStatus(inspection))}</select>
        </label>
        <label>
          Office review note
          <textarea name="officeReviewNote" placeholder="Add review note">${escapeHtml(inspection.officeReviewNote || "")}</textarea>
        </label>
        <button class="primary-button compact-button" type="submit">Save Review</button>
      </form>
      <h4>Checklist</h4>
      <div class="vehicle-checklist-summary">
        ${(Array.isArray(inspection.checklist) ? inspection.checklist : []).map((answer) => `
          <div class="vehicle-checklist-row">
            <strong>${escapeHtml(answer.label || answer.itemId || "Checklist item")}</strong>
            <span class="status ${answer.result === "Defect" ? "urgent" : answer.result === "Pass" ? "ok" : "warning"}">${escapeHtml(answer.result || "-")}</span>
            ${answer.explanation ? `<p class="meta">${escapeHtml(answer.explanation)}</p>` : ""}
          </div>
        `).join("") || '<p class="empty-state">No checklist answers stored.</p>'}
      </div>
      <h4>Defects</h4>
      <div class="vehicle-defect-list">
        ${defects.map((defect) => {
          const linkedAction = vehicleInspectionLinkedAction(defect, inspection);
          return `
            <article class="vehicle-defect-card ${defect.safetyCritical ? "safety-critical" : ""}">
              <strong>${escapeHtml(defect.label || defect.itemId || "Vehicle defect")}</strong>
              <span class="status ${defect.safetyCritical ? "urgent" : "warning"}">${defect.safetyCritical ? "Safety-critical" : "Defect"}</span>
              <p>${escapeHtml(defect.explanation || "No explanation supplied.")}</p>
              <p class="meta">${defect.photoAttached ? `Photo: ${escapeHtml(defect.photoName || "Attached")}` : "No photo attached"}${linkedAction ? ` | Action: ${escapeHtml(linkedAction.status || "New")}` : ""}</p>
              <form class="vehicle-defect-review-form" data-vehicle-defect-review-form="${escapeHtml(inspection.inspectionId || "")}" data-defect-id="${escapeHtml(defect.defectId || "")}">
                <label>
                  Defect status
                  <select name="status">${vehicleInspectionStatusOptions(defect.reviewStatus || defect.status || "Awaiting Review", vehicleDefectReviewStatuses)}</select>
                </label>
                <label>
                  Responsible person
                  <input name="responsiblePerson" value="${escapeHtml(defect.responsiblePerson || "")}" placeholder="Office owner">
                </label>
                <label>
                  Target date
                  <input name="targetDate" type="date" value="${escapeHtml(defect.targetDate || "")}">
                </label>
                <label>
                  Office assessment / resolution note
                  <textarea name="resolutionNote" placeholder="Record office action or resolution">${escapeHtml(defect.resolutionNote || defect.officeAssessment || "")}</textarea>
                </label>
                <button class="secondary-button compact-button" type="submit">Save Defect</button>
              </form>
            </article>
          `;
        }).join("") || '<p class="empty-state">No defects were reported on this check.</p>'}
      </div>
      <h4>Audit</h4>
      <div class="vehicle-audit-list">
        ${auditRows.map((event) => `<div class="vehicle-audit-row"><strong>${escapeHtml(event.action || "Audit event")}</strong><br><span class="meta">${escapeHtml(event.performedAt ? formatDateTimeUk(event.performedAt) : "")} | ${escapeHtml(event.performedByUserId || "-")}</span></div>`).join("") || '<p class="empty-state">No vehicle review audit events yet.</p>'}
      </div>
    </article>
  `;
}

function renderVehicles() {
  document.querySelector("#vehiclesTableBody").innerHTML = vehicles.map((rawVehicle, index) => {
    const vehicle = asVehicleObject(rawVehicle);
    const assigned = vehicleAssignedTechnician(vehicle);
    const motStatus = vehicleExpiryStatus(vehicle.mot);
    const insuranceStatus = vehicleExpiryStatus(vehicle.insurance);
    return `
    <tr>
      <td><strong>${escapeHtml(vehicle.registration)}</strong><br><span class="meta">${escapeHtml(vehicle.vehicleId)}</span></td>
      <td>${escapeHtml(vehicle.vehicle)}</td>
      <td>${escapeHtml(vehicle.driver || assigned?.name || "-")}</td>
      <td><span class="status ${motStatus.className}">${escapeHtml(motStatus.label)}</span></td>
      <td><span class="status ${insuranceStatus.className}">${escapeHtml(insuranceStatus.label)}</span></td>
      <td><span class="status ${vehicle.tracker === "Active" ? "ok" : "warning"}">${escapeHtml(vehicle.tracker || "-")}</span></td>
      <td>${vehicleAssignmentSelect(vehicle, index)}</td>
      <td><div class="record-actions"><button class="secondary-button" type="button" data-view-vehicle-record="${escapeHtml(vehicle.vehicleId || "")}">View</button>${recordButtons("vehicles", index)}</div></td>
    </tr>
  `;
  }).join("") || '<tr><td colspan="8">No vehicles have been added yet.</td></tr>';
  if (activeVehicleRecordId) renderVehicleRecordDetail(activeVehicleRecordId);
  renderVehicleInspectionReviews();
}

async function refreshVehicleInspectionReviews() {
  await loadCommandData();
  renderVehicles();
}

async function saveVehicleInspectionReview(form) {
  const inspectionId = form.dataset.vehicleInspectionReviewForm;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch("/api/phase-09c/vehicle-inspections/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inspectionId,
        officeReviewStatus: payload.officeReviewStatus,
        officeReviewNote: payload.officeReviewNote,
        officeUserName: currentUserName()
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || "Vehicle inspection review could not be saved.");
    await loadCommandData();
    renderVehicles();
    renderVehicleInspectionDetail(inspectionId);
    await kcInfo("Vehicle inspection review saved.");
  } catch (error) {
    await kcInfo(error.message || "Vehicle inspection review could not be saved.");
  }
}

async function saveVehicleDefectReview(form) {
  const inspectionId = form.dataset.vehicleDefectReviewForm;
  const defectId = form.dataset.defectId;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch("/api/phase-09c/vehicle-defects/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inspectionId,
        defectId,
        status: payload.status,
        responsiblePerson: payload.responsiblePerson,
        targetDate: payload.targetDate,
        resolutionNote: payload.resolutionNote,
        officeUserName: currentUserName()
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || "Vehicle defect review could not be saved.");
    await loadCommandData();
    renderVehicles();
    renderVehicleInspectionDetail(inspectionId);
    await kcInfo("Vehicle defect review saved.");
  } catch (error) {
    await kcInfo(error.message || "Vehicle defect review could not be saved.");
  }
}

async function saveVehicleDocument(form) {
  const vehicleId = form.dataset.vehicleDocumentForm;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch("/api/phase-09d/vehicle-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        ...payload,
        reminderDays: Number(payload.reminderDays || vehicleDocumentReminderDays),
        document: vehicleDocumentDraft,
        officeUserName: currentUserName()
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || "Vehicle document could not be saved.");
    vehicleDocumentDraft = null;
    await loadCommandData();
    renderVehicles();
    renderVehicleRecordDetail(vehicleId);
    await kcInfo("Vehicle document saved.");
  } catch (error) {
    await kcInfo(error.message || "Vehicle document could not be saved.");
  }
}

async function saveVehicleMaintenance(form) {
  const vehicleId = form.dataset.vehicleMaintenanceForm;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch("/api/phase-09d/vehicle-maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        ...payload,
        evidence: vehicleMaintenanceDraft,
        officeUserName: currentUserName()
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || "Vehicle maintenance record could not be saved.");
    vehicleMaintenanceDraft = null;
    await loadCommandData();
    renderVehicles();
    renderVehicleRecordDetail(vehicleId);
    await kcInfo("Vehicle service or repair record saved.");
  } catch (error) {
    await kcInfo(error.message || "Vehicle service or repair record could not be saved.");
  }
}

async function supersedeVehicleDocument(documentId) {
  const confirmed = await kcConfirmAction("Mark this vehicle document as superseded? The historic record will be retained.", "Supersede Document", true);
  if (!confirmed) return;
  try {
    const response = await fetch("/api/phase-09d/vehicle-documents/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: activeVehicleRecordId,
        documentId,
        action: "supersede",
        officeUserName: currentUserName()
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || "Vehicle document could not be superseded.");
    await loadCommandData();
    renderVehicles();
    renderVehicleRecordDetail(activeVehicleRecordId);
    await kcInfo("Vehicle document marked as superseded.");
  } catch (error) {
    await kcInfo(error.message || "Vehicle document could not be superseded.");
  }
}

async function replaceVehicleDocument(documentId, file) {
  const entry = await readVehicleRecordFile(file);
  if (!entry || entry.error) {
    await kcInfo(entry?.error || "Please select a replacement vehicle document.");
    return;
  }
  try {
    const response = await fetch("/api/phase-09d/vehicle-documents/replace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: activeVehicleRecordId,
        documentId,
        document: entry,
        officeUserName: currentUserName()
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || "Vehicle document could not be replaced.");
    await loadCommandData();
    renderVehicles();
    renderVehicleRecordDetail(activeVehicleRecordId);
    await kcInfo("Vehicle document replaced. Previous evidence has been retained in the record history.");
  } catch (error) {
    await kcInfo(error.message || "Vehicle document could not be replaced.");
  }
}

async function openVehicleDocument(documentId) {
  const vehicle = vehicles.map(asVehicleObject).find((item) => item.vehicleId === activeVehicleRecordId);
  const documentRecord = vehicleDocumentsFor(vehicle).find((item) => item.documentId === documentId);
  if (!documentRecord?.storageLocation) {
    await kcInfo("No saved file location is available for this vehicle document.");
    return;
  }
  window.open(localFileUrl(documentRecord.storageLocation), "_blank", "noopener");
}

async function updateVehicleAssignment(index, assignmentValue = "") {
  const vehicle = asVehicleObject(vehicles[Number(index)] || {});
  if (!vehicle.vehicleId) {
    await kcInfo("This vehicle needs a stable Vehicle ID before it can be assigned.");
    renderVehicles();
    return false;
  }
  const [staffId = "", technicianId = ""] = String(assignmentValue || "").split("|");
  const selectedStaff = staffProfiles.find((staff) => staff.staffId === staffId && staff.technicianId === technicianId);
  const existing = vehicleAssignedTechnician(vehicle);
  const removing = !staffId && !technicianId;
  const message = removing
    ? `Remove the technician assignment from ${vehicle.registration || vehicle.vehicle}?`
    : existing
      ? `Change ${vehicle.registration || vehicle.vehicle} from ${existing.name} to ${selectedStaff?.name || "the selected technician"}?`
      : `Assign ${vehicle.registration || vehicle.vehicle} to ${selectedStaff?.name || "the selected technician"}?`;
  const confirmed = await kcConfirmAction(message, removing ? "Remove Assignment" : "Save Assignment", removing);
  if (!confirmed) {
    renderVehicles();
    return false;
  }
  try {
    const response = await fetch("/api/phase-09a/vehicle-assignment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: vehicle.vehicleId,
        staffId,
        technicianId,
        remove: removing,
        officeUserName: currentUserName()
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || "Vehicle assignment could not be saved.");
    await loadCommandData();
    render();
    await kcInfo(removing ? "Vehicle assignment removed." : "Vehicle assignment saved.");
    return true;
  } catch (error) {
    await kcInfo(error.message || "Vehicle assignment could not be saved.");
    renderVehicles();
    return false;
  }
}

function renderCompliance() {
  const sourceRecords = complianceRecords();
  const records = filteredCompliance().map((item) => ({
    ...item,
    _index: sourceRecords.findIndex((record) => (record.id || record.recordId || record.title) === (item.id || item.recordId || item.title)),
    status: complianceStatus(item)
  }));
  const allRecords = sourceRecords.map((item) => ({ ...item, status: complianceStatus(item) }));

  document.querySelector("#greenComplianceCount").textContent = allRecords.filter((item) => item.status.className === "green").length;
  document.querySelector("#amberComplianceCount").textContent = allRecords.filter((item) => item.status.className === "amber").length;
  document.querySelector("#redComplianceCount").textContent = allRecords.filter((item) => item.status.className === "red").length;
  document.querySelector("#totalComplianceCount").textContent = allRecords.length;

  document.querySelector("#complianceTableBody").innerHTML = records
    .sort((a, b) => a.status.days - b.status.days)
    .map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.title)}</strong><br><span class="meta">${escapeHtml(item.certificateNumber || item.notes || "")}</span></td>
        <td>${escapeHtml(item.complianceType)}</td>
        <td>${escapeHtml(item.provider || "-")}</td>
        <td>${item.noExpiry ? "No expiry" : formatDateUk(item.expiryDate)}</td>
        <td>${escapeHtml(item.responsiblePerson)}</td>
        <td><span class="status ${item.status.className === "red" ? "urgent" : item.status.className === "amber" ? "warning" : "ok"}">${escapeHtml(item.status.label)}</span><br><span class="meta">${escapeHtml(item.status.reminder)}</span></td>
        <td>${item.documentFileName ? `<button class="secondary-button compact-button" type="button" data-open-compliance-document-record="${item._index}">Open</button>` : '<span class="meta">No document</span>'}</td>
        <td><div class="record-actions">${complianceRecordButtons(item._index)}</div></td>
      </tr>
    `)
    .join("") || '<tr><td colspan="8">No company-level compliance records found.</td></tr>';
}

function renderFines() {
  const openFines = fines.filter(isFineOpen);
  const closedFines = fines.filter((fine) => !isFineOpen(fine));
  const totalValue = fines.reduce((sum, fine) => sum + fine.amount, 0);

  document.querySelector("#finesOpenCount").textContent = openFines.length;
  document.querySelector("#finesDeadlineSoonCount").textContent = fines.filter(isFineDeadlineSoon).length;
  document.querySelector("#finesClosedCount").textContent = closedFines.length;
  document.querySelector("#finesTotalValue").textContent = `GBP ${totalValue.toFixed(2)}`;

  document.querySelector("#finesTableBody").innerHTML = filteredFines()
    .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
    .map((fine) => {
      const vehicle = vehicles.map(asVehicleObject).find((item) => item.registration === fine.registration);
      const driver = technicians.find((item) => item.name === fine.driver);
      const linkedVehicle = vehicle ? `${fine.registration} | ${vehicle.vehicle}` : fine.registration;
      const linkedDriver = driver ? `${fine.driver} | ${driver.role}` : fine.driver;

      return `
        <tr>
          <td>${fine.date}</td>
          <td><strong>${escapeHtml(linkedVehicle)}</strong></td>
          <td>${escapeHtml(linkedDriver)}</td>
          <td>${escapeHtml(fine.location)}</td>
          <td>${escapeHtml(fineTypeLabel(fine))}</td>
          <td>GBP ${fine.amount.toFixed(2)}</td>
          <td>${fine.deadline}<br><span class="meta">${escapeHtml(fineDeadlineLabel(fine))}</span></td>
          <td><span class="status ${fineStatusClass(fine)}">${escapeHtml(fine.status)}</span></td>
          <td>${escapeHtml(fineEvidenceLabel(fine))}</td>
          <td>${escapeHtml(fine.notes)}<div class="record-actions">${recordButtons("fines", fines.indexOf(fine))}</div></td>
        </tr>
      `;
    })
    .join("");
}

function renderValuations() {
  setupValuationDateFilters();
  syncValuationClientFilter();
  const rows = filteredValuations();
  const outstanding = rows.filter(isReportOutstanding);
  const selectedMonth = selectedValuationMonthKey();
  const totals = valuationTotalsForMonth(selectedMonth);
  const monthText = monthLabel(`${selectedMonth}-01`);

  document.querySelector("#valuationPageMonthLabel").textContent = monthText;
  document.querySelector("#valuationPageDueLabel").textContent = ` | Valuation due ${lastWorkingDayOfMonth(`${selectedMonth}-01`)}`;
  document.querySelector("#valuationArkTotal").textContent = money(totals.ark);
  document.querySelector("#valuationJgTotal").textContent = money(totals.jg);
  document.querySelector("#valuationPrivateTotal").textContent = money(totals.private);
  document.querySelector("#valuationVergoTotal").textContent = money(totals.vergo);
  document.querySelector("#valuationReportOutstandingCount").textContent = outstanding.length;
  document.querySelector("#valuationTableRunningTotal").textContent = money(valuationTotalForRows(rows));

  document.querySelector("#valuationsTableBody").innerHTML = rows
    .slice(0, 500)
    .map((item) => {
      const index = valuations.indexOf(item);
      const clientType = jobClientType(item);
      return `
        <tr class="${valuationRowClass(item)}">
          <td>${formatDateUk(item.date)}</td>
          <td><strong>${escapeHtml(item.address)}</strong><br><span class="meta">${escapeHtml(`${item.postcode || ""} ${item.arkRef ? "| Ark " + item.arkRef : ""}`.trim())}</span></td>
          <td><span class="job-type-badge ${clientType.className}">${escapeHtml(clientType.label)}</span><span class="job-client-name">${escapeHtml(item.client)}</span></td>
          <td>${escapeHtml(item.technician)}</td>
          <td><span class="status ${isYes(item.completed) ? "ok" : "warning"}">${valuationStatusLabel(item.completed)}</span></td>
          <td><span class="status ${isReportOutstanding(item) ? "warning" : "ok"}">${valuationStatusLabel(item.reportReceived)}</span></td>
          <td>${money(item.cost)}</td>
          <td>
            <label class="table-checkbox">
              <input type="checkbox" data-valuation-checked="${index}" ${isArkReportComplete(item) ? "checked" : ""}>
              <span>Complete</span>
            </label>
          </td>
          <td>${escapeHtml(item.notes || "")}<div class="record-actions">${recordButtons("valuations", index)}</div></td>
        </tr>
      `;
    })
    .join("") || '<tr><td class="empty-state" colspan="9">No valuations found for this month.</td></tr>';
}

function renderPlanner() {
  syncPlannerWeeks();
  const selectedWeek = activePlannerWeek || plannerCurrentWeek();
  const board = plannerBoardHtml(selectedWeek, filteredPlannerItems(), true);

  document.querySelector("#plannerItemCount").textContent = board.weekItems.length;
  document.querySelector("#plannerTechnicianCount").textContent = board.technicians.length;
  document.querySelector("#plannerUnavailableCount").textContent = `${plannerUnavailableSlotCount(board.weekItems) + plannerDerivedUnavailableSlotCount(board.approvedLeaveEntries)} / ${board.technicians.length * board.days.length * 2}`;
  document.querySelector("#plannerWeekLabel").textContent = selectedWeek === "all" ? "All" : selectedWeek.replace("WC ", "");
  renderPlannerDispatchResults(selectedWeek);
  document.querySelector("#plannerBoard").innerHTML = board.html;
}

function plannerBoardHtml(selectedWeek = plannerCurrentWeek(), rows = null, editable = true) {
  const sourceRows = (rows || weeklyPlanner.filter((item) => selectedWeek === "all" || item.week === selectedWeek))
    .filter((item) => item.source !== "approved-holiday");
  const weekItems = weeklyPlanner
    .filter((item) => selectedWeek === "all" || item.week === selectedWeek)
    .filter((item) => item.source !== "approved-holiday");
  const approvedLeaveEntries = approvedHolidayPlannerEntries(selectedWeek);
  const approvedLeaveLookup = plannerLeaveLookup(approvedLeaveEntries);
  const selectedWeekStart = plannerWeekStartFromLabel(selectedWeek);
  const techniciansForWeek = [...new Set([
    ...staffProfiles.filter((staff) => String(staff.role || "").toLowerCase().includes("technician")).map((staff) => staff.name),
    ...technicians.map((tech) => tech.name),
    ...weekItems.map((item) => item.technician),
    ...approvedLeaveEntries.map((item) => item.technician)
  ].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const days = plannerWeekDays(selectedWeekStart);

  if (!techniciansForWeek.length || !days.length) {
    return {
      days,
      technicians: techniciansForWeek,
      weekItems,
      approvedLeaveEntries,
      html: '<p class="empty-state">No planner items found.</p>'
    };
  }

  const itemLookup = new Map(sourceRows.map((item) => [`${item.technician}|${item.date}|${item.session}`, item]));
  const html = `
    <div class="planner-screen">
      <div class="planner-spreadsheet" style="--planner-days:${days.length}">
        <div class="planner-head planner-name-head">Name</div>
        <div class="planner-head planner-session-head">Session</div>
        ${days.map((day) => `<div class="planner-head planner-day-head">${escapeHtml(day.label)}</div>`).join("")}
        ${techniciansForWeek.map((technician) => ["AM", "PM"].map((session) => {
          const breakClass = session === "PM" ? " planner-tech-break" : "";
          return `
            <div class="planner-name${breakClass}">${session === "AM" ? escapeHtml(technician) : ""}</div>
            <div class="planner-session${breakClass}">${session}</div>
            ${days.map((day) => plannerSheetCell(itemLookup.get(`${technician}|${day.date}|${session}`), approvedLeaveLookup.get(`${technician}|${day.date}|${session}`) || [], breakClass, {
              technician,
              date: day.date,
              day: day.label,
              session,
              week: selectedWeek,
              weekStart: selectedWeekStart,
              editable
            }, editable)).join("")}
          `;
        }).join("")).join("")}
      </div>
      ${plannerKey()}
    </div>
  `;

  return { days, technicians: techniciansForWeek, weekItems, approvedLeaveEntries, html };
}

function plannerSheetCell(item, leaveEntries = [], breakClass = "", seed = {}, editable = true) {
  const editableClass = editable ? " planner-cell-editable" : "";
  const leaveEntry = leaveEntries[0];
  const isFullDayLeaveContinuation = leaveEntry?.fullDay && seed.session === "PM";
  const fullDayClass = leaveEntry?.fullDay
    ? seed.session === "AM"
      ? " planner-full-day-leave-start"
      : " planner-full-day-leave-continuation"
    : "";
  if (!item) {
    if (leaveEntry) {
      return `
        <div class="planner-cell${editableClass} planner-derived-leave-cell${fullDayClass}${breakClass}"
          data-planner-create="true"
          data-date="${escapeHtml(seed.date || "")}"
          data-day="${escapeHtml(seed.day || "")}"
          data-technician="${escapeHtml(seed.technician || "")}"
          data-session="${escapeHtml(seed.session || "")}"
          data-week="${escapeHtml(seed.week || "")}"
          data-week-start="${escapeHtml(seed.weekStart || "")}">
          ${isFullDayLeaveContinuation ? "" : plannerLeaveIndicator(leaveEntry)}
        </div>
      `;
    }
    return `
      <div class="planner-cell${editableClass} planner-empty-cell${breakClass}"
        data-planner-create="true"
        data-date="${escapeHtml(seed.date || "")}"
        data-day="${escapeHtml(seed.day || "")}"
        data-technician="${escapeHtml(seed.technician || "")}"
        data-session="${escapeHtml(seed.session || "")}"
        data-week="${escapeHtml(seed.week || "")}"
        data-week-start="${escapeHtml(seed.weekStart || "")}">
      </div>
    `;
  }
  const index = weeklyPlanner.indexOf(item);
  const hasLeaveConflict = Boolean(leaveEntry);
  return `
    <div class="planner-cell${editableClass} ${plannerSlotClass(item)}${hasLeaveConflict ? ` planner-leave-conflict${fullDayClass}` : ""}${breakClass}" data-planner-index="${index}">
      <strong>${escapeHtml(plannerText(item))}</strong>
      ${hasLeaveConflict && !isFullDayLeaveContinuation ? plannerLeaveIndicator(leaveEntry, true) : ""}
      ${hasLeaveConflict ? plannerLeaveConflictWarning(leaveEntry) : ""}
      ${editable ? `<div class="record-actions">${recordButtons("planner", index)}</div>` : ""}
    </div>
  `;
}

function plannerKey() {
  return `
    <aside class="planner-key" aria-label="Planner key">
      <strong>Key:</strong>
      <span><i class="key-unavailable"></i>Holiday</span>
      <span><i class="key-provisional"></i>Provisional</span>
      <span><i class="key-sick"></i>Sick</span>
      <span><i class="key-other"></i>Other</span>
    </aside>
  `;
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function valuationCsvRows(rows) {
  const headings = [
    "Date",
    "Site / Client",
    "Address",
    "Postcode",
    "Job Ref",
    "Technician",
    "Cost",
    "Notes"
  ];
  return [
    headings.map(csvCell).join(","),
    ...rows.map((item) => [
      formatDateUk(item.date),
      item.client || "",
      item.address || "",
      item.postcode || "",
      item.arkRef || "",
      item.technician || "",
      Number(item.cost || 0).toFixed(2),
      item.notes || ""
    ].map(csvCell).join(","))
  ];
}

function downloadValuationCsv(rows, selectedMonth, label) {
  const csvRows = valuationCsvRows(rows);
  const blob = new Blob([`\uFEFF${csvRows.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Kingswood ${label} valuation ${selectedMonth}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function exportValuationGroup(group) {
  const selectedMonth = selectedValuationMonthKey();
  const groupLabels = {
    ark: "Ark",
    jg: "JG Pest Control",
    vergo: "Vergo",
    other: "Other"
  };
  const rows = valuationGroupRows(group, selectedMonth);
  const label = groupLabels[group] || "Valuations";

  if (!rows.length) {
    await kcInfo(`No ${label} valuation records found for ${valuationPeriodName(selectedMonth)}.`);
    return;
  }

  downloadValuationCsv(rows, selectedMonth, label);
}

function showValuationGraph() {
  const selectedMonth = selectedValuationMonthKey();
  const months = rollingValuationGraphData(selectedMonth);
  const selectedTotals = valuationGraphTotals(selectedMonth);
  const max = Math.max(...months.flatMap((item) => [item.ark, item.jg, item.vergo, item.other]), 1);
  const yearTotal = months.reduce((sum, item) => sum + item.total, 0);

  valuationGraphSubtitle.textContent = `${months[0].fullLabel} to ${months[11].fullLabel} | Selected month due ${lastWorkingDayOfMonth(`${selectedMonth}-01`)}`;
  valuationGraphContent.innerHTML = `
    <div class="valuation-graph-summary">
      <article>
        <span>Rolling 12 months</span>
        <strong>${money(yearTotal)}</strong>
      </article>
      <article>
        <span>Selected month</span>
        <strong>${money(selectedTotals.ark + selectedTotals.jg + selectedTotals.vergo + selectedTotals.other)}</strong>
      </article>
      <article>
        <span>Highest month</span>
        <strong>${money(Math.max(...months.map((item) => item.total), 0))}</strong>
      </article>
    </div>
    <div class="valuation-graph-legend" aria-label="Valuation graph key">
      <span><i class="ark"></i>Ark</span>
      <span><i class="jg"></i>JG Pest Control</span>
      <span><i class="vergo"></i>Vergo</span>
      <span><i class="other"></i>Other</span>
    </div>
    <div class="valuation-year-chart" aria-label="Rolling valuation totals">
      ${months.map((item) => `
        <article class="valuation-month-column ${item.key === selectedMonth ? "current" : ""}">
          <div class="valuation-month-bars">
            <i class="ark" title="Ark ${money(item.ark)}" style="height:${Math.max((item.ark / max) * 100, item.ark ? 5 : 0)}%"></i>
            <i class="jg" title="JG Pest Control ${money(item.jg)}" style="height:${Math.max((item.jg / max) * 100, item.jg ? 5 : 0)}%"></i>
            <i class="vergo" title="Vergo ${money(item.vergo)}" style="height:${Math.max((item.vergo / max) * 100, item.vergo ? 5 : 0)}%"></i>
            <i class="other" title="Other ${money(item.other)}" style="height:${Math.max((item.other / max) * 100, item.other ? 5 : 0)}%"></i>
          </div>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${money(item.total)}</span>
        </article>
      `).join("")}
    </div>
  `;
  valuationGraphDialog.showModal();
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function excelCell(value, type = "String", styleId = "") {
  const cleanType = type === "Number" ? "Number" : "String";
  const style = styleId ? ` ss:StyleID="${styleId}"` : "";
  return `<Cell${style}><Data ss:Type="${cleanType}">${xmlEscape(value)}</Data></Cell>`;
}

function excelMergedCell(value, type = "String", styleId = "", mergeAcross = 0) {
  const cleanType = type === "Number" ? "Number" : "String";
  const style = styleId ? ` ss:StyleID="${styleId}"` : "";
  const merge = mergeAcross ? ` ss:MergeAcross="${mergeAcross}"` : "";
  return `<Cell${style}${merge}><Data ss:Type="${cleanType}">${xmlEscape(value)}</Data></Cell>`;
}

function safeSheetName(name, usedNames) {
  const base = String(name || "Client")
    .replace(/[\\/?*:[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || "Client";
  let candidate = base;
  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = ` ${counter}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    counter += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function valuationPeriodName(monthKeyValue = selectedValuationMonthKey()) {
  return monthLabel(`${monthKeyValue}-01`);
}

function groupedValuationRows(rows) {
  const groups = new Map();
  rows.forEach((item) => {
    const client = item.client || "Other";
    if (!groups.has(client)) groups.set(client, []);
    groups.get(client).push(item);
  });
  return [...groups.entries()]
    .map(([client, items]) => ({
      client,
      items: items.sort((a, b) => String(a.address || "").localeCompare(String(b.address || ""))),
      total: valuationTotalForRows(items)
    }))
    .sort((a, b) => b.total - a.total || a.client.localeCompare(b.client));
}

function valuationWorkbookXml(rows, title, selectedMonth) {
  const period = valuationPeriodName(selectedMonth);
  const groups = groupedValuationRows(rows);
  const usedNames = new Set(["summary"]);
  const summaryRows = [
    `<Row>${excelCell("Kingswood (London) Ltd")}</Row>`,
    `<Row>${excelCell("Valuation Report")}</Row>`,
    `<Row>${excelCell(`Period: ${period}`)}</Row>`,
    `<Row></Row>`,
    `<Row>${excelCell("Totals by Client")}</Row>`,
    `<Row>${excelCell("Client")}${excelCell("Total (£)")}</Row>`,
    ...groups.map((group) => `<Row>${excelCell(group.client)}${excelCell(group.total.toFixed(2), "Number")}</Row>`),
    `<Row></Row>`,
    `<Row>${excelCell("Grand Total")}${excelCell(valuationTotalForRows(rows).toFixed(2), "Number")}</Row>`
  ].join("");

  const worksheets = [
    `<Worksheet ss:Name="Summary"><Table>${summaryRows}</Table></Worksheet>`,
    ...groups.map((group) => {
      const sheetName = safeSheetName(group.client, usedNames);
      const bodyRows = group.items.map((item) => `
        <Row>
          ${excelCell(item.address || "")}
          ${excelCell(item.postcode || "")}
          ${excelCell(item.arkRef || "")}
          ${excelCell((Number(item.cost) || 0).toFixed(2), "Number")}
        </Row>
      `).join("");
      return `
        <Worksheet ss:Name="${xmlEscape(sheetName)}">
          <Table>
            <Row>${excelCell(`Valuation: ${group.client}`)}</Row>
            <Row>${excelCell(`Period: ${period}`)}</Row>
            <Row></Row>
            <Row>${excelCell("Address")}${excelCell("Post code")}${excelCell("Ark Job ref")}${excelCell("Cost")}</Row>
            ${bodyRows}
            <Row>${excelCell("TOTAL")}${excelCell("")}${excelCell("")}${excelCell(group.total.toFixed(2), "Number")}</Row>
          </Table>
        </Worksheet>
      `;
    })
  ].join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Arial" ss:Size="10"/></Style>
  </Styles>
  ${worksheets}
</Workbook>`;
}

function styledValuationWorkbookXml(rows, title, selectedMonth) {
  const period = valuationPeriodName(selectedMonth);
  const groups = groupedValuationRows(rows);
  const usedNames = new Set(["summary"]);
  const grandTotal = valuationTotalForRows(rows);
  const styles = `
    <Style ss:ID="Default" ss:Name="Normal">
      <Font ss:FontName="Arial" ss:Size="10" ss:Color="#000000"/>
      <Alignment ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="CompanyTitle">
      <Font ss:FontName="Arial" ss:Size="14" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1F3864" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="ReportTitle">
      <Font ss:FontName="Arial" ss:Size="11" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1F3864" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="ClientTitle">
      <Font ss:FontName="Arial" ss:Size="13" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1F3864" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="Period">
      <Font ss:FontName="Arial" ss:Size="10" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#2E74B5" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="SectionTitle">
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#2E74B5" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#2E74B5" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
    </Style>
    <Style ss:ID="HeaderCentre" ss:Parent="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="HeaderRight" ss:Parent="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="Body">
      <Font ss:FontName="Arial" ss:Size="10" ss:Color="#000000"/>
      <Alignment ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
    </Style>
    <Style ss:ID="BodyAlt" ss:Parent="Body">
      <Interior ss:Color="#EBF3FB" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="BodyCentre" ss:Parent="Body">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="BodyCentreAlt" ss:Parent="BodyCentre">
      <Interior ss:Color="#EBF3FB" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Currency" ss:Parent="Body">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <NumberFormat ss:Format="&quot;&#163;&quot;#,##0.00"/>
    </Style>
    <Style ss:ID="CurrencyAlt" ss:Parent="Currency">
      <Interior ss:Color="#EBF3FB" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="TotalLabel">
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1F3864" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="TotalCurrency" ss:Parent="TotalLabel">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <NumberFormat ss:Format="&quot;&#163;&quot;#,##0.00"/>
    </Style>
  `;
  const summaryRows = [
    `<Row>${excelMergedCell("Kingswood (London) Ltd", "String", "CompanyTitle", 1)}</Row>`,
    `<Row>${excelMergedCell("Valuation Report", "String", "ReportTitle", 1)}</Row>`,
    `<Row>${excelMergedCell(`Period: ${period}`, "String", "Period", 1)}</Row>`,
    `<Row ss:Height="12"></Row>`,
    `<Row>${excelMergedCell("Totals by Client", "String", "SectionTitle", 1)}</Row>`,
    `<Row>${excelCell("Client", "String", "Header")}${excelCell("Total (£)", "String", "HeaderCentre")}</Row>`,
    ...groups.map((group, index) => {
      const alt = index % 2 === 0;
      return `<Row>${excelCell(group.client, "String", alt ? "BodyAlt" : "Body")}${excelCell(group.total.toFixed(2), "Number", alt ? "CurrencyAlt" : "Currency")}</Row>`;
    }),
    `<Row ss:Height="10"></Row>`,
    `<Row ss:Height="25">${excelCell("Grand Total", "String", "TotalLabel")}${excelCell(grandTotal.toFixed(2), "Number", "TotalCurrency")}</Row>`
  ].join("");
  const worksheets = [
    `<Worksheet ss:Name="Summary"><Table><Column ss:Width="224"/><Column ss:Width="112"/>${summaryRows}</Table></Worksheet>`,
    ...groups.map((group) => {
      const sheetName = safeSheetName(group.client, usedNames);
      const bodyRows = group.items.map((item, index) => {
        const alt = index % 2 === 0;
        return `
        <Row>
          ${excelCell(item.address || "", "String", alt ? "BodyAlt" : "Body")}
          ${excelCell(item.postcode || "", "String", alt ? "BodyCentreAlt" : "BodyCentre")}
          ${excelCell(item.arkRef || "", "String", alt ? "BodyCentreAlt" : "BodyCentre")}
          ${excelCell((Number(item.cost) || 0).toFixed(2), "Number", alt ? "CurrencyAlt" : "Currency")}
        </Row>
      `;
      }).join("");
      return `
        <Worksheet ss:Name="${xmlEscape(sheetName)}">
          <Table>
            <Column ss:Width="315"/>
            <Column ss:Width="98"/>
            <Column ss:Width="95"/>
            <Column ss:Width="84"/>
            <Row>${excelMergedCell(`Valuation: ${group.client}`, "String", "ClientTitle", 3)}</Row>
            <Row>${excelMergedCell(`Period: ${period}`, "String", "Period", 3)}</Row>
            <Row ss:Height="12"></Row>
            <Row>${excelCell("Address", "String", "Header")}${excelCell("Post code", "String", "HeaderCentre")}${excelCell("Ark Job ref", "String", "HeaderCentre")}${excelCell("Cost", "String", "HeaderCentre")}</Row>
            ${bodyRows}
            <Row ss:Height="25">${excelCell("TOTAL", "String", "TotalLabel")}${excelCell("", "String", "TotalLabel")}${excelCell("", "String", "TotalLabel")}${excelCell(group.total.toFixed(2), "Number", "TotalCurrency")}</Row>
          </Table>
        </Worksheet>
      `;
    })
  ].join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>${styles}</Styles>
  ${worksheets}
</Workbook>`;
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function valuationRowDescription(row) {
  return [
    row.address || "Unknown address",
    row.postcode || "",
    row.arkRef ? `ref ${row.arkRef}` : ""
  ].filter(Boolean).join(" | ");
}

async function reviewZeroValuationRows(rows) {
  const reviewedRows = [];
  let changed = false;

  for (const row of rows) {
    if (Number(row.cost || 0) !== 0) {
      reviewedRows.push(row);
      continue;
    }

    const removeFromValuation = await kcYesNo(
      `${valuationRowDescription(row)} has a valuation cost of £0.00.\n\nIs this correct? If yes, this line will be removed from the valuation. If no, you will be asked to add a value.`
    );

    if (removeFromValuation) {
      continue;
    }

    const enteredValue = await kcInput(`Enter the valuation value for:\n${valuationRowDescription(row)}`, "Valuation value");
    if (enteredValue === "cancel") {
      continue;
    }

    const amount = Number(String(enteredValue).replace(/[£,\s]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      await kcInfo("That value was not added because it was not a valid amount above £0.");
      continue;
    }

    row.cost = amount;
    if (Number.isInteger(row.sourceJobIndex) && jobs[row.sourceJobIndex]) {
      jobs[row.sourceJobIndex].cost = amount;
      changed = true;
    }
    changed = true;
    reviewedRows.push(row);
  }

  if (changed) {
    await saveCommandData();
    render();
  }

  return reviewedRows;
}

async function generateValuationWorkbook(group) {
  const selectedMonth = selectedValuationMonthKey();
  const groupLabels = {
    ark: "Ark",
    jg: "JG Pest Control",
    vergo: "Vergo",
    other: "Other"
  };
  const rows = await reviewZeroValuationRows(valuationGroupRows(group, selectedMonth));
  if (!rows.length) {
    await kcInfo(`No ${groupLabels[group]} valuation rows found for ${valuationPeriodName(selectedMonth)}.`);
    return;
  }
  const xml = styledValuationWorkbookXml(rows, groupLabels[group], selectedMonth);
  const fileMonth = selectedMonth.replace("-", "_");
  const filename = `Kingswood_Valuation_${groupLabels[group].replace(/\s+/g, "_")}_${fileMonth}.xls`;
  downloadTextFile(filename, xml, "application/vnd.ms-excel;charset=utf-8");
}

async function toggleValuationChecked(index, checked) {
  const valuation = valuations[Number(index)];
  if (!valuation) return;
  valuation.checked = checked ? "y" : "";
  valuation.arkReportCompleted = checked;
  await saveCommandData();
  renderValuations();
}

function trainingRecordActiveInYear(record, yearValue = activeTrainingYear) {
  const year = Number(yearValue || new Date().getFullYear());
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const completed = record.completedDate ? new Date(record.completedDate) : null;
  const expires = record.noExpiry || !record.expiryDate ? null : new Date(record.expiryDate);
  if (completed && completed > yearEnd) return false;
  if (expires && expires < yearStart) return false;
  return true;
}

function availableTrainingYears() {
  const currentYear = new Date().getFullYear();
  const years = new Set([currentYear, currentYear + 1, currentYear + 2]);
  trainingMatrix.forEach((record) => {
    const completedYear = record.completedDate ? Number(String(record.completedDate).slice(0, 4)) : 0;
    const expiryYear = record.expiryDate ? Number(String(record.expiryDate).slice(0, 4)) : 0;
    if (completedYear) years.add(completedYear);
    if (expiryYear) years.add(expiryYear);
  });
  return [...years].filter(Boolean).sort((a, b) => a - b).map(String);
}

function setTrainingYearFilterOptions() {
  const yearFilter = document.querySelector("#trainingYearFilter");
  if (!yearFilter) return;
  const current = activeTrainingYear || String(new Date().getFullYear());
  const years = availableTrainingYears();
  yearFilter.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  activeTrainingYear = years.includes(current) ? current : String(new Date().getFullYear());
  if (!years.includes(activeTrainingYear)) activeTrainingYear = years[0] || String(new Date().getFullYear());
  yearFilter.value = activeTrainingYear;
}

function staffTrainingRecords(staff) {
  return trainingMatrix.filter((record) => (record.staffId && record.staffId === staff.staffId) || record.employee === staff.name);
}

function staffToolboxAssignments(staff) {
  return tscAssignmentRecords.filter((assignment) =>
    (assignment.staffId && assignment.staffId === staff.staffId)
    || (assignment.employeeId && assignment.employeeId === staff.staffId)
    || assignment.employeeName === staff.name
  );
}

function staffEvidenceRecords(staff) {
  return tscEvidenceRecords.filter((record) =>
    (record.staffId && record.staffId === staff.staffId)
    || (record.employeeId && record.employeeId === staff.staffId)
    || record.employeeName === staff.name
  );
}

function staffAssignedAssets(staff) {
  return assets.map(asAssetObject).filter((asset) =>
    asset.assignedStaffId === staff.staffId
    || asset.assignedTo === staff.name
    || asset.holder === staff.name
  );
}

function staffAssignedVehicle(staff) {
  return vehicles.map(asVehicleObject).find((vehicle) =>
    vehicle.assignedStaffId === staff.staffId
    || (staff.technicianId && vehicle.assignedTechnicianId === staff.technicianId)
    || vehicle.driver === staff.name
  );
}

function staffOpenActions(staff) {
  return actionItems.filter((item) => {
    const status = String(item.status || "").toLowerCase();
    const linked = item.staffId === staff.staffId
      || item.assignedStaffId === staff.staffId
      || item.assignedToUserId === staff.staffId
      || item.assignedTo === staff.name;
    return linked && !["closed", "completed", "resolved"].includes(status);
  });
}

function staffAuditEvents(staff) {
  return universalAuditEvents.filter((event) =>
    event.entityId === staff.staffId
    || event.staffId === staff.staffId
    || event.recordId === staff.staffId
    || String(event.affectedRecord || "").includes(staff.name)
  ).slice(-10).reverse();
}

function isLikelyTestRecord(item = {}) {
  const text = [
    item.name,
    item.client,
    item.address,
    item.notes,
    item.phone,
    item.van,
    item.assignedVan,
    item.training,
    item.trainingRecords
  ].filter(Boolean).join(" ");
  return /\b(test|dummy|sample)\b/i.test(text) || /^dave$/i.test(String(item.name || ""));
}

function testRecordBadge(item = {}) {
  return isLikelyTestRecord(item) ? '<span class="status warning test-record-badge">Test record</span>' : "";
}

function staffTrainingAlertCount(staff) {
  return staffTrainingRecords(staff).filter((record) => trainingStatus(record).className !== "ok").length;
}

function staffHolidayRequestsFor(staff, status = "") {
  return holidayRequests.filter((request) => (request.staffId && request.staffId === staff.staffId) || request.name === staff.name)
    .filter((request) => !status || request.status === status);
}

function holidayPlannerMonthStart(monthKey = activeHolidayPlannerMonth) {
  const [year, month] = String(monthKey || today.slice(0, 7)).split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1);
}

function holidayPlannerMonthKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function holidayPlannerSetMonth(monthKey) {
  const candidate = /^\d{4}-\d{2}$/.test(String(monthKey || "")) ? monthKey : today.slice(0, 7);
  activeHolidayPlannerMonth = candidate;
  const monthInput = document.querySelector("#holidayPlannerMonthInput");
  if (monthInput) monthInput.value = activeHolidayPlannerMonth;
}

function holidayPlannerStatus(request = {}) {
  return String(request.status || "Pending").trim() || "Pending";
}

function holidayPlannerStatusVisible(status) {
  const selected = document.querySelector("#holidayPlannerStatusFilter")?.value || "active";
  const showDeclined = document.querySelector("#holidayPlannerShowDeclined")?.checked === true;
  const showCancelled = document.querySelector("#holidayPlannerShowCancelled")?.checked === true;
  if (selected === "all") {
    if (status === "Declined") return showDeclined;
    if (status === "Cancelled") return showCancelled;
    return true;
  }
  if (selected === "active") return status === "Approved" || status === "Pending";
  return status === selected;
}

function holidayPlannerRequestDates(request = {}) {
  return dateRangeValues(request.from, request.to || request.from);
}

function holidayPlannerRequests() {
  const employee = document.querySelector("#holidayPlannerEmployeeFilter")?.value || "all";
  const search = (document.querySelector("#holidayPlannerSearch")?.value || "").trim().toLowerCase();
  return holidayRequests
    .map((request, index) => ({ request, index, status: holidayPlannerStatus(request), dates: holidayPlannerRequestDates(request) }))
    .filter((item) => item.request.from)
    .filter((item) => holidayPlannerStatusVisible(item.status))
    .filter((item) => employee === "all" || item.request.name === employee || item.request.staffId === employee)
    .filter((item) => !search || String(item.request.name || "").toLowerCase().includes(search))
    .filter((item) => item.dates.some((date) => date.startsWith(activeHolidayPlannerMonth)));
}

function holidayPlannerMonthDates(monthKey = activeHolidayPlannerMonth) {
  const start = holidayPlannerMonthStart(monthKey);
  const gridStart = new Date(start);
  const day = gridStart.getDay() || 7;
  gridStart.setDate(gridStart.getDate() - (day - 1));
  const dates = [];
  const cursor = new Date(gridStart);
  for (let i = 0; i < 42; i += 1) {
    dates.push(localIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function holidayPlannerStatusClass(status = "") {
  return staffNotificationStatusClass(status);
}

function holidayPlannerEmployeeOptions() {
  const selected = document.querySelector("#holidayPlannerEmployeeFilter")?.value || "all";
  const options = [...new Set([
    ...staffProfiles.map((staff) => staff.name),
    ...holidayRequests.map((request) => request.name)
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const target = document.querySelector("#holidayPlannerEmployeeFilter");
  if (!target) return;
  target.innerHTML = '<option value="all">All employees</option>'
    + options.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  target.value = options.includes(selected) ? selected : "all";
}

function holidayPlannerSpanBlock(item, segment) {
  const request = item.request;
  const dates = segment.dates;
  const range = dates.length > 1 ? `${formatDateUk(request.from)} to ${formatDateUk(request.to || request.from)}` : formatDateUk(request.from);
  const compactStatus = `${holidayPlannerStatus(request)} Leave`;
  const style = `--holiday-row:${segment.row}; --holiday-col:${segment.startCol}; --holiday-span:${segment.span}; --holiday-offset:${34 + (segment.lane * 38)}px;`;
  return `
    <button class="holiday-calendar-span ${holidayPlannerStatusClass(item.status)} ${segment.startsRecord ? "range-start" : "range-continuation-start"} ${segment.endsRecord ? "range-end" : "range-continuation-end"}" type="button" data-holiday-planner-open="${item.index}" style="${escapeHtml(style)}" title="${escapeHtml(`${request.name || "Employee"} | ${range} | ${holidayPlannerStatus(request)}`)}" aria-label="${escapeHtml(`${request.name || "Employee"} ${range} ${holidayPlannerStatus(request)}`)}">
      <strong>${escapeHtml(request.name || "Employee")}</strong>
      <span>${escapeHtml(compactStatus)}</span>
    </button>
  `;
}

function holidayPlannerDayEntries(date, items) {
  return items.filter((item) => item.dates.includes(date));
}

function holidayPlannerSpanBlocks(items, dates) {
  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const laneUseByRow = new Map();
  const spans = [];

  items.forEach((item) => {
    const visibleDates = item.dates
      .filter((date) => dateIndex.has(date))
      .sort((a, b) => a.localeCompare(b));
    if (!visibleDates.length) return;

    let segmentDates = [];
    visibleDates.forEach((date) => {
      const index = dateIndex.get(date);
      const previousDate = segmentDates[segmentDates.length - 1];
      const previousIndex = previousDate ? dateIndex.get(previousDate) : null;
      const startsNewRow = previousIndex !== null && Math.floor(previousIndex / 7) !== Math.floor(index / 7);
      const isContiguous = previousDate && datePlusDays(previousDate, 1) === date;
      if (segmentDates.length && (!isContiguous || startsNewRow)) {
        spans.push({ item, dates: segmentDates });
        segmentDates = [];
      }
      segmentDates.push(date);
    });
    if (segmentDates.length) spans.push({ item, dates: segmentDates });
  });

  return spans.map((span) => {
    const firstDate = span.dates[0];
    const lastDate = span.dates[span.dates.length - 1];
    const firstIndex = dateIndex.get(firstDate);
    const row = Math.floor(firstIndex / 7) + 1;
    const startCol = (firstIndex % 7) + 1;
    const lane = laneUseByRow.get(row) || 0;
    laneUseByRow.set(row, lane + 1);
    return {
      ...span,
      row,
      startCol,
      span: span.dates.length,
      lane,
      startsRecord: firstDate === span.item.dates[0],
      endsRecord: lastDate === span.item.dates[span.item.dates.length - 1]
    };
  });
}

function renderHolidayPlannerCalendar() {
  const calendar = document.querySelector("#holidayPlannerCalendar");
  const title = document.querySelector("#holidayPlannerMonthTitle");
  if (!calendar) return;
  holidayPlannerSetMonth(activeHolidayPlannerMonth);
  holidayPlannerEmployeeOptions();
  const start = holidayPlannerMonthStart(activeHolidayPlannerMonth);
  if (title) {
    title.textContent = start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  const visible = holidayPlannerRequests();
  const dates = holidayPlannerMonthDates();
  const dayCells = dates.map((date) => {
    const entries = holidayPlannerDayEntries(date, visible);
    const inMonth = date.startsWith(activeHolidayPlannerMonth);
    return `
      <article class="holiday-calendar-day ${inMonth ? "" : "outside-month"} ${date === today ? "today" : ""} ${entries.length > 1 ? "multiple-away" : ""}">
        <div class="holiday-calendar-date">
          <strong>${Number(date.slice(8, 10))}</strong>
          ${entries.length > 1 ? '<span title="Multiple staff away">Multiple staff away</span>' : ""}
        </div>
      </article>
    `;
  }).join("");
  const spanBlocks = holidayPlannerSpanBlocks(visible, dates)
    .map((span) => holidayPlannerSpanBlock(span.item, span))
    .join("");
  calendar.innerHTML = dayCells + spanBlocks;
}

function holidayPlannerSummaryItems() {
  const visibleAll = holidayRequests
    .map((request, index) => ({ request, index, status: holidayPlannerStatus(request), dates: holidayPlannerRequestDates(request) }))
    .filter((item) => item.status === "Approved" || item.status === "Pending");
  const tomorrowValue = (() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return localIsoDate(date);
  })();
  const weekDates = new Set(dateRangeValues(today, (() => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    return localIsoDate(d);
  })()));
  const upcoming = visibleAll
    .filter((item) => item.dates.some((date) => date >= today))
    .sort((a, b) => String(a.request.from || "").localeCompare(String(b.request.from || "")))[0];
  return [
    ["Today's Leave", visibleAll.filter((item) => item.dates.includes(today))],
    ["Tomorrow's Leave", visibleAll.filter((item) => item.dates.includes(tomorrowValue))],
    ["This Week", visibleAll.filter((item) => item.dates.some((date) => weekDates.has(date)))],
    ["Pending Requests", visibleAll.filter((item) => item.status === "Pending")],
    ["Next Upcoming Holiday", upcoming ? [upcoming] : []]
  ];
}

function renderHolidayPlannerSummary() {
  const target = document.querySelector("#holidayPlannerSummary");
  if (!target) return;
  target.innerHTML = holidayPlannerSummaryItems().map(([title, items]) => `
    <section class="holiday-summary-block">
      <h4>${escapeHtml(title)}</h4>
      ${items.length ? items.slice(0, 5).map((item) => `
        <button class="holiday-summary-item" type="button" data-holiday-planner-open="${item.index}">
          <span>${escapeHtml(item.request.name || "Employee")}</span>
          <strong>${escapeHtml(formatDateUk(item.request.from))}${item.request.to && item.request.to !== item.request.from ? ` to ${escapeHtml(formatDateUk(item.request.to))}` : ""}</strong>
          <em class="holiday-status ${holidayPlannerStatusClass(item.status)}">${escapeHtml(item.status)}</em>
        </button>
      `).join("") : '<p class="empty-state compact-empty">No leave in this view.</p>'}
    </section>
  `).join("");
}

function renderHolidayPlanner() {
  if (!document.querySelector("#holiday-planner")) return;
  renderHolidayPlannerCalendar();
  renderHolidayPlannerSummary();
}

function openHolidayPlannerRecord(index) {
  const request = holidayRequests[Number(index)];
  if (!request) return;
  openDataDialog("holidays", String(index));
}

function openStaffHolidayPlanner(staffName) {
  const staff = staffProfiles.find((item) => item.name === staffName) || {};
  const next = staffHolidayRequestsFor(staff)
    .filter((request) => ["Approved", "Pending"].includes(holidayPlannerStatus(request)))
    .filter((request) => String(request.to || request.from || "") >= today)
    .sort((a, b) => String(a.from || "").localeCompare(String(b.from || "")))[0];
  activeHolidayPlannerMonth = String(next?.from || today).slice(0, 7);
  showSection("holiday-planner");
  renderHolidayPlanner();
  const employeeFilter = document.querySelector("#holidayPlannerEmployeeFilter");
  if (employeeFilter && [...employeeFilter.options].some((option) => option.value === staffName)) {
    employeeFilter.value = staffName;
    renderHolidayPlanner();
  }
}

function staffNextHoliday(staff) {
  return staffHolidayRequestsFor(staff, "Approved")
    .filter((request) => String(request.from || "") >= today)
    .sort((a, b) => String(a.from).localeCompare(String(b.from)))[0];
}

function staffCompactRow(title, detail, status = "") {
  const safeStatus = String(status || "");
  const statusClass = ["Approved", "Present", "Current", "No Expiry", "Completed", "Acknowledged"].includes(safeStatus)
    ? "ok"
    : ["Declined", "Sick", "Absent", "Absent - Called in Sick", "Expired", "Overdue"].includes(safeStatus)
      ? "urgent"
      : ["Superseded", "Inactive", "Not Applicable", "No Action Required"].includes(safeStatus)
        ? "muted"
        : "warning";
  return `
    <article class="staff-compact-row">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail || "")}</p>
      </div>
      ${status ? `<span class="status ${statusClass}">${escapeHtml(status)}</span>` : ""}
    </article>
  `;
}

function staffAttendanceRecordRow(record) {
  const index = attendanceRecords.indexOf(record);
  const type = attendanceType(record);
  const days = calculateAttendanceWorkingDays(record);
  const details = [
    attendanceDateLabel(record),
    record.dayType || "Full day",
    type === "Late" && record.minutesLate ? `${record.minutesLate} minutes late` : "",
    type !== "Late" ? `${formatLeaveNumber(days)} working day${Number(days) === 1 ? "" : "s"}` : "",
    attendanceIsOngoing(record) ? "Ongoing" : "",
    record.returnDate ? `Return ${formatDateUk(record.returnDate)}` : "",
    record.recordedBy ? `Recorded by ${record.recordedBy}` : "",
    record.recordedAt ? `Recorded ${formatDateUk(String(record.recordedAt).slice(0, 10))}` : "",
    record.confidentialNote ? "Confidential note" : "Non-confidential note"
  ].filter(Boolean).join(" | ");
  const auditRows = Array.isArray(record.auditTrail) && record.auditTrail.length
    ? `<div class="audit-trail-mini">${record.auditTrail.slice(-3).map((entry) => `<p>${escapeHtml(`${entry.action || "Audit"} by ${entry.by || "Unknown"} on ${formatDateUk(String(entry.at || "").slice(0, 10))}${entry.reason ? ` - ${entry.reason}` : ""}`)}</p>`).join("")}</div>`
    : "";
  const note = record.officeNotes || record.returnToWorkNotes || record.notes || "";
  const status = attendanceIsVoid(record) ? "Void" : (attendanceIsOngoing(record) ? "Ongoing" : type);
  const actions = index >= 0 ? `
    <div class="record-actions">
      <button class="secondary-button" type="button" data-edit-attendance="${index}">${attendanceIsOngoing(record) ? "Correct / Close" : "Correct"}</button>
      ${!attendanceIsVoid(record) ? `<button class="danger-button" type="button" data-void-attendance="${index}">Void</button>` : ""}
    </div>
  ` : "";
  return `
    <article class="staff-compact-row attendance-history-row">
      <div>
        <strong>${escapeHtml(type || "Attendance")}</strong>
        <p>${escapeHtml(details)}</p>
        ${note ? `<p>${record.confidentialNote ? "Confidential office note: " : "Office note: "}${escapeHtml(note)}</p>` : ""}
        ${auditRows}
        ${actions}
      </div>
      <span class="status ${attendanceIsVoid(record) ? "warning" : type === "Late" || attendanceIsOngoing(record) ? "warning" : type === "Sick" || type.includes("Absent") ? "urgent" : "ok"}">${escapeHtml(status)}</span>
    </article>
  `;
}

function renderSelectedStaffProfile(staff, index, currentYear) {
  const shell = document.querySelector("#staffProfileShell");
  const body = document.querySelector("#staffProfileTabBody");
  if (!shell || !body) return;
  if (!staff) {
    shell.innerHTML = `
      <div class="staff-selected-empty">
        <h3>No employee selected</h3>
        <p>Add a staff member or clear the search to select an employee.</p>
      </div>
    `;
    body.innerHTML = "";
    return;
  }

  const attendance = attendanceFor(staff.name, today);
  const leaveSummary = staffLeaveSummary(staff, currentYear);
  const attendanceSummary = annualAttendanceSummary(staff, currentYear);
  const trainingAlerts = staffTrainingAlertCount(staff);
  const nextHoliday = staffNextHoliday(staff);
  const toolboxAssignments = staffToolboxAssignments(staff);
  const evidenceRecords = staffEvidenceRecords(staff);
  const assignedAssets = staffAssignedAssets(staff);
  const assignedVehicle = staffAssignedVehicle(staff);
  const openActions = staffOpenActions(staff);
  const auditEvents = staffAuditEvents(staff);
  document.querySelectorAll(".staff-profile-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.staffTab === activeStaffTab);
  });

  shell.innerHTML = `
    <div class="staff-selected-header">
      <div>
        <span class="profile-kicker">${escapeHtml(staff.role || "Staff member")}</span>
        <h3>${escapeHtml(staff.name)} ${testRecordBadge(staff)}</h3>
        <p>${escapeHtml(staff.phone || "No mobile")} | ${escapeHtml(staff.email || "No email")}</p>
      </div>
      <span class="status ${staffStatusClass(attendance.status)}">${escapeHtml(attendance.status)}</span>
    </div>
    <div class="staff-selected-actions">
      <button class="secondary-button" type="button" data-edit-record="staff" data-record-index="${index}">Edit Profile</button>
      <button class="secondary-button" type="button" data-staff-detail-attendance="${escapeHtml(staff.name)}">Log Sick / Late / Absent</button>
      <button class="secondary-button" type="button" data-staff-detail-holiday="${escapeHtml(staff.name)}">Add Holiday</button>
      <button class="secondary-button" type="button" data-open-staff-holiday-planner="${escapeHtml(staff.name)}">Open in Holiday Planner</button>
    </div>
  `;

  const holidayRows = staffHolidayRequestsFor(staff)
    .sort((a, b) => String(b.from || "").localeCompare(String(a.from || "")))
    .map((request) => staffCompactRow(
      `${formatDateUk(request.from)} to ${formatDateUk(request.to)}`,
      `${request.days || holidayCalculatedDays(request) || workingDateRangeValues(request.from, request.to).length || 0} day(s)${request.dayType === "Half day" ? ` | ${request.dayPart || "AM"} half day` : ""}${request.notes ? ` | ${request.notes}` : ""}`,
      request.status || "Pending"
    ))
    .join("");
  const attendanceRows = staffAttendanceRecords(staff, currentYear, true)
    .map(staffAttendanceRecordRow)
    .join("");
  const trainingRows = staffTrainingRecords(staff)
    .map((record) => {
      const status = trainingStatus(record);
      const expiryLabel = record.noExpiry || status.label === "No Expiry" ? "No expiry" : record.expiryDate ? formatDateUk(record.expiryDate) : "not set";
      const documentLabel = record.documentFileName || record.certificate ? ` | ${record.documentFileName || record.certificate}` : "";
      return staffCompactRow(record.course, `${record.provider || "Provider not set"} | Expires ${expiryLabel}${documentLabel}`, status.label);
    })
    .join("");
  const incidents = incidentHistoryForStaff(staff);
  const recentActivity = [
    ...staffAttendanceHistory(staff.name, 3).map((record) => `${formatDateUk(record.date)}: ${record.status}`),
    ...staffHolidayRequestsFor(staff).slice(-2).map((request) => `${request.status}: holiday ${formatDateUk(request.from)}`)
  ].slice(0, 5);

  const tabs = {
    overview: `
      <div class="staff-profile-cards">
        ${staffProfileMetric("Mobile", staff.phone || "Not set")}
        ${staffProfileMetric("Email", staff.email || "Not set")}
        ${staffProfileMetric("Assigned van", staff.assignedVan || "Not set")}
        ${staffProfileMetric("Emergency contact", staff.emergencyContact || "Not set")}
        ${staffProfileMetric("Holiday remaining", leaveSummary.holidayRemaining)}
        ${staffProfileMetric("Sick days this year", leaveSummary.sickDays)}
        ${staffProfileMetric("Training alerts", trainingAlerts)}
        ${staffProfileMetric("Open actions", openActions.length)}
        ${staffProfileMetric("Next booked holiday", nextHoliday ? `${formatDateUk(nextHoliday.from)} to ${formatDateUk(nextHoliday.to)}` : "None booked")}
      </div>
      <section class="staff-tab-section">
        <h4>Recent activity</h4>
        ${recentActivity.length ? recentActivity.map((item) => staffCompactRow(item, "")).join("") : '<p class="empty-state">No recent activity.</p>'}
      </section>
      <section class="staff-tab-section">
        <h4>Current responsibility</h4>
        ${assignedVehicle ? staffCompactRow(assignedVehicle.registration || assignedVehicle.vehicle || "Assigned vehicle", [assignedVehicle.make, assignedVehicle.model].filter(Boolean).join(" ") || assignedVehicle.vehicle || "Vehicle record", assignedVehicle.status || "Assigned") : '<p class="empty-state">No assigned vehicle recorded.</p>'}
        ${assignedAssets.length ? assignedAssets.slice(0, 5).map((asset) => staffCompactRow(asset.asset || asset.assetId || "Asset", [asset.category, asset.condition].filter(Boolean).join(" | "), asset.status)).join("") : '<p class="empty-state">No assigned assets recorded.</p>'}
      </section>
      <section class="staff-tab-section">
        <h4>Open actions</h4>
        ${openActions.length ? openActions.slice(0, 5).map((item) => staffCompactRow(item.title || item.type || "Action", item.description || item.relatedEntityType || "", item.status || "New")).join("") : '<p class="empty-state">No open staff actions.</p>'}
      </section>
    `,
    holidays: `
      <div class="staff-profile-cards">
        ${staffProfileMetric("Holiday entitlement", leaveSummary.holidayAllowance)}
        ${staffProfileMetric("Holidays used", leaveSummary.holidayTaken)}
        ${staffProfileMetric("Holidays remaining", leaveSummary.holidayRemaining)}
        ${staffProfileMetric("Company and bank holidays", leaveSummary.companyBankDeductions)}
      </div>
      <div class="staff-tab-actions">
        <button class="primary-button" type="button" data-staff-detail-holiday="${escapeHtml(staff.name)}">Add holiday</button>
        <button class="secondary-button" type="button" data-manage="companyHolidays">Add company holiday</button>
      </div>
      <section class="staff-tab-section">
        <h4>Request history</h4>
        ${holidayRows || '<p class="empty-state">No holiday requests or approved holidays yet.</p>'}
      </section>
    `,
    attendance: `
      <div class="staff-profile-cards">
        ${staffProfileMetric("Sick days", formatLeaveNumber(attendanceSummary.sickDays))}
        ${staffProfileMetric("Sickness occurrences", attendanceSummary.sicknessOccurrences)}
        ${staffProfileMetric("Late occurrences", attendanceSummary.lateOccurrences)}
        ${staffProfileMetric("Absent days", formatLeaveNumber(attendanceSummary.absentDays))}
        ${staffProfileMetric("Authorised absence", formatLeaveNumber(attendanceSummary.otherAuthorisedAbsenceDays))}
        ${staffProfileMetric("Unauthorised absence", formatLeaveNumber(attendanceSummary.unauthorisedAbsenceDays))}
      </div>
      <div class="staff-tab-actions">
        <button class="primary-button" type="button" data-staff-detail-attendance="${escapeHtml(staff.name)}">Log sick / late / absent</button>
        <button class="secondary-button" type="button" data-sick-call="${escapeHtml(staff.name)}">Sick call-in</button>
      </div>
      <section class="staff-tab-section">
        <h4>Attendance records</h4>
        ${attendanceRows || '<p class="empty-state">No attendance records for this year.</p>'}
      </section>
    `,
    training: `
      <div class="staff-tab-actions">
        <button class="primary-button" type="button" data-manage="training">Add training record</button>
      </div>
      <section class="staff-tab-section">
        <h4>Training and qualifications</h4>
        <div class="staff-detail-lines">
          <p><strong>Qualifications:</strong> ${escapeHtml(staff.qualifications || "Not set")}</p>
          <p><strong>Training records:</strong> ${escapeHtml(staff.trainingRecords || "Not set")}</p>
        </div>
        ${trainingRows || '<p class="empty-state">No matrix training records yet.</p>'}
      </section>
      <section class="staff-tab-section">
        <h4>Toolbox Talk and policy evidence</h4>
        ${toolboxAssignments.length ? toolboxAssignments.slice(0, 6).map((assignment) => staffCompactRow(assignment.title || assignment.documentTitle || assignment.contentTitle || "Assigned communication", assignment.completedAt || assignment.acknowledgedAt ? `Completed ${formatDateUk(String(assignment.completedAt || assignment.acknowledgedAt).slice(0, 10))}` : `Due ${assignment.dueDate ? formatDateUk(assignment.dueDate) : "not set"}`, assignment.status || "Outstanding")).join("") : '<p class="empty-state">No Toolbox Talk or policy assignments recorded.</p>'}
      </section>
    `,
    documents: `
      <section class="staff-tab-section">
        <h4>Staff documents</h4>
        ${staffTrainingRecords(staff).filter((record) => record.documentFileName || record.certificate).map((record) => staffCompactRow(record.documentFileName || record.certificate, record.course || "Training certificate", trainingStatus(record).label)).join("") || '<p class="empty-state">No staff document metadata has been linked yet.</p>'}
      </section>
      <section class="staff-tab-section">
        <h4>Evidence history</h4>
        ${evidenceRecords.length ? evidenceRecords.slice(0, 8).map((record) => staffCompactRow(record.evidenceType || record.type || "Evidence", record.title || record.documentTitle || record.recordId || "", record.status || "Recorded")).join("") : '<p class="empty-state">No acknowledgement or compliance evidence recorded.</p>'}
      </section>
    `,
    notes: `
      <section class="staff-tab-section">
        <h4>Internal notes</h4>
        <div class="staff-detail-lines">
          <p>${escapeHtml(staff.notes || "No internal notes.")}</p>
        </div>
      </section>
      <section class="staff-tab-section">
        <h4>Incident log</h4>
        ${incidents.length ? incidents.map((incident) => staffCompactRow(incident, "")).join("") : '<p class="empty-state">No internal accident or incident records logged.</p>'}
      </section>
      <section class="staff-tab-section">
        <h4>Audit history</h4>
        ${auditEvents.length ? auditEvents.map((event) => staffCompactRow(event.action || "Audit event", `${event.performedAt || event.dateTime || ""} | ${event.performedByUserId || event.user || "Unknown"}`, event.entityType || event.module || "Audit")).join("") : '<p class="empty-state">No staff audit events recorded.</p>'}
      </section>
    `
  };

  body.innerHTML = tabs[activeStaffTab] || tabs.overview;
}

function staffProfileMetric(label, value) {
  return `
    <article class="staff-profile-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value ?? "Not set"))}</strong>
    </article>
  `;
}

function renderStaff() {
  updateStaffOneDriveStatus();
  const todayAttendance = staffProfiles.map((staff) => attendanceFor(staff.name, today));
  const currentYear = String(new Date().getFullYear());
  const trainingAlerts = trainingMatrix.filter((record) => trainingStatus(record).className !== "ok").length;

  document.querySelector("#staffPresentCount").textContent = todayAttendance.filter((record) => record.status === "Present" || record.status === "Late").length;
  document.querySelector("#staffUnavailableTodayCount").textContent = todayAttendance.filter((record) => isUnavailableStatus(record.status)).length;
  document.querySelector("#holidayRequestCount").textContent = holidayRequests.filter((request) => request.status === "Pending").length;
  document.querySelector("#trainingDayCount").textContent = trainingAlerts;

  const visibleStaff = filteredStaff();
  if (!staffProfiles[selectedStaffIndex] && staffProfiles.length) selectedStaffIndex = 0;
  if (visibleStaff.length && !visibleStaff.includes(staffProfiles[selectedStaffIndex])) {
    selectedStaffIndex = staffProfiles.indexOf(visibleStaff[0]);
  }

  document.querySelector("#staffGrid").innerHTML = visibleStaff.map((staff) => {
    const attendance = attendanceFor(staff.name, today);
    const leaveSummary = staffLeaveSummary(staff, currentYear);
    const index = staffProfiles.indexOf(staff);
    const statusDot = isUnavailableStatus(attendance.status) ? "unavailable" : "available";
    return `
      <button class="staff-directory-item ${index === selectedStaffIndex ? "selected" : ""}" type="button" data-select-staff="${index}">
        <span class="staff-status-dot ${statusDot}"></span>
        <span>
          <strong>${escapeHtml(staff.name)}</strong>
          <em>${escapeHtml(staff.role || "Staff member")} ${testRecordBadge(staff)}</em>
        </span>
        <small>${escapeHtml(attendance.status)}</small>
        <b>${leaveSummary.holidayRemaining} days</b>
      </button>
    `;
  }).join("") || `
    <article class="staff-empty-card">
      <strong>No staff found</strong>
      <p>Clear the search or add a staff member.</p>
      <button class="primary-button" type="button" data-manage="staff">Add Staff Member</button>
    </article>
  `;

  const staffHolidayRequestsList = document.querySelector("#staffHolidayRequestsList");
  if (staffHolidayRequestsList) {
    const pendingRequests = holidayRequests
      .filter((request) => request.status === "Pending")
      .sort((a, b) => String(a.from || "").localeCompare(String(b.from || "")));
    staffHolidayRequestsList.innerHTML = pendingRequests.length
      ? pendingRequests.map((request) => holidayRequestRow(request, holidayRequests.indexOf(request))).join("")
      : '<p class="empty-state compact-empty">No pending holiday requests.</p>';
  }

  renderStaffActivityNotifications();
  renderSelectedStaffProfile(staffProfiles[selectedStaffIndex], selectedStaffIndex, currentYear);
}

function renderTrainingMatrix() {
  setTrainingYearFilterOptions();
  ensureTrainingFilters();
  const records = filteredTrainingRecords();
  const allRecords = trainingMatrix
    .map((record, index) => ({ ...record, index, status: trainingStatus(record) }))
    .filter((record) => trainingRecordActiveInYear(record, activeTrainingYear));
  document.querySelector("#trainingCurrentCount").textContent = allRecords.filter((record) => record.status.label === "Current" || record.status.label === "No Expiry").length;
  document.querySelector("#trainingExpiringCount").textContent = allRecords.filter((record) => record.status.label === "Expiring Soon").length;
  document.querySelector("#trainingExpiredCount").textContent = allRecords.filter((record) => record.status.className === "urgent").length;
  document.querySelector("#trainingEmployeeCount").textContent = new Set(allRecords.map((record) => record.employee).filter(Boolean)).size;

  document.querySelector("#trainingTableBody").innerHTML = records
    .sort((a, b) => a.employee.localeCompare(b.employee) || a.status.days - b.status.days)
    .map((record) => {
      const certificateName = record.documentFileName || record.certificate || "";
      return `
        <tr>
          <td><strong>${escapeHtml(record.employee)}</strong></td>
          <td>${escapeHtml(record.course)}</td>
          <td>${escapeHtml(record.provider)}</td>
          <td>${escapeHtml(record.completedDate || "-")}</td>
          <td>${escapeHtml(record.noExpiry ? "No expiry" : record.expiryDate || "-")}</td>
          <td><span class="status ${record.status.className}">${escapeHtml(record.status.label)}</span></td>
          <td>${certificateName ? `<button class="link-button" type="button" data-open-training-certificate="${record.index}">${escapeHtml(certificateName)}</button>` : '<span class="table-subtext">No certificate</span>'}</td>
          <td>
            <div class="record-actions">
              <button class="secondary-button" type="button" data-view-training="${record.index}">View</button>
              <button class="secondary-button" type="button" data-edit-record="training" data-record-index="${record.index}">Edit</button>
              <button class="secondary-button" type="button" data-replace-training-certificate="${record.index}">Replace certificate</button>
              <button class="secondary-button" type="button" data-training-lifecycle="Superseded" data-training-index="${record.index}">Supersede</button>
              <button class="secondary-button" type="button" data-training-lifecycle="Inactive" data-training-index="${record.index}">Mark inactive</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("") || '<tr><td class="empty-state" colspan="8">No training records found.</td></tr>';
}

function ensureTrainingFilters() {
  const employeeFilter = document.querySelector("#trainingEmployeeFilter");
  const courseFilter = document.querySelector("#trainingCourseFilter");
  if (employeeFilter) {
    const current = employeeFilter.value || "all";
    const names = [...new Set(trainingMatrix.map((record) => record.employee).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    employeeFilter.innerHTML = '<option value="all">All employees</option>' + names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    employeeFilter.value = names.includes(current) ? current : "all";
  }
  if (courseFilter) {
    const current = courseFilter.value || "all";
    const courses = [...new Set(trainingMatrix.map((record) => record.course).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    courseFilter.innerHTML = '<option value="all">All training</option>' + courses.map((course) => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`).join("");
    courseFilter.value = courses.includes(current) ? current : "all";
  }
}

function selectedTrainingYearRecords() {
  return trainingMatrix
    .map((record, index) => ({ ...record, index, status: trainingStatus(record) }))
    .filter((record) => trainingRecordActiveInYear(record, activeTrainingYear));
}

async function exportTrainingMatrix(format) {
  const year = activeTrainingYear || String(new Date().getFullYear());
  const records = selectedTrainingYearRecords();
  if (!records.length) {
    await kcInfo(`No training records found for ${year}.`);
    return;
  }
  updateOneDriveHeaderStatus("Saving to OneDrive", `Exporting Training Matrix ${year}`);
  try {
    const response = await fetch("/api/export-training-matrix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year,
        format,
        generatedBy: currentUserName(),
        records: records.map((record) => ({
          employee: record.employee || "",
          course: record.course || "",
          provider: record.provider || "",
          certificateNumber: record.certificateNumber || "",
          completedDate: record.completedDate || "",
          expiryDate: record.noExpiry ? "No Expiry" : record.expiryDate || "",
          status: record.status.label,
          notes: record.notes || "",
          documentFileName: record.documentFileName || record.certificate || "",
          oneDriveLocation: record.oneDriveLocation || ""
        }))
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.saved) throw new Error(result.message || "The export was not confirmed by OneDrive.");
    updateOneDriveHeaderStatus("OneDrive save complete", formatOneDriveSaveTime(new Date().toISOString()));
    await kcInfo(`${format === "xlsx" ? "Excel" : "CSV"} export saved to OneDrive:\n${result.fileName}`);
  } catch (error) {
    keepPendingOneDriveBackup(commandData(), "Training Matrix export failed");
    await kcInfo(`Training Matrix export has not been safely saved to OneDrive yet. ${error.message || "Please start Kingswood Hub with the launcher and try again."}`);
  }
}

function filteredTrainingRecords() {
  const term = (document.querySelector("#trainingSearch")?.value || "").trim().toLowerCase();
  const employee = document.querySelector("#trainingEmployeeFilter")?.value || "all";
  const course = document.querySelector("#trainingCourseFilter")?.value || "all";
  const statusFilter = activeTrainingFilter !== "all" ? activeTrainingFilter : (document.querySelector("#trainingStatusFilter")?.value || "all");
  const expiryFilter = document.querySelector("#trainingExpiryFilter")?.value || "all";
  return trainingMatrix.map((record, index) => ({ ...record, index, status: trainingStatus(record) })).filter((record) => {
    const searchable = `${record.employee} ${record.course} ${record.provider} ${record.certificateNumber} ${record.documentFileName} ${record.notes}`.toLowerCase();
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "current" && record.status.label === "Current")
      || (statusFilter === "expiring" && record.status.label === "Expiring Soon")
      || (statusFilter === "expired" && record.status.className === "urgent")
      || (statusFilter === "missing" && record.status.label === "Missing / Not Recorded")
      || (statusFilter === "not-applicable" && record.status.label === "Not Applicable")
      || (statusFilter === "superseded" && record.status.label === "Superseded")
      || (statusFilter === "inactive" && record.status.label === "Inactive")
      || (statusFilter === "no-expiry" && record.status.label === "No Expiry");
    const matchesExpiry = expiryFilter === "all" || (!record.noExpiry && record.status.days >= 0 && record.status.days <= Number(expiryFilter));
    return (!term || searchable.includes(term))
      && trainingRecordActiveInYear(record, activeTrainingYear)
      && (employee === "all" || record.employee === employee)
      && (course === "all" || record.course === course)
      && matchesStatus
      && matchesExpiry;
  });
}

function filteredAssets() {
  const term = (document.querySelector("#assetSearch")?.value || "").trim().toLowerCase();
  const category = document.querySelector("#assetCategoryFilter")?.value || "all";
  const status = document.querySelector("#assetStatusFilter")?.value || "all";
  const employee = document.querySelector("#assetEmployeeFilter")?.value || "all";
  const vehicle = document.querySelector("#assetVehicleFilter")?.value || "all";
  const due = activeAssetFilter !== "all" ? activeAssetFilter : (document.querySelector("#assetDueFilter")?.value || "all");
  return assets.map((asset, index) => ({ ...asAssetObject(asset), index })).filter((item) => {
    const searchable = `${item.asset} ${item.assetId} ${item.category} ${item.make} ${item.model} ${item.serialNumber} ${assetHolderLabel(item)} ${assetVehicleOrLocationLabel(item)}`.toLowerCase();
    const matchesSearch = !term || searchable.includes(term);
    const matchesCategory = category === "all" || item.category === category;
    const matchesStatus = status === "all" || item.status === status;
    const matchesEmployee = employee === "all" || item.assignedStaffId === employee;
    const matchesVehicle = vehicle === "all" || item.vehicleId === vehicle;
    const matchesDue = due === "all"
      || (due === "in-use" && item.status === "In use")
      || (due === "inspection" && assetNeedsInspection(item))
      || (due === "service" && assetNeedsService(item))
      || (due === "pat" && assetPatOverdue(item))
      || (due === "repair" && item.status === "Needs repair");
    return matchesSearch && matchesCategory && matchesStatus && matchesEmployee && matchesVehicle && matchesDue;
  });
}

function refreshAssetFilters() {
  const categoryFilter = document.querySelector("#assetCategoryFilter");
  const statusFilter = document.querySelector("#assetStatusFilter");
  const employeeFilter = document.querySelector("#assetEmployeeFilter");
  const vehicleFilter = document.querySelector("#assetVehicleFilter");
  if (categoryFilter && categoryFilter.options.length <= 1) {
    categoryFilter.innerHTML = '<option value="all">All categories</option>' + assetCategories.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  }
  if (statusFilter && statusFilter.options.length <= 1) {
    statusFilter.innerHTML = '<option value="all">All statuses</option>' + assetStatuses.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  }
  if (employeeFilter) {
    const current = employeeFilter.value;
    employeeFilter.innerHTML = '<option value="all">All employees</option>' + staffProfiles.map((staff) => `<option value="${escapeHtml(staff.staffId || staff.name)}">${escapeHtml(staff.name)}</option>`).join("");
    employeeFilter.value = [...employeeFilter.options].some((option) => option.value === current) ? current : "all";
  }
  if (vehicleFilter) {
    const current = vehicleFilter.value;
    vehicleFilter.innerHTML = '<option value="all">All vehicles</option>' + vehicles.map(asVehicleObject).map((vehicle) => `<option value="${escapeHtml(vehicle.vehicleId || vehicle.registration)}">${escapeHtml(vehicle.registration || vehicle.vehicle)}</option>`).join("");
    vehicleFilter.value = [...vehicleFilter.options].some((option) => option.value === current) ? current : "all";
  }
}

function assetStatusBadgeClass(item) {
  if (item.status === "Needs repair" || item.status === "Out of service" || item.status === "Lost") return "urgent";
  if (item.status === "Needs inspection" || item.condition === "Poor" || item.condition === "Damaged") return "warning";
  return "ok";
}

function renderAssets() {
  refreshAssetFilters();
  const records = filteredAssets();
  const allAssets = assets.map(asAssetObject);
  document.querySelector("#assetTotalCount").textContent = allAssets.length;
  document.querySelector("#assetInUseCount").textContent = allAssets.filter((item) => item.status === "In use").length;
  document.querySelector("#assetInspectionDueCount").textContent = allAssets.filter(assetNeedsInspection).length;
  document.querySelector("#assetServiceDueCount").textContent = allAssets.filter(assetNeedsService).length;
  document.querySelector("#assetRepairCount").textContent = allAssets.filter((item) => item.status === "Needs repair").length;
  document.querySelector("#assetsTableBody").innerHTML = records.map((item) => {
    const inspection = assetDueState(item.nextInspectionDue);
    return `
    <tr>
      <td><strong>${escapeHtml(item.asset)}</strong><div class="table-subtext">${escapeHtml(item.make || "")} ${escapeHtml(item.model || "")}</div></td>
      <td>${escapeHtml(item.assetId)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(assetHolderLabel(item))}</td>
      <td>${escapeHtml(assetVehicleOrLocationLabel(item))}</td>
      <td><span class="status ${item.condition === "Damaged" || item.condition === "Poor" ? "warning" : "ok"}">${escapeHtml(item.condition)}</span></td>
      <td><span class="status ${assetStatusBadgeClass(item)}">${escapeHtml(item.status)}</span></td>
      <td>${item.inspectionRequired === "Yes" ? `${formatDateUk(item.nextInspectionDue)}<br><span class="status ${inspection.className}">${inspection.label}</span>` : '<span class="table-subtext">Not required</span>'}</td>
      <td><div class="record-actions">${assetRecordButtons(item.index)}</div></td>
    </tr>
  `;
  }).join("") || '<tr><td class="empty-state" colspan="9">No assets found.</td></tr>';
}

function assetRecordButtons(index) {
  return `
    <button class="secondary-button" type="button" data-view-asset="${index}">View</button>
    <button class="secondary-button" type="button" data-edit-record="assets" data-record-index="${index}">Edit Asset</button>
    <button class="secondary-button" type="button" data-asset-action="reassign" data-asset-index="${index}">Reassign</button>
    <button class="secondary-button" type="button" data-asset-action="inspection" data-asset-index="${index}">Add Inspection</button>
    <button class="secondary-button" type="button" data-asset-action="service" data-asset-index="${index}">Add Service</button>
    <button class="secondary-button" type="button" data-asset-action="repair" data-asset-index="${index}">Add Repair</button>
    <button class="danger-button" type="button" data-asset-action="lost" data-asset-index="${index}">Mark Lost</button>
    <button class="danger-button" type="button" data-asset-action="disposed" data-asset-index="${index}">Mark Disposed</button>
  `;
}

async function showAssetProfile(index) {
  const item = asAssetObject(assets[Number(index)]);
  const inspection = assetDueState(item.nextInspectionDue);
  const service = assetDueState(item.nextServiceDue);
  const pat = assetDueState(item.nextPatDue);
  const docs = item.documents?.length ? item.documents.map((document) => `- ${document.name || "Document"}`).join("\n") : "No photos or documents linked yet.";
  const history = item.history?.length ? item.history.slice(-8).map((entry) => `- ${formatDateUk(String(entry.at || "").slice(0, 10))}: ${entry.action} by ${entry.by || "Unknown"}`).join("\n") : "No history yet.";
  await kcInfo([
    `${item.asset} (${item.assetId})`,
    "",
    `Category: ${item.category}`,
    `Make/model: ${[item.make, item.model].filter(Boolean).join(" ") || "Not set"}`,
    `Serial number: ${item.serialNumber || "Not set"}`,
    `Current holder: ${assetHolderLabel(item)}`,
    `Vehicle/location: ${assetVehicleOrLocationLabel(item)}`,
    `Condition: ${item.condition}`,
    `Status: ${item.status}`,
    `Purchase: ${item.purchaseDate ? formatDateUk(item.purchaseDate) : "Not set"} | GBP ${Number(item.purchaseCost || 0).toFixed(2)}`,
    `Inspection: ${item.inspectionRequired === "Yes" ? `${inspection.label} - ${formatDateUk(item.nextInspectionDue)}` : "Not required"}`,
    `Service: ${item.serviceRequired === "Yes" ? `${service.label} - ${formatDateUk(item.nextServiceDue)}` : "Not required"}`,
    `PAT: ${item.powerSource === "Mains powered" && item.patTestingRequired === "Yes" ? `${pat.label} - ${formatDateUk(item.nextPatDue)}` : "Not applicable"}`,
    "",
    "Documents:",
    docs,
    "",
    "Recent history:",
    history
  ].join("\n"));
}

async function handleAssetAction(action, index) {
  const numericIndex = Number(index);
  const item = asAssetObject(assets[numericIndex]);
  if (!item) return;
  const actionLabels = {
    reassign: "Reassign Asset",
    inspection: "Inspection added",
    service: "Service added",
    repair: "Repair added",
    lost: "Marked lost",
    disposed: "Marked disposed"
  };
  if (action === "reassign") {
    openDataDialog("assets", index);
    return;
  }
  if (["lost", "disposed"].includes(action)) {
    const confirmed = await kcConfirmAction(`Mark ${item.asset} as ${action === "lost" ? "lost" : "disposed"}? This will be kept in the asset history.`, action === "lost" ? "Mark Lost" : "Mark Disposed");
    if (!confirmed) return;
    item.status = action === "lost" ? "Lost" : "Disposed";
  }
  if (action === "inspection") {
    item.lastInspectionDate = today;
    item.nextInspectionDue = item.nextInspectionDue || "";
    item.status = item.status === "Needs inspection" ? "In use" : item.status;
  }
  if (action === "service") {
    item.lastServiceDate = today;
    item.nextServiceDue = item.nextServiceDue || "";
  }
  if (action === "repair") {
    item.status = "Needs repair";
  }
  item.history = Array.isArray(item.history) ? item.history : [];
  item.history.push({
    action: actionLabels[action] || "Asset updated",
    by: currentUserName(),
    at: new Date().toISOString(),
    status: item.status
  });
  item.updatedAt = new Date().toISOString();
  assets[numericIndex] = item;
  const saved = await saveCommandData();
  if (!saved) return;
  render();
  await kcInfo(`${actionLabels[action] || "Asset updated"} for ${item.asset}.`);
}

async function exportAssets(format = "csv") {
  const records = filteredAssets();
  if (!records.length) {
    await kcInfo("No assets found for the current filters.");
    return;
  }
  updateOneDriveHeaderStatus("Saving to OneDrive", `Exporting Asset Register ${format.toUpperCase()}`);
  try {
    const response = await fetch("/api/export-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format,
        generatedBy: currentUserName(),
        records: records.map((item) => ({
          asset: item.asset,
          assetId: item.assetId,
          category: item.category,
          assignedTo: assetHolderLabel(item),
          vehicleOrLocation: assetVehicleOrLocationLabel(item),
          condition: item.condition,
          status: item.status,
          nextInspectionDue: item.nextInspectionDue,
          nextServiceDue: item.nextServiceDue,
          nextPatDue: item.powerSource === "Mains powered" && item.patTestingRequired === "Yes" ? item.nextPatDue : "",
          serialNumber: item.serialNumber,
          purchaseDate: item.purchaseDate,
          purchaseCost: item.purchaseCost
        }))
      })
    });
    const result = await response.json();
    if (!response.ok || !result.saved) throw new Error(result.message || "The export was not confirmed by OneDrive.");
    updateOneDriveHeaderStatus("OneDrive save complete", formatOneDriveSaveTime(new Date().toISOString()));
    await kcInfo(`${format === "xlsx" ? "Excel" : "CSV"} asset register export saved to OneDrive:\n${result.fileName}`);
  } catch (error) {
    keepPendingOneDriveBackup(commandData(), "Asset export failed");
    updateOneDriveHeaderStatus("Local backup pending", "Asset export not saved");
    await kcInfo(`The asset export has not been safely saved to OneDrive yet. ${error.message || "Please start Kingswood Hub with the launcher and try again."}`);
  }
}

async function showTrainingRecord(index) {
  const record = trainingMatrix[Number(index)];
  if (!record) return;
  const status = trainingStatus(record);
  await kcInfo([
    `${record.employee || "Employee"} - ${record.course || "Training record"}`,
    `Provider: ${record.provider || "Not set"}`,
    `Certificate/licence: ${record.certificateNumber || "Not set"}`,
    `Completed: ${record.completedDate ? formatDateUk(record.completedDate) : "Not set"}`,
    `Expires: ${record.noExpiry ? "No expiry" : record.expiryDate ? formatDateUk(record.expiryDate) : "Not set"}`,
    `Status: ${status.label}`,
    `Document: ${record.documentFileName || record.certificate || "No document linked"}`,
    record.notes ? `Notes: ${record.notes}` : ""
  ].filter(Boolean).join("\n"));
}

async function openTrainingCertificate(index) {
  const record = trainingMatrix[Number(index)];
  if (!record) return;
  const location = record.oneDriveLocation || "";
  if (!location) {
    await kcInfo("No OneDrive certificate location has been saved for this training record yet.");
    return;
  }
  if (/^https?:\/\//i.test(location)) {
    window.open(location, "_blank", "noopener");
    return;
  }
  activeCertificateRecord = record;
  const fileName = record.documentFileName || record.certificate || "Training certificate";
  const fileUrl = localFileUrl(location);
  const isImage = /\.(png|jpe?g)$/i.test(fileName);
  const isPdf = /\.pdf$/i.test(fileName);
  if (isPdf) {
    window.open(fileUrl, "_blank", "noopener");
  }
  if (certificateViewerTitle) certificateViewerTitle.textContent = fileName;
  if (certificateViewerPreview) {
    certificateViewerPreview.innerHTML = isImage
      ? `<img src="${fileUrl}" alt="${escapeHtml(fileName)}">`
      : `<div class="certificate-file-card"><strong>${escapeHtml(fileName)}</strong><p>${isPdf ? "PDF opened in a new tab." : "Certificate file ready to open."}</p></div>`;
  }
  certificateViewerDialog?.showModal();
}

async function updateTrainingLifecycle(index, lifecycleStatus) {
  const record = trainingMatrix[Number(index)];
  if (!record) return;
  const confirmed = await kcConfirmAction(
    `Mark "${record.course || "this training record"}" for ${record.employee || "this employee"} as ${lifecycleStatus}? The record will remain in history.`,
    `Mark ${lifecycleStatus}`
  );
  if (!confirmed) return;
  const previous = { ...record };
  record.lifecycleStatus = lifecycleStatus;
  record.status = lifecycleStatus;
  record.updatedAt = new Date().toISOString();
  record.history = Array.isArray(record.history) ? record.history : [];
  record.history.push({
    action: `Marked ${lifecycleStatus}`,
    by: currentUserName(),
    at: record.updatedAt
  });
  universalAuditEvents.unshift({
    auditEventId: `AUD-STAFF-COMPLIANCE-${stablePhase9Hash([record.trainingRecordId || record.id, lifecycleStatus, record.updatedAt])}`,
    entityType: "TrainingRecord",
    entityId: record.trainingRecordId || record.id || "",
    action: `Training Record Marked ${lifecycleStatus}`,
    performedByUserId: currentUserName(),
    performedByRole: currentUserName() === "Kevin" || currentUserName() === "Alex" ? "Director" : "Office",
    performedAt: record.updatedAt,
    sourceApp: "Kingswood Hub",
    oldValue: previous,
    newValue: { ...record }
  });
  const saved = await saveCommandData();
  if (!saved) return;
  render();
  await kcInfo("Training record lifecycle updated. The original record remains in history.");
}

function localFileUrl(filePath) {
  return `/api/local-file?path=${encodeURIComponent(filePath)}`;
}

function localFolderUrl(filePath) {
  const normalised = String(filePath || "").replace(/\\/g, "/");
  const folder = normalised.includes("/") ? normalised.slice(0, normalised.lastIndexOf("/")) : normalised;
  return `file:///${folder.replace(/ /g, "%20")}`;
}

function filteredCompanyDocuments() {
  const category = document.querySelector("#documentsCategoryFilter")?.value || "all";
  const status = document.querySelector("#documentsStatusFilter")?.value || "all";
  const term = (document.querySelector("#documentsSearch")?.value || "").trim().toLowerCase();
  return companyDocuments.map((raw, index) => ({ item: asCompanyDocument(raw), index })).filter(({ item }) => {
    const documentStatus = companyDocumentStatus(item);
    const searchable = `${item.title} ${item.category} ${item.oneDriveLink} ${item.owner}`.toLowerCase();
    return (category === "all" || item.category === category)
      && (status === "all" || documentStatus.value === status)
      && (!term || searchable.includes(term));
  });
}

function renderCompanyDocuments() {
  const body = document.querySelector("#documentsTableBody");
  if (!body) return;
  const summary = companyDocumentReminderSummary();
  const summaryGrid = document.querySelector("#documentsSummaryGrid");
  if (summaryGrid) {
    summaryGrid.innerHTML = `
      <article class="summary-tile success">
        <span class="summary-label">Tracker Records</span>
        <strong>${summary.total}</strong>
      </article>
      <article class="summary-tile warning">
        <span class="summary-label">Critical Expiring</span>
        <strong>${summary.criticalExpiring}</strong>
        <p>90 / 60 / 30 / 7 day watch</p>
      </article>
      <article class="summary-tile warning">
        <span class="summary-label">Standard Expiring</span>
        <strong>${summary.standardExpiring}</strong>
        <p>30 day watch</p>
      </article>
      <article class="summary-tile danger">
        <span class="summary-label">Expired</span>
        <strong>${summary.expired}</strong>
        <p>Critical expiry nags Kev and Alex until resolved</p>
      </article>
    `;
  }

  const rows = filteredCompanyDocuments();
  body.innerHTML = rows.map(({ item, index }) => {
    const status = companyDocumentStatus(item);
    const expiryText = item.expiryDate
      ? `${formatDateUk(item.expiryDate)}${Number.isFinite(status.days) ? ` (${status.days} days)` : ""}`
      : "No expiry";
    const oneDriveLink = /^https?:\/\//i.test(item.oneDriveLink)
      ? `<a href="${escapeHtml(item.oneDriveLink)}" target="_blank" rel="noopener">Open</a>`
      : escapeHtml(item.oneDriveLink || "Not set");
    return `
      <tr>
        <td><strong>${escapeHtml(item.title)}</strong><br><span class="table-subtext">${escapeHtml(isCriticalCompanyDocument(item) ? "Critical tier" : "Standard tier")}</span></td>
        <td>${escapeHtml(item.category)}</td>
        <td>${item.issueDate ? escapeHtml(formatDateUk(item.issueDate)) : "-"}</td>
        <td>${escapeHtml(expiryText)}</td>
        <td><span class="status ${status.className}">${escapeHtml(status.label)}</span></td>
        <td>${oneDriveLink}</td>
        <td>${escapeHtml(item.owner || "Kevin")}<br><span class="table-subtext">Updated by ${escapeHtml(item.lastUpdatedBy || item.owner || "Kevin")}</span></td>
        <td><div class="record-actions">${recordButtons("documents", index)}</div></td>
      </tr>
    `;
  }).join("") || '<tr><td class="empty-state" colspan="8">No company document tracker records found.</td></tr>';
}

function renderCards(target, items) {
  const collection = target === "#documentsGrid" ? "documents" : target === "#clientsGrid" ? "clients" : "";
  document.querySelector(target).innerHTML = items.map((rawItem, index) => {
    const item = target === "#settingsGrid" ? rawItem : asCardObject(rawItem);
    const settingsMeta = target === "#settingsGrid" ? settingsCardMeta[index] : null;
    const iconName = settingsMeta?.[0] || (target === "#documentsGrid" ? "folder" : target === "#clientsGrid" ? "building" : "dashboard");
    const badgeText = settingsMeta?.[1]?.() || (collection === "clients" ? "Client record" : collection === "documents" ? "Document record" : "Ready");
    const settingsAction = target === "#settingsGrid" ? ` role="button" tabindex="0" data-settings-action="${item.id}"` : "";
    return `
    <article class="module-card"${settingsAction}>
      <div class="card-topline">
        ${iconShell(iconName)}
        <span class="card-badge">${escapeHtml(badgeText)}</span>
      </div>
      <div class="card-copy">
        <strong class="card-title">${escapeHtml(item.title)}</strong>
        <p class="card-subtitle">${escapeHtml(item.description)}</p>
      </div>
      ${collection ? `<div class="record-actions">${recordButtons(collection, index)}</div>` : ""}
    </article>
  `;
  }).join("");
}

function renderSettingsDetail(active = activeSettingsPanel) {
  activeSettingsPanel = active || "core";
  if (activeSettingsPanel !== "themes") {
    weatherThemePreviewValue = "live";
    seasonalThemePreviewValue = "none";
    applyDashboardHeaderTheme(lastWeatherCode);
  }
  document.querySelectorAll("[data-settings-action]").forEach((card) => {
    card.classList.toggle("settings-active", card.dataset.settingsAction === activeSettingsPanel);
  });

  const detail = document.querySelector("#settingsDetail");
  const panels = {
    core: () => `
      ${settingsPanelHeader("Core Data", "Open the areas that hold the real information behind the dashboard.")}
      <div class="settings-action-grid">
        ${settingsJumpButton("Job Diary", "diary", `${jobs.length} jobs`)}
        ${settingsJumpButton("Weekly Planner", "weekly-planner", `${weeklyPlanner.length} slots`)}
        ${settingsJumpButton("Valuations", "valuations", `${valuations.length} records`)}
        ${settingsJumpButton("Vehicles", "vehicles", `${vehicles.length} vehicles`)}
        ${settingsJumpButton("Staff", "staff", `${staffProfiles.length} staff`)}
        ${settingsJumpButton("Clients", "clients", `${clients.length} clients`)}
        ${settingsJumpButton("Assets", "assets", `${assets.length} assets`)}
        ${settingsJumpButton("Documents", "documents", `${companyDocuments.length} docs`)}
      </div>
    `,
    users: () => `
      ${settingsPanelHeader("Users", "Staff records are the master list for admin and technician access.")}
      <div class="settings-action-grid">
        ${settingsManageButton("Add Staff Member", "staff", `${staffProfiles.length} current users`)}
        ${settingsJumpButton("Open Staff Management", "staff", "Staff records")}
        ${settingsJumpButton("Open Technicians", "technicians", `${technicians.length} technicians`)}
      </div>
    `,
    permissions: () => `
      ${settingsPanelHeader("Permissions", "Basic role-based access is ready to shape into proper admin and technician permissions.")}
      <div class="permission-grid">
        ${permissionRow("Admin", "Full Hub access, data input, settings and exports")}
        ${permissionRow("Technician", "Jobs, RAMS, reports, photos and navigation")}
        ${permissionRow("Office", "Planner, diary, compliance, clients and documents")}
      </div>
    `,
    email: () => templatePanel("Email Templates", "emailTemplates", emailTemplates, "mail"),
    reports: () => templatePanel("Report Templates", "reportTemplates", reportTemplates, "file-text"),
    rams: () => templatePanel("RAMS Templates", "ramsTemplates", ramsTemplates, "file-check"),
    branding: () => `
      ${settingsPanelHeader("Company Branding", "These details can feed the Hub, exported reports, RAMS emails and future documents.")}
      <div class="branding-panel">
        <img src="${escapeHtml(companyBranding.logo)}" alt="Kingswood logo">
        <div>
          <strong>${escapeHtml(companyBranding.companyName)}</strong>
          <p>Navy ${escapeHtml(companyBranding.navy)} | Orange ${escapeHtml(companyBranding.orange)}</p>
          <button class="secondary-button" type="button" data-edit-record="branding" data-record-index="0">Edit Branding</button>
        </div>
      </div>
    `,
    themes: () => `
      ${settingsPanelHeader("Header Theme Preview", "Preview weather and seasonal header styles without changing the live Orpington weather feed.")}
      <div class="theme-preview-panel">
        <div class="theme-preview-note">
          <strong>Preview mode only</strong>
          <p>These controls change the header/banner visuals only. They do not change, save or replace the real weather data.</p>
        </div>
        <div class="theme-preview-controls">
          <label>
            Weather Theme Test Mode
            <select id="weatherThemePreviewSelect">
              <option value="live">Live weather automatic</option>
              <option value="standard">Standard Kingswood header</option>
              <option value="clear">Sunny</option>
              <option value="rain">Rain</option>
              <option value="snow">Snow</option>
            </select>
          </label>
          <label>
            Seasonal Theme Preview
            <select id="seasonalThemePreviewSelect">
              <option value="none">None</option>
              <option value="christmas">Christmas</option>
              <option value="easter">Easter</option>
              <option value="halloween">Halloween</option>
            </select>
          </label>
          <label>
            Christmas automatic end date
            <input id="christmasThemeEndDateInput" type="date" value="${escapeHtml(christmasThemeEndDate())}">
          </label>
        </div>
        <div class="theme-preview-actions">
          <p id="themePreviewStatus" class="theme-preview-status">Header preview: Live weather automatic.</p>
          <button class="secondary-button" id="resetHeaderThemePreviewButton" type="button">Reset to live header</button>
        </div>
      </div>
    `,
    storage: () => `
      ${settingsPanelHeader("Data Storage", "The Hub saves into this Kingswood Hub OneDrive folder. Each save now keeps timestamped safety backups.")}
      <div class="storage-panel">
        ${listRow("Main Hub data", "data/command-centre-data.json", "OneDrive")}
        ${listRow("Automatic backups", "data/backups", "Protected")}
        ${listRow("Tech/Admin feed files", "data/*-feed.json", "OneDrive")}
        ${listRow("Browser status", document.querySelector("#storageStatus")?.textContent || "Checking", "Live")}
        ${listRow("Planner import", `${weeklyPlanner.length} planner slots imported`, "Ready")}
        ${listRow("Valuation import", `${valuations.length} valuation records imported`, "Ready")}
      </div>
    `
  };

  detail.innerHTML = (panels[activeSettingsPanel] || panels.core)();
  updateThemePreviewControls();
}

function settingsPanelHeader(title, subtitle) {
  return `
    <div class="settings-detail-heading">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(subtitle)}</p>
      </div>
    </div>
  `;
}

function settingsJumpButton(label, section, badge) {
  return `
    <button class="setup-action" type="button" data-jump-section="${section}">
      <span class="card-badge">${escapeHtml(badge)}</span>
      <strong class="card-title">${escapeHtml(label)}</strong>
    </button>
  `;
}

function settingsManageButton(label, collection, badge) {
  return `
    <button class="setup-action" type="button" data-manage="${collection}">
      <span class="card-badge">${escapeHtml(badge)}</span>
      <strong class="card-title">${escapeHtml(label)}</strong>
    </button>
  `;
}

function permissionRow(role, detail) {
  return `<article class="list-row"><div><strong>${escapeHtml(role)}</strong><p>${escapeHtml(detail)}</p></div><span class="status ok">Live</span></article>`;
}

function templatePanel(title, collection, items, iconName) {
  return `
    ${settingsPanelHeader(title, "Create and edit reusable text for the office workflow.")}
    <div class="panel-heading compact-heading">
      <span>${items.length} saved</span>
      <button class="primary-button" type="button" data-manage="${collection}">Add Template</button>
    </div>
    <div class="settings-template-list">
      ${items.map((item, index) => {
        const name = item.name || item.title || "Template";
        const detail = item.subject || item.description || item.body || "No details yet";
        return `
          <article class="module-card compact-card">
            <div class="card-topline">${iconShell(iconName)}<span class="card-badge">Template</span></div>
            <strong class="card-title">${escapeHtml(name)}</strong>
            <p class="card-subtitle">${escapeHtml(detail)}</p>
            <div class="record-actions">${recordButtons(collection, index)}</div>
          </article>
        `;
      }).join("") || '<p class="empty-state">No templates yet.</p>'}
    </div>
  `;
}

function renderSetupActions() {
  document.querySelector("#setupGrid").innerHTML = setupActions.map((item) => `
    <button class="setup-action" type="button" data-jump-section="${item[2]}" data-manage="${setupCollectionForSection(item[2])}">
      <div class="card-topline">
        ${iconShell(setupCardMeta[item[2]]?.[0] || "dashboard")}
        <span class="${badgeClass(setupCardMeta[item[2]]?.[2]?.())}">${escapeHtml(setupCardMeta[item[2]]?.[1]?.() || "Ready")}</span>
      </div>
      <div class="card-copy">
        <strong class="card-title">${escapeHtml(item[0])}</strong>
        <span class="card-subtitle">${escapeHtml(item[1])}</span>
      </div>
    </button>
  `).join("");
}

function setupCollectionForSection(section) {
  const links = {
    diary: "jobs",
    "weekly-planner": "planner",
    valuations: "valuations",
    staff: "staff",
    training: "training",
    vehicles: "vehicles",
    compliance: "compliance",
    documents: "documents",
    clients: "clients",
    assets: "assets"
  };
  return links[section] || "";
}

function recordButtons(collection, index) {
  return `
    <button class="secondary-button" type="button" data-edit-record="${collection}" data-record-index="${index}">Edit</button>
    <button class="danger-button" type="button" data-delete-record="${collection}" data-record-index="${index}">Delete</button>
  `;
}

function complianceRecordButtons(index) {
  return `
    <button class="secondary-button" type="button" data-view-compliance="${index}">View</button>
    <button class="secondary-button" type="button" data-edit-record="compliance" data-record-index="${index}">Edit</button>
    <button class="secondary-button" type="button" data-open-compliance-document-record="${index}">Open document</button>
    <button class="secondary-button" type="button" data-replace-compliance-document="${index}">Replace document</button>
    <button class="secondary-button" type="button" data-renew-compliance="${index}">Mark renewed</button>
    <button class="danger-button" type="button" data-delete-record="compliance" data-record-index="${index}">Delete</button>
  `;
}

function complianceRecordAt(index) {
  return complianceRecords()[Number(index)];
}

async function showComplianceRecord(index) {
  const item = complianceRecordAt(index);
  if (!item) return;
  const status = complianceStatus(item);
  await kcInfo([
    `${item.title}`,
    `Type: ${item.complianceType}`,
    `Provider: ${item.provider || "-"}`,
    `Reference: ${item.certificateNumber || "-"}`,
    `Responsible: ${item.responsiblePerson}`,
    `Status: ${status.label} - ${status.reminder}`,
    `Document: ${item.documentFileName || "No document saved"}`,
    `History entries: ${Array.isArray(item.history) ? item.history.length : 0}`
  ].join("\n"));
}

async function openComplianceDocument(index) {
  const item = complianceRecordAt(index);
  if (!item?.oneDriveLocation) {
    await kcInfo("No OneDrive document location has been saved for this compliance record yet.");
    return;
  }
  const fileUrl = `file:///${String(item.oneDriveLocation).replace(/\\/g, "/").replace(/ /g, "%20")}`;
  window.open(fileUrl, "_blank", "noopener");
}

async function renewComplianceRecord(index) {
  const records = complianceRecords();
  const item = records[Number(index)];
  if (!item) return;
  const startDate = await kcInput(`Enter the new start date for:\n${item.title}`, "New start date (yyyy-mm-dd)", today);
  if (!startDate || startDate === "cancel") return;
  const expiryDate = await kcInput("Enter the new expiry or review date. Leave blank only if this item has no expiry.", "New expiry / review date", item.expiryDate || "");
  if (expiryDate === "cancel") return;
  const confirmed = await kcConfirmAction("Renew this compliance item? The old dates and old document location will be kept in renewal history.", "Mark renewed");
  if (!confirmed) return;

  const historyEntry = {
    renewedAt: new Date().toISOString(),
    renewedBy: currentUserName(),
    previousStartDate: item.startDate || "",
    previousExpiryDate: item.expiryDate || "",
    previousDocumentFileName: item.documentFileName || "",
    previousOneDriveLocation: item.oneDriveLocation || "",
    previousStatus: complianceStatus(item).label
  };
  const updated = {
    ...item,
    startDate,
    expiryDate: expiryDate || "",
    noExpiry: !expiryDate,
    history: [...(Array.isArray(item.history) ? item.history : []), historyEntry],
    audit: [
      ...(Array.isArray(item.audit) ? item.audit : []),
      { action: "renewed", by: currentUserName(), at: new Date().toISOString() }
    ],
    updatedAt: new Date().toISOString()
  };
  updated.status = complianceStatus(updated).label;
  records[Number(index)] = updated;
  dataModels.compliance.set(records);
  const saved = await saveComplianceDocumentToOneDrive(updated, { renewal: true });
  if (!saved) return;
  const commandSaved = await saveCommandData();
  if (!commandSaved) return;
  await kcInfo("Compliance item renewed and saved to OneDrive.");
  render();
}

function technicianFieldStatus(tech) {
  const staff = staffProfiles.find((profile) => profile.name === tech.name) || {};
  const attendance = attendanceFor(tech.name, today);
  const active = !isUnavailableStatus(attendance.status) && String(staff.status || "Active").toLowerCase() !== "inactive";
  return {
    label: active ? "Active" : "Inactive / unavailable",
    className: active ? "ok" : "warning",
    attendance: attendance.status || "Present"
  };
}

function technicianCurrentOrNextJob(name) {
  const sentJobs = jobs
    .filter((job) => job.technician === name && job.status === "Sent to Tech" && job.date >= today)
    .sort((a, b) => `${a.date} ${a.slot || ""}`.localeCompare(`${b.date} ${b.slot || ""}`));
  const current = sentJobs.find((job) => job.date === today);
  const job = current || sentJobs[0];
  if (!job) return { label: "No sent job", detail: "No current or upcoming Tech App job.", job: null };
  return {
    label: current ? "Current job" : "Next job",
    detail: `${formatDateUk(job.date)} ${job.slot || ""} | ${job.postcode || job.address || job.client || job.title}`,
    job
  };
}

function milesBetween(pointA, pointB) {
  const lat1 = Number(pointA?.lat);
  const lon1 = Number(pointA?.lng);
  const lat2 = Number(pointB?.lat);
  const lon2 = Number(pointB?.lng);
  if ([lat1, lon1, lat2, lon2].some((value) => Number.isNaN(value))) return null;
  const toRad = (value) => value * Math.PI / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function defaultGeofenceTestLocation(name) {
  const existing = technicianGeofenceTestLocations[name];
  if (existing) return existing;
  technicianGeofenceTestLocations[name] = {
    mode: "away",
    distance: 1.4,
    lastUpdate: new Date().toISOString()
  };
  return technicianGeofenceTestLocations[name];
}

function geofenceLabelClass(label) {
  if (label === "Near Job") return "ok";
  if (label === "Not Near Job") return "warning";
  if (label === "Offline") return "urgent";
  return "draft";
}

function technicianGeofenceStatus(tech, job, appStatus) {
  if (!job) {
    return {
      label: "Location Not Available",
      className: "draft",
      distanceText: "-",
      lastUpdate: "No assigned job"
    };
  }

  if (technicianGeofenceTestMode) {
    const testLocation = defaultGeofenceTestLocation(tech.name);
    if (testLocation.mode === "offline") {
      return {
        label: "Offline",
        className: "urgent",
        distanceText: "-",
        lastUpdate: formatTrackingTime(testLocation.lastUpdate)
      };
    }
    if (testLocation.mode === "unavailable") {
      return {
        label: "Location Not Available",
        className: "draft",
        distanceText: "-",
        lastUpdate: formatTrackingTime(testLocation.lastUpdate)
      };
    }
    const distance = Number(testLocation.distance || 0);
    const label = distance <= technicianGeofenceRadiusMiles ? "Near Job" : "Not Near Job";
    return {
      label,
      className: geofenceLabelClass(label),
      distanceText: `${distance.toFixed(1)} miles`,
      lastUpdate: formatTrackingTime(testLocation.lastUpdate)
    };
  }

  if (appStatus.className !== "ok") {
    return {
      label: "Offline",
      className: "urgent",
      distanceText: "-",
      lastUpdate: appStatus.lastActivity || "No app activity"
    };
  }

  const staff = staffProfiles.find((profile) => profile.name === tech.name) || {};
  const techPoint = { lat: tech.lat || staff.currentLat, lng: tech.lng || staff.currentLng };
  const jobPoint = { lat: job.lat || job.jobLat, lng: job.lng || job.jobLng };
  const distance = milesBetween(techPoint, jobPoint);
  if (distance === null) {
    return {
      label: "Location Not Available",
      className: "draft",
      distanceText: "-",
      lastUpdate: tech.lastLocationUpdate || staff.lastLocationUpdate || "No location update"
    };
  }

  const label = distance <= technicianGeofenceRadiusMiles ? "Near Job" : "Not Near Job";
  return {
    label,
    className: geofenceLabelClass(label),
    distanceText: `${distance.toFixed(1)} miles`,
    lastUpdate: formatTrackingTime(tech.lastLocationUpdate || staff.lastLocationUpdate || new Date().toISOString())
  };
}

function renderTechnicianGeofenceTestPanel() {
  const target = document.querySelector("#technicianGeofenceTestPanel");
  if (!target) return;
  target.innerHTML = `
    <article class="work-panel technician-geofence-panel">
      <div>
        <span class="status warning">TEST MODE</span>
        <h3>Job Geofence Status</h3>
        <p class="panel-note">Simulated technician locations only. This does not save real location data or mark jobs complete.</p>
      </div>
      <div class="technician-geofence-mode">
        <span>Radius: ${technicianGeofenceRadiusMiles} miles from assigned job</span>
        <button class="secondary-button" type="button" data-technician-geofence-toggle>${technicianGeofenceTestMode ? "Test Mode On" : "Live Mode"}</button>
      </div>
    </article>
  `;
}

function technicianAppStatus(tech) {
  const staff = staffProfiles.find((profile) => profile.name === tech.name) || {};
  const hasPin = Boolean(staff.techPin || tech.techPin);
  const feed = integrationFeeds.technicianApp || buildTechnicianFeed();
  const hasSentJob = feed.jobs?.some((job) => job.technician === tech.name);
  const connected = Boolean(tech.lastAppActivity || staff.lastAppActivity);
  if (connected) {
    return {
      label: "Connected",
      className: "ok",
      lastActivity: formatDateUk(tech.lastAppActivity || staff.lastAppActivity),
      pinLabel: hasPin ? "PIN set" : "PIN not set"
    };
  }
  if (hasSentJob) {
    return {
      label: "Feed ready",
      className: "warning",
      lastActivity: "No app activity yet",
      pinLabel: hasPin ? "PIN set" : "PIN not set"
    };
  }
  return {
    label: "Not Connected",
    className: "draft",
    lastActivity: "Coming later",
    pinLabel: hasPin ? "PIN set" : "PIN not set"
  };
}

function renderTechnicians() {
  const summaryTarget = document.querySelector("#techniciansSummaryGrid");
  const grid = document.querySelector("#techniciansGrid");
  if (!grid) return;
  const techRows = technicians.map((tech) => {
    const fieldStatus = technicianFieldStatus(tech);
    const appStatus = technicianAppStatus(tech);
    const jobStatus = technicianCurrentOrNextJob(tech.name);
    const geofence = technicianGeofenceStatus(tech, jobStatus.job, appStatus);
    const attention = fieldStatus.className !== "ok" || appStatus.className !== "ok";
    return { tech, fieldStatus, appStatus, jobStatus, geofence, attention };
  });
  renderTechnicianGeofenceTestPanel();

  if (summaryTarget) {
    const activeCount = techRows.filter((item) => item.fieldStatus.className === "ok").length;
    const connectedCount = techRows.filter((item) => item.appStatus.className === "ok").length;
    const workingCount = techRows.filter((item) => item.jobStatus.label === "Current job").length;
    const attentionCount = techRows.filter((item) => item.attention).length;
    summaryTarget.innerHTML = [
      ["Active Technicians", activeCount, "Ready field users", "success"],
      ["Connected to Tech App", connectedCount, "Live app activity", connectedCount === techRows.length && techRows.length ? "success" : "warning"],
      ["Currently Working", workingCount, "Sent jobs today", workingCount ? "success" : ""],
      ["Offline or Attention Needed", attentionCount, "PIN, app or availability checks", attentionCount ? "warning" : "success"]
    ].map(([label, value, note, className]) => `
      <article class="summary-tile technician-summary-tile ${className}">
        <span class="summary-label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <p class="summary-copy">${escapeHtml(note)}</p>
      </article>
    `).join("");
  }

  grid.innerHTML = techRows.map(({ tech, fieldStatus, appStatus, jobStatus, geofence }) => `
    <article class="module-card technician-access-card">
      <div class="technician-card-header">
        <div>
          <strong>${escapeHtml(tech.name)}</strong>
          <p>${escapeHtml(tech.role || "Field technician")}</p>
        </div>
        <span class="status ${escapeHtml(fieldStatus.className)}">${escapeHtml(fieldStatus.label)}</span>
      </div>

      <dl class="technician-access-details">
        <div>
          <dt>Tech App</dt>
          <dd><span class="status ${escapeHtml(appStatus.className)}">${escapeHtml(appStatus.label)}</span></dd>
        </div>
        <div>
          <dt>Last app activity</dt>
          <dd>${escapeHtml(appStatus.lastActivity)}</dd>
        </div>
        <div>
          <dt>Assigned job</dt>
          <dd>${escapeHtml(jobStatus.job ? `${jobStatus.job.number || ""} ${jobStatus.job.title || jobStatus.job.client || "Assigned job"}`.trim() : "No assigned job")}</dd>
        </div>
        <div>
          <dt>Job postcode</dt>
          <dd>${escapeHtml(jobStatus.job?.postcode || "Not set")}</dd>
        </div>
        <div>
          <dt>Assigned van</dt>
          <dd>${escapeHtml(tech.van || "Not assigned")}</dd>
        </div>
        <div>
          <dt>App PIN</dt>
          <dd>${escapeHtml(appStatus.pinLabel)}</dd>
        </div>
        <div>
          <dt>Distance from job</dt>
          <dd>${escapeHtml(geofence.distanceText)}</dd>
        </div>
        <div>
          <dt>Geofence status</dt>
          <dd><span class="status ${escapeHtml(geofence.className)}">${escapeHtml(geofence.label)}</span></dd>
        </div>
        <div>
          <dt>Last location update</dt>
          <dd>${escapeHtml(geofence.lastUpdate)}</dd>
        </div>
      </dl>

      ${technicianGeofenceTestMode && jobStatus.job ? `
        <div class="technician-geofence-actions">
          <span class="muted">Test location</span>
          <button class="secondary-button" type="button" data-technician-geofence="near" data-technician-name="${escapeHtml(tech.name)}">Move Near Job</button>
          <button class="secondary-button" type="button" data-technician-geofence="away" data-technician-name="${escapeHtml(tech.name)}">Move Away</button>
          <button class="secondary-button" type="button" data-technician-geofence="unavailable" data-technician-name="${escapeHtml(tech.name)}">Location Unavailable</button>
          <button class="secondary-button" type="button" data-technician-geofence="offline" data-technician-name="${escapeHtml(tech.name)}">Offline</button>
        </div>
      ` : ""}

      <div class="technician-actions">
        <button class="secondary-button" type="button" data-technician-action="view" data-technician-name="${escapeHtml(tech.name)}">View Technician</button>
        <button class="secondary-button" type="button" data-technician-action="app" data-technician-name="${escapeHtml(tech.name)}">View Tech App</button>
        <button class="secondary-button" type="button" data-technician-action="message" data-technician-name="${escapeHtml(tech.name)}">Send Message</button>
        <button class="secondary-button" type="button" data-technician-action="pin" data-technician-name="${escapeHtml(tech.name)}">Reset PIN</button>
        <button class="danger-button" type="button" data-technician-action="disable" data-technician-name="${escapeHtml(tech.name)}">Disable App Access</button>
      </div>
    </article>
  `).join("") || '<p class="empty-state">Add active staff with a technician role to populate Tech App access.</p>';
}

function trackingVehicles() {
  if (trackingMode === "test") return testTrackingVehicles;
  return [];
}

function trackingStatusClass(status) {
  if (status === "Driving") return "ok";
  if (status === "Stopped") return "warning";
  return "urgent";
}

function updateTestVehiclePositions() {
  if (trackingMode !== "test") return;
  testTrackingVehicles = testTrackingVehicles.map((vehicle, index) => {
    if (vehicle.status !== "Driving") {
      return { ...vehicle, lastUpdate: new Date().toISOString() };
    }
    const wobble = Math.sin(Date.now() / 8000 + index) * 0.00018;
    return {
      ...vehicle,
      lat: vehicle.lat + vehicle.routeBearing,
      lng: vehicle.lng + wobble,
      speed: Math.max(8, Math.round(vehicle.speed + Math.sin(Date.now() / 6000 + index) * 5)),
      lastUpdate: new Date().toISOString()
    };
  });
}

function trackingPopupHtml(vehicle) {
  return `
    <div class="tracking-popup">
      <strong>${escapeHtml(vehicle.technician)}</strong>
      <p>${escapeHtml(vehicle.registration)}</p>
      <p>${escapeHtml(vehicle.status)} | ${vehicle.speed || 0} mph</p>
      <p>Updated ${escapeHtml(formatTrackingTime(vehicle.lastUpdate))}</p>
      <span>TEST DATA</span>
    </div>
  `;
}

function formatTrackingTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "now";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function trackingMapConfigs() {
  return [
    { key: "main", mapId: "trackingMap", fallbackId: "trackingMapFallback", zoom: 11 },
    { key: "split", mapId: "splitTrackingMap", fallbackId: "splitTrackingMapFallback", zoom: 10 }
  ];
}

function ensureTrackingMapView(config) {
  const mapElement = document.querySelector(`#${config.mapId}`);
  const fallback = document.querySelector(`#${config.fallbackId}`);
  if (!mapElement || !window.L) {
    fallback?.classList.add("visible");
    return null;
  }
  fallback?.classList.remove("visible");
  let view = trackingMapViews.get(config.key);
  if (!view) {
    const map = L.map(mapElement, { zoomControl: true }).setView([51.3741, 0.0672], config.zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19
    }).addTo(map);
    view = { map, markers: new Map() };
    trackingMapViews.set(config.key, view);
  }
  window.setTimeout(() => view.map.invalidateSize(), 80);
  return view;
}

function renderTrackingMarkersForView(config) {
  const view = ensureTrackingMapView(config);
  if (!view) return;
  const vehiclesToShow = trackingVehicles();
  const activeIds = new Set(vehiclesToShow.map((vehicle) => vehicle.id));
  view.markers.forEach((marker, id) => {
    if (!activeIds.has(id)) {
      marker.remove();
      view.markers.delete(id);
    }
  });
  vehiclesToShow.forEach((vehicle) => {
    const markerClass = `tracking-marker ${trackingStatusClass(vehicle.status)}`;
    const icon = L.divIcon({
      className: markerClass,
      html: `<span>${escapeHtml(vehicle.registration.slice(0, 2))}</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
    let marker = view.markers.get(vehicle.id);
    if (!marker) {
      marker = L.marker([vehicle.lat, vehicle.lng], { icon }).addTo(view.map);
      marker.on("click", () => selectTrackingVehicle(vehicle.id, true));
      view.markers.set(vehicle.id, marker);
    } else {
      marker.setLatLng([vehicle.lat, vehicle.lng]);
      marker.setIcon(icon);
    }
    marker.bindPopup(trackingPopupHtml(vehicle));
  });
}

function renderTrackingMarkers() {
  trackingMapConfigs().forEach(renderTrackingMarkersForView);
}

function selectTrackingVehicle(vehicleId, openPopup = false) {
  selectedTrackingVehicleId = vehicleId;
  const vehicle = trackingVehicles().find((item) => item.id === vehicleId);
  if (vehicle) {
    trackingMapViews.forEach((view) => {
      view.map.setView([vehicle.lat, vehicle.lng], Math.max(view.map.getZoom(), 13), { animate: true });
      if (openPopup) view.markers.get(vehicle.id)?.openPopup();
    });
  }
  renderTrackingList();
}

function trackingVehicleCard(vehicle) {
  return `
    <button class="tracking-vehicle-card ${vehicle.id === selectedTrackingVehicleId ? "selected" : ""}" type="button" data-tracking-vehicle="${escapeHtml(vehicle.id)}">
      <span class="tracking-test-label">${trackingMode === "test" ? "TEST DATA" : "LIVE DATA"}</span>
      <strong>${escapeHtml(vehicle.technician)}</strong>
      <span>${escapeHtml(vehicle.registration)}</span>
      <small>${vehicle.speed || 0} mph | Last update ${escapeHtml(formatTrackingTime(vehicle.lastUpdate))}</small>
      <em class="status ${trackingStatusClass(vehicle.status)}">${escapeHtml(vehicle.status)}</em>
    </button>
  `;
}

function renderTrackingListFor(selector) {
  const list = document.querySelector(selector);
  if (!list) return;
  const vehiclesToShow = trackingVehicles();
  list.innerHTML = vehiclesToShow.length ? vehiclesToShow.map(trackingVehicleCard).join("") : '<p class="empty-state">Live tracking provider not connected yet.</p>';
}

function renderTrackingList() {
  renderTrackingListFor("#trackingList");
  renderTrackingListFor("#splitTrackingList");
}

function renderTracking() {
  const modeStatus = document.querySelector("#trackingModeStatus");
  const sourceLabel = document.querySelector("#trackingSourceLabel");
  if (modeStatus) {
    modeStatus.textContent = trackingMode === "test" ? "TEST MODE" : "LIVE MODE";
    modeStatus.className = `status ${trackingMode === "test" ? "warning" : "ok"}`;
  }
  if (sourceLabel) {
    sourceLabel.textContent = trackingMode === "test"
      ? "TEST MODE - simulated Kingswood vehicles, not saved as business data"
      : "LIVE MODE - waiting for tracking provider connection";
  }
  if (trackingMode === "test") updateTestVehiclePositions();
  renderTrackingList();
  renderTrackingMarkers();
  if (!trackingMoveTimer) {
    trackingMoveTimer = window.setInterval(() => {
      if (document.querySelector("#tracking")?.classList.contains("active")) {
        updateTestVehiclePositions();
        renderTrackingList();
        renderTrackingMarkers();
      }
    }, 5000);
  }
}

function renderSplitScreen() {
  const plannerBoard = document.querySelector("#splitPlannerBoard");
  const plannerTitle = document.querySelector("#splitPlannerWeekTitle");
  const splitModeStatus = document.querySelector("#splitTrackingModeStatus");
  if (!plannerBoard || !plannerTitle) return;

  if (splitModeStatus) {
    splitModeStatus.textContent = trackingMode === "test" ? "TEST MODE" : "LIVE MODE";
    splitModeStatus.className = `status ${trackingMode === "test" ? "warning" : "ok"}`;
  }
  renderTrackingListFor("#splitTrackingList");
  renderTrackingMarkersForView({ key: "split", mapId: "splitTrackingMap", fallbackId: "splitTrackingMapFallback", zoom: 10 });

  const week = plannerCurrentWeek();
  const board = plannerBoardHtml(week, weeklyPlanner.filter((item) => item.week === week), false);
  plannerTitle.textContent = week.replace("WC ", "Week commencing ");
  plannerBoard.innerHTML = board.html;
}

function historyControlValue(selector, fallback = "all") {
  return document.querySelector(selector)?.value || fallback;
}

function historyStoredPageSize() {
  const stored = Number(localStorage.getItem(historyPageSizeStorageKey) || 15);
  return [15, 25, 50, 100].includes(stored) ? stored : 15;
}

function historySearchTerm() {
  return (document.querySelector("#historySearch")?.value || "").trim().toLowerCase();
}

function historyDateValue(job) {
  return String(job.completedAt || job.completionDate || job.submittedAt || job.date || job.jobDate || "").slice(0, 10);
}

function historyRecordKey(job, fallbackIndex) {
  return String(job.jobId || job.id || job.number || job.reference || job.jobReference || fallbackIndex);
}

function historyMeaningfulValues(job) {
  return [
    job.number,
    job.reference,
    job.jobReference,
    job.address,
    job.title,
    job.client,
    job.postcode,
    job.technician,
    job.date
  ].map((value) => String(value || "").trim()).filter(Boolean);
}

function historyStatusInfo(job) {
  const rawStatus = String(job.status || "").toLowerCase();
  const rawReport = String(job.report || "").toLowerCase();
  if (rawStatus.includes("cancel")) return { key: "cancelled", label: "Cancelled", className: "urgent" };
  if (rawStatus.includes("follow") || rawReport.includes("follow")) return { key: "follow-up-required", label: "Follow-up Required", className: "warning" };
  if (jobCompleted(job)) return { key: "completed", label: "Completed", className: "ok" };
  if (rawStatus.includes("await") || rawReport.includes("await")) return { key: "awaiting-report", label: "Awaiting Report", className: "warning" };
  if (rawStatus.includes("sent")) return { key: "sent", label: "Sent to Technician", className: "sent-tech" };
  return { key: "scheduled", label: rawStatus ? job.status : "Scheduled", className: "draft" };
}

function historyReportMatches(job) {
  const jobId = String(job.jobId || job.id || "").trim();
  const jobReference = String(job.number || job.reference || job.jobReference || "").trim();
  return phase05eCompletedReports
    .filter((report) => {
      return (jobId && report.jobId === jobId) || (jobReference && report.jobReference === jobReference);
    })
    .filter((report) => report.reportId && report.oneDriveFolder)
    .sort((a, b) => new Date(b.submittedAt || b.createdAt || b.jobDate || 0) - new Date(a.submittedAt || a.createdAt || a.jobDate || 0));
}

function historyDateMatches(dateValue, filter) {
  if (filter === "all") return true;
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date(`${today}T00:00:00`);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const day = now.getDay() || 7;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - day + 1);
  const lastThreeMonths = new Date(now);
  lastThreeMonths.setMonth(now.getMonth() - 3);
  if (filter === "this-week") return date >= startOfWeek && date <= now;
  if (filter === "this-month") return date >= startOfMonth && date <= now;
  if (filter === "last-3-months") return date >= lastThreeMonths && date <= now;
  if (filter === "this-year") return date >= startOfYear && date <= now;
  return true;
}

function historySourceRecords() {
  historyExcludedUnusableCount = 0;
  return dashboardJobSource().map((job, index) => {
    const originalIndex = jobs.indexOf(job);
    const meaningful = historyMeaningfulValues(job);
    if (!meaningful.length) {
      historyExcludedUnusableCount += 1;
      return null;
    }
    const incomplete = meaningful.length < 2;
    const report = phase05eReportForJob(job);
    const status = historyStatusInfo(job);
    return {
      job,
      report,
      status,
      key: historyRecordKey(job, index),
      originalIndex,
      incomplete
    };
  }).filter(Boolean);
}

function historyPopulateFilterOptions(records) {
  const technicianSelect = document.querySelector("#historyTechnicianFilter");
  const clientSelect = document.querySelector("#historyClientFilter");
  if (!technicianSelect || !clientSelect) return;
  const technicianValue = technicianSelect.value || "all";
  const clientValue = clientSelect.value || "all";
  const technicians = [...new Set(records.map(({ job }) => String(job.technician || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const clients = [...new Set(records.map(({ job }) => String(job.client || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  technicianSelect.innerHTML = `<option value="all">All Technicians</option>${technicians.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  clientSelect.innerHTML = `<option value="all">All Clients</option>${clients.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  technicianSelect.value = technicians.includes(technicianValue) ? technicianValue : "all";
  clientSelect.value = clients.includes(clientValue) ? clientValue : "all";
}

function historyFilteredRecords() {
  const records = historySourceRecords();
  historyPopulateFilterOptions(records);
  const term = historySearchTerm();
  const statusFilter = historyControlValue("#historyStatusFilter");
  const dateFilter = historyControlValue("#historyDateFilter");
  const technicianFilter = historyControlValue("#historyTechnicianFilter");
  const clientFilter = historyControlValue("#historyClientFilter");
  return records.filter(({ job, report, status }) => {
    const searchable = [
      job.address,
      job.postcode,
      job.number,
      job.reference,
      job.jobReference,
      job.client,
      job.technician,
      job.title,
      job.workType,
      job.type,
      report?.reportId
    ].join(" ").toLowerCase();
    const matchesSearch = !term || searchable.includes(term);
    const matchesStatus = statusFilter === "all" || status.key === statusFilter;
    const matchesDate = historyDateMatches(historyDateValue(job), dateFilter);
    const matchesTechnician = technicianFilter === "all" || String(job.technician || "").trim() === technicianFilter;
    const matchesClient = clientFilter === "all" || String(job.client || "").trim() === clientFilter;
    return matchesSearch && matchesStatus && matchesDate && matchesTechnician && matchesClient;
  });
}

function historySortedRecords(records) {
  const sort = historyControlValue("#historySort", "newest");
  const propertyLabel = (record) => String(record.job.address || record.job.title || "").toLowerCase();
  const clientLabel = (record) => String(record.job.client || "").toLowerCase();
  const techLabel = (record) => String(record.job.technician || "").toLowerCase();
  const timeValue = (record) => new Date(`${historyDateValue(record.job) || "1900-01-01"}T00:00:00`).getTime() || 0;
  return [...records].sort((a, b) => {
    if (sort === "oldest") return timeValue(a) - timeValue(b);
    if (sort === "client-az") return clientLabel(a).localeCompare(clientLabel(b));
    if (sort === "client-za") return clientLabel(b).localeCompare(clientLabel(a));
    if (sort === "technician-az") return techLabel(a).localeCompare(techLabel(b));
    if (sort === "property-az") return propertyLabel(a).localeCompare(propertyLabel(b));
    return timeValue(b) - timeValue(a);
  });
}

function historyMetaItem(label, value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong></article>`;
}

function historyReportSection(record) {
  const reports = historyReportMatches(record.job);
  const report = record.report;
  if (!report) return "";
  const multipleNotice = reports.length > 1 ? `<p class="history-report-note">Multiple reports exist. Showing the latest submitted report.</p>` : "";
  const hasRecommendations = report.recommendations ? "Yes" : "No";
  const reportId = String(report.reportId || "").trim();
  const actionButtons = [
    reportId ? `<button class="secondary-button compact-button" type="button" data-view-phase05e-report="${escapeHtml(reportId)}">View Report</button>` : "",
    reportId && report.oneDriveFolder ? `<button class="secondary-button compact-button" type="button" data-open-report-folder="${escapeHtml(reportId)}">Open OneDrive Folder</button>` : ""
  ].filter(Boolean).join("");
  return `
    <section class="history-expanded-section">
      <h3>Completed Technician Report</h3>
      ${multipleNotice}
      <div class="history-detail-grid">
        ${historyMetaItem("Report status", report.status || "Completed - Report Submitted")}
        ${historyMetaItem("Report ID", reportId)}
        ${historyMetaItem("Submitted", formatDateTimeUk(report.submittedAt))}
        ${historyMetaItem("Technician", report.technician || record.job.technician)}
        ${historyMetaItem("Photo count", String(report.photoCount ?? 0))}
        ${historyMetaItem("Recommendations present", hasRecommendations)}
      </div>
      ${actionButtons ? `<div class="history-card-actions">${actionButtons}</div>` : ""}
    </section>
  `;
}

function historyExpandedContent(record) {
  const job = record.job;
  const status = record.status;
  const reports = historyReportMatches(job);
  const ambiguousReports = reports.length > 1 && !job.phase05eReport?.reportId;
  return `
    <div class="history-expanded" id="history-panel-${escapeHtml(record.key)}">
      <section class="history-expanded-section">
        <h3>Job Information</h3>
        <div class="history-detail-grid">
          ${historyMetaItem("Job reference", job.number || job.reference || job.jobReference)}
          ${historyMetaItem("Client", job.client)}
          ${historyMetaItem("Property address", job.address || job.title)}
          ${historyMetaItem("Postcode", job.postcode)}
          ${historyMetaItem("Work type", job.workType || job.type || job.title)}
          ${historyMetaItem("Assigned technician", job.technician)}
          ${historyMetaItem("Job date", historyDateValue(job) ? formatDateUk(historyDateValue(job)) : "")}
          ${historyMetaItem("Completion date", record.report?.submittedAt ? formatDateTimeUk(record.report.submittedAt) : "")}
          ${historyMetaItem("Current status", status.label)}
        </div>
      </section>
      ${ambiguousReports ? '<p class="history-report-note">Multiple reports are linked to this job. The latest valid submitted report is selected.</p>' : ""}
      ${historyReportSection(record)}
      <div class="history-card-actions">
        ${record.originalIndex >= 0 ? `<button class="secondary-button compact-button" type="button" data-view-job="${record.originalIndex}">View Job</button>` : ""}
        ${record.report ? "" : '<span class="history-muted-action">No completed technician report is linked to this job.</span>'}
      </div>
    </div>
  `;
}

function historyCard(record) {
  const job = record.job;
  const title = record.incomplete ? "Incomplete job record" : (job.address || job.title || job.number || "Job history record");
  const reference = job.number || job.reference || job.jobReference || "No job reference";
  const client = job.client || "Client not recorded";
  const detailParts = [reference, client, job.postcode || job.workType || job.type || job.title].filter(Boolean);
  const technician = String(job.technician || "").trim();
  const expanded = false;
  return `
    <article class="history-card ${record.incomplete ? "incomplete" : ""}" data-history-record="${escapeHtml(record.key)}">
      <button class="history-card-summary" type="button" data-history-expand="${escapeHtml(record.key)}" aria-expanded="${expanded}" aria-controls="history-panel-${escapeHtml(record.key)}">
        <span class="history-card-main">
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(detailParts.join(" | "))}</small>
        </span>
        <span class="history-card-meta">
          ${technician ? `<span class="history-tech-badge">${escapeHtml(technician)}</span>` : ""}
          <span class="status ${escapeHtml(record.status.className)}">${escapeHtml(record.status.label)}</span>
        </span>
      </button>
      ${historyExpandedContent(record)}
    </article>
  `;
}

function updateHistoryPaginationUi(total, pageSize, totalPages) {
  const resultSummary = document.querySelector("#historyResultSummary");
  const pageSummary = document.querySelector("#historyPageSummary");
  const pageIndicator = document.querySelector("#historyPageIndicator");
  const prevButton = document.querySelector("#historyPrevPage");
  const nextButton = document.querySelector("#historyNextPage");
  if (!resultSummary || !pageSummary || !pageIndicator || !prevButton || !nextButton) return;
  const start = total ? ((historyCurrentPage - 1) * pageSize) + 1 : 0;
  const end = total ? Math.min(total, historyCurrentPage * pageSize) : 0;
  resultSummary.textContent = total ? `Showing ${start}-${end} of ${total} jobs` : "Showing 0 jobs";
  pageSummary.textContent = `Page ${historyCurrentPage} of ${totalPages}`;
  pageIndicator.textContent = `Page ${historyCurrentPage} of ${totalPages}`;
  prevButton.disabled = historyCurrentPage <= 1;
  nextButton.disabled = historyCurrentPage >= totalPages;
}

function renderHistory() {
  const list = document.querySelector("#historyList");
  const pageSizeSelect = document.querySelector("#historyPageSize");
  if (!list || !pageSizeSelect) return;
  pageSizeSelect.value = String(historyStoredPageSize());
  const pageSize = Number(pageSizeSelect.value);
  const filtered = historySortedRecords(historyFilteredRecords());
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  historyCurrentPage = Math.min(Math.max(historyCurrentPage, 1), totalPages);
  const pageRecords = filtered.slice((historyCurrentPage - 1) * pageSize, historyCurrentPage * pageSize);
  updateHistoryPaginationUi(filtered.length, pageSize, totalPages);
  if (historyExcludedUnusableCount) {
    console.info(`Job History omitted ${historyExcludedUnusableCount} unusable blank record(s).`);
  }
  list.innerHTML = pageRecords.length
    ? pageRecords.map(historyCard).join("")
    : '<p class="empty-state">No job history records match the current search and filters.</p>';
}

function renderNotifications() {
  const notifications = [
    ...jobs.filter((job) => job.date === today).map((job) => [`Today's job`, `${job.number} - ${job.title}`]),
    ...jobs.filter((job) => job.date === tomorrow).map((job) => [`Tomorrow's job`, `${job.number} - ${job.title}`]),
    ...ramsItems.filter((item) => item.status !== "sent").map((item) => ["RAMS to send", `${item.title} for ${item.client}`]),
    ...vehicles.filter((vehicle) => isReminderDate(vehicle.mot)).map((vehicle) => ["MOT due", `${vehicle.registration} due ${vehicle.mot}`]),
    ...vehicles.filter((vehicle) => isReminderDate(vehicle.insurance)).map((vehicle) => ["Insurance due", `${vehicle.registration} due ${vehicle.insurance}`]),
    ...fines.filter(isFineDeadlineSoon).map((fine) => ["Fine deadline", `${fine.registration} | ${fine.type} | ${fineDeadlineLabel(fine)}`])
  ];

  document.querySelector("#notificationsList").innerHTML = notifications.map((item) => listRow(item[0], item[1], "Reminder")).join("");
}

function listRow(title, detail, badge) {
  const badgeClass = badge === "Urgent" || badge === "Red" || badge === "Sick" || badge === "Holiday" || badge === "Unpaid leave" || badge === "Absent" || title.includes("due") ? "urgent" : badge === "Pending" || badge === "RAMS needed" || badge === "Amber" || badge === "Training" || badge === "Late" ? "warning" : "ok";
  return `
    <article class="list-row">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail)}</p>
      </div>
      <span class="status ${badgeClass}">${escapeHtml(badge)}</span>
    </article>
  `;
}

function tscId(prefix) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function tscNormaliseCommunicationType(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function tscCommunicationTypeDefinition(value) {
  return tscCommunicationTypes[tscNormaliseCommunicationType(value)] || null;
}

function tscCommunicationTypeForContent(item = {}) {
  const stored = tscNormaliseCommunicationType(item.communicationType);
  if (stored) return stored;
  if (String(item.type || "") === "Toolbox Talk") return TSC_TOOLBOX_TALK_COMMUNICATION_TYPE;
  if (String(item.type || "") === "Announcement") return TSC_ANNOUNCEMENT_COMMUNICATION_TYPE;
  return "";
}

function tscCommunicationTypeDisplayName(value) {
  return tscCommunicationTypeDefinition(value)?.displayName || "Communication";
}

function tscValidateCommunicationType(value) {
  const definition = tscCommunicationTypeDefinition(value);
  if (!definition) return { ok: false, reason: "unsupported" };
  if (definition.status !== "active") return { ok: false, reason: "inactive" };
  return { ok: true, definition };
}

function normaliseTscCommunicationTypes() {
  tscMasterContent = tscMasterContent.map((item) => {
    const communicationType = tscCommunicationTypeForContent(item);
    if (!tscValidateCommunicationType(communicationType).ok) return item;
    const validation = tscValidateCommunicationType(communicationType);
    if (!validation.ok || item.communicationType === communicationType) return item;
    return { ...item, communicationType };
  });
}

function tscControlledDocuments() {
  return tscMasterContent.filter((item) => tscValidateCommunicationType(tscCommunicationTypeForContent(item)).ok);
}

function tscContentById(contentId) {
  return tscMasterContent.find((item) => item.contentId === contentId);
}

function tscPublishedById(revisionId) {
  return tscPublishedRevisions.find((revision) => revision.revisionId === revisionId);
}

const tscAssignmentStatusValues = ["Not Started", "In Progress", "Completed", "Overdue", "Cancelled", "Withdrawn", "Exempt", "Reopened"];
const tscEvidenceTypes = ["Acknowledgement", "Knowledge Check", "Quiz Result", "Digital Signature", "Supervisor Verification", "Practical Assessment", "Certificate", "Photograph", "Document Upload", "Attendance Record", "System Verification"];
const tscEvidenceStatusValues = ["Pending", "Submitted", "Accepted", "Verified", "Rejected", "Superseded", "Revoked", "Archived"];

function tscEvidenceById(evidenceId) {
  return tscEvidenceRecords.find((record) => record.evidenceId === evidenceId);
}

function tscEvidenceForAssignment(assignmentId) {
  return tscEvidenceRecords.filter((record) => record.assignmentId === assignmentId);
}

function tscEvidenceCanEdit(record = {}) {
  return !["Accepted", "Verified", "Archived"].includes(record.evidenceStatus);
}

function tscPublishedForContent(contentId) {
  return tscPublishedRevisions.find((revision) => revision.sourceContentId === contentId)
    || tscPublishedRevisions.find((revision) => revision.documentId === tscContentById(contentId)?.documentId);
}

function tscNormaliseStatusValue(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "-");
}

function tscContentIsPublished(item = {}) {
  return tscNormaliseStatusValue(item.status) === "published";
}

function tscContentIsArchived(item = {}) {
  return tscNormaliseStatusValue(item.status) === "archived";
}

function tscEnsurePublishedRevisionForContent(item = {}) {
  if (!item.contentId || !tscContentIsPublished(item)) return null;
  const existing = tscPublishedForContent(item.contentId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const { communicationType, type, ...publishedSnapshot } = item;
  const published = {
    revisionId: tscId("TSC-PUB"),
    sourceContentId: item.contentId,
    documentId: item.documentId || item.contentId,
    documentTitle: item.title || "",
    revisionNumber: item.revision || "Rev A",
    publicationDate: today,
    publishedBy: currentUserName(),
    effectiveDate: item.effectiveDate || today,
    reviewDate: item.reviewDate || "",
    publicationStatus: "Published",
    immutableSnapshot: { ...publishedSnapshot, publishedAt: now }
  };
  tscPublishedRevisions.unshift(published);
  return published;
}

function tscEligibleStaffForAudience(audience) {
  const activeStaff = staffProfiles.filter((staff) => (staff.status || "Active") !== "Inactive");
  const roleMatches = (staff, terms) => terms.some((term) => String(staff.role || "").toLowerCase().includes(term));
  if (audience === "All Technicians") return activeStaff.filter((staff) => roleMatches(staff, ["technician"]));
  if (audience === "Surveyors") return activeStaff.filter((staff) => roleMatches(staff, ["surveyor"]));
  if (audience === "Office Staff") return activeStaff.filter((staff) => !roleMatches(staff, ["technician"]));
  if (audience === "Managers") return activeStaff.filter((staff) => roleMatches(staff, ["manager"]));
  if (audience === "Directors") return activeStaff.filter((staff) => roleMatches(staff, ["director"]));
  return activeStaff.filter((staff) => roleMatches(staff, ["technician"]));
}

function tscSelectedTechnicianIds() {
  const input = document.querySelector("#tscIssueSelectedStaffInput");
  if (!input) return [];
  return Array.from(input.selectedOptions || []).map((option) => option.value).filter(Boolean);
}

function tscEligibleStaffForIssueAudience(audience) {
  if (audience !== "Selected Technicians") return tscEligibleStaffForAudience(audience);
  const selected = new Set(tscSelectedTechnicianIds());
  return tscEligibleStaffForAudience("All Technicians").filter((staff) => selected.has(staff.staffId));
}

function populateTscSelectedTechnicianOptions(selectedIds = []) {
  const input = document.querySelector("#tscIssueSelectedStaffInput");
  if (!input) return;
  const selected = new Set(selectedIds);
  input.innerHTML = tscEligibleStaffForAudience("All Technicians").map((staff) => `
    <option value="${escapeHtml(staff.staffId)}" ${selected.has(staff.staffId) ? "selected" : ""}>${escapeHtml(staff.name || staff.staffId)}</option>
  `).join("");
}

function tscAnnouncementSelectedTechnicianIds() {
  const input = document.querySelector("#tscAnnouncementSelectedStaffInput");
  if (!input) return [];
  return Array.from(input.selectedOptions || []).map((option) => option.value).filter(Boolean);
}

function populateTscAnnouncementSelectedTechnicianOptions(selectedIds = []) {
  const input = document.querySelector("#tscAnnouncementSelectedStaffInput");
  if (!input) return;
  const selected = new Set(selectedIds);
  input.innerHTML = tscEligibleStaffForAudience("All Technicians").map((staff) => `
    <option value="${escapeHtml(staff.staffId)}" ${selected.has(staff.staffId) ? "selected" : ""}>${escapeHtml(staff.name || staff.staffId)}</option>
  `).join("");
}

function tscAnnouncementAudienceStaff(audience) {
  if (audience !== "Selected Technicians") return tscEligibleStaffForAudience("All Technicians");
  const selected = new Set(tscAnnouncementSelectedTechnicianIds());
  return tscEligibleStaffForAudience("All Technicians").filter((staff) => selected.has(staff.staffId));
}

function updateTscAnnouncementConfirmation() {
  const audience = document.querySelector("#tscAnnouncementAudienceInput")?.value || "All Technicians";
  const selectedLabel = document.querySelector("#tscAnnouncementSelectedStaffLabel");
  if (selectedLabel) selectedLabel.hidden = audience !== "Selected Technicians";
  if (audience === "Selected Technicians") populateTscAnnouncementSelectedTechnicianOptions(tscAnnouncementSelectedTechnicianIds());
  const staff = tscAnnouncementAudienceStaff(audience);
  const target = document.querySelector("#tscAnnouncementConfirmation");
  if (!target) return;
  target.innerHTML = `
    This announcement will be sent to <strong>${escapeHtml(String(staff.length))}</strong> active technician${staff.length === 1 ? "" : "s"}.<br>
    ${audience === "Selected Technicians" ? "Only the selected technicians will receive it." : "All active technicians will receive it."}
  `;
}

function tscIssueCommunicationType(issue = {}) {
  const content = tscContentById(issue.contentId) || {};
  return tscCommunicationTypeForContent(content);
}

function tscIssueAssignments(issueId) {
  return tscAssignmentRecords.filter((assignment) => assignment.issueId === issueId);
}

function tscIssueProgress(issue) {
  const assignments = tscIssueAssignments(issue.issueId);
  const issueType = tscIssueCommunicationType(issue);
  const acknowledgementRequired = issueType === TSC_ANNOUNCEMENT_COMMUNICATION_TYPE ? issue.acknowledgementRequired === true : true;
  const completed = assignments.filter((assignment) => assignment.status === "Completed" || assignment.completedAt || assignment.completedDateTime);
  const sent = assignments.filter((assignment) => assignment.sentAt || assignment.assignedDateTime || assignment.createdAt);
  const received = assignments.filter((assignment) => assignment.receivedAt || completed.includes(assignment));
  const viewed = assignments.filter((assignment) => assignment.viewedAt || assignment.openedAt || assignment.openedDateTime || completed.includes(assignment));
  const outstanding = assignments.filter((assignment) => acknowledgementRequired ? !completed.includes(assignment) : !viewed.includes(assignment));
  return {
    assigned: assignments.length,
    sent: sent.length,
    received: received.length,
    viewed: viewed.length,
    acknowledged: completed.length,
    completed: completed.length,
    outstanding: outstanding.length
  };
}

function tscIssueOperationalStatus(issue) {
  const progress = tscIssueProgress(issue);
  const dueDate = issue.dueDate || "";
  if (progress.assigned && progress.completed === progress.assigned) return "Completed";
  if (dueDate && dueDate < today) return "Overdue";
  if (issue.status === "Issued") return "Live";
  return issue.status || "Draft";
}

function tscEvidenceSchemaReference() {
  return {
    evidenceId: "",
    assignmentId: "",
    employeeId: "",
    evidenceType: "Acknowledgement",
    evidenceStatus: "Pending",
    createdDateTime: "",
    submittedDateTime: "",
    verifiedDateTime: "",
    verifiedBy: "",
    completionMethod: "",
    result: "",
    score: null,
    passFail: "",
    acknowledgementText: "",
    signatureReference: "",
    attachmentReference: "",
    supervisorNotes: "",
    deviceInformation: "",
    appVersion: appVersion,
    authenticatedUserId: "",
    ipAddress: null,
    location: null,
    sourceSystem: "Kingswood Connect",
    auditEventId: "",
    publishedRevisionId: "",
    contentSnapshotReference: "",
    documentChecksum: ""
  };
}

function tscAssignmentSchemaReference() {
  return {
    assignmentId: "",
    issueCampaignId: "",
    employeeId: "",
    assignedDateTime: "",
    dueDateTime: "",
    status: "Not Started",
    priority: "Normal",
    assignmentSource: "",
    assignedBy: "",
    openedDateTime: "",
    completedDateTime: "",
    cancelledDateTime: "",
    cancellationReason: "",
    exemptionStatus: "",
    exemptionReason: "",
    reopenedDateTime: "",
    escalationStatus: "",
    managerOrSupervisor: ""
  };
}

function tscContentCanEdit(item = {}) {
  return !tscContentIsPublished(item) && !tscContentIsArchived(item);
}

function tscStatusPill(status) {
  const className = status === "Approved" || status === "Published" || status === "Accepted" || status === "Verified" || status === "Completed"
    ? "green"
    : status === "Draft" || status === "Submitted for Approval" || status === "Pending" || status === "Submitted" || status === "In Progress" || status === "Not Started" || status === "Reopened"
      ? "amber"
      : status === "Archived" || status === "Superseded" || status === "Revoked" || status === "Cancelled" || status === "Withdrawn" || status === "Exempt"
        ? "muted"
        : status === "Due for Review" || status === "Rejected" || status === "Overdue"
          ? "red"
          : "";
  return `<span class="status-pill ${className}">${escapeHtml(status || "-")}</span>`;
}

function tscAudit(action, record = {}, details = {}) {
  const event = {
    auditEventId: tscId("AUD"),
    dateTime: new Date().toISOString(),
    user: currentUserName(),
    role: currentUserName() === "Kevin" || currentUserName() === "Alex" ? "Director" : "Office",
    module: "Training, Safety & Compliance",
    action,
    affectedRecord: record.title || record.documentId || "Controlled Document",
    recordId: record.contentId || record.revisionId || record.documentId || "",
    previousValue: details.previousValue || null,
    newValue: details.newValue || null,
    notes: details.notes || ""
  };
  universalAuditEvents.unshift(event);
  return event.auditEventId;
}

function renderTscModule() {
  if (!document.querySelector("#training-safety-compliance")) return;
  const documents = tscControlledDocuments();
  const allAssignments = tscAssignmentRecords;
  const incompleteAssignments = allAssignments.filter((assignment) => assignment.status !== "Completed" && !assignment.completedAt && !assignment.completedDateTime);
  const completedThisMonth = allAssignments.filter((assignment) => {
    const completedAt = String(assignment.completedAt || assignment.completedDateTime || "");
    return completedAt.startsWith(today.slice(0, 7));
  });
  document.querySelector("#tscKpiActionRequired").textContent = incompleteAssignments.length;
  document.querySelector("#tscKpiAwaiting").textContent = incompleteAssignments.length;
  document.querySelector("#tscKpiOverdue").textContent = incompleteAssignments.filter((assignment) => String(assignment.dueDate || "").slice(0, 10) < today).length;
  document.querySelector("#tscKpiCompletedMonth").textContent = completedThisMonth.length;
  document.querySelector("#tscOverviewLive").textContent = documents.filter((item) => item.status === "Approved").length;
  document.querySelector("#tscOverviewScheduled").textContent = documents.filter((item) => tscContentIsPublished(item)).length;
  document.querySelector("#tscOverviewComplete").textContent = documents.filter((item) => tscContentIsArchived(item)).length;
  const evidenceCount = document.querySelector("#tscEvidenceRecordCount");
  if (evidenceCount) evidenceCount.textContent = tscEvidenceRecords.length;
  const assignmentModelCount = document.querySelector("#tscAssignmentModelCount");
  if (assignmentModelCount) assignmentModelCount.textContent = tscAssignmentRecords.length;
  document.querySelector("#tscLiveIssueBadge").textContent = tscPublishedRevisions.length ? `${tscPublishedRevisions.length} published revision${tscPublishedRevisions.length === 1 ? "" : "s"}` : "No published revisions yet";
  renderTscContentTable();
  renderTscPublishedRevisionTable();
  renderTscCommunicationTable();
  renderTscIssueRecordTable();
  renderTscAssignmentRecordTable();
  renderTscAssignmentModelTable();
  renderTscEvidenceSummaryTable();
  renderTscAuditTable();
  renderTscRecentActivity();
  renderTscCommunicationDetail();
}

function renderTscContentTable() {
  const target = document.querySelector("#tscContentTableBody");
  if (!target) return;
  const items = tscControlledDocuments();
  target.innerHTML = items.map((item) => {
    const canEdit = tscContentCanEdit(item);
    return `
      <tr>
        <td>${escapeHtml(tscCommunicationTypeDisplayName(tscCommunicationTypeForContent(item)))}</td>
        <td>${escapeHtml(item.title || "-")}</td>
        <td>${escapeHtml(item.documentId || item.contentId || "-")}</td>
        <td>${escapeHtml(item.revision || "-")}</td>
        <td>${tscStatusPill(item.status || "Draft")}</td>
        <td>${escapeHtml(item.reviewDate ? formatDateUk(item.reviewDate) : "Not set")}</td>
        <td>${escapeHtml(item.lastUpdated ? formatDateUk(String(item.lastUpdated).slice(0, 10)) : "Not saved")}</td>
        <td>
          <div class="tsc-action-row">
            ${canEdit ? `<button class="secondary-button" type="button" data-tsc-content-edit="${escapeHtml(item.contentId)}">Edit</button>` : '<span class="status-pill muted">Read-only</span>'}
            <button class="secondary-button" type="button" data-tsc-content-view="${escapeHtml(item.contentId)}">View</button>
            <button class="secondary-button" type="button" data-tsc-content-clone="${escapeHtml(item.contentId)}">Clone</button>
            ${item.status === "Submitted for Approval" ? `<button class="secondary-button" type="button" data-tsc-content-approve="${escapeHtml(item.contentId)}">Approve</button>` : ""}
            ${item.status === "Approved" ? `<button class="secondary-button" type="button" data-tsc-content-publish="${escapeHtml(item.contentId)}">Publish</button>` : ""}
            ${tscContentIsPublished(item) ? `<button class="primary-button" type="button" data-tsc-content-issue="${escapeHtml(item.contentId)}">Issue</button>` : ""}
            ${item.status !== "Archived" ? `<button class="secondary-button" type="button" data-tsc-content-archive="${escapeHtml(item.contentId)}">Archive</button>` : ""}
          </div>
        </td>
      </tr>
    `;
  }).join("") || '<tr><td colspan="8">No controlled documents have been created yet.</td></tr>';
}

function renderTscCommunicationTable() {
  const target = document.querySelector("#tscCommunicationTableBody");
  if (!target) return;
  target.innerHTML = tscIssueRecords.map((issue) => {
    const progress = tscIssueProgress(issue);
    const status = tscIssueOperationalStatus(issue);
    const issueType = tscIssueCommunicationType(issue);
    const typeLabel = tscCommunicationTypeDisplayName(issueType);
    const progressLabel = issueType === TSC_ANNOUNCEMENT_COMMUNICATION_TYPE
      ? `${progress.sent} Sent / ${progress.received} Received / ${progress.viewed} Viewed / ${progress.acknowledged} Acknowledged / ${progress.outstanding} Outstanding`
      : `${progress.completed} Completed / ${progress.outstanding} Outstanding`;
    return `
      <tr>
        <td><span class="status-pill muted">${escapeHtml(typeLabel)}</span><br>${escapeHtml(issue.title || typeLabel)}</td>
        <td>${escapeHtml(`${issue.audience || "Audience"}${progress.assigned ? ` - ${progress.assigned} Assigned` : ""}`)}</td>
        <td>${escapeHtml(issue.issueDate ? formatDateUk(String(issue.issueDate).slice(0, 10)) : "-")}</td>
        <td>${escapeHtml(issue.dueDate ? formatDateUk(String(issue.dueDate).slice(0, 10)) : "-")}</td>
        <td>${escapeHtml(progressLabel)}</td>
        <td>${tscStatusPill(status)}</td>
        <td><button class="secondary-button" type="button" data-tsc-detail-open="${escapeHtml(issue.issueId)}">Manage</button></td>
      </tr>
    `;
  }).join("") || '<tr><td colspan="7">No communications have been issued yet.</td></tr>';
}

function renderTscPublishedRevisionTable() {
  const target = document.querySelector("#tscPublishedRevisionTableBody");
  if (!target) return;
  target.innerHTML = tscPublishedRevisions.map((revision) => `
    <tr>
      <td>${escapeHtml(revision.documentId || "-")}</td>
      <td>${escapeHtml(revision.revisionNumber || "-")}</td>
      <td>${escapeHtml(revision.publicationDate ? formatDateUk(revision.publicationDate) : "Not set")}</td>
      <td>${escapeHtml(revision.publishedBy || "-")}</td>
      <td>${escapeHtml(revision.effectiveDate ? formatDateUk(revision.effectiveDate) : "Not set")}</td>
      <td>${escapeHtml(revision.reviewDate ? formatDateUk(revision.reviewDate) : "Not set")}</td>
      <td>${tscStatusPill(revision.publicationStatus || "Published")}</td>
      <td><button class="secondary-button" type="button" data-tsc-detail-open="${escapeHtml(revision.revisionId)}">View</button></td>
    </tr>
  `).join("") || '<tr><td colspan="8">No published revisions yet.</td></tr>';
}

function tscIssueById(issueId) {
  return tscIssueRecords.find((issue) => issue.issueId === issueId);
}

function tscAssignmentsForIssue(issueId) {
  return tscAssignmentRecords.filter((assignment) => assignment.issueId === issueId);
}

function renderTscIssueRecordTable() {
  const target = document.querySelector("#tscIssueRecordTableBody");
  if (!target) return;
  target.innerHTML = tscIssueRecords.map((issue) => {
    const assignments = tscAssignmentsForIssue(issue.issueId);
    const evidenceCount = assignments.reduce((total, assignment) => total + tscEvidenceForAssignment(assignment.assignmentId).length, 0);
    const content = tscContentById(issue.contentId) || tscPublishedById(issue.publishedRevisionId) || {};
    return `
      <tr>
        <td>${escapeHtml(issue.issueId || "-")}</td>
        <td>${escapeHtml(issue.title || content.title || content.documentTitle || issue.contentId || "-")}</td>
        <td>${escapeHtml(issue.audience || issue.recipientRole || "Not set")}</td>
        <td>${escapeHtml(issue.issueDate ? formatDateUk(String(issue.issueDate).slice(0, 10)) : "-")}</td>
        <td>${escapeHtml(issue.dueDate ? formatDateUk(String(issue.dueDate).slice(0, 10)) : "-")}</td>
        <td>${tscStatusPill(issue.status || "Draft")}</td>
        <td>${escapeHtml(String(assignments.length))}</td>
        <td>${escapeHtml(String(evidenceCount))}</td>
      </tr>
    `;
  }).join("") || '<tr><td colspan="8">No issue records yet. Existing issue record structure is preserved for the future workflow.</td></tr>';
}

function renderTscAssignmentRecordTable() {
  const target = document.querySelector("#tscAssignmentRecordTableBody");
  if (!target) return;
  target.innerHTML = tscAssignmentRecords.map((assignment) => {
    const evidenceCount = tscEvidenceForAssignment(assignment.assignmentId).length;
    const staff = staffProfiles.find((profile) => profile.staffId === assignment.staffId || profile.staffId === assignment.employeeId) || {};
    const issue = tscIssueById(assignment.issueId) || {};
    return `
      <tr>
        <td>${escapeHtml(assignment.assignmentId || "-")}</td>
        <td>${escapeHtml(assignment.issueId || "-")}</td>
        <td>${escapeHtml(staff.name || assignment.employeeName || assignment.staffName || assignment.employeeId || assignment.staffId || "-")}</td>
        <td>${tscStatusPill(assignment.status || "Not Started")}</td>
        <td>${escapeHtml(assignment.dueDateTime ? new Date(assignment.dueDateTime).toLocaleString("en-GB") : assignment.dueDate ? formatDateUk(String(assignment.dueDate).slice(0, 10)) : issue.dueDate ? formatDateUk(String(issue.dueDate).slice(0, 10)) : "-")}</td>
        <td>${escapeHtml(assignment.openedDateTime ? new Date(assignment.openedDateTime).toLocaleString("en-GB") : assignment.openedAt ? new Date(assignment.openedAt).toLocaleString("en-GB") : "-")}</td>
        <td>${escapeHtml(assignment.completedDateTime ? new Date(assignment.completedDateTime).toLocaleString("en-GB") : assignment.completedAt ? new Date(assignment.completedAt).toLocaleString("en-GB") : "-")}</td>
        <td>${escapeHtml(String(evidenceCount))}</td>
      </tr>
    `;
  }).join("") || '<tr><td colspan="8">No assignment records yet. Assignment record structure is preserved separately from evidence.</td></tr>';
}

function renderTscAssignmentModelTable() {
  const target = document.querySelector("#tscAssignmentModelTableBody");
  if (!target) return;
  const reference = tscAssignmentSchemaReference();
  const rows = [
    ["Assignment ID", "assignmentId", "Unique obligation identifier"],
    ["Issue Campaign ID", "issueCampaignId", "Future campaign link"],
    ["Employee ID", "employeeId", "Staff identity reference, not copied employee data"],
    ["Assigned Date and Time", "assignedDateTime", "When the obligation was created"],
    ["Due Date and Time", "dueDateTime", "Required completion deadline"],
    ["Status", "status", tscAssignmentStatusValues.join(", ")],
    ["Priority", "priority", "Standard priority marker for future escalation"],
    ["Assignment Source", "assignmentSource", "Published revision, campaign or future source"],
    ["Assigned By", "assignedBy", "User who created the obligation"],
    ["Manager or Supervisor", "managerOrSupervisor", "Future verification/escalation link"]
  ];
  target.innerHTML = rows.map(([label, field, purpose]) => `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td>${escapeHtml(field)}</td>
      <td>${escapeHtml(purpose)}</td>
      <td>${escapeHtml(reference[field] || "-")}</td>
    </tr>
  `).join("");
}

function renderTscEvidenceSummaryTable() {
  const target = document.querySelector("#tscEvidenceTableBody");
  if (!target) return;
  target.innerHTML = tscEvidenceRecords.map((record) => `
    <tr>
      <td>${escapeHtml(record.employeeName || record.employeeId || "-")}</td>
      <td>${escapeHtml(record.evidenceType || "-")}</td>
      <td>${tscStatusPill(record.evidenceStatus || "Pending")}</td>
      <td>${escapeHtml(record.submittedDateTime ? new Date(record.submittedDateTime).toLocaleString("en-GB") : "-")}</td>
      <td>${escapeHtml(record.verifiedDateTime ? new Date(record.verifiedDateTime).toLocaleString("en-GB") : "-")}</td>
      <td>${escapeHtml(record.result || record.passFail || "-")}</td>
      <td>${tscEvidenceCanEdit(record) ? '<span class="status-pill muted">Future workflow</span>' : '<span class="status-pill muted">Immutable</span>'}</td>
    </tr>
  `).join("") || '<tr><td colspan="7">No evidence records yet. Future assignments may hold multiple evidence records.</td></tr>';
}

function renderTscAuditTable() {
  const target = document.querySelector("#tscAuditTableBody");
  if (!target) return;
  target.innerHTML = universalAuditEvents.slice(0, 25).map((event) => `
    <tr>
      <td>${escapeHtml(event.dateTime ? new Date(event.dateTime).toLocaleString("en-GB") : "-")}</td>
      <td>${escapeHtml(event.user || "-")}</td>
      <td>${escapeHtml(event.role || "-")}</td>
      <td>${escapeHtml(event.module || "-")}</td>
      <td>${escapeHtml(event.action || "-")}</td>
      <td>${escapeHtml(event.affectedRecord || "-")}</td>
      <td>${escapeHtml(event.recordId || "-")}</td>
      <td>${escapeHtml(event.notes || "-")}</td>
    </tr>
  `).join("") || '<tr><td colspan="8">No audit events recorded yet.</td></tr>';
}

function renderTscRecentActivity() {
  const target = document.querySelector("#tscRecentActivity");
  if (!target) return;
  target.innerHTML = universalAuditEvents.slice(0, 6).map((event) => `
    <li><span></span><div><strong>${escapeHtml(event.action || "Audit Event")}</strong><p>${escapeHtml(`${event.affectedRecord || "Record"} by ${event.user || "Unknown"}`)}</p></div></li>
  `).join("") || '<li><span></span><div><strong>No audit activity yet</strong><p>Create or update a controlled document to start the audit trail.</p></div></li>';
}

function renderTscCommunicationDetail() {
  const detailPanel = document.querySelector("[data-tsc-communication-detail]");
  if (!detailPanel || detailPanel.hidden) return;
  const issue = tscIssueById(selectedTscIssueId) || tscIssueRecords[0];
  if (!issue) return;
  selectedTscIssueId = issue.issueId;
  const assignments = tscIssueAssignments(issue.issueId);
  const issueType = tscIssueCommunicationType(issue);
  const typeLabel = tscCommunicationTypeDisplayName(issueType);
  const progress = tscIssueProgress(issue);
  const completed = assignments.filter((assignment) => assignment.status === "Completed" || assignment.completedAt || assignment.completedDateTime);
  const viewed = assignments.filter((assignment) => assignment.viewedAt || assignment.openedAt || assignment.openedDateTime || completed.includes(assignment));
  const outstanding = assignments.filter((assignment) => issueType === TSC_ANNOUNCEMENT_COMMUNICATION_TYPE && issue.acknowledgementRequired !== true
    ? !viewed.includes(assignment)
    : !completed.includes(assignment));
  const employeeName = (assignment) => {
    const staff = staffProfiles.find((profile) => profile.staffId === assignment.staffId || profile.staffId === assignment.employeeId) || {};
    return staff.name || assignment.employeeName || assignment.staffName || assignment.employeeId || "Employee";
  };
  document.querySelector("#tscDetailTitle").textContent = issue.title || typeLabel;
  const outstandingHeading = document.querySelector("#tscOutstandingHeading");
  const completedHeading = document.querySelector("#tscCompletedHeading");
  if (outstandingHeading) outstandingHeading.textContent = issueType === TSC_ANNOUNCEMENT_COMMUNICATION_TYPE ? "Outstanding Recipients" : "Outstanding Employees";
  if (completedHeading) completedHeading.textContent = issueType === TSC_ANNOUNCEMENT_COMMUNICATION_TYPE ? "Announcement Results" : "Completed Employees";
  document.querySelector("#tscDetailDescription").textContent = issueType === TSC_ANNOUNCEMENT_COMMUNICATION_TYPE
    ? `${progress.sent} sent, ${progress.received} received, ${progress.viewed} viewed, ${progress.acknowledged} acknowledged, ${progress.outstanding} outstanding.`
    : `${progress.assigned} assigned, ${progress.completed} completed, ${progress.outstanding} outstanding.`;
  document.querySelector("#tscDetailSummary").innerHTML = `
    <article><span>Type</span><strong>${escapeHtml(typeLabel)}</strong></article>
    <article><span>Audience</span><strong>${escapeHtml(issue.audience || "-")}</strong></article>
    <article><span>Issue Date</span><strong>${escapeHtml(issue.issueDate ? formatDateUk(issue.issueDate) : "-")}</strong></article>
    <article><span>Due Date</span><strong>${escapeHtml(issue.dueDate ? formatDateUk(issue.dueDate) : "-")}</strong></article>
    <article><span>Sent</span><strong>${escapeHtml(String(progress.sent || progress.assigned || 0))}</strong></article>
    <article><span>Received</span><strong>${escapeHtml(String(progress.received || 0))}</strong></article>
    <article><span>Viewed</span><strong>${escapeHtml(String(progress.viewed || 0))}</strong></article>
    <article><span>${escapeHtml(issueType === TSC_ANNOUNCEMENT_COMMUNICATION_TYPE ? "Acknowledged" : "Completed")}</span><strong>${escapeHtml(String(progress.completed))}</strong></article>
    <article><span>Outstanding</span><strong>${escapeHtml(String(progress.outstanding))}</strong></article>
    <article><span>Status</span><strong>${escapeHtml(tscIssueOperationalStatus(issue))}</strong></article>
  `;
  const outstandingTarget = document.querySelector("#tscOutstandingEmployees");
  if (outstandingTarget) {
    outstandingTarget.innerHTML = outstanding.length
      ? outstanding.map((assignment) => `<span>${escapeHtml(employeeName(assignment))}<b>${escapeHtml(assignment.status || "Not Started")}</b></span>`).join("")
      : "No outstanding employees.";
  }
  const completedTarget = document.querySelector("#tscCompletedEmployees");
  if (completedTarget) {
    const results = issueType === TSC_ANNOUNCEMENT_COMMUNICATION_TYPE ? assignments : completed;
    const timestamp = (assignment) => assignment.completedAt || assignment.completedDateTime || assignment.viewedAt || assignment.openedAt || assignment.openedDateTime || assignment.receivedAt || assignment.sentAt || assignment.assignedDateTime || "";
    const statusLabel = (assignment) => {
      if (assignment.completedAt || assignment.completedDateTime || assignment.status === "Completed") return issue.acknowledgementRequired === true ? "Acknowledged" : "Viewed";
      if (assignment.viewedAt || assignment.openedAt || assignment.openedDateTime) return "Viewed";
      if (assignment.receivedAt) return "Received";
      if (assignment.sentAt || assignment.assignedDateTime) return "Sent";
      return "Outstanding";
    };
    completedTarget.innerHTML = results.length
      ? results.map((assignment) => `<span>${escapeHtml(employeeName(assignment))}<b>${escapeHtml(statusLabel(assignment))}${timestamp(assignment) ? ` - ${escapeHtml(new Date(timestamp(assignment)).toLocaleString("en-GB"))}` : ""}</b></span>`).join("")
      : "No completed employees.";
  }
  const evidenceTarget = document.querySelector("#tscManageEvidenceTableBody");
  if (evidenceTarget) {
    const issueEvidence = assignments.flatMap((assignment) => tscEvidenceForAssignment(assignment.assignmentId)
      .map((record) => ({ ...record, employeeName: employeeName(assignment) })));
    evidenceTarget.innerHTML = issueEvidence.map((record) => `
      <tr>
        <td>${escapeHtml(record.employeeName || "-")}</td>
        <td>${escapeHtml(record.evidenceType || "-")}</td>
        <td>${tscStatusPill(record.evidenceStatus || "Pending")}</td>
        <td>${escapeHtml(record.submittedDateTime ? new Date(record.submittedDateTime).toLocaleString("en-GB") : "-")}</td>
        <td>${escapeHtml(record.result || record.passFail || "-")}</td>
      </tr>
    `).join("") || '<tr><td colspan="5">No evidence recorded yet.</td></tr>';
  }
}

function openTscContentEditor(item = null, requestedCommunicationType = TSC_TOOLBOX_TALK_COMMUNICATION_TYPE) {
  if (item && !tscContentCanEdit(item)) {
    kcInfo("Published and archived revisions are read-only. Create a future revision instead of editing historical evidence.");
    return;
  }
  const form = document.querySelector("#tscContentEditor");
  if (!form) return;
  const communicationType = item ? tscCommunicationTypeForContent(item) : requestedCommunicationType;
  const typeLabel = tscCommunicationTypeDisplayName(communicationType);
  const isAnnouncement = communicationType === TSC_ANNOUNCEMENT_COMMUNICATION_TYPE;
  form.hidden = false;
  document.querySelector("#tscContentIdInput").value = item?.contentId || "";
  document.querySelector("#tscCommunicationTypeInput").value = communicationType;
  document.querySelector("#tscTitleInput").value = item?.title || "";
  document.querySelector("#tscDocumentIdInput").value = item?.documentId || (isAnnouncement ? tscId("ANN") : "");
  document.querySelector("#tscRevisionInput").value = item?.revision || "Rev A";
  document.querySelector("#tscCategoryInput").value = item?.category || "";
  document.querySelector("#tscDocumentOwnerInput").value = item?.documentOwner || "";
  document.querySelector("#tscDepartmentInput").value = item?.department || "";
  document.querySelector("#tscApplicableRolesInput").value = item?.applicableRoles || "";
  document.querySelector("#tscReviewFrequencyInput").value = item?.reviewFrequency || "";
  document.querySelector("#tscEffectiveDateInput").value = item?.effectiveDate || "";
  document.querySelector("#tscReviewDateInput").value = item?.reviewDate || "";
  document.querySelector("#tscLinkedRiskInput").value = item?.linkedRiskAssessment || "";
  document.querySelector("#tscLinkedMethodInput").value = item?.linkedMethodStatement || "";
  document.querySelector("#tscLinkedCompetencyInput").value = item?.linkedCompetency || "";
  document.querySelector("#tscKeywordsInput").value = item?.keywords || "";
  document.querySelector("#tscSourceDocumentInput").value = item?.sourceDocument || "";
  document.querySelector("#tscAuthorInput").value = item?.author || currentUserName();
  document.querySelector("#tscSummaryInput").value = item?.summary || "";
  document.querySelector("#tscFullContentInput").value = item?.fullContent || "";
  const effectiveLabel = document.querySelector("#tscEffectiveDateLabel");
  const reviewLabel = document.querySelector("#tscReviewDateLabel");
  const fullContentLabel = document.querySelector("#tscFullContentLabel");
  if (effectiveLabel) effectiveLabel.textContent = isAnnouncement ? "Published Date" : "Effective Date";
  if (reviewLabel) reviewLabel.textContent = isAnnouncement ? "Expiry Date (optional)" : "Review Date";
  if (fullContentLabel) fullContentLabel.textContent = isAnnouncement ? "Message Body" : "Full Content";
  document.querySelector("#tscCategoryInput").placeholder = isAnnouncement ? "Office Notice" : "";
  document.querySelector("#tscDocumentIdInput").placeholder = isAnnouncement ? "Generated automatically" : "";
  form.querySelectorAll("[data-tsc-content-save-draft], [data-tsc-content-submit]").forEach((button) => {
    if (button.dataset.tscContentSaveDraft !== undefined) button.textContent = isAnnouncement ? "Save Announcement Draft" : "Save Draft";
    if (button.dataset.tscContentSubmit !== undefined) button.textContent = isAnnouncement ? "Submit Announcement" : "Submit for Approval";
  });
  document.querySelector("#tscTitleInput").focus();
}

function openTscAnnouncementEditor(item = null) {
  if (item && !tscContentCanEdit(item)) {
    kcInfo("Published and archived announcements are read-only.");
    return;
  }
  const form = document.querySelector("#tscAnnouncementEditor");
  if (!form) return;
  form.hidden = false;
  document.querySelector("#tscContentEditor").hidden = true;
  document.querySelector("#tscIssueWizard").hidden = true;
  document.querySelector("#tscAnnouncementContentIdInput").value = item?.contentId || "";
  document.querySelector("#tscAnnouncementTitleInput").value = item?.title || "";
  document.querySelector("#tscAnnouncementMessageInput").value = item?.fullContent || item?.message || "";
  document.querySelector("#tscAnnouncementExpiryInput").value = item?.reviewDate || item?.expiryDate || "";
  document.querySelector("#tscAnnouncementAckInput").value = item?.acknowledgementRequired === false ? "No" : "Yes";
  document.querySelector("#tscAnnouncementAudienceInput").value = item?.audience || "All Technicians";
  populateTscAnnouncementSelectedTechnicianOptions(item?.selectedStaffIds || []);
  document.querySelector("#tscAnnouncementEditorTitle").textContent = item?.contentId ? "Edit Announcement Draft" : "New Announcement";
  updateTscAnnouncementConfirmation();
  document.querySelector("#tscAnnouncementTitleInput").focus();
}

async function saveTscAnnouncement(status = "Draft") {
  const existingId = document.querySelector("#tscAnnouncementContentIdInput")?.value || "";
  const contentId = existingId || tscId("ANN");
  const existing = existingId ? tscContentById(existingId) : null;
  if (existing && !tscContentCanEdit(existing)) {
    await kcInfo("Published and archived announcements are read-only.");
    return null;
  }
  const title = document.querySelector("#tscAnnouncementTitleInput")?.value.trim() || "";
  const message = document.querySelector("#tscAnnouncementMessageInput")?.value.trim() || "";
  const expiryDate = document.querySelector("#tscAnnouncementExpiryInput")?.value || "";
  const audience = document.querySelector("#tscAnnouncementAudienceInput")?.value || "All Technicians";
  const acknowledgementRequired = (document.querySelector("#tscAnnouncementAckInput")?.value || "Yes") === "Yes";
  const selectedStaffIds = audience === "Selected Technicians" ? tscAnnouncementSelectedTechnicianIds() : [];
  if (!title || !message) {
    await kcInfo("Please add an announcement title and message.");
    return null;
  }
  if (audience === "Selected Technicians" && !selectedStaffIds.length) {
    await kcInfo("Please select at least one technician.");
    return null;
  }
  if (expiryDate && expiryDate < today) {
    await kcInfo("Expiry date cannot be in the past.");
    return null;
  }
  const now = new Date().toISOString();
  const previous = existing ? { ...existing } : null;
  const record = {
    ...(existing || {}),
    contentId,
    communicationType: TSC_ANNOUNCEMENT_COMMUNICATION_TYPE,
    type: "Announcement",
    title,
    documentId: existing?.documentId || contentId,
    revision: existing?.revision || "Rev A",
    category: "Office Announcement",
    documentOwner: "Office",
    department: "Operations",
    applicableRoles: audience,
    reviewFrequency: "",
    effectiveDate: existing?.effectiveDate || today,
    reviewDate: expiryDate,
    linkedRiskAssessment: "",
    linkedMethodStatement: "",
    linkedCompetency: "",
    keywords: "announcement",
    sourceDocument: "",
    audience,
    selectedStaffIds,
    acknowledgementRequired,
    summary: title,
    fullContent: message,
    status,
    author: existing?.author || currentUserName(),
    createdAt: existing?.createdAt || now,
    lastUpdated: now
  };
  if (existing) {
    tscMasterContent = tscMasterContent.map((item) => item.contentId === contentId ? record : item);
    tscAudit("Announcement Updated", record, { previousValue: previous, newValue: record });
  } else {
    tscMasterContent.unshift(record);
    tscAudit("Announcement Created", record, { newValue: record });
  }
  if (tscContentIsPublished(record)) {
    const published = tscEnsurePublishedRevisionForContent(record);
    if (published) {
      record.publishedRevisionId = published.revisionId;
      tscMasterContent = tscMasterContent.map((item) => item.contentId === contentId ? record : item);
    }
  }
  const saved = await saveCommandData();
  renderTscModule();
  await kcInfo(saved
    ? (status === "Draft" ? "Announcement draft saved." : "Announcement saved.")
    : "Announcement has not been safely saved yet. A local backup is pending.");
  return record;
}

async function sendTscAnnouncement() {
  const record = await saveTscAnnouncement("Published");
  if (!record) return;
  const audience = record.audience || "All Technicians";
  const staff = audience === "Selected Technicians"
    ? tscEligibleStaffForAudience("All Technicians").filter((person) => new Set(record.selectedStaffIds || []).has(person.staffId))
    : tscEligibleStaffForAudience("All Technicians");
  if (!staff.length) {
    await kcInfo("No active technicians match this announcement audience.");
    return;
  }
  const now = new Date().toISOString();
  const published = tscEnsurePublishedRevisionForContent(record);
  if (published && record.publishedRevisionId !== published.revisionId) {
    record.publishedRevisionId = published.revisionId;
    tscMasterContent = tscMasterContent.map((item) => item.contentId === record.contentId ? record : item);
  }
  const issue = {
    issueId: tscId("TSC-ISS"),
    contentId: record.contentId,
    publishedRevisionId: published?.revisionId || "",
    title: record.title,
    documentId: record.documentId,
    revision: record.revision,
    audience,
    selectedStaffIds: audience === "Selected Technicians" ? staff.map((person) => person.staffId) : [],
    issueDate: today,
    dueDate: record.reviewDate || "",
    expiresAt: record.reviewDate || "",
    acknowledgementRequired: record.acknowledgementRequired === true,
    dailyReminder: false,
    notes: "",
    status: "Issued",
    issuedBy: currentUserName(),
    issuedAt: now,
    createdAt: now,
    updatedAt: now
  };
  const auditId = tscAudit("Announcement Issued", issue, { newValue: issue, notes: `${staff.length} recipient${staff.length === 1 ? "" : "s"} frozen.` });
  issue.auditEventId = auditId;
  const assignments = staff.map((person) => ({
    assignmentId: tscId("TSC-ASG"),
    issueId: issue.issueId,
    issueCampaignId: issue.issueId,
    contentId: record.contentId,
    publishedRevisionId: published?.revisionId || "",
    staffId: person.staffId,
    employeeId: person.staffId,
    employeeName: person.name,
    assignedDateTime: now,
    sentAt: now,
    dueDate: record.reviewDate || "",
    status: "Not Started",
    priority: "Normal",
    assignmentSource: "Announcement",
    assignedBy: currentUserName(),
    acknowledgementRequired: record.acknowledgementRequired === true,
    auditEventId: auditId
  }));
  tscIssueRecords.unshift(issue);
  tscAssignmentRecords.unshift(...assignments);
  document.querySelector("#tscAnnouncementEditor").hidden = true;
  selectedTscIssueId = issue.issueId;
  const detailPanel = document.querySelector("[data-tsc-communication-detail]");
  if (detailPanel) detailPanel.hidden = false;
  const saved = await saveCommandData();
  renderTscModule();
  await kcInfo(saved
    ? "Announcement sent. Results are now available in Communications."
    : "Announcement has not been safely saved yet. A local backup is pending.");
}

async function viewTscContent(contentId) {
  const item = tscContentById(contentId);
  if (!item) return;
  await kcInfo(`${item.title || "Toolbox Talk"}\n\nStatus: ${item.status || "Draft"}\nRevision: ${item.revision || "-"}\n\n${item.summary || item.fullContent || "No content added."}`);
}

function cloneTscContent(contentId) {
  const item = tscContentById(contentId);
  if (!item) return;
  const clone = {
    ...item,
    contentId: "",
    communicationType: tscCommunicationTypeForContent(item),
    title: `${item.title || tscCommunicationTypeDisplayName(tscCommunicationTypeForContent(item))} copy`,
    documentId: "",
    revision: "Rev A",
    status: "Draft"
  };
  openTscContentEditor(clone);
}

function updateTscIssueConfirmation() {
  const content = tscContentById(document.querySelector("#tscIssueContentIdInput")?.value || "");
  const communicationType = tscCommunicationTypeForContent(content || {});
  const typeLabel = tscCommunicationTypeDisplayName(communicationType);
  const audience = document.querySelector("#tscIssueAudienceInput")?.value || "All Technicians";
  const issueDate = document.querySelector("#tscIssueDateInput")?.value || today;
  const dueDate = document.querySelector("#tscIssueDueDateInput")?.value || "";
  const selectedStaffLabel = document.querySelector("#tscIssueSelectedStaffLabel");
  if (selectedStaffLabel) selectedStaffLabel.hidden = audience !== "Selected Technicians";
  if (audience === "Selected Technicians") populateTscSelectedTechnicianOptions(tscSelectedTechnicianIds());
  const staff = tscEligibleStaffForIssueAudience(audience);
  const target = document.querySelector("#tscIssueConfirmation");
  if (!target) return;
  target.innerHTML = `
    <strong>${escapeHtml(content?.title || typeLabel)}</strong><br>
    This will issue to <strong>${escapeHtml(String(staff.length))}</strong> employee${staff.length === 1 ? "" : "s"} in <strong>${escapeHtml(audience)}</strong>.<br>
    Issue date: ${escapeHtml(issueDate ? formatDateUk(issueDate) : "Not set")} | Due date: ${escapeHtml(dueDate ? formatDateUk(dueDate) : "Not set")}
  `;
}

async function openTscIssueWizard(contentId) {
  const item = tscContentById(contentId);
  const typeValidation = tscValidateCommunicationType(tscCommunicationTypeForContent(item || {}));
  if (!item || !tscContentIsPublished(item) || !typeValidation.ok) {
    await kcInfo("Only published communications can be issued.");
    return;
  }
  const communicationType = typeValidation.definition.communicationType;
  const typeLabel = typeValidation.definition.displayName;
  const isAnnouncement = communicationType === TSC_ANNOUNCEMENT_COMMUNICATION_TYPE;
  const published = tscPublishedForContent(contentId);
  if (!published) {
    await kcInfo(`Publish this ${typeLabel} before issuing it.`);
    return;
  }
  const form = document.querySelector("#tscIssueWizard");
  if (!form) return;
  form.hidden = false;
  document.querySelector("#tscIssueContentIdInput").value = contentId;
  document.querySelector("#tscIssueWizardTitle").textContent = `Issue ${item.title || typeLabel}`;
  document.querySelector("#tscIssueWizardSummary").textContent = `${item.documentId || "Document"} ${item.revision || ""} is ready to issue.`;
  document.querySelector("#tscIssueAudienceInput").value = "All Technicians";
  populateTscSelectedTechnicianOptions();
  document.querySelector("#tscIssueSelectedStaffLabel").hidden = true;
  document.querySelector("#tscIssueDateInput").value = today;
  document.querySelector("#tscIssueDueDateInput").value = isAnnouncement ? (item.reviewDate || "") : today;
  document.querySelector("#tscIssueReminderInput").value = "Yes";
  document.querySelector("#tscIssueAckLabel").textContent = isAnnouncement ? "Acknowledgement Required" : "Daily Reminder";
  document.querySelector("#tscIssueDueDateLabel").textContent = isAnnouncement ? "Expiry / Action Date" : "Due Date";
  document.querySelector("#tscIssueNotesInput").value = "";
  updateTscIssueConfirmation();
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function saveTscContent(status) {
  const contentId = document.querySelector("#tscContentIdInput").value || tscId("TSC-DOC");
  const existing = tscContentById(contentId);
  if (existing && !tscContentCanEdit(existing)) {
    await kcInfo("Published and archived revisions are read-only. Create a future revision instead of editing historical evidence.");
    return;
  }
  const now = new Date().toISOString();
  const title = document.querySelector("#tscTitleInput").value.trim();
  const fullContent = document.querySelector("#tscFullContentInput").value.trim();
  if (!title || !fullContent) {
    await kcInfo("Please add a document title and full content.");
    return;
  }
  const previous = existing ? { ...existing } : null;
  const requestedCommunicationType = tscNormaliseCommunicationType(document.querySelector("#tscCommunicationTypeInput")?.value || TSC_TOOLBOX_TALK_COMMUNICATION_TYPE);
  const existingCommunicationType = existing ? tscCommunicationTypeForContent(existing) : requestedCommunicationType;
  const typeValidation = tscValidateCommunicationType(existingCommunicationType);
  if (!typeValidation.ok) {
    await kcInfo("This controlled communication type is not available.");
    return;
  }
  const typeLabel = tscCommunicationTypeDisplayName(existingCommunicationType);
  const record = {
    ...(existing || {}),
    contentId,
    communicationType: existingCommunicationType,
    type: typeLabel,
    title,
    documentId: document.querySelector("#tscDocumentIdInput").value.trim() || contentId,
    revision: document.querySelector("#tscRevisionInput").value.trim() || "Rev A",
    category: document.querySelector("#tscCategoryInput").value.trim(),
    documentOwner: document.querySelector("#tscDocumentOwnerInput").value.trim(),
    department: document.querySelector("#tscDepartmentInput").value.trim(),
    applicableRoles: document.querySelector("#tscApplicableRolesInput").value.trim(),
    reviewFrequency: document.querySelector("#tscReviewFrequencyInput").value.trim(),
    effectiveDate: document.querySelector("#tscEffectiveDateInput").value,
    reviewDate: document.querySelector("#tscReviewDateInput").value,
    linkedRiskAssessment: document.querySelector("#tscLinkedRiskInput").value.trim(),
    linkedMethodStatement: document.querySelector("#tscLinkedMethodInput").value.trim(),
    linkedCompetency: document.querySelector("#tscLinkedCompetencyInput").value.trim(),
    keywords: document.querySelector("#tscKeywordsInput").value.trim(),
    sourceDocument: document.querySelector("#tscSourceDocumentInput").value.trim(),
    summary: document.querySelector("#tscSummaryInput").value.trim(),
    fullContent,
    status,
    author: document.querySelector("#tscAuthorInput").value.trim() || currentUserName(),
    lastUpdated: now,
    createdAt: existing?.createdAt || now
  };
  if (existing) {
    tscMasterContent = tscMasterContent.map((item) => item.contentId === contentId ? record : item);
    tscAudit(status === "Submitted for Approval" ? "Document Submitted" : "Document Updated", record, { previousValue: previous, newValue: record });
  } else {
    tscMasterContent.unshift(record);
    tscAudit("Document Created", record, { newValue: record });
  }
  document.querySelector("#tscContentEditor").hidden = true;
  const saved = await saveCommandData();
  renderTscModule();
  await kcInfo(saved
    ? (status === "Draft" ? `${typeLabel} saved as draft.` : `${typeLabel} submitted for approval.`)
    : `${typeLabel} has not been safely saved yet. A local backup is pending.`);
}

async function updateTscContentStatus(contentId, status) {
  const item = tscContentById(contentId);
  if (!item) return;
  if (tscContentIsPublished(item) && status !== "Archived") {
    await kcInfo("Published revisions are read-only. Create a future revision instead of editing historical evidence.");
    return;
  }
  const previous = { ...item };
  tscMasterContent = tscMasterContent.map((content) => content.contentId === contentId
    ? { ...content, status, lastUpdated: new Date().toISOString() }
    : content);
  const updated = tscContentById(contentId);
  const action = status === "Approved" ? "Document Approved" : status === "Archived" ? "Document Archived" : "Document Updated";
  tscAudit(action, updated, { previousValue: previous, newValue: updated });
  const saved = await saveCommandData();
  renderTscModule();
  await kcInfo(saved
    ? (status === "Approved" ? "Controlled document approved." : "Controlled document archived.")
    : "Controlled document update has not been safely saved yet. A local backup is pending.");
}

async function publishTscContent(contentId) {
  const item = tscContentById(contentId);
  if (!item || item.status !== "Approved") {
    await kcInfo("Only approved documents can be published.");
    return;
  }
  const duplicate = tscPublishedRevisions.some((revision) =>
    revision.documentId === item.documentId && revision.revisionNumber === item.revision
  );
  if (duplicate) {
    await kcInfo("This document revision has already been published. Historical published revisions cannot be overwritten.");
    return;
  }
  const now = new Date().toISOString();
  const published = tscEnsurePublishedRevisionForContent({ ...item, status: "Published" });
  tscMasterContent = tscMasterContent.map((content) => content.contentId === contentId
    ? { ...content, status: "Published", lastUpdated: now, publishedRevisionId: published?.revisionId || "" }
    : content);
  tscAudit("Document Published", published, { newValue: published, notes: "Published revision created as read-only evidence." });
  selectedTscIssueId = published.revisionId;
  const detailPanel = document.querySelector("[data-tsc-communication-detail]");
  if (detailPanel) detailPanel.hidden = false;
  const saved = await saveCommandData();
  renderTscModule();
  await kcInfo(saved
    ? "Controlled document published. The published revision is now read-only."
    : "Published revision has not been safely saved yet. A local backup is pending.");
}

async function saveTscIssue() {
  if (tscIssueSaveInProgress) return;
  const contentId = document.querySelector("#tscIssueContentIdInput")?.value || "";
  const item = tscContentById(contentId);
  const published = tscPublishedForContent(contentId);
  const typeValidation = tscValidateCommunicationType(tscCommunicationTypeForContent(item || {}));
  if (!item || !tscContentIsPublished(item) || !published || !typeValidation.ok) {
    await kcInfo("Only published communications can be issued.");
    return;
  }
  const communicationType = typeValidation.definition.communicationType;
  const typeLabel = typeValidation.definition.displayName;
  const isAnnouncement = communicationType === TSC_ANNOUNCEMENT_COMMUNICATION_TYPE;
  const audience = document.querySelector("#tscIssueAudienceInput")?.value || "All Technicians";
  const issueDate = document.querySelector("#tscIssueDateInput")?.value || today;
  const dueDate = document.querySelector("#tscIssueDueDateInput")?.value || "";
  const yesNoFlag = (document.querySelector("#tscIssueReminderInput")?.value || "Yes") === "Yes";
  const notes = document.querySelector("#tscIssueNotesInput")?.value.trim() || "";
  const staff = tscEligibleStaffForIssueAudience(audience);
  if (!dueDate && !isAnnouncement) {
    await kcInfo("Please choose a due date before issuing.");
    return;
  }
  if (dueDate && dueDate < issueDate) {
    await kcInfo("Due date cannot be before the issue date.");
    return;
  }
  if (!staff.length) {
    await kcInfo("No employees match that audience yet.");
    return;
  }
  const saveButton = document.querySelector("[data-tsc-issue-save]");
  tscIssueSaveInProgress = true;
  if (saveButton) saveButton.disabled = true;
  try {
    const now = new Date().toISOString();
    const issue = {
      issueId: tscId("TSC-ISS"),
      contentId,
      publishedRevisionId: published.revisionId,
      title: item.title,
      documentId: item.documentId,
      revision: item.revision,
      audience,
      selectedStaffIds: audience === "Selected Technicians" ? staff.map((person) => person.staffId) : [],
      issueDate,
      dueDate,
      dailyReminder: isAnnouncement ? false : yesNoFlag,
      acknowledgementRequired: isAnnouncement ? yesNoFlag : true,
      expiresAt: isAnnouncement ? (dueDate || item.reviewDate || "") : "",
      notes,
      status: "Issued",
      issuedBy: currentUserName(),
      issuedAt: now,
      createdAt: now,
      updatedAt: now
    };
    const auditId = tscAudit("Toolbox Talk Issued", issue, { newValue: issue, notes: `${staff.length} assignment${staff.length === 1 ? "" : "s"} created.` });
    issue.auditEventId = auditId;
    const assignments = staff.map((person) => ({
      assignmentId: tscId("TSC-ASG"),
      issueId: issue.issueId,
      issueCampaignId: issue.issueId,
      contentId,
      publishedRevisionId: published.revisionId,
      staffId: person.staffId,
      employeeId: person.staffId,
      employeeName: person.name,
      assignedDateTime: now,
      dueDateTime: `${dueDate}T17:00:00.000Z`,
      dueDate,
      status: "Not Started",
      priority: "Normal",
      assignmentSource: typeLabel,
      assignedBy: currentUserName(),
      dailyReminder: isAnnouncement ? false : yesNoFlag,
      acknowledgementRequired: isAnnouncement ? yesNoFlag : true,
      lastReminderDate: "",
      auditEventId: auditId
    }));
    tscIssueRecords.unshift(issue);
    tscAssignmentRecords.unshift(...assignments);
    document.querySelector("#tscIssueWizard").hidden = true;
    selectedTscIssueId = issue.issueId;
    const detailPanel = document.querySelector("[data-tsc-communication-detail]");
    if (detailPanel) detailPanel.hidden = false;
    const saved = await saveCommandData();
    renderTscModule();
    await kcInfo(saved
      ? `${typeLabel} issued. Progress is now available in Communications.`
      : `${typeLabel} has not been safely saved yet. A local backup is pending.`);
  } finally {
    tscIssueSaveInProgress = false;
    if (saveButton) saveButton.disabled = false;
  }
}

function render() {
  normalisePlannerItems();
  syncAttendanceFromPlanner();
  syncStaffTrainingFromMatrix();
  syncTechniciansFromStaff();
  refreshTechnicianDropdowns();
  syncValuationsFromJobs();
  renderSummary();
  renderDashboard();
  renderAdminCentre();
  renderRamsTable();
  renderCompliance();
  renderFines();
  renderStaff();
  renderHolidayPlanner();
  renderTrainingMatrix();
  renderJobs();
  renderPlanner();
  renderValuations();
  renderVehicles();
  renderAssets();
  renderCompanyDocuments();
  renderCards("#clientsGrid", clients);
  renderCards("#settingsGrid", settings);
  renderSettingsDetail();
  renderSetupActions();
  renderTechnicians();
  renderTracking();
  renderSplitScreen();
  renderHistory();
  renderNotifications();
  renderProofingReports();
  renderTscModule();
  updateProofingPreview();
  applyReviewModeShell();
  maskReviewModeSensitiveSections();
}

function openDialog(item = null) {
  document.querySelector("#dialogTitle").textContent = item ? "Edit RAMS Record" : "Add Existing RAMS Record";
  fields.id.value = item?.id || "";
  fields.title.value = item?.title || "";
  fields.client.value = item?.client || "";
  fields.job.value = item?.job || "";
  populateTechnicianSelect(fields.technician, item?.technician || "N/A");
  fields.status.value = normaliseRamsStatus(item || { status: "draft" });
  fields.sentDate.value = item?.sentDate || "";
  fields.techSentDate.value = item?.techSentDate || "";
  fields.techReadDate.value = item?.techReadDate || "";
  fields.reviewDate.value = item?.reviewDate || "";
  fields.fileLocation.value = item?.fileLocation || "";
  fields.notes.value = item?.notes || "";
  dialog.showModal();
}

function openRamsBuilder(item = null) {
  const source = item?.builderSource || {};
  activeBuiltRamsId = item?.id || "";
  ramsBuildClient.value = source.client || "";
  ramsBuildJobRef.value = source.jobRef || "";
  ramsBuildAddress.value = source.address || "";
  ramsBuildPostcode.value = source.postcode || "";
  populateTechnicianSelect(ramsBuildTechnician, source.technician || "N/A");
  ramsBuildDate.value = source.date || today;
  ramsBuildTitle.value = source.title || "";
  ramsBuildScope.value = source.scope || "";
  ramsBuildSource.value = source.source || "";
  ramsBuildPpe.value = source.ppe || "";
  ramsBuildEquipment.value = source.equipment || "";
  aiRamsStatus.textContent = item ? "Editing existing RAMS. Review, regenerate and save the revised version." : "";
  ramsBuilderPreview.innerHTML = item?.generatedHtml
    ? item.generatedHtml
    : '<p class="empty-state">Paste or type the job information on the left. The preview will update here automatically.</p>';
  if (!item) refreshRamsLivePreview();
  ramsBuilderDialog.showModal();
}

function saveFromForm() {
  const item = {
    id: fields.id.value || crypto.randomUUID(),
    title: fields.title.value.trim(),
    client: fields.client.value.trim(),
    job: fields.job.value.trim(),
    technician: fields.technician.value || "N/A",
    status: fields.status.value,
    sentDate: fields.sentDate.value,
    techSentDate: fields.techSentDate.value,
    techReadDate: fields.techReadDate.value,
    reviewDate: fields.reviewDate.value,
    fileLocation: fields.fileLocation.value.trim(),
    notes: fields.notes.value.trim()
  };

  if ((item.status === "sent" || item.status === "sent-client") && !item.sentDate) {
    item.sentDate = new Date().toISOString().slice(0, 10);
  }
  const existingIndex = ramsItems.findIndex((rams) => rams.id === item.id);
  if (existingIndex >= 0) {
    ramsItems[existingIndex] = item;
  } else {
    ramsItems.unshift(item);
  }

  saveRams();
  render();
}

function isDirectorLocalUser(name = currentUserName()) {
  return ["Kevin", "Alex"].includes(String(name || ""));
}

function syncDirectorsMenuVisibility() {
  document.querySelectorAll(".director-only-nav").forEach((button) => {
    button.classList.toggle("hidden", !isDirectorLocalUser());
  });
}

async function directorsApi(path, options = {}) {
  const authGeneration = directorAuthGeneration;
  const response = await fetch(`/api/phase-10${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(directorSession?.csrfToken ? { "X-CSRF-Token": directorSession.csrfToken } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (authGeneration !== directorAuthGeneration) throw new Error("Sign-in changed. Please try again.");
  if (!response.ok || body.ok === false) {
    if (path !== "/director-login" && [401, 403].includes(response.status)) lockHub();
    throw new Error(body.message || "Directors Area request failed.");
  }
  return body;
}

function directorsSetStatus(message) {
  const status = document.querySelector("#directorsStatus");
  if (status) status.textContent = message;
}

function showDirectorsLocked(message = "") {
  document.querySelector("#directorsLockPanel")?.classList.remove("hidden");
  document.querySelector("#directorsWorkspace")?.classList.add("hidden");
  const accessMessage = document.querySelector("#directorAccessMessage");
  if (accessMessage) accessMessage.textContent = message || "This area is restricted to Kevin Eastman and Alex Lancaster.";
}

function showDirectorsWorkspace() {
  document.querySelector("#directorsLockPanel")?.classList.add("hidden");
  document.querySelector("#directorsWorkspace")?.classList.remove("hidden");
}

async function refreshDirectorsArea() {
  if (!isDirectorLocalUser()) {
    showDirectorsLocked("Director access is restricted to Kevin and Alex.");
    return;
  }
  try {
    const session = await directorsApi("/director-session");
    acceptDirectorSession(session);
    directorsAreaState = await directorsApi("/overview");
    showDirectorsWorkspace();
    await renderDirectorsArea();
    directorsSetStatus(`Loaded ${new Date().toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}`);
  } catch (error) {
    directorsAreaState = null;
    showDirectorsLocked(error.message);
  }
}

function directorsMetric(label, value, detail = "", targetTab = "", focus = "") {
  const interactiveAttrs = targetTab
    ? ` role="button" tabindex="0" data-director-overview-tab="${escapeHtml(targetTab)}"${focus ? ` data-director-overview-focus="${escapeHtml(focus)}"` : ""}`
    : "";
  return `
    <article class="directors-metric${targetTab ? " directors-metric-action" : ""}"${interactiveAttrs}>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </article>
  `;
}

function directorsOverviewDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return formatDateUk(dateValue);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function directorsOverviewHolidayDateRange(request = {}) {
  const from = request.from || request.startDate || request.date || "";
  const to = request.to || request.endDate || from;
  if (!to || to === from) return directorsOverviewDate(from);
  return `${directorsOverviewDate(from)} to ${directorsOverviewDate(to)}`;
}

function directorsOverviewHolidayWorkingDays(request = {}) {
  const from = request.from || request.startDate || request.date || "";
  const to = request.to || request.endDate || from;
  const days = Number(request.workingDays || request.days || holidayCalculatedDays({ ...request, from, to }));
  return `${formatLeaveNumber(days)} working day${days === 1 ? "" : "s"}`;
}

function directorsOverviewUpcomingHolidays(requests = []) {
  const todayValue = localIsoDate();
  const limit = new Date(`${todayValue}T00:00:00`);
  limit.setDate(limit.getDate() + 90);
  const limitValue = localIsoDate(limit);
  return requests
    .filter((request) => {
      const from = String(request.from || request.startDate || request.date || "").slice(0, 10);
      return from && from >= todayValue && from <= limitValue;
    })
    .sort((a, b) => String(a.from || a.startDate || a.date || "").localeCompare(String(b.from || b.startDate || b.date || "")));
}

function directorsLiveHolidayRows() {
  return directorsOverviewUpcomingHolidays(holidayRequests.map((request, index) => ({ ...request, directorRecordIndex: index })))
    .map((request) => `
      <tr class="directors-live-row" role="button" tabindex="0" data-directors-holiday-index="${escapeHtml(request.directorRecordIndex)}">
        <td><strong>${escapeHtml(request.name || request.employee || "Employee")}</strong></td>
        <td>${escapeHtml(directorsOverviewHolidayDateRange(request))}</td>
        <td>${escapeHtml(directorsOverviewHolidayWorkingDays(request))}</td>
      </tr>
    `).join("");
}

function directorsDueStatus(dateValue = "", soonDays = 14) {
  const days = daysUntil(dateValue);
  if (days < 0) return { label: "Overdue", className: "urgent" };
  if (days <= soonDays) return { label: "Due soon", className: "warning" };
  return { label: "Upcoming", className: "neutral" };
}

function directorsVehicleDeadlineRows() {
  const limitValue = datePlusDays(localIsoDate(), 60);
  const rows = [];
  vehicles.map(asVehicleObject).forEach((vehicle) => {
    const vehicleId = vehicle.vehicleId || vehicle.id || "";
    [
      ["MOT", vehicle.mot],
      ["Service", vehicle.service],
      ["Insurance", vehicle.insurance]
    ].forEach(([requirement, dueDate]) => {
      if (!dueDate || String(dueDate).slice(0, 10) > limitValue) return;
      rows.push({ vehicle, vehicleId, requirement, dueDate: String(dueDate).slice(0, 10), status: directorsDueStatus(dueDate) });
    });
    vehicleDocumentsFor(vehicle).forEach((documentRecord) => {
      const dueDate = String(documentRecord.expiryDate || "").slice(0, 10);
      if (!dueDate || documentRecord.noExpiry || dueDate > limitValue) return;
      rows.push({
        vehicle,
        vehicleId,
        requirement: documentRecord.documentType || documentRecord.title || "Vehicle document",
        dueDate,
        status: directorsDueStatus(dueDate)
      });
    });
    vehicleMaintenanceFor(vehicle).forEach((record) => {
      const dueDate = String(record.followUpDate || "").slice(0, 10);
      if (!dueDate || dueDate > limitValue) return;
      rows.push({
        vehicle,
        vehicleId,
        requirement: record.eventType ? `${record.eventType} follow-up` : "Maintenance follow-up",
        dueDate,
        status: directorsDueStatus(dueDate)
      });
    });
  });
  return rows
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((row) => `
      <tr class="directors-live-row" role="button" tabindex="0" data-directors-vehicle-id="${escapeHtml(row.vehicleId)}">
        <td><strong>${escapeHtml(row.vehicle.registration || "Vehicle")}</strong></td>
        <td>${escapeHtml(row.requirement)}</td>
        <td>${escapeHtml(directorsOverviewDate(row.dueDate))}</td>
        <td><span class="status ${row.status.className}">${escapeHtml(row.status.label)}</span></td>
      </tr>
    `).join("");
}

function directorsReportAge(job = {}) {
  const dateValue = String(job.date || "").slice(0, 10);
  if (!dateValue) return "-";
  const days = Math.max(0, daysUntil(dateValue) * -1);
  if (days === 0) return "Today";
  return `${days} day${days === 1 ? "" : "s"}`;
}

function directorsJobTechnicianNames(job = {}) {
  const fromObjects = Array.isArray(job.assignedTechnicians)
    ? job.assignedTechnicians.map((item) => item.name || item.technician || item.technicianName)
    : [];
  const fromNames = Array.isArray(job.technicians) ? job.technicians : [];
  const fromIds = Array.isArray(job.technicianIds)
    ? job.technicianIds.map((id) => staffProfiles.find((staff) => staff.technicianId === id || staff.staffId === id)?.name)
    : [];
  const names = [...fromObjects, ...fromNames, ...fromIds, job.technician]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return [...new Set(names)];
}

function directorsJobMatchesTechnician(job = {}, technicianName = "") {
  return directorsJobTechnicianNames(job).some((name) => name.toLowerCase() === String(technicianName || "").toLowerCase());
}

function directorsOutstandingReportItems(technicianName = "") {
  return jobs
    .map((job, index) => ({ job, index }))
    .filter(({ job }) => !technicianName || directorsJobMatchesTechnician(job, technicianName))
    .filter(({ job }) => !jobReportReceived(job) && (job.report === "Awaiting" || String(job.date || "") <= localIsoDate()))
    .map(({ job, index }) => ({
      job,
      index,
      overdue: String(job.date || "") < localIsoDate(),
      status: String(job.date || "") < localIsoDate() ? "Overdue" : "Report required"
    }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || String(a.job.date || "").localeCompare(String(b.job.date || "")));
}

function directorsOutstandingReportRows(technicianName = "") {
  return directorsOutstandingReportItems(technicianName)
    .map(({ job, index, status }) => `
      <tr class="directors-live-row" role="button" tabindex="0" data-directors-job-index="${escapeHtml(index)}">
        <td>${escapeHtml(job.technician || "Unassigned")}</td>
        <td><strong>${escapeHtml(job.number || job.reference || "No reference")}</strong></td>
        <td>${escapeHtml(job.client || job.address || job.title || "No customer/site")}</td>
        <td><span class="status ${status === "Overdue" ? "urgent" : "warning"}">${escapeHtml(status)}</span></td>
        <td>${escapeHtml(directorsReportAge(job))}</td>
      </tr>
    `).join("");
}

function directorsPerformancePeriodBounds(period = activeDirectorPerformancePeriod) {
  const now = new Date(`${localIsoDate()}T00:00:00`);
  if (period === "previous-month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: localIsoDate(start), end: localIsoDate(end) };
  }
  if (period === "this-year") {
    return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: localIsoDate(start), end: localIsoDate(end) };
}

function directorsPerformancePeriodOptions() {
  return [
    ["this-month", "This month"],
    ["previous-month", "Previous month"],
    ["this-year", "This year"]
  ].map(([value, label]) => `<option value="${value}"${activeDirectorPerformancePeriod === value ? " selected" : ""}>${label}</option>`).join("");
}

function directorsLabourSharesForJob(job = {}) {
  const techniciansForJob = directorsJobTechnicianNames(job);
  if (!techniciansForJob.length) return [];
  const totalPence = 22000;
  const basePence = Math.floor(totalPence / techniciansForJob.length);
  let remainder = totalPence - (basePence * techniciansForJob.length);
  return techniciansForJob.map((name) => {
    const pence = basePence + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return { name, pence };
  });
}

function directorsTechnicianPerformanceRows() {
  const techniciansToShow = activeTechnicianAssignmentOptions();
  const bounds = directorsPerformancePeriodBounds();
  const sourceJobs = dashboardJobSource();
  const completedJobs = sourceJobs
    .filter(jobCompleted)
    .filter((job) => {
      const date = String(job.date || job.completedAt || job.reportSubmittedAt || "").slice(0, 10);
      return date && date >= bounds.start && date <= bounds.end;
    });
  const stats = techniciansToShow.map((staff) => ({
    name: staff.name,
    outstandingReports: directorsOutstandingReportItems(staff.name).length,
    completedJobs: 0,
    labourPence: 0
  }));
  const statsByName = new Map(stats.map((item) => [item.name.toLowerCase(), item]));
  completedJobs.forEach((job) => {
    directorsLabourSharesForJob(job).forEach((share) => {
      const stat = statsByName.get(share.name.toLowerCase());
      if (!stat) return;
      stat.completedJobs += 1;
      stat.labourPence += share.pence;
    });
  });
  const rankedStats = stats.sort((a, b) => b.labourPence - a.labourPence);
  const hasLabourValue = rankedStats.some((stat) => stat.labourPence > 0);
  let previousLabourPence = null;
  let previousPosition = 0;
  return rankedStats
    .map((stat, index) => {
      const leaguePosition = !hasLabourValue
        ? "-"
        : stat.labourPence === previousLabourPence
          ? previousPosition
          : index + 1;
      previousLabourPence = stat.labourPence;
      previousPosition = leaguePosition;
      return `
      <tr>
        <td>${escapeHtml(String(leaguePosition))}</td>
        <td><strong>${escapeHtml(stat.name)}</strong></td>
        <td>${stat.outstandingReports > 0
          ? `<button class="directors-report-count" type="button" data-directors-performance-reports="${escapeHtml(stat.name)}" aria-label="${escapeHtml(`${stat.name} has ${stat.outstandingReports} outstanding report${stat.outstandingReports === 1 ? "" : "s"}`)}">${escapeHtml(String(stat.outstandingReports))}</button>`
          : '<span class="directors-report-count-zero">0</span>'}</td>
        <td>${escapeHtml(String(stat.completedJobs))}</td>
        <td>${escapeHtml(money(stat.labourPence / 100))}</td>
      </tr>
    `;
    }).join("");
}

function renderDirectorsTechnicianPerformance() {
  const rows = directorsTechnicianPerformanceRows();
  const selectedRows = activeDirectorPerformanceTechnician ? directorsOutstandingReportRows(activeDirectorPerformanceTechnician) : "";
  return `
    <section class="directors-panel directors-live-section directors-performance-section">
      <div class="directors-performance-heading">
        <h3>Technician Performance</h3>
        <label>Period <select id="directorPerformancePeriodSelect">${directorsPerformancePeriodOptions()}</select></label>
      </div>
      <table class="compact-table directors-live-table directors-performance-table">
        <thead><tr><th>League position</th><th>Technician name</th><th>Outstanding reports</th><th>Completed jobs</th><th>Labour Value Generated</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">No active technicians found.</td></tr>'}</tbody>
      </table>
      ${activeDirectorPerformanceTechnician ? `
        <div class="directors-performance-reports" id="directorTechnicianOutstandingReports">
          <h4>${escapeHtml(activeDirectorPerformanceTechnician)} outstanding reports</h4>
          ${selectedRows ? `
            <table class="compact-table directors-live-table">
              <thead><tr><th>Technician</th><th>Job reference</th><th>Customer / site</th><th>Status</th><th>Age</th></tr></thead>
              <tbody>${selectedRows}</tbody>
            </table>
          ` : '<p class="empty-state compact-empty">No outstanding reports for this technician.</p>'}
        </div>
      ` : ""}
    </section>
  `;
}

function directorsLiveSection(title, emptyText, headers, rowsHtml) {
  return `
    <section class="directors-panel directors-live-section">
      <h3>${escapeHtml(title)}</h3>
      ${rowsHtml ? `
        <table class="compact-table directors-live-table">
          <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      ` : `<p class="empty-state compact-empty">${escapeHtml(emptyText)}</p>`}
    </section>
  `;
}

function renderDirectorsOverview() {
  const holidayRows = directorsLiveHolidayRows();
  const vehicleRows = directorsVehicleDeadlineRows();
  return `
    <div class="directors-live-overview">
      ${directorsLiveSection("Upcoming Staff Holidays", "No approved holidays within the next 90 days.", ["Employee", "Dates", "Working days"], holidayRows)}
      ${directorsLiveSection("Upcoming Vehicle Deadlines", "No vehicle deadlines within the next 60 days.", ["Vehicle", "Requirement", "Due date", "Status"], vehicleRows)}
      ${renderDirectorsTechnicianPerformance()}
    </div>
  `;
}

function activateDirectorsOverviewRow(row) {
  if (!row) return false;
  if (row.dataset.directorsHolidayIndex) {
    openHolidayPlannerRecord(row.dataset.directorsHolidayIndex);
    return true;
  }
  if (row.dataset.directorsVehicleId) {
    showSection("vehicles");
    renderVehicles();
    renderVehicleRecordDetail(row.dataset.directorsVehicleId);
    return true;
  }
  if (row.dataset.directorsJobIndex) {
    openJobDetail(row.dataset.directorsJobIndex);
    return true;
  }
  return false;
}

function directorsHolidayNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function directorsHolidayRound(value) {
  return Math.round(directorsHolidayNumber(value) * 100) / 100;
}

function directorsBankHolidayUsage(entitlement = {}) {
  const totalBankHolidays = directorsHolidayNumber(entitlement.bankHolidaysCounted);
  const bankHolidays = Array.isArray(entitlement.bankHolidayDates)
    ? entitlement.bankHolidayDates
    : [];
  const uniqueDates = [...new Set(bankHolidays
    .map((holiday) => String(holiday?.date || holiday || ""))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))];

  if (!uniqueDates.length || !totalBankHolidays) {
    return { past: 0, future: totalBankHolidays };
  }

  const today = localIsoDate();
  const valuePerDate = totalBankHolidays / uniqueDates.length;
  const pastDates = uniqueDates.filter((date) => date <= today).length;
  const futureDates = uniqueDates.length - pastDates;
  return {
    past: directorsHolidayRound(pastDates * valuePerDate),
    future: directorsHolidayRound(futureDates * valuePerDate)
  };
}

function directorsHolidayDisplayBalance(entitlement = {}, person = {}) {
  const openingEntitlement = directorsHolidayNumber(
    entitlement.totalAnnualEntitlement ?? entitlement.calculatedEntitlement ?? person.holidayAllowance,
    NaN
  );
  const remaining = directorsHolidayNumber(
    entitlement.remainingEntitlement ?? person.holidayRemaining,
    NaN
  );
  const employeeLeaveTaken = directorsHolidayNumber(entitlement.approvedLeaveTaken ?? person.holidayUsed);
  const futureBookedLeave = directorsHolidayNumber(entitlement.approvedFutureLeave ?? person.holidayBooked);
  const bankHolidayUsage = directorsBankHolidayUsage(entitlement);
  const used = directorsHolidayRound(employeeLeaveTaken + bankHolidayUsage.past);
  const futureCommitted = directorsHolidayRound(futureBookedLeave + bankHolidayUsage.future + directorsHolidayNumber(entitlement.companyClosureDays));
  const barUsed = directorsHolidayRound(used + futureCommitted);
  const barRemaining = Number.isFinite(openingEntitlement)
    ? directorsHolidayRound(Math.max(0, openingEntitlement - barUsed))
    : remaining;
  const reconciledTotal = Number.isFinite(openingEntitlement) && Number.isFinite(remaining)
    ? directorsHolidayRound(used + remaining + futureCommitted)
    : NaN;
  return {
    totalAnnualEntitlement: openingEntitlement,
    used,
    barUsed,
    barRemaining,
    remaining,
    futureCommitted,
    employeeLeaveTaken,
    futureBookedLeave,
    bankHolidaysCounted: entitlement.bankHolidaysCounted,
    companyClosureDays: entitlement.companyClosureDays || 0,
    employeeBookedLeaveTaken: employeeLeaveTaken,
    reconciledTotal
  };
}

function holidayBar(entitlement = {}) {
  const used = Number(entitlement.used ?? entitlement.holidayUsed);
  const remaining = Number(entitlement.remaining ?? entitlement.holidayRemaining);
  const total = Number(entitlement.totalAnnualEntitlement ?? entitlement.totalEntitlement ?? entitlement.holidayAllowance);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(used) || !Number.isFinite(remaining)) {
    return '<span class="holiday-mini-bar holiday-mini-bar-empty" aria-label="No holiday entitlement data recorded"></span>';
  }
  const safeUsed = Math.max(0, used);
  const safeRemaining = Math.max(0, remaining);
  const usedWidth = Math.min(100, (safeUsed / total) * 100);
  const label = `${safeUsed} days used, ${safeRemaining} days remaining from ${total} days entitlement`;
  return `<span class="holiday-mini-bar" aria-label="${escapeHtml(label)}" data-used-days="${escapeHtml(safeUsed)}" data-total-entitlement="${escapeHtml(total)}" data-used-width="${escapeHtml(usedWidth.toFixed(2))}" data-bank-holidays="${escapeHtml(entitlement.bankHolidaysCounted ?? 0)}" data-company-closure-days="${escapeHtml(entitlement.companyClosureDays ?? 0)}" data-employee-booked-leave="${escapeHtml(entitlement.employeeBookedLeaveTaken ?? safeUsed)}" data-future-committed-days="${escapeHtml(entitlement.futureCommitted ?? 0)}" data-remaining-entitlement="${escapeHtml(safeRemaining)}" data-reconciled-total="${escapeHtml(entitlement.reconciledTotal ?? "")}"><span class="holiday-mini-bar-used" style="width:${usedWidth.toFixed(2)}%"></span></span>`;
}

function formatAbsenceDayValue(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function directorsAbsenceTotalForPerson(person = {}, year = String(new Date().getFullYear())) {
  const staff = staffProfiles.find((item) =>
    (person.staffId && item.staffId === person.staffId) || item.name === person.name);
  if (staff) {
    const summary = annualAttendanceSummary(staff, year);
    return Number(summary.sickDays || 0)
      + Number(summary.absentDays || 0)
      + Number(summary.otherAuthorisedAbsenceDays || 0)
      + Number(summary.unauthorisedAbsenceDays || 0);
  }
  return Number(person.sicknessDays || 0)
    + Number(person.otherAbsenceDays || 0)
    + Number(person.unpaidLeave || 0);
}

function renderDirectorsAbsence() {
  const employees = directorsAreaState?.overview?.employees || [];
  const years = directorsAreaState?.overview?.holidayYears || [String(new Date().getFullYear())];
  const selectedYear = document.getElementById("directorAbsenceYearSelect")?.value || years[0] || String(new Date().getFullYear());
  return `
    <div class="directors-panel">
      <h3>Absence and Holidays</h3>
      <div class="directors-payroll-toolbar directors-absence-toolbar">
        <label>Leave year <select id="directorAbsenceYearSelect">${years.map((year) => `<option value="${escapeHtml(year)}"${year === selectedYear ? " selected" : ""}>${escapeHtml(year)}</option>`).join("")}</select></label>
      </div>
      <table class="compact-table directors-absence-table">
        <thead><tr><th>Employee</th><th>Role</th><th>Total entitlement</th><th>Bank holidays</th><th>Days used</th><th>Future committed</th><th>Remaining</th><th>Absence</th></tr></thead>
        <tbody>${employees.map((person) => {
          const entitlement = person.holidayEntitlementsByYear?.[selectedYear] || {};
          const holidayBalance = directorsHolidayDisplayBalance(entitlement, person);
          const absenceTotal = directorsAbsenceTotalForPerson(person, selectedYear);
          return `<tr>
            <td><strong>${escapeHtml(person.name)}</strong><br><small>${escapeHtml(person.staffId)}</small></td>
            <td>${escapeHtml(person.role || "Staff")}</td>
            <td>${holidayBar({
              ...holidayBalance,
              used: holidayBalance.barUsed,
              remaining: holidayBalance.barRemaining,
              reconciledTotal: Number.isFinite(holidayBalance.totalAnnualEntitlement)
                ? directorsHolidayRound(holidayBalance.barUsed + holidayBalance.barRemaining)
                : holidayBalance.reconciledTotal
            })}<small>${escapeHtml(`${formatAbsenceDayValue(holidayBalance.barUsed)} used / ${Number.isFinite(holidayBalance.barRemaining) ? formatAbsenceDayValue(holidayBalance.barRemaining) : "n/a"} remaining`)}</small></td>
            <td>${escapeHtml(entitlement.bankHolidaysCounted ?? 0)}</td>
            <td>${escapeHtml(formatAbsenceDayValue(holidayBalance.used))}</td>
            <td>${escapeHtml(formatAbsenceDayValue(holidayBalance.futureCommitted))}</td>
            <td>${escapeHtml(Number.isFinite(holidayBalance.remaining) ? formatAbsenceDayValue(holidayBalance.remaining) : "Not recorded")}</td>
            <td><span class="directors-absence-total">${escapeHtml(formatAbsenceDayValue(absenceTotal))}</span></td>
          </tr>`;
        }).join("") || '<tr><td colspan="8">No active employee holiday records found.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function payrollPeriodOptions() {
  return (directorsAreaState?.payrollPeriods || []).map((period) => `<option value="${escapeHtml(period.periodId)}"${period.periodId === activeDirectorPayrollPeriod ? " selected" : ""}>${escapeHtml(period.payrollMonth)} - ${escapeHtml(period.status)} v${escapeHtml(period.version)}</option>`).join("");
}

async function loadDirectorPeriod(periodId) {
  if (!periodId) return null;
  const payload = await directorsApi(`/payroll-periods/${encodeURIComponent(periodId)}`);
  return payload.period;
}

function directorsPayrollExceptionReason(issue = "") {
  const text = String(issue || "").toLowerCase();
  if (text.includes("payroll reference")) return "The accountant payroll reference is missing from the staff record.";
  if (text.includes("normal days") || text.includes("hours")) return "The employee's normal working pattern has not been recorded for payroll review.";
  if (text.includes("holiday")) return "Holiday information needs review before payroll sign-off.";
  if (text.includes("absence") || text.includes("sick")) return "Absence information needs a director check before payroll sign-off.";
  if (text.includes("advance")) return "A salary advance needs review before payroll sign-off.";
  return "This payroll item is incomplete or needs a director decision before final approval.";
}

function directorsPayrollExceptionAction(issue = "") {
  const text = String(issue || "").toLowerCase();
  if (text.includes("payroll reference")) return "Add the payroll reference to the stable staff record.";
  if (text.includes("normal days") || text.includes("hours")) return "Update the employee working pattern in Staff Management.";
  if (text.includes("holiday")) return "Check the absence and holiday record, then refresh payroll preparation.";
  if (text.includes("absence") || text.includes("sick")) return "Review the absence record and confirm whether payroll needs adjustment.";
  if (text.includes("advance")) return "Confirm the advance amount, date and accountant note.";
  return "Review the payroll period and correct the source record or approve with director acknowledgement.";
}

function directorsPayrollExceptionRowsFromPeriod(period = {}) {
  return (period.entries || []).flatMap((entry) => (entry.exceptions || []).map((issue) => ({
    periodId: period.periodId,
    payrollMonth: period.payrollMonth,
    employee: entry.employee,
    issue,
    reason: directorsPayrollExceptionReason(issue),
    action: directorsPayrollExceptionAction(issue)
  })));
}

async function directorsPayrollExceptionRows() {
  const summaries = (directorsAreaState?.payrollPeriods || []).filter((period) => Number(period.exceptionCount || 0) > 0);
  const periods = await Promise.all(summaries.map(async (period) => {
    try {
      return await loadDirectorPeriod(period.periodId);
    } catch {
      return null;
    }
  }));
  return periods.filter(Boolean).flatMap(directorsPayrollExceptionRowsFromPeriod);
}

async function renderDirectorsPayrollExceptionsPanel() {
  if (activeDirectorPayrollFocus !== "exceptions") return "";
  const rows = await directorsPayrollExceptionRows();
  return `
    <div class="directors-exceptions-panel" id="directorPayrollExceptionsPanel">
      <h3>Payroll Exceptions Requiring Attention</h3>
      ${rows.length ? `
        <table class="compact-table directors-table">
          <thead><tr><th>Employee</th><th>Issue</th><th>Reason it requires attention</th><th>Action needed</th></tr></thead>
          <tbody>${rows.map((row) => `
            <tr>
              <td><strong>${escapeHtml(row.employee || "Employee")}</strong><br><small>${escapeHtml(row.payrollMonth || "")}</small></td>
              <td>${escapeHtml(row.issue)}</td>
              <td>${escapeHtml(row.reason)}</td>
              <td>${escapeHtml(row.action)}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      ` : '<p class="empty-state">No payroll exceptions require attention.</p>'}
    </div>
  `;
}

async function renderDirectorsPayroll(period = null) {
  const periods = directorsAreaState?.payrollPeriods || [];
  if (!period && activeDirectorPayrollPeriod) {
    try { period = await loadDirectorPeriod(activeDirectorPayrollPeriod); } catch { period = null; }
  }
  const exceptionsPanel = await renderDirectorsPayrollExceptionsPanel();
  const staffOptions = staffProfiles
    .filter((staff) =>
      staff.staffId
      && !["inactive", "left"].includes(String(staff.employmentStatus || staff.status || "Active").toLowerCase())
      && staff.payrollActive === true
      && staff.directorAccessAuthority !== true
      && String(staff.role || "").toLowerCase() !== "director"
    )
    .map((staff) => `<option value="${escapeHtml(staff.staffId || "")}">${escapeHtml(staff.name || "")}</option>`)
    .join("");
  const payrollPreparation = `
    <div class="directors-panel directors-payroll-preparation-panel">
      <h3>Payroll Preparation</h3>
      <p class="panel-note">Create or open a monthly payroll record for review and accountant export.</p>
      ${exceptionsPanel}
      <div class="directors-payroll-toolbar">
        <label>Payroll month <input id="directorPayrollMonthInput" type="month" value=""></label>
        <button class="primary-button" type="button" id="createDirectorPayrollPeriodButton" disabled>Create Month</button>
        <label>Open month <select id="directorPayrollPeriodSelect"><option value="">Select period</option>${payrollPeriodOptions()}</select></label>
      </div>
      ${period ? `
        <div class="directors-period-summary">
          <span class="status ${period.status === "Approved" || period.status === "Exported" ? "ok" : "warning"}">${escapeHtml(period.status)}</span>
          <strong>${escapeHtml(period.payrollMonth)} payroll preparation</strong>
          <span>Version ${escapeHtml(period.version)}</span>
          <span>${escapeHtml((period.entries || []).length)} staff included</span>
        </div>
        <div class="directors-payroll-actions">
          <button class="secondary-button" type="button" id="directorMarkReadyButton" data-period-version="${escapeHtml(period.version)}"${period.status !== "Draft" ? " disabled" : ""}>Ready for Review</button>
          <button class="primary-button" type="button" id="directorApprovePayrollButton" data-period-version="${escapeHtml(period.version)}"${period.status !== "Ready for Review" ? " disabled" : ""}>Approve</button>
          <button class="secondary-button" type="button" id="directorExportPayrollButton" data-period-version="${escapeHtml(period.version)}"${!["Approved", "Exported"].includes(period.status) ? " disabled" : ""}>Export Excel</button>
        </div>
        <details class="directors-advance-panel">
          <summary>Record salary advance</summary>
          <div class="directors-advance-grid">
            <label>Employee <select id="directorAdvanceStaffInput">${staffOptions}</select></label>
            <label>Amount <input id="directorAdvanceAmountInput" type="number" min="0.01" step="0.01"></label>
            <label>Date paid <input id="directorAdvanceDateInput" type="date" value="${escapeHtml(localIsoDate())}"></label>
            <label>Note <input id="directorAdvanceNoteInput" type="text"></label>
            <button class="primary-button" type="button" id="directorSaveAdvanceButton" data-period-version="${escapeHtml(period.version)}">Save advance</button>
          </div>
        </details>
        <table class="compact-table directors-table">
          <thead><tr><th>Employee</th><th>Payroll Ref</th><th>Holiday</th><th>Sick</th><th>Absence</th><th>Advances</th><th>Exceptions</th></tr></thead>
          <tbody>${(period.entries || []).map((entry) => `<tr><td>${escapeHtml(entry.employee)}</td><td>${escapeHtml(entry.payrollReference || "Not recorded")}</td><td>${escapeHtml(entry.approvedHolidayDays || 0)}</td><td>${escapeHtml(entry.sickDays || 0)}</td><td>${escapeHtml(entry.unpaidAbsenceDays || 0)}</td><td>${escapeHtml(entry.salaryAdvancesTotal || 0)}</td><td>${(entry.exceptions || []).map((item) => `<span class="status warning">${escapeHtml(item)}</span>`).join(" ") || '<span class="status ok">Clear</span>'}</td></tr>`).join("")}</tbody>
        </table>
      ` : `<p class="empty-state directors-payroll-empty-state">Select or create a payroll month to begin.</p>`}
    </div>
  `;
  return `${payrollPreparation}${renderDirectorsExports()}`;
}

function renderDirectorsExports() {
  const exports = directorsAreaState?.exportHistory || [];
  return `
    <div class="directors-panel directors-payroll-export-history-panel">
      <h3>Payroll Export History</h3>
      <table class="compact-table directors-payroll-export-table">
        <thead><tr><th>Month</th><th>File</th><th>Version</th><th>Exported</th><th>Action</th></tr></thead>
        <tbody>${exports.map((item) => `<tr><td>${escapeHtml(item.payrollMonth)}</td><td class="payroll-export-file">${escapeHtml(item.fileName)}</td><td>${escapeHtml(item.version)}</td><td>${escapeHtml(formatDateTimeUkShort(item.exportedAt))}</td><td><a class="secondary-button payroll-download-button" href="/api/phase-10/exports/${encodeURIComponent(item.exportId)}/download" target="_blank" rel="noopener">Download</a></td></tr>`).join("") || '<tr><td colspan="5">No payroll workbooks have been exported yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function renderDirectorsCompanyDetails() {
  const entity = directorsAreaState?.legalEntities?.find((item) => item.legalEntityId === "LE-KWL-13950997") || {};
  const tradingLines = Array.isArray(entity.tradingAddressLines) ? entity.tradingAddressLines.join("\n") : "";
  const registeredLines = Array.isArray(entity.registeredOfficeAddressLines) ? entity.registeredOfficeAddressLines.join("\n") : "";
  return `
    <div class="directors-panel">
      <h3>Company Details</h3>
      <p class="panel-note">Authoritative legal-entity details used by payroll workbooks and future generated documents. This record is restricted to directors and referenced by stable legal entity ID.</p>
      <form id="directorCompanyDetailsForm" class="directors-company-form">
        <label>Legal entity ID <input name="legalEntityId" type="text" value="${escapeHtml(entity.legalEntityId || "LE-KWL-13950997")}" readonly></label>
        <label>Legal company name <input name="legalCompanyName" type="text" value="${escapeHtml(entity.legalCompanyName || "")}" required></label>
        <label>Trading name <input name="tradingName" type="text" value="${escapeHtml(entity.tradingName || "")}" required></label>
        <label class="full">Trading address lines <textarea name="tradingAddressLines" rows="3" required>${escapeHtml(tradingLines)}</textarea></label>
        <label>Trading town <input name="tradingTown" type="text" value="${escapeHtml(entity.tradingTown || "")}" required></label>
        <label>Trading postcode <input name="tradingPostcode" type="text" value="${escapeHtml(entity.tradingPostcode || "")}" required></label>
        <label class="full">Registered office address lines <textarea name="registeredOfficeAddressLines" rows="3" required>${escapeHtml(registeredLines)}</textarea></label>
        <label>Registered office town <input name="registeredOfficeTown" type="text" value="${escapeHtml(entity.registeredOfficeTown || "")}" required></label>
        <label>Registered office postcode <input name="registeredOfficePostcode" type="text" value="${escapeHtml(entity.registeredOfficePostcode || "")}" required></label>
        <label>Company registration number <input name="companyRegistrationNumber" type="text" value="${escapeHtml(entity.companyRegistrationNumber || "")}" required></label>
        <label>VAT registration number <input name="vatRegistrationNumber" type="text" value="${escapeHtml(entity.vatRegistrationNumber || "")}" required></label>
        <label>Telephone <input name="telephoneNumber" type="text" value="${escapeHtml(entity.telephoneNumber || "")}" required></label>
        <label>General email <input name="generalEmail" type="email" value="${escapeHtml(entity.generalEmail || "")}" required></label>
        <label>Website <input name="website" type="text" value="${escapeHtml(entity.website || "")}" required></label>
        <label class="full">Approved logo reference <input name="approvedLogoReference" type="text" value="${escapeHtml(entity.approvedLogoReference || "")}" required></label>
        <div class="directors-company-logo-preview full" aria-label="Approved Kingswood logo preview">
          ${entity.approvedLogoReference ? `<img src="${escapeHtml(entity.approvedLogoReference)}" alt="Approved Kingswood logo">` : "<span>No approved logo selected.</span>"}
        </div>
        <label class="full">Document footer text <textarea name="documentFooterText" rows="2">${escapeHtml(entity.documentFooterText || "")}</textarea></label>
        <label>Status <select name="status"><option value="Active"${entity.status !== "Inactive" ? " selected" : ""}>Active</option><option value="Inactive"${entity.status === "Inactive" ? " selected" : ""}>Inactive</option></select></label>
        <div class="directors-company-meta">
          <span>Last updated by ${escapeHtml(entity.lastUpdatedBy || "Not recorded")}</span>
          <span>${escapeHtml(entity.lastUpdatedAt ? new Date(entity.lastUpdatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "No timestamp recorded")}</span>
        </div>
        <div class="directors-payroll-actions">
          <button class="primary-button" type="submit">Save Company Details</button>
          <span id="directorCompanyDetailsMessage" class="save-status" role="status"></span>
        </div>
      </form>
    </div>
  `;
}

async function renderDirectorsArea() {
  if (activeDirectorTab === "technicians") activeDirectorTab = "overview";
  if (activeDirectorTab === "exports") activeDirectorTab = "payroll";
  document.querySelectorAll("[data-director-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.directorTab === activeDirectorTab));
  const content = document.querySelector("#directorsContent");
  if (!content || !directorsAreaState) return;
  if (activeDirectorTab === "absence") content.innerHTML = renderDirectorsAbsence();
  else if (activeDirectorTab === "payroll") content.innerHTML = await renderDirectorsPayroll();
  else if (activeDirectorTab === "company-details") content.innerHTML = renderDirectorsCompanyDetails();
  else content.innerHTML = renderDirectorsOverview();
}

async function createDirectorPayrollPeriod() {
  try {
    const payload = await directorsApi("/payroll-periods", {
      method: "POST",
      body: JSON.stringify({ payrollMonth: document.querySelector("#directorPayrollMonthInput")?.value || "" })
    });
    activeDirectorPayrollPeriod = payload.period.periodId;
    activeDirectorTab = "payroll";
    await refreshDirectorsArea();
  } catch (error) {
    await kcInfo(error.message);
  }
}

async function updateDirectorPayrollStatus(status, version, acknowledgeUnresolved = false) {
  if (!activeDirectorPayrollPeriod) return;
  try {
    await directorsApi(`/payroll-periods/${encodeURIComponent(activeDirectorPayrollPeriod)}/status`, {
      method: "POST",
      body: JSON.stringify({ status, version: Number(version), acknowledgeUnresolved })
    });
    activeDirectorTab = "payroll";
    await refreshDirectorsArea();
  } catch (error) {
    if (status === "Approved" && /acknowledgement/i.test(error.message)) {
      const confirmed = await kcConfirmAction("Payroll exceptions remain. Approve this period with director acknowledgement?", "Approve");
      if (confirmed) return updateDirectorPayrollStatus(status, version, true);
    }
    await kcInfo(status === "Approved" ? `Payroll approval failed: ${error.message}` : error.message);
  }
}

async function saveDirectorSalaryAdvance(version) {
  if (!activeDirectorPayrollPeriod) return;
  try {
    await directorsApi(`/payroll-periods/${encodeURIComponent(activeDirectorPayrollPeriod)}/advance`, {
      method: "POST",
      body: JSON.stringify({
        version: Number(version),
        staffId: document.querySelector("#directorAdvanceStaffInput")?.value || "",
        amount: document.querySelector("#directorAdvanceAmountInput")?.value || "",
        datePaid: document.querySelector("#directorAdvanceDateInput")?.value || "",
        note: document.querySelector("#directorAdvanceNoteInput")?.value || ""
      })
    });
    activeDirectorTab = "payroll";
    await refreshDirectorsArea();
  } catch (error) {
    await kcInfo(error.message);
  }
}

async function exportDirectorPayroll(version) {
  if (!activeDirectorPayrollPeriod) return;
  try {
    const payload = await directorsApi(`/payroll-periods/${encodeURIComponent(activeDirectorPayrollPeriod)}/export`, {
      method: "POST",
      body: JSON.stringify({ version: Number(version) })
    });
    await refreshDirectorsArea();
    if (payload.export?.exportId) window.open(`/api/phase-10/exports/${encodeURIComponent(payload.export.exportId)}/download`, "_blank", "noopener");
  } catch (error) {
    await kcInfo(`Payroll export failed: ${error.message}`);
  }
}

async function saveDirectorCompanyDetails(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.tradingAddressLines = String(payload.tradingAddressLines || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  payload.registeredOfficeAddressLines = String(payload.registeredOfficeAddressLines || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const message = document.querySelector("#directorCompanyDetailsMessage");
  try {
    const result = await directorsApi("/company-details", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    directorsAreaState.legalEntities = [result.legalEntity, ...(directorsAreaState.legalEntities || []).filter((item) => item.legalEntityId !== result.legalEntity.legalEntityId)];
    if (message) message.textContent = "Company details saved.";
    await refreshDirectorsArea();
    activeDirectorTab = "company-details";
    await renderDirectorsArea();
  } catch (error) {
    if (message) message.textContent = error.message;
    await kcInfo(error.message);
  }
}

function showSection(sectionId) {
  const section = document.querySelector(`#${CSS.escape(sectionId)}`);
  if (!section) return;
  if (sectionId === "directors" && !isDirectorLocalUser()) {
    showDirectorsLocked("Director access is restricted to Kevin and Alex.");
  }
  if (sectionId !== "settings") {
    weatherThemePreviewValue = "live";
    seasonalThemePreviewValue = "none";
  }
  document.querySelectorAll(".section-panel").forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionId);
  });
  syncSidebarGroupsForSection(sectionId);
  document.body.dataset.activeSection = sectionId;
  if (sectionId === "dashboard") {
    startDashboardRevolutAutoRefresh({ immediate: true });
  } else {
    stopDashboardRevolutAutoRefresh();
  }
  document.querySelector("#pageTitle").textContent = section.dataset.title;
  localStorage.setItem(sectionStorageKey, sectionId);
  updateProofingFrame(sectionId);
  updateSectionUrl(sectionId);
  applyDashboardHeaderTheme(lastWeatherCode);
  if (sectionId === "tracking" || sectionId === "split-screen") {
    window.setTimeout(() => {
      renderTracking();
      renderSplitScreen();
    }, 80);
  }
  if (sectionId === "directors") {
    void refreshDirectorsArea();
  }
  closeMobileMenu();
}

function setMobileMenuOpen(open) {
  document.body.classList.toggle("mobile-menu-open", Boolean(open));
  mobileMenuButton?.setAttribute("aria-expanded", open ? "true" : "false");
}

function closeMobileMenu() {
  setMobileMenuOpen(false);
}

function updateProofingFrame(sectionId) {
  const frame = document.querySelector(".embedded-tool-frame");
  if (!frame) return;
  frame.removeAttribute("src");
}

function updateSectionUrl(sectionId) {
  if (location.protocol === "file:") return;
  const url = new URL(location.href);
  url.searchParams.set("section", sectionId);
  url.searchParams.set("v", appVersion);
  if (isReviewMode()) url.searchParams.set(reviewModeParam, "1");
  history.replaceState(null, "", url.toString());
}

function sectionUrl(sectionId) {
  const url = new URL(location.href);
  url.searchParams.set("section", sectionId);
  url.searchParams.set("v", appVersion);
  if (isReviewMode()) url.searchParams.set(reviewModeParam, "1");
  return url.toString();
}

function applyGlobalSearch() {
  const term = globalSearch.value.trim().toLowerCase();
  document.querySelectorAll(".module-card, .list-row, tbody tr").forEach((item) => {
    item.classList.toggle("hidden-by-search", term && !item.textContent.toLowerCase().includes(term));
  });
}

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => showSection(button.dataset.section));
});

mobileMenuButton?.addEventListener("click", () => {
  setMobileMenuOpen(!document.body.classList.contains("mobile-menu-open"));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("mobile-menu-open")) {
    closeMobileMenu();
  }
});

document.addEventListener("click", (event) => {
  if (!document.body.classList.contains("mobile-menu-open")) {
    return;
  }
  const target = event.target;
  if (target instanceof Element && (target.closest(".sidebar") || target.closest("#mobileMenuButton"))) {
    return;
  }
  closeMobileMenu();
});

document.querySelectorAll(".nav-group-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const group = button.closest(".nav-group");
    const shouldOpen = button.getAttribute("aria-expanded") !== "true";
    document.querySelectorAll(".nav-group").forEach((item) => {
      setSidebarGroupOpen(item, shouldOpen && item === group);
    });
  });
});

document.addEventListener("click", (event) => {
  if (!reviewModeBlockedAction(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  reviewModeMessage();
}, true);

document.addEventListener("submit", (event) => {
  if (!isReviewMode()) return;
  if (event.target === pinForm) return;
  if (event.target?.closest?.("#kcDialog")) return;
  event.preventDefault();
  event.stopPropagation();
  reviewModeMessage();
}, true);

document.addEventListener("drop", (event) => {
  if (!isReviewMode()) return;
  event.preventDefault();
  event.stopPropagation();
  reviewModeMessage();
}, true);

document.addEventListener("paste", (event) => {
  if (!isReviewMode()) return;
  const target = event.target;
  if (target?.matches?.("input, textarea, [contenteditable='true']")) return;
  event.preventDefault();
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key !== "F5") return;
  const activeSection = document.querySelector(".section-panel.active")?.id;
  if (!activeSection || location.protocol === "file:") return;
  event.preventDefault();
  location.href = sectionUrl(activeSection);
});

addButton?.addEventListener("click", () => openDialog());
document.querySelector("#addRamsButtonMirror")?.addEventListener("click", () => openDialog());
buildRamsButton?.addEventListener("click", openRamsBuilder);
document.querySelector("#buildRamsButtonMirror")?.addEventListener("click", openRamsBuilder);
aiRamsDraftButton?.addEventListener("click", requestAiRamsDraft);
openRamsPrintButton?.addEventListener("click", openRamsPrintView);
saveBuiltRamsButton?.addEventListener("click", saveBuiltRams);
parseNativeProofingNotes?.addEventListener("click", parseProofingNotesWithAi);
previewNativeProofingReport?.addEventListener("click", openProofingPdfView);
saveNativeProofingReport?.addEventListener("click", saveProofingReport);
clearNativeProofingReport?.addEventListener("click", clearProofingReport);
proofingBeforePhotosInput?.addEventListener("change", () => readProofingPhotos(proofingBeforePhotosInput, "before"));
proofingAfterPhotosInput?.addEventListener("change", () => readProofingPhotos(proofingAfterPhotosInput, "after"));
document.querySelectorAll(".proofing-drop-zone").forEach((zone) => {
  const kind = zone.dataset.proofingKind;
  const input = kind === "after" ? proofingAfterPhotosInput : proofingBeforePhotosInput;
  zone.addEventListener("click", () => input?.click());
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("is-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("is-over");
    readProofingPhotosFromFiles(event.dataTransfer?.files, kind, false);
  });
});
document.addEventListener("input", (event) => {
  const captionField = event.target.closest("[data-proofing-photo-caption]");
  if (!captionField) return;
  const kind = captionField.dataset.proofingPhotoCaption;
  const index = Number(captionField.dataset.index);
  if (proofingPhotos[kind]?.[index]) {
    proofingPhotos[kind][index].caption = captionField.value;
    updateProofingPreview();
  }
});
document.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("[data-remove-proofing-photo]");
  if (!removeButton) return;
  const kind = removeButton.dataset.removeProofingPhoto;
  const index = Number(removeButton.dataset.index);
  proofingPhotos[kind].splice(index, 1);
  renderProofingPhotoCards(kind);
  updateProofingPreview();
});

document.addEventListener("submit", async (event) => {
  if (event.target?.id === "directorCompanyDetailsForm") {
    await saveDirectorCompanyDetails(event);
  }
});
document.addEventListener("click", async (event) => {
  const dispatchChangeButton = event.target.closest("[data-job-dispatch-change]");
  if (dispatchChangeButton) {
    await markJobDispatchChanged(dispatchChangeButton.dataset.jobDispatchChange);
    return;
  }
  const dispatchCancelButton = event.target.closest("[data-job-dispatch-cancel]");
  if (dispatchCancelButton) {
    await cancelJobDispatch(dispatchCancelButton.dataset.jobDispatchCancel);
    return;
  }
  const trackingButton = event.target.closest("[data-tracking-vehicle]");
  if (!trackingButton) return;
  selectTrackingVehicle(trackingButton.dataset.trackingVehicle, true);
});
Object.values(proofingFields).forEach((field) => {
  field?.addEventListener("input", updateProofingPreview);
  field?.addEventListener("change", updateProofingPreview);
});
proofingRawNotes?.addEventListener("input", () => proofingSetStatus(""));
ramsBuildSource?.addEventListener("dragover", (event) => {
  event.preventDefault();
  ramsBuildSource.classList.add("drag-over");
});
ramsBuildSource?.addEventListener("dragleave", () => ramsBuildSource.classList.remove("drag-over"));
ramsBuildSource?.addEventListener("drop", async (event) => {
  event.preventDefault();
  ramsBuildSource.classList.remove("drag-over");
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const text = await file.text();
  ramsBuildSource.value = [ramsBuildSource.value, text].filter(Boolean).join("\n");
  refreshRamsLivePreview();
});
[
  ramsBuildClient,
  ramsBuildJobRef,
  ramsBuildAddress,
  ramsBuildPostcode,
  ramsBuildTechnician,
  ramsBuildDate,
  ramsBuildTitle,
  ramsBuildScope,
  ramsBuildSource,
  ramsBuildPpe,
  ramsBuildEquipment
].forEach((field) => {
  field?.addEventListener("input", refreshRamsLivePreview);
  field?.addEventListener("change", refreshRamsLivePreview);
});
searchInput.addEventListener("input", renderRamsTable);
statusFilter.addEventListener("change", renderRamsTable);
document.querySelector("#jobSearch").addEventListener("input", renderJobs);
document.querySelector("#jobMonthFilter").addEventListener("change", renderJobs);
document.querySelector("#jobYearFilter").addEventListener("change", renderJobs);
document.querySelector("#jobsTableBody").addEventListener("click", (event) => {
  if (event.target.closest("button")) {
    return;
  }
  const row = event.target.closest("[data-job-index]");
  if (row) {
    openJobDetail(row.dataset.jobIndex);
  }
});
closeJobDetailButton.addEventListener("click", () => jobDetailDialog.close());
closeStaffDetailButton?.addEventListener("click", () => staffDetailDialog.close());
sickCallCategory?.addEventListener("change", refreshSickCallDialog);
sickCallWorkInjury?.addEventListener("change", refreshSickCallDialog);
sickCallForm?.addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") {
    return;
  }
  event.preventDefault();
  const saved = await saveSickCallIn();
  if (saved !== false) {
    sickCallDialog.close();
  }
});
attendanceForm?.addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") {
    return;
  }
  event.preventDefault();
  await saveAttendanceDialog(event.submitter?.value || "default");
});
[
  attendanceTypeInput,
  attendanceStartDate,
  attendanceEndDate,
  attendanceOngoingInput,
  attendanceDayType
].forEach((field) => field?.addEventListener("change", refreshAttendanceDialog));
document.querySelector("#plannerBoard").addEventListener("click", (event) => {
  if (event.target.closest("button")) {
    return;
  }
  const existingCell = event.target.closest("[data-planner-index]");
  if (existingCell) {
    openDataDialog("planner", existingCell.dataset.plannerIndex);
    return;
  }
  const newCell = event.target.closest("[data-planner-create]");
  if (newCell) {
    openDataDialog("planner", "", {
      date: newCell.dataset.date,
      day: newCell.dataset.day,
      technician: newCell.dataset.technician,
      session: newCell.dataset.session || "AM",
      week: newCell.dataset.week,
      weekStart: newCell.dataset.weekStart,
      task: ""
    });
  }
});
document.querySelector("#complianceSearch").addEventListener("input", renderCompliance);
document.querySelector("#complianceCategoryFilter").addEventListener("change", renderCompliance);
document.querySelector("#complianceStatusFilter")?.addEventListener("change", () => {
  activeComplianceFilter = document.querySelector("#complianceStatusFilter").value;
  renderCompliance();
});
document.querySelector("#complianceOwnerFilter")?.addEventListener("change", renderCompliance);
document.querySelector("#complianceExpiryFilter")?.addEventListener("change", renderCompliance);
document.querySelector("#fineSearch").addEventListener("input", renderFines);
document.querySelector("#fineStatusFilter").addEventListener("change", renderFines);
document.querySelector("#documentsSearch")?.addEventListener("input", renderCompanyDocuments);
document.querySelector("#documentsCategoryFilter")?.addEventListener("change", renderCompanyDocuments);
document.querySelector("#documentsStatusFilter")?.addEventListener("change", renderCompanyDocuments);
document.querySelector("#valuationSearch").addEventListener("input", renderValuations);
document.querySelector("#valuationMonthFilter").addEventListener("change", renderValuations);
document.querySelector("#valuationYearFilter").addEventListener("change", renderValuations);
document.querySelector("#valuationClientFilter").addEventListener("change", renderValuations);
document.querySelector("#valuationStatusFilter").addEventListener("change", renderValuations);
document.querySelector("#exportArkCsvButton")?.addEventListener("click", () => exportValuationGroup("ark"));
document.querySelector("#exportJgCsvButton")?.addEventListener("click", () => exportValuationGroup("jg"));
document.querySelector("#exportVergoCsvButton")?.addEventListener("click", () => exportValuationGroup("vergo"));
document.querySelector("#exportOtherCsvButton")?.addEventListener("click", () => exportValuationGroup("other"));
document.querySelector("#valuationGraphButton").addEventListener("click", showValuationGraph);
document.querySelector("#generateArkValuationButton").addEventListener("click", () => generateValuationWorkbook("ark"));
document.querySelector("#generateJgValuationButton").addEventListener("click", () => generateValuationWorkbook("jg"));
document.querySelector("#generateVergoValuationButton").addEventListener("click", () => generateValuationWorkbook("vergo"));
document.querySelector("#generateOtherValuationButton").addEventListener("click", () => generateValuationWorkbook("other"));
closeValuationGraphButton?.addEventListener("click", () => valuationGraphDialog.close());
document.querySelector("#staffSearch")?.addEventListener("input", renderStaff);
document.querySelector("#attendanceStatusFilter")?.addEventListener("change", renderStaff);
["#holidayPlannerEmployeeFilter", "#holidayPlannerStatusFilter", "#holidayPlannerMonthInput", "#holidayPlannerShowDeclined", "#holidayPlannerShowCancelled"].forEach((selector) => {
  document.querySelector(selector)?.addEventListener("change", (event) => {
    if (selector === "#holidayPlannerMonthInput") {
      holidayPlannerSetMonth(event.target.value);
    }
    expandedHolidayPlannerDay = "";
    renderHolidayPlanner();
  });
});
document.querySelector("#holidayPlannerSearch")?.addEventListener("input", () => {
  expandedHolidayPlannerDay = "";
  renderHolidayPlanner();
});
document.querySelector("#holidayPlannerTodayButton")?.addEventListener("click", () => {
  holidayPlannerSetMonth(today.slice(0, 7));
  expandedHolidayPlannerDay = "";
  renderHolidayPlanner();
});
document.querySelector("#holidayPlannerPrevButton")?.addEventListener("click", () => {
  const date = holidayPlannerMonthStart(activeHolidayPlannerMonth);
  date.setMonth(date.getMonth() - 1);
  holidayPlannerSetMonth(holidayPlannerMonthKeyFromDate(date));
  expandedHolidayPlannerDay = "";
  renderHolidayPlanner();
});
document.querySelector("#holidayPlannerNextButton")?.addEventListener("click", () => {
  const date = holidayPlannerMonthStart(activeHolidayPlannerMonth);
  date.setMonth(date.getMonth() + 1);
  holidayPlannerSetMonth(holidayPlannerMonthKeyFromDate(date));
  expandedHolidayPlannerDay = "";
  renderHolidayPlanner();
});
document.querySelector("#trainingSearch")?.addEventListener("input", () => {
  activeTrainingFilter = "all";
  renderTrainingMatrix();
});
document.querySelector("#trainingYearFilter")?.addEventListener("change", (event) => {
  activeTrainingYear = event.target.value || String(new Date().getFullYear());
  activeTrainingFilter = "all";
  renderTrainingMatrix();
});
document.querySelector("#trainingEmployeeFilter")?.addEventListener("change", () => {
  activeTrainingFilter = "all";
  renderTrainingMatrix();
});
document.querySelector("#trainingCourseFilter")?.addEventListener("change", () => {
  activeTrainingFilter = "all";
  renderTrainingMatrix();
});
document.querySelector("#trainingStatusFilter")?.addEventListener("change", () => {
  activeTrainingFilter = "all";
  renderTrainingMatrix();
});
document.querySelector("#trainingExpiryFilter")?.addEventListener("change", () => {
  activeTrainingFilter = "all";
  renderTrainingMatrix();
});
document.querySelector("#exportTrainingCsvButton")?.addEventListener("click", () => exportTrainingMatrix("csv"));
document.querySelector("#exportTrainingExcelButton")?.addEventListener("click", () => exportTrainingMatrix("xlsx"));
["#assetSearch", "#assetCategoryFilter", "#assetStatusFilter", "#assetEmployeeFilter", "#assetVehicleFilter", "#assetDueFilter"].forEach((selector) => {
  document.querySelector(selector)?.addEventListener(selector === "#assetSearch" ? "input" : "change", () => {
    activeAssetFilter = "all";
    renderAssets();
  });
});
document.querySelector("#historyPageSize")?.addEventListener("change", (event) => {
  localStorage.setItem(historyPageSizeStorageKey, event.target.value);
  historyCurrentPage = 1;
  renderHistory();
});
["#historyStatusFilter", "#historyDateFilter", "#historyTechnicianFilter", "#historyClientFilter", "#historySort"].forEach((selector) => {
  document.querySelector(selector)?.addEventListener("change", () => {
    historyCurrentPage = 1;
    renderHistory();
  });
});
document.querySelector("#historySearch")?.addEventListener("input", () => {
  window.clearTimeout(historySearchDebounceTimer);
  historySearchDebounceTimer = window.setTimeout(() => {
    historyCurrentPage = 1;
    renderHistory();
  }, 180);
});
document.querySelector("#historyClearSearch")?.addEventListener("click", () => {
  const input = document.querySelector("#historySearch");
  if (input) input.value = "";
  historyCurrentPage = 1;
  renderHistory();
});
document.querySelector("#historyResetFilters")?.addEventListener("click", () => {
  ["#historySearch", "#historyStatusFilter", "#historyDateFilter", "#historyTechnicianFilter", "#historyClientFilter", "#historySort"].forEach((selector) => {
    const field = document.querySelector(selector);
    if (!field) return;
    field.value = selector === "#historySort" ? "newest" : "all";
    if (selector === "#historySearch") field.value = "";
  });
  historyCurrentPage = 1;
  renderHistory();
});
document.querySelector("#historyPrevPage")?.addEventListener("click", () => {
  if (historyCurrentPage > 1) {
    historyCurrentPage -= 1;
    renderHistory();
  }
});
document.querySelector("#historyNextPage")?.addEventListener("click", () => {
  historyCurrentPage += 1;
  renderHistory();
});
document.querySelector("#exportAssetsCsvButton")?.addEventListener("click", () => exportAssets("csv"));
document.querySelector("#exportAssetsExcelButton")?.addEventListener("click", () => exportAssets("xlsx"));
document.querySelector("#sendTodayScheduleButton")?.addEventListener("click", () => sendScheduleToTechnicians(localIsoDate(), "Today"));
document.querySelector("#sendTomorrowScheduleButton")?.addEventListener("click", () => sendScheduleToTechnicians(datePlusDays(localIsoDate(), 1), "Tomorrow"));
globalSearch?.addEventListener("input", applyGlobalSearch);
document.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const directorsLiveRow = event.target.closest?.(".directors-live-row");
  if (directorsLiveRow) {
    event.preventDefault();
    activateDirectorsOverviewRow(directorsLiveRow);
    return;
  }
  const directorOverviewCard = event.target.closest?.("[data-director-overview-tab]");
  if (!directorOverviewCard) return;
  event.preventDefault();
  activeDirectorTab = directorOverviewCard.dataset.directorOverviewTab;
  activeDirectorPayrollFocus = directorOverviewCard.dataset.directorOverviewFocus || "";
  await renderDirectorsArea();
});
document.addEventListener("change", async (event) => {
  if (event.target?.id === "directorPerformancePeriodSelect") {
    activeDirectorPerformancePeriod = event.target.value || "this-month";
    activeDirectorPerformanceTechnician = "";
    await renderDirectorsArea();
    return;
  }
  if (event.target?.id === "weatherThemePreviewSelect") {
    setWeatherThemePreview(event.target.value);
  }
  if (event.target?.id === "seasonalThemePreviewSelect") {
    setSeasonalThemePreview(event.target.value);
  }
  if (event.target?.id === "christmasThemeEndDateInput") {
    setChristmasThemeEndDate(event.target.value);
  }
  if (["tscIssueAudienceInput", "tscIssueSelectedStaffInput", "tscIssueDateInput", "tscIssueDueDateInput", "tscIssueReminderInput"].includes(event.target?.id)) {
    updateTscIssueConfirmation();
  }
  if (["tscAnnouncementAudienceInput", "tscAnnouncementSelectedStaffInput", "tscAnnouncementAckInput", "tscAnnouncementExpiryInput"].includes(event.target?.id)) {
    updateTscAnnouncementConfirmation();
  }
  if (event.target?.matches("[data-vehicle-assignment-index]")) {
    await updateVehicleAssignment(event.target.dataset.vehicleAssignmentIndex, event.target.value);
  }
  if (event.target?.matches("[data-vehicle-document-file]")) {
    const entry = await readVehicleRecordFile(event.target.files?.[0]);
    if (entry?.error) await kcInfo(entry.error);
    else vehicleDocumentDraft = entry;
    renderVehicleRecordDetail(activeVehicleRecordId);
  }
  if (event.target?.matches("[data-vehicle-maintenance-file]")) {
    const entry = await readVehicleRecordFile(event.target.files?.[0]);
    if (entry?.error) await kcInfo(entry.error);
    else vehicleMaintenanceDraft = entry;
    renderVehicleRecordDetail(activeVehicleRecordId);
  }
  if (event.target?.matches("[data-replace-vehicle-document]")) {
    await replaceVehicleDocument(event.target.dataset.replaceVehicleDocument, event.target.files?.[0]);
  }
  if (event.target?.id === "vehicleInspectionReviewFilter") {
    renderVehicleInspectionReviews();
    renderVehicleInspectionDetail("");
  }
  if (event.target?.id === "directorPayrollPeriodSelect") {
    activeDirectorPayrollPeriod = event.target.value;
    activeDirectorTab = "payroll";
    await renderDirectorsArea();
  }
  if (event.target?.id === "directorAbsenceYearSelect") {
    await renderDirectorsArea();
  }
});
document.addEventListener("input", (event) => {
  if (event.target?.id === "directorPayrollMonthInput") {
    const button = document.querySelector("#createDirectorPayrollPeriodButton");
    if (button) button.disabled = !event.target.value;
  }
});
document.addEventListener("visibilitychange", updateHeaderSceneMotionState);
publishFeedsButton?.addEventListener("click", publishIntegrationFeeds);
refreshFeedsButton?.addEventListener("click", renderIntegrationFeeds);
syncNowButton?.addEventListener("click", syncNow);
pinForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedUser = loginNameInput.value;
  const pin = pinInput.value.trim();
  pinInput.value = "";
  pinMessage.textContent = "Signing in…";
  const submit = pinForm.querySelector('[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    if (isDirectorLocalUser(selectedUser)) {
      await directorLogoutPromise;
      const result = await directorsApi("/director-login", {
        method: "POST", body: JSON.stringify({ name: selectedUser, pin })
      });
      acceptDirectorSession(result);
      unlockHub(result.director.displayName);
    } else {
      if (!selectedUser || authorisedUsers[selectedUser] !== pin) throw new Error("Name or PIN not recognised.");
      clearDirectorSession();
      unlockHub(selectedUser);
    }
    if (document.body.dataset.activeSection === "directors") await refreshDirectorsArea();
    if (document.body.dataset.activeSection === "dashboard") startDashboardRevolutAutoRefresh({ immediate: true });
  } catch (error) {
    pinMessage.textContent = error.message || "Sign-in is unavailable. Please try again.";
  } finally {
    if (submit) submit.disabled = false;
  }
});
lockHubButton?.addEventListener("click", lockHub);
document.querySelector("#directorSignInButton")?.addEventListener("click", lockHub);
document.querySelector("#directorLogoutButton")?.addEventListener("click", () => {
  lockHub();
  showSection("dashboard");
});

document.addEventListener("click", async (event) => {
  const directorsPerformanceReportsButton = event.target.closest("[data-directors-performance-reports]");
  if (directorsPerformanceReportsButton) {
    activeDirectorPerformanceTechnician = directorsPerformanceReportsButton.dataset.directorsPerformanceReports || "";
    await renderDirectorsArea();
    document.querySelector("#directorTechnicianOutstandingReports")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  const directorsOpenStaffButton = event.target.closest("[data-directors-open-staff]");
  if (directorsOpenStaffButton) {
    openStaffDetail(directorsOpenStaffButton.dataset.directorsOpenStaff);
    return;
  }

  const directorsLiveRow = event.target.closest(".directors-live-row");
  if (directorsLiveRow && activateDirectorsOverviewRow(directorsLiveRow)) {
    return;
  }

  const directorOverviewCard = event.target.closest("[data-director-overview-tab]");
  if (directorOverviewCard) {
    activeDirectorTab = directorOverviewCard.dataset.directorOverviewTab;
    activeDirectorPayrollFocus = directorOverviewCard.dataset.directorOverviewFocus || "";
    await renderDirectorsArea();
    return;
  }

  const directorTab = event.target.closest("[data-director-tab]");
  if (directorTab) {
    activeDirectorTab = directorTab.dataset.directorTab;
    activeDirectorPayrollFocus = "";
    await renderDirectorsArea();
    return;
  }

  const createPayrollButton = event.target.closest("#createDirectorPayrollPeriodButton");
  if (createPayrollButton) {
    await createDirectorPayrollPeriod();
    return;
  }

  const periodSelect = event.target.closest("#directorPayrollPeriodSelect");
  if (periodSelect) {
    return;
  }

  const markReadyButton = event.target.closest("#directorMarkReadyButton");
  if (markReadyButton) {
    await updateDirectorPayrollStatus("Ready for Review", markReadyButton.dataset.periodVersion);
    return;
  }

  const approvePayrollButton = event.target.closest("#directorApprovePayrollButton");
  if (approvePayrollButton) {
    await updateDirectorPayrollStatus("Approved", approvePayrollButton.dataset.periodVersion);
    return;
  }

  const exportPayrollButton = event.target.closest("#directorExportPayrollButton");
  if (exportPayrollButton) {
    await exportDirectorPayroll(exportPayrollButton.dataset.periodVersion);
    return;
  }

  const saveAdvanceButton = event.target.closest("#directorSaveAdvanceButton");
  if (saveAdvanceButton) {
    await saveDirectorSalaryAdvance(saveAdvanceButton.dataset.periodVersion);
    return;
  }

  const publishButton = event.target.closest("[data-publish-feeds]");
  if (publishButton) {
    publishIntegrationFeeds();
    return;
  }

  const openSectionButton = event.target.closest("[data-open-section]");
  if (openSectionButton) {
    window.open(sectionUrl(openSectionButton.dataset.openSection), "_blank", "noopener");
    return;
  }

  const clearButton = event.target.closest("[data-clear-data]");
  if (clearButton) {
    clearStarterData(clearButton.dataset.clearData);
    return;
  }

  const settingsCard = event.target.closest("[data-settings-action]");
  if (settingsCard) {
    renderSettingsDetail(settingsCard.dataset.settingsAction);
    return;
  }

  const resetHeaderThemeButton = event.target.closest("#resetHeaderThemePreviewButton");
  if (resetHeaderThemeButton) {
    resetHeaderThemePreview();
    return;
  }

  const plannerWeekTab = event.target.closest("[data-planner-week]");
  if (plannerWeekTab) {
    activePlannerWeek = plannerWeekTab.dataset.plannerWeek;
    renderPlanner();
    return;
  }

  const tscTabButton = event.target.closest("[data-tsc-tab]");
  if (tscTabButton) {
    const section = document.querySelector("#training-safety-compliance");
    const selectedTab = tscTabButton.dataset.tscTab || "dashboard";
    section?.querySelectorAll("[data-tsc-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tscTab === selectedTab);
    });
    section?.querySelectorAll("[data-tsc-panel]").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.tscPanel === selectedTab);
    });
    return;
  }

  const tscNewContentButton = event.target.closest("[data-tsc-content-new]");
  if (tscNewContentButton) {
    openTscContentEditor(null, TSC_TOOLBOX_TALK_COMMUNICATION_TYPE);
    return;
  }

  const tscNewAnnouncementButton = event.target.closest("[data-tsc-announcement-new]");
  if (tscNewAnnouncementButton) {
    openTscAnnouncementEditor();
    return;
  }

  const tscCancelAnnouncementButton = event.target.closest("[data-tsc-announcement-cancel]");
  if (tscCancelAnnouncementButton) {
    document.querySelector("#tscAnnouncementEditor").hidden = true;
    return;
  }

  const tscSaveAnnouncementButton = event.target.closest("[data-tsc-announcement-save-draft]");
  if (tscSaveAnnouncementButton) {
    await saveTscAnnouncement("Draft");
    return;
  }

  const tscSendAnnouncementButton = event.target.closest("[data-tsc-announcement-send]");
  if (tscSendAnnouncementButton) {
    await sendTscAnnouncement();
    return;
  }

  const tscCancelContentButton = event.target.closest("[data-tsc-content-cancel]");
  if (tscCancelContentButton) {
    document.querySelector("#tscContentEditor").hidden = true;
    return;
  }

  const tscSaveDraftButton = event.target.closest("[data-tsc-content-save-draft]");
  if (tscSaveDraftButton) {
    await saveTscContent("Draft");
    return;
  }

  const tscSubmitContentButton = event.target.closest("[data-tsc-content-submit]");
  if (tscSubmitContentButton) {
    await saveTscContent("Submitted for Approval");
    return;
  }

  const tscEditContentButton = event.target.closest("[data-tsc-content-edit]");
  if (tscEditContentButton) {
    const item = tscContentById(tscEditContentButton.dataset.tscContentEdit);
    if (tscCommunicationTypeForContent(item || {}) === TSC_ANNOUNCEMENT_COMMUNICATION_TYPE) {
      openTscAnnouncementEditor(item);
    } else {
      openTscContentEditor(item);
    }
    return;
  }

  const tscViewContentButton = event.target.closest("[data-tsc-content-view]");
  if (tscViewContentButton) {
    await viewTscContent(tscViewContentButton.dataset.tscContentView);
    return;
  }

  const tscCloneContentButton = event.target.closest("[data-tsc-content-clone]");
  if (tscCloneContentButton) {
    cloneTscContent(tscCloneContentButton.dataset.tscContentClone);
    return;
  }

  const tscApproveContentButton = event.target.closest("[data-tsc-content-approve]");
  if (tscApproveContentButton) {
    await updateTscContentStatus(tscApproveContentButton.dataset.tscContentApprove, "Approved");
    return;
  }

  const tscArchiveContentButton = event.target.closest("[data-tsc-content-archive]");
  if (tscArchiveContentButton) {
    await updateTscContentStatus(tscArchiveContentButton.dataset.tscContentArchive, "Archived");
    return;
  }

  const tscPublishContentButton = event.target.closest("[data-tsc-content-publish]");
  if (tscPublishContentButton) {
    await publishTscContent(tscPublishContentButton.dataset.tscContentPublish);
    return;
  }

  const tscIssueContentButton = event.target.closest("[data-tsc-content-issue]");
  if (tscIssueContentButton) {
    await openTscIssueWizard(tscIssueContentButton.dataset.tscContentIssue);
    return;
  }

  const tscIssueCancelButton = event.target.closest("[data-tsc-issue-cancel]");
  if (tscIssueCancelButton) {
    document.querySelector("#tscIssueWizard").hidden = true;
    return;
  }

  const tscIssueSaveButton = event.target.closest("[data-tsc-issue-save]");
  if (tscIssueSaveButton) {
    await saveTscIssue();
    return;
  }

  const tscDetailButton = event.target.closest("[data-tsc-detail-open]");
  if (tscDetailButton) {
    selectedTscIssueId = tscDetailButton.dataset.tscDetailOpen || "";
    const detailPanel = document.querySelector("[data-tsc-communication-detail]");
    if (detailPanel) {
      detailPanel.hidden = false;
      renderTscCommunicationDetail();
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      detailPanel.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
    }
    return;
  }

  const weeklyLeaveButton = event.target.closest("[data-weekly-leave-open]");
  if (weeklyLeaveButton) {
    openHolidayPlannerRecord(weeklyLeaveButton.dataset.weeklyLeaveOpen);
    return;
  }

  const valuationCheckbox = event.target.closest("[data-valuation-checked]");
  if (valuationCheckbox) {
    toggleValuationChecked(valuationCheckbox.dataset.valuationChecked, valuationCheckbox.checked);
    return;
  }

  const approveHolidayButton = event.target.closest("[data-approve-holiday]");
  if (approveHolidayButton) {
    approveHolidayRequest(approveHolidayButton.dataset.approveHoliday);
    return;
  }

  const declineHolidayButton = event.target.closest("[data-decline-holiday]");
  if (declineHolidayButton) {
    declineHolidayRequest(declineHolidayButton.dataset.declineHoliday);
    return;
  }

  const staffNotificationButton = event.target.closest("[data-open-staff-notification]");
  if (staffNotificationButton) {
    openStaffNotification(staffNotificationButton.dataset.openStaffNotification);
    return;
  }

  const holidayPlannerOpenButton = event.target.closest("[data-holiday-planner-open]");
  if (holidayPlannerOpenButton) {
    openHolidayPlannerRecord(holidayPlannerOpenButton.dataset.holidayPlannerOpen);
    return;
  }

  const holidayPlannerDayButton = event.target.closest("[data-holiday-day]");
  if (holidayPlannerDayButton) {
    const date = holidayPlannerDayButton.dataset.holidayDay || "";
    expandedHolidayPlannerDay = expandedHolidayPlannerDay === date ? "" : date;
    renderHolidayPlanner();
    return;
  }

  const removeFineEvidenceButton = event.target.closest("[data-remove-fine-evidence]");
  if (removeFineEvidenceButton) {
    fineEvidenceDraft.splice(Number(removeFineEvidenceButton.dataset.removeFineEvidence), 1);
    renderFineEvidencePreview();
    return;
  }

  const openFineEvidenceButton = event.target.closest("[data-open-fine-evidence]");
  if (openFineEvidenceButton) {
    const evidence = fineEvidenceDraft[Number(openFineEvidenceButton.dataset.openFineEvidence)];
    if (evidence?.dataUrl) {
      window.open(evidence.dataUrl, "_blank", "noopener");
    }
    return;
  }

  const removeTrainingDocumentButton = event.target.closest("[data-remove-training-document]");
  if (removeTrainingDocumentButton) {
    trainingDocumentDraft = null;
    renderTrainingDocumentPreview();
    return;
  }

  const openTrainingDocumentButton = event.target.closest("[data-open-training-document]");
  if (openTrainingDocumentButton) {
    if (trainingDocumentDraft?.dataUrl) {
      window.open(trainingDocumentDraft.dataUrl, "_blank", "noopener");
    }
    return;
  }

  const viewTrainingButton = event.target.closest("[data-view-training]");
  if (viewTrainingButton) {
    showTrainingRecord(viewTrainingButton.dataset.viewTraining);
    return;
  }

  const openTrainingCertificateButton = event.target.closest("[data-open-training-certificate]");
  if (openTrainingCertificateButton) {
    openTrainingCertificate(openTrainingCertificateButton.dataset.openTrainingCertificate);
    return;
  }

  if (event.target.closest("[data-close-certificate-viewer]")) {
    certificateViewerDialog?.close();
    return;
  }

  if (event.target.closest("[data-certificate-open-file]")) {
    if (activeCertificateRecord?.oneDriveLocation) {
      window.open(localFileUrl(activeCertificateRecord.oneDriveLocation), "_blank", "noopener");
    }
    return;
  }

  if (event.target.closest("[data-certificate-open-folder]")) {
    if (activeCertificateRecord?.oneDriveLocation) {
      window.open(localFolderUrl(activeCertificateRecord.oneDriveLocation), "_blank", "noopener");
    }
    return;
  }

  if (event.target.closest("[data-certificate-download]")) {
    if (activeCertificateRecord?.oneDriveLocation) {
      const link = document.createElement("a");
      link.href = localFileUrl(activeCertificateRecord.oneDriveLocation);
      link.download = activeCertificateRecord.documentFileName || activeCertificateRecord.certificate || "certificate";
      link.click();
    }
      return;
  }

  async function openCompletedReportFolder(reportId, button) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Opening...";
    try {
      let opened = false;
      for (const url of hubApiUrls("/api/phase-05e/open-report-folder")) {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reportId })
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok && data.ok && (data.launchAccepted || data.opened || data.validated)) {
            opened = true;
            break;
          }
          if (data?.message) {
            await kcInfo(data.message);
            return;
          }
        } catch {
          // Try the next local helper port.
        }
      }
      if (!opened) {
        await kcInfo("Unable to open the OneDrive folder.");
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  const openReportFolderButton = event.target.closest("[data-open-report-folder]");
  if (openReportFolderButton) {
    openCompletedReportFolder(openReportFolderButton.dataset.openReportFolder, openReportFolderButton);
    return;
  }

  const historyExpandButton = event.target.closest("[data-history-expand]");
  if (historyExpandButton) {
    const card = historyExpandButton.closest(".history-card");
    const expanded = historyExpandButton.getAttribute("aria-expanded") === "true";
    historyExpandButton.setAttribute("aria-expanded", String(!expanded));
    card?.classList.toggle("expanded", !expanded);
    return;
  }

  const viewPhase05eReportButton = event.target.closest("[data-view-phase05e-report]");
  if (viewPhase05eReportButton) {
    openPhase05eReportDetail(viewPhase05eReportButton.dataset.viewPhase05eReport);
    return;
  }

  const viewHistoryJobButton = event.target.closest("[data-view-job]");
  if (viewHistoryJobButton) {
    openJobDetail(viewHistoryJobButton.dataset.viewJob);
    return;
  }

  const removeComplianceDocumentButton = event.target.closest("[data-remove-compliance-document]");
  if (removeComplianceDocumentButton) {
    complianceDocumentDraft = null;
    renderComplianceDocumentPreview();
    return;
  }

  const removeAssetDocumentButton = event.target.closest("[data-remove-asset-document]");
  if (removeAssetDocumentButton) {
    assetDocumentDraft.splice(Number(removeAssetDocumentButton.dataset.removeAssetDocument), 1);
    renderAssetDocumentPreview();
    return;
  }

  const openAssetDraftButton = event.target.closest("[data-open-asset-document]");
  if (openAssetDraftButton) {
    const item = assetDocumentDraft[Number(openAssetDraftButton.dataset.openAssetDocument)];
    if (item?.dataUrl) window.open(item.dataUrl, "_blank", "noopener");
    else if (item?.filePath) window.open(localFileUrl(item.filePath), "_blank", "noopener");
    return;
  }

  const openComplianceDraftButton = event.target.closest("[data-open-compliance-document]");
  if (openComplianceDraftButton) {
    if (complianceDocumentDraft?.dataUrl) {
      window.open(complianceDocumentDraft.dataUrl, "_blank", "noopener");
    }
    return;
  }

  const viewComplianceButton = event.target.closest("[data-view-compliance]");
  if (viewComplianceButton) {
    showComplianceRecord(viewComplianceButton.dataset.viewCompliance);
    return;
  }

  const viewAssetButton = event.target.closest("[data-view-asset]");
  if (viewAssetButton) {
    showAssetProfile(viewAssetButton.dataset.viewAsset);
    return;
  }

  const assetCard = event.target.closest("[data-asset-card-filter]");
  if (assetCard) {
    activeAssetFilter = assetCard.dataset.assetCardFilter || "all";
    const dueSelect = document.querySelector("#assetDueFilter");
    if (dueSelect) dueSelect.value = ["inspection", "service", "repair"].includes(activeAssetFilter) ? activeAssetFilter : "all";
    renderAssets();
    return;
  }

  const assetActionButton = event.target.closest("[data-asset-action]");
  if (assetActionButton) {
    handleAssetAction(assetActionButton.dataset.assetAction, assetActionButton.dataset.assetIndex);
    return;
  }

  const openComplianceButton = event.target.closest("[data-open-compliance-document-record]");
  if (openComplianceButton) {
    openComplianceDocument(openComplianceButton.dataset.openComplianceDocumentRecord);
    return;
  }

  const replaceComplianceButton = event.target.closest("[data-replace-compliance-document]");
  if (replaceComplianceButton) {
    openDataDialog("compliance", replaceComplianceButton.dataset.replaceComplianceDocument);
    return;
  }

  const renewComplianceButton = event.target.closest("[data-renew-compliance]");
  if (renewComplianceButton) {
    renewComplianceRecord(renewComplianceButton.dataset.renewCompliance);
    return;
  }

  const replaceTrainingCertificateButton = event.target.closest("[data-replace-training-certificate]");
  if (replaceTrainingCertificateButton) {
    openDataDialog("training", replaceTrainingCertificateButton.dataset.replaceTrainingCertificate);
    return;
  }

  const trainingLifecycleButton = event.target.closest("[data-training-lifecycle]");
  if (trainingLifecycleButton) {
    await updateTrainingLifecycle(trainingLifecycleButton.dataset.trainingIndex, trainingLifecycleButton.dataset.trainingLifecycle);
    return;
  }

  const trainingCard = event.target.closest("[data-training-card-filter]");
  if (trainingCard) {
    activeTrainingFilter = trainingCard.dataset.trainingCardFilter || "all";
    const statusSelect = document.querySelector("#trainingStatusFilter");
    if (statusSelect) statusSelect.value = activeTrainingFilter === "all" ? "all" : activeTrainingFilter;
    renderTrainingMatrix();
    return;
  }

  const complianceCard = event.target.closest("[data-compliance-card-filter]");
  if (complianceCard) {
    activeComplianceFilter = complianceCard.dataset.complianceCardFilter || "all";
    const statusSelect = document.querySelector("#complianceStatusFilter");
    if (statusSelect) statusSelect.value = activeComplianceFilter === "all" ? "all" : activeComplianceFilter;
    renderCompliance();
    return;
  }

  const dashboardComplianceFilter = event.target.closest("[data-dashboard-compliance-filter]");
  if (dashboardComplianceFilter) {
    showSection("compliance");
    const filter = dashboardComplianceFilter.dataset.dashboardComplianceFilter;
    const statusSelect = document.querySelector("#complianceStatusFilter");
    const expirySelect = document.querySelector("#complianceExpiryFilter");
    if (filter === "Overdue") {
      activeComplianceFilter = "Overdue";
      if (statusSelect) statusSelect.value = "Overdue";
      if (expirySelect) expirySelect.value = "all";
    } else if (filter === "30") {
      activeComplianceFilter = "all";
      if (statusSelect) statusSelect.value = "all";
      if (expirySelect) expirySelect.value = "30";
    }
    renderCompliance();
    return;
  }

  const trainingDashboardFilter = event.target.closest("[data-training-dashboard-filter]");
  if (trainingDashboardFilter) {
    showSection("training");
    const filter = trainingDashboardFilter.dataset.trainingDashboardFilter;
    activeTrainingFilter = filter === "expired" ? "expired" : "all";
    const statusSelect = document.querySelector("#trainingStatusFilter");
    const expirySelect = document.querySelector("#trainingExpiryFilter");
    if (statusSelect) statusSelect.value = filter === "expired" ? "expired" : "all";
    if (expirySelect) expirySelect.value = filter === "30" ? "30" : "all";
    renderTrainingMatrix();
    return;
  }

  const geofenceToggle = event.target.closest("[data-technician-geofence-toggle]");
  if (geofenceToggle) {
    technicianGeofenceTestMode = !technicianGeofenceTestMode;
    renderTechnicians();
    return;
  }

  const geofenceButton = event.target.closest("[data-technician-geofence]");
  if (geofenceButton) {
    const name = geofenceButton.dataset.technicianName || "";
    const mode = geofenceButton.dataset.technicianGeofence;
    const distanceByMode = {
      near: 0.2,
      away: 1.4,
      unavailable: null,
      offline: null
    };
    technicianGeofenceTestLocations[name] = {
      mode,
      distance: distanceByMode[mode],
      lastUpdate: new Date().toISOString()
    };
    renderTechnicians();
    return;
  }

  const technicianActionButton = event.target.closest("[data-technician-action]");
  if (technicianActionButton) {
    const name = technicianActionButton.dataset.technicianName || "Technician";
    const action = technicianActionButton.dataset.technicianAction;
    if (action === "view") {
      showSection("staff");
      activeStaffTab = "overview";
      renderStaff();
      await kcInfo(`${name}'s full employee file is managed in Staff Management.`);
      return;
    }
    if (action === "app") {
      await kcInfo(`${name}'s technician app feed is generated from sent jobs and staff availability. A separate live technician app screen is not connected yet.`);
      return;
    }
    if (action === "message") {
      await kcInfo("Technician messaging is coming later. No message has been sent.");
      return;
    }
    if (action === "pin") {
      await kcInfo("PIN reset is coming later. Current PIN records have not been changed.");
      return;
    }
    if (action === "disable") {
      await kcInfo("Disable App Access is coming later. No technician access has been changed.");
      return;
    }
  }

  const selectStaffButton = event.target.closest("[data-select-staff]");
  if (selectStaffButton) {
    selectedStaffIndex = Number(selectStaffButton.dataset.selectStaff);
    renderStaff();
    return;
  }

  const staffTabButton = event.target.closest("[data-staff-tab]");
  if (staffTabButton) {
    activeStaffTab = staffTabButton.dataset.staffTab;
    renderStaff();
    return;
  }

  const viewStaffButton = event.target.closest("[data-view-staff]");
  if (viewStaffButton) {
    openStaffDetail(viewStaffButton.dataset.viewStaff);
    return;
  }

  const sickCallButton = event.target.closest("[data-sick-call]");
  if (sickCallButton) {
    openSickCallDialog(sickCallButton.dataset.sickCall);
    return;
  }

  const staffEditButton = event.target.closest("[data-staff-detail-edit]");
  if (staffEditButton) {
    staffDetailDialog?.close();
    openDataDialog("staff", staffEditButton.dataset.staffDetailEdit);
    return;
  }

  const staffAttendanceButton = event.target.closest("[data-staff-detail-attendance]");
  if (staffAttendanceButton) {
    staffDetailDialog?.close();
    openAttendanceDialog(staffAttendanceButton.dataset.staffDetailAttendance);
    return;
  }

  const editAttendanceButton = event.target.closest("[data-edit-attendance]");
  if (editAttendanceButton) {
    const record = attendanceRecords[Number(editAttendanceButton.dataset.editAttendance)];
    if (record) openAttendanceDialog(record.name, editAttendanceButton.dataset.editAttendance);
    return;
  }

  const voidAttendanceButton = event.target.closest("[data-void-attendance]");
  if (voidAttendanceButton) {
    const record = attendanceRecords[Number(voidAttendanceButton.dataset.voidAttendance)];
    if (!record || attendanceIsVoid(record)) return;
    const reason = await kcInput("Please enter the reason for voiding this attendance record.", "Void reason");
    if (reason === "cancel") return;
    attendanceRecordIndex.value = voidAttendanceButton.dataset.voidAttendance;
    attendanceCorrectionReason.value = reason || "";
    await saveAttendanceDialog("void");
    return;
  }

  const staffHolidayButton = event.target.closest("[data-staff-detail-holiday]");
  if (staffHolidayButton) {
    staffDetailDialog?.close();
    openDataDialog("holidays", "", {
      name: staffHolidayButton.dataset.staffDetailHoliday,
      from: today,
      to: today,
      days: 1,
      status: "Pending"
    });
    return;
  }

  const openStaffHolidayPlannerButton = event.target.closest("[data-open-staff-holiday-planner]");
  if (openStaffHolidayPlannerButton) {
    staffDetailDialog?.close();
    openStaffHolidayPlanner(openStaffHolidayPlannerButton.dataset.openStaffHolidayPlanner);
    return;
  }

  const manageButton = event.target.closest("[data-manage]");
  if (manageButton?.dataset.manage) {
    openDataDialog(manageButton.dataset.manage);
    return;
  }

  const removeVehicleAssignmentButton = event.target.closest("[data-remove-vehicle-assignment]");
  if (removeVehicleAssignmentButton) {
    await updateVehicleAssignment(removeVehicleAssignmentButton.dataset.removeVehicleAssignment, "");
    return;
  }

  const viewVehicleRecordButton = event.target.closest("[data-view-vehicle-record]");
  if (viewVehicleRecordButton) {
    vehicleDocumentDraft = null;
    vehicleMaintenanceDraft = null;
    renderVehicleRecordDetail(viewVehicleRecordButton.dataset.viewVehicleRecord);
    return;
  }

  const closeVehicleRecordButton = event.target.closest("[data-close-vehicle-record]");
  if (closeVehicleRecordButton) {
    activeVehicleRecordId = "";
    vehicleDocumentDraft = null;
    vehicleMaintenanceDraft = null;
    renderVehicleRecordDetail("");
    return;
  }

  const openVehicleDocumentButton = event.target.closest("[data-open-vehicle-document]");
  if (openVehicleDocumentButton) {
    await openVehicleDocument(openVehicleDocumentButton.dataset.openVehicleDocument);
    return;
  }

  const supersedeVehicleDocumentButton = event.target.closest("[data-supersede-vehicle-document]");
  if (supersedeVehicleDocumentButton) {
    await supersedeVehicleDocument(supersedeVehicleDocumentButton.dataset.supersedeVehicleDocument);
    return;
  }

  const refreshVehicleInspectionsButton = event.target.closest("[data-refresh-vehicle-inspections]");
  if (refreshVehicleInspectionsButton) {
    await refreshVehicleInspectionReviews();
    return;
  }

  const viewVehicleInspectionButton = event.target.closest("[data-view-vehicle-inspection]");
  if (viewVehicleInspectionButton) {
    renderVehicleInspectionDetail(viewVehicleInspectionButton.dataset.viewVehicleInspection);
    return;
  }

  const editButton = event.target.closest("[data-edit-record]");
  if (editButton) {
    openDataDialog(editButton.dataset.editRecord, editButton.dataset.recordIndex);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-record]");
  if (deleteButton) {
    deleteDataRecord(deleteButton.dataset.deleteRecord, deleteButton.dataset.recordIndex);
    return;
  }

  const phase05eReportButton = event.target.closest("[data-open-phase05e-report]");
  if (phase05eReportButton) {
    openPhase05eReportDetail(phase05eReportButton.dataset.openPhase05eReport);
    return;
  }

  const jumpButton = event.target.closest("[data-jump-section]");
  if (jumpButton) {
    showSection(jumpButton.dataset.jumpSection);
  }
});

let dataDialogSaving = false;

dataForm.addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") {
    return;
  }

  event.preventDefault();
  if (dataDialogSaving) return;
  dataDialogSaving = true;
  if (dataSaveButton) dataSaveButton.disabled = true;
  if (dataSaveSystemButton) dataSaveSystemButton.disabled = true;
  setDataDialogStatus(dataDialogProgressMessage(dataCollectionInput.value), "");
  try {
    const saved = await saveDataDialog(event.submitter?.value || "default");
    if (saved !== false) {
      dataDialog.close();
    }
  } finally {
    dataDialogSaving = false;
    if (dataSaveButton) dataSaveButton.disabled = false;
    if (dataSaveSystemButton) dataSaveSystemButton.disabled = false;
  }
});

document.addEventListener("submit", async (event) => {
  const inspectionReviewForm = event.target.closest("[data-vehicle-inspection-review-form]");
  if (inspectionReviewForm) {
    event.preventDefault();
    await saveVehicleInspectionReview(inspectionReviewForm);
    return;
  }

  const defectReviewForm = event.target.closest("[data-vehicle-defect-review-form]");
  if (defectReviewForm) {
    event.preventDefault();
    await saveVehicleDefectReview(defectReviewForm);
    return;
  }

  const vehicleDocumentForm = event.target.closest("[data-vehicle-document-form]");
  if (vehicleDocumentForm) {
    event.preventDefault();
    await saveVehicleDocument(vehicleDocumentForm);
    return;
  }

  const vehicleMaintenanceForm = event.target.closest("[data-vehicle-maintenance-form]");
  if (vehicleMaintenanceForm) {
    event.preventDefault();
    await saveVehicleMaintenance(vehicleMaintenanceForm);
  }
});

form.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") {
    return;
  }

  event.preventDefault();
  saveFromForm();
  dialog.close();
});

tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  const item = ramsItems.find((rams) => rams.id === button.dataset.id);
  if (!item) {
    return;
  }

  if (button.dataset.action === "revise") {
    openRamsBuilder(item);
  }

  if (button.dataset.action === "edit") {
    openDialog(item);
  }

  if (button.dataset.action === "markSent") {
    item.status = "sent-client";
    item.sentDate = item.sentDate || new Date().toISOString().slice(0, 10);
    saveRams();
    render();
  }

  if (button.dataset.action === "markRead") {
    item.status = "read";
    item.techSentDate = item.techSentDate || new Date().toISOString().slice(0, 10);
    item.techReadDate = item.techReadDate || new Date().toISOString().slice(0, 10);
    saveRams();
    render();
  }

  if (button.dataset.action === "delete") {
    ramsItems = ramsItems.filter((rams) => rams.id !== item.id);
    saveRams();
    render();
  }
});

["#dashboardJobDateFilter", "#dashboardTechnicianFilter", "#dashboardStatusFilter"].forEach((selector) => {
  document.querySelector(selector)?.addEventListener("change", renderDashboard);
});

installNavIcons();
syncSidebarGroupsForSection(document.querySelector(".nav-button.active")?.dataset.section || "dashboard");
initialiseAuth();
syncDirectorsMenuVisibility();
updateLiveDateTime();
setInterval(updateLiveDateTime, 30000);
applyDashboardHeaderTheme();
updateHeaderSceneMotionState();
updateOrpingtonWeather();
setInterval(updateOrpingtonWeather, 600000);
loadCommandData();



