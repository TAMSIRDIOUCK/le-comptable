// src/routes/auth/callback.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '.././lib/supabase';
import { Calculator } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handle = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) navigate('/dashboard');
        else navigate('/');
      } catch { navigate('/'); }
    };
    handle();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Calculator className="w-6 h-6 text-white" />
        </div>
        <p className="text-white/40 text-sm">Connexion en cours...</p>
      </div>
    </div>
  );
}