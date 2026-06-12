"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getIdToken } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { roleLabel, type PortalRole } from "@/lib/auth-roles";

type AuthContextValue = {
  user: User | null;
  role: PortalRole | null;
  roleDisplay: string;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function verifyPortalAccess(user: User): Promise<PortalRole | null> {
  const token = await getIdToken(user);
  const res = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { authorized?: boolean; role?: PortalRole };
  return data.authorized && data.role ? data.role : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<PortalRole | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
    setUser(null);
    setRole(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const auth = getFirebaseAuth();
    const current = auth.currentUser;
    if (!current) {
      setRole(null);
      return;
    }
    const nextRole = await verifyPortalAccess(current);
    if (!nextRole) {
      await signOut();
      setRole(null);
      return;
    }
    setRole(nextRole);
  }, [signOut]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setRole(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      void verifyPortalAccess(nextUser)
        .then(async (nextRole) => {
          if (!nextRole) {
            await firebaseSignOut(auth);
            setUser(null);
            setRole(null);
            return;
          }
          setRole(nextRole);
        })
        .catch(async () => {
          await firebaseSignOut(auth);
          setUser(null);
          setRole(null);
        })
        .finally(() => setLoading(false));
    });
    return unsub;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      roleDisplay: role ? roleLabel(role) : "",
      loading,
      signOut,
      refreshProfile,
    }),
    [user, role, loading, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
