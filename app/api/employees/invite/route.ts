import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { appUrl } from "@/lib/app-url";

export async function POST(request: Request) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });

  const auth = createClient(url, anonKey);
  const { data: { user }, error: userError } = await auth.auth.getUser(accessToken);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: actor } = await admin.from("profiles").select("company_id,role,active").eq("id", user.id).single();
  if (!actor?.active || !["founder", "admin"].includes(actor.role)) return NextResponse.json({ error: "Only founders and admins can invite employees" }, { status: 403 });

  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.fullName || "").trim();
  const officeId = String(body.officeId || "");
  if (!email || !fullName || !officeId) return NextResponse.json({ error: "Email, name and office are required" }, { status: 400 });

  const { data: office } = await admin.from("offices").select("id,company_id,archived_at").eq("id", officeId).single();
  if (!office || office.company_id !== actor.company_id || office.archived_at) return NextResponse.json({ error: "Invalid or archived office" }, { status: 400 });

  // Invitation links must always point to the deployed Loggin app. Never use request.url here,
  // because the founder may be creating employees from localhost during development.
  const redirectTo = appUrl("/set-password");
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: fullName, company_id: actor.company_id, office_id: officeId, role: "employee", invited: true },
  });
  if (inviteError || !invited.user) return NextResponse.json({ error: inviteError?.message ?? "Unable to invite employee" }, { status: 400 });

  const { error: profileError } = await admin.from("profiles").upsert({
    id: invited.user.id,
    company_id: actor.company_id,
    office_id: officeId,
    full_name: fullName,
    employee_id: body.employeeId ? String(body.employeeId) : null,
    department: body.department ? String(body.department) : null,
    designation: body.designation ? String(body.designation) : null,
    role: "employee",
    active: true,
  }, { onConflict: "id" });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  return NextResponse.json({ ok: true, employeeId: invited.user.id });
}
