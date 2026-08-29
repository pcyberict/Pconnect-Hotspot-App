import { useState, useEffect, useCallback } from "react";
import { Authenticated, Unauthenticated, AuthLoading, useQuery, useMutation, useAction } from "@/lib/pconnect-api.ts";
import { toast } from "sonner";
import {
  Wallet, ArrowDownCircle, Clock, CheckCircle2, AlertCircle,
  Eye, EyeOff, Building2, CreditCard, Copy, Zap, ChevronDown,
} from "lucide-react";
import { motion } from "motion/react";
import { api } from "@/lib/pconnect-api.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Link, Navigate, useLocation } from "react-router-dom";
import { formatNaira } from "@/lib/plans.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import { useSiteAsset, useSiteName } from "@/lib/site-settings.ts";
import { getRegistrationUrl } from "@/lib/auth-redirect.ts";

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

declare global {
  interface Window {
    FlutterwaveCheckout: (config: FlutterwaveConfig) => { close: () => void };
  }
}

type FlutterwaveConfig = {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  customer: { email: string; name: string };
  customizations: { title: string; description: string; logo?: string };
  callback: (response: { status: string; transaction_id: number; tx_ref: string }) => void;
  onclose: () => void;
};

type PaymentMethod = "card" | null;

type WalletTransaction = {
  _id: string;
  status: "successful" | "pending" | string;
  type: string;
  paymentChannel?: string;
  createdAt: string;
  amount: number;
};

type VirtualAccount = {
  accountNumber: string;
  bankName: string;
  accountName: string;
  expiresAt: string;
  orderRef?: string;
};

type WalletData = { balance: number; virtualAccount?: VirtualAccount | null };

function useFlutterwaveScript() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if ("FlutterwaveCheckout" in window) { setLoaded(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.async = true;
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);
    return () => { try { document.body.removeChild(script); } catch { /* ignore */ } };
  }, []);
  return loaded;
}

function AccountRow({ label, value, onCopy, highlight }: { label: string; value: string; onCopy?: () => void; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-start gap-2 px-5 py-4">
      <span className="text-xs text-white/40 shrink-0 uppercase tracking-wider">{label}</span>
      <div className="flex w-full min-w-0 items-center gap-2">
        <span className={`${highlight ? "break-all whitespace-normal text-white text-xl font-extrabold tracking-widest" : "break-words text-sm font-semibold text-white/80"}`}>{value}</span>
        {onCopy && (
          <button onClick={onCopy} className="cursor-pointer shrink-0 rounded-lg p-1.5 bg-white/5 hover:bg-[#7519e9]/30 text-white/30 hover:text-purple-300 transition-all">
            <Copy size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function WalletInner() {
  const wallet = useQuery<WalletData | null>(api.wallets.getMyWallet, {});
  const generateVirtualAccount = useMutation(api.wallets.generateVirtualAccount);
  const depositHistory = useQuery<WalletTransaction[]>(api.wallet.deposits.getMyDepositHistory, {});
  const publicKey = useQuery(api.siteSettings.getPublicKey, {});
  const createPending = useMutation(api.wallet.deposits.createPendingDeposit);
  const verifyDeposit = useAction(api.wallet.deposits.verifyDepositById);
  const { user } = useAuth();
  const siteName = useSiteName();
  const siteLogo = useSiteAsset("site_logo", "/images/site-logo.webp");
  const scriptLoaded = useFlutterwaveScript();

  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [preparingCard, setPreparingCard] = useState(false);
  const [showAccountSetup, setShowAccountSetup] = useState(false);
  const [identityType, setIdentityType] = useState<"bvn" | "nin">("bvn");
  const [identityNumber, setIdentityNumber] = useState("");

  const parsedAmount = parseFloat(amount);
  const validAmount = !isNaN(parsedAmount) && parsedAmount >= 100;

  const statusColor = (status: string) => {
    if (status === "successful") return "text-emerald-400";
    if (status === "pending") return "text-amber-400";
    return "text-red-400";
  };

  const handleSelectMethod = (method: PaymentMethod) => {
    if (!validAmount) { toast.error("Enter a valid amount (minimum ₦100) first"); return; }
    setPaymentMethod(method);
  };

  const handleStartCard = useCallback(async () => {
    if (!validAmount) return;
    if (!publicKey) { toast.error("Flutterwave not configured yet. Contact admin."); return; }
    if (!scriptLoaded) { toast.error("Payment widget still loading. Try again."); return; }
    setPreparingCard(true);
    const reference = `pcc-${globalThis.crypto.randomUUID()}`;
    window.FlutterwaveCheckout({
      public_key: publicKey,
      tx_ref: reference,
      amount: parsedAmount,
      currency: "NGN",
      customer: { email: user?.profile.email ?? "customer@pcyberict.com", name: user?.profile.name ?? `${siteName} Customer` },
      customizations: { title: siteName, description: "Wallet Funding", logo: siteLogo },
      callback: (response) => {
        if (response.status === "successful") {
          toast.loading("Verifying payment…", { id: "verify" });
          void createPending({ amount: parsedAmount, reference: response.tx_ref || reference })
            .then((pending) => verifyDeposit({ reference: pending.reference, providerTransactionId: String(response.transaction_id) }))
            .then((res) => {
              if (res.status === "successful") {
                toast.success("Wallet funded successfully!", { id: "verify" });
                setAmount(""); setPaymentMethod(null);
              } else {
                toast.error("Payment received but verification failed. Contact support.", { id: "verify" });
              }
            })
            .catch(() => toast.error("Verification error. Contact support if amount was deducted.", { id: "verify" }));
        } else {
          toast.info("Payment was not completed. No wallet funding was recorded.");
        }
        setPreparingCard(false);
      },
      onclose: () => { setPreparingCard(false); },
    });
  }, [amount, publicKey, scriptLoaded, createPending, verifyDeposit, user, parsedAmount, validAmount]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">My Wallet</h1>
        <p className="mt-1 text-sm text-white/40">Top up your balance and pay for vouchers instantly.</p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-[#7519e9]/40 bg-gradient-to-br from-[#7519e9]/40 via-[#b20ed2]/25 to-[#ff2549]/20 p-7 backdrop-blur-xl shadow-[0_0_60px_rgba(117,25,233,0.2)]">
        <div className="pointer-events-none absolute -top-10 -right-10 size-48 rounded-full bg-[#df20ba]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 size-40 rounded-full bg-[#7519e9]/20 blur-3xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-white/50 mb-3">
              <div className="flex size-7 items-center justify-center rounded-lg bg-white/10">
                <Wallet size={14} className="text-purple-300" />
              </div>
              Current Balance
            </div>
            {wallet === undefined ? (
              <Skeleton className="h-12 w-44" />
            ) : (
              <div className="text-5xl font-extrabold text-white tracking-tight drop-shadow">
                {balanceHidden ? <span className="tracking-[0.15em]">₦ ••••••</span> : formatNaira(wallet?.balance ?? 0)}
              </div>
            )}
            <p className="mt-2 text-xs text-white/30">Available for voucher purchases</p>
          </div>
          <button
            onClick={() => setBalanceHidden(v => !v)}
            className="cursor-pointer mt-1 rounded-xl p-2.5 bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-all"
            title={balanceHidden ? "Show balance" : "Hide balance"}
          >
            {balanceHidden ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
        <div className="relative mt-6 pt-5 border-t border-white/10 flex items-center gap-2">
          <Zap size={13} className="text-yellow-400" />
          <span className="text-xs text-white/40">Instant credit · Secure payments · Powered by Flutterwave</span>
        </div>
      </div>

      {wallet?.virtualAccount?.accountNumber ? (
        <div className="mt-5 rounded-3xl border border-[#7519e9]/25 bg-[#23103e]/60 p-6">
          <div className="flex items-center gap-3"><Building2 size={18} className="text-purple-300" /><div><h2 className="font-bold text-white">Your permanent bank account</h2><p className="text-xs text-white/40">Transfer funds here and your wallet updates automatically.</p></div></div>
          <div className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/15">
            <AccountRow label="Bank Name" value={wallet.virtualAccount.bankName} />
            <AccountRow label="Account Number" value={wallet.virtualAccount.accountNumber} highlight onCopy={() => { void navigator.clipboard.writeText(wallet.virtualAccount!.accountNumber); toast.success("Account number copied"); }} />
            <AccountRow label="Account Name" value={wallet.virtualAccount.accountName} />
          </div>
          <p className="mt-3 text-xs text-white/35">Payments are confirmed by Flutterwave and credited to your wallet automatically.</p>
        </div>
      ) : (
        <div className="mt-5 rounded-3xl border border-[#7519e9]/25 bg-[#23103e]/60 p-6">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Building2 size={18} className="text-purple-300" /><div><h2 className="font-bold text-white">Get your permanent bank account</h2><p className="text-xs text-white/40">Generate bank details for easy wallet funding.</p></div></div><Button variant="secondary" onClick={() => setShowAccountSetup(value => !value)}><Building2 size={14} /> Generate</Button></div>
          {showAccountSetup && (
            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[140px_minmax(0,1fr)_auto]">
              <div className="relative min-w-0">
                <select
                  aria-label="Identity document type"
                  value={identityType}
                  onChange={event => setIdentityType(event.target.value as "bvn" | "nin")}
                  className="h-12 w-full min-w-0 appearance-none rounded-2xl border border-[#7519e9]/40 bg-[#23103e] px-4 pr-11 text-sm text-white outline-none focus:border-[#7519e9]/60 [color-scheme:dark]"
                >
                  <option className="bg-[#23103e] text-white" value="bvn">BVN</option>
                  <option className="bg-[#23103e] text-white" value="nin">NIN</option>
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-purple-300"
                />
              </div>
              <input
                aria-label={`${identityType.toUpperCase()} number`}
                inputMode="numeric"
                maxLength={11}
                value={identityNumber}
                onChange={event => setIdentityNumber(event.target.value.replace(/\D/g, ""))}
                placeholder={`11-digit ${identityType.toUpperCase()}`}
                className="h-12 w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-[#7519e9]/60 focus:ring-1 focus:ring-[#7519e9]/40"
              />
              <Button
                variant="glossy"
                className="h-12 w-full px-5 sm:w-auto"
                disabled={identityNumber.length !== 11}
                onClick={() => void generateVirtualAccount({ identityType, identityNumber })}
              >
                Create account
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 relative overflow-hidden rounded-3xl border border-[#7519e9]/25 bg-gradient-to-br from-[#1a0b30]/90 via-[#150925]/90 to-[#0e0620]/90 backdrop-blur-xl shadow-[0_0_40px_rgba(117,25,233,0.08)]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#7519e9]/60 to-transparent" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7519e9]/30 to-[#df20ba]/20 border border-[#7519e9]/30">
              <ArrowDownCircle size={16} className="text-purple-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Fund Wallet</h2>
              <p className="text-xs text-white/40">Choose an amount and payment method</p>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => { setAmount(String(a)); setPaymentMethod(null); }}
                className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  amount === String(a)
                    ? "border-[#7519e9] bg-gradient-to-r from-[#7519e9]/30 to-[#df20ba]/20 text-purple-200 shadow-[0_0_12px_rgba(117,25,233,0.3)]"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:border-[#7519e9]/40 hover:bg-[#7519e9]/10 hover:text-white"
                }`}
              >
                {formatNaira(a)}
              </button>
            ))}
          </div>
          <div className="relative mb-2">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 font-bold text-sm">₦</span>
            <input
              type="number"
              min={100}
              placeholder="Enter custom amount"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setPaymentMethod(null); }}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-9 pr-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#7519e9]/60 focus:ring-1 focus:ring-[#7519e9]/40 transition-all"
            />
          </div>
          {publicKey === null && (
            <p className="mt-2 mb-3 text-xs text-amber-400 flex items-center gap-1.5">
              <AlertCircle size={12} /> Payment not configured yet — contact admin.
            </p>
          )}
        </div>
        <div className="px-6 pb-6">
          <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.15em] mb-3">Payment Method</p>
          <button
            onClick={() => handleSelectMethod("card")}
            className={`group w-full cursor-pointer rounded-2xl border p-4 text-left transition-all duration-200 ${
              paymentMethod === "card"
                ? "border-[#df20ba] bg-gradient-to-br from-[#df20ba]/20 to-[#7519e9]/15 shadow-[0_0_24px_rgba(223,32,186,0.25)]"
                : "border-white/8 bg-white/[0.03] hover:border-[#df20ba]/50 hover:bg-[#df20ba]/8"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl border transition-all ${
                paymentMethod === "card" ? "border-[#df20ba]/50 bg-[#df20ba]/25" : "border-white/8 bg-white/5 group-hover:border-[#df20ba]/40 group-hover:bg-[#df20ba]/15"
              }`}>
                <CreditCard size={18} className={paymentMethod === "card" ? "text-pink-300" : "text-white/40 group-hover:text-pink-300"} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-white">Card Payment</div>
                <div className="mt-0.5 text-xs text-white/40 leading-relaxed">Debit / credit via Flutterwave</div>
              </div>
              {paymentMethod === "card" && <div className="ml-auto flex shrink-0 items-center gap-1 text-xs font-medium text-pink-300"><CheckCircle2 size={11} /> Selected</div>}
            </div>
          </button>
          {paymentMethod === "card" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4">
              <Button variant="glossy" className="w-full h-12 text-sm font-bold bg-gradient-to-r from-[#df20ba] to-[#7519e9]" disabled={preparingCard || !scriptLoaded} onClick={() => void handleStartCard()}>
                {preparingCard ? <><div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Opening…</> : <><CreditCard size={15} /> Pay with Card — {formatNaira(parsedAmount || 0)}</>}
              </Button>
            </motion.div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-base font-bold text-white flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#7519e9]/20 border border-[#7519e9]/30">
            <Clock size={13} className="text-purple-400" />
          </div>
          Transaction History
        </h2>
        {depositHistory === undefined ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : depositHistory.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center text-sm text-white/30">No transactions yet.</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {depositHistory.map((tx) => (
              <div key={tx._id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-gradient-to-r from-[#1a0b30]/60 to-[#0e0620]/60 p-4 hover:border-[#7519e9]/25 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`flex size-9 items-center justify-center rounded-xl border ${
                    tx.status === "successful" ? "bg-emerald-500/10 border-emerald-500/20"
                    : tx.status === "pending" ? "bg-amber-500/10 border-amber-500/20"
                    : "bg-red-500/10 border-red-500/20"
                  }`}>
                    {tx.status === "successful"
                      ? <CheckCircle2 size={14} className="text-emerald-400" />
                      : <AlertCircle size={14} className={tx.status === "pending" ? "text-amber-400" : "text-red-400"} />}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-white capitalize flex items-center gap-2">
                      {tx.type}
                      {tx.paymentChannel === "bank_transfer" && (
                        <span className="text-[10px] rounded-full border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-purple-400">Bank</span>
                      )}
                    </div>
                    <div className="text-xs text-white/35">{new Date(tx.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-extrabold text-sm ${tx.type === "deposit" ? "text-emerald-400" : "text-red-400"}`}>
                    {tx.type === "deposit" ? "+" : "-"}{formatNaira(tx.amount)}
                  </div>
                  <span className={`text-xs font-medium ${statusColor(tx.status)}`}>{tx.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WalletPage() {
  const location = useLocation();
  const registrationUrl = getRegistrationUrl(`${location.pathname}${location.search}${location.hash}`);

  return (
    <>
      <Authenticated><WalletInner /></Authenticated>
      <Unauthenticated>
        <Navigate to={registrationUrl} replace />
      </Unauthenticated>
      <AuthLoading>
        <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
          <Skeleton className="h-9 w-48 mb-6" />
          <Skeleton className="h-36 w-full mb-6" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AuthLoading>
    </>
  );
}
