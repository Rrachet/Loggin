"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; company_id: string; office_id: string | null; full_name: string; employee_id: string | null; department: string | null; role: string; active: boolean };
type Office = { id: string; name: string; address: string | null; latitude: number | null; longitude: number | null; geofence_radius_m: number; geofence_enabled: boolean; };
type Attendance = { id: string; employee_id: string; check_in_at: string | null; check_out_at: string | null; status: string };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const clock = (value: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [office, setOffice] = useState<Office | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [tab, setTab] = useState<"today" | "people" | "attendance">("today");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showOffice, setShowOffice] = useState(false);
  const [showEmployee, setShowEmployee] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [officeName, setOfficeName] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [radius, setRadius] = useState(150);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  async function load() {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/"; return; }
    const { data: p, error: pError } = await supabase.from("profiles").select("id,company_id,office_id,full_name,employee_id,department,role,active").eq("id", session.user.id).maybeSingle();
    if (pError || !p) { setMessage(pError?.message || "We couldn't load your profile."); return; }
    setProfile(p);
    const { data: o, error: oError } = await supabase.from("offices").select("id,name,address,latitude,longitude,geofence_radius_m,geofence_enabled").eq("company_id", p.company_id).is("archived_at", null).order("name");
    if (oError) { setMessage(oError.message); return; }
    const list = o ?? [];
    setOffices(list);
    setOffice(current => list.find(item => item.id === current?.id) ?? list[0] ?? null);
  }

  async function loadOffice(id: string) {
    if (!supabase) return;
    const { data: p } = await supabase.from("profiles").select("id,company_id,office_id,full_name,employee_id,department,role,active").eq("office_id", id).order("full_name");
    setPeople(p ?? []);
    const { data: a } = await supabase.from("attendance").select("id,employee_id,check_in_at,check_out_at,status").eq("office_id", id).eq("work_date", today());
    setAttendance(a ?? []);
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (office) void loadOffice(office.id); }, [office?.id]);

  function getLocation() {
    if (!navigator.geolocation) { setMessage("Location is not available in this browser."); return; }
    setMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      position => { setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setMessage("Location ready."); },
      () => setMessage("Allow location access to set the office boundary."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }

  async function createOffice(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !location) { setMessage("Use your live location before creating the office."); return; }
    setBusy(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/offices", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ name: officeName.trim(), address: officeAddress.trim(), latitude: location.lat, longitude: location.lng, geofence_radius_m: radius }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(result.error || "Could not create office."); return; }
      setShowOffice(false); setOfficeName(""); setOfficeAddress(""); setLocation(null); setMessage("Office created."); await load();
    } finally { setBusy(false); }
  }

  async function addEmployee(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !office) return;
    setBusy(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/employees/invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ fullName: employeeName.trim(), email: employeeEmail.trim().toLowerCase(), employeeId: employeeId.trim() || undefined, officeId: office.id }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(result.error || "Could not add employee."); return; }
      setShowEmployee(false); setEmployeeName(""); setEmployeeEmail(""); setEmployeeId(""); setMessage("Employee added to this office."); await loadOffice(office.id);
    } finally { setBusy(false); }
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !office || !supabase) return;
    setBusy(true); setMessage("");
    try {
      const rows = (await file.text()).split(/\r?\n/).filter(Boolean).map(row => row.split(",").map(value => value.trim().replace(/^"|"$/g, "")));
      if (rows.length < 2) { setMessage("CSV is empty."); return; }
      const headers = rows[0].map(value => value.toLowerCase().replace(/\s+/g, "_"));
      const indexOf = (names: string[]) => names.map(name => headers.indexOf(name)).find(index => index >= 0) ?? -1;
      const nameIndex = indexOf(["name", "full_name", "employee_name"]);
      const emailIndex = indexOf(["email", "work_email"]);
      const idIndex = indexOf(["employee_id", "id"]);
      if (nameIndex < 0 || emailIndex < 0) { setMessage("CSV needs Name and Email columns."); return; }
      const { data: { session } } = await supabase.auth.getSession();
      let added = 0;
      for (const row of rows.slice(1)) {
        if (!row[nameIndex] || !row[emailIndex]) continue;
        const response = await fetch("/api/employees/invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ fullName: row[nameIndex], email: row[emailIndex].toLowerCase(), employeeId: idIndex >= 0 ? row[idIndex] : undefined, officeId: office.id }) });
        if (response.ok) added += 1;
      }
      setMessage(`${added} employee${added === 1 ? "" : "s"} added to ${office.name}.`); await loadOffice(office.id); event.target.value = "";
    } finally { setBusy(false); }
  }

  async function archiveOffice() {
    if (!supabase || !office) return;
    setBusy(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/offices", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ officeId: office.id }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(result.error || "Could not archive office."); return; }
      setConfirmArchive(false); setMessage(`${office.name} was archived. Its attendance history is preserved.`); await load();
    } finally { setBusy(false); }
  }

  const stats = useMemo(() => ({ present: attendance.filter(item => item.status === "present").length, late: attendance.filter(item => item.status === "late").length, leave: attendance.filter(item => item.status === "on_leave").length }), [attendance]);
  const filtered = people.filter(person => `${person.full_name} ${person.employee_id ?? ""} ${person.department ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  if (!profile) return <main className="grid min-h-screen place-items-center bg-[#f7f8f6]"><p className="text-sm text-[#777]">Loading Loggin…</p></main>;
  if (!["founder", "admin"].includes(profile.role)) { window.location.href = "/employee"; return null; }

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202522]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[250px] shrink-0 border-r border-black/[0.07] bg-white px-4 py-6 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2"><img src="/loggin-logo.svg" alt="Loggin" className="h-9 w-9"/><span className="text-[21px] font-semibold tracking-[-0.03em]">Loggin</span></div>
          <p className="mb-2 mt-9 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a0a6a1]">Workspace</p>
          <button onClick={() => setTab("today")} className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium ${tab === "today" ? "bg-[#edf3ef] text-[#173b32]" : "text-[#6f7671] hover:bg-[#f7f8f6]"}`}>Overview</button>
          <button disabled={!office} onClick={() => setTab("people")} className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium ${tab === "people" ? "bg-[#edf3ef] text-[#173b32]" : "text-[#6f7671] hover:bg-[#f7f8f6] disabled:opacity-40"}`}>People</button>
          <button disabled={!office} onClick={() => setTab("attendance")} className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium ${tab === "attendance" ? "bg-[#edf3ef] text-[#173b32]" : "text-[#6f7671] hover:bg-[#f7f8f6] disabled:opacity-40"}`}>Attendance</button>
          <div className="mt-8"><div className="flex items-center justify-between px-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a0a6a1]">Offices</p><button onClick={() => setShowOffice(true)} className="grid h-7 w-7 place-items-center rounded-lg text-lg text-[#68706b] hover:bg-[#f2f4f2]">+</button></div><div className="mt-2 space-y-1">{offices.map(item => <button key={item.id} onClick={() => { setOffice(item); setTab("today"); }} className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm ${office?.id === item.id ? "bg-[#173b32] font-medium text-white" : "text-[#68706b] hover:bg-[#f7f8f6]"}`}><span className={`mr-2 h-1.5 w-1.5 rounded-full ${office?.id === item.id ? "bg-white" : "bg-[#a9b0aa]"}`}/>{item.name}</button>)}</div>{!offices.length && <p className="mt-3 px-3 text-xs leading-5 text-[#9a9f9b]">Create an office to start managing people.</p>}</div>
          <div className="mt-auto border-t border-black/[0.07] pt-4"><div className="px-3"><p className="text-sm font-medium">{profile.full_name}</p><p className="mt-1 text-xs text-[#969d98]">Founder</p></div><button onClick={async () => { await supabase?.auth.signOut(); window.location.href = "/"; }} className="mt-4 w-full rounded-xl px-3 py-2 text-left text-sm text-[#777] hover:bg-[#f7f8f6]">Sign out</button></div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-[#f7f8f6]/90 px-5 py-4 backdrop-blur md:px-8"><div className="mx-auto flex max-w-[1200px] items-center justify-between"><div className="flex items-center gap-3 lg:hidden"><img src="/loggin-logo.svg" alt="Loggin" className="h-8 w-8"/><span className="font-semibold">Loggin</span></div><div className="hidden lg:block"><p className="text-xs text-[#8b928d]">Founder workspace</p></div><div className="flex items-center gap-2"><select value={office?.id ?? ""} onChange={e => { const next = offices.find(item => item.id === e.target.value); if (next) { setOffice(next); setTab("today"); } }} className="max-w-[180px] rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm font-medium outline-none lg:hidden"><option value="">All offices</option>{offices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="hidden rounded-full bg-white px-3 py-2 text-xs text-[#737a75] shadow-sm ring-1 ring-black/[0.05] md:inline">{profile.full_name}</span></div></div></header>

          <div className="mx-auto max-w-[1200px] px-5 py-7 md:px-8 md:py-9">
            {!office ? (
              <section className="mx-auto max-w-xl py-20 text-center"><img src="/loggin-logo.svg" alt="" className="mx-auto h-16 w-16 rounded-2xl"/><p className="mt-7 text-sm font-medium text-[#7f8782]">Your workspace is ready.</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em] md:text-5xl">Create your first office.</h1><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#737a75]">Your office is the home for its people, attendance and location rules.</p><button onClick={() => setShowOffice(true)} className="mt-7 rounded-xl bg-[#173b32] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#12483a]">Add office</button></section>
            ) : (
              <>
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9aa19c]">Office</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em]">{office.name}</h1><p className="mt-2 text-sm text-[#747b76]">{office.address || "No address added"}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setShowEmployee(true)} className="rounded-xl bg-[#173b32] px-4 py-2.5 text-sm font-semibold text-white shadow-sm">Add employee</button><label className="cursor-pointer rounded-xl border border-black/[0.09] bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-[#fbfcfb]">Import CSV<input disabled={busy} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv}/></label><button onClick={() => setConfirmArchive(true)} className="rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50">Archive</button></div></div>
                {message && <div className="mt-5 rounded-xl border border-black/[0.07] bg-white px-4 py-3 text-sm text-[#626964] shadow-sm">{message}</div>}
                <div className="mt-8 grid gap-3 sm:grid-cols-4"><Metric label="People" value={people.length}/><Metric label="Present" value={stats.present}/><Metric label="Late" value={stats.late}/><Metric label="On leave" value={stats.leave}/></div>
                <nav className="mt-8 flex gap-6 border-b border-black/[0.08]"><Tab active={tab === "today"} onClick={() => setTab("today")}>Today</Tab><Tab active={tab === "people"} onClick={() => setTab("people")}>People <span className="ml-1 text-[#a0a6a1]">{people.length}</span></Tab><Tab active={tab === "attendance"} onClick={() => setTab("attendance")}>Attendance</Tab></nav>
                {tab === "today" && <TodayView office={office} people={people} attendance={attendance} stats={stats}/>} 
                {tab === "people" && <PeopleView people={filtered} search={search} setSearch={setSearch}/>} 
                {tab === "attendance" && <AttendanceView people={people} attendance={attendance}/>} 
              </>
            )}
          </div>
        </section>
      </div>

      {showOffice && <Modal title="Add office" subtitle="Set the office location while you are there." close={() => setShowOffice(false)}><form onSubmit={createOffice} className="space-y-3"><input required value={officeName} onChange={e => setOfficeName(e.target.value)} placeholder="Office name" className="field"/><input value={officeAddress} onChange={e => setOfficeAddress(e.target.value)} placeholder="Address" className="field"/><div className="rounded-xl border border-black/[0.08] p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium">Office location</p><p className="mt-1 text-xs text-[#8a918c]">{location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "Location required"}</p></div><button type="button" onClick={getLocation} className="rounded-lg bg-[#edf3ef] px-3 py-2 text-xs font-semibold text-[#173b32]">Use my location</button></div></div><label className="block text-sm font-medium">Geofence radius<select value={radius} onChange={e => setRadius(Number(e.target.value))} className="field mt-2"><option value={100}>100 metres</option><option value={150}>150 metres</option><option value={250}>250 metres</option><option value={500}>500 metres</option></select></label><button disabled={busy || !location} className="primary mt-2 disabled:opacity-40">{busy ? "Creating…" : "Create office"}</button></form></Modal>}
      {showEmployee && office && <Modal title="Add employee" subtitle={`They will be added to ${office.name}.`} close={() => setShowEmployee(false)}><form onSubmit={addEmployee} className="space-y-3"><input required value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="Full name" className="field"/><input required type="email" value={employeeEmail} onChange={e => setEmployeeEmail(e.target.value)} placeholder="Work email" className="field"/><input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="Employee ID (optional)" className="field"/><button disabled={busy} className="primary disabled:opacity-40">{busy ? "Adding…" : "Add employee"}</button></form></Modal>}
      {confirmArchive && office && <Modal title={`Archive ${office.name}?`} subtitle="The office will disappear from your workspace. Its attendance history is preserved." close={() => setConfirmArchive(false)}><div className="flex gap-2"><button onClick={() => setConfirmArchive(false)} className="secondary flex-1">Cancel</button><button disabled={busy} onClick={archiveOffice} className="flex-1 rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Archiving…" : "Archive office"}</button></div></Modal>}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"><p className="text-xs font-medium text-[#969d98]">{label}</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{value}</p></div>; }
function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={`border-b-2 px-0 pb-3 text-sm font-medium ${active ? "border-[#173b32] text-[#173b32]" : "border-transparent text-[#858c87]"}`}>{children}</button>; }
function TodayView({ office, people, attendance, stats }: { office: Office; people: Profile[]; attendance: Attendance[]; stats: { present: number; late: number; leave: number } }) { return <section className="mt-6"><div className="grid gap-4 lg:grid-cols-[1fr_320px]"><div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white"><div className="border-b border-black/[0.06] px-5 py-4"><p className="font-semibold">Today</p><p className="mt-1 text-xs text-[#979e99]">Live attendance for {office.name}</p></div><AttendanceRows people={people} attendance={attendance}/></div><div className="rounded-2xl border border-black/[0.07] bg-[#173b32] p-5 text-white"><p className="text-xs font-medium text-white/55">Office boundary</p><p className="mt-2 text-xl font-semibold">{office.geofence_radius_m}m radius</p><p className="mt-2 text-sm leading-6 text-white/65">{office.geofence_enabled ? "Location is required when employees check in." : "Location checks are currently off."}</p><div className="mt-7 flex items-center gap-2 text-xs text-white/60"><span className="h-2 w-2 rounded-full bg-white"/> {office.geofence_enabled ? "Active" : "Inactive"}</div></div></div></section>; }
function PeopleView({ people, search, setSearch }: { people: Profile[]; search: string; setSearch: (value: string) => void }) { return <section className="mt-6"><div className="flex items-center justify-between gap-3"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people" className="field max-w-sm"/><span className="text-xs text-[#929993]">{people.length} shown</span></div><div className="mt-4 overflow-hidden rounded-2xl border border-black/[0.07] bg-white">{people.map(person => <div key={person.id} className="flex items-center justify-between border-b border-black/[0.05] px-5 py-4 last:border-0"><div><p className="text-sm font-medium">{person.full_name}</p><p className="mt-1 text-xs text-[#929993]">{person.employee_id || "No employee ID"}{person.department ? ` · ${person.department}` : ""}</p></div><span className="rounded-full bg-[#edf3ef] px-2.5 py-1 text-[11px] font-medium text-[#376052]">{person.active ? "Active" : "Inactive"}</span></div>)}{!people.length && <p className="px-5 py-10 text-center text-sm text-[#929993]">No employees in this office yet.</p>}</div></section>; }
function AttendanceView({ people, attendance }: { people: Profile[]; attendance: Attendance[] }) { return <section className="mt-6 overflow-hidden rounded-2xl border border-black/[0.07] bg-white"><AttendanceRows people={people} attendance={attendance}/></section>; }
function AttendanceRows({ people, attendance }: { people: Profile[]; attendance: Attendance[] }) { return <div className="divide-y divide-black/[0.05]">{people.map(person => { const item = attendance.find(row => row.employee_id === person.id); return <div key={person.id} className="flex items-center justify-between px-5 py-4"><div><p className="text-sm font-medium">{person.full_name}</p><p className="mt-1 text-xs text-[#929993]">{person.employee_id || "No employee ID"}</p></div><div className="text-right"><p className="text-sm font-medium capitalize">{item?.status || "Absent"}</p><p className="mt-1 text-xs text-[#929993]">{item?.check_in_at ? clock(item.check_in_at) : "—"}{item?.check_out_at ? ` → ${clock(item.check_out_at)}` : ""}</p></div></div>; })}{!people.length && <p className="px-5 py-10 text-center text-sm text-[#929993]">No employees in this office yet.</p>}</div>; }
function Modal({ title, subtitle, close, children }: { title: string; subtitle: string; close: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-5"><div className="w-full max-w-md rounded-3xl border border-black/[0.08] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold tracking-[-0.03em]">{title}</h2><p className="mt-1 text-sm leading-5 text-[#7c837e]">{subtitle}</p></div><button onClick={close} className="grid h-8 w-8 place-items-center rounded-lg text-xl text-[#858c87] hover:bg-[#f5f6f5]">×</button></div><div className="mt-6">{children}</div></div></div>; }
