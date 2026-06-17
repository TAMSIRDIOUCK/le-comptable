// src/components/DashboardPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  TrendingUp, FileText, Package, Users, AlertTriangle, Clock,
  CheckCircle, ArrowRight, Calendar, BarChart3, ChevronLeft,
  ChevronRight, Share2, Plus, Trash2, TrendingDown
} from 'lucide-react';
import type { Profile } from '../types';

interface ParametresPageProps {
  userId: string;
  profile: Profile;
  onGoTo: (tab: string) => void;
}

// Fonction pour formater les nombres complets avec espaces
const fmtFull = (v: number) => {
  if (v === 0) return '0';
  return new Intl.NumberFormat('fr-FR').format(Math.round(v));
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

// Périodes CA
type PeriodCA = 'jour' | 'semaine' | 'mois' | 'semestre' | 'annee';
const PERIOD_LABELS: Record<PeriodCA, string> = {
  jour:     "Aujourd'hui",
  semaine:  'Cette semaine',
  mois:     'Ce mois',
  semestre: 'Ce semestre',
  annee:    'Cette année',
};

function getRange(period: PeriodCA, offset: number): { start: Date; end: Date; label: string } {
  const now  = new Date();
  let start  = new Date();
  let end    = new Date();

  if (period === 'jour') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    end   = new Date(start); end.setDate(end.getDate() + 1);
    const label = offset === 0 ? "Aujourd'hui" : offset === 1 ? 'Hier' : fmtDate(start.toISOString());
    return { start, end, label };
  }
  if (period === 'semaine') {
    const day  = now.getDay() || 7;
    const mon  = new Date(now); mon.setDate(now.getDate() - day + 1 - offset * 7);
    const sun  = new Date(mon); sun.setDate(mon.getDate() + 7);
    return { start: mon, end: sun, label: offset === 0 ? 'Cette semaine' : `Sem. -${offset}` };
  }
  if (period === 'mois') {
    start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    end   = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    const label = offset === 0 ? 'Ce mois' : start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return { start, end, label };
  }
  if (period === 'semestre') {
    const sem  = Math.floor(now.getMonth() / 6);
    const adjSem = ((sem - offset) % 2 + 2) % 2;
    const adjYear = now.getFullYear() - Math.floor((offset - sem + adjSem) / 2 + (sem < offset ? 1 : 0));
    start = new Date(adjYear, adjSem * 6, 1);
    end   = new Date(adjYear, adjSem * 6 + 6, 1);
    const label = offset === 0 ? 'Ce semestre' : `S${adjSem + 1} ${adjYear}`;
    return { start, end, label };
  }
  // annee
  start = new Date(now.getFullYear() - offset, 0, 1);
  end   = new Date(now.getFullYear() - offset + 1, 0, 1);
  const label = offset === 0 ? 'Cette année' : String(now.getFullYear() - offset);
  return { start, end, label };
}

export default function DashboardPage({ userId, profile, onGoTo }: ParametresPageProps) {
  const [stats, setStats]           = useState<any>(null);
  const [lastFactures, setLastFactures] = useState<any[]>([]);
  const [lowStock, setLowStock]     = useState<any[]>([]);
  const [caMensuel, setCaMensuel]   = useState<{ mois: string; total: number }[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading]       = useState(true);
  const [shareCopied, setShareCopied] = useState(false);

  // --- CA par période ---
  const [period, setPeriod]   = useState<PeriodCA>('mois');
  const [offset, setOffset]   = useState(0);
  const [caValue, setCaValue] = useState(0);
  const [allFactures, setAllFactures] = useState<any[]>([]);

  // --- Dépenses ---
  const [depenses, setDepenses]       = useState<any[]>([]);
  const [depLoading, setDepLoading]   = useState(false);
  const [newDep, setNewDep]           = useState({ libelle: '', montant: '', date: new Date().toISOString().slice(0, 10) });
  const [addingDep, setAddingDep]     = useState(false);
  const [showAddDep, setShowAddDep]   = useState(false);

  const handleShare = async () => {
    const url = 'https://le-comptable.vercel.app/';
    if (navigator.share) {
      try { await navigator.share({ title: profile.company_name, url }); } catch (_) {}
    } else {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  // Recalcule le CA dès que period/offset/allFactures changent
  useEffect(() => {
    if (!allFactures.length) { setCaValue(0); return; }
    const { start, end } = getRange(period, offset);
    const total = allFactures
      .filter(f => f.statut === 'payee')
      .filter(f => {
        const d = new Date(f.created_at);
        return d >= start && d < end;
      })
      .reduce((s: number, f: any) => s + f.total_ttc, 0);
    setCaValue(total);
  }, [period, offset, allFactures]);

  // Réinitialise l'offset quand on change de période
  const handlePeriodChange = (p: PeriodCA) => { setPeriod(p); setOffset(0); };

  // --- Dépenses ---
  const fetchDepenses = useCallback(async () => {
    setDepLoading(true);
    const { data } = await supabase
      .from('depenses_comptable')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(50);
    setDepenses(data || []);
    setDepLoading(false);
  }, [userId]);

  const addDepense = async () => {
    if (!newDep.libelle.trim() || !newDep.montant) return;
    setAddingDep(true);
    await supabase.from('depenses_comptable').insert([{
      user_id: userId,
      libelle: newDep.libelle.trim(),
      montant: parseFloat(newDep.montant),
      date: newDep.date,
      created_at: new Date().toISOString(),
    }]);
    setNewDep({ libelle: '', montant: '', date: new Date().toISOString().slice(0, 10) });
    setShowAddDep(false);
    setAddingDep(false);
    fetchDepenses();
  };

  const deleteDepense = async (id: string) => {
    await supabase.from('depenses_comptable').delete().eq('id', id);
    setDepenses(prev => prev.filter(d => d.id !== id));
  };

  // Dépenses dans la période sélectionnée
  const { start: pStart, end: pEnd, label: pLabel } = getRange(period, offset);
  const depensesPeriode = depenses.filter(d => {
    const date = new Date(d.date);
    return date >= pStart && date < pEnd;
  });
  const totalDepensesPeriode = depensesPeriode.reduce((s, d) => s + d.montant, 0);
  const beneficeNet = caValue - totalDepensesPeriode;

  const load = useCallback(async () => {
    setLoading(true);
    const now        = new Date();
    const moisStart  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const anneeStart = new Date(now.getFullYear(), 0, 1).toISOString();

    const [{ data: fAll }, { data: prods }, { data: clients }] = await Promise.all([
      supabase.from('factures_comptable').select('total_ttc, statut, created_at, date_facture').eq('user_id', userId),
      supabase.from('produits_comptable').select('*').eq('user_id', userId).eq('actif', true),
      supabase.from('clients_comptable').select('id').eq('user_id', userId),
    ]);

    const factures = fAll || [];
    setAllFactures(factures);

    const caMois   = factures.filter(f => f.statut === 'payee' && f.created_at >= moisStart).reduce((s: number, f: any) => s + f.total_ttc, 0);
    const caAnnee  = factures.filter(f => f.statut === 'payee' && f.created_at >= anneeStart).reduce((s: number, f: any) => s + f.total_ttc, 0);
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

    const { data: last5 } = await supabase.from('factures_comptable').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
    setLastFactures(last5 || []);

    const stockBasList = (prods || []).filter((p: any) => p.stock_m2 <= p.seuil_alerte).slice(0, 5);
    setLowStock(stockBasList);

    setLoading(false);
  }, [userId]);

  const updateCaMensuel = useCallback(async () => {
    if (!userId) return;
    const { data: factures } = await supabase.from('factures_comptable').select('total_ttc, statut, created_at').eq('user_id', userId);
    if (!factures) return;
    const moisLabels = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    const caParMois = moisLabels.map(month => {
      const start = new Date(selectedYear, parseInt(month)-1, 1).toISOString();
      const end   = new Date(selectedYear, parseInt(month), 0).toISOString();
      const total = factures.filter(f => f.statut === 'payee' && f.created_at >= start && f.created_at <= end).reduce((s: number, f: any) => s + f.total_ttc, 0);
      return { mois: month, total };
    });
    setCaMensuel(caParMois);
  }, [userId, selectedYear]);

  useEffect(() => { load(); fetchDepenses(); }, [load, fetchDepenses]);
  useEffect(() => { updateCaMensuel(); }, [updateCaMensuel]);

  if (loading) return <div className="text-center py-20 text-white/30 animate-pulse">Chargement...</div>;

  return (
    <div className="space-y-6 px-2 sm:px-0 max-w-full overflow-hidden">

      {/* En-tête entreprise */}
      <div className="relative bg-gradient-to-br from-emerald-500/10 to-blue-500/5 border border-emerald-500/20 rounded-2xl p-4 sm:p-8 overflow-hidden">
        <div className="absolute right-4 sm:right-6 top-4 sm:top-6 opacity-5">
          <TrendingUp className="w-20 h-20 sm:w-32 sm:h-32 text-emerald-400" />
        </div>
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="w-full sm:w-auto">
            <p className="text-emerald-400 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mb-1 sm:mb-2">Tableau de bord</p>
            <h2 className="text-white text-xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase break-words">
              {profile.company_name}
            </h2>
            {profile.address && <p className="text-white/40 text-xs sm:text-sm truncate max-w-[200px] sm:max-w-full">{profile.address}</p>}
          </div>
          <button 
            onClick={handleShare} 
            className="shrink-0 flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/60 hover:text-white text-xs sm:text-sm font-medium transition w-full sm:w-auto justify-center"
          >
            <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {shareCopied ? 'Copié !' : 'Partager'}
          </button>
        </div>
      </div>

      {/* ===================== CA PAR PÉRIODE ===================== */}
      <div className="bg-[#0d1627] border border-white/5 rounded-2xl p-3 sm:p-5 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          <h3 className="text-white font-bold text-sm sm:text-base">Chiffre d'affaires</h3>
        </div>

        {/* Sélecteur de période - Scroll horizontal sur mobile */}
        <div className="flex flex-nowrap gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0 scrollbar-none">
          {(Object.keys(PERIOD_LABELS) as PeriodCA[]).map(p => (
            <button 
              key={p} 
              onClick={() => handlePeriodChange(p)}
              className={`shrink-0 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition whitespace-nowrap ${
                period === p ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
              }`}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Navigation période */}
        <div className="flex items-center justify-between">
          <button onClick={() => setOffset(o => o + 1)} className="flex items-center gap-1 text-white/40 hover:text-white text-xs transition px-1.5 sm:px-2 py-1 rounded-lg hover:bg-white/10">
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Précédent</span>
          </button>
          <span className="text-white font-semibold text-xs sm:text-sm px-2 sm:px-3 py-1 bg-white/5 rounded-lg truncate max-w-[120px] sm:max-w-full">
            {pLabel}
          </span>
          <button 
            onClick={() => setOffset(o => Math.max(0, o - 1))} 
            disabled={offset === 0}
            className={`flex items-center gap-1 text-xs transition px-1.5 sm:px-2 py-1 rounded-lg ${
              offset === 0 ? 'text-white/20 cursor-not-allowed' : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}>
            <span className="hidden xs:inline">Suivant</span> <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Résultats CA / Dépenses / Bénéfice - Version responsive avec montants complets */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 sm:p-4 text-center min-w-0">
            <div className="text-emerald-300/60 text-[8px] sm:text-xs font-bold uppercase mb-0.5 sm:mb-1">CA</div>
            <div className="text-white text-[10px] sm:text-xl font-black break-words leading-tight">
              {fmtFull(caValue)} <span className="text-[8px] sm:text-xs font-normal text-white/50">F</span>
            </div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 sm:p-4 text-center min-w-0">
            <div className="text-red-300/60 text-[8px] sm:text-xs font-bold uppercase mb-0.5 sm:mb-1">Dépenses</div>
            <div className="text-white text-[10px] sm:text-xl font-black break-words leading-tight">
              {fmtFull(totalDepensesPeriode)} <span className="text-[8px] sm:text-xs font-normal text-white/50">F</span>
            </div>
          </div>
          <div className={`border rounded-xl p-2 sm:p-4 text-center min-w-0 ${
            beneficeNet >= 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-red-900/20 border-red-500/30'
          }`}>
            <div className="text-blue-300/60 text-[8px] sm:text-xs font-bold uppercase mb-0.5 sm:mb-1">Bénéfice</div>
            <div className={`text-[10px] sm:text-xl font-black break-words leading-tight ${beneficeNet >= 0 ? 'text-white' : 'text-red-400'}`}>
              {fmtFull(beneficeNet)} <span className="text-[8px] sm:text-xs font-normal text-white/50">F</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== DÉPENSES ===================== */}
      <div className="bg-[#0d1627] border border-white/5 rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-white/5 gap-2 sm:gap-0">
          <h3 className="text-white font-bold text-xs sm:text-sm flex items-center gap-2">
            <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" /> 
            <span>Dépenses</span>
          </h3>
          <button 
            onClick={() => setShowAddDep(v => !v)}
            className="flex items-center gap-1 text-[10px] sm:text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition w-full sm:w-auto justify-center"
          >
            <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Ajouter
          </button>
        </div>

        {/* Formulaire ajout - Responsive */}
        {showAddDep && (
          <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-white/5 bg-white/[0.02] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <input
                value={newDep.libelle}
                onChange={e => setNewDep(d => ({ ...d, libelle: e.target.value }))}
                placeholder="Libellé (ex: Loyer...)"
                className="sm:col-span-1 bg-[#060d1a] text-white rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 border border-white/10 focus:outline-none focus:border-red-400 transition placeholder-white/20 text-xs sm:text-sm"
              />
              <input
                type="number"
                value={newDep.montant}
                onChange={e => setNewDep(d => ({ ...d, montant: e.target.value }))}
                placeholder="Montant (F CFA)"
                className="bg-[#060d1a] text-white rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 border border-white/10 focus:outline-none focus:border-red-400 transition placeholder-white/20 text-xs sm:text-sm"
              />
              <input
                type="date"
                value={newDep.date}
                onChange={e => setNewDep(d => ({ ...d, date: e.target.value }))}
                className="bg-[#060d1a] text-white rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 border border-white/10 focus:outline-none focus:border-red-400 transition text-xs sm:text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={addDepense} disabled={addingDep}
                className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-bold px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm transition flex-1 sm:flex-none">
                {addingDep ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setShowAddDep(false)} 
                className="text-white/40 hover:text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm transition flex-1 sm:flex-none">
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Liste dépenses */}
        {depLoading ? (
          <div className="text-center py-6 text-white/30 text-sm">Chargement...</div>
        ) : depenses.length === 0 ? (
          <div className="text-center py-8 text-white/20 text-sm">Aucune dépense enregistrée</div>
        ) : (
          <div className="divide-y divide-white/[0.03] max-h-72 overflow-y-auto">
            {depenses.map(d => (
              <div key={d.id} className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 hover:bg-white/[0.02] transition group gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-white font-semibold text-xs sm:text-sm truncate">{d.libelle}</div>
                  <div className="text-white/30 text-[10px] sm:text-xs">{fmtDate(d.date)}</div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="text-red-400 font-bold text-xs sm:text-sm truncate max-w-[100px] sm:max-w-full">
                    - {fmtFull(d.montant)} F
                  </div>
                  <button onClick={() => deleteDepense(d.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition">
                    <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KPIs principaux - Version responsive avec montants complets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-emerald-800/40 to-emerald-900/20 border border-emerald-500/20 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-emerald-300/60 text-[10px] sm:text-xs font-bold uppercase tracking-wide">CA ce mois</span>
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
          </div>
          <div className="text-white text-sm sm:text-2xl font-black break-words leading-tight">
            {fmtFull(stats.caMois)} <span className="text-[10px] sm:text-base font-normal text-white/50">F</span>
          </div>
          <div className="text-emerald-400/60 text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate">
            {fmtFull(stats.caAnnee)} F cette année
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-800/30 to-blue-900/10 border border-blue-500/20 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-blue-300/60 text-[10px] sm:text-xs font-bold uppercase tracking-wide">En attente</span>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
          </div>
          <div className="text-white text-sm sm:text-2xl font-black break-words leading-tight">
            {fmtFull(stats.enAttente)} <span className="text-[10px] sm:text-base font-normal text-white/50">F</span>
          </div>
          <div className="text-blue-400/60 text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate">
            {stats.nbEmises} facture{stats.nbEmises > 1 ? 's' : ''} émise{stats.nbEmises > 1 ? 's' : ''}
          </div>
        </div>
        <div className="bg-gradient-to-br from-zinc-800/60 to-zinc-900/20 border border-white/5 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-white/40 text-[10px] sm:text-xs font-bold uppercase tracking-wide">Factures payées</span>
            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
          </div>
          <div className="text-white text-lg sm:text-2xl font-black">{stats.nbPayees}</div>
          <div className="text-white/30 text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate">
            {stats.nbBrouillon} brouillon{stats.nbBrouillon > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Sous-stats - Version responsive */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Produits',  val: stats.nbProduits, icon: Package,       tab: 'produits' },
          { label: 'Clients',   val: stats.nbClients,  icon: Users,         tab: 'clients'  },
          { label: 'Stock bas', val: stats.stockBas,   icon: AlertTriangle, tab: 'produits', warn: stats.stockBas > 0 },
        ].map(s => (
          <button key={s.label} onClick={() => onGoTo(s.tab)}
            className={`group bg-[#0d1627] border rounded-xl p-2.5 sm:p-4 text-left transition hover:-translate-y-0.5 ${
              s.warn ? 'border-amber-500/30 hover:border-amber-500/50' : 'border-white/5 hover:border-white/10'
            }`}>
            <div className={`flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1 ${
              s.warn ? 'text-amber-400' : 'text-white/40'
            } text-[8px] sm:text-xs font-bold uppercase tracking-wide`}>
              <s.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> 
              <span className="hidden xs:inline">{s.label}</span>
              <span className="xs:hidden">{s.label === 'Produits' ? 'Prod' : s.label === 'Clients' ? 'Cli' : 'Stock'}</span>
            </div>
            <div className={`text-base sm:text-xl font-black ${s.warn ? 'text-amber-400' : 'text-white'}`}>{s.val}</div>
          </button>
        ))}
      </div>

      {/* Dernières factures + stock bas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-[#0d1627] border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-white/5">
            <h3 className="text-white font-bold text-xs sm:text-sm">Dernières factures</h3>
            <button onClick={() => onGoTo('factures')} className="text-emerald-400 hover:text-emerald-300 text-[10px] sm:text-xs flex items-center gap-1">
              Voir tout <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
          </div>
          {lastFactures.length === 0 ? (
            <div className="text-center py-8 text-white/20 text-sm">Aucune facture</div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {lastFactures.map(f => (
                <div key={f.id} className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 hover:bg-white/[0.02] transition cursor-pointer gap-2" onClick={() => onGoTo('factures')}>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-semibold text-xs sm:text-sm truncate">{f.client_nom}</div>
                    <div className="text-white/30 text-[10px] sm:text-xs truncate">{f.numero} · {fmtDate(f.date_facture)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-white font-bold text-[10px] sm:text-sm truncate max-w-[100px] sm:max-w-full">
                      {fmtFull(f.total_ttc)} F
                    </div>
                    <div className={`text-[8px] sm:text-xs font-medium ${
                      f.statut === 'payee' ? 'text-emerald-400' : f.statut === 'emise' ? 'text-blue-400' : 'text-white/30'
                    }`}>
                      {f.statut === 'payee' ? 'Payée' : f.statut === 'emise' ? 'Émise' : f.statut === 'brouillon' ? 'Brouillon' : 'Annulée'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0d1627] border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-white/5">
            <h3 className="text-white font-bold text-xs sm:text-sm flex items-center gap-2">
              {lowStock.length > 0 && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 animate-pulse" />}
              Alertes stock
            </h3>
            <button onClick={() => onGoTo('produits')} className="text-emerald-400 hover:text-emerald-300 text-[10px] sm:text-xs flex items-center gap-1">
              Gérer <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
          </div>
          {lowStock.length === 0 ? (
            <div className="text-center py-8 text-white/20 text-sm">
              <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-emerald-500/30" />
              Tous les stocks sont OK
            </div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {lowStock.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-semibold text-xs sm:text-sm truncate">{p.nom}</div>
                    <div className="text-white/30 text-[10px] sm:text-xs truncate">{p.couleur} · {p.format}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-amber-400 font-bold text-xs sm:text-sm">{p.stock_m2} m²</div>
                    <div className="text-white/30 text-[8px] sm:text-xs">Seuil: {p.seuil_alerte} m²</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Graphe CA mensuel - Version responsive avec montants complets */}
      <div className="bg-[#0d1627] border border-white/5 rounded-2xl p-3 sm:p-5 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            <h3 className="text-white font-bold text-sm sm:text-base">Évolution du CA</h3>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={() => setSelectedYear(y => y - 1)} className="text-white/40 hover:text-white transition p-1 rounded-md hover:bg-white/10">
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <span className="text-white font-mono text-xs sm:text-sm bg-white/5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg">{selectedYear}</span>
            <button onClick={() => setSelectedYear(y => y + 1)} className="text-white/40 hover:text-white transition p-1 rounded-md hover:bg-white/10">
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
        {caMensuel.length === 0 || caMensuel.every(m => m.total === 0) ? (
          <div className="text-center py-6 sm:py-8 text-white/30 text-xs sm:text-sm">
            <Calendar className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-30" />
            Aucune vente payée en {selectedYear}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1 sm:mx-0">
            <div className="flex items-end gap-1 sm:gap-2 min-w-[300px] sm:min-w-[600px] px-1 sm:px-0">
              {caMensuel.map(m => {
                const maxVal = Math.max(...caMensuel.map(x => x.total), 1);
                const height = (m.total / maxVal) * 80;
                const moisNom = new Date(selectedYear, parseInt(m.mois)-1, 1).toLocaleDateString('fr-FR', { month: 'short' });
                return (
                  <div key={m.mois} className="flex-1 text-center min-w-[20px] sm:min-w-0">
                    <div className="relative h-24 sm:h-32 flex flex-col justify-end">
                      <div 
                        className="bg-emerald-500/80 hover:bg-emerald-400 transition-all rounded-t-md w-full"
                        style={{ height: `${Math.max(height, 2)}px`, minHeight: m.total > 0 ? '4px' : '2px' }} 
                      />
                      <div className="text-white/40 text-[8px] sm:text-[10px] mt-0.5 sm:mt-1 truncate">{moisNom}</div>
                    </div>
                    <div className="text-emerald-300 font-bold text-[8px] sm:text-xs mt-0.5 sm:mt-1 truncate max-w-[60px] sm:max-w-full mx-auto">
                      {fmtFull(m.total)} F
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