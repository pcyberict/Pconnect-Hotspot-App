import { cn } from "@/lib/utils.ts";
import { useSiteName } from "@/lib/site-settings.ts";
import { useSiteAsset } from "@/lib/site-settings.ts";

export default function Logo({ className, variant = "site" }: { className?: string; variant?: "site" | "footer" }) {
  const siteName = useSiteName();
  const logo = useSiteAsset(variant === "footer" ? "footer_logo" : "site_logo", "https://hercules-cdn.com/file_PDusWTTXoxwuVrGaJFbrGp0y");

  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={logo}
        alt={siteName}
        className="w-40 mix-blend-screen md:w-56"
        style={{ height: "auto" }}
      />
    </div>
  );
}
