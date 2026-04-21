// src/components/AuthPage.tsx
import { useState, useEffect } from 'react';
import { Calculator, ArrowLeft, Eye, EyeOff, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const PROFILE_TABLE = 'profiles_comptable';

type Mode = 'login' | 'register' | 'reset';

function PasswordInput({
  value, onChange, onKeyDown, show, onToggle,
  placeholder = '••••••••',
  autoComplete = 'current-password',
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full bg-[#0d1627] text-white rounded-xl px-4 py-3 pr-12 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20"
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition"
      >
        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}

interface AuthPageProps {
  onBack?: () => void;
  onAuthSuccess?: () => void;
}

const getBaseUrl = (): string => {
  if (import.meta.env.VITE_APP_URL) return import.meta.env.VITE_APP_URL.replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:5173';
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
};

export function AuthPage({ onBack, onAuthSuccess }: AuthPageProps) {
  const [mode, setMode]                       = useState<Mode>('login');
  const [companyName, setCompanyName]         = useState('');
  const [address, setAddress]                 = useState('');
  const [phone, setPhone]                     = useState('');
  const [nif, setNif]                         = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd]                 = useState(false);
  const [showConfPwd, setShowConfPwd]         = useState(false);
  const [error, setError]                     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [success, setSuccess]                 = useState('');
  const [isCallback, setIsCallback]           = useState(false);

  // Gestion du callback OAuth / lien magique (hash ou code dans l'URL)
  useEffect(() => {
    const handleCallback = async () => {
      const hash   = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      const code   = params.get('code');

      if (!hash && !code) return;

      setIsCallback(true);
      // Supabase résout automatiquement la session depuis le hash/code
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        window.history.replaceState({}, '', window.location.pathname);
        onAuthSuccess?.();
      } else {
        // Si pas encore de session, attendre l'événement SIGNED_IN
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
          if (event === 'SIGNED_IN' && sess) {
            subscription.unsubscribe();
            window.history.replaceState({}, '', window.location.pathname);
            onAuthSuccess?.();
          }
        });
      }
      setIsCallback(false);
    };

    handleCallback();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const translateError = (msg: string): string => {
    if (msg.includes('already registered'))                       return 'Cet email est déjà utilisé.';
    if (msg.includes('Invalid login') || msg.includes('invalid_credentials')) return 'Email ou mot de passe incorrect.';
    if (msg.includes('Email not confirmed'))                      return 'Email non confirmé. Vérifiez votre boîte mail.';
    if (msg.includes('Password should be at least'))              return 'Mot de passe trop court (6 caractères min.)';
    return msg;
  };

  const ensureProfile = async (
    userId: string, cname: string, addr: string,
    ph: string, nifVal: string, emailAddr: string,
  ) => {
    const { data: existing } = await supabase
      .from(PROFILE_TABLE)
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from(PROFILE_TABLE).insert({
        id: userId,
        company_name: cname,
        address: addr,
        phone: ph,
        nif: nifVal,
        email: emailAddr,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  };

  const handleRegister = async () => {
    if (!companyName.trim())       return setError("Nom de l'entreprise requis");
    if (!email.trim() || !email.includes('@')) return setError('Email invalide');
    if (!password)                 return setError('Mot de passe requis');
    if (password.length < 6)      return setError('Mot de passe trop court (6 min.)');
    if (password !== confirmPassword) return setError('Les mots de passe ne correspondent pas');

    setLoading(true);
    setError('');
    try {
      const { data, error: e } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { company_name: companyName },
          emailRedirectTo: `${getBaseUrl()}/auth/callback`,
        },
      });

      if (e) { setError(translateError(e.message)); return; }

      if (data.user) {
        await ensureProfile(
          data.user.id, companyName.trim(), address.trim(),
          phone.trim(), nif.trim(), email.trim().toLowerCase(),
        );

        if (data.session) {
          // Connexion directe (confirmation email désactivée côté Supabase)
          onAuthSuccess?.();
        } else {
          setSuccess(`Email de confirmation envoyé à ${email}. Vérifiez votre boîte mail.`);
        }
      }
    } catch (e: any) {
      setError(translateError(e?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !email.includes('@')) return setError('Email invalide');
    if (!password) return setError('Mot de passe requis');

    setLoading(true);
    setError('');
    try {
      const { data, error: e } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (e) { setError(translateError(e.message)); return; }

      if (data.user) {
        // Garantit que le profil existe (ex. : compte créé hors app)
        await ensureProfile(
          data.user.id,
          data.user.user_metadata?.company_name ?? email.split('@')[0],
          '', '', '',
          email.trim().toLowerCase(),
        );
        // onAuthStateChange(SIGNED_IN) dans ClientApp prend le relais,
        // mais on appelle aussi onAuthSuccess pour déclencher initUser immédiatement.
        onAuthSuccess?.();
      }
    } catch (e: any) {
      setError(translateError(e?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) return setError('Email requis');
    setLoading(true);
    setError('');
    try {
      const { error: e } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${getBaseUrl()}/auth/callback` },
      );
      if (e) setError(translateError(e.message));
      else setSuccess(`Lien de réinitialisation envoyé à ${email}.`);
    } catch (e: any) {
      setError(translateError(e?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    setError('');
    setSuccess('');
    if (mode === 'reset')    return handleReset();
    if (mode === 'register') return handleRegister();
    return handleLogin();
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  if (isCallback) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4" />
          <p className="text-white/50">Connexion en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4 py-12"
      style={{ backgroundImage: `radial-gradient(ellipse at 30% 50%, rgba(16,185,129,0.05) 0%, transparent 60%)` }}
    >
      <div className="w-full max-w-md">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/40 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
        )}

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500 rounded-2xl mb-4 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
            <Calculator className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-white text-3xl font-black tracking-tight">Le Comptable</h1>
          <p className="text-white/30 text-sm mt-1">Gestion comptable · Matériaux de construction</p>
        </div>

        <div className="bg-[#0d1627] border border-white/5 rounded-2xl p-8">
          {/* Onglets login / register */}
          {mode !== 'reset' && (
            <div className="flex mb-6 bg-[#060d1a] rounded-xl p-1">
              {(['login', 'register'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
                    mode === m
                      ? 'bg-emerald-500 text-white shadow'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {m === 'login' ? 'Connexion' : 'Créer un compte'}
                </button>
              ))}
            </div>
          )}

          {mode === 'reset' && (
            <div className="mb-6">
              <h2 className="text-white text-xl font-bold mb-1">Mot de passe oublié</h2>
              <p className="text-white/40 text-sm">Entrez votre email pour recevoir un lien de réinitialisation.</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Champs inscription */}
            {mode === 'register' && (
              <>
                <div>
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Nom de l'entreprise *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: MAISON DU CARRELAGE"
                    className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20 font-semibold text-base uppercase"
                  />
                  <p className="text-white/20 text-xs mt-1">Ce nom apparaîtra sur toutes vos factures.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Téléphone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+221 77 000 00 00"
                      className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">
                      NIF <span className="normal-case font-normal">(optionnel)</span>
                    </label>
                    <input
                      type="text"
                      value={nif}
                      onChange={(e) => setNif(e.target.value)}
                      placeholder="Ex: 12345678"
                      className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Adresse</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Zone Industrielle, Dakar"
                    className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20"
                  />
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="vous@email.com"
                autoComplete="email"
                className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20"
              />
            </div>

            {/* Mot de passe */}
            {mode !== 'reset' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-white/40 text-xs font-bold uppercase tracking-wider">Mot de passe</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('reset')}
                        className="text-white/30 hover:text-white text-xs transition"
                      >
                        Oublié ?
                      </button>
                    )}
                  </div>
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    show={showPwd}
                    onToggle={() => setShowPwd((p) => !p)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">
                      Confirmer le mot de passe
                    </label>
                    <PasswordInput
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      show={showConfPwd}
                      onToggle={() => setShowConfPwd((p) => !p)}
                      autoComplete="new-password"
                    />
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl px-4 py-3">
                {success}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-base transition hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] mt-2"
            >
              {loading
                ? 'Chargement...'
                : mode === 'login'
                  ? 'Se connecter'
                  : mode === 'register'
                    ? 'Créer mon compte'
                    : 'Envoyer le lien'}
            </button>

            {mode === 'reset' && (
              <button
                onClick={() => switchMode('login')}
                className="w-full text-white/40 hover:text-white text-sm transition py-2"
              >
                ← Retour à la connexion
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}