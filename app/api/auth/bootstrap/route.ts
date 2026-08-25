import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !service || !token) return NextResponse.json({ error: "Server authentication is not configured." }, { status: 500 });

  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, created: false });

  const metadata = user.user_metadata ?? {};
  const fullName = String(metadata.full_name || user.email?.split("@")[0] || "Founder").trim();
  const companyName = String(metadata.company_name || `${fullName}'s Company`).trim();
  const emailDomain = user.email?.split("@")[1]?.toLowerCase() || null;

  const { data: company, error: companyError } = await admin.from("companies").insert({ name: companyName, email_domain: emailDomain }).select("id").single();
  if (companyError || !company) return NextResponse.json({ error: companyError?.message || "Could not create workspace." }, { status: 400 });

  const { error: profileError } = await admin.from("profiles").insert({ id: user.id, company_id: company.id, full_name: fullName, role: "founder", active: true });
  if (profileError) {
    await admin.from("companies").delete().eq("id", company.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, created: true });
}
