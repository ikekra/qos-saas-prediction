import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  isAdmin: boolean;
  adminLoading: boolean;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const OWNER_ADMIN_EMAILS = new Set(["chagankekra13@gmail.com"]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setAccessToken(session?.access_token ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const resolveAdminAccess = async () => {
      if (!user) {
        setIsAdmin(false);
        setAdminLoading(false);
        return;
      }

      setAdminLoading(true);
      try {
        const email = (user.email || "").toLowerCase();
        if (OWNER_ADMIN_EMAILS.has(email)) {
          setIsAdmin(true);
          setAdminLoading(false);
          return;
        }

        const localAdmin =
          user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin";
        if (localAdmin) {
          setIsAdmin(true);
          setAdminLoading(false);
          return;
        }

        const [{ data: authUser }, { data: profile }] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

        const remoteRole = authUser?.user?.app_metadata?.role;
        const profileRole = profile?.role;
        setIsAdmin(remoteRole === "admin" || profileRole === "admin");
      } catch {
        setIsAdmin(false);
      } finally {
        setAdminLoading(false);
      }
    };

    void resolveAdminAccess();
  }, [user?.id, user?.email, user?.app_metadata?.role, user?.user_metadata?.role]);

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name,
          },
        },
      });
      
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/auth/reset`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const getAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    const currentToken = data.session?.access_token ?? null;
    setAccessToken(currentToken);
    return currentToken;
  };

  return (
    <AuthContext.Provider value={{ user, session, accessToken, isAdmin, adminLoading, loading, signUp, signIn, signOut, resetPassword, getAccessToken }}>
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
