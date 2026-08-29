import { cn } from "@/lib/utils.ts";
import { useSiteName } from "@/lib/site-settings.ts";
import { useSiteAsset } from "@/lib/site-settings.ts";

export default function Logo({ className, variant = "site" }: { className?: string; variant?: "site" | "footer" }) {
  const siteName = useSiteName();
  const logo = useSiteAsset(variant === "footer" ? "footer_logo" : "site_logo", "/images/site-logo.webp");

  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={logo}
        alt={siteName}
        width={768}
        height={512}
        loading={variant === "footer" ? "lazy" : "eager"}
        decoding="async"
        fetchPriority={variant === "footer" ? "low" : "high"}
        className="w-40 mix-blend-screen md:w-56"
        style={{ height: "auto" }}
      />
    </div>
  );
}
