import { useEffect, useState } from "react";
import { Save, UserPlus, Users, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { api, useMutation, useQuery } from "@/lib/pconnect-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatNaira } from "@/lib/plans.ts";

type Referral = {
  _id: string;
  referrerName?: string | null;
  referrerEmail: string;
  referredName?: string | null;
  referredEmail: string;
  firstDepositAmount?: number | null;
  commissionAmount?: number | null;
  status: "pending" | "credited" | "skipped";
  createdAt?: string;
};

type ReferralData = {
  settings: Record<string, string>;
  referrals: Referral[];
};

export default function AdminReferrals() {
  const data = useQuery<ReferralData>(api.referrals.getAdmin, {});
  const saveSettings = useMutation(api.siteSettings.setBulk);
  const [active, setActive] = useState(true);
  const [type, setType] = useState<"flat" | "percentage">("flat");
  const [value, setValue] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setActive(data.settings.referral_active !== "false");
    setType(data.settings.referral_commission_type === "percentage" ? "percentage" : "flat");
    setValue(data.settings.referral_commission_value || "0");
  }, [data]);

  const save = async () => {
    const amount = Number(value);
    const validMax = type === "percentage" ? 100 : 5000000;
    if (!Number.isFinite(amount) || amount < 0 || amount > validMax) {
      toast.error(type === "percentage" ? "Enter a percentage from 0 to 100" : "Enter a valid flat commission");
      return;
    }
    setSaving(true);
    try {
      await saveSettings({
        settings: [
          { key: "referral_active", value: String(active) },
          { key: "referral_commission_type", value: type },
          { key: "referral_commission_value", value: String(type === "percentage" ? amount : Math.round(amount)) },
        ],
      });
      toast.success(active ? "Referral programme settings saved" : "Referral programme deactivated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save referral settings");
    } finally {
      setSaving(false);
    }
  };

  if (!data) {
    return <div><Skeleton className="mb-6 h-8 w-48" /><Skeleton className="h-80 w-full rounded-2xl" /></div>;
  }

  const referrals = data.referrals ?? [];
  const credited = referrals.filter((item) => item.status === "credited");
  const totalPaid = credited.reduce((sum, item) => sum + Number(item.commissionAmount ?? 0), 0);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Referrals</h1>
        <p className="mt-1 text-sm text-white/40">Set the reward and track each referred user’s first wallet deposit.</p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total referrals", value: referrals.length, icon: Users },
          { label: "Credited referrals", value: credited.length, icon: UserPlus },
          { label: "Commissions paid", value: formatNaira(totalPaid), icon: WalletCards },
        ].map(({ label, value: statValue, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-[#1a0b30]/80 p-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-white/45"><span>{label}</span><Icon size={16} className="text-purple-300" /></div>
            <div className="mt-3 text-2xl font-bold text-white">{statValue}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#1a0b30]/60 p-5">
        <div className="mb-5 border-b border-white/10 pb-4">
          <h2 className="font-semibold text-white">Commission settings</h2>
          <p className="mt-1 text-sm leading-6 text-white/45">A referred user earns this reward only after their first successful deposit. Later deposits never create another commission.</p>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div>
            <div className="font-medium text-white">Referral programme status</div>
            <div className="mt-1 text-xs text-white/40">{active ? "New first deposits can earn commissions." : "No new referral commissions will be credited."}</div>
          </div>
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="size-5 accent-[#df20ba]" />
        </label>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="referral-commission-type" className="mb-2 block text-sm font-medium text-white/80">Commission type</label>
            <select id="referral-commission-type" value={type} onChange={(event) => setType(event.target.value as "flat" | "percentage")} className="w-full rounded-xl border border-white/10 bg-[#1a0b30] px-4 py-3 text-sm text-white outline-none focus:border-[#df20ba]/60">
              <option value="flat">Flat amount (₦)</option>
              <option value="percentage">Percentage of first deposit</option>
            </select>
          </div>
          <div>
            <label htmlFor="referral-commission-value" className="mb-2 block text-sm font-medium text-white/80">{type === "percentage" ? "Commission rate (%)" : "Commission amount (₦)"}</label>
            <input id="referral-commission-value" type="number" min="0" max={type === "percentage" ? 100 : 5000000} step={type === "percentage" ? "0.01" : "1"} value={value} onChange={(event) => setValue(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-semibold text-white outline-none focus:border-[#df20ba]/60" />
          </div>
        </div>
        <Button variant="glossy" className="mt-6 w-full sm:w-auto" disabled={saving} onClick={() => void save()}><Save size={15} /> {saving ? "Saving…" : "Save referral settings"}</Button>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#1a0b30]/60">
        <div className="border-b border-white/10 p-5"><h2 className="font-semibold text-white">Referral activity</h2></div>
        {referrals.length === 0 ? <p className="p-5 text-sm text-white/40">No referrals yet. Share a referral link to start tracking signups.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-white/10 text-left text-xs text-white/40"><th className="p-4 font-medium">Referrer</th><th className="p-4 font-medium">Referred user</th><th className="p-4 font-medium">First deposit</th><th className="p-4 font-medium">Commission</th><th className="p-4 font-medium">Status</th></tr></thead>
              <tbody className="divide-y divide-white/5">{referrals.map((item) => (
                <tr key={item._id} className="text-white/70">
                  <td className="p-4"><div className="font-medium text-white">{item.referrerName || "—"}</div><div className="text-xs text-white/35">{item.referrerEmail}</div></td>
                  <td className="p-4"><div className="font-medium text-white">{item.referredName || "—"}</div><div className="text-xs text-white/35">{item.referredEmail}</div></td>
                  <td className="p-4">{item.firstDepositAmount ? formatNaira(item.firstDepositAmount) : "Pending"}</td>
                  <td className="p-4 font-semibold text-emerald-400">{item.commissionAmount ? formatNaira(item.commissionAmount) : "—"}</td>
                  <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.status === "credited" ? "bg-emerald-500/15 text-emerald-300" : item.status === "skipped" ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"}`}>{item.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}