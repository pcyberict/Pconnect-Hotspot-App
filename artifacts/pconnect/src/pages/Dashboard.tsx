import { Link, Navigate, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/pconnect-api.ts";
import { useQuery } from "@/lib/pconnect-api.ts";
import { Wallet, Ticket, Receipt, MessageCircle, ArrowRight } from "lucide-react";
import { api } from "@/lib/pconnect-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { formatNaira } from "@/lib/plans.ts";
import { WHATSAPP_GROUP_URL } from "@/lib/whatsapp.ts";
import { getRegistrationUrl } from "@/lib/auth-redirect.ts";

function DashboardInner() {
  const { user } = useAuth();
  const wallet = useQuery(api.wallets.getMyWallet, {});
  const firstName = user?.profile.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
        Welcome back, {firstName}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {"Here's a quick look at your account."}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#7519e9]/30 via-[#b20ed2]/20 to-[#ff2549]/20 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="size-4" />
            Wallet Balance
          </div>
          {wallet === undefined ? (
            <Skeleton className="mt-3 h-9 w-32" />
          ) : (
            <div className="mt-2 text-3xl font-bold">
              {formatNaira(wallet?.balance ?? 0)}
            </div>
          )}
          <Button asChild variant="glossy" size="sm" className="mt-4">
            <Link to="/wallet">Fund Wallet</Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Ticket className="size-4" />
            Active Vouchers
          </div>
          <div className="mt-2 text-3xl font-bold">0</div>
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link to="/my-vouchers">View Vouchers</Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt className="size-4" />
            Total Purchases
          </div>
          <div className="mt-2 text-3xl font-bold">0</div>
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link to="/purchases">View History</Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="glossy" size="lg">
          <Link to="/plans">
            Buy Voucher Now
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noreferrer">
            <MessageCircle className="size-4" />
            WhatsApp Support
          </a>
        </Button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const location = useLocation();
  const registrationUrl = getRegistrationUrl(`${location.pathname}${location.search}${location.hash}`);

  return (
    <>
      <Authenticated>
        <DashboardInner />
      </Authenticated>
      <Unauthenticated>
        <Navigate to={registrationUrl} replace />
      </Unauthenticated>
      <AuthLoading>
        <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
          <Skeleton className="h-9 w-64" />
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
      </AuthLoading>
    </>
  );
}
