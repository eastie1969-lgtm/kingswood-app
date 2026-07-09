const storageKey = "kingswood-hub-rams";
const authStorageKey = "kingswood-hub-user";
const sectionStorageKey = "kingswood-hub-section";
const staffPendingStorageKey = "kingswood-staff-records-pending";
const staffLastSavedStorageKey = "kingswood-staff-records-last-saved";
const finesPendingStorageKey = "kingswood-fines-pending";
const oneDrivePendingStorageKey = "kingswood-hub-onedrive-pending";
const oneDriveLastSavedStorageKey = "kingswood-hub-onedrive-last-saved";
const oneDriveAutoSyncIntervalMs = 30000;
const appVersion = "182";
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
let oneDriveLiveDataLoaded = false;
let oneDriveAutoSyncTimer = null;
let oneDriveAutoSyncRunning = false;
let trackingMode = "test";
let trackingMapViews = new Map();
let trackingMoveTimer = null;
let selectedTrackingVehicleId = "kw-test-1";
let technicianGeofenceTestMode = true;
let technicianGeofenceTestLocations = {};
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
  Kevin: "1969",
  Alex: "1981",
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

let companyHolidays = [];
let leaveAllowanceResetYear = "";

const ukBankHolidays = [
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
  { title: "Boxing Day substitute day", date: "2027-12-28", type: "Bank holiday" }
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
  { id: "storage", title: "Data Storage", description: "OneDrive-backed Hub storage status" }
];

const dashboardCardMeta = {
  jobsTodayCount: ["calendar", "Booked in for today", "jobs"],
  jobsTomorrowCount: ["calendar", "Next working day", "jobs"],
  reportsDueCount: ["file-text", "Reports waiting", "reports"],
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
      ["jobDetails", "Job details", "snippet-textarea"],
      ["reportNotes", "Report notes", "textarea"],
      ["photos", "Screenshot / photos", "snippet-textarea"],
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
      ["registration", "Registration"],
      ["vehicle", "Vehicle"],
      ["driver", "Assigned driver", "staff-select"],
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
  return [...new Set(staffProfiles.map((staff) => staff.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
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

function updateLiveDateTime() {
  liveDateTime.textContent = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
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

    weatherCurrent.textContent = `${currentTemp}°C ${description}`;
    weatherSummary.textContent = `H ${high}° / L ${low}°${rainText}`;
  } catch {
    weatherCurrent.textContent = "Weather unavailable";
    weatherSummary.textContent = "Will refresh automatically";
  }
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
  if (signedInUser) signedInUser.textContent = "REVIEW MODE";
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

function unlockHub(name) {
  if (isReviewMode()) {
    applyReviewModeShell();
    return;
  }
  localStorage.setItem(authStorageKey, name);
  document.body.classList.remove("locked");
  authScreen?.setAttribute("aria-hidden", "true");
  if (userGreeting) userGreeting.textContent = greetingForNow(name);
  if (signedInUser) signedInUser.textContent = `Signed in as ${name}`;
  if (pinInput) pinInput.value = "";
  if (loginNameInput) loginNameInput.value = name;
  if (pinMessage) pinMessage.textContent = "";
}

function lockHub() {
  if (isReviewMode()) {
    applyReviewModeShell();
    return;
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
}

function currentUserName() {
  if (isReviewMode()) return "Review Mode";
  return localStorage.getItem(authStorageKey) || "Kevin";
}

function initialiseAuth() {
  if (isReviewMode()) {
    applyReviewModeShell();
    return;
  }
  const rememberedUser = localStorage.getItem(authStorageKey);
  if (rememberedUser) {
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
    const title = metric.querySelector("span")?.textContent.trim() || "Metric";
    const meta = dashboardCardMeta[value.id] || ["dashboard", "Live dashboard count", "items"];
    metric.dataset.countId = value.id;
    metric.innerHTML = `
      <div class="metric-heading kw-card-header">
        <span class="metric-title kw-label">${escapeHtml(title)}</span>
        <span class="metric-inline kw-sub-label"><i aria-hidden="true"></i><span id="${value.id}Badge">0 ${meta[2]}</span></span>
      </div>
      <p class="metric-subtitle kw-card-hint">${escapeHtml(meta[1])}</p>
      <strong class="metric-value kw-metric" id="${value.id}">${escapeHtml(value.textContent)}</strong>
    `;
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
    staffId: record.staffId || idByName.get(record.name) || "",
    year: record.year || String(new Date(record.date || today).getFullYear())
  }));
  trainingMatrix = trainingMatrix.map((record) => {
    const id = record.id || record.trainingRecordId || `TRN-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
      ...record,
      id,
      trainingRecordId: id,
      staffId: record.staffId || idByName.get(record.employee) || "",
      employee: record.employee || staffProfiles.find((staff) => staff.staffId === record.staffId)?.name || "",
      course: record.course || record.training || record.name || "",
      provider: record.provider || "",
      certificateNumber: record.certificateNumber || record.licenceNumber || "",
      noExpiry: Boolean(record.noExpiry || record.expiryDate === "No Expiry"),
      certificate: record.certificate || record.documentFileName || "",
      documentFileName: record.documentFileName || record.certificate || "",
      oneDriveLocation: record.oneDriveLocation || record.documentLocation || "",
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

function commandData() {
  ensureStaffRecordIds();
  normalisePlannerItems();
  syncStaffTrainingFromMatrix();
  syncTechniciansFromStaff();
  syncValuationsFromJobs();
  return {
    ramsItems,
    proofingReports,
    jobs,
    vehicles,
    technicians,
    staffProfiles,
    attendanceRecords,
    holidayRequests,
    companyHolidays,
    trainingMatrix,
    weeklyPlanner,
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

function applyCommandData(data) {
  if (Array.isArray(data.ramsItems)) ramsItems = data.ramsItems;
  if (Array.isArray(data.proofingReports)) proofingReports = data.proofingReports;
  if (Array.isArray(data.jobs)) jobs = data.jobs;
  if (Array.isArray(data.vehicles)) vehicles = data.vehicles;
  if (Array.isArray(data.technicians)) technicians = data.technicians;
  if (Array.isArray(data.staffProfiles)) staffProfiles = data.staffProfiles;
  if (Array.isArray(data.attendanceRecords)) attendanceRecords = data.attendanceRecords;
  if (Array.isArray(data.holidayRequests)) holidayRequests = data.holidayRequests;
  if (Array.isArray(data.companyHolidays)) companyHolidays = data.companyHolidays;
  if (Array.isArray(data.trainingMatrix)) trainingMatrix = data.trainingMatrix;
  if (Array.isArray(data.weeklyPlanner)) weeklyPlanner = data.weeklyPlanner;
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
  let leaveResetChanged = false;
  startOneDriveAutoSync();
  updateOneDriveHeaderStatus("OneDrive unavailable", "Checking OneDrive storage");
  if (location.protocol === "file:") {
    try {
      const serverResponse = await fetchFirstHubApi("/api/data", { cache: "no-store" });
      if (redirectFileViewToHub(serverResponse?.url)) return;
      const response = serverResponse || await fetch("data/command-centre-data.json", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        if (Object.keys(data).length > 0) {
          applyCommandData(data);
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
    render();
    applyInitialSectionFromUrl();
    return;
  }

  try {
    const response = await fetch("/api/data", { cache: "no-store" });
    const data = await response.json();

    if (Object.keys(data).length > 0) {
      applyCommandData(data);
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
    const response = await fetchFirstHubApi("/api/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload, null, 2)
    });
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
    const response = await fetch("/api/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload, null, 2)
    });

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
    return {
      registration: vehicle[0] || "",
      vehicle: vehicle[1] || "",
      driver: vehicle[2] || "",
      mot: vehicle[3] || "",
      service: vehicle[4] || "",
      insurance: vehicle[5] || "",
      tracker: vehicle[6] || ""
    };
  }
  return vehicle || {};
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
      return renderSelectField(key, label, fieldValue(item, key), ["Ark", "JG Pest Control", "Other"]);
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
      return `
        <label class="full-width snippet-label">
          ${label}
          <textarea class="snippet-target" data-field="${key}" data-snippet-field="${key}" rows="4" placeholder="Paste or drag a Snipping Tool screenshot here, or type notes.">${value}</textarea>
          <span class="field-hint">Accepts typed notes, pasted screenshots, or dragged image files.</span>
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
    dates.push(cursor.toISOString().slice(0, 10));
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
  while (recordDates.has(check.toISOString().slice(0, 10))) {
    count += 1;
    check.setDate(check.getDate() - 1);
  }
  check.setTime(start.getTime());
  check.setDate(check.getDate() + 1);
  while (recordDates.has(check.toISOString().slice(0, 10))) {
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

function removeJobFromWeeklyPlanner(job) {
  if (!job?.number) return;
  weeklyPlanner = weeklyPlanner.filter((slot) => !(slot.source === "job-dispatch" && slot.jobNumber === job.number));
}

function applyApprovedHolidayRequest(request) {
  if (request.status !== "Approved") return;
  normaliseHolidayRequestTiming(request);
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
      holidayRequestId: request.id || ""
    };
    if (existing) Object.assign(existing, holidayRecord);
    else attendanceRecords.push(holidayRecord);
  });
  addApprovedHolidayToPlanner(request);
}

function addApprovedHolidayToPlanner(request) {
  if (request.status !== "Approved") return;
  normaliseHolidayRequestTiming(request);
  if (request.id) {
    weeklyPlanner = weeklyPlanner.filter((slot) => slot.holidayRequestId !== request.id);
  }
  workingDateRangeValues(request.from, request.to).forEach((date) => {
    const sessions = request.dayType === "Half day" ? [request.dayPart || "AM"] : ["AM", "PM"];
    sessions.forEach((session) => {
      const item = applyPlannerMetadata({
        date,
        technician: request.name,
        session,
        type: "Holiday / course / training",
        task: request.dayType === "Half day" ? `HOLIDAY ${session}` : "HOLIDAY",
        source: "approved-holiday",
        holidayRequestId: request.id || "",
        staffId: request.staffId || ""
      });
      const existingIndex = weeklyPlanner.findIndex((slot) =>
        slot.date === date && slot.technician === request.name && (slot.session || "AM") === session
      );
      if (existingIndex >= 0) {
        weeklyPlanner[existingIndex] = { ...weeklyPlanner[existingIndex], ...item };
      } else {
        weeklyPlanner.push(item);
      }
    });
  });
}

async function approveHolidayRequest(index) {
  const request = holidayRequests[Number(index)];
  if (!request || request.status !== "Pending") return;
  const previousRequest = { ...request };
  const previousAttendance = [...attendanceRecords];
  const previousPlanner = [...weeklyPlanner];
  request.status = "Approved";
  request.approvedDate = today;
  request.declineReason = "";
  request.year = request.year || String(new Date(request.from || today).getFullYear());
  applyApprovedHolidayRequest(request);
  const saved = await publishIntegrationFeeds();
  if (!saved) {
    Object.assign(request, previousRequest);
    attendanceRecords = previousAttendance;
    weeklyPlanner = previousPlanner;
    render();
    return;
  }
  render();
  await kcInfo("Holiday request approved. Staff records, Weekly Planner and technician feed have been updated.");
}

async function declineHolidayRequest(index) {
  const request = holidayRequests[Number(index)];
  if (!request || request.status !== "Pending") return;
  const reason = await kcInput("Add an optional reason for declining this holiday request.", "Decline reason");
  if (reason === "cancel") return;
  const previousRequest = { ...request };
  request.status = "Declined";
  request.declinedDate = today;
  request.declineReason = reason || "";
  request.year = request.year || String(new Date(request.from || today).getFullYear());
  const saved = await publishIntegrationFeeds();
  if (!saved) {
    Object.assign(request, previousRequest);
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
  await publishIntegrationFeeds();
  render();
  return true;
}

async function saveDataDialog(action = "default") {
  const collection = dataCollectionInput.value;
  const index = dataIndexInput.value;
  const model = dataModels[collection];
  if (!model) return;

  const previousItem = index === "" ? null : { ...model.get()[Number(index)] };
  const item = index === "" ? {} : { ...previousItem };
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
    const sendingToTech = action === "send-tech";
    if (!(await validateJobDispatchFields(item, sendingToTech))) {
      return false;
    }
    item.status = sendingToTech ? "Sent to Tech" : "Draft";
    item.report = item.report || "Not due";
    item.completed = item.completed || "n";
    item.updatedAt = new Date().toISOString();
    if (sendingToTech) {
      item.sentToTechAt = new Date().toISOString();
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
    if (!sendingToTech) {
      removeJobFromWeeklyPlanner(item);
    }
  }
  if (collection === "attendance") {
    if (!(await validateAttendanceRecord(item))) {
      return false;
    }
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
    if (!item.noExpiry && !item.expiryDate) {
      await kcInfo("Please enter an expiry date, or tick No expiry.");
      return false;
    }
    item.id = item.id || item.trainingRecordId || `TRN-${Date.now()}`;
    item.trainingRecordId = item.id;
    item.staffId = staff.staffId;
    item.employee = staff.name;
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
    await kcInfo("Job sent to tech app.");
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
  return Math.ceil((new Date(dateValue) - new Date(today)) / oneDay);
}

function isReminderDate(dateValue) {
  const days = daysUntil(dateValue);
  return days >= 0 && days <= 45;
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
  weeklyPlanner.forEach((item) => {
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

function valuationMainClientGroup(item) {
  const mainClient = String(item?.mainClient || "").toLowerCase();
  const text = `${mainClient} ${item?.client || ""} ${item?.type || ""}`.toLowerCase();

  if (mainClient.includes("ark")) return "ark";
  if (mainClient.includes("jg") || mainClient.includes("pest control")) return "jg";
  if (mainClient.includes("other") || mainClient.includes("private")) return "other";

  if (item?.sourceSheet) return "ark";
  if (item?.source === "Hub job diary") {
    if (text.includes("jg") || text.includes("pest control")) return "jg";
    if (text.includes("other") || text.includes("private")) return "other";
    return "ark";
  }
  if (text.includes("jg") || text.includes("pest control")) return "jg";
  if (text.includes("other")) return "other";
  return "ark";
}

function jobClientType(job) {
  const text = String(`${job.client || ""} ${job.type || ""}`).toLowerCase();
  if (text.includes("jg") || text.includes("pest control")) {
    return { label: "JG", className: "jg" };
  }
  if (text.includes("private")) {
    return { label: "Private", className: "private" };
  }
  if (text.includes("ark")) {
    return { label: "Ark", className: "ark" };
  }
  if (job.sourceSheet || job.arkRef) {
    return { label: "Ark", className: "ark" };
  }
  return { label: "Other", className: "other" };
}

function isAdminPrivateJob(job) {
  return isPrivateClient(job.client) && !job.sourceSheet;
}

function monthlyValuationTotals() {
  const currentMonth = monthKey();
  return valuationTotalsForMonth(currentMonth);
}

function valuationTotalsForMonth(targetMonth) {
  const totals = { ark: 0, jg: 0, private: 0 };

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

function jobReportReceived(job) {
  const report = String(job.report || "").toLowerCase();
  return report.includes("received") || report.includes("complete") || report.includes("done") || report === "y";
}

function jobCompleted(job) {
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
    <section class="job-detail-section">
      <h3>Pictures</h3>
      ${renderJobAttachments(job)}
    </section>
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
  filter.innerHTML = '<option value="all">All clients</option>' + options
    .map((client) => `<option value="${escapeHtml(client)}">${escapeHtml(client)}</option>`)
    .join("");
  filter.value = options.includes(current) ? current : "all";
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
      total: totals.ark + totals.jg + totals.other
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
    const matchesClient = client === "all" || item.client === client;
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
  return [0, 7, 14].map((days) => plannerWeekFromStart(datePlusDays(currentStart, days)));
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
  tabs.innerHTML = weeks.map((item, index) => {
    const label = index === 0 ? "Current week" : index === 1 ? "Next week" : "Following week";
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

function holidayRequestDaysForYear(request, year) {
  const dates = workingDateRangeValues(request.from, request.to).filter((date) => date.startsWith(year));
  if (!dates.length) return 0;
  if (request.dayType === "Half day" && request.from === request.to && dates.length === 1) return 0.5;
  return Number(request.days) && String(request.from || "").startsWith(year) && String(request.to || "").startsWith(year)
    ? Number(request.days)
    : dates.length;
}

function holidayUsedForYear(name, year = String(new Date().getFullYear())) {
  const approvedRequestIds = new Set();
  const approvedDays = holidayRequests
    .filter((request) => request.name === name && request.status === "Approved")
    .reduce((sum, request) => {
      if (request.id) approvedRequestIds.add(request.id);
      return sum + holidayRequestDaysForYear(request, year);
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
    )
    .reduce((sum, record) => sum + (record.dayType === "Half day" ? 0.5 : 1), 0);
  return approvedDays + legacyDays + companyHolidayDaysForYear(year);
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
  const companyBankDeductions = companyHolidayDaysForYear(year);
  return {
    year,
    holidayAllowance: allowance,
    holidayTaken: taken,
    companyBankDeductions,
    holidayRemaining: allowance - taken,
    sickDays: sicknessDaysForYear(staff.name, year)
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
        role: staff.role,
        phone: staff.phone,
        van: staff.assignedVan || existing.van || "",
        location: existing.location || "Set location",
        training: staff.trainingRecords || existing.training || ""
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

function renderDashboard() {
  enhanceDashboardCards();
  const valuationTotals = monthlyValuationTotals();
  const gateJobs = reportGateJobs();
  document.querySelector("#jobsTodayCount").textContent = jobs.filter((job) => job.date === today).length;
  document.querySelector("#jobsTomorrowCount").textContent = jobs.filter((job) => job.date === tomorrow).length;
  document.querySelector("#reportsDueCount").textContent = jobs.filter((job) => job.report === "Awaiting").length;
  document.querySelector("#valuationMonthLabel").textContent = monthLabel();
  document.querySelector("#valuationDueLabel").textContent = ` | Valuation due ${lastWorkingDayOfMonth()}`;
  document.querySelector("#arkMonthTotal").textContent = money(valuationTotals.ark);
  document.querySelector("#jgMonthTotal").textContent = money(valuationTotals.jg);
  document.querySelector("#privateMonthTotal").textContent = money(valuationTotals.private);
  document.querySelector("#vehicleAlertCount").textContent = vehicles.filter((vehicle) => vehicle.tracker !== "Active" || isReminderDate(vehicle.mot) || isReminderDate(vehicle.insurance)).length;
  document.querySelector("#motReminderCount").textContent = vehicles.filter((vehicle) => isReminderDate(vehicle.mot)).length;
  document.querySelector("#insuranceReminderCount").textContent = vehicles.filter((vehicle) => isReminderDate(vehicle.insurance)).length;
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
  document.querySelector("#complianceDueCount").textContent = compliance.filter((item) => Number.isFinite(item.status.days) && item.status.days >= 0 && item.status.days <= 30).length;
  document.querySelector("#complianceOverdueCount").textContent = compliance.filter((item) => item.status.className === "red").length;
  document.querySelector("#fineDeadlineCount").textContent = fines.filter(isFineDeadlineSoon).length;
  document.querySelector("#openFineCount").textContent = fines.filter(isFineOpen).length;
  const todayAttendance = staffProfiles.map((staff) => attendanceFor(staff.name, today));
  document.querySelector("#staffAvailableCount").textContent = todayAttendance.filter((record) => !isUnavailableStatus(record.status)).length;
  document.querySelector("#staffUnavailableCount").textContent = todayAttendance.filter((record) => isUnavailableStatus(record.status)).length;
  renderDashboardHolidayRequests();

  const dashboardJobs = jobs
    .filter((job) => job.date === today || job.date === tomorrow)
    .map((job) => listRow(`${job.number} - ${job.title}`, `${job.date} | ${job.client} | ${job.technician}`, job.status))
    .join("");
  document.querySelector("#dashboardJobs").innerHTML = dashboardJobs;

  document.querySelector("#technicianLocations").innerHTML = technicians
    .map((tech) => listRow(tech.name, `${tech.location} | ${tech.van}`, "Last update today"))
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
    .map((item) => listRow(`${item.complianceType} - ${item.title}`, `${item.responsiblePerson} | ${item.noExpiry ? "No expiry" : `Due ${formatDateUk(item.expiryDate)}`}`, item.status.label))
    .join("");

  updateDashboardBadges();
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
  const submitted = request.submittedDate ? formatDateUk(request.submittedDate) : "Not recorded";
  const days = request.days || holidayCalculatedDays(request) || workingDateRangeValues(request.from, request.to).length || 0;
  const dayTypeLabel = request.dayType === "Half day" ? ` | ${request.dayPart || "AM"} half day` : "";
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
        ${request.notes ? `<p>${escapeHtml(request.notes)}</p>` : ""}
        ${status === "Declined" && request.declineReason ? `<p>Reason: ${escapeHtml(request.declineReason)}</p>` : ""}
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
  proofingSetStatus("AI is preparing the proofing report sections...");

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
      : "Report sections populated locally. Add/check the OpenAI key to use AI."
    );
  } catch (error) {
    parseProofingNotesLocally();
    proofingSetStatus(`${error.message} Local parsing has been used for now.`, true);
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

function renderVehicles() {
  document.querySelector("#vehiclesTableBody").innerHTML = vehicles.map((vehicle, index) => `
    <tr>
      <td><strong>${vehicle.registration}</strong></td>
      <td>${vehicle.vehicle}</td>
      <td>${vehicle.driver}</td>
      <td><span class="status ${isReminderDate(vehicle.mot) ? "warning" : "ok"}">${vehicle.mot}</span></td>
      <td><span class="status ${isReminderDate(vehicle.insurance) ? "warning" : "ok"}">${vehicle.insurance}</span></td>
      <td><span class="status ${vehicle.tracker === "Active" ? "ok" : "warning"}">${vehicle.tracker}</span><div class="record-actions">${recordButtons("vehicles", index)}</div></td>
    </tr>
  `).join("");
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
  document.querySelector("#plannerUnavailableCount").textContent = `${plannerUnavailableSlotCount(board.weekItems)} / ${board.technicians.length * board.days.length * 2}`;
  document.querySelector("#plannerWeekLabel").textContent = selectedWeek === "all" ? "All" : selectedWeek.replace("WC ", "");
  document.querySelector("#plannerBoard").innerHTML = board.html;
}

function plannerBoardHtml(selectedWeek = plannerCurrentWeek(), rows = null, editable = true) {
  const sourceRows = rows || weeklyPlanner.filter((item) => selectedWeek === "all" || item.week === selectedWeek);
  const weekItems = weeklyPlanner.filter((item) => selectedWeek === "all" || item.week === selectedWeek);
  const selectedWeekStart = plannerWeekStartFromLabel(selectedWeek);
  const techniciansForWeek = [...new Set([
    ...staffProfiles.filter((staff) => String(staff.role || "").toLowerCase().includes("technician")).map((staff) => staff.name),
    ...technicians.map((tech) => tech.name),
    ...weekItems.map((item) => item.technician)
  ].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const days = plannerWeekDays(selectedWeekStart);

  if (!techniciansForWeek.length || !days.length) {
    return {
      days,
      technicians: techniciansForWeek,
      weekItems,
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
            ${days.map((day) => plannerSheetCell(itemLookup.get(`${technician}|${day.date}|${session}`), breakClass, {
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

  return { days, technicians: techniciansForWeek, weekItems, html };
}

function plannerSheetCell(item, breakClass = "", seed = {}, editable = true) {
  const editableClass = editable ? " planner-cell-editable" : "";
  if (!item) {
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
  return `
    <div class="planner-cell${editableClass} ${plannerSlotClass(item)}${breakClass}" data-planner-index="${index}">
      <strong>${escapeHtml(plannerText(item))}</strong>
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
  const max = Math.max(...months.flatMap((item) => [item.ark, item.jg, item.other]), 1);
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
        <strong>${money(selectedTotals.ark + selectedTotals.jg + selectedTotals.other)}</strong>
      </article>
      <article>
        <span>Highest month</span>
        <strong>${money(Math.max(...months.map((item) => item.total), 0))}</strong>
      </article>
    </div>
    <div class="valuation-graph-legend" aria-label="Valuation graph key">
      <span><i class="ark"></i>Ark</span>
      <span><i class="jg"></i>JG Pest Control</span>
      <span><i class="other"></i>Other</span>
    </div>
    <div class="valuation-year-chart" aria-label="Rolling valuation totals">
      ${months.map((item) => `
        <article class="valuation-month-column ${item.key === selectedMonth ? "current" : ""}">
          <div class="valuation-month-bars">
            <i class="ark" title="Ark ${money(item.ark)}" style="height:${Math.max((item.ark / max) * 100, item.ark ? 5 : 0)}%"></i>
            <i class="jg" title="JG Pest Control ${money(item.jg)}" style="height:${Math.max((item.jg / max) * 100, item.jg ? 5 : 0)}%"></i>
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

function staffNextHoliday(staff) {
  return staffHolidayRequestsFor(staff, "Approved")
    .filter((request) => String(request.from || "") >= today)
    .sort((a, b) => String(a.from).localeCompare(String(b.from)))[0];
}

function staffCompactRow(title, detail, status = "") {
  return `
    <article class="staff-compact-row">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail || "")}</p>
      </div>
      ${status ? `<span class="status ${status === "Approved" || status === "Present" ? "ok" : status === "Declined" || status === "Sick" || status === "Absent" || status === "Absent - Called in Sick" ? "urgent" : "warning"}">${escapeHtml(status)}</span>` : ""}
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
  const trainingAlerts = staffTrainingAlertCount(staff);
  const nextHoliday = staffNextHoliday(staff);
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
  const attendanceRows = attendanceRecords
    .filter((record) => record.name === staff.name)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 20)
    .map((record) => staffCompactRow(formatDateUk(record.date), `${record.category || record.returnToWorkNotes || "No notes"}`, record.status))
    .join("");
  const trainingRows = staffTrainingRecords(staff)
    .map((record) => {
      const status = trainingStatus(record);
      return staffCompactRow(record.course, `${record.provider || "Provider not set"} | Expires ${record.expiryDate ? formatDateUk(record.expiryDate) : "not set"}`, status.label);
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
        ${staffProfileMetric("Next booked holiday", nextHoliday ? `${formatDateUk(nextHoliday.from)} to ${formatDateUk(nextHoliday.to)}` : "None booked")}
      </div>
      <section class="staff-tab-section">
        <h4>Recent activity</h4>
        ${recentActivity.length ? recentActivity.map((item) => staffCompactRow(item, "")).join("") : '<p class="empty-state">No recent activity.</p>'}
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
      <div class="staff-tab-actions">
        <button class="primary-button" type="button" data-staff-detail-attendance="${escapeHtml(staff.name)}">Log sick / late / absent</button>
        <button class="secondary-button" type="button" data-sick-call="${escapeHtml(staff.name)}">Sick call-in</button>
      </div>
      <section class="staff-tab-section">
        <h4>Attendance records</h4>
        ${attendanceRows || '<p class="empty-state">No attendance records yet.</p>'}
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
    `,
    documents: `
      <section class="staff-tab-section">
        <h4>Staff documents</h4>
        <p class="empty-state">Licence documents, certificates and other staff documents will be tracked here. Existing employee PDFs in OneDrive remain untouched.</p>
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
  document.querySelector("#trainingExpiringCount").textContent = allRecords.filter((record) => record.status.className === "warning").length;
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
              <button class="danger-button" type="button" data-delete-record="training" data-record-index="${record.index}">Delete</button>
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
      || (statusFilter === "expiring" && record.status.className === "warning")
      || (statusFilter === "expired" && record.status.className === "urgent")
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
    const badgeText = settingsMeta?.[1]?.() || (collection ? `${items.length} records` : "Ready");
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

function renderHistory() {
  document.querySelector("#historyList").innerHTML = jobs.map((job) => (
    listRow(job.address, `${job.number} | ${job.client} | ${job.title}`, `Technician: ${job.technician}`)
  )).join("");
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

function showSection(sectionId) {
  const section = document.querySelector(`#${CSS.escape(sectionId)}`);
  if (!section) return;
  document.querySelectorAll(".section-panel").forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionId);
  });
  document.querySelector("#pageTitle").textContent = section.dataset.title;
  localStorage.setItem(sectionStorageKey, sectionId);
  updateProofingFrame(sectionId);
  updateSectionUrl(sectionId);
  if (sectionId === "tracking" || sectionId === "split-screen") {
    window.setTimeout(() => {
      renderTracking();
      renderSplitScreen();
    }, 80);
  }
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
document.addEventListener("click", async (event) => {
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
document.querySelector("#exportOtherCsvButton")?.addEventListener("click", () => exportValuationGroup("other"));
document.querySelector("#valuationGraphButton").addEventListener("click", showValuationGraph);
document.querySelector("#generateArkValuationButton").addEventListener("click", () => generateValuationWorkbook("ark"));
document.querySelector("#generateJgValuationButton").addEventListener("click", () => generateValuationWorkbook("jg"));
document.querySelector("#generateOtherValuationButton").addEventListener("click", () => generateValuationWorkbook("other"));
closeValuationGraphButton?.addEventListener("click", () => valuationGraphDialog.close());
document.querySelector("#staffSearch")?.addEventListener("input", renderStaff);
document.querySelector("#attendanceStatusFilter")?.addEventListener("change", renderStaff);
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
document.querySelector("#exportAssetsCsvButton")?.addEventListener("click", () => exportAssets("csv"));
document.querySelector("#exportAssetsExcelButton")?.addEventListener("click", () => exportAssets("xlsx"));
globalSearch.addEventListener("input", applyGlobalSearch);
publishFeedsButton?.addEventListener("click", publishIntegrationFeeds);
refreshFeedsButton?.addEventListener("click", renderIntegrationFeeds);
syncNowButton?.addEventListener("click", syncNow);
pinForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const selectedUser = loginNameInput.value;
  const pin = pinInput.value.trim();
  if (!selectedUser || authorisedUsers[selectedUser] !== pin) {
    pinMessage.textContent = "Name or PIN not recognised.";
    pinInput.select();
    return;
  }
  unlockHub(selectedUser);
});
lockHubButton?.addEventListener("click", lockHub);

document.addEventListener("click", async (event) => {
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

  const plannerWeekTab = event.target.closest("[data-planner-week]");
  if (plannerWeekTab) {
    activePlannerWeek = plannerWeekTab.dataset.plannerWeek;
    renderPlanner();
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
    openDataDialog("attendance", "", {
      date: today,
      name: staffAttendanceButton.dataset.staffDetailAttendance,
      status: "Absent - Called in Sick",
      category: "General Illness",
      returnToWorkCompleted: false
    });
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

  const manageButton = event.target.closest("[data-manage]");
  if (manageButton?.dataset.manage) {
    openDataDialog(manageButton.dataset.manage);
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
  setDataDialogStatus("Checking job details...", "");
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

installNavIcons();
initialiseAuth();
updateLiveDateTime();
setInterval(updateLiveDateTime, 30000);
updateOrpingtonWeather();
setInterval(updateOrpingtonWeather, 600000);
loadCommandData();

