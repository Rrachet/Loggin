# Loggin

**Your company, right now.**

Founder-first attendance for modern teams.

## Local development

```bash
npm install
cp .env.example .env.local
npm run seed:demo
npm run dev
```

Open `http://localhost:3000`.

### Local demo accounts

The demo seed creates **confirmed Supabase Auth users**, so these accounts do not require an email inbox or email verification:

| Role | Email | Password |
|---|---|---|
| Founder | `founder@loggin.test` | `LogginDemo123!` |
| Admin | `admin@loggin.test` | `LogginDemo123!` |
| Manager | `manager@loggin.test` | `LogginDemo123!` |
| Employee | `employee@loggin.test` | `LogginDemo123!` |
| Employee | `employee2@loggin.test` | `LogginDemo123!` |

These are local/demo identities. `loggin.test` is intentionally not a real mailbox. Do **not** use these credentials in production.

The seed command requires `SUPABASE_SERVICE_ROLE_KEY` and therefore must only be run locally or in a trusted server environment.

## Supabase setup

Add the project values to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
QR_SIGNING_SECRET=
DEMO_PASSWORD=LogginDemo123!
```

Run `supabase/schema.sql` in the Supabase SQL editor before testing the app. Then run `supabase/qr_geofence.sql` for QR/geofence functionality.

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `QR_SIGNING_SECRET` to the browser or commit them to Git.

## Product

- Work-email/password authentication
- Founder company onboarding
- Multiple offices
- Employee profiles tied to offices
- Founder/admin/manager/employee roles
- Daily attendance records
- Manual check-in/check-out
- Late detection using office start time + grace period
- Founder dashboard with present, late and absent counts
- Office-level presence pulse
- Attendance activity feed
- Row Level Security foundations
- Signed daily office QR codes
- Browser camera QR scanning
- Office geofence verification
- Server-side distance calculation and location capture

### Secure attendance flow

`Founder sets office location → Founder displays daily QR → Employee scans QR → Browser sends live location → Server verifies QR + office + geofence → Attendance recorded`

The QR token is signed server-side and changes every day. Location is checked server-side against the office coordinates and configured radius.

## Roles

- `founder` — full company control
- `admin` — HR/operations control
- `manager` — team-level visibility
- `employee` — own attendance and requests

## QR check-in

Open `/office-qr` as a founder/admin to configure an office and display its daily QR.

Open `/checkin` as an employee to scan the QR and complete the geofence check.

For production employee invitations, configure Supabase Auth email delivery/SMTP and the correct redirect URL. Local demo users bypass email verification by design.

## Next product slices

1. Connect QR check-in directly into the employee home screen.
2. Breaks and shift rules.
3. Attendance correction requests.
4. Leave and approval workflows.
5. Manager/team permissions.
6. Monthly reports and exports.
7. Payroll-ready attendance summaries.
