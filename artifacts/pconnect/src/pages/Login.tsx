import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, User, Lock, Mail, Phone, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth.ts";
import SiteHeader from "@/components/site-header.tsx";
import SiteFooter from "@/components/site-footer.tsx";
import WhatsAppIcon from "@/components/whatsapp-icon.tsx";
import { useSiteName } from "@/lib/site-settings.ts";

const LOGO_URL = "https://hercules-cdn.com/file_1A2LMz3Ezgh2isR7FfmjJfGQ";
const BG_URL = "https://hercules-cdn.com/file_TQBDRwwJWEDIkSRlcLoUdqD1";
const WHATSAPP_URL = "https://chat.whatsapp.com/your-group-invite";

export default function Login() {
  const { login, register, isLoading } = useAuth();
  const siteName = useSiteName();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<"login" | "register">(
    searchParams.get("tab") === "register" ? "register" : "login"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const setField = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      if (tab === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.phone, form.password);
      navigate("/dashboard", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to continue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader />

      <div
        className="flex-1 flex items-center justify-center bg-cover bg-center bg-no-repeat relative py-12"
        style={{ backgroundImage: `url(${BG_URL})` }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#7519e9]/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[#df20ba]/15 blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-full max-w-md mx-4"
        >
          <div className="rounded-2xl border border-white/15 bg-black/55 backdrop-blur-2xl shadow-[0_8px_80px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] overflow-hidden">
            <div className="flex flex-col items-center pt-8 pb-4 px-8">
              <img
                src={LOGO_URL}
                alt="Pconnect"
                className="size-20 rounded-full object-contain mb-3 border-2 border-[#7519e9]/60 shadow-[0_0_24px_rgba(117,25,233,0.7),0_0_8px_rgba(255,255,255,0.15),0_4px_20px_rgba(0,0,0,0.6)]"
              />
              <div className="text-center">
                <h1 className="text-xl font-bold tracking-widest text-white">{siteName}</h1>
                <p className="text-white/50 text-xs mt-1">
                  Please log on to use the internet hotspot service
                </p>
              </div>
            </div>

            <div className="flex mx-8 mb-5 rounded-xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm">
              {(["login", "register"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-sm font-semibold tracking-wide transition-all cursor-pointer ${
                    tab === t
                      ? "bg-gradient-to-r from-[#7519e9] to-[#df20ba] text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {t === "login" ? "Login" : "Register"}
                </button>
              ))}
            </div>

            <div className="px-8 pb-8">
              <AnimatePresence mode="wait">
                {tab === "login" ? (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/40 px-4 py-3 focus-within:border-[#7519e9]/80 transition-all">
                      <User size={16} className="text-white/40 shrink-0" />
                      <input type="email" value={form.email} onChange={setField("email")} placeholder="Email Address" autoComplete="email" className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none" />
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/40 px-4 py-3 focus-within:border-[#7519e9]/80 transition-all">
                      <Lock size={16} className="text-white/40 shrink-0" />
                      <input type={showPassword ? "text" : "password"} value={form.password} onChange={setField("password")} placeholder="Password" autoComplete="current-password" className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none" />
                      <button onClick={() => setShowPassword(v => !v)} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <button onClick={() => void submit()} disabled={isLoading || submitting} className="w-full rounded-xl bg-gradient-to-r from-[#7519e9] to-[#df20ba] py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(117,25,233,0.4)] hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer mt-1">
                      {submitting ? (<span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Signing in…</span>) : "Login"}
                    </button>
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-xs text-white/30">OR</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-[#25d366]/30 bg-[#25d366]/5 backdrop-blur-sm px-4 py-3 text-sm text-white hover:bg-[#25d366]/20 transition-colors">
                      <WhatsAppIcon className="size-6 shrink-0" />
                      <span className="font-medium">Join WhatsApp Group</span>
                    </a>
                  </motion.div>
                ) : (
                  <motion.div
                    key="register"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/40 px-4 py-3 focus-within:border-[#7519e9]/80 transition-all">
                      <User size={16} className="text-white/40 shrink-0" />
                      <input type="text" value={form.name} onChange={setField("name")} placeholder="Full Name" autoComplete="name" className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none" />
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/40 px-4 py-3 focus-within:border-[#7519e9]/80 transition-all">
                      <Mail size={16} className="text-white/40 shrink-0" />
                      <input type="email" value={form.email} onChange={setField("email")} placeholder="Email Address" autoComplete="email" className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none" />
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/40 px-4 py-3 focus-within:border-[#7519e9]/80 transition-all">
                      <Phone size={16} className="text-white/40 shrink-0" />
                      <input type="tel" value={form.phone} onChange={setField("phone")} placeholder="Phone Number" autoComplete="tel" className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none" />
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/40 px-4 py-3 focus-within:border-[#7519e9]/80 transition-all">
                      <Lock size={16} className="text-white/40 shrink-0" />
                      <input type={showPassword ? "text" : "password"} value={form.password} onChange={setField("password")} placeholder="Password (6+ characters)" autoComplete="new-password" className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none" />
                      <button onClick={() => setShowPassword(v => !v)} className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <button onClick={() => void submit()} disabled={isLoading || submitting} className="w-full rounded-xl bg-gradient-to-r from-[#7519e9] to-[#df20ba] py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(117,25,233,0.4)] hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer mt-1">
                      {submitting ? (<span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Please wait…</span>) : "Create Account"}
                    </button>
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-xs text-white/30">OR</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-[#25d366]/30 bg-[#25d366]/5 backdrop-blur-sm px-4 py-3 text-sm text-white hover:bg-[#25d366]/20 transition-colors">
                      <WhatsAppIcon className="size-6 shrink-0" />
                      <span className="font-medium">Join WhatsApp Group</span>
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
              {error && <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-center text-xs text-red-200">{error}</p>}
            </div>

            <div className="border-t border-white/8 bg-white/3 py-4 text-center">
              <p className="text-xs text-white/20">© 2026 <a href="https://pcyberict.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 underline underline-offset-2">PCYBER ICT SERVICES</a>. All rights reserved.</p>
            </div>
          </div>
        </motion.div>
      </div>

      <SiteFooter />
    </div>
  );
}
