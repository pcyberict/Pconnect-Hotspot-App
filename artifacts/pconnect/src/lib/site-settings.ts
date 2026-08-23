import { api, useQuery } from "@/lib/pconnect-api.ts";
import { useEffect } from "react";

export const DEFAULT_SITE_NAME = "PCYBER CONNECT";

export function useSiteName() {
  const siteName = useQuery<string | null>(api.siteSettings.get, { key: "site_name" });
  const resolvedSiteName = siteName?.trim() || DEFAULT_SITE_NAME;

  useEffect(() => {
    document.title = `${resolvedSiteName} | Fast Internet Vouchers`;
    document.querySelector('meta[name="author"]')?.setAttribute("content", resolvedSiteName);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", `${resolvedSiteName} | Fast Internet Vouchers`);
  }, [resolvedSiteName]);

  return resolvedSiteName;
}

export function useSiteAsset(key: string, fallback: string) {
  const value = useQuery<string | null>(api.siteSettings.get, { key });
  return value?.trim() || fallback;
}