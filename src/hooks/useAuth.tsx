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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer fetching profile and role to avoid deadlock
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

    // THEN check for existing session
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
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Fetch role
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  // const signUp = async (email: string, password: string, fullName?: string, role?: 'interviewer' | 'candidate') => {
  //   const { error } = await supabase.auth.signUp({
  //     email,
  //     password,
  //     options: {
  //       emailRedirectTo: `${window.location.origin}/`,
  //       data: {
  //         full_name: fullName,
  //         role: role || 'candidate',
  //       },
  //     },
  //   });
  //   return { error: error as Error | null };
  // };

  const signUp = async (
  email: string,
  password: string,
  fullName?: string,
  role?: 'interviewer' | 'candidate'
) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error as Error };
    console.log(error);
  }

  if (data.user) {
    // Insert into profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: data.user.id,
          full_name: fullName,
        },
      ]);

    if (profileError) {
      return { error: profileError as Error };
    }

    // Insert into user_roles table
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert([
        {
          user_id: data.user.id,
          role: role || 'candidate',
        },
      ]);

    if (roleError) {
      return { error: roleError as Error };
    }
  }

  return { error: null };
};
  const signOut = async () => {
    // Clear local state first to ensure UI updates even if signOut fails
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    
    // Attempt to sign out - ignore errors (e.g., session already expired)
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      // Session might already be invalid, which is fine
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