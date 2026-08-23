import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ShieldCheck, LogOut, Home, Ticket, UserRound, Bell, Gift } from "lucide-react";
import { Authenticated, Unauthenticated, AuthLoading, useQuery, useConvexAuth } from "@/lib/pconnect-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import Logo from "@/components/logo.tsx";
import { cn } from "@/lib/utils.ts";
import { api } from "@/lib/pconnect-api.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import { getRegistrationUrl } from "@/lib/auth-redirect.ts";

const NAV_LINKS = [
  { label: "Home", to: "/", icon: Home },
  { label: "Buy Vouchers", to: "/plans", icon: Ticket },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated } = useConvexAuth();
  const { signout } = useAuth();
  const me = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const notifications = useQuery<{ items: { id: string; readAt?: string | null }[]; unreadCount: number }>(api.notifications.listMine, isAuthenticated ? {} : "skip");
  const isAdmin = me?.role === "admin";
  const unreadCount = notifications?.unreadCount ?? 0;
  const hasNotifications = (notifications?.items.length ?? 0) > 0;
  const accountUrl = isAuthenticated ? "/profile" : getRegistrationUrl("/profile");

  const handleSignOut = () => {
    void signout();
    setOpen(false);
  };

  return (
    <header className="relative sticky top-0 z-40 border-b border-white/10 bg-[#10051f]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between px-4 md:h-20 md:px-8">
        <div className="flex items-center gap-3">
          <Link to="/"><Logo /></Link>
        </div>
        <nav className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} to={link.to} className={cn("flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", location.pathname === link.to && "text-foreground")}>
              <link.icon size={14} />
              {link.label}
            </Link>
          ))}
          <Authenticated>
            <Link to="/referrals" className={cn("flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", location.pathname === "/referrals" && "text-foreground")}>
              <Gift size={14} />
              Refer &amp; Earn
            </Link>
            <Link to="/profile" className={cn("flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", location.pathname === "/profile" && "text-foreground")}>
              <UserRound size={14} />
              Account
            </Link>
          </Authenticated>
          <Unauthenticated>
            <Link to={accountUrl} className={cn("flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", location.pathname === "/profile" && "text-foreground")}>
              <UserRound size={14} />
              Account
            </Link>
          </Unauthenticated>
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Authenticated>
              <Link
              to="/notifications"
              aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
              className="relative rounded-xl p-2.5 text-white transition-colors hover:bg-white/5 hover:text-[#df20ba]"
            >
              <Bell size={19} />
                {hasNotifications ? (
                  <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-[#df20ba] px-1 text-[10px] font-bold leading-4 text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : (
                  <span className="absolute right-0 top-0 size-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]" aria-hidden="true" />
                )}
            </Link>
            <Button asChild variant="secondary"><Link to="/dashboard">Dashboard</Link></Button>
            {isAdmin && (
              <Button asChild variant="secondary" className="gap-1.5 border border-purple-500/40 text-purple-300">
                <Link to="/admin"><ShieldCheck size={14} /> Admin</Link>
              </Button>
            )}
            <Button variant="secondary" className="gap-1.5 text-red-400 hover:text-red-300" onClick={handleSignOut}>
              <LogOut size={14} /> Sign Out
            </Button>
          </Authenticated>
          <Unauthenticated>
            <Button asChild variant="secondary"><Link to="/login">Login</Link></Button>
            <Button asChild variant="glossy"><Link to="/register">Register</Link></Button>
          </Unauthenticated>
          <AuthLoading><Skeleton className="h-9 w-24" /></AuthLoading>
        </div>
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <Authenticated>
            <Link
              to="/notifications"
              aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
              className="relative rounded-xl p-2 text-white transition-colors hover:bg-white/5 hover:text-[#df20ba]"
            >
              <Bell size={20} />
                {hasNotifications ? (
                  <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-[#df20ba] px-1 text-[10px] font-bold leading-4 text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : (
                  <span className="absolute right-0 top-0 size-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]" aria-hidden="true" />
                )}
            </Link>
          </Authenticated>
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            className="cursor-pointer rounded-lg p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="absolute inset-x-0 top-full border-t border-white/10 bg-[#10051f] px-4 py-4 shadow-2xl shadow-black/30 lg:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} to={link.to} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground">
                <link.icon size={15} />
                {link.label}
              </Link>
            ))}
            <Authenticated>
              <Link to="/referrals" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground">
                <Gift size={15} />
                Refer &amp; Earn
              </Link>
              <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground">
                <UserRound size={15} />
                Account
              </Link>
            </Authenticated>
            <Unauthenticated>
              <Link to={accountUrl} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground">
                <UserRound size={15} />
                Account
              </Link>
            </Unauthenticated>
            <div className="mt-2 flex flex-col gap-2">
              <Authenticated>
                <Button asChild variant="secondary" onClick={() => setOpen(false)}><Link to="/dashboard">Dashboard</Link></Button>
                {isAdmin && (
                  <Button asChild variant="secondary" className="gap-1.5 border border-purple-500/40 text-purple-300" onClick={() => setOpen(false)}>
                    <Link to="/admin"><ShieldCheck size={14} /> Admin</Link>
                  </Button>
                )}
                <Button variant="secondary" className="gap-1.5 text-red-400 hover:text-red-300" onClick={handleSignOut}>
                  <LogOut size={14} /> Sign Out
                </Button>
              </Authenticated>
              <Unauthenticated>
                <Button asChild variant="secondary" onClick={() => setOpen(false)}><Link to="/login">Login</Link></Button>
                <Button asChild variant="glossy" onClick={() => setOpen(false)}><Link to="/register">Register</Link></Button>
              </Unauthenticated>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
