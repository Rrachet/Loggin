"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase, supabaseConfigError } from "@/lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const errorCode = new URLSearchParams(window.location.search).get("error");
    if (errorCode === "confirmation_failed") setError("That login link has expired or is invalid. Request a new one.");
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { if (data.session) window.location.href = "/dashboard"; });
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setError(null); setMessage("");
    if (!supabase) { setError(supabaseConfigError); return; }
    if (!email.trim() || !password) { setError("Enter your work email and password."); return; }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (authError) { setError(authError.message); return; }
    window.location.href = "/dashboard";
  }

  async function magicLink() {
    if (!supabase) { setError(supabaseConfigError); return; }
    if (!email.trim()) { setError("Enter your work email first."); return; }
    setError(null); setMessage(""); setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`, shouldCreateUser: false } });
    setLoading(false);
    if (authError) setError(authError.message); else setMessage("Check your email. We sent you a secure Loggin sign-in link.");
  }

  async function google() {
    if (!supabase) { setError(supabaseConfigError); return; }
    setError(null); setMessage("");
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` } });
    if (authError) setError(authError.message);
  }

  return <main className="min-h-screen bg-[#f7f8f6] p-6"><div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center"><div className="grid w-full overflow-hidden rounded-[2rem] border border-black/[0.08] bg-white shadow-sm lg:grid-cols-[1.05fr_.95fr]"><section className="hidden bg-[#173b32] p-12 text-white lg:block"><div className="flex items-center gap-3"><img src="/loggin-logo.svg" alt="Loggin" className="h-10 w-10 rounded-xl"/><span className="text-xl font-semibold">Loggin</span></div><div className="mt-32 max-w-md"><p className="text-sm font-medium text-white/60">Simple attendance for modern teams.</p><h1 className="mt-3 text-5xl font-semibold tracking-[-0.05em]">Know who’s in.</h1><p className="mt-5 text-sm leading-7 text-white/65">Employees check in, check out, and keep their attendance history in one place.</p></div></section><section className="p-8 sm:p-12"><div className="flex items-center gap-3 lg:hidden"><img src="/loggin-logo.svg" alt="Loggin" className="h-9 w-9 rounded-xl"/><span className="text-xl font-semibold">Loggin</span></div><div className="mt-10 lg:mt-0"><p className="text-sm text-[#6b6b6b]">Welcome back</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Sign in to Loggin.</h1><p className="mt-3 text-sm leading-6 text-[#6b6b6b]">Use your work email and password, or continue with Google.</p></div><button type="button" onClick={google} className="mt-8 w-full rounded-xl border border-black/10 bg-white py-3.5 text-sm font-semibold hover:bg-[#f7f8f6]">Continue with Google</button><div className="my-6 flex items-center gap-3 text-xs text-[#999]"><div className="h-px flex-1 bg-black/10"/>OR<div className="h-px flex-1 bg-black/10"/></div><form onSubmit={signIn} className="space-y-4"><label className="block text-sm font-medium">Work email<input className="field mt-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required /></label><label className="block text-sm font-medium">Password<div className="relative mt-2"><input className="field pr-12" type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required /><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#173b32]">{showPassword ? "Hide" : "Show"}</button></div></label>{error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}{message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}<button disabled={loading} className="primary disabled:opacity-50">{loading ? "Signing in…" : "Sign in with email"}</button></form><button type="button" onClick={magicLink} disabled={loading} className="mt-4 w-full text-center text-sm font-medium text-[#173b32] disabled:opacity-50">Email me a secure login link instead</button><div className="mt-8 border-t border-black/10 pt-6 text-center"><p className="text-sm text-[#6b6b6b]">New company?</p><a href="/signup" className="mt-2 inline-block text-sm font-semibold text-[#173b32]">Create your Loggin workspace →</a></div></section></div></div></main>;
}
