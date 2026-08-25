-- QR + geofence migration. Run after supabase/schema.sql.

alter table public.offices
  add column if not exists geofence_enabled boolean not null default true,
  add column if not exists qr_enabled boolean not null default true;

create index if not exists offices_location_idx on public.offices(latitude, longitude);

-- Existing offices must be given coordinates before secure QR check-in can succeed.
-- The /office-qr page lets a founder/admin set the office location from their browser.
