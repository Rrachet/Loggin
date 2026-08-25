import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { distanceMeters } from "@/lib/qr";

export async function POST(request: Request) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  const auth = createClient(url, anonKey);
  const { data: { user } } = await auth.auth.getUser(accessToken);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const latitude = Number(body.latitude), longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return NextResponse.json({ error: "Current location is required" }, { status: 400 });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile } = await admin.from("profiles").select("id,company_id,office_id,active").eq("id", user.id).single();
  if (!profile?.active || !profile.office_id) return NextResponse.json({ error: "No active office is assigned" }, { status: 400 });
  const { data: office } = await admin.from("offices").select("id,name,latitude,longitude,geofence_radius_m,geofence_enabled").eq("id", profile.office_id).single();
  if (!office) return NextResponse.json({ error: "Office not found" }, { status: 404 });
  if (office.geofence_enabled) {
    if (office.latitude == null || office.longitude == null) return NextResponse.json({ error: "Office location is not configured" }, { status: 400 });
    const meters = distanceMeters(latitude, longitude, office.latitude, office.longitude);
    if (meters > (office.geofence_radius_m ?? 150)) return NextResponse.json({ error: `You are about ${Math.round(meters)}m away. Check out from within ${office.geofence_radius_m ?? 150}m of ${office.name}.` }, { status: 403 });
  }
  const { data: record } = await admin.from("attendance").select("id,check_in_at,check_out_at").eq("employee_id", user.id).eq("work_date", new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())).single();
  if (!record?.check_in_at) return NextResponse.json({ error: "No check-in found for today" }, { status: 400 });
  if (record.check_out_at) return NextResponse.json({ error: "Attendance is already closed" }, { status: 400 });
  const now = new Date();
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(record.check_in_at).getTime()) / 60000));
  const { data, error } = await admin.from("attendance").update({ check_out_at: now.toISOString(), total_working_minutes: minutes, check_out_latitude: latitude, check_out_longitude: longitude }).eq("id", record.id).eq("employee_id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, attendance: data });
}
