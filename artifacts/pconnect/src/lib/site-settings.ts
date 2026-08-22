import { api, useQuery } from "@/lib/pconnect-api.ts";

export const DEFAULT_SITE_NAME = "PCYBER CONNECT";

export function useSiteName() {
  const siteName = useQuery<string | null>(api.siteSettings.get, { key: "site_name" });
  return siteName?.trim() || DEFAULT_SITE_NAME;
}