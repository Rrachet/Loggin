import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  const auth = createClient(url, anonKey);
  const { data: { user } } = await auth.auth.getUser(accessToken);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const officeId = String(body.officeId || "");
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!officeId || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return NextResponse.json({ error: "Valid office coordinates are required" }, { status: 400 });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: actor } = await admin.from("profiles").select("company_id,role,active").eq("id", user.id).single();
  if (!actor || !actor.active || !["founder", "admin"].includes(actor.role)) return NextResponse.json({ error: "Only founders and admins can set office location" }, { status: 403 });
  const { data: office } = await admin.from("offices").select("company_id").eq("id", officeId).single();
  if (!office || office.company_id !== actor.company_id) return NextResponse.json({ error: "Invalid office" }, { status: 404 });
  const { error } = await admin.from("offices").update({ latitude, longitude, geofence_enabled: true }).eq("id", officeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, latitude, longitude });
}
