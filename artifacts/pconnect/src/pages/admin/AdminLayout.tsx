import { Outlet, Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "@/lib/pconnect-api.ts";
import {
  LayoutDashboard, Ticket, ShoppingCart, Users, Settings2, Menu, X, ChevronRight, Home, Cog, Gift, UserPlus, LineChart,
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/pconnect-api.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { useSiteName } from "@/lib/site-settings.ts";

const ADMIN_NAV = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Plans", to: "/admin/plans", icon: Cog },
  { label: "Inventory", to: "/admin/inventory", icon: Ticket },
  { label: "Purchases", to: "/admin/purchases", icon: ShoppingCart },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Bonus", to: "/admin/bonus", icon: Gift },
  { label: "Referrals", to: "/admin/referrals", icon: UserPlus },
  { label: "Analytics", to: "/admin/analytics", icon: LineChart },
  { label: "Settings", to: "/admin/settings", icon: Settings2 },
];

function RedirectToAdminLogin() {
  const navigate = useNavigate();
  useEffect(() => { void navigate("/admin/login", { replace: true }); }, [navigate]);
  return null;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const me = useQuery(api.users.getCurrentUser, {});

  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }
  if (!me || me.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function AdminLayout() {
  const location = useLocation();
  const siteName = useSiteName();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <Unauthenticated>
        <RedirectToAdminLogin />
      </Unauthenticated>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <Skeleton className="h-10 w-40" />
        </div>
      </AuthLoading>
      <Authenticated>
        <AdminGuard>
          <div className="flex min-h-screen w-full min-w-0 overflow-x-hidden bg-[#0a0316]">
            <aside className="hidden w-56 shrink-0 flex-col border-r border-white/10 bg-[#100520] md:flex">
              <div className="px-4 py-5">
                <div className="text-sm font-bold text-white/40 uppercase tracking-widest">Admin Panel</div>
              </div>
              <nav className="flex flex-col gap-1 px-2 pb-6">
                {ADMIN_NAV.map(({ label, to, icon: Icon, exact }) => {
                  const isExactAdmin = to === "/admin" && location.pathname === "/admin";
                  const isActive = exact
                    ? isExactAdmin
                    : location.pathname.startsWith(to) && to !== "/admin";
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-[#7519e9]/20 text-white"
                          : "text-white/50 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  );
                })}
                <div className="mt-auto pt-4 border-t border-white/10">
                  <Link
                    to="/"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <Home size={16} />
                    Home
                  </Link>
                </div>
              </nav>
            </aside>

             <div className="relative flex min-w-0 flex-1 flex-col">
               <div className="sticky top-0 z-40">
               <header className="flex items-center justify-between border-b border-white/10 bg-[#100520]/95 px-4 py-3 shadow-lg shadow-black/10 backdrop-blur-xl md:px-8 md:py-4">
                 <div>
                   <div className="text-sm font-bold uppercase tracking-widest text-white/70">Admin Panel</div>
                     <div className="mt-0.5 hidden text-xs text-white/35 md:block">Manage your {siteName} workspace</div>
                 </div>
                 <button
                   type="button"
                   aria-label={mobileOpen ? "Close admin navigation" : "Open admin navigation"}
                   aria-expanded={mobileOpen}
                   onClick={() => setMobileOpen(v => !v)}
                   className="cursor-pointer rounded-lg p-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white md:hidden"
                 >
                   {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                 </button>
               </header>

               {mobileOpen && (
                 <div className="absolute inset-x-0 top-full border-b border-white/10 bg-[#100520] px-2 py-3 shadow-2xl shadow-black/30 md:hidden">
                  {ADMIN_NAV.map(({ label, to, icon: Icon }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
                    >
                      <Icon size={16} /> {label} <ChevronRight size={14} className="ml-auto opacity-40" />
                    </Link>
                  ))}
                  <div className="mt-1 border-t border-white/10 pt-1">
                    <Link
                      to="/"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
                    >
                      <Home size={16} /> Home <ChevronRight size={14} className="ml-auto opacity-40" />
                    </Link>
                  </div>
                </div>
               )}
               </div>

                 <main className="min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-4 pb-8 md:p-8 md:pb-10">
                <Outlet />
              </main>
            </div>
          </div>
        </AdminGuard>
      </Authenticated>
    </>
  );
}
