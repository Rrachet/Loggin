# Claude build audit — fixed

The supplied Claude build was audited for authentication, workspace isolation, invitation provisioning, attendance, QR and geofence flows.

Security fixes applied:
- Bootstrap no longer trusts company, office or role IDs from user-controlled metadata.
- Direct signup is founder-only; invited employee provisioning remains server-side.
- Server API callers are resolved from the Supabase bearer token and checked against their Loggin profile.
- Service-role credentials remain server-only.

Product direction:
- Real Supabase accounts; no demo/seed accounts.
- Founder creates a workspace, adds offices and invites employees.
- Employees create their own passwords and use the attendance flow.

Validation note: run npm install and npm run build locally/CI before treating the build as production-ready.
