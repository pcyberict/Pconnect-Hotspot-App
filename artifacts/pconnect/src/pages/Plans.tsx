import { useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading, useQuery, useMutation } from "@/lib/pconnect-api.ts";
import { toast } from "sonner";
import { Wifi, Crown, Zap, CheckCircle2, Copy, ExternalLink, ShoppingCart } from "lucide-react";
import { api } from "@/lib/pconnect-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog.tsx";
import { formatNaira } from "@/lib/plans.ts";
import { FeatureIcon } from "@/pages/admin/AdminPlans.tsx";
import { useSiteName } from "@/lib/site-settings.ts";
import { getRegistrationUrl } from "@/lib/auth-redirect.ts";

type Id<T extends string> = string;
type PlanFeature = { icon: string; text: string };

type Plan = {
  _id: Id<"voucherPlans">;
  name: string;
  durationLabel: string;
  price: number;
  popular: boolean;
  availableCount: number;
  description?: string;
  features?: PlanFeature[] | null;
};

type PurchaseResult = {
  purchaseId: Id<"purchases">;
  username: string;
  password: string;
  planName: string;
  amount: number;
};

const PLAN_ICONS = [Zap, Wifi, Crown, Wifi, Zap, Wifi];

function VaultDialog({ result, hotspotUrl, onClose }: {
  result: PurchaseResult;
  hotspotUrl: string | null;
  onClose: () => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const siteName = useSiteName();

  const copy = (text: string, field: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      toast.success(`${field} copied!`);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const copyAll = () => {
    const text = `${siteName} Voucher\nPlan: ${result.planName}\nUsername: ${result.username}\nPassword: ${result.password}`;
    copy(text, "All details");
  };

  const connectUrl = hotspotUrl
    ? `${hotspotUrl.replace(/\/$/, "")}?username=${encodeURIComponent(result.username)}`
    : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="border-[#7519e9]/40 bg-[#100520] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="text-emerald-400 size-5" />
            Voucher Purchased!
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Your <span className="text-purple-300 font-medium">{result.planName}</span> voucher credentials are below.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-0.5">Username</div>
                <div className="font-mono text-xl font-bold text-purple-300">{result.username}</div>
              </div>
              <button
                onClick={() => copy(result.username, "Username")}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                {copiedField === "Username" ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copiedField === "Username" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-0.5">Password</div>
                <div className="font-mono text-xl font-bold text-pink-300">{result.password}</div>
              </div>
              <button
                onClick={() => copy(result.password, "Password")}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                {copiedField === "Password" ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copiedField === "Password" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-white/30">Amount deducted: {formatNaira(result.amount)}</p>

          <div className="flex gap-2 pt-1">
            {connectUrl ? (
              <a
                href={connectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7519e9] to-[#df20ba] py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(117,25,233,0.3)] hover:opacity-90 transition-opacity"
              >
                <ExternalLink size={14} /> Connect Now
              </a>
            ) : (
              <button
                onClick={copyAll}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7519e9] to-[#df20ba] py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Copy size={14} /> Copy All Details
              </button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose} asChild>
              <Link to="/my-vouchers" className="flex-1 flex items-center justify-center gap-1">
                <ShoppingCart size={13} /> My Vouchers
              </Link>
            </Button>
          </div>

          {connectUrl && (
            <button
              onClick={copyAll}
              className="w-full text-center text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer underline underline-offset-2"
            >
              Copy all details to clipboard
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlansInner() {
  const plans = useQuery(api.voucherPlans.listActivePlans, {});
  const wallet = useQuery(api.wallets.getMyWallet, {});
  const hotspotUrl = useQuery(api.siteSettings.get, { key: "hotspot_url" });
  const purchaseVoucher = useMutation(api.vouchers.purchaseVoucher);
  const [buying, setBuying] = useState<Id<"voucherPlans"> | null>(null);
  const [result, setResult] = useState<PurchaseResult | null>(null);

  const handleBuy = async (planId: Id<"voucherPlans">) => {
    setBuying(planId);
    try {
      const res = await purchaseVoucher({ planId });
      setResult(res);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Purchase failed. Please try again.");
    } finally {
      setBuying(null);
    }
  };

  if (plans === undefined || wallet === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-72 mb-10" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#7519e9]/25 bg-[#1a0b30]/60 px-5 py-4">
        <div>
          <div className="text-xs text-white/40 mb-0.5">Wallet Balance</div>
          <div className="text-2xl font-extrabold text-white">{formatNaira(wallet?.balance ?? 0)}</div>
        </div>
        <Button asChild variant="glossy" size="sm">
          <Link to="/wallet">Fund Wallet</Link>
        </Button>
      </div>

       <h1 className="text-3xl font-extrabold text-white">
         Voucher <span className="bg-gradient-to-r from-[#7519e9] to-[#df20ba] bg-clip-text text-transparent">Plans</span>
       </h1>
      <p className="mt-2 mb-8 text-sm text-white/50">Choose a plan and buy instantly from your wallet balance.</p>

      {plans.length === 0 ? (
        <div className="mt-12 text-center text-white/40">No plans available at the moment.</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(plans as Plan[]).map((plan, i) => {
            const Icon = PLAN_ICONS[i % PLAN_ICONS.length];
            const canAfford = (wallet?.balance ?? 0) >= plan.price;
            return (
              <div
                key={plan._id}
                className={plan.popular
                  ? "relative flex flex-col rounded-2xl border border-[#df20ba]/50 bg-gradient-to-br from-[#7519e9]/35 to-[#df20ba]/20 p-6 shadow-[0_0_30px_rgba(223,32,186,0.2)]"
                  : "relative flex flex-col rounded-2xl border border-[#7519e9]/25 bg-[#23103e]/60 p-6"}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#7519e9] to-[#ff2549] px-4 py-1 text-xs font-bold text-white">
                    Most Popular
                  </div>
                )}
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-white">{plan.name}</div>
                    <div className="text-xs text-white/50">{plan.durationLabel}</div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7519e9]/20">
                    <Icon size={18} className="text-purple-400" />
                  </div>
                </div>
                <div className="mb-2 text-3xl font-extrabold text-white">{formatNaira(plan.price)}</div>
                {plan.description && <p className="mb-3 text-xs text-white/50">{plan.description}</p>}
                {plan.features && plan.features.length > 0 && (
                  <ul className="mb-4 space-y-2 text-sm text-white/70">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={`${feature.text}-${featureIndex}`} className="flex items-center gap-2">
                        <FeatureIcon iconKey={feature.icon} size={15} />
                        <span>{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-auto space-y-3 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className={plan.availableCount > 0 ? "text-emerald-400" : "text-red-400"}>
                      {plan.availableCount > 0 ? `${plan.availableCount} in stock` : "Out of stock"}
                    </span>
                    {!canAfford && plan.availableCount > 0 && (
                      <span className="text-amber-400">Insufficient balance</span>
                    )}
                  </div>
                  <Button
                    variant={plan.popular ? "glossy" : "secondary"}
                    className="w-full font-bold"
                    disabled={buying === plan._id || plan.availableCount === 0 || !canAfford}
                    onClick={() => void handleBuy(plan._id)}
                  >
                    {buying === plan._id ? "Processing…" : plan.availableCount === 0 ? "Out of Stock" : !canAfford ? "Fund Wallet First" : "Buy Now"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {result && (
        <VaultDialog
          result={result}
          hotspotUrl={hotspotUrl ?? null}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
}

export default function PlansPage() {
  const location = useLocation();
  const registrationUrl = getRegistrationUrl(`${location.pathname}${location.search}${location.hash}`);

  return (
    <>
      <Authenticated><PlansInner /></Authenticated>
      <Unauthenticated>
        <Navigate to={registrationUrl} replace />
      </Unauthenticated>
      <AuthLoading>
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Skeleton className="h-9 w-48 mb-10" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
        </div>
      </AuthLoading>
    </>
  );
}
