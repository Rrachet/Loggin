"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase, supabaseConfigError } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  employee_id: string | null;
  office_id: string | null;
  role: string;
  active: boolean;
};

type Attendance = {
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_working_minutes: number | null;
  status: string;
};

const dateInIndia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const time = (value: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
const duration = (minutes: number | null) => minutes == null ? "—" : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

export default function EmployeePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [today, setToday] = useState<Attendance | null>(null);
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!supabase) {
      setError(supabaseConfigError ?? "Supabase is not configured.");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: profileData } = await supabase.from("profiles").select("id,full_name,employee_id,office_id,role,active").eq("id", session.user.id).maybeSingle();
    if (!profileData || profileData.role !== "employee" || !profileData.active) {
      setError("This account is not an active Loggin employee account.");
      return;
    }
    setProfile(profileData as Profile);
    setEmail(session.user.email ?? "");
    setEmployeeId(profileData.employee_id ?? "");
    const { data: attendance } = await supabase.from("attendance").select("work_date,check_in_at,check_out_at,total_working_minutes,status").eq("employee_id", session.user.id).eq("work_date", dateInIndia()).maybeSingle();
    setToday((attendance as Attendance | null) ?? null);
  }

  useEffect(() => { void load(); }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!supabase) { setError(supabaseConfigError ?? "Supabase is not configured."); return; }
    setLoading(true); setError(""); setMessage("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Your session has expired. Please sign in again."); setLoading(false); return; }
    const { error: updateError } = await supabase.from("profiles").update({ employee_id: employeeId.trim() || null }).eq("id", session.user.id);
    setLoading(false);
    if (updateError) setError(updateError.message); else { setMessage("Profile updated."); void load(); }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Loggin</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">My attendance</h1></div>
          <button onClick={signOut} className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.02]">Sign out</button>
        </header>
        {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {message && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}
        <section className="grid gap-5 md:grid-cols-[1.3fr_.7fr]">
          <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-[0_12px_40px_rgba(0,0,0,.04)]">
            <p className="text-sm text-[var(--muted)]">Today</p>
            <h2 className="mt-2 text-2xl font-semibold">{today ? today.status : "Not checked in yet"}</h2>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-[var(--paper)] p-4"><p className="text-xs text-[var(--muted)]">Check in</p><p className="mt-1 font-semibold">{time(today?.check_in_at ?? null)}</p></div>
              <div className="rounded-2xl bg-[var(--paper)] p-4"><p className="text-xs text-[var(--muted)]">Check out</p><p className="mt-1 font-semibold">{time(today?.check_out_at ?? null)}</p></div>
              <div className="rounded-2xl bg-[var(--paper)] p-4"><p className="text-xs text-[var(--muted)]">Worked</p><p className="mt-1 font-semibold">{duration(today?.total_working_minutes ?? null)}</p></div>
            </div>
          </div>
          <div className="rounded-3xl border border-black/10 bg-[var(--accent)] p-7 text-white"><p className="text-sm text-white/60">Employee</p><h2 className="mt-2 text-2xl font-semibold">{profile?.full_name ?? "Your profile"}</h2><p className="mt-2 text-sm text-white/60">{email}</p><div className="mt-6 rounded-2xl bg-white/10 p-4"><p className="text-xs text-white/50">Employee ID</p><p className="mt-1 font-semibold">{employeeId || "Not assigned"}</p></div></div>
        </section>
        <section className="mt-5 rounded-3xl border border-black/10 bg-white p-7 shadow-[0_12px_40px_rgba(0,0,0,.04)]"><p className="text-sm font-semibold">Profile</p><form onSubmit={saveProfile} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Employee ID<input value={employeeId} onChange={e=>setEmployeeId(e.target.value)} className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none focus:border-[var(--accent)]" placeholder="EMP-001" /></label><div className="flex items-end"><button disabled={loading} className="w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50">{loading ? "Saving…" : "Save changes"}</button></div></form></section>
      </div>
    </main>
  );
}
