import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });

  const authClient = createClient(url, anonKey);
  const { data: { user }, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: actor } = await admin.from("profiles").select("company_id,role,active").eq("id", user.id).single();
  if (!actor || !actor.active || !["founder", "admin"].includes(actor.role)) return NextResponse.json({ error: "Only founders and admins can invite employees" }, { status: 403 });

  const body = await request.json();
  const { email, fullName, officeId, department, designation, employeeId } = body;
  if (!email || !fullName || !officeId) return NextResponse.json({ error: "Email, name and office are required" }, { status: 400 });

  const { data: office } = await admin.from("offices").select("id,company_id").eq("id", officeId).single();
  if (!office || office.company_id !== actor.company_id) return NextResponse.json({ error: "Invalid office" }, { status: 400 });

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, company_id: actor.company_id, office_id: officeId, role: "employee" },
  });
  if (inviteError || !invited.user) return NextResponse.json({ error: inviteError?.message ?? "Unable to invite employee" }, { status: 400 });

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    company_id: actor.company_id,
    office_id: officeId,
    full_name: fullName,
    employee_id: employeeId ?? null,
    department: department ?? null,
    designation: designation ?? null,
    role: "employee",
  });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

  return NextResponse.json({ ok: true, employeeId: invited.user.id });
}
