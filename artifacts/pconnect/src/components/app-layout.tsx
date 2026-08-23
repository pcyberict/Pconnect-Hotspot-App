import { Link, Outlet, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated } from "@/lib/pconnect-api.ts";
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
    <div className="flex min-h-[100dvh] w-full max-w-full flex-col overflow-x-clip bg-background">
      <SiteHeader />
      <main className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"><Outlet /></main>
      {/* Hide full footer on mobile when logged in; always show on desktop */}
      <Authenticated>
        <div className="hidden shrink-0 md:block"><SiteFooter /></div>
      </Authenticated>
      <Unauthenticated>
        <SiteFooter />
      </Unauthenticated>
      <WhatsAppFloatingButton />
      <Authenticated>
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex min-h-[4.5rem] items-center justify-around border-t border-white/10 bg-[#10051f]/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.2)] backdrop-blur-xl md:hidden"
          style={{
            paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
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
