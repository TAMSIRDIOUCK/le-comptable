// src/components/ClientApp.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { AuthPage } from './Authpage';
import { LandingPage } from './LandingPage';
import { Calculator } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../types';

type AppState = 'loading' | 'landing' | 'auth' | 'inactive' | 'app';

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
}

interface ClientAppProps {
  children: (authUser: AuthUser, onLogout: () => void) => React.ReactNode;
}

export function ClientApp({ children }: ClientAppProps) {
  const [appState, setAppState] = useState<AppState>('loading');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  // Empêche les appels concurrents à initUser
  const initLock = useRef(false);
  // Empêche onAuthStateChange de rejouer après un checkSession initial réussi
  const initializedRef = useRef(false);

  const initUser = useCallback(async (u: User): Promise<void> => {
    if (initLock.current) return;
    initLock.current = true;

    try {
      let { data: prof, error: fetchError } = await supabase
        .from('profiles_comptable')
        .select('*')
        .eq('id', u.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Erreur récupération profil:', fetchError);
        setAppState('landing');
        return;
      }

      if (!prof) {
        const { data: newProf, error: insertError } = await supabase
          .from('profiles_comptable')
          .insert({
            id: u.id,
            company_name: u.user_metadata?.company_name ?? u.email?.split('@')[0] ?? 'Mon Entreprise',
            email: u.email ?? '',
            is_active: true,
          })
          .select()
          .single();

        if (insertError || !newProf) {
          console.error('Erreur création profil:', insertError);
          setAppState('landing');
          return;
        }
        prof = newProf;
      }

      setAuthUser({ id: u.id, email: u.email ?? '', profile: prof });
      setAppState(prof.is_active ? 'app' : 'inactive');
    } catch (err) {
      console.error('Exception initUser:', err);
      setAppState('landing');
    } finally {
      initLock.current = false;
    }
  }, []);

  // 1. Vérification initiale de session — une seule fois au montage
  useEffect(() => {
    const init = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        setAppState('landing');
        initializedRef.current = true;
        return;
      }
      await initUser(session.user);
      initializedRef.current = true;
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Listener auth — ne réagit qu'après l'init initiale
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Ignore les événements avant que checkSession soit terminé
      if (!initializedRef.current) return;

      if (event === 'SIGNED_IN' && session?.user) {
        await initUser(session.user);
      }

      if (event === 'SIGNED_OUT') {
        initLock.current = false;
        setAuthUser(null);
        setAppState('landing');
      }

      // Gestion du lien de réinitialisation de mot de passe
      if (event === 'PASSWORD_RECOVERY') {
        setAppState('auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [initUser]);

  const handleLogout = useCallback(async () => {
    initLock.current = false;
    setAppState('loading');
    await supabase.auth.signOut();
    // onAuthStateChange(SIGNED_OUT) prend le relais
  }, []);

  const handleAuthSuccess = useCallback(async () => {
    // La session est déjà active via onAuthStateChange(SIGNED_IN)
    // On force quand même une vérification au cas où le listener se serait déclenché avant init
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await initUser(session.user);
    }
  }, [initUser]);

  // ── Rendu selon l'état ──────────────────────────────────────────────────────

  if (appState === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <p className="text-white/30 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  if (appState === 'landing') {
    return <LandingPage onGetStarted={() => setAppState('auth')} />;
  }

  if (appState === 'auth') {
    return (
      <AuthPage
        onBack={() => setAppState('landing')}
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  if (appState === 'inactive' && authUser) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Calculator className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-white text-2xl font-bold mb-3">Compte désactivé</h2>
          <p className="text-white/40 text-sm mb-8">
            Votre compte a été désactivé. Contactez le support.
          </p>
          <div className="bg-[#0d1627] border border-white/5 rounded-xl p-4 mb-6">
            <p className="text-white/60 text-sm font-semibold">{authUser.profile.company_name}</p>
            <p className="text-white/30 text-xs mt-1">{authUser.email}</p>
          </div>
          <button onClick={handleLogout} className="text-white/40 hover:text-white text-sm transition">
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (appState === 'app' && authUser) {
    return <>{children(authUser, handleLogout)}</>;
  }

  return null;
}