import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { distanceMeters, verifyQrToken } from "@/lib/qr";

function workDate(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function POST(request: Request) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey || !process.env.QR_SIGNING_SECRET) return NextResponse.json({ error: "Attendance security is not configured" }, { status: 500 });
  const auth = createClient(url, anonKey);
  const { data: { user } } = await auth.auth.getUser(accessToken);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const officeId = String(body.officeId || "");
  const qrDate = String(body.date || "");
  const token = String(body.token || "");
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!officeId || !qrDate || !token || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return NextResponse.json({ error: "QR code and current location are required" }, { status: 400 });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const [{ data: profile }, { data: office }, { data: company }] = await Promise.all([
    admin.from("profiles").select("id,company_id,office_id,active,role").eq("id", user.id).single(),
    admin.from("offices").select("id,company_id,name,latitude,longitude,geofence_radius_m,geofence_enabled,qr_enabled,work_start,grace_minutes").eq("id", officeId).single(),
    admin.from("companies").select("id,timezone").eq("id", (await admin.from("profiles").select("company_id").eq("id", user.id).single()).data?.company_id ?? "").maybeSingle(),
  ]);
  if (!profile?.active || profile.office_id !== officeId) return NextResponse.json({ error: "This QR code belongs to a different office" }, { status: 403 });
  if (!office || office.company_id !== profile.company_id || !office.qr_enabled) return NextResponse.json({ error: "Invalid office QR" }, { status: 400 });
  if (!verifyQrToken(officeId, qrDate, token)) return NextResponse.json({ error: "QR code expired or invalid" }, { status: 400 });
  const tz = company?.timezone || "Asia/Kolkata";
  if (qrDate !== workDate(tz)) return NextResponse.json({ error: "This QR code is no longer valid" }, { status: 400 });
  if (office.geofence_enabled) {
    if (office.latitude == null || office.longitude == null) return NextResponse.json({ error: "This office has not been geolocated yet" }, { status: 400 });
    const meters = distanceMeters(latitude, longitude, office.latitude, office.longitude);
    if (meters > (office.geofence_radius_m ?? 150)) return NextResponse.json({ error: `You are about ${Math.round(meters)}m away. Check in from within ${office.geofence_radius_m ?? 150}m of ${office.name}.` }, { status: 403 });
  }
  const now = new Date();
  const date = workDate(tz);
  const [h, m] = String(office.work_start).slice(0, 5).split(":").map(Number);
  const localParts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const hour = Number(localParts.find(p => p.type === "hour")?.value ?? now.getHours());
  const minute = Number(localParts.find(p => p.type === "minute")?.value ?? now.getMinutes());
  const late = hour * 60 + minute > h * 60 + m + (office.grace_minutes ?? 15);
  const { data, error } = await admin.from("attendance").insert({ employee_id: user.id, office_id: officeId, work_date: date, check_in_at: now.toISOString(), status: late ? "late" : "present", check_in_method: "qr_geofence", check_in_latitude: latitude, check_in_longitude: longitude }).select().single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Today's attendance is already recorded" : error.message }, { status: 400 });
  return NextResponse.json({ ok: true, attendance: data });
}
