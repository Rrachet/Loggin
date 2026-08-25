"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase, supabaseConfigError } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  employee_id: string | null;
  office_id: string | null;
  role: string;
  active: boolean;
};

type Attendance = {
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_working_minutes: number | null;
  status: string;
};

const dateInIndia = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const duration = (minutes: number | null) =>
  minutes == null ? "—" : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

export default function EmployeePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [today, setToday] = useState<Attendance | null>(null);
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!supabase) {
      setError(supabaseConfigError);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id,full_name,employee_id,office_id,role,active")
      .eq("id", session.user.id)
      .maybeSingle();

    if (
      !profileData ||
      profileData.role !== "employee" ||
      !profileData.active
    ) {
      setError("This account is not an active Loggin employee account.");
      return;
    }

    const savedId = window.localStorage.getItem("loggin_employee_id");

    if (
      savedId &&
      profileData.employee_id &&
      savedId.toLowerCase() !== profileData.employee_id.toLowerCase()
    ) {
      await supabase.auth.signOut();
      window.localStorage.removeItem("loggin_employee_id");
      setError("This device is linked to a different employee ID.");
      return;
    }

    setProfile(profileData);

    const { data: attendance } = await supabase
      .from("attendance")
      .select("work_date,check_in_at,check_out_at,total_working_minutes,status")
      .eq("employee_id", profileData.id)
      .eq("work_date", dateInIndia())
      .maybeSingle();

    setToday(attendance ?? null);
  }

  useEffect(() => {
    load();
  }, []);

  async function activate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (!supabase) {
      setError(supabaseConfigError);
      setLoading(false);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanId = employeeId.trim();

    if (!cleanId || !cleanEmail) {
      setError("Enter your Employee ID and work email.");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/employee`,
        shouldCreateUser: false,
      },
    });

    if (authError) {
      setError(authError.message);
    } else {
      window.localStorage.setItem("loggin_employee_id", cleanId);
      setMessage("Check your work email to finish setup.");
    }

    setLoading(false);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    window.localStorage.removeItem("loggin_employee_id");
    window.location.reload();
  }

  async function attendance(action: "checkin" | "checkout" | "leave") {
    if (!supabase) return;

    setLoading(true);
    setError("");
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError("Please activate this device first.");
      setLoading(false);
      return;
    }

    let latitude: number | undefined;
    let longitude: number | undefined;

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 0,
            })
        );

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch {
        // Location is optional unless the server requires it.
      }
    }

    const endpoint =
      action === "checkin"
        ? "/api/attendance/manual-checkin"
        : action === "checkout"
          ? "/api/attendance/checkout"
          : "/api/attendance/leave";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ latitude, longitude }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "Could not update attendance.");
      setLoading(false);
      return;
    }

    setMessage(
      action === "checkin"
        ? "You’re checked in. Have a good day."
        : action === "checkout"
          ? "You’re checked out. Your day is complete."
          : "Today is marked as leave."
    );

    setLoading(false);
    await load();
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] px-5 py-6">
        <div className="mx-auto flex min-h-[90vh] max-w-md items-center">
          <div className="w-full rounded-[2rem] border border-black/10 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#173b32] text-sm font-bold text-white">
                L
              </div>
              <span className="text-xl font-semibold tracking-tight">loggin</span>
            </div>

            <h1 className="mt-10 text-3xl font-semibold tracking-[-0.04em]">
              Employee access
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#777]">
              Activate this device once. After that, attendance is just one tap.
            </p>

            <form onSubmit={activate} className="mt-7 space-y-4">
              <label className="block text-sm font-medium text-[#333]">
                Employee ID
                <input
                  required
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  placeholder="EMP-001"
                  autoCapitalize="characters"
                  className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none transition focus:border-[#173b32]"
                />
              </label>

              <label className="block text-sm font-medium text-[#333]">
                Work email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 outline-none transition focus:border-[#173b32]"
                />
              </label>

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                  {message}
                </div>
              )}

              <button
                disabled={loading}
                className="w-full rounded-xl bg-[#173b32] py-3.5 text-sm font-semibold text-white transition hover:bg-[#123027] disabled:opacity-50"
              >
                {loading ? "Sending…" : "Activate device"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-[#999]">
              We’ll send a secure sign-in link to your work email.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const checkedIn = !!today?.check_in_at && !today?.check_out_at;
  const complete = !!today?.check_out_at;
  const onLeave = today?.status === "on_leave";

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-5 py-6">
      <div className="mx-auto max-w-md">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#173b32] text-sm font-bold text-white">
              L
            </div>
            <div>
              <p className="text-xl font-semibold tracking-tight">loggin</p>
              <p className="text-xs text-[#777]">Attendance</p>
            </div>
          </div>

          <button
            onClick={signOut}
            className="text-xs font-medium text-[#777] hover:text-[#333]"
          >
            Switch device
          </button>
        </header>

        <section className="mt-10">
          <p className="text-sm text-[#777]">{profile.employee_id}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">
            Hi, {profile.full_name.split(" ")[0]}.
          </h1>
          <p className="mt-2 text-sm text-[#777]">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </section>

        {message && (
          <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-center text-sm text-emerald-800">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-center text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-8 rounded-[2rem] border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-[#999]">Today</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
              {complete ? "Done" : onLeave ? "On leave" : checkedIn ? "Working" : "Not started"}
            </p>
            <p className="mt-2 text-sm text-[#777]">
              {today?.check_in_at ? `In ${time(today.check_in_at)}` : "No check-in yet"}
              {today?.check_out_at ? ` · Out ${time(today.check_out_at)}` : ""}
            </p>
          </div>

          <div className="mt-7 grid gap-3">
            {!checkedIn && !complete && !onLeave && (
              <button
                disabled={loading}
                onClick={() => attendance("checkin")}
                className="rounded-2xl bg-[#173b32] py-5 text-lg font-semibold text-white transition hover:bg-[#123027] disabled:opacity-50"
              >
                {loading ? "Saving…" : "Check in"}
              </button>
            )}

            {checkedIn && (
              <button
                disabled={loading}
                onClick={() => attendance("checkout")}
                className="rounded-2xl bg-[#173b32] py-5 text-lg font-semibold text-white transition hover:bg-[#123027] disabled:opacity-50"
              >
                {loading ? "Saving…" : "Check out"}
              </button>
            )}

            {!today && !onLeave && (
              <button
                disabled={loading}
                onClick={() => attendance("leave")}
                className="rounded-2xl border border-black/10 py-4 text-sm font-semibold text-[#333] transition hover:bg-[#fafafa] disabled:opacity-50"
              >
                Mark as leave
              </button>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-black/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#777]">Working time</span>
            <span className="text-sm font-semibold">{duration(today?.total_working_minutes ?? null)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-[#777]">Employee ID</span>
            <span className="text-sm font-semibold">{profile.employee_id ?? "—"}</span>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-[#aaa]">
          Attendance is shared with your company admin.
        </p>
      </div>
    </main>
  );
}
