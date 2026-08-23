export function getRegistrationUrl(destination: string) {
  return `/register?redirect=${encodeURIComponent(destination)}`;
}

export function getPostAuthDestination(redirect: string | null) {
  if (!redirect || !redirect.startsWith("/")) return "/dashboard";
  return redirect;
}