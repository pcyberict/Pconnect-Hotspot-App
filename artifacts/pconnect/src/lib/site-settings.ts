import { api, useQuery } from "@/lib/pconnect-api.ts";
import { useEffect } from "react";

export const DEFAULT_SITE_NAME = "PCYBER CONNECT";
export const DEFAULT_SITE_TAGLINE = "Fast, reliable WiFi vouchers";
const DEFAULT_FAVICON = "/favicon.svg";

export function useSiteName() {
  const siteName = useQuery<string | null>(api.siteSettings.get, { key: "site_name" });
  return siteName?.trim() || DEFAULT_SITE_NAME;
}

export function useSiteMetadata() {
  const siteName = useQuery<string | null>(api.siteSettings.get, { key: "site_name" });
  const tagline = useQuery<string | null>(api.siteSettings.get, { key: "site_tagline" });
  const resolvedSiteName = siteName?.trim() || DEFAULT_SITE_NAME;
  const resolvedTagline = tagline?.trim() || DEFAULT_SITE_TAGLINE;

  useEffect(() => {
    document.title = resolvedSiteName;
    document.querySelector('meta[name="description"]')?.setAttribute("content", resolvedTagline);
    document.querySelector('meta[name="author"]')?.setAttribute("content", resolvedSiteName);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", resolvedSiteName);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", resolvedTagline);
  }, [resolvedSiteName, resolvedTagline]);
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