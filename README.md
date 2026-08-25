# Loggin

**Your company, right now.**

Founder-first attendance for modern teams.

## What is working

The first real product loop is now wired for Supabase:

- Work-email/password founder authentication
- Founder company onboarding
- First office creation
- Multiple offices from the founder dashboard
- Employee invitation through company work email
- Employee account/profile tied to an office
- Role-aware founder/admin vs employee experience
- Live daily attendance records in Postgres
- Check-in / check-out persistence
- Late detection using office start time + grace period
- Founder dashboard with present, late and absent counts
- Office-level presence pulse
- Attendance activity feed
- Row Level Security foundations

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
```

Run `supabase/schema.sql` in the Supabase SQL editor before testing the app. The service-role key is server-only and must never be exposed to the browser.

For employee invitations, Supabase Auth email delivery/SMTP and the correct redirect URL need to be configured in the Supabase dashboard.

## Next product slices

1. QR-based office check-in.
2. Geofence verification.
3. Breaks and shift rules.
4. Attendance correction requests.
5. Leave and approval workflows.
6. Manager/team permissions.
7. Monthly reports and exports.
8. Payroll-ready attendance summaries.
