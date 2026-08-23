import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Loader2 } from "lucide-react";
import SiteHeader from "@/components/site-header.tsx";
import SiteFooter from "@/components/site-footer.tsx";

export default function ForgotPassword() {
  const [email, setEmail] = useState(""), [status, setStatus] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError(""); setStatus("");
    try { const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setStatus(data.message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to send reset link"); } finally { setLoading(false); }
  };
  return <div className="flex min-h-screen flex-col"><SiteHeader /><main className="flex flex-1 items-center justify-center bg-[#0a0316] px-5 py-16"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-8"><h1 className="text-2xl font-bold text-white">Forgot password?</h1><p className="mt-2 text-sm leading-6 text-white/50">Enter your account email and we’ll send a secure password reset link.</p><div className="mt-6 flex items-center gap-3 rounded-xl border border-white/15 bg-black/40 px-4 py-3"><Mail size={16} className="text-white/40" /><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="flex-1 bg-transparent text-sm text-white outline-none placeholder-white/30" /></div><button disabled={loading} className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#7519e9] to-[#df20ba] py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? <span className="flex justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Sending…</span> : "Send reset link"}</button>{status && <p className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-center text-xs text-emerald-200">{status}</p>}{error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-center text-xs text-red-200">{error}</p>}<Link to="/login" className="mt-6 block text-center text-sm text-purple-300 hover:text-purple-200">Back to login</Link></form></main><SiteFooter /></div>;
}