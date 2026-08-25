"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";

export default function OfficeQrPage() {
  const [offices, setOffices] = useState<{id:string;name:string;latitude:number|null;longitude:number|null;geofence_radius_m:number}[]>([]);
  const [selected, setSelected] = useState("");
  const [payload, setPayload] = useState("");
  const [office, setOffice] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadOffices() {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/"; return; }
    const { data: profile } = await supabase.from("profiles").select("company_id,role").eq("id", session.user.id).single();
    if (!profile || !["founder", "admin"].includes(profile.role)) { window.location.href = "/"; return; }
    const { data } = await supabase.from("offices").select("id,name,latitude,longitude,geofence_radius_m").eq("company_id", profile.company_id).order("name");
    setOffices(data ?? []);
    if (data?.[0]) setSelected(data[0].id);
  }

  useEffect(() => { loadOffices(); }, []);

  async function loadQr() {
    if (!supabase || !selected) return;
    setBusy(true); setMessage("");
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/office-qr?officeId=${encodeURIComponent(selected)}`, { headers: { Authorization: `Bearer ${session?.access_token ?? ""}` } });
    const json = await response.json();
    if (!response.ok) setMessage(json.error || "Could not create QR");
    else { setPayload(json.payload); setOffice(json.office); }
    setBusy(false);
  }

  async function setLocation() {
    if (!supabase || !selected) return;
    if (!navigator.geolocation) { setMessage("This browser does not support location services."); return; }
    setBusy(true); setMessage("Getting the current office location…");
    navigator.geolocation.getCurrentPosition(async position => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/office-location", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ officeId: selected, latitude: position.coords.latitude, longitude: position.coords.longitude }) });
      const json = await response.json();
      if (!response.ok) setMessage(json.error || "Could not save location");
      else { setMessage(`Office location saved. Geofence is ${offices.find(o => o.id === selected)?.geofence_radius_m ?? 150}m.`); await loadOffices(); }
      setBusy(false);
    }, error => { setMessage(error.message || "Location permission was denied."); setBusy(false); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  const selectedOffice = offices.find(o => o.id === selected);
  return <main className="min-h-screen bg-[#f7f7f5] p-6"><div className="mx-auto max-w-5xl"><div className="flex items-center justify-between"><a href="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#173b32] text-sm font-bold text-white">L</span><span className="text-xl font-semibold">loggin</span></a><a href="/" className="text-sm text-[#6b6b6b]">Back to dashboard</a></div><div className="mt-12 grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-3xl border border-black/10 bg-white p-7"><p className="text-sm font-medium text-[#6b6b6b]">Office security</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">Display today’s QR.</h1><p className="mt-4 text-sm leading-6 text-[#6b6b6b]">Employees scan this code and must also be physically inside the office geofence. The QR token changes every day.</p><label className="mt-8 block text-sm font-medium">Office<select value={selected} onChange={e=>{setSelected(e.target.value);setPayload("");setOffice(null)}} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-3">{offices.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><div className="mt-4 rounded-2xl bg-[#f7f7f5] p-4 text-sm"><p><b>Geofence:</b> {selectedOffice?.latitude == null ? "Not set" : "Active"}</p><p className="mt-1 text-[#6b6b6b]">Radius: {selectedOffice?.geofence_radius_m ?? 150}m</p></div><div className="mt-5 grid gap-3"><button onClick={setLocation} disabled={busy||!selected} className="rounded-xl border border-black/10 px-4 py-3 text-sm font-semibold">Set office location from this device</button><button onClick={loadQr} disabled={busy||!selected} className="rounded-xl bg-[#173b32] px-4 py-3 text-sm font-semibold text-white">{busy?"Working…":"Generate today’s QR"}</button></div>{message&&<p className="mt-4 rounded-xl bg-[#f5f3ed] p-3 text-sm text-[#5d5a4f]">{message}</p>}</section><section className="grid min-h-[560px] place-items-center rounded-3xl border border-black/10 bg-white p-8"><div className="text-center">{payload?<><div className="mx-auto inline-block rounded-3xl border border-black/5 bg-white p-6 shadow-sm"><QRCodeSVG value={payload} size={360} level="H" includeMargin /></div><h2 className="mt-7 text-2xl font-semibold">{office?.name}</h2><p className="mt-2 text-sm text-[#6b6b6b]">Scan with Loggin Check-in · Valid today only</p></>:<><div className="mx-auto grid h-32 w-32 place-items-center rounded-3xl bg-[#f7f7f5] text-5xl">QR</div><h2 className="mt-7 text-2xl font-semibold">Ready when you are.</h2><p className="mt-2 text-sm text-[#6b6b6b]">Generate a QR code for the selected office.</p></>}</div></section></div></div></main>;
}
