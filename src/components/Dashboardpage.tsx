// src/components/DashboardPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, FileText, Package, Users, AlertTriangle, Clock, CheckCircle, ArrowRight, Calendar, BarChart3, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import type { Profile } from '../types';

interface DashboardPageProps {
  userId: string;
  profile: Profile;
  onGoTo: (tab: string) => void;
}

const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(Math.round(v));
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

export default function DashboardPage({ userId, profile, onGoTo }: DashboardPageProps) {
  const [stats, setStats]           = useState<any>(null);
  const [lastFactures, setLastFactures] = useState<any[]>([]);
  const [lowStock, setLowStock]     = useState<any[]>([]);
  const [caMensuel, setCaMensuel]   = useState<{ mois: string; total: number }[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading]       = useState(true);
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: profile.company_name, url });
      } catch (_) {}
    } else {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const moisStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const anneeStart = new Date(now.getFullYear(), 0, 1).toISOString();

    const [{ data: fAll }, { data: prods }, { data: clients }] = await Promise.all([
      supabase.from('factures_comptable').select('total_ttc, statut, created_at, date_facture').eq('user_id', userId),
      supabase.from('produits_comptable').select('*').eq('user_id', userId).eq('actif', true),
      supabase.from('clients_comptable').select('id').eq('user_id', userId),
    ]);

    const factures = fAll || [];
    const caMois    = factures.filter(f => f.statut === 'payee' && f.created_at >= moisStart).reduce((s: number, f: any) => s + f.total_ttc, 0);
    const caAnnee   = factures.filter(f => f.statut === 'payee' && f.created_at >= anneeStart).reduce((s: number, f: any) => s + f.total_ttc, 0);
    const enAttente = factures.filter(f => f.statut === 'emise').reduce((s: number, f: any) => s + f.total_ttc, 0);

    setStats({
      caMois, caAnnee, enAttente,
      nbEmises:    factures.filter(f => f.statut === 'emise').length,
      nbPayees:    factures.filter(f => f.statut === 'payee').length,
      nbBrouillon: factures.filter(f => f.statut === 'brouillon').length,
      nbProduits:  (prods || []).length,
      nbClients:   (clients || []).length,
      stockBas:    (prods || []).filter((p: any) => p.stock_m2 <= p.seuil_alerte).length,
    });

    // 5 dernières factures
    const { data: last5 } = await supabase.from('factures_comptable').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
    setLastFactures(last5 || []);

    // Produits stock bas
    const stockBasList = (prods || []).filter((p: any) => p.stock_m2 <= p.seuil_alerte).slice(0, 5);
    setLowStock(stockBasList);

    setLoading(false);
  }, [userId]);

  // Recalculer le CA mensuel quand l'année ou les factures changent
  const updateCaMensuel = useCallback(async () => {
    if (!userId) return;
    const { data: factures } = await supabase
      .from('factures_comptable')
      .select('total_ttc, statut, created_at')
      .eq('user_id', userId);
    if (!factures) return;
    const moisLabels = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const caParMois = moisLabels.map(month => {
      const start = new Date(selectedYear, parseInt(month)-1, 1).toISOString();
      const end = new Date(selectedYear, parseInt(month), 0).toISOString();
      const total = factures
        .filter(f => f.statut === 'payee' && f.created_at >= start && f.created_at <= end)
        .reduce((s: number, f: any) => s + f.total_ttc, 0);
      return { mois: month, total };
    });
    setCaMensuel(caParMois);
  }, [userId, selectedYear]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { updateCaMensuel(); }, [updateCaMensuel]);

  if (loading) return (
    <div className="text-center py-20 text-white/30 animate-pulse">Chargement...</div>
  );

  return (
    <div className="space-y-8">
      {/* Accueil entreprise */}
      <div className="relative bg-gradient-to-br from-emerald-500/10 to-blue-500/5 border border-emerald-500/20 rounded-2xl p-8 overflow-hidden">
        <div className="absolute right-6 top-6 opacity-5">
          <TrendingUp className="w-32 h-32 text-emerald-400" />
        </div>
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">Tableau de bord</p>
            <h2 className="text-white text-3xl sm:text-4xl font-black tracking-tight uppercase mb-2">
              {profile.company_name}
            </h2>
            {profile.address && <p className="text-white/40 text-sm">{profile.address}</p>}
          </div>
          <button
            onClick={handleShare}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/60 hover:text-white text-sm font-medium transition"
          >
            <Share2 className="w-4 h-4" />
            {shareCopied ? 'Copié !' : 'Partager'}
          </button>
        </div>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-800/40 to-emerald-900/20 border border-emerald-500/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-emerald-300/60 text-xs font-bold uppercase tracking-wide">CA ce mois</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-white text-2xl font-black">{fmt(stats.caMois)} F</div>
          <div className="text-emerald-400/60 text-xs mt-1">{fmt(stats.caAnnee)} F cette année</div>
        </div>
        <div className="bg-gradient-to-br from-blue-800/30 to-blue-900/10 border border-blue-500/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-blue-300/60 text-xs font-bold uppercase tracking-wide">En attente</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-white text-2xl font-black">{fmt(stats.enAttente)} F</div>
          <div className="text-blue-400/60 text-xs mt-1">{stats.nbEmises} facture{stats.nbEmises > 1 ? 's' : ''} émise{stats.nbEmises > 1 ? 's' : ''}</div>
        </div>
        <div className="bg-gradient-to-br from-zinc-800/60 to-zinc-900/20 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/40 text-xs font-bold uppercase tracking-wide">Factures payées</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-white text-2xl font-black">{stats.nbPayees}</div>
          <div className="text-white/30 text-xs mt-1">{stats.nbBrouillon} brouillon{stats.nbBrouillon > 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Sous-stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Produits',  val: stats.nbProduits, icon: Package, tab: 'produits' },
          { label: 'Clients',   val: stats.nbClients,  icon: Users,   tab: 'clients'  },
          { label: 'Stock bas', val: stats.stockBas,   icon: AlertTriangle, tab: 'produits', warn: stats.stockBas > 0 },
        ].map(s => (
          <button key={s.label} onClick={() => onGoTo(s.tab)}
            className={`group bg-[#0d1627] border rounded-xl p-4 text-left transition hover:-translate-y-0.5 ${s.warn ? 'border-amber-500/30 hover:border-amber-500/50' : 'border-white/5 hover:border-white/10'}`}>
            <div className={`flex items-center gap-1.5 mb-1 ${s.warn ? 'text-amber-400' : 'text-white/40'} text-xs font-bold uppercase tracking-wide`}>
              <s.icon className="w-3.5 h-3.5" /> {s.label}
            </div>
            <div className={`text-xl font-black ${s.warn ? 'text-amber-400' : 'text-white'}`}>{s.val}</div>
          </button>
        ))}
      </div>

      {/* Dernières factures + stock bas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dernières factures */}
        <div className="bg-[#0d1627] border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h3 className="text-white font-bold text-sm">Dernières factures</h3>
            <button onClick={() => onGoTo('factures')} className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1">
              Voir tout <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {lastFactures.length === 0 ? (
            <div className="text-center py-8 text-white/20 text-sm">Aucune facture</div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {lastFactures.map(f => (
                <div key={f.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition cursor-pointer" onClick={() => onGoTo('factures')}>
                  <div>
                    <div className="text-white font-semibold text-sm">{f.client_nom}</div>
                    <div className="text-white/30 text-xs">{f.numero} · {fmtDate(f.date_facture)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold text-sm">{fmt(f.total_ttc)} F</div>
                    <div className={`text-xs font-medium ${f.statut === 'payee' ? 'text-emerald-400' : f.statut === 'emise' ? 'text-blue-400' : 'text-white/30'}`}>
                      {f.statut === 'payee' ? 'Payée' : f.statut === 'emise' ? 'Émise' : f.statut === 'brouillon' ? 'Brouillon' : 'Annulée'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock bas */}
        <div className="bg-[#0d1627] border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              {lowStock.length > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
              Alertes stock
            </h3>
            <button onClick={() => onGoTo('produits')} className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1">
              Gérer <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {lowStock.length === 0 ? (
            <div className="text-center py-8 text-white/20 text-sm">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500/30" />
              Tous les stocks sont OK
            </div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {lowStock.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-white font-semibold text-sm">{p.nom}</div>
                    <div className="text-white/30 text-xs">{p.couleur} · {p.format}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-400 font-bold text-sm">{fmt(p.stock_m2)} m²</div>
                    <div className="text-white/30 text-xs">Seuil: {p.seuil_alerte} m²</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section CA mensuel (année sélectionnée) - placée tout en bas */}
      <div className="bg-[#0d1627] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-white font-bold text-base">Évolution du chiffre d'affaires</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedYear(y => y - 1)}
              className="text-white/40 hover:text-white transition p-1 rounded-md hover:bg-white/10"
              title="Année précédente"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-white font-mono text-sm bg-white/5 px-3 py-1 rounded-lg">{selectedYear}</span>
            <button
              onClick={() => setSelectedYear(y => y + 1)}
              className="text-white/40 hover:text-white transition p-1 rounded-md hover:bg-white/10"
              title="Année suivante"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        {caMensuel.length === 0 || caMensuel.every(m => m.total === 0) ? (
          <div className="text-center py-8 text-white/30 text-sm">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Aucune vente payée en {selectedYear}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-2 min-w-[600px]">
              {caMensuel.map((m, idx) => {
                const maxVal = Math.max(...caMensuel.map(x => x.total), 1);
                const height = (m.total / maxVal) * 120;
                const moisNom = new Date(selectedYear, parseInt(m.mois)-1, 1).toLocaleDateString('fr-FR', { month: 'short' });
                return (
                  <div key={m.mois} className="flex-1 text-center">
                    <div className="relative h-32 flex flex-col justify-end">
                      <div
                        className="bg-emerald-500/80 hover:bg-emerald-400 transition-all rounded-t-md w-full"
                        style={{ height: `${height}px`, minHeight: m.total > 0 ? '4px' : '2px' }}
                      />
                      <div className="text-white/40 text-[10px] mt-1 truncate">
                        {moisNom}
                      </div>
                    </div>
                    <div className="text-emerald-300 font-bold text-xs mt-1">
                      {fmt(m.total)} F
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}