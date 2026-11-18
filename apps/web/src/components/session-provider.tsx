"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type User } from "@/lib/api";

const SessionContext = createContext<User | null>(null);

/**
 * Loads the logged-in user once, from GET /api/auth/me, and shares it with
 * every page inside. The login cookie is httpOnly, so asking the API is the
 * only way the browser can know who is logged in. Redirects to /login when
 * there's no valid session. Children only render once the user is known.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.me().then(
      ({ user }) => active && setUser(user),
      (err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
        else setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      },
    );
    return () => {
      active = false;
    };
  }, [router]);

  if (!user) {
    return <p className="m-auto p-8 text-muted-foreground">{error ?? "Loading…"}</p>;
  }
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/** The logged-in user. Only use inside SessionProvider. */
export function useUser(): User {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useUser must be used inside <SessionProvider>");
  return user;
}
