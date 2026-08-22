import { Bell, CheckCheck, CheckCircle2, Clock3, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "@/lib/pconnect-api.ts";
import { api } from "@/lib/pconnect-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

type Notification = {
  _id: string;
  title: string;
  message: string;
  type: string;
  readAt?: string | null;
  createdAt: string;
};

type NotificationResponse = {
  items: Notification[];
  unreadCount: number;
};

function timeSince(date: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "wallet") return <WalletCards size={18} />;
  if (type === "success") return <CheckCircle2 size={18} />;
  return <Bell size={18} />;
}

function NotificationsInner() {
  const data = useQuery<NotificationResponse>(api.notifications.listMine, {});
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-[#7519e9]/20 text-purple-300">
            <Bell size={21} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Notifications</h1>
          <p className="mt-1 text-sm text-white/40">Stay updated on your wallet and account activity.</p>
        </div>
        {!!data?.unreadCount && (
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={() => void markAllRead({})}
          >
            <CheckCheck size={15} /> Mark all read
          </Button>
        )}
      </div>

      {data === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-white/5 text-white/35">
            <Bell size={24} />
          </div>
          <h2 className="font-semibold text-white">You’re all caught up</h2>
          <p className="mt-1 text-sm text-white/40">New wallet and account updates will appear here.</p>
          <Button asChild variant="glossy" size="sm" className="mt-6">
            <Link to="/wallet">Fund Wallet</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((notification) => {
            const unread = !notification.readAt;
            return (
              <button
                type="button"
                key={notification._id}
                onClick={() => unread && void markRead({ notificationId: notification._id })}
                className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors ${
                  unread
                    ? "border-[#7519e9]/35 bg-[#7519e9]/10 hover:bg-[#7519e9]/15"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${unread ? "bg-[#7519e9]/25 text-purple-200" : "bg-white/5 text-white/35"}`}>
                  <NotificationIcon type={notification.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className={`text-sm font-semibold ${unread ? "text-white" : "text-white/70"}`}>{notification.title}</h2>
                    {unread && <span className="mt-1 size-2 shrink-0 rounded-full bg-[#df20ba]" />}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-white/50">{notification.message}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-white/30">
                    <Clock3 size={12} /> {timeSince(notification.createdAt)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <>
      <Authenticated><NotificationsInner /></Authenticated>
      <Unauthenticated>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-bold">Sign in to view notifications</h1>
          <Button asChild variant="glossy"><Link to="/login">Sign In / Register</Link></Button>
        </div>
      </Unauthenticated>
    </>
  );
}