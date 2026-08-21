import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatNaira } from "@/lib/plans.ts";

export default function AdminPurchases() {
  const purchases = useQuery(api.vouchers.listAllPurchases, {});

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">All Purchases</h1>
      <p className="text-sm text-white/40 mb-6">Every voucher purchase across all users.</p>

      {purchases === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : purchases.length === 0 ? (
        <p className="text-sm text-white/40">No purchases yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/40">
                <th className="pb-2 text-left font-medium pr-4">User</th>
                <th className="pb-2 text-left font-medium pr-4">Plan</th>
                <th className="pb-2 text-left font-medium pr-4">Voucher Username</th>
                <th className="pb-2 text-left font-medium pr-4">Amount</th>
                <th className="pb-2 text-left font-medium pr-4">Status</th>
                <th className="pb-2 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {purchases.map(p => (
                <tr key={p._id} className="hover:bg-white/5">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-white">{p.userName}</div>
                    <div className="text-xs text-white/30">{p.userEmail}</div>
                  </td>
                  <td className="py-3 pr-4 text-white/70">{p.planName}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-purple-300">{p.voucherUsername}</td>
                  <td className="py-3 pr-4 font-semibold text-white">{formatNaira(p.amount)}</td>
                  <td className="py-3 pr-4"><span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">{p.status}</span></td>
                  <td className="py-3 text-xs text-white/40">{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
