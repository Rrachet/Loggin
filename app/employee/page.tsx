"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase, supabaseConfigError } from "@/lib/supabase";

type Profile = { id:string; full_name:string; employee_id:string|null; office_id:string|null; role:string; active:boolean };
type Attendance = { work_date:string; check_in_at:string|null; check_out_at:string|null; total_working_minutes:number|null; status:string };

const dateInIndia = () => new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Kolkata", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
const time = (v:string|null) => v ? new Date(v).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}) : "—";
const duration = (v:number|null) => v == null ? "—" : `${Math.floor(v/60)}h ${v%60}m`;

export default function EmployeePage(){
  const [profile,setProfile]=useState<Profile|null>(null);
  const [today,setToday]=useState<Attendance|null>(null);
  const [email,setEmail]=useState("");
  const [employeeId,setEmployeeId]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  async function load(){
    if(!supabase){setError(supabaseConfigError);return}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session)return;
    const {data:p}=await supabase.from("profiles").select("id,full_name,employee_id,office_id,role,active").eq("id",session.user.id).maybeSingle();
    if(!p || p.role!=="employee" || !p.active){setError("This account is not an active Loggin employee account.");return}
    const savedId=window.localStorage.getItem("loggin_employee_id");
    if(savedId && p.employee_id && savedId.toLowerCase()!==p.employee_id.toLowerCase()){
      await supabase.auth.signOut(); window.localStorage.removeItem("loggin_employee_id"); setError("This device is linked to a different employee ID."); return;
    }
    setProfile(p);
    const {data:a}=await supabase.from("attendance").select("work_date,check_in_at,check_out_at,total_working_minutes,status").eq("employee_id",p.id).eq("work_date",dateInIndia()).maybeSingle();
    setToday(a??null);
  }
  useEffect(()=>{load()},[]);

  async function activate(e:FormEvent){
    e.preventDefault(); setLoading(true); setError(""); setMessage("");
    if(!supabase){setError(supabaseConfigError);setLoading(false);return}
    const cleanEmail=email.trim().toLowerCase(); const cleanId=employeeId.trim();
    if(!cleanId || !cleanEmail){setError("Enter your Employee ID and work email.");setLoading(false);return}
    const {error:authError}=await supabase.auth.signInWithOtp({email:cleanEmail,options:{emailRedirectTo:`${window.location.origin}/auth/callback?next=/employee`,shouldCreateUser:false}});
    if(authError)setError(authError.message);else{window.localStorage.setItem("loggin_employee_id",cleanId);setMessage("Check your work email. Tap the Loggin link once and this device will stay signed in.")}
    setLoading(false);
  }

  async function signOut(){await supabase?.auth.signOut();window.localStorage.removeItem("loggin_employee_id");window.location.reload()}

  async function attendance(action:"checkin"|"checkout"|"leave"){
    if(!supabase)return;setLoading(true);setError("");setMessage("");
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){setError("Please activate this device first.");setLoading(false);return}
    let latitude:number|undefined,longitude:number|undefined;
    if(navigator.geolocation){try{const p=await new Promise<GeolocationPosition>((r,j)=>navigator.geolocation.getCurrentPosition(r,j,{enableHighAccuracy:true,timeout:8000,maximumAge:0}));latitude=p.coords.latitude;longitude=p.coords.longitude}catch{}}
    const endpoint=action==="checkin"?"/api/attendance/manual-checkin":action==="checkout"?"/api/attendance/checkout":"/api/attendance/leave";
    const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({latitude,longitude})});
    const j=await r.json();
    if(!r.ok){setError(j.error||"Could not update attendance");setLoading(false);return}
    setMessage(action==="checkin"?"Checked in. Have a great day.":action==="checkout"?"Checked out. Your attendance is saved.":"Marked on leave for today.");
    setLoading(false);await load();
  }

  if(!profile)return <main className="min-h-screen bg-[#f7f7f5] p-5"><div className="mx-auto flex min-h-[90vh] max-w-md items-center"><div className="w-full rounded-[2rem] border border-black/10 bg-white p-7 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#173b32] text-sm font-bold text-white">L</div><span className="text-xl font-semibold">loggin</span></div><h1 className="mt-10 text-3xl font-semibold tracking-[-0.04em]">Employee access</h1><p className="mt-3 text-sm leading-6 text-[#777]">Enter your Employee ID once. We’ll verify your work email and keep this device signed in for quick daily attendance.</p><form onSubmit={activate} className="mt-7 space-y-4"><label className="block text-sm font-medium">Employee ID<input required value={employeeId} onChange={e=>setEmployeeId(e.target.value)} placeholder="EMP-001" className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none focus:border-[#173b32]" autoCapitalize="characters" /></label><label className="block text-sm font-medium">Work email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none focus:border-[#173b32]" /></label>{error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}{message&&<div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}<button disabled={loading} className="w-full rounded-xl bg-[#173b32] py-3.5 text-sm font-semibold text-white disabled:opacity-50">{loading?"Sending…":"Activate this device"}</button></form><p className="mt-6 text-center text-xs text-[#999]">First time only. After activation, open this page and tap your attendance action.</p></div></div></main>;

  const checkedIn=!!today?.check_in_at && !today?.check_out_at; const complete=!!today?.check_out_at; const onLeave=today?.status==="on_leave";
  return <main className="min-h-screen bg-[#f7f7f5] p-5"><div className="mx-auto max-w-md"><header className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#173b32] text-sm font-bold text-white">L</div><div><p className="text-xl font-semibold">loggin</p><p className="text-xs text-[#777]">Employee attendance</p></div></div><button onClick={signOut} className="text-xs font-medium text-[#777]">Switch device</button></header><section className="mt-10 text-center"><p className="text-sm text-[#777]">{profile.employee_id}</p><h1 className="mt-2 text-3xl font-semibold">Hi, {profile.full_name.split(" ")[0]}.</h1><p className="mt-2 text-sm text-[#777]">{new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}</p></section>{message&&<div className="mt-6 rounded-xl bg-emerald-50 p-4 text-center text-sm text-emerald-800">{message}</div>}{error&&<div className="mt-6 rounded-xl bg-red-50 p-4 text-center text-sm text-red-700">{error}</div>}<section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm border border-black/10"><div className="text-center"><p className="text-xs uppercase tracking-[0.2em] text-[#999]">Today</p><p className="mt-3 text-4xl font-semibold">{complete?"Done":onLeave?"On leave":checkedIn?"Working":"Not checked in"}</p><p className="mt-2 text-sm text-[#777]">{today?.check_in_at?`In ${time(today.check_in_at)}`:"No check-in yet"}{today?.check_out_at?` · Out ${time(today.check_out_at)}`:""}</p></div><div className="mt-7 grid gap-3">{!checkedIn&&!complete&&!onLeave&&<button disabled={loading} onClick={()=>attendance("checkin")} className="rounded-2xl bg-[#173b32] py-5 text-lg font-semibold text-white disabled:opacity-50">{loading?"Saving…":"Check in"}</button>}{checkedIn&&<button disabled={loading} onClick={()=>attendance("checkout")} className="rounded-2xl bg-[#173b32] py-5 text-lg font-semibold text-white disabled:opacity-50">{loading?"Saving…":"Check out"}</button>}{!today&&!onLeave&&<button disabled={loading} onClick={()=>attendance("leave")} className="rounded-2xl border border-black/10 py-4 text-sm font-semibold text-[#333] disabled:opacity-50">Mark today as on leave</button>}</div></section><section className="mt-4 rounded-2xl border border-black/10 bg-white p-5"><div className="flex justify-between"><span className="text-sm text-[#777]">Working time</span><span className="text-sm font-semibold">{duration(today?.total_working_minutes??null)}</span></div><div className="mt-3 flex justify-between"><span className="text-sm text-[#777]">Employee ID</span><span className="text-sm font-semibold">{profile.employee_id??"—"}</span></div></section><p className="mt-6 text-center text-xs text-[#aaa]">Attendance is shared with your company admin.</p></div></main>;
}
