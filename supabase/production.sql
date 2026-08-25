-- Loggin production auth + attendance setup.
-- Run this once in the Supabase SQL editor after supabase/schema.sql.

alter table public.offices
  add column if not exists geofence_enabled boolean not null default false,
  add column if not exists qr_enabled boolean not null default true;

create index if not exists offices_location_idx on public.offices(latitude, longitude);

-- Create a company + founder profile automatically when a person signs up.
-- Invited employees reuse the company/office/role metadata supplied by the inviter.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_company_id uuid;
  requested_company_id uuid;
  requested_office_id uuid;
  requested_role public.user_role;
  requested_name text;
begin
  requested_company_id := nullif(new.raw_user_meta_data->>'company_id', '')::uuid;
  requested_office_id := nullif(new.raw_user_meta_data->>'office_id', '')::uuid;
  requested_name := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(coalesce(new.email, 'User'), '@', 1));

  if requested_company_id is not null then
    new_company_id := requested_company_id;
    requested_role := case when new.raw_user_meta_data->>'role' = 'founder' then 'founder'::public.user_role else 'employee'::public.user_role end;
  else
    insert into public.companies (name, email_domain)
    values (
      coalesce(nullif(trim(new.raw_user_meta_data->>'company_name'), ''), requested_name || '''s Company'),
      nullif(lower(split_part(coalesce(new.email, ''), '@', 2)), '')
    )
    returning id into new_company_id;
    requested_role := 'founder'::public.user_role;
  end if;

  insert into public.profiles (id, company_id, office_id, full_name, role, active)
  values (new.id, new_company_id, requested_office_id, requested_name, requested_role, true)
  on conflict (id) do update set company_id=excluded.company_id, office_id=excluded.office_id, full_name=excluded.full_name, role=excluded.role, active=true;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

grant execute on function public.handle_new_user() to service_role;

-- Managers can see attendance for their own company, while employees see only their own records.
drop policy if exists "employees manage own attendance" on public.attendance;
drop policy if exists "attendance visibility and self service" on public.attendance;
create policy "attendance visibility and self service" on public.attendance
for all to authenticated
using (
  employee_id = auth.uid()
  or public.is_company_admin((select company_id from public.profiles where id = employee_id))
  or exists (select 1 from public.profiles viewer where viewer.id = auth.uid() and viewer.company_id = (select company_id from public.profiles where id = employee_id) and viewer.role = 'manager' and viewer.active = true)
)
with check (employee_id = auth.uid());

-- Browser users cannot manufacture founder/admin profiles.
drop policy if exists "users can create their founder profile" on public.profiles;
drop policy if exists "users can create only own profile" on public.profiles;
create policy "users can create only own profile" on public.profiles
for insert to authenticated
with check (id = auth.uid() and role = 'employee');
