import { Link, Outlet, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated } from "convex/react";
import { Home, Ticket, Wallet, History, User } from "lucide-react";
import SiteHeader from "@/components/site-header.tsx";
import SiteFooter from "@/components/site-footer.tsx";
import WhatsAppFloatingButton from "@/components/whatsapp-floating-button.tsx";
import { cn } from "@/lib/utils.ts";

const MOBILE_NAV_LINKS = [
  { label: "Home", to: "/", icon: Home },
  { label: "Plans", to: "/plans", icon: Ticket },
  { label: "Wallet", to: "/wallet", icon: Wallet },
  { label: "Vouchers", to: "/my-vouchers", icon: History },
  { label: "Account", to: "/profile", icon: User },
];

export default function AppLayout() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 pb-20 md:pb-0"><Outlet /></main>
      {/* Hide full footer on mobile when logged in; always show on desktop */}
      <Authenticated>
        <div className="hidden md:block"><SiteFooter /></div>
      </Authenticated>
      <Unauthenticated>
        <SiteFooter />
      </Unauthenticated>
      <WhatsAppFloatingButton />
      <Authenticated>
        <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-white/10 bg-[#10051f]/95 py-2 backdrop-blur-xl md:hidden">
          {MOBILE_NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const active = location.pathname === link.to;
            return (
              <Link key={link.label} to={link.to} className={cn("flex min-w-[44px] flex-col items-center gap-1 px-2 py-1 text-[11px] font-medium text-muted-foreground", active && "text-[#df20ba]")}>
                <Icon className="size-5" />{link.label}
              </Link>
            );
          })}
        </nav>
      </Authenticated>
    </div>
  );
}
