import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ShieldCheck, LogOut, Home, Ticket, Info, HeadphonesIcon } from "lucide-react";
import { Authenticated, Unauthenticated, AuthLoading, useQuery, useConvexAuth } from "@/lib/pconnect-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import Logo from "@/components/logo.tsx";
import { cn } from "@/lib/utils.ts";
import { api } from "@/lib/pconnect-api.ts";
import { useAuth } from "@/hooks/use-auth.ts";

const NAV_LINKS = [
  { label: "Home", to: "/", icon: Home },
  { label: "Buy Vouchers", to: "/plans", icon: Ticket },
  { label: "How It Works", to: "/how-it-works", icon: Info },
  { label: "Support", to: "/support", icon: HeadphonesIcon },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated } = useConvexAuth();
  const { signout } = useAuth();
  const me = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const isAdmin = me?.role === "admin";

  const handleSignOut = () => {
    void signout();
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#10051f]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between px-4 md:h-20 md:px-8">
        <Link to="/"><Logo /></Link>
        <nav className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} to={link.to} className={cn("flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", location.pathname === link.to && "text-foreground")}>
              <link.icon size={14} />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Authenticated>
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
            <Button asChild variant="glossy"><Link to="/login?tab=register">Register</Link></Button>
          </Unauthenticated>
          <AuthLoading><Skeleton className="h-9 w-24" /></AuthLoading>
        </div>
        <button type="button" aria-label="Toggle menu" className="cursor-pointer lg:hidden" onClick={() => setOpen((v) => !v)}>
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-white/10 bg-[#10051f] px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} to={link.to} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground">
                <link.icon size={15} />
                {link.label}
              </Link>
            ))}
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
                <Button asChild variant="glossy" onClick={() => setOpen(false)}><Link to="/login?tab=register">Register</Link></Button>
              </Unauthenticated>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
