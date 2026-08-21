import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { formatNaira } from "@/lib/plans.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function AdminUsers() {
  const users = useQuery(api.vouchers.listAllUsers, {});
  const setRole = useMutation(api.vouchers.setUserRole);
  const [changing, setChanging] = useState<Id<"users"> | null>(null);

  const toggleRole = async (userId: Id<"users">, current: string | undefined) => {
    const newRole = current === "admin" ? "user" : "admin";
    setChanging(userId);
    try {
      await setRole({ userId, role: newRole });
      toast.success(`Role updated to ${newRole}`);
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message?: string }).message : "Failed";
      toast.error(msg ?? "Error");
    } finally {
      setChanging(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Users</h1>
      <p className="text-sm text-white/40 mb-6">All registered users.</p>

      {users === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-white/40">No users yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/40">
                <th className="pb-2 text-left font-medium pr-4">Name / Email</th>
                <th className="pb-2 text-left font-medium pr-4">Phone</th>
                <th className="pb-2 text-left font-medium pr-4">Wallet</th>
                <th className="pb-2 text-left font-medium pr-4">Purchases</th>
                <th className="pb-2 text-left font-medium pr-4">Role</th>
                <th className="pb-2 text-left font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(u => (
                <tr key={u._id} className="hover:bg-white/5">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-white">{u.name ?? "\u2014"}</div>
                    <div className="text-xs text-white/30">{u.email}</div>
                  </td>
                  <td className="py-3 pr-4 text-white/60">{u.phone ?? "\u2014"}</td>
                  <td className="py-3 pr-4 font-semibold text-emerald-400">{formatNaira(u.walletBalance)}</td>
                  <td className="py-3 pr-4 text-white/60">{u.purchaseCount}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role === "admin" ? "bg-purple-500/20 text-purple-300" : "bg-white/10 text-white/50"}`}>{u.role ?? "user"}</span>
                      <Button variant="secondary" size="sm" className="h-6 px-2 text-xs" disabled={changing === u._id} onClick={() => void toggleRole(u._id, u.role)}>
                        {u.role === "admin" ? "Demote" : "Make Admin"}
                      </Button>
                    </div>
                  </td>
                  <td className="py-3 text-xs text-white/30">{new Date(u._creationTime).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
