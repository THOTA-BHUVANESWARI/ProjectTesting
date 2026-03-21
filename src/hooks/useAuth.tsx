// Fixed: removed email confirmation, fixed role assignment, added safety net upserts
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, Profile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string, role?: 'interviewer' | 'candidate') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isInterviewer: boolean;
  isCandidate: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleData) {
        setRole(roleData.role as UserRole);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    role?: 'interviewer' | 'candidate'
  ) => {
    // ── Step 1: Sign up — pass role + full_name in metadata so the
    //           handle_new_user DB trigger can assign them automatically ──
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName ?? '',
          role: role ?? 'candidate',
        },
      },
    });

    if (error) return { error: error as Error };
    if (!data.user) return { error: new Error('Signup failed — no user returned') };

    // ── Step 2: The DB trigger (handle_new_user) should have already
    //           inserted profiles + user_roles rows. We do a manual
    //           upsert here as a safety net in case the trigger is slow
    //           or the user confirmed email later. ──────────────────────

    // Small delay to let the trigger fire first
    await new Promise(res => setTimeout(res, 500));

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        email: email,
        full_name: fullName ?? '',
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile upsert error:', profileError.message);
      // Non-fatal — trigger may have already inserted it
    }

    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: data.user.id,
        role: role ?? 'candidate',
      }, { onConflict: 'user_id,role' });

    if (roleError) {
      console.error('Role upsert error:', roleError.message);
      // Non-fatal — trigger may have already inserted it
    }

    return { error: null };
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.log('Sign out completed (session may have been expired)');
    }
  };

  const value = {
    user,
    session,
    profile,
    role,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin: role === 'admin',
    isInterviewer: role === 'interviewer',
    isCandidate: role === 'candidate',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
