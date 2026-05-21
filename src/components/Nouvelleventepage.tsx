// src/components/NouvelleVentePage.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Trash2, Save, ChevronDown, X, UserCheck, Search, Package
} from 'lucide-react';
import type { Client } from '../types';

/* ─── Types locaux ───────────────────────────────────────────────── */
interface Produit {
  id: string;
  nom: string;
  reference: string;
  couleur: string;
  format: string;
  prix_unitaire: number;
  prix_m2?: number;  // Ajout pour compatibilité
}

interface Ligne {
  id: string;
  designation: string;
  reference: string;
  couleur: string;
  format: string;
  quantite_m2: number;
  prix_unitaire: number;
  remise_pct: number;
  total_ligne: number;
}

interface NouvelleVentePageProps {
  userId: string;
  onFactureCreee: (factureId: string) => void;
  preselectedClient?: Client | null;
  preselectedProduct?: Produit | null;  // ← Nouvelle prop ajoutée
}

/* ─── Helpers ────────────────────────────────────────────────────── */
const uid  = () => Math.random().toString(36).slice(2);
const fmt  = (v: number) => new Intl.NumberFormat('fr-FR').format(Math.round(v));

function makeLigne(): Ligne {
  return { 
    id: uid(), 
    designation: '', 
    reference: '', 
    couleur: '', 
    format: '', 
    quantite_m2: 1, 
    prix_unitaire: 0, 
    remise_pct: 0, 
    total_ligne: 0 
  };
}

function computeLigne(l: Ligne): Ligne {
  const brut   = l.quantite_m2 * l.prix_unitaire;
  const remise = brut * (l.remise_pct / 100);
  return { ...l, total_ligne: Math.max(0, brut - remise) };
}

/* ─── Composant ──────────────────────────────────────────────────── */
export default function NouvelleVentePage({ 
  userId, 
  onFactureCreee, 
  preselectedClient,
  preselectedProduct  // ← Nouvelle prop déstructurée
}: NouvelleVentePageProps) {
  /* Client */
  const [clients, setClients]             = useState<Client[]>([]);
  const [clientSearch, setClientSearch]   = useState('');
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [clientNom, setClientNom]         = useState(preselectedClient?.nom     ?? '');
  const [clientPhone, setClientPhone]     = useState(preselectedClient?.phone   ?? '');
  const [clientEmail, setClientEmail]     = useState(preselectedClient?.email   ?? '');
  const [clientAdresse, setClientAdresse] = useState(preselectedClient?.adresse ?? '');

  /* Produits */
  const [produits, setProduits] = useState<Produit[]>([]);

  /* Lignes */
  const [lignes, setLignes]   = useState<Ligne[]>([makeLigne()]);

  /* Options facture */
  const [remiseMontant, setRemiseMontant] = useState(0);
  const [tvaPct,    setTvaPct]    = useState(0);
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);

  /* Chargement des clients et produits */
  const loadClients = useCallback(async () => {
    const { data } = await supabase.from('clients_comptable').select('*').eq('user_id', userId).order('nom');
    setClients(data || []);
  }, [userId]);

  const loadProduits = useCallback(async () => {
    const { data } = await supabase.from('produits_comptable').select('*').eq('user_id', userId).order('nom');
    setProduits(data || []);
  }, [userId]);

  useEffect(() => { loadClients(); }, [loadClients]);
  useEffect(() => { loadProduits(); }, [loadProduits]);

  /* Pré-remplissage si client transmis depuis ClientsPage */
  useEffect(() => {
    if (preselectedClient) {
      setClientNom(preselectedClient.nom);
      setClientPhone(preselectedClient.phone ?? '');
      setClientEmail(preselectedClient.email ?? '');
      setClientAdresse(preselectedClient.adresse ?? '');
    }
  }, [preselectedClient]);

  /* Pré-remplissage si produit transmis depuis ProduitsPage */
  useEffect(() => {
    if (preselectedProduct && produits.length > 0) {
      // Récupérer le produit complet depuis la liste
      const fullProduct = produits.find(p => p.id === preselectedProduct.id);
      if (fullProduct) {
        const prix = fullProduct.prix_unitaire || fullProduct.prix_m2 || 0;
        const newLigne: Ligne = {
          id: uid(),
          designation: fullProduct.nom,
          reference: fullProduct.reference || '',
          couleur: fullProduct.couleur || '',
          format: fullProduct.format || '',
          quantite_m2: 1,
          prix_unitaire: prix,
          remise_pct: 0,
          total_ligne: prix,
        };
        setLignes([newLigne]);
      }
    }
  }, [preselectedProduct, produits]);

  /* ── Gestion des lignes ────────────────────────────────────────── */
  const updateLigne = (id: string, patch: Partial<Ligne>) => {
    setLignes(prev => prev.map(l => l.id === id ? computeLigne({ ...l, ...patch }) : l));
  };
  const addLigne    = () => setLignes(prev => [...prev, makeLigne()]);
  const removeLigne = (id: string) => setLignes(prev => prev.filter(l => l.id !== id));

  /* ── Calculs totaux ────────────────────────────────────────────── */
  const sousTotal      = lignes.reduce((s, l) => s + l.total_ligne, 0);
  const apresRemise    = Math.max(0, sousTotal - remiseMontant);
  const tvaMontant     = apresRemise * (tvaPct / 100);
  const totalTTC       = apresRemise + tvaMontant;

  /* ── Sélection client depuis le dropdown ──────────────────────── */
  const handleSelectClient = (c: Client) => {
    setClientNom(c.nom);
    setClientPhone(c.phone ?? '');
    setClientEmail(c.email ?? '');
    setClientAdresse(c.adresse ?? '');
    setShowClientDrop(false);
    setClientSearch('');
  };

  const filteredClients = clients.filter(c => {
    const q = clientSearch.toLowerCase();
    return !q || c.nom.toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q);
  });

  /* ── Numéro de facture ────────────────────────────────────────── */
  const genNumero = async (): Promise<string> => {
    const { count } = await supabase
      .from('factures_comptable')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    const n = ((count ?? 0) + 1).toString().padStart(4, '0');
    return `FAC-${new Date().getFullYear()}-${n}`;
  };

  /* ── Sauvegarde ───────────────────────────────────────────────── */
  const handleSave = async (statut: 'brouillon' | 'emise') => {
    if (!clientNom.trim() || lignes.every(l => !l.designation.trim())) return;
    setSaving(true);
    try {
      const numero = await genNumero();
      const { data: facture, error } = await supabase
        .from('factures_comptable')
        .insert({
          user_id:         userId,
          numero,
          statut,
          client_nom:      clientNom.trim(),
          client_phone:    clientPhone.trim() || null,
          client_email:    clientEmail.trim() || null,
          client_adresse:  clientAdresse.trim() || null,
          date_facture:    new Date().toISOString().slice(0, 10),
          echeance:        null,
          sous_total:      sousTotal,
          remise_montant:  remiseMontant,
          remise_pct:      0,
          tva_pct:         tvaPct,
          tva_montant:     tvaMontant,
          total_ttc:       totalTTC,
          notes:           notes.trim() || null,
          created_at:      new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !facture) throw error;

      const lignesInsert = lignes
        .filter(l => l.designation.trim())
        .map((l, i) => ({
          facture_id:    facture.id,
          ordre:         i + 1,
          designation:   l.designation.trim(),
          reference:     l.reference.trim() || null,
          couleur:       l.couleur.trim() || null,
          format:        l.format.trim() || null,
          quantite_m2:   l.quantite_m2,
          prix_unitaire: l.prix_unitaire,
          remise_pct:    l.remise_pct,
          total_ligne:   l.total_ligne,
        }));

      await supabase.from('facture_lignes_comptable').insert(lignesInsert);
      onFactureCreee(facture.id);
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la création de la facture');
    } finally {
      setSaving(false);
    }
  };

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div>
        <h2 className="text-white text-2xl font-black tracking-tight">Nouvelle facture</h2>
        <p className="text-white/40 text-sm mt-0.5">Remplissez les informations ci-dessous</p>
      </div>

      {/* ── Section client ─────────────────────────────────────────── */}
      <div className="bg-[#0d1627] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-sm uppercase tracking-wider">Client</h3>

          {/* Bouton « Choisir un client existant » */}
          <div className="relative">
            <button
              onClick={() => setShowClientDrop(v => !v)}
              className="inline-flex items-center gap-2 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 text-xs font-bold px-3 py-1.5 rounded-lg transition"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Choisir un client
              <ChevronDown className="w-3 h-3" />
            </button>

            {showClientDrop && (
              <div className="absolute right-0 top-9 z-40 w-72 bg-[#0a0f1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                <div className="p-2 border-b border-white/5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                    <input
                      autoFocus
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      placeholder="Rechercher..."
                      className="w-full bg-[#060d1a] text-white text-sm rounded-lg pl-8 pr-3 py-2 border border-white/10 focus:outline-none focus:border-emerald-500 placeholder-white/20"
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filteredClients.length === 0 ? (
                    <div className="py-6 text-center text-white/30 text-sm">Aucun client trouvé</div>
                  ) : (
                    filteredClients.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectClient(c)}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 transition border-b border-white/[0.03] last:border-0"
                      >
                        <div className="text-white text-sm font-semibold">{c.nom}</div>
                        {c.phone && <div className="text-white/40 text-xs mt-0.5">{c.phone}</div>}
                      </button>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-white/5">
                  <button
                    onClick={() => setShowClientDrop(false)}
                    className="w-full text-white/30 hover:text-white text-xs py-1.5 flex items-center justify-center gap-1"
                  >
                    <X className="w-3 h-3" /> Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Badge client pré-sélectionné */}
        {preselectedClient && clientNom === preselectedClient.nom && (
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 text-xs font-medium">Client pré-rempli depuis la liste</span>
          </div>
        )}

        {/* Badge produit pré-sélectionné */}
        {preselectedProduct && lignes.length > 0 && lignes[0].designation === preselectedProduct.nom && (
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5">
            <Package className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-blue-400 text-xs font-medium">Produit pré-rempli depuis le catalogue</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Nom du client *</label>
            <input
              value={clientNom}
              onChange={e => setClientNom(e.target.value)}
              placeholder="M. Abdou Diallo"
              className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20 text-sm"
            />
          </div>
          <div>
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Téléphone</label>
            <input
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              placeholder="+221 77 000 00 00"
              className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20 text-sm"
            />
          </div>
          <div>
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Email</label>
            <input
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20 text-sm"
            />
          </div>
          <div>
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Adresse</label>
            <input
              value={clientAdresse}
              onChange={e => setClientAdresse(e.target.value)}
              placeholder="Cité Keur Gorgui, Dakar"
              className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20 text-sm"
            />
          </div>
        </div>
      </div>

      {/* ── Tableau des lignes ─────────────────────────────────────── */}
      <div className="bg-[#0d1627] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h3 className="text-white font-bold text-sm uppercase tracking-wider">Lignes de facturation</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-[#060d1a]">
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30 min-w-[160px]">Désignation</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30 min-w-[100px]">Référence</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30 min-w-[90px]">Couleur</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30 min-w-[90px]">Format</th>
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-white/30 min-w-[80px]">Qté (m²)</th>
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-white/30 min-w-[90px]">Prix/m²</th>
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-white/30 min-w-[80px]">Remise %</th>
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-white/30 min-w-[100px]">Total</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={l.id} className={`border-b border-white/[0.03] ${i % 2 ? 'bg-white/[0.01]' : ''}`}>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            const p = produits.find(x => x.id === e.target.value);
                            if (p) {
                              updateLigne(l.id, {
                                designation: p.nom,
                                reference: p.reference || l.reference,
                                couleur: p.couleur || l.couleur,
                                format: p.format || l.format,
                                prix_unitaire: p.prix_unitaire || l.prix_unitaire,
                              });
                            }
                            e.target.value = '';
                          }
                        }}
                        className="flex-1 bg-[#060d1a] text-white text-xs rounded-lg px-1.5 py-1 border border-white/10 focus:outline-none focus:border-emerald-500 transition"
                      >
                        <option value="">← Prod. existant</option>
                        {produits.map(p => (
                          <option key={p.id} value={p.id}>{p.nom}</option>
                        ))}
                      </select>
                      <input 
                        value={l.designation} 
                        onChange={e => updateLigne(l.id, { designation: e.target.value })}
                        placeholder="Ex: Carrelage sol"
                        className="flex-1 bg-transparent text-white placeholder-white/20 focus:outline-none focus:bg-[#060d1a] rounded-lg px-2 py-1.5 border border-transparent focus:border-white/20 transition" 
                      />
                    </div>
                   </td>
                  <td className="px-3 py-2">
                    <input 
                      value={l.reference} 
                      onChange={e => updateLigne(l.id, { reference: e.target.value })}
                      placeholder="Réf."
                      className="w-full bg-transparent text-white/70 placeholder-white/20 focus:outline-none focus:bg-[#060d1a] rounded-lg px-2 py-1.5 border border-transparent focus:border-white/20 transition text-xs" 
                    />
                   </td>
                  <td className="px-3 py-2">
                    <input 
                      value={l.couleur} 
                      onChange={e => updateLigne(l.id, { couleur: e.target.value })}
                      placeholder="Beige"
                      className="w-full bg-transparent text-white/70 placeholder-white/20 focus:outline-none focus:bg-[#060d1a] rounded-lg px-2 py-1.5 border border-transparent focus:border-white/20 transition text-xs" 
                    />
                   </td>
                  <td className="px-3 py-2">
                    <input 
                      value={l.format} 
                      onChange={e => updateLigne(l.id, { format: e.target.value })}
                      placeholder="60x60"
                      className="w-full bg-transparent text-white/70 placeholder-white/20 focus:outline-none focus:bg-[#060d1a] rounded-lg px-2 py-1.5 border border-transparent focus:border-white/20 transition text-xs" 
                    />
                   </td>
                  <td className="px-3 py-2">
                    <input 
                      type="number" min="0" step="0.01"
                      value={l.quantite_m2}
                      onChange={e => updateLigne(l.id, { quantite_m2: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-white text-right placeholder-white/20 focus:outline-none focus:bg-[#060d1a] rounded-lg px-2 py-1.5 border border-transparent focus:border-white/20 transition" 
                    />
                   </td>
                  <td className="px-3 py-2">
                    <input 
                      type="number" min="0"
                      value={l.prix_unitaire}
                      onChange={e => updateLigne(l.id, { prix_unitaire: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-white text-right placeholder-white/20 focus:outline-none focus:bg-[#060d1a] rounded-lg px-2 py-1.5 border border-transparent focus:border-white/20 transition" 
                    />
                   </td>
                  <td className="px-3 py-2">
                    <div className="relative">
                      <input
                        type="number" min="0" max="100" step="0.5"
                        value={l.remise_pct}
                        onChange={e => updateLigne(l.id, { remise_pct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                        className="w-full bg-transparent text-amber-400 text-right placeholder-white/20 focus:outline-none focus:bg-[#060d1a] rounded-lg px-2 py-1.5 border border-transparent focus:border-amber-500/30 transition pr-5"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 text-xs pointer-events-none">%</span>
                    </div>
                    {l.remise_pct > 0 && (
                      <div className="text-xs text-amber-500/60 text-right pr-2 mt-0.5">
                        - {fmt(l.quantite_m2 * l.prix_unitaire * l.remise_pct / 100)} F
                      </div>
                    )}
                   </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-bold ${l.remise_pct > 0 ? 'text-emerald-400' : 'text-white'}`}>
                      {fmt(l.total_ligne)} F
                    </span>
                   </td>
                  <td className="px-3 py-2">
                    {lignes.length > 1 && (
                      <button onClick={() => removeLigne(l.id)}
                        className="text-white/20 hover:text-red-400 transition p-1 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bouton ajout ligne */}
        <div className="p-4 border-t border-white/5">
          <button onClick={addLigne}
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition">
            <Plus className="w-4 h-4" /> Ajouter une ligne
          </button>
        </div>
      </div>

      {/* ── Totaux + options ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Notes */}
        <div className="bg-[#0d1627] border border-white/5 rounded-2xl p-5">
          <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2 block">Notes / Conditions</label>
          <textarea 
            value={notes} 
            onChange={e => setNotes(e.target.value)}
            rows={4} 
            placeholder="Conditions de paiement, délais de livraison…"
            className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20 text-sm resize-none" 
          />
        </div>

        {/* Récapitulatif */}
        <div className="bg-[#0d1627] border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider">Remise à déduire</label>
            <div className="relative w-32">
              <input 
                type="number" min="0" step="0.01"
                value={remiseMontant}
                onChange={e => setRemiseMontant(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-[#060d1a] text-amber-400 text-right rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-amber-500/40 transition pr-7 text-sm" 
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 text-xs">F</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider">TVA</label>
            <div className="relative w-28">
              <input 
                type="number" min="0" max="100" step="0.5"
                value={tvaPct}
                onChange={e => setTvaPct(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="w-full bg-[#060d1a] text-white text-right rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-emerald-500 transition pr-7 text-sm" 
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 text-xs">%</span>
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 space-y-2">
            <div className="flex justify-between text-sm text-white/50">
              <span>Sous-total HT</span>
              <span>{fmt(sousTotal)} F</span>
            </div>
            {remiseMontant > 0 && (
              <div className="flex justify-between text-sm text-amber-400">
                <span>Remise à déduire</span>
                <span>- {fmt(remiseMontant)} F</span>
              </div>
            )}
            {tvaPct > 0 && (
              <div className="flex justify-between text-sm text-white/50">
                <span>TVA ({tvaPct}%)</span>
                <span>{fmt(tvaMontant)} F</span>
              </div>
            )}
            <div className="flex justify-between font-black text-lg text-white border-t border-white/10 pt-3 mt-1">
              <span>TOTAL TTC</span>
              <span className="text-emerald-400">{fmt(totalTTC)} F CFA</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Boutons de sauvegarde ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end pb-8">
        <button
          onClick={() => handleSave('brouillon')}
          disabled={saving || !clientNom.trim()}
          className="inline-flex items-center justify-center gap-2 border border-white/10 text-white/60 hover:text-white hover:border-white/20 disabled:opacity-40 font-bold px-6 py-3 rounded-xl transition text-sm"
        >
          <Save className="w-4 h-4" /> Enregistrer en brouillon
        </button>
        <button
          onClick={() => handleSave('emise')}
          disabled={saving || !clientNom.trim() || lignes.every(l => !l.designation.trim())}
          className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white font-bold px-8 py-3 rounded-xl transition text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
        >
          {saving ? 'Enregistrement…' : <><Save className="w-4 h-4" /> Émettre la facture</>}
        </button>
      </div>
    </div>
  );
}