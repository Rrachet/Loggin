"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Payload = { officeId:string; date:string; token:string };

declare global { interface Window { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect(source: CanvasImageSource): Promise<{rawValue?:string}[]> } } }

export default function CheckinPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [camera, setCamera] = useState(false);
  const [message, setMessage] = useState("Point your camera at the office QR code.");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  async function startCamera() {
    setMessage("");
    if (!navigator.mediaDevices?.getUserMedia) { setMessage("Camera access is not available in this browser. Paste the QR data below instead."); return; }
    if (!window.BarcodeDetector) { setMessage("This browser does not expose QR scanning. Use Chrome on Android or paste the QR data below."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamera(true);
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          if (videoRef.current.readyState >= 2) {
            const codes = await detector.detect(videoRef.current);
            const raw = codes[0]?.rawValue;
            if (raw) { parsePayload(raw); return; }
          }
        } catch {}
        requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not open the camera."); }
  }

  function parsePayload(raw: string) {
    try {
      const parsed = JSON.parse(raw) as Payload;
      if (!parsed.officeId || !parsed.date || !parsed.token) throw new Error();
      setPayload(parsed); setMessage("QR recognised. Now checking your location…"); streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setCamera(false); checkIn(parsed);
    } catch { setMessage("That does not look like a Loggin office QR code."); }
  }

  async function checkIn(code = payload) {
    const client = supabase;
    if (!code || !client) { setMessage("Supabase is not configured. Check your local environment."); return; }
    if (!navigator.geolocation) { setMessage("Location services are required for secure check-in."); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async position => {
      const { data: { session } } = await client.auth.getSession();
      if (!session) { setBusy(false); window.location.href = "/"; return; }
      const response = await fetch("/api/attendance/checkin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ ...code, latitude: position.coords.latitude, longitude: position.coords.longitude }) });
      const json = await response.json();
      if (!response.ok) setMessage(json.error || "Check-in failed"); else { setDone(true); setMessage("You’re checked in. Have a good day."); }
      setBusy(false);
    }, error => { setMessage(error.message || "Location permission is required."); setBusy(false); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  async function checkout() {
    const client = supabase;
    if (!client || !navigator.geolocation) return;
    setBusy(true); setMessage("Checking your location…");
    navigator.geolocation.getCurrentPosition(async position => {
      const { data: { session } } = await client.auth.getSession();
      const response = await fetch("/api/attendance/checkout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }) });
      const json = await response.json();
      setMessage(response.ok ? "You’re checked out. Day complete." : (json.error || "Check-out failed")); setBusy(false);
    }, error => { setMessage(error.message || "Location permission is required."); setBusy(false); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  return <main className="min-h-screen bg-[#f7f7f5] p-6"><div className="mx-auto max-w-xl"><div className="flex items-center justify-between"><a href="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#173b32] text-sm font-bold text-white">L</span><span className="text-xl font-semibold">loggin</span></a><a href="/" className="text-sm text-[#6b6b6b]">Dashboard</a></div><div className="mt-14 rounded-3xl border border-black/10 bg-white p-7"><p className="text-sm font-medium text-[#6b6b6b]">Secure attendance</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">Scan. Verify. You’re in.</h1><p className="mt-4 text-sm leading-6 text-[#6b6b6b]">Loggin checks the office QR and your live location before recording attendance.</p><div className="mt-8 overflow-hidden rounded-2xl bg-black">{camera?<video ref={videoRef} autoPlay playsInline muted className="aspect-square w-full object-cover"/>:<div className="grid aspect-square place-items-center bg-[#173b32] text-white"><div className="text-center"><div className="mx-auto grid h-24 w-24 place-items-center rounded-3xl border border-white/20 text-3xl">QR</div><p className="mt-5 text-sm text-white/70">Camera is ready when you are.</p></div></div>}</div><button onClick={startCamera} disabled={busy||camera||done} className="mt-5 w-full rounded-xl bg-[#173b32] py-3.5 text-sm font-semibold text-white disabled:opacity-50">{camera?"Scanning…":done?"Checked in":"Open camera & scan"}</button>{done&&<button onClick={checkout} disabled={busy} className="mt-3 w-full rounded-xl border border-black/10 py-3.5 text-sm font-semibold disabled:opacity-50">{busy?"Checking…":"Check out"}</button>}<details className="mt-6"><summary className="cursor-pointer text-sm font-medium">Can’t scan? Paste QR data</summary><textarea onChange={e=>{try{setPayload(JSON.parse(e.target.value));setMessage("QR data loaded. Tap check-in below.")}catch{}}} placeholder='{"officeId":"…","date":"…","token":"…"}' className="mt-3 h-28 w-full rounded-xl border border-black/10 p-3 font-mono text-xs"/><button onClick={()=>checkIn()} disabled={!payload||busy||done} className="mt-3 w-full rounded-xl border border-black/10 py-3 text-sm font-semibold">Check in with QR data</button></details>{message&&<p className="mt-5 rounded-xl bg-[#f5f3ed] p-4 text-sm text-[#5d5a4f]">{message}</p>}</div></div></main>;
}
