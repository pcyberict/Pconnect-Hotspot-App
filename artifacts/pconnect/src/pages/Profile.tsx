import { useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading, useQuery, useMutation } from "@/lib/pconnect-api.ts";
import { toast } from "sonner";
import { User, Mail, Phone, Save, LogOut, ShieldCheck, LockKeyhole, Eye, EyeOff, Gift, Building2, Copy } from "lucide-react";
import { api } from "@/lib/pconnect-api.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth.ts";
import { getRegistrationUrl } from "@/lib/auth-redirect.ts";

function ProfileInner() {
  const me = useQuery(api.users.getCurrentUser, {});
  const wallet = useQuery<{ balance: number; virtualAccount?: { accountNumber: string; bankName: string; accountName: string } } | null>(api.wallets.getMyWallet, {});
  const generateVirtualAccount = useMutation(api.wallets.generateVirtualAccount);
  const updateProfile = useMutation(api.users.updateMyProfile);
  const changePassword = useMutation(api.users.changePassword);
  const { signout } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState({ current: false, next: false, confirm: false });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [identityType, setIdentityType] = useState<"bvn" | "nin">("bvn");
  const [identityNumber, setIdentityNumber] = useState("");
  const [generatingAccount, setGeneratingAccount] = useState(false);

  if (me != null && !initialized) {
    setName(me.name ?? "");
    setPhone(me.phone ?? "");
    setInitialized(true);
  }

  if (me === undefined || me === null) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-64 mb-8" />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: name || undefined, phone: phone || undefined });
      toast.success("Profile updated!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error updating profile");
    } finally { setSaving(false); }
  };

  const initials = (me.name ?? me.email ?? "U").slice(0, 2).toUpperCase();

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.next || !passwords.confirm) {
      toast.error("Complete all password fields");
      return;
    }
    if (passwords.next !== passwords.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword({ currentPassword: passwords.current, newPassword: passwords.next });
      toast.success("Password changed successfully");
      setPasswords({ current: "", next: "", confirm: "" });
      setShowPasswordForm(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error changing password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleGenerateAccount = async () => {
    if (!/^\d{11}$/.test(identityNumber.replace(/\s/g, ""))) {
      toast.error(`Enter a valid 11-digit ${identityType.toUpperCase()}`);
      return;
    }
    setGeneratingAccount(true);
    try {
      await updateProfile({ name: name || undefined, phone: phone || undefined });
      await generateVirtualAccount({ identityType, identityNumber: identityNumber.replace(/\s/g, "") });
      toast.success("Permanent bank details generated");
      setIdentityNumber("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate bank details");
    } finally {
      setGeneratingAccount(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-10 md:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">My Profile</h1>
        <p className="mt-1 text-sm text-white/40">Manage your personal account details.</p>
      </div>
      <div className="relative overflow-hidden rounded-3xl border border-[#7519e9]/40 bg-gradient-to-br from-[#7519e9]/35 via-[#b20ed2]/20 to-[#ff2549]/15 p-6 mb-5 shadow-[0_0_50px_rgba(117,25,233,0.15)]">
        <div className="pointer-events-none absolute -top-10 -right-10 size-44 rounded-full bg-[#df20ba]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 left-0 size-36 rounded-full bg-[#7519e9]/15 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7519e9] to-[#df20ba] text-white text-2xl font-extrabold shadow-lg shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-xl font-extrabold text-white truncate">{me.name || "No name set"}</div>
            <div className="text-sm text-white/50 truncate">{me.email ?? "No email"}</div>
            {me.role === "admin" && (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-[#7519e9]/40 bg-[#7519e9]/20 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
                <ShieldCheck size={11} /> Admin
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mb-5 flex items-center gap-4 rounded-3xl border border-[#df20ba]/25 bg-[#df20ba]/10 p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#df20ba]/20 text-pink-200"><Gift size={20} /></div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">Wallet balance</div>
          <div className="mt-1 text-2xl font-extrabold text-pink-200">₦{Number(wallet?.balance ?? 0).toLocaleString("en-NG")}</div>
          <p className="mt-1 text-xs text-white/45">Your welcome bonus and wallet funds are ready for voucher purchases.</p>
        </div>
      </div>
      <div className="mb-5 rounded-3xl border border-[#7519e9]/25 bg-[#23103e]/60 p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#7519e9]/20 text-purple-200"><Building2 size={20} /></div>
          <div><h2 className="font-semibold text-white">Permanent bank details</h2><p className="text-xs text-white/45">Generate a personal Flutterwave account for bank transfers.</p></div>
        </div>
        {wallet?.virtualAccount?.accountNumber ? (
          <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-black/15 p-4">
            {[
              ["Bank", wallet.virtualAccount.bankName],
              ["Account number", wallet.virtualAccount.accountNumber],
              ["Account name", wallet.virtualAccount.accountName],
            ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 text-sm"><span className="text-white/40">{label}</span><span className="flex items-center gap-2 font-semibold text-white">{value}{label === "Account number" && <button type="button" onClick={() => { void navigator.clipboard.writeText(value); toast.success("Account number copied"); }} className="text-purple-300"><Copy size={14} /></button>}</span></div>)}
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-[140px_1fr]">
              <select value={identityType} onChange={(event) => setIdentityType(event.target.value as "bvn" | "nin")} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none">
                <option value="bvn">BVN</option><option value="nin">NIN</option>
              </select>
              <input inputMode="numeric" maxLength={11} value={identityNumber} onChange={(event) => setIdentityNumber(event.target.value.replace(/\D/g, ""))} placeholder={`Enter your 11-digit ${identityType.toUpperCase()}`} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-[#7519e9]/60" />
            </div>
            <p className="mt-3 text-xs leading-5 text-white/35">Your identity number is sent securely to Flutterwave for verification and is not displayed or saved by Pconnect.</p>
            <Button variant="glossy" className="mt-4 w-full sm:w-auto" disabled={generatingAccount} onClick={() => void handleGenerateAccount()}>
              <Building2 size={14} /> {generatingAccount ? "Generating…" : "Generate bank details"}
            </Button>
          </>
        )}
      </div>
      <div className="relative overflow-hidden rounded-3xl border border-[#7519e9]/20 bg-gradient-to-br from-[#1a0b30]/90 via-[#150925]/90 to-[#0e0620]/90 shadow-[0_0_40px_rgba(117,25,233,0.06)]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#7519e9]/50 to-transparent" />
        <div className="p-6 space-y-5">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
              <User size={12} /> Full Name
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#7519e9]/60 focus:ring-1 focus:ring-[#7519e9]/40 transition-all" />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
              <Mail size={12} /> Email Address
            </label>
            <input type="email" value={me?.email ?? ""} disabled className="w-full rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-white/35 cursor-not-allowed" />
            <p className="mt-1.5 text-xs text-white/25 pl-1">Email is managed by your auth provider and cannot be changed here.</p>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
              <Phone size={12} /> Phone Number
            </label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 08012345678" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#7519e9]/60 focus:ring-1 focus:ring-[#7519e9]/40 transition-all" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="glossy" className="flex-1 h-11" disabled={saving} onClick={() => void handleSave()}>
              <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
            </Button>
            <Button variant="secondary" className="h-11 px-4 border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300" onClick={() => void signout()}>
              <LogOut size={14} /> Sign Out
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-5 rounded-3xl border border-[#7519e9]/20 bg-gradient-to-br from-[#1a0b30]/90 via-[#150925]/90 to-[#0e0620]/90 shadow-[0_0_40px_rgba(117,25,233,0.06)]">
        <div className="flex items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#7519e9]/20 text-purple-300"><LockKeyhole size={18} /></div>
            <div>
              <h2 className="font-semibold text-white">Password</h2>
              <p className="text-xs text-white/40">Update your account login password.</p>
            </div>
          </div>
          <Button variant="secondary" className="shrink-0" onClick={() => setShowPasswordForm(value => !value)}>
            {showPasswordForm ? "Cancel" : "Change password"}
          </Button>
        </div>
        {showPasswordForm && (
          <div className="space-y-4 border-t border-white/10 p-6">
            {([
              ["current", "Current password"],
              ["next", "New password"],
              ["confirm", "Confirm new password"],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">{label}</label>
                <div className="relative">
                  <input
                    type={showPasswords[key] ? "text" : "password"}
                    value={passwords[key]}
                    onChange={event => setPasswords(value => ({ ...value, [key]: event.target.value }))}
                    autoComplete={key === "current" ? "current-password" : "new-password"}
                    minLength={key !== "current" ? 6 : undefined}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 pr-11 text-sm text-white placeholder-white/25 focus:border-[#7519e9]/60 focus:outline-none focus:ring-1 focus:ring-[#7519e9]/40"
                  />
                  <button type="button" onClick={() => setShowPasswords(value => ({ ...value, [key]: !value[key] }))} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70">
                    {showPasswords[key] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}
            <Button variant="glossy" className="w-full sm:w-auto" disabled={passwordSaving} onClick={() => void handleChangePassword()}>
              <LockKeyhole size={14} /> {passwordSaving ? "Changing password…" : "Save new password"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  const location = useLocation();
  const registrationUrl = getRegistrationUrl(`${location.pathname}${location.search}${location.hash}`);

  return (
    <>
      <Authenticated><ProfileInner /></Authenticated>
      <Unauthenticated>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-bold">Sign in to view your profile</h1>
          <Button asChild variant="glossy"><Link to={registrationUrl}>Create an Account</Link></Button>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="mx-auto max-w-xl px-4 py-12">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64 mb-8" />
          <Skeleton className="h-72 w-full rounded-3xl" />
        </div>
      </AuthLoading>
    </>
  );
}
