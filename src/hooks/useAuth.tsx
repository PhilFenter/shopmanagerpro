import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type SignOutReason = 'no_role' | 'role_fetch_failed' | 'manual';

const SIGNOUT_REASON_KEY = 'auth:signout_reason';

export function consumeSignOutReason(): SignOutReason | null {
  try {
    const value = sessionStorage.getItem(SIGNOUT_REASON_KEY) as SignOutReason | null;
    if (value) sessionStorage.removeItem(SIGNOUT_REASON_KEY);
    return value;
  } catch {
    return null;
  }
}

function setSignOutReason(reason: SignOutReason) {
  try {
    sessionStorage.setItem(SIGNOUT_REASON_KEY, reason);
  } catch {
    // ignore
  }
}

type AppRole = 'admin' | 'manager' | 'team';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [roleReady, setRoleReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setRole(null);
        setRoleReady(true);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        applySession(nextSession);
        setAuthReady(true);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
      if (isMounted) {
        setAuthReady(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchUserRole = async (userId: string) => {
      setRoleReady(false);

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (!isMounted) return;

      if (error) {
        console.error('Failed to fetch user role — signing out for safety', error);
        setRole(null);
        setRoleReady(true);
        setSignOutReason('role_fetch_failed');
        await supabase.auth.signOut();
        return;
      }

      const roles = (data ?? []).map(({ role }) => role as AppRole);

      if (roles.includes('admin')) {
        setRole('admin');
      } else if (roles.includes('manager')) {
        setRole('manager');
      } else if (roles.length > 0) {
        setRole('team');
      } else {
        // No roles assigned — fail closed
        console.error('No roles assigned to user — signing out');
        setRole(null);
        setRoleReady(true);
        setSignOutReason('no_role');
        await supabase.auth.signOut();
        return;
      }

      setRoleReady(true);
    };

    if (!user?.id) {
      setRole(null);
      setRoleReady(true);

      return () => {
        isMounted = false;
      };
    }

    fetchUserRole(user.id);

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const loading = !authReady || (!!user && !roleReady);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setRoleReady(true);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
