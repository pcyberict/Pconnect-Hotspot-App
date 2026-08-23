import { useMemo } from "react";
import { Copy, Gift, Users, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "@/lib/pconnect-api.ts";
import { api } from "@/lib/pconnect-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatNaira } from "@/lib/plans.ts";
import { getRegistrationUrl } from "@/lib/auth-redirect.ts";

type ReferralData = { referralCode?: string; creditedTotal: number; referrals: { _id: string; referredName?: string; referredEmail: string; status: string; commissionAmount?: number; createdAt?: string }[] };

function ReferralInner() {
  const data = useQuery<ReferralData>(api.referrals.getMine, {});
  const location = useLocation();
  const link = useMemo(() => data?.referralCode ? `${window.location.origin}/register?ref=${encodeURIComponent(data.referralCode)}` : "", [data?.referralCode]);
  if (!data) return <div className="mx-auto max-w-3xl px-4 py-10"><Skeleton className="h-9 w-48" /><Skeleton className="mt-8 h-72 w-full rounded-3xl" /></div>;
  const copy = async (value: string, label: string) => { await navigator.clipboard.writeText(value); toast.success(`${label} copied`); };
  return <div className="min-h-full bg-[#23103e]/30 px-4 py-10 md:px-8">
    <div className="mb-8"><h1 className="text-3xl font-extrabold text-white">Refer &amp; Earn</h1><p className="mt-1 text-sm text-white/40">Invite friends. Earn once when each friend makes their first successful deposit.</p></div>
    <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><Users className="text-purple-300" size={18} /><div className="mt-3 text-2xl font-bold text-white">{data.referrals.length}</div><div className="text-xs text-white/40">People referred</div></div><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><WalletCards className="text-emerald-300" size={18} /><div className="mt-3 text-2xl font-bold text-white">{formatNaira(data.creditedTotal)}</div><div className="text-xs text-white/40">Earned so far</div></div><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><Gift className="text-pink-300" size={18} /><div className="mt-3 text-2xl font-bold text-white">{data.referrals.filter((item) => item.status === "pending").length}</div><div className="text-xs text-white/40">Awaiting first deposit</div></div></div>
    <section className="mt-6 rounded-3xl border border-[#7519e9]/30 bg-gradient-to-br from-[#7519e9]/25 to-[#df20ba]/10 p-6">
      <h2 className="font-semibold text-white">Your referral link</h2><p className="mt-1 text-sm text-white/45">Your friend’s signup form will fill in your code automatically.</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input readOnly value={link} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80 outline-none" /><Button variant="glossy" onClick={() => void copy(link, "Referral link")}><Copy size={15} /> Copy link</Button></div>
      <div className="mt-3 flex items-center gap-2 text-xs text-white/45">Code: <strong className="text-white">{data.referralCode}</strong><button type="button" onClick={() => void copy(data.referralCode ?? "", "Referral code")} className="text-purple-300 hover:text-white"><Copy size={13} /></button></div>
    </section>
    <section className="mt-6 rounded-3xl border border-white/10 bg-[#1a0b30]/60 p-5"><h2 className="font-semibold text-white">Your referrals</h2>{data.referrals.length === 0 ? <p className="mt-4 text-sm text-white/40">No referrals yet.</p> : <div className="mt-4 space-y-3">{data.referrals.map((item) => <div key={item._id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"><div><div className="font-medium text-white">{item.referredName || item.referredEmail}</div><div className="text-xs text-white/35">{item.referredEmail}</div></div><div className="text-right"><div className={`text-xs font-semibold capitalize ${item.status === "credited" ? "text-emerald-400" : "text-amber-300"}`}>{item.status}</div>{item.commissionAmount ? <div className="text-sm font-semibold text-white">{formatNaira(item.commissionAmount)}</div> : null}</div></div>)}</div>}</section>
  </div>;
}

export default function Referrals() {
  const location = useLocation();
  return <><Authenticated><ReferralInner /></Authenticated><Unauthenticated><div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center"><h1 className="text-2xl font-bold">Sign in to view referrals</h1><Button asChild variant="glossy"><Link to={getRegistrationUrl(`${location.pathname}${location.search}`)}>Create an Account</Link></Button></div></Unauthenticated><AuthLoading><Skeleton className="mx-auto mt-12 h-72 max-w-3xl rounded-3xl" /></AuthLoading></>;
}