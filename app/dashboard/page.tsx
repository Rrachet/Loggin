"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; company_id: string; office_id: string | null; full_name: string; employee_id: string | null; department: string | null; designation: string | null; role: string; active: boolean };
type Office = { id: string; name: string; address: string | null; latitude: number | null; longitude: number | null; geofence_radius_m: number; geofence_enabled: boolean; work_start: string; work_end: string; grace_minutes: number };
type Attendance = { id: string; employee_id: string; work_date: string; check_in_at: string | null; check_out_at: string | null; total_working_minutes: number | null; status: string };

const dateInIndia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const time = (v: string | null) => v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"overview" | "people" | "attendance">("overview");
  const [officeName, setOfficeName] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [showOfficeForm, setShowOfficeForm] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    if (!supabase) { setMessage("Supabase is not configured."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/"; return; }
    const { data: p } = await supabase.from("profiles").select("id,company_id,office_id,full_name,employee_id,department,designation,role,active").eq("id", session.user.id).maybeSingle();
    if (!p) { setMessage("We couldn't load your Loggin profile."); return; }
    setProfile(p);
    const { data: o } = await supabase.from("offices").select("id,name,address,latitude,longitude,geofence_radius_m,geofence_enabled,work_start,work_end,grace_minutes").eq("company_id", p.company_id).order("name");
    const list = o ?? [];
    setOffices(list);
    setSelectedOffice(prev => list.find(x => x.id === prev?.id) ?? list[0] ?? null);
  }

  async function loadOfficeData(officeId: string) {
    if (!supabase) return;
    const { data: p } = await supabase.from("profiles").select("id,company_id,office_id,full_name,employee_id,department,designation,role,active").eq("office_id", officeId).order("full_name");
    setPeople(p ?? []);
    const { data: a } = await supabase.from("attendance").select("id,employee_id,work_date,check_in_at,check_out_at,total_working_minutes,status").eq("office_id", officeId).eq("work_date", dateInIndia());
    setAttendance(a ?? []);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedOffice) loadOfficeData(selectedOffice.id); }, [selectedOffice?.id]);

  async function createOffice(e: FormEvent) {
    e.preventDefault(); if (!supabase) return; setBusy(true); setMessage("");
    const { data: { session } } = await supabase.auth.getSession();
    let latitude: number | undefined, longitude: number | undefined;
    if (navigator.geolocation) { try { const p = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 })); latitude = p.coords.latitude; longitude = p.coords.longitude; } catch {} }
    const r = await fetch("/api/offices", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ name: officeName, address: officeAddress, latitude, longitude }) });
    const j = await r.json(); setMessage(r.ok ? "Office created." : (j.error || "Could not create office.")); setBusy(false);
    if (r.ok) { setOfficeName(""); setOfficeAddress(""); setShowOfficeForm(false); await load(); }
  }

  async function addEmployee(e: FormEvent) {
    e.preventDefault(); if (!supabase || !selectedOffice) return; setBusy(true); setMessage("");
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/employees/invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ email: employeeEmail.trim().toLowerCase(), fullName: employeeName.trim(), employeeId: employeeId.trim() || undefined, officeId: selectedOffice.id }) });
    const j = await r.json(); setMessage(r.ok ? "Employee added and invitation sent." : (j.error || "Could not add employee.")); setBusy(false);
    if (r.ok) { setEmployeeName(""); setEmployeeEmail(""); setEmployeeId(""); setShowAdd(false); await loadOfficeData(selectedOffice.id); }
  }

  async function importCsv(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !selectedOffice || !supabase) return;
    setBusy(true); setMessage("");
    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean).map(row => row.split(",").map(v => v.trim().replace(/^"|"$/g, "")));
    if (rows.length < 2) { setMessage("CSV is empty."); setBusy(false); return; }
    const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, "_"));
    const idx = (names: string[]) => names.map(n => headers.indexOf(n)).find(i => i >= 0) ?? -1;
    const nameIdx = idx(["name", "full_name", "employee_name"]), emailIdx = idx(["email", "work_email"]), idIdx = idx(["employee_id", "id"]);
    if (nameIdx < 0 || emailIdx < 0) { setMessage("CSV needs at least Name and Email columns."); setBusy(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    let added = 0;
    for (const row of rows.slice(1)) {
      const name = row[nameIdx], email = row[emailIdx]; if (!name || !email) continue;
      const r = await fetch("/api/employees/invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ fullName: name, email: email.toLowerCase(), employeeId: idIdx >= 0 ? row[idIdx] : undefined, officeId: selectedOffice.id }) });
      if (r.ok) added++;
    }
    setMessage(`${added} employee${added === 1 ? "" : "s"} imported and invited.`); setBusy(false); await loadOfficeData(selectedOffice.id); e.target.value = "";
  }

  async function signOut() { await supabase?.auth.signOut(); window.location.href = "/"; }

  const today = useMemo(() => ({ present: attendance.filter(a => a.status === "present").length, late: attendance.filter(a => a.status === "late").length, leave: attendance.filter(a => a.status === "on_leave").length }), [attendance]);
  const filteredPeople = people.filter(p => `${p.full_name} ${p.employee_id ?? ""} ${p.department ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  if (!profile) return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6"><div className="rounded-2xl border border-black/10 bg-white px-6 py-5 text-sm text-[#666]">{message || "Loading your workspace…"}</div></main>;
  if (!['founder','admin'].includes(profile.role)) { window.location.href = "/employee"; return null; }

  return <main className="min-h-screen bg-[#f7f7f5] text-[#222]"><div className="mx-auto flex min-h-screen max-w-[1400px]">
    <aside className="hidden w-64 shrink-0 border-r border-black/10 bg-white px-5 py-7 md:block"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#173b32] text-sm font-bold text-white">L</div><span className="text-xl font-semibold tracking-tight">loggin</span></div><nav className="mt-10 space-y-1"><button onClick={() => setView("overview")} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${view === "overview" ? "bg-[#f2f2ef] font-semibold" : "text-[#777]"}`}>Overview</button><button onClick={() => setView("people")} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${view === "people" ? "bg-[#f2f2ef] font-semibold" : "text-[#777]"}`}>People</button><button onClick={() => setView("attendance")} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${view === "attendance" ? "bg-[#f2f2ef] font-semibold" : "text-[#777]"}`}>Attendance</button></nav><div className="mt-9"><div className="mb-2 flex items-center justify-between px-3"><p className="text-[11px] font-semibold uppercase tracking-widest text-[#aaa]">Offices</p><button onClick={() => setShowOfficeForm(true)} className="text-lg leading-none text-[#777]">+</button></div>{offices.map(o => <button key={o.id} onClick={() => { setSelectedOffice(o); setView("overview"); }} className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm ${selectedOffice?.id === o.id ? "bg-[#173b32] font-medium text-white" : "text-[#666] hover:bg-[#f5f5f2]"}`}>{o.name}</button>)}{!offices.length && <p className="px-3 text-xs leading-5 text-[#999]">Create your first office to get started.</p>}</div><button onClick={signOut} className="mt-10 px-3 text-sm text-[#888] hover:text-[#333]">Sign out</button></aside>
    <section className="min-w-0 flex-1 px-5 py-6 md:px-9 md:py-8"><header className="flex items-center justify-between"><div className="md:hidden flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#173b32] text-sm font-bold text-white">L</div><span className="text-xl font-semibold">loggin</span></div><div className="hidden md:block"><p className="text-sm text-[#888]">Founder workspace</p></div><div className="flex items-center gap-3"><span className="hidden text-sm text-[#666] sm:inline">{profile.full_name}</span><button onClick={signOut} className="text-sm text-[#777] md:hidden">Sign out</button></div></header>
      {!selectedOffice ? <section className="mx-auto mt-24 max-w-lg text-center"><p className="text-sm font-medium text-[#888]">Your workspace</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">Create your first office.</h1><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#777]">Once it’s created, you’ll manage people and attendance from that office.</p><button onClick={() => setShowOfficeForm(true)} className="mt-7 rounded-xl bg-[#173b32] px-5 py-3 text-sm font-semibold text-white">Add office</button></section> : <>
        <section className="mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm text-[#888]">Office</p><h1 className="mt-1 text-4xl font-semibold tracking-[-0.05em]">{selectedOffice.name}</h1><p className="mt-2 text-sm text-[#777]">{selectedOffice.address || "No address added"}</p></div><div className="flex gap-2"><button onClick={() => setShowAdd(true)} className="rounded-xl bg-[#173b32] px-4 py-2.5 text-sm font-semibold text-white">Add employee</button><label className={`cursor-pointer rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold ${busy ? "opacity-50" : ""}`}>Import CSV<input disabled={busy} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv}/></label></div></section>
        {message && <div className="mt-5 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#555]">{message}</div>}
        <nav className="mt-8 flex gap-6 border-b border-black/10"><button onClick={() => setView("overview")} className={`pb-3 text-sm ${view === "overview" ? "border-b-2 border-[#173b32] font-semibold" : "text-[#888]"}`}>Today</button><button onClick={() => setView("people")} className={`pb-3 text-sm ${view === "people" ? "border-b-2 border-[#173b32] font-semibold" : "text-[#888]"}`}>People <span className="text-xs text-[#aaa]">{people.length}</span></button><button onClick={() => setView("attendance")} className={`pb-3 text-sm ${view === "attendance" ? "border-b-2 border-[#173b32] font-semibold" : "text-[#888]"}`}>Attendance</button></nav>
        {view === "overview" && <section className="mt-7"><div className="grid gap-3 sm:grid-cols-4"><Stat label="People" value={people.length}/><Stat label="Present" value={today.present}/><Stat label="Late" value={today.late}/><Stat label="On leave" value={today.leave}/></div><div className="mt-6 rounded-2xl border border-black/10 bg-white"><div className="flex items-center justify-between border-b border-black/5 px-5 py-4"><div><p className="font-semibold">Today</p><p className="text-xs text-[#999]">{new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}</p></div><button onClick={() => setView("attendance")} className="text-sm font-medium text-[#173b32]">View attendance →</button></div><AttendanceRows people={people} attendance={attendance}/></div></section>}
        {view === "people" && <section className="mt-7"><div className="flex items-center justify-between gap-3"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people" className="w-full max-w-sm rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none"/><span className="text-sm text-[#888]">{filteredPeople.length} employees</span></div><div className="mt-4 overflow-hidden rounded-2xl border border-black/10 bg-white"><div className="hidden grid-cols-[2fr_1fr_1fr] gap-4 border-b border-black/5 px-5 py-3 text-xs uppercase tracking-wider text-[#aaa] sm:grid"><span>Employee</span><span>ID</span><span>Status</span></div>{filteredPeople.map(p => { const a = attendance.find(x => x.employee_id === p.id); return <div key={p.id} className="grid gap-1 border-b border-black/5 px-5 py-4 last:border-0 sm:grid-cols-[2fr_1fr_1fr] sm:items-center"><div><p className="font-medium">{p.full_name}</p><p className="text-xs text-[#999]">{p.department || p.designation || p.role}</p></div><span className="text-sm text-[#666]">{p.employee_id || "—"}</span><span className="text-sm">{a?.status === "on_leave" ? "On leave" : a?.check_in_at ? "Present" : "Not checked in"}</span></div>})}{!filteredPeople.length && <p className="p-10 text-center text-sm text-[#999]">No employees yet. Add someone or import a CSV.</p>}</div></section>}
        {view === "attendance" && <section className="mt-7"><div className="rounded-2xl border border-black/10 bg-white"><div className="border-b border-black/5 px-5 py-4"><p className="font-semibold">Today’s attendance</p><p className="text-xs text-[#999]">{attendance.length} records</p></div><AttendanceRows people={people} attendance={attendance} detailed/></div></section>}
      </>}
    </section></div>
    {showOfficeForm && <Modal title="Add office" close={() => setShowOfficeForm(false)}><form onSubmit={createOffice} className="space-y-4"><Field label="Office name"><input required value={officeName} onChange={e => setOfficeName(e.target.value)} placeholder="Hyderabad HQ" className="input"/></Field><Field label="Address"><input value={officeAddress} onChange={e => setOfficeAddress(e.target.value)} placeholder="Office address" className="input"/></Field><p className="text-xs leading-5 text-[#999]">We’ll use this device’s location to set the office location when available.</p><button disabled={busy} className="w-full rounded-xl bg-[#173b32] py-3 text-sm font-semibold text-white">{busy ? "Creating…" : "Create office"}</button></form></Modal>}
    {showAdd && <Modal title="Add employee" close={() => setShowAdd(false)}><form onSubmit={addEmployee} className="space-y-4"><Field label="Full name"><input required value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="Rahul Sharma" className="input"/></Field><Field label="Work email"><input required type="email" value={employeeEmail} onChange={e => setEmployeeEmail(e.target.value)} placeholder="rahul@company.com" className="input"/></Field><Field label="Employee ID"><input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="EMP-001" className="input"/></Field><p className="text-xs leading-5 text-[#999]">The employee will receive a secure invitation to activate Loggin.</p><button disabled={busy} className="w-full rounded-xl bg-[#173b32] py-3 text-sm font-semibold text-white">{busy ? "Adding…" : "Add employee"}</button></form></Modal>}
  </main>;
}
function Stat({label,value}:{label:string;value:number}) { return <div className="rounded-2xl border border-black/10 bg-white p-5"><p className="text-xs uppercase tracking-wider text-[#999]">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p></div>; }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="block text-sm font-medium">{label}<div className="mt-2">{children}</div></label>; }
function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}) { return <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-5"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2><button onClick={close} className="text-xl text-[#999]">×</button></div><div className="mt-6">{children}</div></div></div>; }
function AttendanceRows({people,attendance,detailed=false}:{people:Profile[];attendance:Attendance[];detailed?:boolean}) { if(!people.length) return <p className="p-8 text-center text-sm text-[#999]">No employees yet.</p>; return <div>{people.map(p=>{const a=attendance.find(x=>x.employee_id===p.id); return <div key={p.id} className="grid gap-1 border-b border-black/5 px-5 py-4 last:border-0 sm:grid-cols-[2fr_1fr_1fr] sm:items-center"><div><p className="font-medium">{p.full_name}</p><p className="text-xs text-[#999]">{p.employee_id || "No ID"}</p></div><span className="text-sm capitalize">{a?.status || "Not checked in"}</span><span className="text-sm text-[#666]">{a?.check_in_at ? `In ${time(a.check_in_at)}` : "—"}{detailed && a?.check_out_at ? ` · Out ${time(a.check_out_at)}` : ""}</span></div>})}</div>; }
