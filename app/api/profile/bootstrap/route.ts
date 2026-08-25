import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const admin = adminClient();
  if (!token || !admin) return NextResponse.json({ error: "Server authentication is not configured" }, { status: 500 });

  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await admin.from("profiles").select("id,company_id,office_id,full_name,role,active").eq("id", user.id).maybeSingle();
  if (existing) return NextResponse.json({ profile: existing, created: false });

  const body = await request.json().catch(() => ({}));
  const fullName = String(body.fullName || user.user_metadata?.full_name || user.email?.split("@")[0] || "Founder").trim();
  const companyName = String(body.companyName || user.user_metadata?.company_name || `${fullName}'s Company`).trim();
  const emailDomain = user.email?.split("@")[1]?.toLowerCase() || null;

  const { data: company, error: companyError } = await admin.from("companies").insert({ name: companyName, email_domain: emailDomain }).select("id").single();
  if (companyError || !company) return NextResponse.json({ error: companyError?.message || "Could not create company" }, { status: 400 });

  const { data: profile, error: profileError } = await admin.from("profiles").insert({ id: user.id, company_id: company.id, full_name: fullName, role: "founder", active: true }).select("id,company_id,office_id,full_name,role,active").single();
  if (profileError || !profile) {
    await admin.from("companies").delete().eq("id", company.id);
    return NextResponse.json({ error: profileError?.message || "Could not create profile" }, { status: 400 });
  }

  return NextResponse.json({ profile, created: true });
}
