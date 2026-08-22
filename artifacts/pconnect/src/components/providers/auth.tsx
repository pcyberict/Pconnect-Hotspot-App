import { createContext, useContext, useMemo, useState } from "react";

type DemoUser = { profile: { name: string; email: string } };
const AuthContext = createContext<{
  user: DemoUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signinRedirect: () => Promise<void>;
  signout: () => Promise<void>;
}>({ user: null, isAuthenticated: false, isLoading: false, signinRedirect: async () => {}, signout: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem("pconnect-token"));
  const value = useMemo(() => {
    const authenticated = Boolean(token);
    return {
      user: authenticated ? { profile: { name: "Demo Customer", email: "demo@pconnect.local" } } : null,
      isAuthenticated: authenticated,
      isLoading: false,
      signinRedirect: async () => { localStorage.setItem("pconnect-token", "demo-user"); setToken("demo-user"); },
      signout: async () => { localStorage.removeItem("pconnect-token"); setToken(null); },
    };
  }, [token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthState() { return useContext(AuthContext); }
