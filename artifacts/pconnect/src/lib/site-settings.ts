import { api, useQuery } from "@/lib/pconnect-api.ts";
import { DEFAULT_WHATSAPP_SUPPORT_NUMBER, getWhatsAppSupportUrl } from "@/lib/whatsapp.ts";
import { useEffect } from "react";

export const DEFAULT_SITE_NAME = "PCYBER CONNECT";
export const DEFAULT_SITE_TAGLINE = "Fast, reliable WiFi vouchers";
export const DEFAULT_WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/your-group-invite";
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

export function useWhatsAppGroupUrl() {
  return useSiteAsset("whatsapp_group_url", DEFAULT_WHATSAPP_GROUP_URL);
}

export function useWhatsAppSupportUrl(message?: string) {
  const supportNumber = useSiteAsset("whatsapp_support_number", DEFAULT_WHATSAPP_SUPPORT_NUMBER);
  return getWhatsAppSupportUrl(supportNumber, message);
}

export function useSiteFavicon() {
  const favicon = useQuery<string | null>(api.siteSettings.get, { key: "favicon" });
  const resolvedFavicon = favicon?.trim() || DEFAULT_FAVICON;

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("#site-favicon");
    if (!link) {
      link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    }
    if (!link) {
      link = document.createElement("link");
      document.head.appendChild(link);
    }
    link.id = "site-favicon";
    link.rel = "icon";
    link.href = resolvedFavicon;
    const dataMimeType = resolvedFavicon.match(/^data:([^;,]+)/i)?.[1];
    const isSvg = /\.svg(?:[?#]|$)/i.test(resolvedFavicon);
    if (dataMimeType || isSvg) {
      link.type = dataMimeType || "image/svg+xml";
    } else {
      link.removeAttribute("type");
    }
    document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach((candidate) => {
      if (candidate !== link) candidate.remove();
    });
  }, [resolvedFavicon]);
}