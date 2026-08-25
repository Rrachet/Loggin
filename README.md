# Loggin

**Your company, right now.**

Founder-first attendance for modern teams.

## What is working

- Work-email/password founder authentication
- Founder company onboarding
- First office creation
- Multiple offices from the founder dashboard
- Employee invitation through company work email
- Employee account/profile tied to an office
- Role-aware founder/admin vs employee experience
- Live daily attendance records in Postgres
- Manual check-in / check-out persistence
- Late detection using office start time + grace period
- Founder dashboard with present, late and absent counts
- Office-level presence pulse
- Attendance activity feed
- Row Level Security foundations
- **Signed daily office QR codes**
- **Browser camera QR scanning**
- **Office geofence verification before check-in**
- **Geofence verification before check-out**
- **Server-side distance calculation and location capture**

## Secure attendance flow

`Founder sets office location → Founder displays daily QR → Employee scans QR → Browser sends live location → Server verifies QR + office + geofence → Attendance recorded`

The QR token is signed server-side and changes every day. A screenshot of yesterday's code cannot be used today. Location is checked server-side against the office coordinates and configured radius.

## Product architecture

`Company → Offices → Employees → Attendance`

Roles:

- `founder` — full company control
- `admin` — HR/operations control
- `manager` — team-level visibility
- `employee` — own attendance and requests

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add these Supabase values to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
QR_SIGNING_SECRET=
```

Run `supabase/schema.sql` in the Supabase SQL editor before testing the app. Then run `supabase/qr_geofence.sql` to add the QR/geofence settings. The service-role key and QR signing secret are server-only and must never be exposed to the browser.

### Founder QR setup

Open `/office-qr` while signed in as a founder/admin.

1. Select an office.
2. Stand at the physical office location.
3. Click **Set office location from this device**.
4. Click **Generate today's QR**.
5. Display the QR on a reception screen, tablet or monitor.

### Employee check-in

Open `/checkin` while signed in as an employee.

1. Allow camera access.
2. Scan the office QR.
3. Allow location access.
4. Loggin verifies the signed QR and geofence.
5. Attendance is recorded as `qr_geofence`.

If the browser does not support native QR scanning, the check-in page also supports pasting the QR payload for testing.

For employee invitations, Supabase Auth email delivery/SMTP and the correct redirect URL need to be configured in the Supabase dashboard.

## Next product slices

1. Connect QR check-in directly into the employee home screen.
2. Breaks and shift rules.
3. Attendance correction requests.
4. Leave and approval workflows.
5. Manager/team permissions.
6. Monthly reports and exports.
7. Payroll-ready attendance summaries.
