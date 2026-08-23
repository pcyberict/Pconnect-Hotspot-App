import { useEffect, useState } from "react";
import { Gift, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, useMutation, useQuery } from "@/lib/pconnect-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export default function AdminBonus() {
  const settings = useQuery<Record<string, string>>(api.siteSettings.getAll, {});
  const setBulk = useMutation(api.siteSettings.setBulk);
  const [active, setActive] = useState(false);
  const [amount, setAmount] = useState("200");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setActive(settings.welcome_bonus_active === "true");
    setAmount(settings.welcome_bonus_amount || "200");
  }, [settings]);

  const save = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      toast.error("Enter a valid bonus amount");
      return;
    }
    setSaving(true);
    try {
      await setBulk({
        settings: [
          { key: "welcome_bonus_active", value: String(active) },
          { key: "welcome_bonus_amount", value: String(Math.round(numericAmount)) },
        ],
      });
      toast.success(active ? "Welcome bonus is now active" : "Welcome bonus is turned off");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save welcome bonus");
    } finally {
      setSaving(false);
    }
  };

  if (settings === undefined) {
    return <div><Skeleton className="mb-6 h-8 w-48" /><Skeleton className="h-72 w-full rounded-2xl" /></div>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-[#df20ba]/20 text-pink-300">
          <Gift size={21} />
        </div>
        <h1 className="text-2xl font-bold text-white">Welcome Bonus</h1>
        <p className="mt-1 text-sm text-white/40">Give new users a little head start when they create an account.</p>
      </div>

      <div className="rounded-2xl border border-[#df20ba]/25 bg-gradient-to-br from-[#1a0b30]/90 to-[#160622]/90 p-6 shadow-[0_0_45px_rgba(223,32,186,0.08)]">
        <div className="mb-6 flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#7519e9]/20 text-purple-300"><Sparkles size={18} /></div>
          <div>
            <h2 className="font-semibold text-white">A warm welcome</h2>
            <p className="mt-1 text-sm leading-6 text-white/45">When active, verified signups receive this amount in their wallet, an in-app notification, and a short welcome email.</p>
          </div>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div>
            <div className="font-medium text-white">Welcome bonus status</div>
            <div className="mt-1 text-xs text-white/40">{active ? "New verified users will receive the bonus." : "No bonus will be credited to new users."}</div>
          </div>
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="size-5 accent-[#df20ba]"
          />
        </label>

        <div className="mt-5">
          <label htmlFor="welcome-bonus-amount" className="mb-2 block text-sm font-medium text-white/80">Bonus amount (₦)</label>
          <input
            id="welcome-bonus-amount"
            type="number"
            min="0"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-semibold text-white outline-none focus:border-[#df20ba]/60 focus:ring-1 focus:ring-[#df20ba]/40"
          />
          <p className="mt-2 text-xs text-white/35">This is credited once, after the user verifies their email.</p>
        </div>

        <Button variant="glossy" className="mt-6 w-full sm:w-auto" disabled={saving} onClick={() => void save()}>
          <Save size={15} /> {saving ? "Saving…" : "Save bonus settings"}
        </Button>
      </div>
    </div>
  );
}