import { Outlet, Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "@/lib/pconnect-api.ts";
import {
  LayoutDashboard, Ticket, ShoppingCart, Users, Settings2, Menu, X, ChevronRight, Home, Cog,
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/pconnect-api.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";

const ADMIN_NAV = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Plans", to: "/admin/plans", icon: Cog },
  { label: "Inventory", to: "/admin/inventory", icon: Ticket },
  { label: "Purchases", to: "/admin/purchases", icon: ShoppingCart },
  { label: "Users", to: "/admin/users", icon: Users },
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
          <div className="flex min-h-screen bg-[#0a0316]">
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

            <div className="flex flex-1 flex-col">
              <header className="flex items-center justify-between border-b border-white/10 bg-[#100520] px-4 py-3 md:hidden">
                <span className="text-sm font-bold text-white/70">Admin Panel</span>
                <button onClick={() => setMobileOpen(v => !v)} className="cursor-pointer text-white/60">
                  {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </header>

              {mobileOpen && (
                <div className="border-b border-white/10 bg-[#100520] px-2 py-3 md:hidden">
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

              <main className="flex-1 overflow-auto p-4 md:p-8">
                <Outlet />
              </main>
            </div>
          </div>
        </AdminGuard>
      </Authenticated>
    </>
  );
}
