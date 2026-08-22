import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "@/lib/pconnect-api.ts";
import { Receipt } from "lucide-react";
import { api } from "@/lib/pconnect-api.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Link } from "react-router-dom";
import { formatNaira } from "@/lib/plans.ts";

type Purchase = {
  _id: string;
  planName: string;
  durationLabel: string;
  createdAt: string;
  amount: number;
  status: string;
};

function PurchasesInner() {
  const purchases = useQuery<Purchase[]>(api.vouchers.getMyPurchases, {});

  if (purchases === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-9 w-48 mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Purchase History</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        All your past voucher purchases.
      </p>

      {purchases.length === 0 ? (
        <Empty className="mt-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Receipt />
            </EmptyMedia>
            <EmptyTitle>No purchases yet</EmptyTitle>
            <EmptyDescription>
              Your purchase history will appear here after buying a voucher.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="glossy" size="sm">
              <Link to="/plans">Browse Plans</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {purchases.map((p) => (
            <div
              key={p._id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div>
                <div className="font-medium text-white">{p.planName}</div>
                <div className="text-xs text-muted-foreground">
                  {p.durationLabel} &middot; {new Date(p.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-white">{formatNaira(p.amount)}</div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                  {p.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <>
      <Authenticated>
        <PurchasesInner />
      </Authenticated>
      <Unauthenticated>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-bold">Sign in to view purchases</h1>
          <Button asChild variant="glossy">
            <Link to="/login">Sign In / Register</Link>
          </Button>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Skeleton className="h-9 w-48 mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </AuthLoading>
    </>
  );
}
