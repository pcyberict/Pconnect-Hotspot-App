import { useState, useEffect, useCallback, useRef } from "react";
import { Authenticated, Unauthenticated, AuthLoading, useQuery, useMutation, useAction } from "@/lib/pconnect-api.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  Wallet, ArrowDownCircle, Clock, CheckCircle2, AlertCircle,
  Eye, EyeOff, Building2, CreditCard, Copy, Timer, RefreshCw, Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "@/lib/pconnect-api.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Link } from "react-router-dom";
import { formatNaira } from "@/lib/plans.ts";
import { useAuth } from "@/hooks/use-auth.ts";

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

type PaymentMethod = "bank" | "card" | null;

type VirtualAccount = {
  accountNumber: string;
  bankName: string;
  accountName: string;
  expiresAt: string;
  orderRef?: string;
};

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

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!expiresAt) { setRemaining(0); return; }
    const calc = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    setRemaining(calc());
    const id = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

function formatCountdown(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function AccountRow({ label, value, onCopy, highlight }: { label: string; value: string; onCopy?: () => void; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 gap-3">
      <span className="text-xs text-white/40 shrink-0 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`truncate ${highlight ? "text-white text-xl font-extrabold tracking-widest" : "text-sm font-semibold text-white/80"}`}>{value}</span>
        {onCopy && (
          <button onClick={onCopy} className="cursor-pointer shrink-0 rounded-lg p-1.5 bg-white/5 hover:bg-[#7519e9]/30 text-white/30 hover:text-purple-300 transition-all">
            <Copy size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function BankTransferPanel({ amount, reference, onSuccess, onCancel }: {
  amount: number; reference: string; onSuccess: () => void; onCancel: () => void;
}) {
  const createVirtualAccount = useAction(api.wallet.deposits.createVirtualAccount);
  const pollBankTransfer = useAction(api.wallet.deposits.pollBankTransfer);
  const [va, setVa] = useState<VirtualAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [pollStatus, setPollStatus] = useState<"idle" | "checking" | "notfound">("idle");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remaining = useCountdown(va?.expiresAt ?? null);
  const expired = va !== null && remaining === 0;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await createVirtualAccount({ reference });
        if (!cancelled) setVa(data);
      } catch (e) {
        const msg = e instanceof ConvexError ? (e.data as { message?: string }).message : "Could not generate account";
        toast.error(msg ?? "Error");
        if (!cancelled) onCancel();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reference]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!va || expired) return;
    pollingRef.current = setInterval(() => {
      void pollBankTransfer({ reference }).then(res => {
        if (res.status === "successful") {
          clearInterval(pollingRef.current!);
          toast.success("Payment confirmed! Wallet funded.");
          onSuccess();
        }
      }).catch(() => { /* silent */ });
    }, 15_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [va, expired]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIHavePaid = async () => {
    setVerifying(true); setPollStatus("checking");
    try {
      const res = await pollBankTransfer({ reference });
      if (res.status === "successful") {
        toast.success("Payment confirmed! Wallet funded.");
        onSuccess();
      } else {
        setPollStatus("notfound");
        toast.error("Payment not detected yet. Please wait and try again.");
      }
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message?: string }).message : "Verification error";
      toast.error(msg ?? "Error"); setPollStatus("notfound");
    } finally { setVerifying(false); }
  };

  const copy = (text: string, label: string) => { void navigator.clipboard.writeText(text); toast.success(`${label} copied!`); };

  if (loading) return (
    <div className="flex flex-col items-center gap-4 py-10">
      <div className="size-12 animate-spin rounded-full border-2 border-[#7519e9] border-t-transparent" />
      <p className="text-sm text-white/50">Generating your virtual account…</p>
    </div>
  );
  if (!va) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#7519e9] to-[#df20ba] p-5 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
        <p className="text-xs text-white/70 mb-1 uppercase tracking-widest">Transfer exactly</p>
        <p className="text-4xl font-extrabold text-white drop-shadow">{formatNaira(amount)}</p>
        <p className="text-xs text-white/60 mt-1">Any other amount will not be credited automatically</p>
      </div>
      <div className="rounded-2xl border border-[#7519e9]/30 bg-gradient-to-b from-[#1a0b30] to-[#0e0620] divide-y divide-white/5 overflow-hidden">
        <AccountRow label="Bank Name" value={va.bankName} />
        <AccountRow label="Account Number" value={va.accountNumber} onCopy={() => copy(va.accountNumber, "Account number")} highlight />
        <AccountRow label="Account Name" value={va.accountName} />
      </div>
      <div className={`flex items-center justify-between rounded-2xl border px-5 py-3.5 ${
        expired ? "border-red-500/30 bg-red-500/10"
        : remaining < 300 ? "border-amber-500/30 bg-amber-500/10"
        : "border-[#7519e9]/20 bg-[#7519e9]/5"
      }`}>
        <div className="flex items-center gap-2">
          <Timer size={15} className={expired ? "text-red-400" : remaining < 300 ? "text-amber-400" : "text-purple-400"} />
          <span className="text-sm text-white/60">{expired ? "Account expired" : "Expires in"}</span>
        </div>
        <span className={`font-mono font-bold text-xl tracking-widest ${expired ? "text-red-400" : remaining < 300 ? "text-amber-400" : "text-white"}`}>
          {expired ? "00:00" : formatCountdown(remaining)}
        </span>
      </div>
      {expired ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center text-sm text-red-300">
          This account has expired.
          <button onClick={onCancel} className="block mx-auto mt-2 text-xs underline cursor-pointer text-red-400 hover:text-red-300">Start a new deposit</button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button variant="glossy" className="w-full h-12 text-base font-semibold" disabled={verifying} onClick={() => void handleIHavePaid()}>
            {verifying
              ? <><div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Checking payment…</>
              : <><CheckCircle2 size={16} /> I Have Paid</>}
          </Button>
          {pollStatus === "notfound" && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-300 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>Payment not confirmed yet. Bank transfers take 1–5 minutes. Keep this page open and try again shortly.</span>
            </div>
          )}
          <button onClick={onCancel} className="w-full text-xs text-white/30 hover:text-white/60 cursor-pointer transition-colors py-1">
            Cancel — choose a different method
          </button>
        </div>
      )}
    </motion.div>
  );
}

function WalletInner() {
  const wallet = useQuery(api.wallets.getMyWallet, {});
  const depositHistory = useQuery(api.wallet.deposits.getMyDepositHistory, {});
  const publicKey = useQuery(api.siteSettings.getPublicKey, {});
  const createPending = useMutation(api.wallet.deposits.createPendingDeposit);
  const verifyDeposit = useAction(api.wallet.deposits.verifyDepositById);
  const { user } = useAuth();
  const scriptLoaded = useFlutterwaveScript();

  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [bankSession, setBankSession] = useState<{ reference: string; amount: number } | null>(null);
  const [preparingCard, setPreparingCard] = useState(false);
  const [preparingBank, setPreparingBank] = useState(false);

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

  const handleStartBank = async () => {
    if (!validAmount) return;
    if (!publicKey) { toast.error("Flutterwave not configured yet. Contact admin."); return; }
    setPreparingBank(true);
    try {
      const result = await createPending({ amount: parsedAmount });
      setBankSession({ reference: result.reference, amount: parsedAmount });
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message?: string }).message : "Failed to initiate deposit";
      toast.error(msg ?? "Error");
    } finally { setPreparingBank(false); }
  };

  const handleStartCard = useCallback(async () => {
    if (!validAmount) return;
    if (!publicKey) { toast.error("Flutterwave not configured yet. Contact admin."); return; }
    if (!scriptLoaded) { toast.error("Payment widget still loading. Try again."); return; }
    setPreparingCard(true);
    let reference = "";
    try {
      const result = await createPending({ amount: parsedAmount });
      reference = result.reference;
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message?: string }).message : "Failed";
      toast.error(msg ?? "Error");
      setPreparingCard(false);
      return;
    }
    window.FlutterwaveCheckout({
      public_key: publicKey,
      tx_ref: reference,
      amount: parsedAmount,
      currency: "NGN",
      customer: { email: user?.profile.email ?? "customer@pcyberict.com", name: user?.profile.name ?? "PCyber Connect Customer" },
      customizations: { title: "PCyber Connect", description: "Wallet Funding", logo: "https://hercules-cdn.com/file_PDusWTTXoxwuVrGaJFbrGp0y" },
      callback: (response) => {
        if (response.status === "successful") {
          toast.loading("Verifying payment…", { id: "verify" });
          void verifyDeposit({ reference: response.tx_ref, providerTransactionId: String(response.transaction_id) })
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
          toast.error("Payment was not completed.");
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
                onClick={() => { setAmount(String(a)); setPaymentMethod(null); setBankSession(null); }}
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
              onChange={(e) => { setAmount(e.target.value); setPaymentMethod(null); setBankSession(null); }}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-9 pr-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#7519e9]/60 focus:ring-1 focus:ring-[#7519e9]/40 transition-all"
            />
          </div>
          {publicKey === null && (
            <p className="mt-2 mb-3 text-xs text-amber-400 flex items-center gap-1.5">
              <AlertCircle size={12} /> Payment not configured yet — contact admin.
            </p>
          )}
        </div>
        <AnimatePresence>
          {!bankSession && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="px-6 pb-6">
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.15em] mb-3">Select Payment Method</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleSelectMethod("bank")}
                  className={`cursor-pointer group text-left rounded-2xl border p-4 transition-all duration-200 ${
                    paymentMethod === "bank"
                      ? "border-[#7519e9] bg-gradient-to-br from-[#7519e9]/25 to-[#b20ed2]/15 shadow-[0_0_24px_rgba(117,25,233,0.3)]"
                      : "border-white/8 bg-white/[0.03] hover:border-[#7519e9]/50 hover:bg-[#7519e9]/8"
                  }`}
                >
                  <div className={`mb-3 flex size-11 items-center justify-center rounded-xl border transition-all ${
                    paymentMethod === "bank" ? "border-[#7519e9]/50 bg-[#7519e9]/30" : "border-white/8 bg-white/5 group-hover:border-[#7519e9]/40 group-hover:bg-[#7519e9]/15"
                  }`}>
                    <Building2 size={18} className={paymentMethod === "bank" ? "text-purple-300" : "text-white/40 group-hover:text-purple-300"} />
                  </div>
                  <div className="font-bold text-sm text-white">Bank Transfer</div>
                  <div className="mt-0.5 text-xs text-white/40 leading-relaxed">Virtual account from any bank</div>
                  {paymentMethod === "bank" && <div className="mt-2.5 flex items-center gap-1 text-xs text-purple-300 font-medium"><CheckCircle2 size={11} /> Selected</div>}
                </button>
                <button
                  onClick={() => handleSelectMethod("card")}
                  className={`cursor-pointer group text-left rounded-2xl border p-4 transition-all duration-200 ${
                    paymentMethod === "card"
                      ? "border-[#df20ba] bg-gradient-to-br from-[#df20ba]/20 to-[#7519e9]/15 shadow-[0_0_24px_rgba(223,32,186,0.25)]"
                      : "border-white/8 bg-white/[0.03] hover:border-[#df20ba]/50 hover:bg-[#df20ba]/8"
                  }`}
                >
                  <div className={`mb-3 flex size-11 items-center justify-center rounded-xl border transition-all ${
                    paymentMethod === "card" ? "border-[#df20ba]/50 bg-[#df20ba]/25" : "border-white/8 bg-white/5 group-hover:border-[#df20ba]/40 group-hover:bg-[#df20ba]/15"
                  }`}>
                    <CreditCard size={18} className={paymentMethod === "card" ? "text-pink-300" : "text-white/40 group-hover:text-pink-300"} />
                  </div>
                  <div className="font-bold text-sm text-white">Card Payment</div>
                  <div className="mt-0.5 text-xs text-white/40 leading-relaxed">Debit / credit via Flutterwave</div>
                  {paymentMethod === "card" && <div className="mt-2.5 flex items-center gap-1 text-xs text-pink-300 font-medium"><CheckCircle2 size={11} /> Selected</div>}
                </button>
              </div>
              <AnimatePresence>
                {paymentMethod === "bank" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4">
                    <Button variant="glossy" className="w-full h-12 text-sm font-bold" disabled={preparingBank} onClick={() => void handleStartBank()}>
                      {preparingBank ? <><div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Generating account…</> : <><Building2 size={15} /> Get Account Number — {formatNaira(parsedAmount || 0)}</>}
                    </Button>
                  </motion.div>
                )}
                {paymentMethod === "card" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4">
                    <Button variant="glossy" className="w-full h-12 text-sm font-bold bg-gradient-to-r from-[#df20ba] to-[#7519e9]" disabled={preparingCard || !scriptLoaded} onClick={() => void handleStartCard()}>
                      {preparingCard ? <><div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Opening…</> : <><CreditCard size={15} /> Pay with Card — {formatNaira(parsedAmount || 0)}</>}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {bankSession && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="px-6 pb-6">
              <div className="mb-4 flex items-center gap-2">
                <Building2 size={15} className="text-purple-400" />
                <span className="text-sm font-bold text-white">Bank Transfer Details</span>
                <button
                  onClick={() => void (async () => {
                    try {
                      const r = await createPending({ amount: bankSession.amount });
                      setBankSession({ reference: r.reference, amount: bankSession.amount });
                    } catch { /* ignore */ }
                  })()}
                  className="ml-auto cursor-pointer flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  <RefreshCw size={11} /> New Account
                </button>
              </div>
              <BankTransferPanel
                amount={bankSession.amount}
                reference={bankSession.reference}
                onSuccess={() => { setBankSession(null); setAmount(""); setPaymentMethod(null); }}
                onCancel={() => { setBankSession(null); setPaymentMethod(null); }}
              />
            </motion.div>
          )}
        </AnimatePresence>
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
  return (
    <>
      <Authenticated><WalletInner /></Authenticated>
      <Unauthenticated>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-bold">Sign in to access your wallet</h1>
          <Button asChild variant="glossy"><Link to="/login">Sign In / Register</Link></Button>
        </div>
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
