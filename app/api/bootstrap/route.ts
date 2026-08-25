import { NextResponse } from "next/server";
import { resolveCaller, isFailure } from "@/lib/auth-server";

export async function POST(request: Request) {
  const ctx = await resolveCaller(request);
  if (isFailure(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.profile) return NextResponse.json({ ok: true, profile: ctx.profile, created: false });
  const { admin, userId, email } = ctx;
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const meta = (authUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = String(meta.full_name ?? "").trim() || (email ? email.split("@")[0] : "New user");
  if (meta.invited || meta.company_id || meta.office_id || meta.role) return NextResponse.json({ error: "Your invitation setup is incomplete. Ask an admin to resend the invitation." }, { status: 409 });
  const companyName = String(meta.company_name ?? "").trim() || `${fullName}'s company`;
  const domain = email && email.includes("@") ? email.split("@")[1].toLowerCase() : null;
  const { data: company, error: companyError } = await admin.from("companies").insert({ name: companyName, email_domain: domain }).select("id").single();
  if (companyError) return NextResponse.json({ error: companyError.message }, { status: 400 });
  const { data: profile, error: profileError } = await admin.from("profiles").upsert({ id:userId, company_id:company.id, office_id:null, full_name:fullName, role:"founder", active:true }, { onConflict:"id" }).select("id,company_id,office_id,full_name,role,active").single();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  return NextResponse.json({ ok:true, profile, created:true });
}
