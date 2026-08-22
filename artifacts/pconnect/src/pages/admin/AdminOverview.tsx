import { useQuery } from "@/lib/pconnect-api.ts";
import { Users, ShoppingCart, Ticket, TrendingUp, BarChart2, PackageCheck } from "lucide-react";
import { api } from "@/lib/pconnect-api.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatNaira } from "@/lib/plans.ts";
import { useSiteName } from "@/lib/site-settings.ts";

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.ElementType; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1a0b30]/80 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</span>
        <div className={`flex size-8 items-center justify-center rounded-lg ${accent ?? "bg-[#7519e9]/20"}`}>
          <Icon size={15} className="text-purple-300" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export default function AdminOverview() {
  const stats = useQuery(api.vouchers.getAdminStats, {});
  const inventory = useQuery(api.vouchers.getInventoryCounts, {});
  const siteName = useSiteName();

  if (stats === undefined || inventory === undefined) {
    return (
      <div>
        <Skeleton className="h-8 w-40 mb-6" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Admin Overview</h1>
      <p className="text-sm text-white/40 mb-6">All-time stats for {siteName}.</p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Users" value={stats.totalUsers} icon={Users} />
        <StatCard label="Total Sales" value={stats.totalPurchases} icon={ShoppingCart} />
        <StatCard label="Total Revenue" value={formatNaira(stats.totalRevenue)} icon={TrendingUp} accent="bg-emerald-500/15" />
        <StatCard label="Today Sales" value={stats.todaySales} icon={BarChart2} />
        <StatCard label="Today Revenue" value={formatNaira(stats.todayRevenue)} icon={TrendingUp} accent="bg-[#df20ba]/15" />
        <StatCard label="Available Vouchers" value={stats.availableVouchers} icon={PackageCheck} accent="bg-emerald-500/15" />
        <StatCard label="Sold Vouchers" value={stats.soldVouchers} icon={Ticket} accent="bg-[#7519e9]/20" />
        <StatCard label="Disabled Vouchers" value={stats.disabledVouchers} icon={Ticket} accent="bg-red-500/15" />
      </div>
      <div className="mt-8 rounded-2xl border border-white/10 bg-[#1a0b30]/80 p-6">
        <h2 className="mb-4 text-base font-bold text-white">Inventory Summary</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-center">
          {[
            { label: "Available", value: inventory.available, color: "text-emerald-400" },
            { label: "Reserved", value: inventory.reserved, color: "text-amber-400" },
            { label: "Sold", value: inventory.sold, color: "text-purple-400" },
            { label: "Disabled", value: inventory.disabled, color: "text-red-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/5 py-4">
              <div className={`text-3xl font-extrabold ${color}`}>{value.toLocaleString()}</div>
              <div className="mt-1 text-xs text-white/40">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
