create extension if not exists "pgcrypto";

create type public.user_role as enum ('founder','admin','manager','employee');
create type public.attendance_status as enum ('present','late','absent','on_leave','remote');
create type public.work_location as enum ('office','remote','field');

create table public.companies (
  id uuid primary key default gen_random_uuid(), name text not null, logo_url text, email_domain text,
  timezone text not null default 'Asia/Kolkata', created_at timestamptz not null default now()
);
create table public.offices (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, address text, latitude double precision, longitude double precision,
  geofence_radius_m integer default 150, work_start time not null default '09:00', work_end time not null default '18:00',
  grace_minutes integer not null default 15, created_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade,
  office_id uuid references public.offices(id) on delete set null, full_name text not null, employee_id text,
  department text, designation text, role public.user_role not null default 'employee',
  work_location public.work_location not null default 'office', active boolean not null default true, created_at timestamptz not null default now()
);
create table public.attendance (
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.profiles(id) on delete cascade,
  office_id uuid references public.offices(id) on delete set null, work_date date not null default current_date,
  check_in_at timestamptz, check_out_at timestamptz, total_working_minutes integer,
  status public.attendance_status not null default 'present', check_in_method text not null default 'manual',
  check_in_latitude double precision, check_in_longitude double precision, check_out_latitude double precision,
  check_out_longitude double precision, created_at timestamptz not null default now(), unique(employee_id, work_date)
);
create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(), attendance_id uuid not null references public.attendance(id) on delete cascade,
  requested_by uuid not null references public.profiles(id), requested_check_in_at timestamptz, requested_check_out_at timestamptz,
  reason text not null, status text not null default 'pending', reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null, end_date date not null, leave_type text not null, reason text, status text not null default 'pending',
  reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, created_at timestamptz not null default now()
);

create index offices_company_idx on public.offices(company_id);
create index profiles_company_idx on public.profiles(company_id);
create index profiles_office_idx on public.profiles(office_id);
create index attendance_employee_date_idx on public.attendance(employee_id, work_date desc);
create index attendance_office_date_idx on public.attendance(office_id, work_date desc);

alter table public.companies enable row level security;
alter table public.offices enable row level security;
alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.leave_requests enable row level security;

create or replace function public.current_company_id() returns uuid language sql stable security definer set search_path = public
as $$ select company_id from public.profiles where id = auth.uid(); $$;
create or replace function public.is_company_admin(target_company uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and company_id = target_company and role in ('founder','admin') and active = true); $$;

create policy "authenticated users can create companies" on public.companies for insert to authenticated with check (true);
create policy "members can view their company" on public.companies for select to authenticated using (id = public.current_company_id());
create policy "company admins manage offices" on public.offices for all to authenticated using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
create policy "users can view company profiles" on public.profiles for select to authenticated using (company_id = public.current_company_id());
create policy "users can create their founder profile" on public.profiles for insert to authenticated with check (id = auth.uid() and role = 'founder');
create policy "company admins manage profiles" on public.profiles for update to authenticated using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
create policy "employees manage own attendance" on public.attendance for all to authenticated using (employee_id = auth.uid() or public.is_company_admin((select company_id from public.profiles where id = employee_id))) with check (employee_id = auth.uid());
create policy "employees manage own corrections" on public.attendance_corrections for all to authenticated using (requested_by = auth.uid() or public.is_company_admin((select company_id from public.profiles where id = requested_by))) with check (requested_by = auth.uid());
create policy "employees manage own leave" on public.leave_requests for all to authenticated using (employee_id = auth.uid() or public.is_company_admin((select company_id from public.profiles where id = employee_id))) with check (employee_id = auth.uid());
