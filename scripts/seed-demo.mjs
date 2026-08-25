import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const password = process.env.DEMO_PASSWORD || 'LogginDemo123!';
const companyName = 'Loggin Demo Company';

async function user(email, fullName, role, companyId, officeId) {
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = existing.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  let id = found?.id;
  if (!id) {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    id = data.user.id;
  } else {
    const { error } = await supabase.auth.admin.updateUserById(id, { password, email_confirm: true });
    if (error) throw error;
  }
  const { error } = await supabase.from('profiles').upsert({ id, company_id: companyId, office_id: officeId, full_name: fullName, role, active: true }, { onConflict: 'id' });
  if (error) throw error;
  return id;
}

const { data: company, error: companyError } = await supabase.from('companies').upsert({ name: companyName, email_domain: 'loggin.test' }, { onConflict: 'name' }).select().single();
if (companyError) throw companyError;

async function office(name, address) {
  const { data: found } = await supabase.from('offices').select('*').eq('company_id', company.id).eq('name', name).maybeSingle();
  if (found) return found;
  const { data, error } = await supabase.from('offices').insert({ company_id: company.id, name, address, work_start: '09:00', work_end: '18:00', grace_minutes: 15, latitude: 17.3850, longitude: 78.4867, geofence_radius_meters: 150 }).select().single();
  if (error) throw error;
  return data;
}

const hyd = await office('Hyderabad Office', 'Hyderabad');
const blr = await office('Bangalore Office', 'Bangalore');
const mum = await office('Mumbai Office', 'Mumbai');

const accounts = [
  ['founder@loggin.test', 'Loggin Founder', 'founder', hyd.id],
  ['admin@loggin.test', 'Loggin Admin', 'admin', hyd.id],
  ['manager@loggin.test', 'Loggin Manager', 'manager', blr.id],
  ['employee@loggin.test', 'Demo Employee', 'employee', hyd.id],
  ['employee2@loggin.test', 'Second Employee', 'employee', blr.id],
];

for (const [email, name, role, officeId] of accounts) await user(email, name, role, company.id, officeId);

const { data: employees } = await supabase.from('profiles').select('id,office_id').eq('company_id', company.id).in('role', ['employee','manager']);
const today = new Date().toISOString().slice(0, 10);
for (const e of employees ?? []) {
  if (e.office_id === hyd.id) await supabase.from('attendance').upsert({ employee_id: e.id, office_id: e.office_id, work_date: today, check_in_at: new Date().toISOString(), status: 'present', check_in_method: 'seed' }, { onConflict: 'employee_id,work_date' });
}

console.log('\nLoggin demo environment ready.');
console.log(`Company: ${companyName}`);
console.log(`Password for all demo users: ${password}`);
for (const [email, name, role] of accounts) console.log(`${role.padEnd(8)} ${email}  (${name})`);
