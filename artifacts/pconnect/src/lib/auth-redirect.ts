export function getRegistrationUrl(destination: string) {
  return `/login?tab=register&redirect=${encodeURIComponent(destination)}#register`;
}

export function getPostAuthDestination(redirect: string | null) {
  if (!redirect || !redirect.startsWith("/")) return "/dashboard";
  return redirect;
}