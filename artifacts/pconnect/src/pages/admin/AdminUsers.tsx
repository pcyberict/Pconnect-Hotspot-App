import { useState, type FormEvent } from "react";
import { useQuery, useMutation } from "@/lib/pconnect-api.ts";
import { toast } from "sonner";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";
import { api } from "@/lib/pconnect-api.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
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
  const createUser = useMutation(api.vouchers.createUser);
  const setRole = useMutation(api.vouchers.setUserRole);
  const deleteUser = useMutation(api.vouchers.deleteUser);
  const [changing, setChanging] = useState<Id<"users"> | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", phone: "", password: "", role: "user" as "admin" | "user" });
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

  const submitNewUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    try {
      await createUser(newUser);
      toast.success(`${newUser.email} was added as a ${newUser.role === "admin" ? "admin" : "regular user"}`);
      setNewUser({ name: "", email: "", phone: "", password: "", role: "user" });
      setShowCreate(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "User could not be created");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Users</h1>
          <p className="text-sm text-white/40">Add accounts and manage access to the dashboard.</p>
        </div>
        <Button size="sm" variant="glossy" onClick={() => setShowCreate((value) => !value)}>
          <Plus size={14} />
          {showCreate ? "Hide form" : "New account"}
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-8 border-white/10 bg-[#1a0b30]/60 text-white">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="text-base">Add a new user</CardTitle>
            <CardDescription className="text-white/45">Create login credentials and choose whether this account can access admin tools.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={(event) => void submitNewUser(event)} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-user-name" className="text-white/70">Full name</Label>
                <Input id="new-user-name" required value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} placeholder="Jane Doe" className="border-white/10 bg-[#1a0b30]/60 text-white placeholder:text-white/25" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-email" className="text-white/70">Email address</Label>
                <Input id="new-user-email" required type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} placeholder="jane@example.com" className="border-white/10 bg-[#1a0b30]/60 text-white placeholder:text-white/25" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-phone" className="text-white/70">Phone <span className="text-white/35">(optional)</span></Label>
                <Input id="new-user-phone" type="tel" value={newUser.phone} onChange={(event) => setNewUser({ ...newUser, phone: event.target.value })} placeholder="+234 ..." className="border-white/10 bg-[#1a0b30]/60 text-white placeholder:text-white/25" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-password" className="text-white/70">Temporary password</Label>
                <Input id="new-user-password" required minLength={6} type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} placeholder="At least 6 characters" className="border-white/10 bg-[#1a0b30]/60 text-white placeholder:text-white/25" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-role" className="text-white/70">Role</Label>
                <select id="new-user-role" value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value as "admin" | "user" })} className="flex h-9 w-full rounded-md border border-white/10 bg-[#1a0b30]/60 px-3 py-1 text-sm text-white shadow-sm focus:outline-none focus:ring-1 focus:ring-[#7519e9]">
                  <option value="user">Regular user</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={creating} className="w-full md:w-auto">
                  <Plus size={16} />
                  {creating ? "Creating..." : "Create user"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
