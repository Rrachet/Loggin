# Local demo seed

Run from the repository root after configuring `.env.local`:

```bash
npm run seed:demo
```

Optional custom demo password:

```bash
DEMO_PASSWORD="YourLocalPassword123!" npm run seed:demo
```

The script uses the Supabase service-role key locally to create/refresh confirmed Auth users and their profiles. Never commit `.env.local` or a service-role key.

Demo accounts:

- founder@loggin.test — founder
- admin@loggin.test — admin
- manager@loggin.test — manager
- employee@loggin.test — employee
- employee2@loggin.test — employee

Default password: `LogginDemo123!`
