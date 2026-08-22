import { useState } from "react";
import { useQuery, useMutation } from "@/lib/pconnect-api.ts";
import { toast } from "sonner";
import {
  Plus, Pencil, Save, X, CheckCircle2, XCircle, Heart,
  Zap, Wifi, Shield, Star, Trash2, GripVertical,
} from "lucide-react";
import { api } from "@/lib/pconnect-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatNaira } from "@/lib/plans.ts";

type Id<T extends string> = string;

type DurationUnit = "hours" | "days" | "months";

const UNIT_TO_HOURS: Record<DurationUnit, number> = {
  hours: 1,
  days: 24,
  months: 720,
};

// Available icons for features
type IconKey = "check" | "x" | "heart" | "zap" | "wifi" | "shield" | "star";

const ICON_OPTIONS: { key: IconKey; label: string; component: React.ReactNode; color: string }[] = [
  { key: "check", label: "Check ✓", component: <CheckCircle2 size={14} />, color: "text-emerald-400" },
  { key: "x", label: "Cross ✗", component: <XCircle size={14} />, color: "text-red-400" },
  { key: "heart", label: "Heart ♥", component: <Heart size={14} />, color: "text-pink-400" },
  { key: "zap", label: "Zap ⚡", component: <Zap size={14} />, color: "text-yellow-400" },
  { key: "wifi", label: "WiFi", component: <Wifi size={14} />, color: "text-blue-400" },
  { key: "shield", label: "Shield", component: <Shield size={14} />, color: "text-purple-400" },
  { key: "star", label: "Star ★", component: <Star size={14} />, color: "text-amber-400" },
];

function FeatureIcon({ iconKey, size = 14 }: { iconKey: string; size?: number }) {
  switch (iconKey) {
    case "check": return <CheckCircle2 size={size} className="text-emerald-400 shrink-0" />;
    case "x": return <XCircle size={size} className="text-red-400 shrink-0" />;
    case "heart": return <Heart size={size} className="text-pink-400 shrink-0" />;
    case "zap": return <Zap size={size} className="text-yellow-400 shrink-0" />;
    case "wifi": return <Wifi size={size} className="text-blue-400 shrink-0" />;
    case "shield": return <Shield size={size} className="text-purple-400 shrink-0" />;
    case "star": return <Star size={size} className="text-amber-400 shrink-0" />;
    default: return <CheckCircle2 size={size} className="text-emerald-400 shrink-0" />;
  }
}

export { FeatureIcon };

type Feature = { icon: IconKey; text: string };

type PlanForm = {
  name: string;
  durationLabel: string;
  durationValue: number;
  durationUnit: DurationUnit;
  price: number;
  dataLimit: string;
  description: string;
  features: Feature[];
  popular: boolean;
  active: boolean;
  sortOrder: number;
};

const EMPTY_FORM: PlanForm = {
  name: "",
  durationLabel: "",
  durationValue: 1,
  durationUnit: "hours",
  price: 0,
  dataLimit: "",
  description: "",
  features: [{ icon: "check", text: "" }],
  popular: false,
  active: true,
  sortOrder: 0,
};

function toDurationHours(value: number, unit: DurationUnit): number {
  return value * UNIT_TO_HOURS[unit];
}

// Icon picker pill button
function IconPicker({ value, onChange }: { value: IconKey; onChange: (icon: IconKey) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ICON_OPTIONS.map(opt => (
        <button
          key={opt.key}
          type="button"
          title={opt.label}
          onClick={() => onChange(opt.key)}
          className={`cursor-pointer flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
            value === opt.key
              ? "border-[#7519e9] bg-[#7519e9]/25 text-white"
              : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/25 hover:text-white"
          }`}
        >
          <span className={opt.color}>{opt.component}</span>
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

// Single feature row with icon picker + text input + remove button
function FeatureRow({ feature, onChange, onRemove, showRemove }: {
  feature: Feature;
  onChange: (updated: Feature) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <GripVertical size={13} className="text-white/20 shrink-0" />
        <div className="flex-1 flex items-center gap-2">
          <div className={`shrink-0 ${ICON_OPTIONS.find(o => o.key === feature.icon)?.color ?? "text-white/40"}`}>
            <FeatureIcon iconKey={feature.icon} size={16} />
          </div>
          <input
            type="text"
            value={feature.text}
            onChange={e => onChange({ ...feature, text: e.target.value })}
            placeholder="e.g. High Speed, Full Access, 24/7 Support…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/25 focus:outline-none"
          />
        </div>
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="cursor-pointer shrink-0 rounded-lg p-1 text-white/25 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="pl-5">
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Choose icon</p>
        <IconPicker value={feature.icon} onChange={icon => onChange({ ...feature, icon })} />
      </div>
    </div>
  );
}

function PlanFormPanel({ initial, onSave, onCancel }: {
  initial: PlanForm;
  onSave: (form: PlanForm) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PlanForm>(initial);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof PlanForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const updateFeature = (idx: number, updated: Feature) => {
    setForm(prev => ({ ...prev, features: prev.features.map((f, i) => i === idx ? updated : f) }));
  };

  const removeFeature = (idx: number) => {
    setForm(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }));
  };

  const addFeature = () => {
    setForm(prev => ({ ...prev, features: [...prev.features, { icon: "check", text: "" }] }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.price) { toast.error("Name and price are required"); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        features: form.features.filter(f => f.text.trim() !== ""),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#7519e9]/30 bg-[#1a0b30] p-6 mb-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {([
          ["name", "Plan Name", "text", "e.g. 1 Hour"],
          ["durationLabel", "Duration Label", "text", "e.g. 1 Hour Access"],
          ["price", "Price (₦)", "number", "200"],
          ["dataLimit", "Data Limit (optional)", "text", "e.g. Unlimited"],
          ["description", "Description (optional)", "text", "Short description"],
          ["sortOrder", "Sort Order", "number", "1"],
        ] as const).map(([key, label, type, placeholder]) => (
          <div key={key}>
            <label className="block text-xs font-medium text-white/60 mb-1">{label}</label>
            <input
              type={type}
              value={String(form[key])}
              onChange={set(key)}
              placeholder={placeholder}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#7519e9]/50 transition-colors"
            />
          </div>
        ))}

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-white/60 mb-1">Duration</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={form.durationValue}
              onChange={e => setForm(prev => ({ ...prev, durationValue: Number(e.target.value) }))}
              className="w-24 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none"
            />
            <select
              value={form.durationUnit}
              onChange={e => setForm(prev => ({ ...prev, durationUnit: e.target.value as DurationUnit }))}
              className="flex-1 rounded-xl border border-white/10 bg-[#0e0620] px-3 py-2 text-sm text-white focus:outline-none cursor-pointer"
            >
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="months">Months</option>
            </select>
          </div>
          <p className="mt-1 text-xs text-white/30">
            = {toDurationHours(form.durationValue, form.durationUnit)} hours stored internally
          </p>
        </div>

        {/* Features editor */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-white/60">
              Plan Features
              <span className="ml-1.5 text-white/30 font-normal">— shown on plan card</span>
            </label>
            <span className="text-xs text-white/30">{form.features.filter(f => f.text.trim()).length} item{form.features.filter(f => f.text.trim()).length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {form.features.map((feature, idx) => (
              <FeatureRow
                key={idx}
                feature={feature}
                onChange={updated => updateFeature(idx, updated)}
                onRemove={() => removeFeature(idx)}
                showRemove={form.features.length > 1}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={addFeature}
            className="cursor-pointer mt-2 flex items-center gap-1.5 rounded-xl border border-dashed border-[#7519e9]/40 bg-[#7519e9]/5 px-4 py-2.5 text-xs font-medium text-purple-400 hover:border-[#7519e9]/70 hover:bg-[#7519e9]/10 transition-all w-full justify-center"
          >
            <Plus size={13} /> Add Feature
          </button>
          {/* Live preview */}
          {form.features.some(f => f.text.trim()) && (
            <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Preview on card</p>
              <ul className="space-y-1.5">
                {form.features.filter(f => f.text.trim()).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-white/70">
                    <FeatureIcon iconKey={f.icon} size={14} />
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-6 items-center sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input type="checkbox" checked={form.popular} onChange={set("popular")} className="cursor-pointer" />
            Popular
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={set("active")} className="cursor-pointer" />
            Active
          </label>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Button variant="glossy" size="sm" disabled={saving} onClick={() => void handleSubmit()}>
          <Save size={13} /> {saving ? "Saving…" : "Save Plan"}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          <X size={13} /> Cancel
        </Button>
      </div>
    </div>
  );
}

export default function AdminPlans() {
  const plans = useQuery(api.voucherPlans.listAllPlans, {});
  const createPlan = useMutation(api.voucherPlans.createPlan);
  const updatePlan = useMutation(api.voucherPlans.updatePlan);

  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<Id<"voucherPlans"> | null>(null);

  const handleCreate = async (form: PlanForm) => {
    try {
      await createPlan({
        name: form.name,
        durationLabel: form.durationLabel,
        durationHours: toDurationHours(form.durationValue, form.durationUnit),
        price: form.price,
        dataLimit: form.dataLimit || undefined,
        description: form.description || undefined,
        features: form.features.length > 0 ? form.features : undefined,
        popular: form.popular,
        active: form.active,
        sortOrder: form.sortOrder,
      });
      toast.success("Plan created");
      setShowCreate(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const handleUpdate = async (id: Id<"voucherPlans">, form: PlanForm) => {
    try {
      await updatePlan({
        id,
        name: form.name,
        durationLabel: form.durationLabel,
        durationHours: toDurationHours(form.durationValue, form.durationUnit),
        price: form.price,
        dataLimit: form.dataLimit || undefined,
        description: form.description || undefined,
        features: form.features.length > 0 ? form.features : undefined,
        popular: form.popular,
        active: form.active,
        sortOrder: form.sortOrder,
      });
      toast.success("Plan updated");
      setEditId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Voucher Plans</h1>
          <p className="text-sm text-white/40 mt-0.5">Manage the plans users can buy.</p>
        </div>
        <Button size="sm" variant="glossy" onClick={() => { setShowCreate(v => !v); setEditId(null); }}>
          <Plus size={13} /> New Plan
        </Button>
      </div>

      {showCreate && (
        <PlanFormPanel
          initial={{ ...EMPTY_FORM, sortOrder: (plans?.length ?? 0) + 1 }}
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {plans === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : plans.length === 0 ? (
        <p className="text-sm text-white/40">No plans yet. Create one above.</p>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan._id}>
              {editId === plan._id ? (
                <PlanFormPanel
                  initial={{
                    name: plan.name,
                    durationLabel: plan.durationLabel,
                    durationValue: plan.durationHours % 720 === 0 && plan.durationHours >= 720
                      ? plan.durationHours / 720
                      : plan.durationHours % 24 === 0 && plan.durationHours >= 24
                      ? plan.durationHours / 24
                      : plan.durationHours,
                    durationUnit: plan.durationHours % 720 === 0 && plan.durationHours >= 720
                      ? "months"
                      : plan.durationHours % 24 === 0 && plan.durationHours >= 24
                      ? "days"
                      : "hours",
                    price: plan.price,
                    dataLimit: plan.dataLimit ?? "",
                    description: plan.description ?? "",
                    features: (plan.features as Feature[] | undefined)?.length
                      ? (plan.features as Feature[])
                      : [{ icon: "check", text: "" }],
                    popular: plan.popular,
                    active: plan.active,
                    sortOrder: plan.sortOrder,
                  }}
                  onSave={(form) => handleUpdate(plan._id, form)}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#1a0b30]/80 px-5 py-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="min-w-0">
                      <div className="font-semibold text-white">{plan.name}</div>
                      <div className="text-xs text-white/40">{plan.durationLabel} · {formatNaira(plan.price)}</div>
                      {plan.features && plan.features.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {(plan.features as Feature[]).map((f, i) => (
                            <span key={i} className="flex items-center gap-1 text-xs text-white/40">
                              <FeatureIcon iconKey={f.icon} size={11} />
                              {f.text}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {plan.popular && <span className="rounded-full bg-[#df20ba]/15 px-2 py-0.5 text-xs text-pink-300">Popular</span>}
                      <span className={`rounded-full px-2 py-0.5 text-xs ${plan.active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {plan.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/40 shrink-0">
                    <span>{plan.availableCount} in stock</span>
                    <Button variant="secondary" size="sm" onClick={() => setEditId(plan._id)}>
                      <Pencil size={12} /> Edit
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
