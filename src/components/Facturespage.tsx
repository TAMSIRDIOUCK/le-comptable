// src/components/FacturesPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Eye, Trash2, Search, CheckCircle, Clock, AlertCircle, XCircle, Plus } from 'lucide-react';
import type { Facture, Profile } from '../types';
import FactureView from './Factureview';

interface FacturesPageProps {
  userId: string;
  profile: Profile;
  onNouvelleFacture: () => void;
  openFactureId?: string | null;
}

const STATUTS = ['Toutes', 'brouillon', 'emise', 'payee', 'annulee'];
const STATUT_CONFIG = {
  brouillon: { label: 'Brouillon', color: 'text-white/40 bg-white/5 border-white/10',                    icon: Clock        },
  emise:     { label: 'Émise',     color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',              icon: AlertCircle  },
  payee:     { label: 'Payée',     color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',     icon: CheckCircle  },
  annulee:   { label: 'Annulée',   color: 'text-red-400 bg-red-500/10 border-red-500/20',                 icon: XCircle      },
};

const fmt     = (v: number) => new Intl.NumberFormat('fr-FR').format(Math.round(v));
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function FacturesPage({ userId, profile, onNouvelleFacture, openFactureId }: FacturesPageProps) {
  const [factures, setFactures]           = useState<Facture[]>([]);
  const [loading, setLoading]             = useState(true);
  const [searchQ, setSearchQ]             = useState('');
  const [statutFilter, setStatutFilter]   = useState('Toutes');
  const [viewId, setViewId]               = useState<string | null>(openFactureId ?? null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('factures_comptable')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setFactures(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (openFactureId) setViewId(openFactureId); }, [openFactureId]);

  const handleDelete = async (id: string, numero: string) => {
    if (!confirm(`Supprimer la facture ${numero} ? Cette action est irréversible.`)) return;
    await supabase.from('facture_lignes_comptable').delete().eq('facture_id', id);
    await supabase.from('factures_comptable').delete().eq('id', id);
    setFactures(prev => prev.filter(f => f.id !== id));
  };

  const filtered = factures.filter(f => {
    const matchStat = statutFilter === 'Toutes' || f.statut === statutFilter;
    const q = searchQ.toLowerCase();
    const matchQ = !q || f.numero.toLowerCase().includes(q) || f.client_nom.toLowerCase().includes(q);
    return matchStat && matchQ;
  });

  const totaux = {
    totalEmis:   factures.filter(f => f.statut === 'emise').reduce((s, f) => s + f.total_ttc, 0),
    totalPaye:   factures.filter(f => f.statut === 'payee').reduce((s, f) => s + f.total_ttc, 0),
    nbEnAttente: factures.filter(f => f.statut === 'emise').length,
  };

  /* ── Vue détail ──────────────────────────────────────────────────── */
  if (viewId) return (
    <FactureView
      factureId={viewId}
      profile={profile}
      onBack={() => { setViewId(null); load(); }}
    />
  );

  /* ── Liste ───────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-2xl font-black tracking-tight">Factures</h2>
          <p className="text-white/40 text-sm mt-0.5">
            {factures.length} facture{factures.length > 1 ? 's' : ''} au total
          </p>
        </div>
        <button
          onClick={onNouvelleFacture}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-5 py-2.5 rounded-xl transition hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]"
        >
          <Plus className="w-4 h-4" /> Nouvelle facture
        </button>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#0d1627] border border-white/5 rounded-xl p-4">
          <p className="text-white/40 text-xs mb-1">En attente ({totaux.nbEnAttente})</p>
          <p className="text-blue-400 font-black text-lg">{fmt(totaux.totalEmis)} F</p>
        </div>
        <div className="bg-[#0d1627] border border-white/5 rounded-xl p-4">
          <p className="text-white/40 text-xs mb-1">Encaissé</p>
          <p className="text-emerald-400 font-black text-lg">{fmt(totaux.totalPaye)} F</p>
        </div>
        <div className="bg-[#0d1627] border border-white/5 rounded-xl p-4">
          <p className="text-white/40 text-xs mb-1">Total factures</p>
          <p className="text-white font-black text-lg">{factures.length}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Rechercher par numéro ou client..."
            className="w-full bg-[#0d1627] text-white rounded-xl pl-9 pr-4 py-2.5 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUTS.map(s => (
            <button
              key={s}
              onClick={() => setStatutFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statutFilter === s
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#0d1627] text-white/40 hover:text-white border border-white/10'
              }`}
            >
              {s === 'Toutes' ? 'Toutes' : STATUT_CONFIG[s as keyof typeof STATUT_CONFIG]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-16 text-white/30 animate-pulse">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[#0d1627] border border-white/5 rounded-2xl">
          <FileText className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-white/30">Aucune facture trouvée</p>
          <button onClick={onNouvelleFacture} className="mt-4 text-emerald-400 hover:text-emerald-300 text-sm">
            Créer une première facture →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => {
            const cfg  = STATUT_CONFIG[f.statut];
            const Icon = cfg.icon;
            return (
              <div
                key={f.id}
                onClick={() => setViewId(f.id)}
                className="bg-[#0d1627] border border-white/5 hover:border-white/10 rounded-xl px-5 py-4 flex items-center gap-4 transition group cursor-pointer"
              >
                {/* Info principale */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-emerald-400 font-bold text-sm">{f.numero}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
                      <Icon className="w-3 h-3" /> {cfg.label}
                    </span>
                  </div>
                  <div className="text-white font-semibold text-sm truncate">{f.client_nom}</div>
                  {f.client_phone && <div className="text-white/30 text-xs">{f.client_phone}</div>}
                </div>

                {/* Date */}
                <div className="hidden sm:block text-white/40 text-xs text-right shrink-0">
                  {fmtDate(f.date_facture)}
                </div>

                {/* Montant */}
                <div className="text-white font-black text-base shrink-0 ml-2">
                  {fmt(f.total_ttc)} F
                </div>

                {/* Actions */}
                <div
                  className="flex gap-2 opacity-0 group-hover:opacity-100 transition shrink-0"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => setViewId(f.id)}
                    className="text-white/30 hover:text-white transition p-1.5 rounded-lg hover:bg-white/5"
                    title="Voir la facture"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(f.id, f.numero)}
                    className="text-white/30 hover:text-red-400 transition p-1.5 rounded-lg hover:bg-red-500/5"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}