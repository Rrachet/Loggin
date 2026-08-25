"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6"><div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#173b32] font-bold text-white">L</div><h1 className="mt-6 text-2xl font-semibold">Something went wrong.</h1><p className="mt-3 text-sm leading-6 text-[#6b6b6b]">Loggin could not load this page. Try again, or return to sign in.</p><div className="mt-6 flex gap-3"><button onClick={reset} className="flex-1 rounded-xl bg-[#173b32] py-3 text-sm font-semibold text-white">Try again</button><a href="/" className="flex-1 rounded-xl border border-black/10 py-3 text-sm font-semibold">Sign in</a></div></div></main>;
}
