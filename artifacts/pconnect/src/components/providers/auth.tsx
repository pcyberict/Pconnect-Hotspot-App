import { createContext, useContext, useEffect, useMemo, useState } from "react";

type DemoUser = { profile: { name: string; email: string }; role?: "admin" | "user" };
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const AuthContext = createContext<{
  user: DemoUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signinRedirect: () => Promise<void>;
  signout: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string, referralCode?: string) => Promise<{ verificationRequired: boolean; email: string }>;
}>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  signinRedirect: async () => {},
  signout: async () => {},
  login: async () => {},
  register: async () => ({ verificationRequired: false, email: "" }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ token: string; user: DemoUser } | null>(() => {
    const token = localStorage.getItem("pconnect-token");
    const saved = localStorage.getItem("pconnect-user");
    return token && saved ? { token, user: JSON.parse(saved) as DemoUser } : null;
  });
  const value = useMemo(() => {
    const authenticated = Boolean(session);
    const save = (data: { token: string; user: DemoUser }) => {
      localStorage.setItem("pconnect-token", data.token);
      localStorage.setItem("pconnect-user", JSON.stringify(data.user));
      setSession(data);
    };
    return {
      user: session?.user ?? null,
      isAuthenticated: authenticated,
      isLoading: false,
      signinRedirect: async () => {},
      login: async (email: string, password: string) => {
        const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
         const data = await response.json().catch(() => null);
         if (!data) throw new Error("The API server is unavailable. Please try again shortly.");
        if (!response.ok) throw new Error(data.error ?? "Login failed");
        save({ token: data.token, user: { profile: { name: data.user.name, email: data.user.email }, role: data.user.role } });
      },
      register: async (name: string, email: string, phone: string, password: string, referralCode?: string) => {
        const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, phone, password, referralCode }) });
        const data = await response.json().catch(() => null);
        if (!data) throw new Error("The API server is unavailable. Please try again shortly.");
        if (!response.ok) throw new Error(data.error ?? "Registration failed");
        if (data.verificationRequired) return { verificationRequired: true, email: data.email };
        save({ token: data.token, user: { profile: { name: data.user.name, email: data.user.email }, role: data.user.role } });
        return { verificationRequired: false, email };
      },
      signout: async () => {
        const token = localStorage.getItem("pconnect-token");
        if (token) {
          try {
            await fetch("/api/auth/logout", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-pconnect-token": token },
            });
          } catch {
            // Clear the browser session even if the API is temporarily unavailable.
          }
        }
        localStorage.removeItem("pconnect-token");
        localStorage.removeItem("pconnect-user");
        setSession(null);
      },
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;

    let timeoutId: number;
    const resetIdleTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        void value.signout();
      }, IDLE_TIMEOUT_MS);
    };
    const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "pconnect-token" && !event.newValue) setSession(null);
    };

    resetIdleTimer();
    window.addEventListener("storage", handleStorage);
    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
      window.removeEventListener("storage", handleStorage);
    };
  }, [session, value.signout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthState() { return useContext(AuthContext); }
