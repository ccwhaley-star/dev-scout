import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const ADMIN_EMAIL = 'ccwhaley@gmail.com';

  useEffect(() => {
    if (!supabase) {
      // Local-only mode — show login screen for preview (no auto-login)
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setIsAdmin(u?.email === ADMIN_EMAIL);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setIsAdmin(u?.email === ADMIN_EMAIL);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const signInWithEmail = async (email, password) => {
    if (!supabase) return { error: { message: 'Authentication service not configured' } };
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (err) {
      return { error: { message: err.message || 'Sign in failed' } };
    }
  };

  const signUp = async (email, password, fullName) => {
    if (!supabase) return { error: { message: 'Authentication service not configured' } };
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      return { error };
    } catch (err) {
      return { error: { message: err.message || 'Sign up failed' } };
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const getToken = async () => {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signIn, signInWithEmail, signUp, signOut, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}
