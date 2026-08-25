"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase, supabaseConfigError } from "@/lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/dashboard";
    });
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!supabase) { setError(supabaseConfigError); return; }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-sm lg:grid-cols-[1.05fr_.95fr]">
          <section className="hidden bg-[#173b32] p-12 text-white lg:block">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 font-bold">L</div><span className="text-xl font-semibold">loggin</span></div>
            <div className="mt-32 max-w-md"><p className="text-sm font-medium text-white/60">Simple attendance for modern teams.</p><h1 className="mt-3 text-5xl font-semibold tracking-[-0.05em]">Know who’s in.</h1><p className="mt-5 text-sm leading-7 text-white/65">Employees check in, check out, and keep their attendance history in one place. Founders get a clean view of the day.</p></div>
          </section>
          <section className="p-8 sm:p-12">
            <div className="flex items-center gap-3 lg:hidden"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#173b32] text-sm font-bold text-white">L</div><span className="text-xl font-semibold">loggin</span></div>
            <div className="mt-10 lg:mt-0"><p className="text-sm text-[#6b6b6b]">Welcome back</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Sign in to Loggin.</h1><p className="mt-3 text-sm leading-6 text-[#6b6b6b]">Use the email and password you created for your account.</p></div>
            <form onSubmit={signIn} className="mt-8 space-y-4">
              <label className="block text-sm font-medium">Email<input className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none focus:border-[#173b32]" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required /></label>
              <label className="block text-sm font-medium">Password<div className="relative"><input className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 pr-12 outline-none focus:border-[#173b32]" type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={()=>setShowPassword(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#777]">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
              {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <button disabled={loading} className="w-full rounded-xl bg-[#173b32] py-3.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Signing in…" : "Sign in"}</button>
            </form>
            <div className="mt-8 border-t border-black/10 pt-6 text-center"><p className="text-sm text-[#6b6b6b]">Don’t have an account?</p><a href="/signup" className="mt-2 inline-block text-sm font-semibold text-[#173b32]">Create your Loggin account →</a></div>
          </section>
        </div>
      </div>
    </main>
  );
}
