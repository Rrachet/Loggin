# Loggin

**Your company, right now.**

Founder-first attendance for modern teams.

## Current MVP

The first vertical slice is now in the app UI:

- Founder/admin dashboard
- Company-wide presence, late and absence metrics
- Multi-office filtering
- Employee creation flow
- Employee view with check-in / check-out interaction
- Office pulse overview
- Attendance activity feed
- Initial Supabase/Postgres schema for companies, offices, profiles, attendance, corrections and leave requests

The current dashboard uses local demo state so the product experience can be shaped before connecting production authentication and persistence.

## Product architecture

`Company → Offices → Employees → Attendance`

Roles are designed as:

- `founder` — full company control
- `admin` — HR/operations control
- `manager` — team-level visibility
- `employee` — own attendance and requests

## Next implementation slice

1. Supabase Auth with work-email login/invite flow.
2. Company onboarding and founder creation.
3. Persist offices and employees in Postgres.
4. Connect check-in/check-out to attendance records.
5. Add server-side role checks and Row Level Security.
6. Add QR attendance and office geofence verification.
7. Add attendance corrections, leave and monthly reporting.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set the Supabase variables in `.env.local` before enabling persistence/auth.
