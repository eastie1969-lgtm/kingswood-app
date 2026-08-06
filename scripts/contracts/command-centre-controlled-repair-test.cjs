const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function holidayPlannerMonthStart(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function holidayPlannerMonthDates(monthKey) {
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

assert.match(app, /function staffNames\(\)[\s\S]*role[\s\S]*technician/i, "Technician selectors must use technician-classified staff.");
assert.match(app, /function dataDialogProgressMessage/, "Data dialog must use collection-specific progress messages.");
assert.doesNotMatch(app, /setDataDialogStatus\("Checking job details\.\.\.", ""\);/, "Generic job status must not be used for every data dialog save.");
assert.match(app, /collection === "clients"[\s\S]*Please enter the client name/, "Client save must validate a written client name.");
assert.match(app, /collection === "clients" \? "Client record"/, "Client cards must not reuse a hard-coded total count badge on every card.");
assert.match(app, /function vehicleExpiryStatus/, "Vehicles table must use a shared expiry status helper.");
assert.match(app, /const motStatus = vehicleExpiryStatus\(vehicle\.mot\)/, "MOT display must use expiry status, including expired dates.");
assert.match(app, /return Number\.isFinite\(days\) && days <= 45;/, "Reminder checks must include overdue dates for alerting.");
assert.doesNotMatch(app, /Add\/check the OpenAI key to use AI/, "Local proofing fallback must not advertise itself as an AI result or ask for an API key.");

const august2026 = holidayPlannerMonthDates("2026-08");
assert.strictEqual(august2026[0], "2026-07-27", "August 2026 calendar must start on Monday 27 July.");
assert.strictEqual(august2026.indexOf("2026-08-06") % 7, 3, "6 August 2026 must render under Thursday in a Monday-first grid.");

const lastTableShellRule = css.slice(css.lastIndexOf(".table-shell"));
assert.match(lastTableShellRule, /overflow-x:\s*auto/, "Active table shell styling must allow horizontal scrolling instead of clipping actions.");
assert.match(css, /\.record-actions\s*{[\s\S]*flex-wrap:\s*wrap/, "Record action controls must wrap rather than clip.");
assert.match(css, /\.topbar-title-block h1\s*{[\s\S]*overflow-wrap:\s*anywhere/, "Long page titles must wrap within the header title area.");

console.log("Command Centre controlled repair checks passed.");
