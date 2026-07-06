# Kingswood Command Centre

This is a separate central command centre project. It should stay separate from Kingswood Connect unless Kev explicitly asks for the two projects to connect.

## What this prototype includes

- Full-screen desktop command centre using the Kingswood silver logo, wide-screen navigation, and dashboard-led layout.
- Dashboard with jobs today, jobs tomorrow, urgent jobs, reports due, RAMS to send, vehicle alerts, MOT reminders, insurance reminders, technician locations, and quick statistics.
- Job Diary starter table for jobs, clients, technicians, reports, and search.
- Live Vehicle Tracking placeholder ready for tracker data later.
- RAMS Centre for assigning RAMS to jobs, marking RAMS as sent, and storing the sent date.
- Compliance Centre with Green, Amber, and Red reminders for MOTs, servicing, insurance, licences, qualifications, PPE, ladders, fire extinguishers, PAT testing, first aid, and company insurance.
- Company Documents area for policies, COSHH, risk assessments, method statements, insurance, accreditations, training certificates, and toolbox talks.
- Vehicle Management starter table with MOT, insurance, driver, vehicle, and tracker status.
- Fines and Charges area for parking tickets, congestion charges, ULEZ, speeding fines, bus lane fines, Dart Charge issues, other vehicle charges, evidence photos, payment deadlines, and statuses.
- Staff Management area for staff profiles, emergency contacts, assigned vans, training, qualifications, driving licence details, PPE, attendance, sickness, holiday, fit notes, return to work notes, availability, and simple attendance reports.
- Technician Management starter cards.
- Asset Register starter table.
- Clients area for Ark, JG Pest Control, Private, and Housing Associations.
- Job History, Notifications, Search, and Settings starter areas.

## How to open it and save data

Double-click `Start Kingswood Hub.cmd`.

That opens the Hub at:

`http://127.0.0.1:8126/index.html`

The same starter also opens the Pest Proofing Report Builder in the Hub under **Proofing Reports**. The report builder runs locally at:

`http://127.0.0.1:5000/`

Keep the small black server window open while using the Hub. When you add or edit records, the data is saved in:

`data/command-centre-data.json`

Because this project folder is inside OneDrive, that data file is stored in OneDrive with the rest of the Kingswood Hub.

## Linking with Technician and Admin apps

The Hub now has an App Connection Centre in Settings.

Use `Publish App Feeds` to prepare shared data for the other apps.

The Hub saves:

- `data/command-centre-data.json` - the full Hub data.
- `data/technician-app-feed.json` - jobs, RAMS, documents, navigation addresses, vehicle assignment, and technician availability.
- `data/admin-app-feed.json` - office dashboard data, jobs, compliance, staff, vehicles, fines, clients, assets, reports, and reminders.
- `data/connect-v12-feed.json` - a Kingswood Connect v1.2 bridge feed for the Admin and Tech views.

The Technician App and Admin App can later be pointed at these OneDrive files, or the same structure can be moved into Microsoft Lists, SharePoint, or a proper database when the system is ready for multiple users.

For Kingswood Connect v1.2, the Hub passes this feed through the `hubFeed` link parameter when opening the Admin or Tech view.

## Suggested novice-friendly build steps

1. Replace the starter sample data with real Kingswood jobs, vehicles, technicians, clients, and documents.
2. Add file links to OneDrive documents.
3. Add email templates for sending RAMS to clients and technicians.
4. Add proper multi-user storage later, such as Microsoft Lists/SharePoint or a database.
5. Connect live vehicle tracking once the tracking provider is chosen and installed.

## Long-term system shape

- Technician App: jobs, reports, photos, signatures, RAMS, and navigation.
- Command Centre: planning, compliance, documents, vehicles, staff, clients, reporting, and administration.

The goal is one joined-up system that runs the business without relying on lots of separate apps.

## Staff and job planning rule

The Job Diary should show if a technician is sick, on holiday, training, absent, late, or on unpaid leave. If someone is unavailable, the office should see a warning before assigning work to them.
