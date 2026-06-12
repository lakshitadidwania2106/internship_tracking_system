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
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase-client";
import { resolveRoleFromEmail, roleLabel, type PortalRole } from "@/lib/auth-roles";

type AuthContextValue = {
  user: User | null;
  role: PortalRole | null;
  roleDisplay: string;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadOrCreateProfile(user: User): Promise<PortalRole> {
  const db = getFirebaseDb();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() as { role?: PortalRole };
    if (data.role === "admin" || data.role === "coordinator") {
      return data.role;
    }
  }
  const role = resolveRoleFromEmail(user.email);
  await setDoc(
    ref,
    {
      email: user.email ?? "",
      phone: user.phoneNumber ?? "",
      role,
      updatedAt: new Date().toISOString(),
      ...(snap.exists() ? {} : { createdAt: new Date().toISOString() }),
    },
    { merge: true },
  );
  return role;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<PortalRole | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const auth = getFirebaseAuth();
    const current = auth.currentUser;
    if (!current) {
      setRole(null);
      return;
    }
    const nextRole = await loadOrCreateProfile(current);
    setRole(nextRole);
  }, []);

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
      void loadOrCreateProfile(nextUser)
        .then(setRole)
        .catch(() => setRole(resolveRoleFromEmail(nextUser.email)))
        .finally(() => setLoading(false));
    });
    return unsub;
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
    setUser(null);
    setRole(null);
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
