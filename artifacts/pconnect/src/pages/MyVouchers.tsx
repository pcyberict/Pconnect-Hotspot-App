import { useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "@/lib/pconnect-api.ts";
import { Ticket, Copy, CheckCircle2, Wifi, ExternalLink, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/pconnect-api.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Link } from "react-router-dom";
import { formatNaira } from "@/lib/plans.ts";
import { useSiteName } from "@/lib/site-settings.ts";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty.tsx";

type VoucherPurchase = {
  _id: string;
  planName: string;
  durationLabel: string;
  amount: number;
  createdAt: string;
  status: string;
  voucher: { username: string; password: string } | null;
  reference: string;
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success(`${label} copied!`);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/15 hover:text-white cursor-pointer"
    >
      {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function VoucherCard({ p, hotspotUrl }: {
  p: {
    _id: string;
    planName: string;
    durationLabel: string;
    amount: number;
    createdAt: string;
    status: string;
    voucher: { username: string; password: string } | null;
    reference: string;
  };
  hotspotUrl: string | null;
}) {
  const [revealed, setRevealed] = useState(false);
  const siteName = useSiteName();

  const copyAll = () => {
    if (!p.voucher) return;
    const text = `${siteName} Voucher\nPlan: ${p.planName}\nUsername: ${p.voucher.username}\nPassword: ${p.voucher.password}\nDate: ${new Date(p.createdAt).toLocaleString()}`;
    void navigator.clipboard.writeText(text).then(() => toast.success("All details copied!"));
  };

  const connectUrl = hotspotUrl
    ? `${hotspotUrl.replace(/\/$/, "")}${p.voucher ? `?username=${encodeURIComponent(p.voucher.username)}` : ""}`
    : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a0b30] to-[#0e0620] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#7519e9]/20">
            <Wifi size={16} className="text-purple-400" />
          </div>
          <div>
            <div className="font-bold text-white">{p.planName}</div>
            <div className="text-xs text-white/40">{p.durationLabel}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-white">{formatNaira(p.amount)}</div>
          <div className="text-xs text-white/30">{new Date(p.createdAt).toLocaleString()}</div>
        </div>
      </div>

      <div className="mb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          <CheckCircle2 size={10} /> {p.status}
        </span>
      </div>

      {p.voucher && (
        <>
          {!revealed && (
            <button
              onClick={() => setRevealed(true)}
              className="w-full rounded-xl border border-[#7519e9]/30 bg-[#7519e9]/10 py-2.5 text-sm font-medium text-purple-300 transition-colors hover:bg-[#7519e9]/20 cursor-pointer"
            >
              Tap to reveal credentials
            </button>
          )}

          {revealed && (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-0.5">Username</div>
                    <div className="font-mono text-base font-bold text-purple-300 truncate">{p.voucher.username}</div>
                  </div>
                  <CopyButton text={p.voucher.username} label="Username" />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-0.5">Password</div>
                    <div className="font-mono text-base font-bold text-pink-300 truncate">{p.voucher.password}</div>
                  </div>
                  <CopyButton text={p.voucher.password} label="Password" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {connectUrl && (
                  <a
                    href={connectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7519e9] to-[#df20ba] px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(117,25,233,0.3)] hover:opacity-90 transition-opacity"
                  >
                    <ExternalLink size={14} /> Connect Now
                  </a>
                )}
                <button
                  onClick={copyAll}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  <Copy size={13} /> Copy All Details
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MyVouchersInner() {
  const purchases = useQuery<VoucherPurchase[]>(api.vouchers.getMyPurchases, {});
  const hotspotUrl = useQuery(api.siteSettings.get, { key: "hotspot_url" });

  if (purchases === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-9 w-48 mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">My Vouchers</h1>
        <Button asChild variant="glossy" size="sm">
          <Link to="/plans"><ShoppingCart size={14} /> Buy More</Link>
        </Button>
      </div>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">Your purchased vouchers and credentials.</p>

      {purchases.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Ticket /></EmptyMedia>
            <EmptyTitle>No vouchers yet</EmptyTitle>
            <EmptyDescription>Purchase a voucher plan to see your credentials here.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="glossy" size="sm">
              <Link to="/plans">Browse Plans</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {purchases.map((p) => (
            <VoucherCard key={p._id} p={{ ...p, _id: p._id }} hotspotUrl={hotspotUrl ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyVouchersPage() {
  return (
    <>
      <Authenticated><MyVouchersInner /></Authenticated>
      <Unauthenticated>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-bold">Sign in to view your vouchers</h1>
          <Button asChild variant="glossy"><Link to="/login">Sign In / Register</Link></Button>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Skeleton className="h-9 w-48 mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 w-full" />)}
          </div>
        </div>
      </AuthLoading>
    </>
  );
}
