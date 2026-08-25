import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Keep the local demo password identical to the password shown by the login UI.
// Do not use this credential outside local development.
const password = 'LogginDemo123!';
const companyName = 'Loggin Demo Company';

async function assertOk(label, result) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function findAuthUser(email) {
  const data = await assertOk(
    `Looking up ${email}`,
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  );
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}

async function user(email, fullName, role, companyId, officeId) {
  const found = await findAuthUser(email);
  let id = found?.id;

  if (!id) {
    const data = await assertOk(
      `Creating ${email}`,
      supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { demo: true },
      }),
    );
    id = data.user.id;
  } else {
    await assertOk(
      `Resetting password for ${email}`,
      supabase.auth.admin.updateUserById(id, {
        password,
        email_confirm: true,
        user_metadata: { demo: true },
      }),
    );
  }

  await assertOk(
    `Saving profile for ${email}`,
    supabase.from('profiles').upsert(
      {
        id,
        company_id: companyId,
        office_id: officeId,
        full_name: fullName,
        role,
        active: true,
      },
      { onConflict: 'id' },
    ),
  );

  // Verify the exact credentials used by the browser login form.
  const browserClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '');
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  }
  const { error: loginError } = await browserClient.auth.signInWithPassword({ email, password });
  if (loginError) throw new Error(`Login verification failed for ${email}: ${loginError.message}`);
  await browserClient.auth.signOut();
}

const { data: company, error: companyError } = await supabase
  .from('companies')
  .upsert({ name: companyName, email_domain: 'loggin.test' }, { onConflict: 'name' })
  .select()
  .single();
if (companyError) throw companyError;

async function office(name, address) {
  const { data: found, error: findError } = await supabase
    .from('offices')
    .select('*')
    .eq('company_id', company.id)
    .eq('name', name)
    .maybeSingle();
  if (findError) throw findError;
  if (found) return found;

  const { data, error } = await supabase
    .from('offices')
    .insert({
      company_id: company.id,
      name,
      address,
      work_start: '09:00',
      work_end: '18:00',
      grace_minutes: 15,
      latitude: 17.3850,
      longitude: 78.4867,
      geofence_radius_meters: 150,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

const hyd = await office('Hyderabad Office', 'Hyderabad');
const blr = await office('Bangalore Office', 'Bangalore');
await office('Mumbai Office', 'Mumbai');

const accounts = [
  ['founder@loggin.test', 'Loggin Founder', 'founder', hyd.id],
  ['admin@loggin.test', 'Loggin Admin', 'admin', hyd.id],
  ['manager@loggin.test', 'Loggin Manager', 'manager', blr.id],
  ['employee@loggin.test', 'Demo Employee', 'employee', hyd.id],
  ['employee2@loggin.test', 'Second Employee', 'employee', blr.id],
];

for (const [email, name, role, officeId] of accounts) {
  await user(email, name, role, company.id, officeId);
}

const { data: employees, error: employeeError } = await supabase
  .from('profiles')
  .select('id,office_id')
  .eq('company_id', company.id)
  .in('role', ['employee', 'manager']);
if (employeeError) throw employeeError;

const today = new Date().toISOString().slice(0, 10);
for (const employee of employees ?? []) {
  if (employee.office_id === hyd.id) {
    const { error } = await supabase.from('attendance').upsert(
      {
        employee_id: employee.id,
        office_id: employee.office_id,
        work_date: today,
        check_in_at: new Date().toISOString(),
        status: 'present',
        check_in_method: 'seed',
      },
      { onConflict: 'employee_id,work_date' },
    );
    if (error) throw error;
  }
}

console.log('\n✓ Loggin local demo environment ready.');
console.log(`Company: ${companyName}`);
console.log(`Password for every demo user: ${password}`);
for (const [email, name, role] of accounts) {
  console.log(`${role.padEnd(8)} ${email}  (${name})  ✓ login verified`);
}
