const storageKey = "kingswood-hub-rams";
const authStorageKey = "kingswood-hub-user";
const sectionStorageKey = "kingswood-hub-section";
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

const today = localIsoDate();
const tomorrowDate = new Date();
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrow = localIsoDate(tomorrowDate);
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

let trainingMatrix = [
  { employee: "Dan", course: "Working at Height", provider: "Internal", completedDate: "2026-02-10", expiryDate: "2026-08-15", certificate: "On file", notes: "Required for high access works." },
  { employee: "Mason", course: "BPCA Level 2", provider: "BPCA", completedDate: "2025-09-12", expiryDate: "2027-09-12", certificate: "On file", notes: "Core technician qualification." },
  { employee: "Aiden", course: "Ladder Safety", provider: "Internal", completedDate: "2026-03-05", expiryDate: "2027-03-05", certificate: "On file", notes: "Refresher complete." }
];

let companyDocuments = [
  ["Health & Safety Policy", "Latest version available to technicians"],
  ["COSHH Assessments", "Store current chemical assessments"],
  ["General Risk Assessments", "Company-wide risk documents"],
  ["Method Statements", "Standard method statements"],
  ["Insurance Certificates", "Client-ready certificate store"],
  ["Waste Carrier Licence", "Expiry reminders needed"],
  ["CHAS", "Accreditation documents"],
  ["SafeContractor", "Accreditation documents"],
  ["SMAS", "Accreditation documents"],
  ["Training Certificates", "Technician training records"],
  ["Toolbox Talks", "Latest talks and read confirmations"]
];

let assets = [
  ["Roof ladder", "Ladders", "Dan", "2026-07-05", "Inspection due"],
  ["Gas monitor 01", "Gas monitors", "Stores", "2026-08-21", "OK"],
  ["Harness kit A", "Harnesses", "Aiden", "2026-07-12", "Inspection due"],
  ["Inspection camera", "Cameras", "Mason", "2026-10-03", "OK"]
];

let complianceItems = [
  ["MOT", "KW21 HUB", "Vehicle", "Dan", "2026-07-18"],
  ["Van servicing", "KW21 HUB", "Vehicle", "Dan", "2026-07-26"],
  ["MOT", "KW19 PCO", "Vehicle", "Mason", "2026-09-12"],
  ["Van servicing", "KW19 PCO", "Vehicle", "Mason", "2026-06-20"],
  ["Vehicle insurance", "KW19 PCO", "Vehicle", "Mason", "2026-07-20"],
  ["Technician driving licence", "Dan", "Technician", "Dan", "2026-08-28"],
  ["BPCA qualification", "Mason", "Technician", "Mason", "2026-07-22"],
  ["PPE inspection", "Aiden", "Technician", "Aiden", "2026-07-08"],
  ["Ladder inspection", "Roof ladder", "Equipment", "Dan", "2026-07-05"],
  ["Fire extinguisher servicing", "Office extinguishers", "Company", "Office", "2026-06-15"],
  ["PAT testing", "Office and workshop", "Company", "Office", "2026-07-29"],
  ["First aid expiry", "First aid certificate", "Company", "Office", "2026-10-18"],
  ["Company insurance renewal", "Public liability", "Company", "Office", "2026-08-02"]
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
const dataCollectionInput = document.querySelector("#dataCollectionInput");
const dataIndexInput = document.querySelector("#dataIndexInput");
const jobDetailDialog = document.querySelector("#jobDetailDialog");
const jobDetailTitle = document.querySelector("#jobDetailTitle");
const jobDetailContent = document.querySelector("#jobDetailContent");
const closeJobDetailButton = document.querySelector("#closeJobDetailButton");
const valuationGraphDialog = document.querySelector("#valuationGraphDialog");
const valuationGraphContent = document.querySelector("#valuationGraphContent");
const valuationGraphSubtitle = document.querySelector("#valuationGraphSubtitle");
const closeValuationGraphButton = document.querySelector("#closeValuationGraphButton");
const addButton = document.querySelector("#addRamsButton");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const globalSearch = document.querySelector("#globalSearch");
const storageStatus = document.querySelector("#storageStatus");
const liveDateTime = document.querySelector("#liveDateTime");
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
  status: document.querySelector("#statusInput"),
  sentDate: document.querySelector("#sentDateInput"),
  notes: document.querySelector("#notesInput")
};

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
      ["address", "Address"],
      ["postcode", "Postcode"],
      ["residentPhone", "Resident phone"],
      ["technician", "Technician", "staff-select"],
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
      ["reassignTo", "Reassign to", "staff-select"],
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
    set: (items) => { complianceItems = items; },
    fields: [
      ["type", "Item"],
      ["name", "Name / reference"],
      ["category", "Category"],
      ["owner", "Owner"],
      ["dueDate", "Due date", "date"]
    ]
  },
  fines: {
    title: "Fine or Charge",
    get: () => fines,
    set: (items) => { fines = items; },
    fields: [
      ["date", "Date", "date"],
      ["registration", "Vehicle registration"],
      ["driver", "Driver", "staff-select"],
      ["location", "Location"],
      ["type", "Fine type"],
      ["amount", "Amount", "number"],
      ["deadline", "Deadline", "date"],
      ["status", "Status"],
      ["evidence", "Evidence / ticket photo"],
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
      ["assignedVan", "Assigned van"],
      ["trainingRecords", "Training records", "textarea"],
      ["qualifications", "Qualifications", "textarea"],
      ["drivingLicence", "Driving licence details", "textarea"],
      ["ppeIssued", "PPE issued", "textarea"],
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
      ["status", "Status"],
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
      ["days", "Days", "number"],
      ["status", "Status"]
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
      ["completedDate", "Completed date", "date"],
      ["expiryDate", "Expiry date", "date"],
      ["certificate", "Certificate / file note"],
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
    get: () => companyDocuments.map(asCardObject),
    set: (items) => { companyDocuments = items; },
    fields: [
      ["title", "Document"],
      ["description", "Details", "textarea"]
    ]
  },
  assets: {
    title: "Asset",
    get: () => assets.map(asAssetObject),
    set: (items) => { assets = items; },
    fields: [
      ["asset", "Asset"],
      ["category", "Category"],
      ["heldBy", "Held by"],
      ["inspectionDue", "Inspection due", "date"],
      ["status", "Status"]
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

function asAssetObject(item) {
  return Array.isArray(item) ? { asset: item[0], category: item[1], heldBy: item[2], inspectionDue: item[3], status: item[4] } : item;
}

function staffNames() {
  return [...new Set(staffProfiles.map((staff) => staff.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function renderSelectField(key, label, value, options) {
  const optionValues = [...new Set([value, ...options].filter(Boolean))];
  return `
    <label>
      ${label}
      <select data-field="${key}">
        <option value="">-- Select --</option>
        ${optionValues.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
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

function greetingForNow(name) {
  const hour = new Date().getHours();
  const dayPart = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${dayPart}, ${name}`;
}

function unlockHub(name) {
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

function initialiseAuth() {
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
      <div class="metric-heading">
        <span class="metric-title">${escapeHtml(title)}</span>
        <span class="metric-inline"><i aria-hidden="true"></i><span id="${value.id}Badge">0 ${meta[2]}</span></span>
      </div>
      <p class="metric-subtitle">${escapeHtml(meta[1])}</p>
      <strong class="metric-value" id="${value.id}">${escapeHtml(value.textContent)}</strong>
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
    availabilityWarning: isUnavailableStatus(attendance.status) ? `${job.technician} is marked as ${attendance.status}` : "",
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
  return {
    app: "Kingswood Technician App",
    source: "Kingswood Command Centre",
    publishedAt: new Date().toISOString(),
    jobs: jobs.map(technicianJob),
    staffAvailability: staffProfiles.map((staff) => {
      const attendance = attendanceFor(staff.name, today);
      return {
        name: staff.name,
        role: staff.role,
        phone: staff.phone,
        assignedVan: staff.assignedVan,
        todayStatus: attendance.status,
        availableToday: !isUnavailableStatus(attendance.status)
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
      ...jobs.filter((job) => job.status === "Urgent").map((job) => `Urgent job: ${job.number} - ${job.title}`)
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
    fines,
    clients: clients.map(asCardObject),
    assets: assets.map(asAssetObject),
    companyDocuments: companyDocuments.map(asCardObject)
  };
}

function buildConnectV12Feed() {
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
      jobs: jobs.map((job) => {
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
  await saveCommandData();

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

  const confirmed = window.confirm(`Clear ${labels[collection]}? This cannot be undone from inside the Hub.`);
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

let ramsItems = loadRams();

function commandData() {
  normalisePlannerItems();
  syncStaffTrainingFromMatrix();
  syncTechniciansFromStaff();
  syncValuationsFromJobs();
  return {
    ramsItems,
    jobs,
    vehicles,
    technicians,
    staffProfiles,
    attendanceRecords,
    holidayRequests,
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
    savedAt: new Date().toISOString()
  };
}

function applyCommandData(data) {
  if (Array.isArray(data.ramsItems)) ramsItems = data.ramsItems;
  if (Array.isArray(data.jobs)) jobs = data.jobs;
  if (Array.isArray(data.vehicles)) vehicles = data.vehicles;
  if (Array.isArray(data.technicians)) technicians = data.technicians;
  if (Array.isArray(data.staffProfiles)) staffProfiles = data.staffProfiles;
  if (Array.isArray(data.attendanceRecords)) attendanceRecords = data.attendanceRecords;
  if (Array.isArray(data.holidayRequests)) holidayRequests = data.holidayRequests;
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
  if (location.protocol === "file:") {
    try {
      const serverResponse = await fetchFirstHubApi("/api/data", { cache: "no-store" });
      if (redirectFileViewToHub(serverResponse?.url)) return;
      const response = serverResponse || await fetch("data/command-centre-data.json", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        if (Object.keys(data).length > 0) {
          applyCommandData(data);
          storageStatus.textContent = serverResponse ? "OneDrive data loaded" : "OneDrive file data loaded";
        } else {
          storageStatus.textContent = "Start Kingswood Hub to save to OneDrive";
        }
      } else {
        storageStatus.textContent = "Start Kingswood Hub to save to OneDrive";
      }
    } catch {
      storageStatus.textContent = "Start Kingswood Hub to save to OneDrive";
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
      const valuationSyncChanged = syncValuationsFromJobs();
      storageStatus.textContent = "OneDrive data loaded";
      if (valuationSyncChanged) {
        await saveCommandData();
      }
    } else {
      storageStatus.textContent = "Creating OneDrive data file";
      await saveCommandData();
    }
  } catch {
    storageStatus.textContent = "Storage unavailable: browser fallback";
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
  localStorage.setItem(storageKey, JSON.stringify(ramsItems));

  if (location.protocol === "file:") {
    const response = await fetchFirstHubApi("/api/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(commandData(), null, 2)
    });
    storageStatus.textContent = response ? "Saved to OneDrive folder" : "Start Kingswood Hub to save to OneDrive";
    return;
  }

  try {
    const response = await fetch("/api/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(commandData(), null, 2)
    });

    storageStatus.textContent = response.ok ? "Saved to OneDrive folder" : "Save failed";
  } catch {
    storageStatus.textContent = "Save failed: browser fallback";
  }
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
  saveCommandData();
}

function openDataDialog(collection, index = "", seed = {}) {
  const model = dataModels[collection];
  if (!model) return;

  const item = index === "" ? seed : model.get()[Number(index)];
  dataCollectionInput.value = collection;
  dataIndexInput.value = index;
  dataDialogTitle.textContent = `${index === "" ? "Add" : "Edit"} ${model.title}`;
  if (dataSaveButton) {
    dataSaveButton.textContent = collection === "jobs" ? "Send to Tech App" : "Save";
  }
  dataFields.innerHTML = model.fields.map(([key, label, type = "text"]) => {
    const value = escapeHtml(fieldValue(item, key));
    const full = type === "textarea" ? " full-width" : "";
    if (type === "staff-select") {
      return renderSelectField(key, label, fieldValue(item, key), staffNames());
    }
    if (type === "role-select") {
      return renderSelectField(key, label, fieldValue(item, key), ["Technician", "Senior Technician", "Trainee Technician", "Admin", "Manager", "Director"]);
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
  dataDialog.showModal();
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

async function saveDataDialog() {
  const collection = dataCollectionInput.value;
  const index = dataIndexInput.value;
  const model = dataModels[collection];
  if (!model) return;

  const previousItem = index === "" ? null : { ...model.get()[Number(index)] };
  const item = index === "" ? {} : { ...previousItem };
  model.fields.forEach(([key, , type = "text"]) => {
    const input = dataFields.querySelector(`[data-field="${key}"]`);
    item[key] = type === "number" ? Number(input.value || 0) : input.value.trim();
  });
  if (collection === "jobs") {
    item.status = item.status || "Booked";
    item.report = item.report || "Not due";
    item.completed = item.completed || "n";
  }
  if (collection === "planner") {
    if (previousItem?.task && !previousItem.originalTask) {
      item.originalTask = previousItem.task;
    }
    if (!validatePlannerJobDecision(item, previousItem)) {
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
  if (collection === "planner") {
    syncAttendanceFromPlanner();
  }
  if (collection === "training") {
    syncStaffTrainingFromMatrix();
  }
  if (collection === "staff" || collection === "training") {
    syncTechniciansFromStaff();
  }
  if (collection === "jobs" || collection === "planner") {
    await publishIntegrationFeeds();
  } else {
    await saveCommandData();
  }
  render();
  if (["emailTemplates", "reportTemplates", "ramsTemplates", "branding"].includes(collection)) {
    renderSettingsDetail();
  }
  return true;
}

function deleteDataRecord(collection, index) {
  const model = dataModels[collection];
  if (!model) return;

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
  saveCommandData();
  render();
}

function statusLabel(status) {
  const labels = {
    draft: "Draft",
    attached: "Attached",
    sent: "Sent"
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
  const days = daysUntil(item.dueDate);
  if (days < 0) {
    return {
      label: "Red",
      className: "red",
      days,
      reminder: `${Math.abs(days)} days overdue`
    };
  }
  if (days <= 30) {
    return {
      label: "Amber",
      className: "amber",
      days,
      reminder: `Due in ${days} days`
    };
  }
  return {
    label: "Green",
    className: "green",
    days,
    reminder: "More than 30 days remaining"
  };
}

function complianceRecords() {
  return complianceItems.map((item) => ({
    type: Array.isArray(item) ? item[0] : item.type,
    name: Array.isArray(item) ? item[1] : item.name,
    category: Array.isArray(item) ? item[2] : item.category,
    owner: Array.isArray(item) ? item[3] : item.owner,
    dueDate: Array.isArray(item) ? item[4] : item.dueDate
  }));
}

function filteredCompliance() {
  const term = document.querySelector("#complianceSearch").value.trim().toLowerCase();
  const category = document.querySelector("#complianceCategoryFilter").value;

  return complianceRecords().filter((item) => {
    const searchable = `${item.type} ${item.name} ${item.category} ${item.owner}`.toLowerCase();
    const matchesSearch = !term || searchable.includes(term);
    const matchesCategory = category === "all" || item.category === category;
    return matchesSearch && matchesCategory;
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
      if (isJgClient(item.client)) {
        totals.jg += Number(item.cost || 0);
        return;
      }
      if (!isPrivateClient(item.client)) {
        totals.ark += Number(item.cost || 0);
      }
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
    return monthRows.filter((item) => !isJgClient(item.client) && !isPrivateClient(item.client));
  }
  if (group === "jg") {
    return monthRows.filter((item) => isJgClient(item.client));
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
      ...monthRows.filter((item) => !isJgClient(item.client) && isPrivateClient(item.client) && item.source !== "Hub job diary"),
      ...monthRows.filter((item) => !isJgClient(item.client) && !isPrivateClient(item.client) && jobClientType(item).className === "other"),
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

function validatePlannerJobDecision(item, previousItem) {
  if (!previousItem || !["Holiday", "Sick"].includes(plannerTypeFromItem(item)) || !plannerHasOriginalJob(previousItem, item)) {
    return true;
  }
  if (!["Reassign job", "Cancel job"].includes(item.jobAction)) {
    window.alert("This slot has a job booked. Please choose whether to reassign or cancel the job.");
    return false;
  }
  if (item.jobAction === "Reassign job" && !item.reassignTo) {
    window.alert("Please choose the technician to reassign this job to.");
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
    const searchable = `${fine.registration} ${fine.driver} ${fine.location} ${fine.type} ${fine.notes}`.toLowerCase();
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
  return status === "Sick" || status === "Holiday" || status === "Training" || status === "Unpaid leave" || status === "Absent";
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

function holidayUsedForYear(name, year = String(new Date().getFullYear())) {
  return new Set(attendanceRecords
    .filter((record) => record.name === name && record.status === "Holiday" && attendanceYear(record) === year)
    .map((record) => record.date)
  ).size;
}

function sicknessDaysForYear(name, year = String(new Date().getFullYear())) {
  return new Set(attendanceRecords
    .filter((record) => record.name === name && record.status === "Sick" && attendanceYear(record) === year)
    .map((record) => record.date)
  ).size;
}

function trainingDaysForYear(name, year = String(new Date().getFullYear())) {
  return new Set(attendanceRecords
    .filter((record) => record.name === name && record.status === "Training" && attendanceYear(record) === year)
    .map((record) => record.date)
  ).size;
}

function trainingStatus(record) {
  const days = daysUntil(record.expiryDate);
  if (!record.expiryDate) {
    return { label: "No expiry", className: "ok", days: 9999 };
  }
  if (days < 0) {
    return { label: "Expired", className: "urgent", days };
  }
  if (days <= 30) {
    return { label: "Expiring soon", className: "warning", days };
  }
  return { label: "Current", className: "ok", days };
}

function syncStaffTrainingFromMatrix() {
  staffProfiles = staffProfiles.map((staff) => {
    const records = trainingMatrix.filter((record) => record.employee === staff.name);
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

function filteredStaff() {
  const term = document.querySelector("#staffSearch").value.trim().toLowerCase();
  const attendance = document.querySelector("#attendanceStatusFilter").value;

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
    const searchable = `${item.title} ${item.client} ${item.job}`.toLowerCase();
    const matchesSearch = !term || searchable.includes(term);
    const matchesStatus = status === "all" || item.status === status;
    return matchesSearch && matchesStatus;
  });
}

function renderSummary() {
  document.querySelector("#totalCount").textContent = ramsItems.length;
  document.querySelector("#attachedCount").textContent = ramsItems.filter((item) => item.status === "attached" || item.status === "sent").length;
  document.querySelector("#sentCount").textContent = ramsItems.filter((item) => item.status === "sent").length;
  document.querySelector("#needsSendingCount").textContent = ramsItems.filter((item) => item.status !== "sent").length;
}

function renderDashboard() {
  enhanceDashboardCards();
  const valuationTotals = monthlyValuationTotals();
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
  const compliance = complianceRecords().map((item) => ({ ...item, status: complianceStatus(item) }));
  document.querySelector("#complianceDueCount").textContent = compliance.filter((item) => item.status.className === "amber").length;
  document.querySelector("#complianceOverdueCount").textContent = compliance.filter((item) => item.status.className === "red").length;
  document.querySelector("#fineDeadlineCount").textContent = fines.filter(isFineDeadlineSoon).length;
  document.querySelector("#openFineCount").textContent = fines.filter(isFineOpen).length;
  const todayAttendance = staffProfiles.map((staff) => attendanceFor(staff.name, today));
  document.querySelector("#staffAvailableCount").textContent = todayAttendance.filter((record) => !isUnavailableStatus(record.status)).length;
  document.querySelector("#staffUnavailableCount").textContent = todayAttendance.filter((record) => isUnavailableStatus(record.status)).length;

  const dashboardJobs = jobs
    .filter((job) => job.date === today || job.date === tomorrow)
    .map((job) => listRow(`${job.number} - ${job.title}`, `${job.date} | ${job.client} | ${job.technician}`, job.status))
    .join("");
  document.querySelector("#dashboardJobs").innerHTML = dashboardJobs;

  document.querySelector("#technicianLocations").innerHTML = technicians
    .map((tech) => listRow(tech.name, `${tech.location} | ${tech.van}`, "Last update today"))
    .join("");

  document.querySelector("#dashboardCompliance").innerHTML = compliance
    .filter((item) => item.status.className !== "green")
    .sort((a, b) => a.status.days - b.status.days)
    .slice(0, 6)
    .map((item) => listRow(`${item.type} - ${item.name}`, `${item.owner} | Due ${item.dueDate}`, item.status.label))
    .join("");

  updateDashboardBadges();
}

function jobsWithUnavailableTechnicians() {
  return jobs.filter((job) => job.date >= today).filter((job) => {
    const attendance = attendanceFor(job.technician, job.date);
    return isUnavailableStatus(attendance.status);
  });
}

function adminRamsStatus(job) {
  const assigned = ramsItems.filter((item) => item.job.includes(job.number) || item.job.includes(job.title) || item.client === job.client);
  if (assigned.some((item) => item.status === "sent")) return "RAMS sent";
  if (assigned.length) return "RAMS attached";
  return "RAMS needed";
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
    row.innerHTML = '<td class="empty-state" colspan="6">No RAMS found.</td>';
    tableBody.append(row);
    return;
  }

  rows.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(item.title)}</strong></td>
      <td>${escapeHtml(item.client)}</td>
      <td>${escapeHtml(item.job)}</td>
      <td><span class="status ${item.status}">${statusLabel(item.status)}</span></td>
      <td>${item.sentDate || "-"}</td>
      <td>
        <div class="row-actions">
          <button class="secondary-button" type="button" data-action="edit" data-id="${item.id}">Edit</button>
          <button class="secondary-button" type="button" data-action="markSent" data-id="${item.id}">Mark sent</button>
          <button class="danger-button" type="button" data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      </td>
    `;
    tableBody.append(row);
  });
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
  const records = filteredCompliance().map((item) => ({ ...item, status: complianceStatus(item) }));
  const allRecords = complianceRecords().map((item) => ({ ...item, status: complianceStatus(item) }));

  document.querySelector("#greenComplianceCount").textContent = allRecords.filter((item) => item.status.className === "green").length;
  document.querySelector("#amberComplianceCount").textContent = allRecords.filter((item) => item.status.className === "amber").length;
  document.querySelector("#redComplianceCount").textContent = allRecords.filter((item) => item.status.className === "red").length;
  document.querySelector("#totalComplianceCount").textContent = allRecords.length;

  document.querySelector("#complianceTableBody").innerHTML = records
    .sort((a, b) => a.status.days - b.status.days)
    .map((item, index) => `
      <tr>
        <td><span class="traffic-light ${item.status.className}">${item.status.label}</span></td>
        <td><strong>${escapeHtml(item.type)}</strong><br><span class="meta">${escapeHtml(item.name)}</span></td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.owner)}</td>
        <td>${item.dueDate}</td>
        <td>${item.status.days}</td>
        <td>${escapeHtml(item.status.reminder)}<div class="record-actions">${recordButtons("compliance", index)}</div></td>
      </tr>
    `)
    .join("");
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
      const vehicle = vehicles.find((item) => item.registration === fine.registration);
      const driver = technicians.find((item) => item.name === fine.driver);
      const linkedVehicle = vehicle ? `${fine.registration} | ${vehicle.vehicle}` : fine.registration;
      const linkedDriver = driver ? `${fine.driver} | ${driver.role}` : fine.driver;

      return `
        <tr>
          <td>${fine.date}</td>
          <td><strong>${escapeHtml(linkedVehicle)}</strong></td>
          <td>${escapeHtml(linkedDriver)}</td>
          <td>${escapeHtml(fine.location)}</td>
          <td>${escapeHtml(fine.type)}</td>
          <td>GBP ${fine.amount.toFixed(2)}</td>
          <td>${fine.deadline}<br><span class="meta">${escapeHtml(fineDeadlineLabel(fine))}</span></td>
          <td><span class="status ${fineStatusClass(fine)}">${escapeHtml(fine.status)}</span></td>
          <td>${escapeHtml(fine.evidence)}</td>
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
  const rows = filteredPlannerItems();
  const selectedWeek = activePlannerWeek || plannerCurrentWeek();
  const weekItems = weeklyPlanner.filter((item) => selectedWeek === "all" || item.week === selectedWeek);
  const selectedWeekStart = plannerWeekStartFromLabel(selectedWeek);
  const techniciansForWeek = [...new Set([
    ...staffProfiles.filter((staff) => String(staff.role || "").toLowerCase().includes("technician")).map((staff) => staff.name),
    ...technicians.map((tech) => tech.name),
    ...weekItems.map((item) => item.technician)
  ].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const days = plannerWeekDays(selectedWeekStart);

  document.querySelector("#plannerItemCount").textContent = weekItems.length;
  document.querySelector("#plannerTechnicianCount").textContent = techniciansForWeek.length;
  document.querySelector("#plannerUnavailableCount").textContent = `${plannerUnavailableSlotCount(weekItems)} / ${techniciansForWeek.length * days.length * 2}`;
  document.querySelector("#plannerWeekLabel").textContent = selectedWeek === "all" ? "All" : selectedWeek.replace("WC ", "");

  if (!techniciansForWeek.length || !days.length) {
    document.querySelector("#plannerBoard").innerHTML = '<p class="empty-state">No planner items found.</p>';
    return;
  }

  const itemLookup = new Map(rows.map((item) => [`${item.technician}|${item.date}|${item.session}`, item]));
  document.querySelector("#plannerBoard").innerHTML = `
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
              weekStart: selectedWeekStart
            })).join("")}
          `;
        }).join("")).join("")}
      </div>
      ${plannerKey()}
    </div>
  `;
}

function plannerSheetCell(item, breakClass = "", seed = {}) {
  if (!item) {
    return `
      <div class="planner-cell planner-cell-editable planner-empty-cell${breakClass}"
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
    <div class="planner-cell planner-cell-editable ${plannerSlotClass(item)}${breakClass}" data-planner-index="${index}">
      <strong>${escapeHtml(plannerText(item))}</strong>
      <div class="record-actions">${recordButtons("planner", index)}</div>
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

function exportValuations() {
  const rows = filteredValuations();
  const selectedMonth = selectedValuationMonthKey();
  const headings = [
    "Date",
    "Address",
    "Postcode",
    "Ark Job Ref",
    "Client",
    "Technician",
    "Completed",
    "Report Received",
    "Cost",
    "Ark Report Complete",
    "Notes"
  ];
  const csvRows = [
    headings.map(csvCell).join(","),
    ...rows.map((item) => [
      formatDateUk(item.date),
      item.address || "",
      item.postcode || "",
      item.arkRef || "",
      item.client || "",
      item.technician || "",
      valuationStatusLabel(item.completed),
      valuationStatusLabel(item.reportReceived),
      Number(item.cost || 0).toFixed(2),
      isArkReportComplete(item) ? "Yes" : "No",
      item.notes || ""
    ].map(csvCell).join(","))
  ];
  const blob = new Blob([`\uFEFF${csvRows.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Kingswood valuations ${selectedMonth}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function showValuationGraph() {
  const selectedMonth = selectedValuationMonthKey();
  const totals = valuationGraphTotals(selectedMonth);
  const bars = [
    { label: "Ark", className: "ark", value: totals.ark },
    { label: "JG Pest Control", className: "jg", value: totals.jg },
    { label: "Other", className: "other", value: totals.other }
  ];
  const max = Math.max(...bars.map((bar) => bar.value), 1);

  valuationGraphSubtitle.textContent = `${monthLabel(`${selectedMonth}-01`)} | Valuation due ${lastWorkingDayOfMonth(`${selectedMonth}-01`)}`;
  valuationGraphContent.innerHTML = bars.map((bar) => `
    <article class="valuation-graph-row ${bar.className}">
      <div>
        <strong>${escapeHtml(bar.label)}</strong>
        <span>${money(bar.value)}</span>
      </div>
      <div class="valuation-graph-track">
        <i style="width:${Math.max((bar.value / max) * 100, bar.value ? 8 : 0)}%"></i>
      </div>
    </article>
  `).join("");
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
    `<Row>${excelCell(`${title} Valuation Report`)}</Row>`,
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

    const removeFromValuation = window.confirm(
      `${valuationRowDescription(row)} has a valuation cost of £0.00.\n\nPress OK if £0.00 is correct and this line should be removed from the valuation.\nPress Cancel if a value needs to be added.`
    );

    if (removeFromValuation) {
      continue;
    }

    const enteredValue = window.prompt(`Enter the valuation value for:\n${valuationRowDescription(row)}`, "");
    if (enteredValue === null) {
      continue;
    }

    const amount = Number(String(enteredValue).replace(/[£,\s]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("That value was not added because it was not a valid amount above £0.");
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
    private: "Private",
    other: "Other"
  };
  const rows = await reviewZeroValuationRows(valuationGroupRows(group, selectedMonth));
  if (!rows.length) {
    window.alert(`No ${groupLabels[group]} valuation rows found for ${valuationPeriodName(selectedMonth)}.`);
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

function renderStaff() {
  const todayAttendance = staffProfiles.map((staff) => attendanceFor(staff.name, today));
  const currentYear = String(new Date().getFullYear());
  const trainingDays = attendanceRecords.filter((record) => record.status === "Training" && attendanceYear(record) === currentYear).length;

  document.querySelector("#staffPresentCount").textContent = todayAttendance.filter((record) => record.status === "Present" || record.status === "Late").length;
  document.querySelector("#staffUnavailableTodayCount").textContent = todayAttendance.filter((record) => isUnavailableStatus(record.status)).length;
  document.querySelector("#holidayRequestCount").textContent = holidayRequests.filter((request) => request.status === "Pending").length;
  document.querySelector("#trainingDayCount").textContent = trainingDays;

  document.querySelector("#staffGrid").innerHTML = filteredStaff().map((staff) => {
    const attendance = attendanceFor(staff.name, today);
    const holidayUsed = holidayUsedForYear(staff.name, currentYear);
    const holidayRemaining = staff.holidayAllowance - holidayUsed;
    const index = staffProfiles.indexOf(staff);

    return `
      <article class="module-card staff-card">
        <strong>${escapeHtml(staff.name)}</strong>
        <p>${escapeHtml(staff.role)} | ${escapeHtml(staff.phone)}</p>
        <p>${escapeHtml(staff.email)}</p>
        <p>Tech app PIN: ${staff.techPin ? "PIN on file" : "Not set"}</p>
        <p>Emergency: ${escapeHtml(staff.emergencyContact)}</p>
        <p>Van: ${escapeHtml(staff.assignedVan)}</p>
        <p>Training: ${escapeHtml(staff.trainingRecords)}</p>
        <p>Qualifications: ${escapeHtml(staff.qualifications)}</p>
        <p>Licence: ${escapeHtml(staff.drivingLicence)}</p>
        <p>PPE: ${escapeHtml(staff.ppeIssued)}</p>
        <p>Holiday ${currentYear}: ${holidayUsed} used, ${holidayRemaining} remaining</p>
        <p>${escapeHtml(staff.notes)}</p>
        <span class="status ${staffStatusClass(attendance.status)}">${attendance.status}</span>
        <div class="record-actions">${recordButtons("staff", index)}</div>
      </article>
    `;
  }).join("");

  document.querySelector("#attendanceList").innerHTML = todayAttendance.map((record) => {
    const index = attendanceRecords.indexOf(record);
    const buttons = index >= 0 ? `<div class="record-actions">${recordButtons("attendance", index)}</div>` : "";
    return `
      <article class="list-row">
        <div>
          <strong>${escapeHtml(record.name)}</strong>
          <p>${escapeHtml(`${record.date} | ${record.returnToWorkNotes || "No return to work notes"} | ${record.fitNote || "No fit note uploaded"}`)}</p>
          ${buttons}
        </div>
        <span class="status ${staffStatusClass(record.status)}">${escapeHtml(record.status)}</span>
      </article>
    `;
  }).join("");

  document.querySelector("#staffReports").innerHTML = staffProfiles.map((staff) => {
    const sicknessDays = sicknessDaysForYear(staff.name, currentYear);
    const training = trainingDaysForYear(staff.name, currentYear);
    const holidayUsed = holidayUsedForYear(staff.name, currentYear);
    const holidayRemaining = staff.holidayAllowance - holidayUsed;
    const history = attendanceRecords.filter((record) => record.name === staff.name).map((record) => `${record.date}: ${record.status}`).join(", ");

    return listRow(
      staff.name,
      `${currentYear}: Sick ${sicknessDays} | Holiday used ${holidayUsed} | Remaining ${holidayRemaining} | Training ${training} | ${history || "No attendance history"}`,
      "Report"
    );
  }).join("");
}

function renderTrainingMatrix() {
  const records = trainingMatrix.map((record, index) => ({ ...record, index, status: trainingStatus(record) }));
  document.querySelector("#trainingCurrentCount").textContent = records.filter((record) => record.status.label === "Current" || record.status.label === "No expiry").length;
  document.querySelector("#trainingExpiringCount").textContent = records.filter((record) => record.status.className === "warning").length;
  document.querySelector("#trainingExpiredCount").textContent = records.filter((record) => record.status.className === "urgent").length;
  document.querySelector("#trainingEmployeeCount").textContent = new Set(records.map((record) => record.employee).filter(Boolean)).size;

  document.querySelector("#trainingTableBody").innerHTML = records
    .sort((a, b) => a.employee.localeCompare(b.employee) || a.status.days - b.status.days)
    .map((record) => {
      return `
        <tr>
          <td><strong>${escapeHtml(record.employee)}</strong></td>
          <td>${escapeHtml(record.course)}</td>
          <td>${escapeHtml(record.provider)}</td>
          <td>${escapeHtml(record.completedDate || "-")}</td>
          <td>${escapeHtml(record.expiryDate || "-")}</td>
          <td><span class="status ${record.status.className}">${escapeHtml(record.status.label)}</span></td>
          <td>${escapeHtml(record.notes || record.certificate || "")}<div class="record-actions">${recordButtons("training", record.index)}</div></td>
        </tr>
      `;
    })
    .join("") || '<tr><td class="empty-state" colspan="7">No training records yet.</td></tr>';
}

function renderAssets() {
  document.querySelector("#assetsTableBody").innerHTML = assets.map((asset, index) => {
    const item = asAssetObject(asset);
    return `
    <tr>
      <td><strong>${escapeHtml(item.asset)}</strong></td>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.heldBy)}</td>
      <td>${escapeHtml(item.inspectionDue)}</td>
      <td><span class="status ${item.status === "OK" ? "ok" : "warning"}">${escapeHtml(item.status)}</span><div class="record-actions">${recordButtons("assets", index)}</div></td>
    </tr>
  `;
  }).join("");
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
      ${settingsPanelHeader("Data Storage", "The Hub is saving into this Kingswood Hub OneDrive folder through the local preview server.")}
      <div class="storage-panel">
        ${listRow("Main Hub data", "data/command-centre-data.json", "OneDrive")}
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

function renderTechnicians() {
  document.querySelector("#techniciansGrid").innerHTML = technicians.map((tech) => `
    <article class="module-card">
      <strong>${tech.name}</strong>
      <p>${tech.role}</p>
      <p>${tech.phone} | Van ${tech.van}</p>
      <p>${tech.training}</p>
    </article>
  `).join("") || '<p class="empty-state">Add staff with a technician role to populate this view.</p>';
}

function renderTracking() {
  document.querySelector("#trackingList").innerHTML = vehicles.map((vehicle) => {
    const tech = technicians.find((person) => person.van === vehicle.registration);
    return listRow(vehicle.registration, `${vehicle.vehicle} | ${tech?.name || "Unassigned"} | ${tech?.location || "No location"}`, vehicle.tracker);
  }).join("");
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
  renderCards("#documentsGrid", companyDocuments);
  renderCards("#clientsGrid", clients);
  renderCards("#settingsGrid", settings);
  renderSettingsDetail();
  renderSetupActions();
  renderTechnicians();
  renderTracking();
  renderHistory();
  renderNotifications();
}

function openDialog(item = null) {
  document.querySelector("#dialogTitle").textContent = item ? "Edit RAMS" : "Add RAMS";
  fields.id.value = item?.id || "";
  fields.title.value = item?.title || "";
  fields.client.value = item?.client || "";
  fields.job.value = item?.job || "";
  fields.status.value = item?.status || "draft";
  fields.sentDate.value = item?.sentDate || "";
  fields.notes.value = item?.notes || "";
  dialog.showModal();
}

function saveFromForm() {
  const item = {
    id: fields.id.value || crypto.randomUUID(),
    title: fields.title.value.trim(),
    client: fields.client.value.trim(),
    job: fields.job.value.trim(),
    status: fields.status.value,
    sentDate: fields.sentDate.value,
    notes: fields.notes.value.trim()
  };

  if (item.status === "sent" && !item.sentDate) {
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
}

function updateProofingFrame(sectionId) {
  const frame = document.querySelector(".embedded-tool-frame");
  if (!frame) return;
  if (sectionId === "proofing-reports") {
    frame.src = frame.dataset.src || "http://127.0.0.1:5000/";
    return;
  }
  frame.removeAttribute("src");
}

function updateSectionUrl(sectionId) {
  if (location.protocol === "file:") return;
  const url = new URL(location.href);
  url.searchParams.set("section", sectionId);
  url.searchParams.set("v", "52");
  history.replaceState(null, "", url.toString());
}

function sectionUrl(sectionId) {
  const url = new URL(location.href);
  url.searchParams.set("section", sectionId);
  url.searchParams.set("v", "52");
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

document.addEventListener("keydown", (event) => {
  if (event.key !== "F5") return;
  const activeSection = document.querySelector(".section-panel.active")?.id;
  if (!activeSection || location.protocol === "file:") return;
  event.preventDefault();
  location.href = sectionUrl(activeSection);
});

addButton.addEventListener("click", () => openDialog());
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
document.querySelector("#fineSearch").addEventListener("input", renderFines);
document.querySelector("#fineStatusFilter").addEventListener("change", renderFines);
document.querySelector("#valuationSearch").addEventListener("input", renderValuations);
document.querySelector("#valuationMonthFilter").addEventListener("change", renderValuations);
document.querySelector("#valuationYearFilter").addEventListener("change", renderValuations);
document.querySelector("#valuationClientFilter").addEventListener("change", renderValuations);
document.querySelector("#valuationStatusFilter").addEventListener("change", renderValuations);
document.querySelector("#exportValuationsButton").addEventListener("click", exportValuations);
document.querySelector("#valuationGraphButton").addEventListener("click", showValuationGraph);
document.querySelector("#generateArkValuationButton").addEventListener("click", () => generateValuationWorkbook("ark"));
document.querySelector("#generatePrivateValuationButton").addEventListener("click", () => generateValuationWorkbook("private"));
document.querySelector("#generateOtherValuationButton").addEventListener("click", () => generateValuationWorkbook("other"));
closeValuationGraphButton?.addEventListener("click", () => valuationGraphDialog.close());
document.querySelector("#staffSearch").addEventListener("input", renderStaff);
document.querySelector("#attendanceStatusFilter").addEventListener("change", renderStaff);
globalSearch.addEventListener("input", applyGlobalSearch);
publishFeedsButton?.addEventListener("click", publishIntegrationFeeds);
refreshFeedsButton?.addEventListener("click", renderIntegrationFeeds);
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

document.addEventListener("click", (event) => {
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

  const proofingOpenButton = event.target.closest("[data-proofing-open]");
  if (proofingOpenButton) {
    window.open("http://127.0.0.1:5000/", "_blank", "noopener");
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

dataForm.addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") {
    return;
  }

  event.preventDefault();
  const saved = await saveDataDialog();
  if (saved !== false) {
    dataDialog.close();
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

  if (button.dataset.action === "edit") {
    openDialog(item);
  }

  if (button.dataset.action === "markSent") {
    item.status = "sent";
    item.sentDate = item.sentDate || new Date().toISOString().slice(0, 10);
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
loadCommandData();
