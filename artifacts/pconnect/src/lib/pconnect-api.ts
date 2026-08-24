import { useMutation as useReactMutation, useQuery as useReactQuery, useQueryClient } from "@tanstack/react-query";
import { createElement } from "react";
import { useAuthState } from "@/components/providers/auth.tsx";

type Endpoint = string;
type Args = Record<string, unknown>;

const endpoint = (path: string): Endpoint => path;

export const api = {
  users: {
    getCurrentUser: endpoint("users.getCurrentUser"),
    updateCurrentUser: endpoint("users.updateCurrentUser"),
    updateMyProfile: endpoint("users.updateMyProfile"),
    changePassword: endpoint("users.changePassword"),
  },
  wallets: { getMyWallet: endpoint("wallets.getMyWallet"), generateVirtualAccount: endpoint("wallets.generateVirtualAccount") },
  wallet: {
    deposits: {
      getMyDepositHistory: endpoint("wallet.deposits.getMyDepositHistory"),
      createPendingDeposit: endpoint("wallet.deposits.createPendingDeposit"),
      verifyDepositById: endpoint("wallet.deposits.verifyDepositById"),
      createVirtualAccount: endpoint("wallet.deposits.createVirtualAccount"),
      pollBankTransfer: endpoint("wallet.deposits.pollBankTransfer"),
    },
  },
  voucherPlans: {
    listActivePlans: endpoint("voucherPlans.listActivePlans"),
    listAllPlans: endpoint("voucherPlans.listAllPlans"),
    createPlan: endpoint("voucherPlans.createPlan"),
    updatePlan: endpoint("voucherPlans.updatePlan"),
  },
  vouchers: {
    getMyPurchases: endpoint("vouchers.getMyPurchases"),
    purchaseVoucher: endpoint("vouchers.purchaseVoucher"),
    getAdminStats: endpoint("vouchers.getAdminStats"),
    getInventoryCounts: endpoint("vouchers.getInventoryCounts"),
    listVouchersAdminRich: endpoint("vouchers.listVouchersAdminRich"),
    listAllPurchases: endpoint("vouchers.listAllPurchases"),
    listAllUsers: endpoint("vouchers.listAllUsers"),
    createUser: endpoint("vouchers.createUser"),
    setUserRole: endpoint("vouchers.setUserRole"),
    deleteUser: endpoint("vouchers.deleteUser"),
    setVoucherStatus: endpoint("vouchers.setVoucherStatus"),
    deleteVoucher: endpoint("vouchers.deleteVoucher"),
    bulkImportVouchers: endpoint("vouchers.bulkImportVouchers"),
    createSingleVoucher: endpoint("vouchers.createSingleVoucher"),
      manualFunding: endpoint("vouchers.manualFunding"),
  },
  siteSettings: {
    get: endpoint("siteSettings.get"),
    getAll: endpoint("siteSettings.getAll"),
    getPublicKey: endpoint("siteSettings.getPublicKey"),
    getMaskedSecret: endpoint("siteSettings.getMaskedSecret"),
    setBulk: endpoint("siteSettings.setBulk"),
    setSecret: endpoint("siteSettings.setSecret"),
  },
  notifications: {
    listMine: endpoint("notifications.listMine"),
    markRead: endpoint("notifications.markRead"),
    markAllRead: endpoint("notifications.markAllRead"),
  },
  referrals: {
    getMine: endpoint("referrals.getMine"),
    getAdmin: endpoint("referrals.getAdmin"),
  },
  analytics: { getAdmin: endpoint("analytics.getAdmin") },
};

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

async function request(fn: Endpoint, args: Args = {}, method: "GET" | "POST" = "GET") {
  const token = localStorage.getItem("pconnect-token") ?? "demo-user";
  const params = new URLSearchParams();
  Object.entries(args).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.set(key, typeof value === "string" ? value : JSON.stringify(value));
  });
  const paths: Record<string, string> = {
    "users.getCurrentUser": "me",
    "users.updateCurrentUser": "users/sync",
    "users.updateMyProfile": "users/profile",
    "users.changePassword": "users/change-password",
    "wallets.getMyWallet": "wallet",
    "wallets.generateVirtualAccount": "wallet/virtual-account",
    "wallet.deposits.getMyDepositHistory": "deposits",
    "wallet.deposits.createPendingDeposit": "deposits",
    "wallet.deposits.verifyDepositById": "deposits/verify",
    "wallet.deposits.createVirtualAccount": "deposits/virtual-account",
    "wallet.deposits.pollBankTransfer": "deposits/poll",
    "voucherPlans.listActivePlans": "plans",
    "voucherPlans.listAllPlans": "admin/plans",
    "voucherPlans.createPlan": "admin/plans",
    "voucherPlans.updatePlan": "admin/plans",
    "vouchers.getMyPurchases": "purchases",
    "vouchers.purchaseVoucher": "purchase",
    "vouchers.getAdminStats": "admin/stats",
    "vouchers.getInventoryCounts": "admin/inventory/counts",
    "vouchers.listVouchersAdminRich": "admin/inventory",
    "vouchers.listAllPurchases": "admin/purchases",
    "vouchers.listAllUsers": "admin/users",
    "vouchers.createUser": "admin/users",
    "vouchers.setUserRole": "admin/users/role",
    "vouchers.deleteUser": "admin/users/delete",
    "vouchers.setVoucherStatus": "admin/inventory/status",
    "vouchers.deleteVoucher": "admin/inventory/delete",
    "vouchers.bulkImportVouchers": "admin/inventory/import",
    "vouchers.createSingleVoucher": "admin/inventory/create",
    "vouchers.manualFunding": "admin/users/manual-funding",
    "siteSettings.get": "settings",
    "siteSettings.getAll": "settings",
    "siteSettings.getPublicKey": "settings/public-key",
    "siteSettings.getMaskedSecret": "settings/masked",
    "siteSettings.setBulk": "settings",
    "siteSettings.setSecret": "settings/secret",
    "notifications.listMine": "notifications",
    "notifications.markRead": "notifications/read",
    "notifications.markAllRead": "notifications/read-all",
    "referrals.getMine": "referrals",
    "referrals.getAdmin": "admin/referrals",
    "analytics.getAdmin": "admin/analytics",
  };
  const url = `${API_BASE}/${paths[fn] ?? fn}${method === "GET" && params.size ? `?${params}` : ""}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "x-pconnect-token": token },
      ...(method === "POST" ? { body: JSON.stringify(args) } : {}),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The request timed out. Please check the connection and try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  const body = await response.json().catch(() => undefined);
  if (body === undefined) {
    throw new Error("The API server is unavailable. Please check the server and database connection.");
  }
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  // Settings keys are user-configured database keys (for example,
  // `site_name` and `smtp_host`), not API response property names. Keep them
  // untouched so the admin form can rehydrate the same keys after navigation.
  if (fn === "siteSettings.getAll") return body;
  const camelize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(camelize);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      // `_id` and `_creationTime` are compatibility fields used by the
      // migrated Pconnect screens. Keep their leading underscore intact so
      // identifiers continue to work in edit forms and select values.
      key.startsWith("_") ? key : key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      camelize(item),
    ]));
  };
  return camelize(body);
}

export function useQuery<T = any>(fn: Endpoint, args: Args | "skip" = {}) {
  const { isAuthenticated } = useAuthState();
  const enabled = args !== "skip" && (
    fn.startsWith("siteSettings") ||
    fn === "voucherPlans.listActivePlans" ||
    isAuthenticated
  );
  const query = useReactQuery<any>({
    queryKey: ["pconnect", fn, args],
    queryFn: () => request(fn, args === "skip" ? {} : args),
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: fn.startsWith("siteSettings"),
    refetchInterval: fn === "siteSettings.get" || fn === "wallets.getMyWallet" || fn === "wallet.deposits.getMyDepositHistory" ? 5_000 : false,
  });
  return query.data as T | undefined;
}

function useEndpointMutation(fn: Endpoint) {
  const client = useQueryClient();
  const mutation = useReactMutation<any, Error, Args>({
    mutationFn: (args: Args = {}) => request(fn, args, "POST"),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["pconnect"] }),
  });
  return (args: Args = {}) => mutation.mutateAsync(args);
}

export function useMutation(fn: Endpoint) {
  return useEndpointMutation(fn);
}

export function useAction(fn: Endpoint) {
  return useEndpointMutation(fn);
}

export function useConvexAuth() {
  const { isAuthenticated, isLoading } = useAuthState();
  return { isAuthenticated, isLoading };
}

export function Authenticated({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthState();
  return !isLoading && isAuthenticated ? createElement("div", { className: "contents" }, children) : null;
}

export function Unauthenticated({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthState();
  return !isLoading && !isAuthenticated ? createElement("div", { className: "contents" }, children) : null;
}

export function AuthLoading({ children }: { children: React.ReactNode }) {
  return useAuthState().isLoading ? createElement("div", { className: "contents" }, children) : null;
}