"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; company_id: string; office_id: string | null; full_name: string; employee_id: string | null; department: string | null; designation: string | null; role: string; active: boolean };
type Office = { id: string; name: string; address: string | null; latitude: number | null; longitude: number | null; geofence_radius_m: number; geofence_enabled: boolean; work_start: string; work_end: string; grace_minutes: number };
type Attendance = { id: string; employee_id: string; work_date: string; check_in_at: string | null; check_out_at: string | null; total_working_minutes: number | null; status: string };

const todayIndia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const time = (value: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [office, setOffice] = useState<Office | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [view, setView] = useState<"today" | "people" | "attendance">("today");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showOffice, setShowOffice] = useState(false);
  const [showEmployee, setShowEmployee] = useState(false);
  const [officeName, setOfficeName] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [radius, setRadius] = useState(150);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [tracking, setTracking] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    if (!supabase) { setMessage("Supabase is not configured."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/"; return; }
    const { data: p, error: profileError } = await supabase.from("profiles").select("id,company_id,office_id,full_name,employee_id,department,designation,role,active").eq("id", session.user.id).maybeSingle();
    if (profileError || !p) { setMessage(profileError?.message || "We couldn't load your Loggin profile."); return; }
    setProfile(p);
    const { data: o, error: officeError } = await supabase.from("offices").select("id,name,address,latitude,longitude,geofence_radius_m,geofence_enabled,work_start,work_end,grace_minutes").eq("company_id", p.company_id).order("name");
    if (officeError) { setMessage(officeError.message); return; }
    const list = o ?? [];
    setOffices(list);
    setOffice(prev => list.find(x => x.id === prev?.id) ?? list[0] ?? null);
  }

  async function loadOffice(id: string) {
    if (!supabase) return;
    const { data: p } = await supabase.from("profiles").select("id,company_id,office_id,full_name,employee_id,department,designation,role,active").eq("office_id", id).order("full_name");
    setPeople(p ?? []);
    const { data: a } = await supabase.from("attendance").select("id,employee_id,work_date,check_in_at,check_out_at,total_working_minutes,status").eq("office_id", id).eq("work_date", todayIndia());
    setAttendance(a ?? []);
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (office) { setRadius(office.geofence_radius_m || 150); void loadOffice(office.id); } }, [office?.id]);

  function getLiveLocation() {
    if (!navigator.geolocation) { setMessage("This browser does not support location services."); return; }
    setTracking(true); setMessage("");
    const watch = navigator.geolocation.watchPosition(
      p => { setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }); setTracking(false); navigator.geolocation.clearWatch(watch); },
      () => { setTracking(false); setMessage("Allow location access to set the office location."); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }

  async function createOffice(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !location) { setMessage("Use your live location before creating the office."); return; }
    setBusy(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/offices", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ name: officeName.trim(), address: officeAddress.trim(), latitude: location.lat, longitude: location.lng, geofenceRadiusM: radius, geofenceEnabled: true }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(result.error || "Could not create office."); return; }
      setOfficeName(""); setOfficeAddress(""); setLocation(null); setShowOffice(false); setMessage("Office created."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create office."); }
    finally { setBusy(false); }
  }

  async function addEmployee(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !office) return;
    setBusy(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/employees/invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ fullName: employeeName.trim(), email: employeeEmail.trim().toLowerCase(), employeeId: employeeId.trim() || undefined, officeId: office.id }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(result.error || "Could not add employee."); return; }
      setMessage("Employee added and invitation sent."); setEmployeeName(""); setEmployeeEmail(""); setEmployeeId(""); setShowEmployee(false); await loadOffice(office.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add employee."); }
    finally { setBusy(false); }
  }

  async function importCsv(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !office || !supabase) return;
    setBusy(true); setMessage("");
    try {
      const text = await file.text();
      const rows = text.split(/\r?\n/).filter(Boolean).map(row => row.split(",").map(value => value.trim().replace(/^"|"$/g, "")));
      if (rows.length < 2) { setMessage("CSV is empty."); return; }
      const headers = rows[0].map(value => value.toLowerCase().replace(/\s+/g, "_"));
      const find = (names: string[]) => names.map(name => headers.indexOf(name)).find(index => index >= 0) ?? -1;
      const nameIndex = find(["name", "full_name", "employee_name"]);
      const emailIndex = find(["email", "work_email"]);
      const idIndex = find(["employee_id", "id"]);
      if (nameIndex < 0 || emailIndex < 0) { setMessage("CSV needs Name and Email columns."); return; }
      const { data: { session } } = await supabase.auth.getSession();
      let added = 0;
      for (const row of rows.slice(1)) {
        if (!row[nameIndex] || !row[emailIndex]) continue;
        const response = await fetch("/api/employees/invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ fullName: row[nameIndex], email: row[emailIndex].toLowerCase(), employeeId: idIndex >= 0 ? row[idIndex] : undefined, officeId: office.id }) });
        if (response.ok) added++;
      }
      setMessage(`${added} employee${added === 1 ? "" : "s"} imported and invited.`);
      await loadOffice(office.id);
      e.target.value = "";
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import CSV."); }
    finally { setBusy(false); }
  }

  async function signOut() { await supabase?.auth.signOut(); window.location.href = "/"; }
  const stats = useMemo(() => ({ present: attendance.filter(a => a.status === "present").length, late: attendance.filter(a => a.status === "late").length, leave: attendance.filter(a => a.status === "on_leave").length }), [attendance]);
  const filteredPeople = people.filter(p => `${p.full_name} ${p.employee_id ?? ""} ${p.department ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  if (!profile) return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6"><div className="rounded-2xl border border-black/10 bg-white px-6 py-5 text-sm text-[#666]">{message || "Loading your workspace…"}</div></main>;
  if (!["founder", "admin"].includes(profile.role)) { window.location.href = "/employee"; return null; }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#222]">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="hidden w-64 shrink-0 border-r border-black/10 bg-white px-5 py-7 md:block">
          <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#173b32] text-sm font-bold text-white">L</div><span className="text-xl font-semibold">loggin</span></div>
          <nav className="mt-10 space-y-1">
            <button onClick={() => setView("today")} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${view === "today" ? "bg-[#f2f2ef] font-semibold" : "text-[#777]"}`}>Overview</button>
            <button disabled={!office} onClick={() => setView("people")} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${view === "people" ? "bg-[#f2f2ef] font-semibold" : "text-[#777]"}`}>People</button>
            <button disabled={!office} onClick={() => setView("attendance")} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${view === "attendance" ? "bg-[#f2f2ef] font-semibold" : "text-[#777]"}`}>Attendance</button>
          </nav>
          <div className="mt-9">
            <div className="mb-2 flex items-center justify-between px-3"><p className="text-[11px] font-semibold uppercase tracking-widest text-[#aaa]">Offices</p><button onClick={() => setShowOffice(true)} className="text-lg text-[#777]">+</button></div>
            {offices.map(item => <button key={item.id} onClick={() => { setOffice(item); setView("today"); }} className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm ${office?.id === item.id ? "bg-[#173b32] text-white" : "text-[#666] hover:bg-[#f5f5f2]"}`}>{item.name}</button>)}
            {!offices.length && <p className="px-3 text-xs leading-5 text-[#999]">Create your first office to get started.</p>}
          </div>
          <button onClick={signOut} className="mt-10 px-3 text-sm text-[#888]">Sign out</button>
        </aside>
        <section className="min-w-0 flex-1 px-5 py-6 md:px-9 md:py-8">
          <header className="flex items-center justify-between"><p className="text-sm text-[#888]">Founder workspace</p><span className="text-sm text-[#666]">{profile.full_name}</span></header>
          {!office ? (
            <section className="mx-auto mt-24 max-w-lg text-center"><h1 className="text-4xl font-semibold tracking-[-0.05em]">Create your first office.</h1><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#777]">Once created, this office is where you manage its people and attendance.</p><button onClick={() => setShowOffice(true)} className="mt-7 rounded-xl bg-[#173b32] px-5 py-3 text-sm font-semibold text-white">Add office</button></section>
          ) : (
            <>
              <section className="mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm text-[#888]">Office</p><h1 className="mt-1 text-4xl font-semibold tracking-[-0.05em]">{office.name}</h1><p className="mt-2 text-sm text-[#777]">{office.address || "No address added"}</p></div><div className="flex gap-2"><button onClick={() => setShowEmployee(true)} className="rounded-xl bg-[#173b32] px-4 py-2.5 text-sm font-semibold text-white">Add employee</button><label className="cursor-pointer rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold">Import CSV<input disabled={busy} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv}/></label></div></section>
              {message && <div className="mt-5 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#555]">{message}</div>}
              <nav className="mt-8 flex gap-6 border-b border-black/10"><button onClick={() => setView("today")} className={`pb-3 text-sm ${view === "today" ? "border-b-2 border-[#173b32] font-semibold" : "text-[#888]"}`}>Today</button><button onClick={() => setView("people")} className={`pb-3 text-sm ${view === "people" ? "border-b-2 border-[#173b32] font-semibold" : "text-[#888]"}`}>People <span className="text-xs text-[#aaa]">{people.length}</span></button><button onClick={() => setView("attendance")} className={`pb-3 text-sm ${view === "attendance" ? "border-b-2 border-[#173b32] font-semibold" : "text-[#888]"}`}>Attendance</button></nav>
              {view === "today" && <section className="mt-7"><div className="grid gap-3 sm:grid-cols-4"><Stat label="People" value={people.length}/><Stat label="Present" value={stats.present}/><Stat label="Late" value={stats.late}/><Stat label="On leave" value={stats.leave}/></div><div className="mt-6 rounded-2xl border border-black/10 bg-white p-5"><p className="font-semibold">Office location</p><p className="mt-1 text-sm text-[#777]">{office.geofence_enabled ? `Live location check · ${office.geofence_radius_m}m radius` : "Location check off"}</p><button onClick={getLiveLocation} className="mt-4 rounded-xl border border-black/10 px-4 py-2 text-sm font-medium">{tracking ? "Finding location…" : "Check current location"}</button>{location && <p className="mt-2 text-xs text-[#777]">Location: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>}</div><div className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white"><div className="border-b border-black/5 px-5 py-4"><p className="font-semibold">Today</p></div><AttendanceRows people={people} attendance={attendance}/></div></section>}
              {view === "people" && <section className="mt-7"><div className="flex items-center justify-between gap-3"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people" className="w-full max-w-sm rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm"/><span className="text-sm text-[#888]">{filteredPeople.length} employees</span></div><div className="mt-4 rounded-2xl border border-black/10 bg-white p-5">{filteredPeople.map(person => <div key={person.id} className="flex items-center justify-between border-b border-black/5 py-4"><div><p className="font-medium">{person.full_name}</p><p className="mt-1 text-xs text-[#888]">{person.employee_id || "No ID"}{person.department ? ` · ${person.department}` : ""}</p></div><span className="text-xs text-[#666]">{person.active ? "Active" : "Inactive"}</span></div>)}{!filteredPeople.length && <p className="py-8 text-center text-sm text-[#888]">No employees in this office yet.</p>}</div></section>}
              {view === "attendance" && <section className="mt-7"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Present" value={stats.present}/><Stat label="Late" value={stats.late}/><Stat label="On leave" value={stats.leave}/></div><div className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white"><AttendanceRows people={people} attendance={attendance}/></div></section>}
            </>
          )}
        </section>
      </div>
      {showOffice && <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-5"><form onSubmit={createOffice} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold">Add office</h2><p className="mt-1 text-sm text-[#777]">Use your live location while you are at the office.</p></div><button type="button" onClick={() => setShowOffice(false)} className="text-[#888]">×</button></div><div className="mt-6 space-y-3"><input required value={officeName} onChange={e => setOfficeName(e.target.value)} placeholder="Office name" className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm"/><input value={officeAddress} onChange={e => setOfficeAddress(e.target.value)} placeholder="Address" className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm"/><div className="rounded-xl border border-black/10 p-4"><div className="flex items-center justify-between"><span className="text-sm font-medium">Office location</span><button type="button" onClick={getLiveLocation} className="rounded-lg bg-[#173b32] px-3 py-2 text-xs font-semibold text-white">{tracking ? "Finding…" : "Use my live location"}</button></div><p className="mt-2 text-xs text-[#888]">{location ? `Located at ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "Location required"}</p></div><label className="block text-sm font-medium">Geofence radius<select value={radius} onChange={e => setRadius(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm"><option value={100}>100 m</option><option value={150}>150 m</option><option value={250}>250 m</option><option value={500}>500 m</option></select></label><button disabled={busy || !location} className="w-full rounded-xl bg-[#173b32] py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Creating…" : "Create office"}</button></div></form></div>}
      {showEmployee && office && <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-5"><form onSubmit={addEmployee} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold">Add employee</h2><p className="mt-1 text-sm text-[#777]">{office.name}</p></div><button type="button" onClick={() => setShowEmployee(false)} className="text-[#888]">×</button></div><div className="mt-6 space-y-3"><input required value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm"/><input required type="email" value={employeeEmail} onChange={e => setEmployeeEmail(e.target.value)} placeholder="Work email" className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm"/><input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="Employee ID (optional)" className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm"/><button disabled={busy} className="w-full rounded-xl bg-[#173b32] py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Adding…" : "Add employee"}</button></div></form></div>}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-black/10 bg-white p-5"><p className="text-xs uppercase tracking-wider text-[#999]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>; }
function AttendanceRows({ people, attendance }: { people: Profile[]; attendance: Attendance[] }) { return <div className="divide-y divide-black/5">{people.map(person => { const a = attendance.find(item => item.employee_id === person.id); return <div key={person.id} className="flex items-center justify-between px-5 py-4"><div><p className="font-medium">{person.full_name}</p><p className="mt-1 text-xs text-[#888]">{person.employee_id || "No ID"}</p></div><div className="text-right"><p className="text-sm font-medium capitalize">{a?.status || "Absent"}</p><p className="mt-1 text-xs text-[#888]">{a?.check_in_at ? time(a.check_in_at) : "—"}{a?.check_out_at ? ` → ${time(a.check_out_at)}` : ""}</p></div></div>; })}{!people.length && <p className="px-5 py-8 text-center text-sm text-[#888]">No employees in this office yet.</p>}</div>; }