import { useAuthState } from "@/components/providers/auth.tsx";

export function useAuth() {
  return useAuthState();
}

export function useUser() {
  return useAuthState().user;
}
