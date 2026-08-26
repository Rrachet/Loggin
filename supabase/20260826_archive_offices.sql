-- Safe office archiving. Attendance history is preserved.
alter table public.offices add column if not exists archived_at timestamptz null;
create index if not exists offices_company_archived_idx on public.offices(company_id, archived_at, name);