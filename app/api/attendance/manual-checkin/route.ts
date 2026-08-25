import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { distanceMeters } from "@/lib/qr";

function workDate(timeZone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !anon || !service) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  const auth = createClient(url, anon);
  const { data: { user } } = await auth.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const latitude = body.latitude == null ? null : Number(body.latitude);
  const longitude = body.longitude == null ? null : Number(body.longitude);
  if ((latitude != null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) || (longitude != null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180))) return NextResponse.json({ error: "Invalid location" }, { status: 400 });

  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile } = await admin.from("profiles").select("id,company_id,office_id,active").eq("id", user.id).single();
  if (!profile?.active) return NextResponse.json({ error: "Your account is inactive" }, { status: 403 });
  if (!profile.office_id) return NextResponse.json({ error: "Ask your admin to assign you an office first" }, { status: 400 });
  const [{ data: office }, { data: company }] = await Promise.all([
    admin.from("offices").select("id,name,latitude,longitude,geofence_radius_m,geofence_enabled,work_start,grace_minutes").eq("id", profile.office_id).single(),
    admin.from("companies").select("timezone").eq("id", profile.company_id).single(),
  ]);
  if (!office) return NextResponse.json({ error: "Your office could not be found" }, { status: 404 });
  if (office.geofence_enabled) {
    if (latitude == null || longitude == null) return NextResponse.json({ error: "Location permission is required for attendance at this office" }, { status: 400 });
    const meters = distanceMeters(latitude, longitude, office.latitude, office.longitude);
    if (meters > (office.geofence_radius_m ?? 150)) return NextResponse.json({ error: `You are about ${Math.round(meters)}m away. Check in from within ${office.geofence_radius_m ?? 150}m of ${office.name}.` }, { status: 403 });
  }
  const tz = company?.timezone || "Asia/Kolkata";
  const date = workDate(tz);
  const now = new Date();
  const [h, m] = String(office.work_start).slice(0, 5).split(":").map(Number);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const hour = Number(parts.find(p => p.type === "hour")?.value ?? now.getHours());
  const minute = Number(parts.find(p => p.type === "minute")?.value ?? now.getMinutes());
  const status = hour * 60 + minute > h * 60 + m + (office.grace_minutes ?? 15) ? "late" : "present";
  const { data, error } = await admin.from("attendance").insert({ employee_id: user.id, office_id: office.id, work_date: date, check_in_at: now.toISOString(), status, check_in_method: "manual", check_in_latitude: latitude, check_in_longitude: longitude }).select().single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "You are already checked in today" : error.message }, { status: 400 });
  return NextResponse.json({ ok: true, attendance: data });
}
