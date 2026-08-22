import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import AppLayout from "./components/app-layout.tsx";
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import AdminOverview from "./pages/admin/AdminOverview.tsx";
import AdminPlans from "./pages/admin/AdminPlans.tsx";
import AdminInventory from "./pages/admin/AdminInventory.tsx";
import AdminPurchases from "./pages/admin/AdminPurchases.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import AdminSettings from "./pages/admin/AdminSettings.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import AdminLogin from "./pages/admin/AdminLogin.tsx";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import PlansPage from "./pages/Plans.tsx";
import MyVouchersPage from "./pages/MyVouchers.tsx";
import PurchasesPage from "./pages/Purchases.tsx";
import WalletPage from "./pages/Wallet.tsx";
import Profile from "./pages/Profile.tsx";
import NotificationsPage from "./pages/Notifications.tsx";
import ComingSoon from "./pages/ComingSoon.tsx";
import NotFound from "./pages/NotFound.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="plans" element={<AdminPlans />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="purchases" element={<AdminPurchases />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/my-vouchers" element={<MyVouchersPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/how-it-works" element={<ComingSoon />} />
            <Route path="/support" element={<ComingSoon />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<NotificationsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
