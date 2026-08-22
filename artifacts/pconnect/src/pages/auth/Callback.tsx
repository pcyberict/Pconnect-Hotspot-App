import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useSiteName } from "@/lib/site-settings.ts";

export default function AuthCallback() {
  const navigate = useNavigate();
  const siteName = useSiteName();

  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Returning to {siteName}...</p>
    </div>
  );
}
