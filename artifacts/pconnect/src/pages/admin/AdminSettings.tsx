import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@/lib/pconnect-api.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Save, Globe, MessageCircle, Settings2, Wifi, KeyRound, Eye, EyeOff, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/pconnect-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

type SettingsForm = {
  site_name: string;
  site_tagline: string;
  hotspot_url: string;
  whatsapp_group_url: string;
  whatsapp_support_number: string;
  support_email: string;
  footer_text: string;
};

const DEFAULTS: SettingsForm = {
  site_name: "PCYBER CONNECT",
  site_tagline: "Fast, reliable WiFi vouchers",
  hotspot_url: "",
  whatsapp_group_url: "https://chat.whatsapp.com/your-group-invite",
  whatsapp_support_number: "2340000000000",
  support_email: "",
  footer_text: "© PCYBER ICT SERVICES. All rights reserved.",
};

function Field({ label, hint, value, onChange, type = "text", placeholder }: { label: string; hint?: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/80 mb-1">{label}</label>
      {hint && <p className="text-xs text-white/35 mb-1.5">{hint}</p>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-[#7519e9]" />
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1a0b30]/60 p-6">
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/10">
        <Icon size={16} className="text-purple-400" />
        <h2 className="font-semibold text-white">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function FlutterwaveSecretField({ label, hint, dbKey, placeholder }: { label: string; hint: string; dbKey: string; placeholder: string; }) {
  const masked = useQuery(api.siteSettings.getMaskedSecret, { key: dbKey });
  const setSecret = useMutation(api.siteSettings.setSecret);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) { toast.error("Value cannot be empty"); return; }
    setSaving(true);
    try {
      await setSecret({ key: dbKey, value: value.trim() });
      toast.success(`${label} saved`);
      setValue(""); setEditing(false); setShowValue(false);
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message?: string }).message : "Failed";
      toast.error(msg ?? "Error");
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound size={14} className="text-purple-400 shrink-0" />
            <span className="text-sm font-medium text-white">{label}</span>
            {masked !== undefined && (masked?.isSet
              ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={12} /> Configured</span>
              : <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> Not set</span>)}
          </div>
          <p className="text-xs text-white/35 mt-0.5 ml-5">{hint}</p>
        </div>
        {!editing && (
          <Button variant="secondary" size="sm" className="shrink-0" onClick={() => setEditing(true)}>
            <Pencil size={12} /> {masked?.isSet ? "Update" : "Set"}
          </Button>
        )}
      </div>
      {!editing && masked?.isSet && (
        <div className="ml-5 flex items-center gap-2 mt-2">
          <code className="text-sm text-purple-300 font-mono tracking-wider">{showValue ? masked.masked : masked.masked.replace(/./g, "●")}</code>
          <button onClick={() => setShowValue(v => !v)} className="cursor-pointer text-white/30 hover:text-white/60 transition-colors">
            {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      )}
      {editing && (
        <div className="ml-5 mt-2 space-y-2">
          <div className="relative">
            <input type={showValue ? "text" : "password"} value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} autoFocus className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 pr-10 text-sm text-white placeholder-white/20 font-mono focus:outline-none focus:ring-1 focus:ring-[#7519e9]" />
            <button type="button" onClick={() => setShowValue(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-white/30 hover:text-white/60">
              {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex gap-2">
            <Button variant="glossy" size="sm" disabled={saving || !value.trim()} onClick={() => void handleSave()}><Save size={12} /> {saving ? "Saving…" : "Save"}</Button>
            <Button variant="secondary" size="sm" onClick={() => { setEditing(false); setValue(""); setShowValue(false); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSettings() {
  const settings = useQuery(api.siteSettings.getAll, {});
  const setBulk = useMutation(api.siteSettings.setBulk);
  const [form, setForm] = useState<SettingsForm>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        site_name: settings.site_name ?? DEFAULTS.site_name,
        site_tagline: settings.site_tagline ?? DEFAULTS.site_tagline,
        hotspot_url: settings.hotspot_url ?? DEFAULTS.hotspot_url,
        whatsapp_group_url: settings.whatsapp_group_url ?? DEFAULTS.whatsapp_group_url,
        whatsapp_support_number: settings.whatsapp_support_number ?? DEFAULTS.whatsapp_support_number,
        support_email: settings.support_email ?? DEFAULTS.support_email,
        footer_text: settings.footer_text ?? DEFAULTS.footer_text,
      });
    }
  }, [settings]);

  const set = (key: keyof SettingsForm) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await setBulk({ settings: Object.entries(form).map(([key, value]) => ({ key, value })) });
      toast.success("Settings saved successfully");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message?: string }).message : "Failed";
      toast.error(msg ?? "Error saving settings");
    } finally { setSaving(false); }
  };

  if (settings === undefined) {
    return (
      <div>
        <Skeleton className="h-8 w-40 mb-6" />
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Site Settings</h1>
          <p className="text-sm text-white/40 mt-0.5">Configure your PCyber Connect platform.</p>
        </div>
        <Button variant="glossy" size="sm" disabled={saving} onClick={() => void handleSave()}><Save size={14} /> {saving ? "Saving…" : "Save Changes"}</Button>
      </div>
      <div className="space-y-5">
        <Section icon={Settings2} title="Branding">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Site Name" value={form.site_name} onChange={set("site_name")} placeholder="PCYBER CONNECT" />
            <Field label="Tagline" value={form.site_tagline} onChange={set("site_tagline")} placeholder="Fast, reliable WiFi vouchers" />
          </div>
          <Field label="Footer Text" value={form.footer_text} onChange={set("footer_text")} />
        </Section>
        <Section icon={Wifi} title="MikroTik Hotspot">
          <Field label="Hotspot Login URL" hint="The URL of your MikroTik hotspot login page." value={form.hotspot_url} onChange={set("hotspot_url")} placeholder="http://192.168.88.1/login" />
          <div className="rounded-lg border border-[#7519e9]/20 bg-[#7519e9]/5 px-4 py-3 text-xs text-white/50">
            Connect Now URL: <code className="text-purple-200">{form.hotspot_url ? `${form.hotspot_url.replace(/\/$/, "")}?username=VOUCHER_USERNAME` : "(not configured)"}</code>
          </div>
        </Section>
        <Section icon={MessageCircle} title="WhatsApp & Support">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="WhatsApp Group Link" hint="Used for Join Community buttons." value={form.whatsapp_group_url} onChange={set("whatsapp_group_url")} placeholder="https://chat.whatsapp.com/..." />
            <Field label="WhatsApp Support Number" hint="Full international number without + (e.g. 2348012345678)" value={form.whatsapp_support_number} onChange={set("whatsapp_support_number")} placeholder="2348012345678" />
          </div>
          <Field label="Support Email" value={form.support_email} onChange={set("support_email")} placeholder="support@pcyberict.com" type="email" />
        </Section>
        <Section icon={Globe} title="Flutterwave Payment Settings">
          <p className="text-sm text-white/50 -mt-2">Your Flutterwave credentials are stored securely in the database and never exposed in full.</p>
          <FlutterwaveSecretField label="Public Key" hint="Starts with FLWPUBK_ — used for the inline payment popup." dbKey="flutterwave_public_key" placeholder="FLWPUBK_TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X" />
          <FlutterwaveSecretField label="Secret Key" hint="Starts with FLWSECK_ — used for server-side verification." dbKey="flutterwave_secret_key" placeholder="FLWSECK_TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X" />
          <FlutterwaveSecretField label="Webhook Hash" hint="A custom secret string set in Flutterwave dashboard under Webhooks." dbKey="flutterwave_webhook_hash" placeholder="my-secret-webhook-hash" />
        </Section>
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="glossy" disabled={saving} onClick={() => void handleSave()}><Save size={14} /> {saving ? "Saving…" : "Save All Settings"}</Button>
      </div>
    </div>
  );
}
