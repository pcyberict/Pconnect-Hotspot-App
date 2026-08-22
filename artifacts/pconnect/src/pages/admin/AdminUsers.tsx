import { useState } from "react";
import { useQuery, useMutation } from "@/lib/pconnect-api.ts";
import { toast } from "sonner";
import { ShieldAlert, Trash2 } from "lucide-react";
import { api } from "@/lib/pconnect-api.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { formatNaira } from "@/lib/plans.ts";

type Id<T extends string> = string;
type AdminUser = {
  _id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  walletBalance: number;
  purchaseCount: number;
  role?: string;
  _creationTime: string;
};

export default function AdminUsers() {
  const users = useQuery<AdminUser[]>(api.vouchers.listAllUsers, {});
  const setRole = useMutation(api.vouchers.setUserRole);
  const deleteUser = useMutation(api.vouchers.deleteUser);
  const [changing, setChanging] = useState<Id<"users"> | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: "role" | "delete";
    user: AdminUser;
    nextRole?: "admin" | "user";
  } | null>(null);

  const confirmAction = async () => {
    if (!pendingAction) return;
    const { type, user, nextRole } = pendingAction;
    setChanging(user._id);
    try {
      if (type === "role" && nextRole) {
        await setRole({ userId: user._id, role: nextRole });
        toast.success(`${user.email} is now ${nextRole === "admin" ? "an admin" : "a regular user"}`);
      } else {
        await deleteUser({ userId: user._id });
        toast.success(`${user.email} was deleted`);
      }
      setPendingAction(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
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
                <th className="pb-2 text-right font-medium">Actions</th>
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
                      <Button variant="secondary" size="sm" className="h-6 px-2 text-xs" disabled={changing === u._id} onClick={() => setPendingAction({ type: "role", user: u, nextRole: u.role === "admin" ? "user" : "admin" })}>
                        {u.role === "admin" ? "Demote" : "Make Admin"}
                      </Button>
                    </div>
                  </td>
                  <td className="py-3 text-xs text-white/30">{new Date(u._creationTime).toLocaleDateString()}</td>
                  <td className="py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-400 hover:bg-red-500/15 hover:text-red-300"
                      aria-label={`Delete ${u.email}`}
                      title={`Delete ${u.email}`}
                      disabled={changing === u._id}
                      onClick={() => setPendingAction({ type: "delete", user: u })}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => { if (!open && changing === null) setPendingAction(null); }}>
        <AlertDialogContent className="border-[#7519e9]/40 bg-[#100520] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {pendingAction?.type === "delete" && <ShieldAlert className="text-red-400" />}
              {pendingAction?.type === "delete"
                ? "Delete this user?"
                : pendingAction?.nextRole === "admin"
                  ? "Make this user an admin?"
                  : "Demote this admin?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/55">
              {pendingAction?.type === "delete"
                ? `This permanently deletes ${pendingAction.user.email}, their wallet, purchases, and transaction history. This action cannot be undone.`
                : `${pendingAction?.user.email} will ${pendingAction?.nextRole === "admin" ? "gain access to" : "lose access to"} the admin dashboard.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changing !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={pendingAction?.type === "delete" ? "destructive" : "default"}
              disabled={changing !== null}
              onClick={(event) => { event.preventDefault(); void confirmAction(); }}
            >
              {changing !== null ? "Saving..." : pendingAction?.type === "delete" ? "Delete User" : "Confirm Change"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
