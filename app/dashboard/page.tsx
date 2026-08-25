"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  company_id: string;
  office_id: string | null;
  full_name: string;
  role: string;
  active: boolean;
};

type Office = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number;
  geofence_enabled: boolean;
  work_start: string;
  work_end: string;
  grace_minutes: number;
};

type Attendance = {
  id: string;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_working_minutes: number | null;
  status: string;
  check_in_method: string;
};

const localDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const clock = (value: string | null) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const duration = (minutes: number | null) =>
  minutes == null ? "—" : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [today, setToday] = useState<Attendance | null>(null);
  const [recent, setRecent] = useState<Attendance[]>([]);
  const [team, setTeam] = useState<Attendance[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [officeName, setOfficeName] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [invName, setInvName] = useState("");
  const [invEmail, setInvEmail] = useState("");

  async function load() {
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/";
      return;
    }

    let { data: profileData, error } = await supabase
      .from("profiles")
      .select("id,company_id,office_id,full_name,role,active")
      .eq("id", session.user.id)
      .maybeSingle();

    if ((error || !profileData) && session.user.email) {
      const bootstrap = await fetch("/api/profile/bootstrap", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          fullName:
            session.user.user_metadata?.full_name ||
            session.user.email.split("@")[0],
          companyName: session.user.user_metadata?.company_name,
        }),
      });

      if (bootstrap.ok) {
        const result = await bootstrap.json();
        profileData = result.profile;
        error = null;
      }
    }

    if (error || !profileData) {
      setMessage(
        error?.message ||
          "We couldn’t load your workspace. Check the server configuration."
      );
      return;
    }

    setProfile(profileData);

    if (profileData.office_id) {
      const { data: officeData } = await supabase
        .from("offices")
        .select(
          "id,name,address,latitude,longitude,geofence_radius_m,geofence_enabled,work_start,work_end,grace_minutes"
        )
        .eq("id", profileData.office_id)
        .maybeSingle();

      setOffice(officeData ?? null);
    }

    const { data: attendance } = await supabase
      .from("attendance")
      .select(
        "id,work_date,check_in_at,check_out_at,total_working_minutes,status,check_in_method"
      )
      .eq("employee_id", profileData.id)
      .order("work_date", { ascending: false })
      .limit(30);

    setRecent(attendance ?? []);
    setToday(
      (attendance ?? []).find((item) => item.work_date === localDate()) ?? null
    );

    if (["founder", "admin", "manager"].includes(profileData.role)) {
      const { data: teamAttendance } = await supabase
        .from("attendance")
        .select(
          "id,work_date,check_in_at,check_out_at,total_working_minutes,status,check_in_method"
        )
        .eq("work_date", localDate());

      setTeam(teamAttendance ?? []);
    }

    if (["founder", "admin"].includes(profileData.role)) {
      const { data: officeList } = await supabase
        .from("offices")
        .select(
          "id,name,address,latitude,longitude,geofence_radius_m,geofence_enabled,work_start,work_end,grace_minutes"
        )
        .eq("company_id", profileData.company_id)
        .order("name");

      setOffices(officeList ?? []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function attendance(action: "checkin" | "checkout") {
    if (!supabase) return;

    setBusy(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    let latitude: number | undefined;
    let longitude: number | undefined;

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            })
        );

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch {
        if (action === "checkin" && office?.geofence_enabled) {
          setMessage("Location permission is required for check-in at this office.");
          setBusy(false);
          return;
        }
      }
    }

    const endpoint =
      action === "checkin"
        ? "/api/attendance/manual-checkin"
        : "/api/attendance/checkout";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ latitude, longitude }),
    });

    const result = await response.json();

    setMessage(
      response.ok
        ? action === "checkin"
          ? "Checked in successfully."
          : "Checked out successfully."
        : result.error || "Attendance action failed."
    );

    setBusy(false);

    if (response.ok) await load();
  }

  async function signOut() {
    await supabase?.auth.signOut();
    window.location.href = "/";
  }

  async function createOffice(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    setBusy(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    let latitude: number | undefined;
    let longitude: number | undefined;

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            })
        );

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch {
        // Office can still be created without coordinates.
      }
    }

    const response = await fetch("/api/offices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        name: officeName,
        address: officeAddress,
        latitude,
        longitude,
      }),
    });

    const result = await response.json();

    setMessage(
      response.ok
        ? "Office created successfully."
        : result.error || "Could not create office."
    );

    setBusy(false);

    if (response.ok) {
      setOfficeName("");
      setOfficeAddress("");
      await load();
    }
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !offices[0]) return;

    setBusy(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch("/api/employees/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        email: invEmail,
        fullName: invName,
        officeId: offices[0].id,
      }),
    });

    const result = await response.json();

    setMessage(
      response.ok
        ? "Invitation sent successfully."
        : result.error || "Could not invite employee."
    );

    setBusy(false);

    if (response.ok) {
      setInvName("");
      setInvEmail("");
    }
  }

  const stats = useMemo(
    () => ({
      present: team.filter((item) => item.status === "present").length,
      late: team.filter((item) => item.status === "late").length,
      out: team.filter((item) => !!item.check_out_at).length,
    }),
    [team]
  );

  if (!profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6">
        <div className="max-w-md rounded-2xl border border-black/10 bg-white p-6 text-sm text-[#666]">
          {message || "Loading your workspace…"}
        </div>
      </main>
    );
  }

  const manager = ["founder", "admin"].includes(profile.role);

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-6 py-7">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#173b32] text-sm font-bold text-white">
              L
            </div>
            <div>
              <p className="text-xl font-semibold tracking-tight">loggin</p>
              <p className="text-xs text-[#777]">Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-[#666] sm:inline">
              {profile.full_name}
            </span>
            <button
              onClick={signOut}
              className="text-sm font-medium text-[#777] hover:text-[#333]"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="mt-10">
          <p className="text-sm capitalize text-[#777]">{profile.role}</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-[-0.05em]">
            Good to see you, {profile.full_name.split(" ")[0]}.
          </h1>
          <p className="mt-3 text-sm text-[#777]">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </section>

        {message && (
          <div className="mt-6 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#555]">
            {message}
          </div>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-[#999]">Today</p>
            <p className="mt-3 text-2xl font-semibold capitalize">
              {today?.status ?? "Not started"}
            </p>
            <p className="mt-1 text-sm text-[#777]">
              {clock(today?.check_in_at ?? null)} → {clock(today?.check_out_at ?? null)}
            </p>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-[#999]">Working time</p>
            <p className="mt-3 text-2xl font-semibold">
              {duration(today?.total_working_minutes ?? null)}
            </p>
            <p className="mt-1 text-sm text-[#777]">Today</p>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-[#999]">Office</p>
            <p className="mt-3 text-2xl font-semibold">
              {office?.name ?? "Not assigned"}
            </p>
            <p className="mt-1 text-sm text-[#777]">
              {office?.geofence_enabled
                ? `Location check · ${office.geofence_radius_m}m`
                : "Location check off"}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-[#173b32] p-6 text-white">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-white/60">Attendance</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                {today?.check_in_at && !today?.check_out_at
                  ? "You’re checked in."
                  : today?.check_out_at
                    ? "Your day is complete."
                    : "Ready to start your day?"}
              </h2>
              <p className="mt-2 text-sm text-white/60">
                {office?.name
                  ? `Assigned to ${office.name}.`
                  : "No office assigned yet."}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                disabled={busy || !!today?.check_in_at}
                onClick={() => attendance("checkin")}
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#173b32] transition hover:bg-white/90 disabled:opacity-40"
              >
                {busy ? "Saving…" : "Check in"}
              </button>
              <button
                disabled={busy || !today?.check_in_at || !!today?.check_out_at}
                onClick={() => attendance("checkout")}
                className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-40"
              >
                Check out
              </button>
            </div>
          </div>
        </section>

        {team.length > 0 && (
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <p className="text-xs uppercase tracking-wider text-[#999]">Present</p>
              <p className="mt-2 text-3xl font-semibold">{stats.present}</p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <p className="text-xs uppercase tracking-wider text-[#999]">Late</p>
              <p className="mt-2 text-3xl font-semibold">{stats.late}</p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <p className="text-xs uppercase tracking-wider text-[#999]">Checked out</p>
              <p className="mt-2 text-3xl font-semibold">{stats.out}</p>
            </div>
          </section>
        )}

        {manager && (
          <section className="mt-8">
            <div className="mb-4">
              <p className="text-sm text-[#777]">Setup</p>
              <h2 className="text-xl font-semibold tracking-tight">Get your workspace ready</h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-black/10 bg-white p-6">
                <h3 className="text-lg font-semibold">Add an office</h3>
                <p className="mt-1 text-sm text-[#777]">
                  Create it from the office location to enable accurate check-ins.
                </p>

                <form onSubmit={createOffice} className="mt-5 space-y-3">
                  <input
                    required
                    value={officeName}
                    onChange={(event) => setOfficeName(event.target.value)}
                    placeholder="Office name"
                    className="w-full rounded-xl border border-black/10 px-3 py-3 outline-none focus:border-[#173b32]"
                  />
                  <input
                    value={officeAddress}
                    onChange={(event) => setOfficeAddress(event.target.value)}
                    placeholder="Address (optional)"
                    className="w-full rounded-xl border border-black/10 px-3 py-3 outline-none focus:border-[#173b32]"
                  />
                  <button
                    disabled={busy}
                    className="w-full rounded-xl bg-[#173b32] py-3 text-sm font-semibold text-white transition hover:bg-[#123027] disabled:opacity-50"
                  >
                    Add office
                  </button>
                </form>
              </div>

              <div className="rounded-3xl border border-black/10 bg-white p-6">
                <h3 className="text-lg font-semibold">Add an employee</h3>
                <p className="mt-1 text-sm text-[#777]">
                  Send a secure invitation. They’ll finish their own account setup.
                </p>

                <form onSubmit={invite} className="mt-5 space-y-3">
                  <input
                    required
                    value={invName}
                    onChange={(event) => setInvName(event.target.value)}
                    placeholder="Employee name"
                    className="w-full rounded-xl border border-black/10 px-3 py-3 outline-none focus:border-[#173b32]"
                  />
                  <input
                    required
                    type="email"
                    value={invEmail}
                    onChange={(event) => setInvEmail(event.target.value)}
                    placeholder="Work email"
                    className="w-full rounded-xl border border-black/10 px-3 py-3 outline-none focus:border-[#173b32]"
                  />
                  <button
                    disabled={busy || !offices.length}
                    className="w-full rounded-xl bg-[#173b32] py-3 text-sm font-semibold text-white transition hover:bg-[#123027] disabled:opacity-50"
                  >
                    {offices.length ? "Send invitation" : "Add an office first"}
                  </button>
                </form>
              </div>
            </div>
          </section>
        )}

        <section className="mt-8 rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#777]">History</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Your attendance</h2>
            </div>
            {manager && (
              <a
                href="/office-qr"
                className="text-sm font-semibold text-[#173b32] hover:underline"
              >
                Office QR →
              </a>
            )}
          </div>

          <div className="mt-5 divide-y divide-black/5">
            {recent.length ? (
              recent.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p className="font-medium">
                      {new Date(item.work_date + "T00:00:00").toLocaleDateString(
                        undefined,
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </p>
                    <p className="mt-1 text-xs text-[#777]">
                      {item.check_in_method} · {clock(item.check_in_at)} → {clock(item.check_out_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold capitalize">{item.status}</p>
                    <p className="mt-1 text-xs text-[#777]">
                      {duration(item.total_working_minutes)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-[#777]">
                No attendance records yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
