# Loggin

**Your company, right now.**

Founder-first attendance for modern teams.

## Start locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Run `supabase/production.sql` once. It adds the production signup trigger, geofence flags, and attendance permissions.
4. Add these values to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
QR_SIGNING_SECRET=
```

The service-role key and QR signing secret are server-only. Never expose them in browser code or commit them to Git.

### Supabase Auth

Enable Email/Password authentication. If email confirmation is enabled, new users receive a confirmation email and are sent back to `/dashboard`. If confirmation is disabled for a trusted internal deployment, users can sign up and enter the dashboard immediately.

For production email delivery, configure Supabase Auth SMTP and add your deployed app URL to the Auth redirect URL allow-list.

## Product flow

### Founder

1. Open `/signup`.
2. Create a real account with name, company, email and password.
3. Sign in at `/`.
4. Create an office from a device physically at that office. Loggin captures its location and enables the geofence.
5. Invite employees. Each employee receives an email and creates their own password.
6. Display the daily office QR from `/office-qr` if QR attendance is desired.

### Employee

1. Open the invitation email.
2. Set a personal password at `/set-password`.
3. Log in at `/`.
4. Press **Check in** at the start of the day and **Check out** when leaving.
5. Loggin records the date, time, status, location and working duration.

## Attendance

- Real Supabase Auth accounts — no demo users or seed data.
- Founder, admin, manager and employee roles.
- Office assignment and office geofencing.
- Check-in and check-out with server-side validation.
- Late detection using office start time + grace period.
- Daily attendance history.
- Founder/admin team attendance pulse.
- Signed daily QR codes as an optional secure check-in method.
- Row Level Security for company isolation.

## Security

Attendance writes are validated on the server with the authenticated Supabase user. The service-role key is never sent to the browser. Company and employee profiles are created by a database trigger from the authenticated signup/invitation metadata, preventing the browser from manufacturing founder/admin identities.
