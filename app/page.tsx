"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Building2, CalendarDays, Check, ChevronDown, Clock3, LogIn, LogOut, MapPin, Plus, Users, X } from "lucide-react";

type Employee = { name:string; role:string; office:string; status:"Present"|"Late"|"Absent"|"On leave"; time?:string };

const seedEmployees: Employee[] = [
  { name:"Amar Mishra", role:"Product", office:"Hyderabad", status:"Present", time:"09:07 AM" },
  { name:"Rahul Sharma", role:"Engineering", office:"Hyderabad", status:"Present", time:"09:12 AM" },
  { name:"Priya Rao", role:"Design", office:"Hyderabad", status:"Late", time:"09:24 AM" },
  { name:"Arjun Mehta", role:"Sales", office:"Bangalore", status:"Absent" },
  { name:"Sneha Kapoor", role:"Marketing", office:"Bangalore", status:"On leave" },
  { name:"Rohan Das", role:"Operations", office:"Mumbai", status:"Present", time:"08:56 AM" },
];

export default function Home() {
  const [view, setView] = useState<"admin"|"employee">("admin");
  const [employees, setEmployees] = useState(seedEmployees);
  const [checkedIn, setCheckedIn] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [office, setOffice] = useState("All offices");

  const visible = useMemo(() => office === "All offices" ? employees : employees.filter(e => e.office === office), [employees, office]);
  const present = visible.filter(e => e.status === "Present" || e.status === "Late").length;
  const late = visible.filter(e => e.status === "Late").length;
  const absent = visible.filter(e => e.status === "Absent").length;

  function addEmployee(form: HTMLFormElement) {
    const data = new FormData(form);
    const name = String(data.get("name") || "New employee");
    const role = String(data.get("role") || "Team");
    const employeeOffice = String(data.get("office") || "Hyderabad");
    setEmployees(prev => [{ name, role, office:employeeOffice, status:"Absent" }, ...prev]);
    setShowAdd(false);
  }

  if (view === "employee") return <EmployeeView checkedIn={checkedIn} onToggle={() => setCheckedIn(v => !v)} onAdmin={() => setView("admin")} />;

  return (
    <main className="min-h-screen bg-[#f7f7f5]">
      <header className="border-b border-black/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#173b32] text-sm font-bold text-white">L</div><span className="text-lg font-semibold tracking-tight">loggin</span></div>
          <div className="flex items-center gap-3"><button onClick={() => setView("employee")} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:bg-black/[.03]">Employee view</button><div className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-sm"><div className="grid h-7 w-7 place-items-center rounded-full bg-[#dfe8e3] text-xs font-bold text-[#173b32]">AM</div> Amar Mishra <ChevronDown size={14}/></div></div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-10 lg:px-10">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><p className="mb-2 text-sm font-medium text-[#6b6b6b]">Tuesday, 25 August 2026</p><h1 className="text-4xl font-semibold tracking-[-0.04em] md:text-5xl">Your company, right now.</h1><p className="mt-3 max-w-xl text-base text-[#6b6b6b]">A live view of who is in, who is late, and what needs your attention.</p></div>
          <div className="flex gap-3"><button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-xl bg-[#173b32] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#102d26]"><Plus size={17}/> Add employee</button><button className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-medium">Export</button></div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Metric label="Present" value={present} detail="Checked in today" icon={<Check size={18}/>} />
          <Metric label="Late" value={late} detail="Needs attention" icon={<Clock3 size={18}/>} />
          <Metric label="Absent" value={absent} detail="Not checked in" icon={<X size={18}/>} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
          <section className="overflow-hidden rounded-2xl border border-black/10 bg-white">
            <div className="flex flex-col gap-4 border-b border-black/10 p-6 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">People</h2><p className="mt-1 text-sm text-[#6b6b6b]">{visible.length} employees in view</p></div><label className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm"><Building2 size={15}/><select value={office} onChange={e => setOffice(e.target.value)} className="bg-transparent outline-none"><option>All offices</option><option>Hyderabad</option><option>Bangalore</option><option>Mumbai</option></select></label></div>
            <div className="divide-y divide-black/5">{visible.map((employee, i) => <EmployeeRow key={i} employee={employee}/>)}</div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-[#173b32] p-7 text-white">
            <div className="mb-10 flex items-center justify-between"><div><p className="text-sm text-white/60">Office pulse</p><h2 className="mt-1 text-xl font-semibold">Across your offices</h2></div><MapPin size={20} className="text-white/60"/></div>
            {[['Hyderabad',42,48],['Bangalore',28,30],['Mumbai',17,19]].map(([name,a,b]) => <div key={String(name)} className="mb-7"><div className="mb-2 flex justify-between text-sm"><span>{name}</span><span className="text-white/60">{a} / {b}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white" style={{width:`${Number(a)/Number(b)*100}%`}} /></div></div>)}
            <button className="mt-2 flex items-center gap-2 text-sm font-semibold text-white/90">Manage offices <ArrowRight size={15}/></button>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-black/10 bg-white p-6"><div className="mb-6 flex items-center justify-between"><div><h2 className="font-semibold">Today&apos;s activity</h2><p className="mt-1 text-sm text-[#6b6b6b]">The latest attendance events</p></div><CalendarDays size={19} className="text-[#6b6b6b]"/></div><div className="grid gap-3 md:grid-cols-3">{employees.filter(e=>e.time).slice(0,6).map((e,i)=><div key={i} className="rounded-xl bg-[#f7f7f5] p-4"><div className="flex items-center justify-between"><span className="text-sm font-medium">{e.name}</span><span className="text-xs text-[#6b6b6b]">{e.time}</span></div><p className="mt-1 text-xs text-[#6b6b6b]">Checked in · {e.office}</p></div>)}</div></section>
      </div>

      {showAdd && <div className="fixed inset-0 z-20 grid place-items-center bg-black/30 p-5" onMouseDown={() => setShowAdd(false)}><form onSubmit={e => {e.preventDefault(); addEmployee(e.currentTarget)}} onMouseDown={e=>e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl"><div className="mb-6 flex items-start justify-between"><div><h2 className="text-xl font-semibold">Add employee</h2><p className="mt-1 text-sm text-[#6b6b6b]">Create a company account and assign an office.</p></div><button type="button" onClick={()=>setShowAdd(false)}><X size={18}/></button></div><div className="space-y-4"><Field name="name" label="Full name" placeholder="e.g. Ananya Rao"/><Field name="role" label="Role" placeholder="e.g. Engineering"/><label className="block text-sm font-medium">Office<select name="office" className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-3 outline-none"><option>Hyderabad</option><option>Bangalore</option><option>Mumbai</option></select></label></div><button className="mt-6 w-full rounded-xl bg-[#173b32] py-3 text-sm font-semibold text-white">Create employee</button></form></div>}
    </main>
  );
}

function Metric({label,value,detail,icon}:{label:string;value:number;detail:string;icon:React.ReactNode}) { return <div className="rounded-2xl border border-black/10 bg-white p-6"><div className="flex items-center justify-between"><span className="text-sm text-[#6b6b6b]">{label}</span><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f2f2ef] text-[#173b32]">{icon}</span></div><div className="mt-5 text-4xl font-semibold tracking-[-0.04em]">{value}</div><p className="mt-1 text-sm text-[#6b6b6b]">{detail}</p></div> }
function EmployeeRow({employee:e}:{employee:Employee}) { const dot=e.status==='Present'?'bg-emerald-500':e.status==='Late'?'bg-amber-500':e.status==='On leave'?'bg-blue-400':'bg-black/20'; return <div className="flex items-center justify-between p-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[#eef0ed] text-xs font-semibold">{e.name.split(' ').map(x=>x[0]).join('')}</div><div><p className="text-sm font-medium">{e.name}</p><p className="mt-0.5 text-xs text-[#6b6b6b]">{e.role} · {e.office}</p></div></div><div className="text-right"><div className="flex items-center justify-end gap-2 text-sm"><span className={`h-2 w-2 rounded-full ${dot}`}/>{e.status}</div><p className="mt-0.5 text-xs text-[#6b6b6b]">{e.time || '—'}</p></div></div> }
function Field({name,label,placeholder}:{name:string;label:string;placeholder:string}) { return <label className="block text-sm font-medium">{label}<input required name={name} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-black/10 px-3 py-3 outline-none focus:border-[#173b32]"/></label> }

function EmployeeView({checkedIn,onToggle,onAdmin}:{checkedIn:boolean;onToggle:()=>void;onAdmin:()=>void}) { return <main className="min-h-screen bg-[#f7f7f5]"><header className="border-b border-black/10 bg-white"><div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#173b32] text-sm font-bold text-white">L</div><span className="font-semibold">loggin</span></div><button onClick={onAdmin} className="text-sm text-[#6b6b6b]">Admin view</button></div></header><div className="mx-auto max-w-3xl px-6 py-20"><p className="text-sm font-medium text-[#6b6b6b]">Hyderabad Office · Tuesday, 25 August</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">Good morning, Amar.</h1><div className="mt-10 rounded-3xl border border-black/10 bg-white p-8"><div className="flex items-center justify-between"><div><p className="text-sm text-[#6b6b6b]">Today</p><h2 className="mt-2 text-2xl font-semibold">{checkedIn ? "You're in." : "You're not checked in."}</h2><p className="mt-2 text-sm text-[#6b6b6b]">{checkedIn ? "Checked in at 09:07 AM · Working for 2h 41m" : "Your office starts at 9:00 AM. You have a 15-minute grace period."}</p></div><div className="grid h-16 w-16 place-items-center rounded-full bg-[#e4eee9] text-[#173b32]">{checkedIn?<Check size={28}/>:<LogIn size={28}/>}</div></div><button onClick={onToggle} className="mt-10 flex w-full items-center justify-center gap-2 rounded-xl bg-[#173b32] py-4 text-sm font-semibold text-white">{checkedIn?<><LogOut size={17}/> Check out</>:<><LogIn size={17}/> Check in</>}</button></div><div className="mt-6 rounded-2xl border border-black/10 bg-white p-6"><h3 className="font-semibold">Today&apos;s timeline</h3><div className="mt-5 space-y-5"><div className="flex gap-4"><div className="mt-1 h-2 w-2 rounded-full bg-[#173b32]"/><div><p className="text-sm font-medium">09:07 AM · Checked in</p><p className="mt-1 text-xs text-[#6b6b6b]">Hyderabad Office</p></div></div></div></div></div></main> }
