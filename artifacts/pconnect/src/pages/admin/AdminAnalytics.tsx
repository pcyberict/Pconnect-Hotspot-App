import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Download, Filter, LineChart, RefreshCw, Users, ShoppingCart, Gift, WalletCards, UserRound, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart as RechartsLineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useQuery } from "@/lib/pconnect-api.ts";
import { api } from "@/lib/pconnect-api.ts";
import { Calendar } from "@/components/ui/calendar.tsx";
import type { DateRange as CalendarDateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatNaira } from "@/lib/plans.ts";

type DateRange = { from?: Date; to?: Date };
const today = new Date();

function datesFor(preset: string): DateRange {
  if (preset === "today") return { from: today, to: today };
  if (preset === "yesterday") { const date = subDays(today, 1); return { from: date, to: date }; }
  if (preset === "lastWeek") return { from: startOfWeek(subDays(today, 7), { weekStartsOn: 1 }), to: endOfWeek(subDays(today, 7), { weekStartsOn: 1 }) };
  if (preset === "thisMonth") return { from: startOfMonth(today), to: today };
  if (preset === "lastMonth") { const date = subMonths(today, 1); return { from: startOfMonth(date), to: endOfMonth(date) }; }
  return {};
}

const presets = [["today", "Today"], ["yesterday", "Yesterday"], ["lastWeek", "Last week"], ["thisMonth", "This month"], ["lastMonth", "Last month"], ["custom", "Custom range"]];
const money = (value: number) => formatNaira(value);

function Metric({ label, value, hint, icon: Icon, accent = "text-purple-300" }: { label: string; value: string; hint?: string; icon: React.ElementType; accent?: string }) {
  return <div className="rounded-2xl border border-white/10 bg-[#1a0b30]/80 p-5">
    <div className="flex items-start justify-between gap-3"><span className="text-xs font-medium uppercase tracking-wider text-white/50">{label}</span><Icon size={18} className={accent} /></div>
    <div className="mt-4 text-2xl font-bold text-white">{value}</div>{hint && <div className="mt-1 text-xs text-white/35">{hint}</div>}
  </div>;
}

export default function AdminAnalytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPreset = searchParams.get("preset");
  const preset = presets.some(([value]) => value === requestedPreset) ? requestedPreset! : "thisMonth";
  const [range, setRange] = useState<DateRange>(() => datesFor(preset));
  const [calendarOpen, setCalendarOpen] = useState(false);
  useEffect(() => {
    if (preset !== "custom") setRange(datesFor(preset));
  }, [preset]);
  const args = useMemo(() => ({ from: range.from ? format(range.from, "yyyy-MM-dd") : undefined, to: range.to ? format(range.to, "yyyy-MM-dd") : undefined }), [range]);
  const analytics = useQuery<any>(api.analytics.getAdmin, args);
  const s = analytics?.summary;

  function applyPreset(value: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("preset", value);
    setSearchParams(nextParams, { replace: true });
    if (value !== "custom") setRange(datesFor(value));
  }

  function exportCsv() {
    if (!analytics) return;
    const rows = [["Date", "Purchases", "Revenue"], ...analytics.daily.map((item: any) => [item.date, item.purchases, item.revenue])];
    rows.push([], ["Summary", "Value"], ["Total purchases", s.totalPurchases], ["New users", s.totalUsers], ["Purchase revenue", s.purchaseRevenue], ["Welcome bonus", s.welcomeBonus], ["Referral commissions", s.referralCommissions], ["Net generated", s.netGenerated], ["Unused funds", s.unusedFunds]);
    const csv = rows.map((row) => row.map((value: string | number | undefined) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `pconnect-analytics-${args.from ?? "all-time"}-${args.to ?? "today"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!analytics) return <div><Skeleton className="mb-3 h-8 w-48" /><Skeleton className="mb-6 h-5 w-80" /><div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div></div>;

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div><div className="flex items-center gap-2"><LineChart className="text-[#df20ba]" size={22} /><h1 className="text-2xl font-bold text-white">Analytics</h1></div><p className="mt-1 text-sm text-white/40">Understand revenue, incentives, and wallet exposure.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={exportCsv}><Download size={15} /> Export CSV</Button><Button variant="glossy" onClick={() => setRange({ ...range })}><RefreshCw size={15} /> Refresh</Button></div>
    </div>
     <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#1a0b30]/60 p-3"><Filter size={16} className="ml-1 text-white/40" />{presets.map(([value, label]) => <button key={value} id={`analytics-tab-${value}`} onClick={() => applyPreset(value)} aria-selected={preset === value} className={`rounded-lg px-3 py-2 text-xs font-medium transition ${preset === value ? "bg-[#7519e9] text-white" : "text-white/55 hover:bg-white/10 hover:text-white"}`}>{label}</button>)}<Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger asChild><Button variant="outline" className="ml-auto border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"><CalendarDays size={15} />{range.from ? `${format(range.from, "MMM d")} – ${range.to ? format(range.to, "MMM d, yyyy") : "…"}` : "Choose dates"}</Button></PopoverTrigger><PopoverContent className="w-auto border-white/10 bg-[#1a0b30] p-0 text-white" align="end"><Calendar mode="range" selected={range.from ? { from: range.from, to: range.to } as CalendarDateRange : undefined} onSelect={(value) => { applyPreset("custom"); setRange(value ? { from: value.from, to: value.to } : {}); if (value?.from && value.to) setCalendarOpen(false); }} numberOfMonths={2} /></PopoverContent></Popover></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Purchase revenue" value={money(s.purchaseRevenue)} hint={`${s.totalPurchases.toLocaleString()} completed purchases`} icon={TrendingUp} accent="text-emerald-400" /><Metric label="Net generated" value={money(s.netGenerated)} hint="After bonus + referral commissions" icon={WalletCards} accent="text-[#df20ba]" /><Metric label="New users" value={s.totalUsers.toLocaleString()} icon={Users} /><Metric label="Unused wallet funds" value={money(s.unusedFunds)} hint="Current customer balances" icon={WalletCards} accent="text-amber-300" /></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Welcome bonus" value={money(s.welcomeBonus)} hint="Distributed in selected period" icon={Gift} accent="text-pink-300" /><Metric label="Referral commissions" value={money(s.referralCommissions)} hint="Credited in selected period" icon={UserRound} accent="text-orange-300" /><Metric label="After welcome bonus" value={money(s.netAfterBonus)} icon={ShoppingCart} /><Metric label="Average purchase" value={money(s.averagePurchase)} icon={LineChart} /></div>
    <section className="rounded-2xl border border-white/10 bg-[#1a0b30]/80 p-4 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold text-white">Revenue trend</h2><p className="mt-1 text-xs text-white/40">Daily movement from completed purchases</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">{money(s.purchaseRevenue)} total</span></div><div className="h-[280px] w-full">{analytics.daily.length ? <ResponsiveContainer width="100%" height="100%"><RechartsLineChart data={analytics.daily} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}><CartesianGrid stroke="#ffffff12" vertical={false} /><XAxis dataKey="date" tickFormatter={(date) => date.slice(5)} tick={{ fill: "#ffffff66", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => `₦${Number(value).toLocaleString()}`} tick={{ fill: "#ffffff66", fontSize: 11 }} axisLine={false} tickLine={false} width={72} /><Tooltip contentStyle={{ background: "#24113f", border: "1px solid #ffffff22", borderRadius: 12, color: "#fff" }} formatter={(value: number) => [money(value), "Revenue"]} /><Line type="linear" dataKey="revenue" stroke="#df20ba" strokeWidth={2.5} dot={{ r: 3, fill: "#24113f", stroke: "#df20ba", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#df20ba", stroke: "#fff", strokeWidth: 2 }} /></RechartsLineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-white/35">No completed purchases in this date range.</div>}</div></section>
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#1a0b30]/80"><div className="flex items-center justify-between border-b border-white/10 p-5"><div><h2 className="font-bold text-white">Purchase detail</h2><p className="mt-1 text-xs text-white/40">Up to 500 completed purchases in this range</p></div><ShoppingCart size={18} className="text-white/35" /></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-white/5 text-xs uppercase tracking-wider text-white/40"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-white/5">{analytics.recentPurchases.length ? analytics.recentPurchases.map((purchase: any) => <tr key={purchase.id} className="text-white/70"><td className="whitespace-nowrap px-5 py-3">{new Date(purchase.date).toLocaleDateString()}</td><td className="px-5 py-3"><div className="text-white">{purchase.userName || "Unnamed user"}</div><div className="text-xs text-white/35">{purchase.userEmail}</div></td><td className="px-5 py-3">{purchase.planName}</td><td className="px-5 py-3 text-right font-semibold text-white">{money(Number(purchase.amount))}</td></tr>) : <tr><td colSpan={4} className="px-5 py-10 text-center text-white/35">No purchases found.</td></tr>}</tbody></table></div></section>
  </div>;
}