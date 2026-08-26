import { api, useQuery } from "@/lib/pconnect-api.ts";
import { useEffect } from "react";

export const DEFAULT_SITE_NAME = "PCYBER CONNECT";
const DEFAULT_FAVICON = "/favicon.svg";

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

export function useSiteFavicon() {
  const favicon = useQuery<string | null>(api.siteSettings.get, { key: "favicon" });
  const resolvedFavicon = favicon?.trim() || DEFAULT_FAVICON;

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = resolvedFavicon;
    link.type = resolvedFavicon.includes("svg") ? "image/svg+xml" : "image/webp";
  }, [resolvedFavicon]);
}