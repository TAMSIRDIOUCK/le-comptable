// src/components/ParametresPage.tsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Building2 } from 'lucide-react';
import type { Profile } from '../types';

interface ParametresPageProps {
  profile: Profile;
  onProfileUpdated: (p: Profile) => void;
  onLogout: () => void;
}

export default function ParametresPage({ profile, onProfileUpdated, onLogout }: ParametresPageProps) {
  const [form, setForm] = useState({
    company_name: profile.company_name,
    address:      profile.address ?? '',
    phone:        profile.phone ?? '',
    email:        profile.email ?? '',
    nif:          profile.nif ?? '',
    rc:           profile.rc ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const handleSave = async () => {
    if (!form.company_name.trim()) return;
    setSaving(true);
    const updates = { ...form, company_name: form.company_name.trim().toUpperCase(), updated_at: new Date().toISOString() };
    const { data } = await supabase.from('profiles_comptable').update(updates).eq('id', profile.id).select().single();
    if (data) onProfileUpdated(data);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const F = ({ label, k, placeholder, hint }: { label: string; k: keyof typeof form; placeholder?: string; hint?: string }) => (
    <div>
      <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">{label}</label>
      <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={placeholder}
        className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20" />
      {hint && <p className="text-white/20 text-xs mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-white text-2xl font-black tracking-tight">Paramètres</h2>
        <p className="text-white/40 text-sm mt-0.5">Informations de votre entreprise — apparaissent sur toutes vos factures</p>
      </div>

      <div className="bg-[#0d1627] border border-white/5 rounded-2xl p-6 space-y-5">
        <h3 className="text-white font-bold text-base flex items-center gap-2">
          <Building2 className="w-4 h-4 text-emerald-400" /> Informations entreprise
        </h3>

        <F label="Nom de l'entreprise *" k="company_name"
          placeholder="MAISON DU CARRELAGE"
          hint="Affiché en grand sur toutes les factures" />

        <div className="grid grid-cols-2 gap-4">
          <F label="Téléphone" k="phone" placeholder="+221 77 000 00 00" />
          <F label="Email" k="email" placeholder="contact@votreentreprise.sn" />
        </div>

        <F label="Adresse" k="address" placeholder="Zone Industrielle, Lot 42, Dakar" />

        <div className="grid grid-cols-2 gap-4">
          <F label="NIF (Numéro Identif. Fiscal)" k="nif" placeholder="00000000" />
          <F label="RC (Registre de Commerce)" k="rc" placeholder="SN-DKR-2024-XXX" />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]">
          <Save className="w-4 h-4" />
          {saving ? 'Sauvegarde...' : saved ? '✓ Sauvegardé !' : 'Sauvegarder'}
        </button>
      </div>

      {/* Aperçu en-tête facture */}
      <div className="bg-[#0d1627] border border-white/5 rounded-2xl p-6">
        <h3 className="text-white/40 text-xs font-bold uppercase tracking-wider mb-4">Aperçu en-tête facture</h3>
        <div className="bg-white rounded-xl p-6 font-sans" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '3px solid #10b981' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '900', textTransform: 'uppercase', color: '#0a0f1e', letterSpacing: '0.05em' }}>
                {form.company_name || 'NOM ENTREPRISE'}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', lineHeight: '1.6' }}>
                {form.address && <div>{form.address}</div>}
                {form.phone && <div>Tél: {form.phone}</div>}
                {form.email && <div>{form.email}</div>}
              </div>
              {(form.nif || form.rc) && (
                <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '3px' }}>
                  {form.nif && <span>NIF: {form.nif}  </span>}
                  {form.rc && <span>RC: {form.rc}</span>}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Facture</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#10b981' }}>FAC-2026-0001</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Date: 20 avril 2026</div>
            </div>
          </div>
        </div>
      </div>

      {/* Déconnexion */}
      <div className="bg-[#0d1627] border border-red-500/10 rounded-2xl p-6">
        <h3 className="text-white font-bold text-base mb-3">Déconnexion</h3>
        <p className="text-white/40 text-sm mb-4">Vous serez redirigé vers la page d'accueil.</p>
        <button onClick={onLogout}
          className="border border-red-500/30 text-red-400 hover:bg-red-500/10 font-medium px-5 py-2.5 rounded-xl text-sm transition">
          Se déconnecter
        </button>
      </div>
    </div>
  );
}