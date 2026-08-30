# Loggin

> **Full-stack attendance application demonstrating authentication, authorization, configuration and secure data access.**

Loggin is a supporting application project focused on the operational concerns around a production-style system: user roles, configuration, authentication, database permissions, server-side validation and secure handling of secrets.

## Engineering signals

- Supabase Auth with real user accounts
- Founder, admin, manager and employee roles
- PostgreSQL + Row Level Security
- Office assignment and geofencing
- Server-side attendance validation
- Signed QR-code workflow
- Environment-based configuration
- Secure handling of service-role credentials

## Operational troubleshooting scenarios

```text
Authentication problem
      ↓
Check account / Auth configuration
      ↓
Check application configuration
      ↓
Check database / RLS behaviour
      ↓
Validate server-side request
      ↓
Resolve or escalate
```

Typical investigation areas include authentication failures, redirect configuration, database permissions, environment variables, geofence behaviour and role/permission issues.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure Supabase using the documented SQL files and environment variables. Service-role credentials and QR signing secrets must remain server-only.

## Security

Attendance writes are validated on the server with the authenticated Supabase user. Company isolation is enforced through Row Level Security, and privileged credentials are not sent to the browser.

## Portfolio role

**SUPPORTING ENGINEERING — authentication, configuration and security**

Loggin adds depth to the IBM application-support profile by demonstrating the configuration and access-control issues that can appear in real applications.

## License

MIT
