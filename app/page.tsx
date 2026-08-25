"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase, supabaseConfigError } from "@/lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    if (!supabase) {
      setError(supabaseConfigError);
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Loggin</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Your company, right now.</h1>
          <p className="mt-2 text-sm text-white/55">Founder-first attendance for modern teams.</p>
        </div>
        <form onSubmit={signIn} className="space-y-4">
          <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-cyan-300/60" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" required />
          <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-cyan-300/60" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
          {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          <button className="w-full rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-50" disabled={loading || !supabase}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
