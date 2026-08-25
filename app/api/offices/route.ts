import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return null;
  return { auth: createClient(url, anon), admin: createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

async function actor(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const c = clients();
  if (!token || !c) return null;
  const { data: { user } } = await c.auth.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await c.admin.from("profiles").select("id,company_id,role,active").eq("id", user.id).single();
  if (!profile?.active || !["founder", "admin"].includes(profile.role)) return null;
  return { ...c, profile };
}

export async function GET(request: Request) {
  const ctx = await actor(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await ctx.admin.from("offices").select("id,name,address,latitude,longitude,geofence_radius_m,geofence_enabled,work_start,work_end,grace_minutes").eq("company_id", ctx.profile.company_id).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ offices: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await actor(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const name = String(body.name || "").trim();
  const address = String(body.address || "").trim() || null;
  const latitude = body.latitude == null || body.latitude === "" ? null : Number(body.latitude);
  const longitude = body.longitude == null || body.longitude === "" ? null : Number(body.longitude);
  const radius = body.geofence_radius_m == null || body.geofence_radius_m === "" ? 150 : Number(body.geofence_radius_m);
  if (!name) return NextResponse.json({ error: "Office name is required" }, { status: 400 });
  if (latitude != null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) return NextResponse.json({ error: "Invalid latitude" }, { status: 400 });
  if (longitude != null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180)) return NextResponse.json({ error: "Invalid longitude" }, { status: 400 });
  if (!Number.isInteger(radius) || radius < 25 || radius > 5000) return NextResponse.json({ error: "Geofence radius must be between 25m and 5000m" }, { status: 400 });
  const { data, error } = await ctx.admin.from("offices").insert({ company_id: ctx.profile.company_id, name, address, latitude, longitude, geofence_radius_m: radius, geofence_enabled: latitude != null && longitude != null }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ office: data });
}
