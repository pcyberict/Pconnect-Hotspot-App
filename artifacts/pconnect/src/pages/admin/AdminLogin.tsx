import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth.ts";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { user, isLoading, signinRedirect } = useAuth();
  useEffect(() => {
    if (!isLoading && user) void navigate("/admin", { replace: true });
  }, [isLoading, user, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-[#080116]">
      <div className="w-full max-w-sm rounded-2xl border border-[#7519e9]/30 bg-[#10051f] p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7519e9]/20">
          <ShieldCheck size={24} className="text-purple-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Admin Access</h1>
        <p className="mt-2 text-sm text-white/50">Sign in with your admin account to continue.</p>
        <Button size="lg" variant="glossy" className="mt-6 w-full" disabled={isLoading} onClick={() => void signinRedirect()}>
          {isLoading ? <Spinner className="size-4" /> : "Sign In"}
        </Button>
      </div>
    </div>
  );
}
