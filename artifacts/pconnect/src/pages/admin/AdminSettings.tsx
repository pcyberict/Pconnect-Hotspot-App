import { useEffect, useState } from "react";
import { useQuery, useMutation, api } from "@/lib/pconnect-api.ts";
import { toast } from "sonner";
import { Save, Globe, MessageCircle, Settings2, Wifi, KeyRound, Eye, EyeOff, Pencil, CheckCircle2, XCircle, ImagePlus, WalletCards, Mail, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatNaira } from "@/lib/plans.ts";

type SettingsForm = Record<string, string>;
const DEFAULTS: SettingsForm = {
  site_name: "PCYBER CONNECT", site_tagline: "Fast, reliable WiFi vouchers", hotspot_url: "",
  whatsapp_group_url: "https://chat.whatsapp.com/your-group-invite", whatsapp_support_number: "2340000000000",
  smtp_host: "", smtp_port: "587", smtp_username: "", smtp_from_email: "", smtp_from_name: "",
  support_email: "",
  site_logo: "", login_logo: "", footer_logo: "", community_banner: "", hero_banner: "",
  custom_header_code: "", custom_body_code: "", custom_footer_code: "",
};
const FALLBACKS: Record<string, string> = {
  site_logo: "https://hercules-cdn.com/file_PDusWTTXoxwuVrGaJFbrGp0y",
  login_logo: "https://hercules-cdn.com/file_1A2LMz3Ezgh2isR7FfmjJfGQ",
  footer_logo: "https://hercules-cdn.com/file_PDusWTTXoxwuVrGaJFbrGp0y",
  community_banner: "https://hercules-cdn.com/file_qfPEDBMPY2Zu03ym6A5vlo1C",
  hero_banner: "https://hercules-cdn.com/file_N4vw0dKasw7kaIkScQbfJFXL",
};

function Field({ label, hint, value, onChange, type = "text", placeholder }: { label: string; hint?: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <div><label className="mb-1 block text-sm font-medium text-white/80">{label}</label>{hint && <p className="mb-1.5 text-xs text-white/35">{hint}</p>}<input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-[#7519e9]" /></div>;
}

function CodeField({ label, hint, value, onChange, placeholder }: { label: string; hint: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div><label className="mb-1 block text-sm font-medium text-white/80">{label}</label><p className="mb-1.5 text-xs text-white/35">{hint}</p><textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} rows={8} className="w-full resize-y rounded-xl border border-white/10 bg-[#10051f]/70 px-4 py-3 font-mono text-xs leading-5 text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-[#7519e9]" /></div>;
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-[#1a0b30]/60 p-6"><div className="mb-5 flex items-center gap-2 border-b border-white/10 pb-4"><Icon size={16} className="text-purple-400" /><h2 className="font-semibold text-white">{title}</h2></div><div className="space-y-4">{children}</div></div>;
}

function FlutterwaveSecretField({ label, hint, dbKey, placeholder }: { label: string; hint: string; dbKey: string; placeholder: string }) {
  const masked = useQuery<string | null>(api.siteSettings.getMaskedSecret, { key: dbKey });
  const setSecret = useMutation(api.siteSettings.setSecret);
  const [editing, setEditing] = useState(false), [value, setValue] = useState(""), [showValue, setShowValue] = useState(false), [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!value.trim()) { toast.error("Value cannot be empty"); return; }
    setSaving(true);
    try { await setSecret({ key: dbKey, value: value.trim() }); toast.success(`${label} saved`); setValue(""); setEditing(false); setShowValue(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Error"); } finally { setSaving(false); }
  };
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="mb-2 flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><KeyRound size={14} className="shrink-0 text-purple-400" /><span className="text-sm font-medium text-white">{label}</span>{masked ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={12} /> Configured</span> : <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> Not set</span>}</div><p className="ml-5 mt-0.5 text-xs text-white/35">{hint}</p></div>{!editing && <Button variant="secondary" size="sm" className="shrink-0" onClick={() => setEditing(true)}><Pencil size={12} /> {masked ? "Update" : "Set"}</Button>}</div>{!editing && masked && <div className="ml-5 mt-2 flex items-center gap-2"><code className="font-mono text-sm tracking-wider text-purple-300">{showValue ? masked : masked.replace(/./g, "●")}</code><button onClick={() => setShowValue(v => !v)} className="cursor-pointer text-white/30 hover:text-white/60">{showValue ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>}{editing && <div className="ml-5 mt-2 space-y-2"><div className="relative"><input type={showValue ? "text" : "password"} value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} autoFocus className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 pr-10 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-[#7519e9]" /><button type="button" onClick={() => setShowValue(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-white/30">{showValue ? <EyeOff size={14} /> : <Eye size={14} />}</button></div><div className="flex gap-2"><Button variant="glossy" size="sm" disabled={saving || !value.trim()} onClick={() => void handleSave()}><Save size={12} /> {saving ? "Saving…" : "Save"}</Button><Button variant="secondary" size="sm" onClick={() => { setEditing(false); setValue(""); setShowValue(false); }}>Cancel</Button></div></div>}</div>;
}

function ImageField({ label, hint, value, fallback, onChange }: { label: string; hint: string; value: string; fallback: string; onChange: (value: string) => void }) {
  const [reading, setReading] = useState(false);
  const src = value || fallback;
  const choose = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Images must be 10MB or smaller"); return; }
    setReading(true);
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxDimension = 1280;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        toast.error("Could not process image");
      } else {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/webp", 0.78);
        if (!compressed.startsWith("data:image/webp;")) {
          toast.error("Your browser could not create a WebP image");
        } else {
          onChange(compressed);
          const compressedBytes = Math.round((compressed.length * 3) / 4);
          toast.success(`Compressed to WebP (${Math.max(1, Math.round(compressedBytes / 1024))} KB)`);
        }
      }
      URL.revokeObjectURL(objectUrl);
      setReading(false);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      toast.error("Could not read image");
      setReading(false);
    };
    image.src = objectUrl;
  };
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20"><img src={src} alt="" className="max-h-full max-w-full object-contain" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium text-white">{label}</p><p className="mt-1 text-xs text-white/40">{hint}</p><p className="mt-1 text-[11px] text-emerald-300/70">Uploads are automatically resized and compressed to WebP.</p><label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10">{reading ? "Compressing image…" : <><ImagePlus size={14} /> Upload image</>}<input type="file" accept="image/*" className="hidden" disabled={reading} onChange={e => choose(e.target.files?.[0])} /></label>{value && <button type="button" className="ml-3 text-xs text-red-300 hover:text-red-200" onClick={() => onChange("")}>Use default</button>}</div></div></div>;
}

type AdminUser = { _id: string; name?: string | null; email: string; walletBalance: number };

export default function AdminSettings() {
  const settings = useQuery<Record<string, string>>(api.siteSettings.getAll, {});
  const users = useQuery<AdminUser[]>(api.vouchers.listAllUsers, {});
  const setBulk = useMutation(api.siteSettings.setBulk);
  const manualFunding = useMutation(api.vouchers.manualFunding);
  const [form, setForm] = useState<SettingsForm>(DEFAULTS), [saving, setSaving] = useState(false), [tab, setTab] = useState<"general" | "payment" | "smtp" | "logos" | "funding" | "custom-code">("general");
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [funding, setFunding] = useState({ userId: "", amount: "" }), [fundingSaving, setFundingSaving] = useState(false);
  useEffect(() => {
    if (settings) {
      const editableSettings = Object.fromEntries(Object.entries(settings).filter(([key]) => key !== "footer_text"));
      setForm({ ...DEFAULTS, ...editableSettings });
    }
  }, [settings]);
  const set = (key: string) => (value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirtyKeys(prev => new Set(prev).add(key));
  };
  const handleSave = async () => {
    // Send the complete visible form instead of relying on dirtyKeys. This
    // keeps a save authoritative even if a settings query rehydrates the
    // form while the admin is editing.
    const settingsToSave = Object.entries(form)
      .filter(([key]) => key !== "footer_text")
      .map(([key, value]) => ({ key, value }));
    setSaving(true);
    try {
      await setBulk({ settings: settingsToSave });
      setDirtyKeys(new Set());
      toast.success("Settings saved successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error saving settings");
    } finally {
      setSaving(false);
    }
  };
  const submitFunding = async () => {
    const amount = Number(funding.amount);
    if (!funding.userId || !Number.isFinite(amount) || amount <= 0) { toast.error("Select a user and enter a valid amount"); return; }
    setFundingSaving(true);
    try { await manualFunding({ userId: funding.userId, amount }); toast.success("Wallet funded and user notified"); setFunding({ userId: "", amount: "" }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Manual funding failed"); } finally { setFundingSaving(false); }
  };
  if (settings === undefined) return <div><Skeleton className="mb-6 h-8 w-40" /><div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div></div>;
   const tabs = [{ id: "general", label: "General", icon: Settings2 }, { id: "payment", label: "Payment", icon: Globe }, { id: "smtp", label: "SMTP", icon: Mail }, { id: "logos", label: "Site logo", icon: ImagePlus }, { id: "custom-code", label: "Custom code", icon: Code2 }, { id: "funding", label: "Manual funding", icon: WalletCards }] as const;
   return <div><div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-white">Site Settings</h1><p className="mt-0.5 text-sm text-white/40">Configure your {form.site_name.trim() || "[Site Name]"} platform.</p></div>{tab === "logos" || tab === "general" || tab === "custom-code" ? <Button variant="glossy" size="sm" disabled={saving} onClick={() => void handleSave()}><Save size={14} /> {saving ? "Saving…" : "Save Changes"}</Button> : null}</div>
    <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${tab === id ? "bg-gradient-to-r from-[#7519e9] to-[#df20ba] text-white" : "text-white/50 hover:bg-white/5 hover:text-white"}`}><Icon size={15} />{label}</button>)}</div>
     {tab === "general" && <div className="space-y-5"><Section icon={Settings2} title="Branding"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Site Name" value={form.site_name} onChange={set("site_name")} placeholder="PCYBER CONNECT" /><Field label="Tagline" value={form.site_tagline} onChange={set("site_tagline")} placeholder="Fast, reliable WiFi vouchers" /></div><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">Footer credit is fixed and updates its year automatically.</div></Section><Section icon={Wifi} title="MikroTik Hotspot"><Field label="Hotspot Login URL" hint="The URL of your MikroTik hotspot login page." value={form.hotspot_url} onChange={set("hotspot_url")} placeholder="http://192.168.88.1/login" /><div className="rounded-lg border border-[#7519e9]/20 bg-[#7519e9]/5 px-4 py-3 text-xs text-white/50">Connect Now URL: <code className="text-purple-200">{form.hotspot_url ? `${form.hotspot_url.replace(/\/$/, "")}?username=VOUCHER_USERNAME` : "(not configured)"}</code></div></Section><Section icon={MessageCircle} title="WhatsApp & Support"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="WhatsApp Group Link" value={form.whatsapp_group_url} onChange={set("whatsapp_group_url")} placeholder="https://chat.whatsapp.com/..." /><Field label="WhatsApp Support Number" value={form.whatsapp_support_number} onChange={set("whatsapp_support_number")} placeholder="2348012345678" /></div><Field label="Support Email" value={form.support_email} onChange={set("support_email")} type="email" placeholder="support@pcyberict.com" /></Section></div>}
     {tab === "payment" && <Section icon={Globe} title="Payment"><p className="-mt-2 text-sm text-white/50">Flutterwave credentials are stored securely and never exposed in full.</p><FlutterwaveSecretField label="Public Key" hint="Used for the inline payment popup." dbKey="flutterwave_public_key" placeholder="FLWPUBK_TEST-…" /><FlutterwaveSecretField label="Secret Key" hint="Used for server-side verification." dbKey="flutterwave_secret_key" placeholder="FLWSECK_TEST-…" /><FlutterwaveSecretField label="Webhook Hash" hint="Your custom Flutterwave webhook secret." dbKey="flutterwave_webhook_hash" placeholder="my-secret-webhook-hash" /></Section>}
     {tab === "smtp" && <div className="space-y-5"><Section icon={Mail} title="SMTP email delivery"><p className="-mt-2 text-sm text-white/50">Configure the mailbox used to send registration verification codes and password reset links. The password is stored separately and never returned to the browser.</p><div className="grid gap-4 md:grid-cols-2"><Field label="SMTP host" value={form.smtp_host} onChange={set("smtp_host")} placeholder="smtp.example.com" /><Field label="SMTP port" value={form.smtp_port} onChange={set("smtp_port")} type="number" placeholder="587" /><Field label="Username" value={form.smtp_username} onChange={set("smtp_username")} placeholder="mailer@example.com" /><Field label="From email" value={form.smtp_from_email} onChange={set("smtp_from_email")} type="email" placeholder="no-reply@example.com" /><Field label="From name" value={form.smtp_from_name} onChange={set("smtp_from_name")} placeholder={form.site_name || "PCYBER CONNECT"} /></div><FlutterwaveSecretField label="SMTP password" hint="Password for the SMTP account. Use the app password if your provider requires one." dbKey="smtp_password" placeholder="SMTP account password" /></Section><div className="flex justify-end"><Button variant="glossy" disabled={saving} onClick={() => void handleSave()}><Save size={14} /> {saving ? "Saving…" : "Save SMTP settings"}</Button></div></div>}
    {tab === "logos" && <div className="space-y-5"><Section icon={ImagePlus} title="Site logo"><p className="-mt-2 text-sm text-white/50">Upload replacement images. Changes apply across the public pages after saving.</p><ImageField label="Site logo" hint="Header logo shown throughout the site." value={form.site_logo} fallback={FALLBACKS.site_logo} onChange={set("site_logo")} /><ImageField label="Login page logo" hint="Logo shown above the login and registration form." value={form.login_logo} fallback={FALLBACKS.login_logo} onChange={set("login_logo")} /><ImageField label="Footer logo" hint="Logo shown in the site footer." value={form.footer_logo} fallback={FALLBACKS.footer_logo} onChange={set("footer_logo")} /><ImageField label="Join our community banner" hint="Banner shown above the community call to action." value={form.community_banner} fallback={FALLBACKS.community_banner} onChange={set("community_banner")} /><ImageField label="Hero section banner" hint="Main background image on the homepage." value={form.hero_banner} fallback={FALLBACKS.hero_banner} onChange={set("hero_banner")} /></Section><div className="flex justify-end"><Button variant="glossy" disabled={saving} onClick={() => void handleSave()}><Save size={14} /> {saving ? "Saving…" : "Save image changes"}</Button></div></div>}
     {tab === "custom-code" && <div className="space-y-5"><Section icon={Code2} title="Custom code"><p className="-mt-2 text-sm text-white/50">Add trusted scripts or HTML that should load across the entire site. Changes apply after saving and affect public and admin pages.</p><div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-amber-100/70">Only add code from providers you trust. Analytics, AdSense, pixels, verification tags, and custom HTML are supported.</div><CodeField label="Header custom code" hint="Inserted inside the page head. Use this for verification meta tags, styles, or scripts that must load early." value={form.custom_header_code} onChange={set("custom_header_code")} placeholder={"<!-- Google Analytics or verification code -->"} /><CodeField label="Body custom code" hint="Inserted near the end of the page body before the footer custom code. Use this for body scripts or custom HTML." value={form.custom_body_code} onChange={set("custom_body_code")} placeholder={"<!-- Body custom code -->"} /><CodeField label="Footer custom code" hint="Inserted immediately before the closing body tag, after the body custom code." value={form.custom_footer_code} onChange={set("custom_footer_code")} placeholder={"<!-- AdSense or footer script -->"} /></Section><div className="flex justify-end"><Button variant="glossy" disabled={saving} onClick={() => void handleSave()}><Save size={14} /> {saving ? "Saving…" : "Save custom code"}</Button></div></div>}
    {tab === "funding" && <Section icon={WalletCards} title="Manual funding"><p className="-mt-2 text-sm text-white/50">Add funds directly to a user’s wallet. The balance updates immediately and the user receives a notification.</p><div className="grid gap-4 md:grid-cols-2"><div><label className="mb-1 block text-sm font-medium text-white/80">User</label><select value={funding.userId} onChange={e => setFunding(v => ({ ...v, userId: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#1a0b30] px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#7519e9]"><option value="">Select a user</option>{(users ?? []).map(user => <option key={user._id} value={user._id}>{user.name || user.email} — {formatNaira(user.walletBalance)}</option>)}</select></div><Field label="Amount (₦)" hint="Enter the amount to add to the user wallet." value={funding.amount} onChange={value => setFunding(v => ({ ...v, amount: value }))} type="number" placeholder="5000" /></div><div className="rounded-xl border border-[#7519e9]/20 bg-[#7519e9]/5 p-4 text-sm text-white/60">Notification reason: <strong className="text-white">{"{amount}"} Manual funding by admin</strong></div><Button variant="glossy" disabled={fundingSaving} onClick={() => void submitFunding()}><WalletCards size={15} /> {fundingSaving ? "Adding funds…" : "Add funds"}</Button></Section>}
  </div>;
}