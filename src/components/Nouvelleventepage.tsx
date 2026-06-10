// src/components/Nouvelleventepage.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Trash2, Save, ChevronDown, X, UserCheck, Search,
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
  stock_m2: number;
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
  produit_id?: string;
}

interface NouvelleVentePageProps {
  userId: string;
  onFactureCreee: (factureId: string) => void;
  preselectedClient?: Client | null;
}

/* ─── Helpers ────────────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2);
const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(Math.round(v));

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
    total_ligne: 0,
    produit_id: undefined,
  };
}

function computeLigne(l: Ligne): Ligne {
  const brut = l.quantite_m2 * l.prix_unitaire;
  const remise = brut * (l.remise_pct / 100);
  return { ...l, total_ligne: Math.max(0, brut - remise) };
}

// Classe CSS pour supprimer les flèches des inputs number
const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/* ─── Fonctions exportées pour la gestion du stock ───────────────── */
export const updateStockForPaidInvoice = async (factureId: string, userId: string) => {
  try {
    console.log(`📦 Mise à jour du stock pour la facture ${factureId}`);
    
    const { data: lignes, error: lignesError } = await supabase
      .from('facture_lignes_comptable')
      .select('*')
      .eq('facture_id', factureId);

    if (lignesError) throw lignesError;
    if (!lignes || lignes.length === 0) {
      console.log('Aucune ligne trouvée pour cette facture');
      return;
    }

    console.log(`📋 ${lignes.length} ligne(s) à traiter`);

    for (const ligne of lignes) {
      console.log(`🔍 Traitement: ${ligne.designation} - Quantité: ${ligne.quantite_m2}`);
      
      const { data: produit, error: produitError } = await supabase
        .from('produits_comptable')
        .select('id, nom, stock_m2')
        .ilike('nom', ligne.designation.trim())
        .eq('user_id', userId)
        .maybeSingle();

      if (produitError) {
        console.error(`❌ Erreur recherche produit ${ligne.designation}:`, produitError);
        continue;
      }

      if (!produit) {
        console.warn(`⚠️ Produit non trouvé: "${ligne.designation}"`);
        continue;
      }

      console.log(`✅ Produit trouvé: ${produit.nom} (stock actuel: ${produit.stock_m2})`);

      const nouveauStock = Math.max(0, (produit.stock_m2 || 0) - ligne.quantite_m2);
      
      const { error: updateError } = await supabase
        .from('produits_comptable')
        .update({
          stock_m2: nouveauStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', produit.id);

      if (updateError) {
        console.error(`❌ Erreur mise à jour stock pour ${produit.nom}:`, updateError);
      } else {
        console.log(`📉 Stock mis à jour: ${produit.stock_m2} → ${nouveauStock} (baisse de ${ligne.quantite_m2})`);
      }
    }
    
    console.log(`✅ Mise à jour du stock terminée pour la facture ${factureId}`);
  } catch (err) {
    console.error('❌ Erreur mise à jour stock:', err);
    throw err;
  }
};

export const restoreStockForCancelledInvoice = async (factureId: string, userId: string) => {
  try {
    console.log(`🔄 RESTAURATION du stock pour la facture annulée ${factureId}`);
    
    const { data: lignes, error: lignesError } = await supabase
      .from('facture_lignes_comptable')
      .select('*')
      .eq('facture_id', factureId);

    if (lignesError) throw lignesError;
    if (!lignes || lignes.length === 0) {
      console.log('Aucune ligne trouvée pour cette facture');
      return;
    }

    console.log(`📋 ${lignes.length} ligne(s) à restaurer`);

    for (const ligne of lignes) {
      console.log(`🔍 Recherche du produit: "${ligne.designation}"`);
      
      let { data: produit, error: produitError } = await supabase
        .from('produits_comptable')
        .select('id, nom, stock_m2')
        .ilike('nom', ligne.designation.trim())
        .eq('user_id', userId)
        .maybeSingle();

      if (produitError) {
        console.error(`❌ Erreur recherche produit ${ligne.designation}:`, produitError);
        continue;
      }

      if (!produit) {
        console.log(`⚠️ Produit non trouvé exactement, tentative avec recherche élargie...`);
        const { data: produitLarge, error: largeError } = await supabase
          .from('produits_comptable')
          .select('id, nom, stock_m2')
          .ilike('nom', `%${ligne.designation}%`)
          .eq('user_id', userId)
          .maybeSingle();
        
        if (largeError || !produitLarge) {
          console.error(`❌ Produit toujours non trouvé: ${ligne.designation}`);
          continue;
        }
        
        produit = produitLarge;
        console.log(`✅ Produit trouvé par recherche élargie: ${produit.nom}`);
      } else {
        console.log(`✅ Produit trouvé: ${produit.nom} (stock actuel: ${produit.stock_m2})`);
      }

      const nouveauStock = (produit.stock_m2 || 0) + ligne.quantite_m2;
      
      const { error: updateError } = await supabase
        .from('produits_comptable')
        .update({
          stock_m2: nouveauStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', produit.id);

      if (updateError) {
        console.error(`❌ Erreur restauration stock pour ${produit.nom}:`, updateError);
      } else {
        console.log(`📈 Stock restauré: ${produit.stock_m2} → ${nouveauStock} (hausse de ${ligne.quantite_m2})`);
      }
    }
    
    console.log(`✅ Restauration du stock terminée pour la facture ${factureId}`);
  } catch (err) {
    console.error('❌ Erreur restauration stock:', err);
    throw err;
  }
};

/* ─── Composant principal ────────────────────────────────────────── */
export default function NouvelleVentePage({ userId, onFactureCreee, preselectedClient }: NouvelleVentePageProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [clientNom, setClientNom] = useState(preselectedClient?.nom ?? '');
  const [clientPhone, setClientPhone] = useState(preselectedClient?.phone ?? '');
  const [clientEmail, setClientEmail] = useState(preselectedClient?.email ?? '');
  const [clientAdresse, setClientAdresse] = useState(preselectedClient?.adresse ?? '');
  const [produits, setProduits] = useState<Produit[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([makeLigne()]);
  const [remiseMontant, setRemiseMontant] = useState(0);
  const [tvaPct, setTvaPct] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    const { data } = await supabase.from('clients_comptable').select('*').eq('user_id', userId).order('nom');
    setClients(data || []);
  }, [userId]);

  const loadProduits = useCallback(async () => {
    const { data } = await supabase.from('produits_comptable').select('*').eq('user_id', userId).eq('actif', true).order('nom');
    setProduits(data || []);
  }, [userId]);

  useEffect(() => { loadClients(); }, [loadClients]);
  useEffect(() => { loadProduits(); }, [loadProduits]);

  useEffect(() => {
    if (preselectedClient) {
      setClientNom(preselectedClient.nom);
      setClientPhone(preselectedClient.phone ?? '');
      setClientEmail(preselectedClient.email ?? '');
      setClientAdresse(preselectedClient.adresse ?? '');
    }
  }, [preselectedClient]);

  const updateLigne = (id: string, patch: Partial<Ligne>) => {
    setLignes(prev => prev.map(l => l.id === id ? computeLigne({ ...l, ...patch }) : l));
  };
  const addLigne = () => setLignes(prev => [...prev, makeLigne()]);
  const removeLigne = (id: string) => setLignes(prev => prev.filter(l => l.id !== id));

  const sousTotal = lignes.reduce((s, l) => s + l.total_ligne, 0);
  const apresRemise = Math.max(0, sousTotal - remiseMontant);
  const tvaMontant = apresRemise * (tvaPct / 100);
  const totalTTC = apresRemise + tvaMontant;

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

  const genNumero = async (retryCount = 0): Promise<string> => {
    const year = new Date().getFullYear();
    const maxRetries = 3;

    try {
      const { data: lastFacture, error } = await supabase
        .from('factures_comptable')
        .select('numero')
        .eq('user_id', userId)
        .ilike('numero', `FAC-${year}-%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (lastFacture && lastFacture.length > 0) {
        const match = lastFacture[0].numero.match(/FAC-\d+-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      const newNumero = `FAC-${year}-${String(nextNumber).padStart(4, '0')}`;

      const { data: existing } = await supabase
        .from('factures_comptable')
        .select('id')
        .eq('numero', newNumero)
        .maybeSingle();

      if (existing && retryCount < maxRetries) {
        return genNumero(retryCount + 1);
      }

      if (existing) {
        const timestamp = Date.now();
        return `FAC-${year}-${timestamp}`;
      }

      return newNumero;
    } catch (err) {
      console.error('Erreur génération numéro:', err);
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      return `FAC-${year}-${timestamp}-${random}`;
    }
  };

  const handleSave = async (statut: 'brouillon' | 'emise') => {
    if (!clientNom.trim()) {
      setError('Veuillez saisir le nom du client.');
      return;
    }

    if (lignes.every(l => !l.designation.trim())) {
      setError('Veuillez ajouter au moins un produit.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const numero = await genNumero();

      const factureData: any = {
        user_id: userId,
        numero,
        statut,
        client_nom: clientNom.trim(),
        client_phone: clientPhone.trim() || null,
        client_email: clientEmail.trim() || null,
        client_adresse: clientAdresse.trim() || null,
        date_facture: new Date().toISOString().slice(0, 10),
        sous_total: sousTotal,
        remise_montant: remiseMontant,
        tva_pct: tvaPct,
        tva_montant: tvaMontant,
        total_ttc: totalTTC,
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
      };

      const { data: facture, error } = await supabase
        .from('factures_comptable')
        .insert(factureData)
        .select()
        .single();

      if (error) {
        console.error('Erreur Supabase:', error);
        if (error.code === '23505') {
          setError('Conflit de numéro de facture. Veuillez réessayer.');
        } else {
          setError(`Erreur: ${error.message}`);
        }
        throw error;
      }

      if (!facture) throw new Error('Aucune facture créée');

      const lignesValides = lignes.filter(l => l.designation.trim());

      const lignesInsert = lignesValides.map((l, i) => ({
        facture_id: facture.id,
        ordre: i + 1,
        designation: l.designation.trim(),
        reference: l.reference.trim() || null,
        couleur: l.couleur.trim() || null,
        format: l.format.trim() || null,
        quantite_m2: l.quantite_m2,
        prix_unitaire: l.prix_unitaire,
        remise_pct: l.remise_pct,
        total_ligne: l.total_ligne,
      }));

      const { error: lignesError } = await supabase
        .from('facture_lignes_comptable')
        .insert(lignesInsert);

      if (lignesError) {
        console.error('Erreur insertion lignes:', lignesError);
        setError(`Erreur lors de l'ajout des produits: ${lignesError.message}`);
        throw lignesError;
      }

      onFactureCreee(facture.id);
    } catch (e: any) {
      console.error('Exception:', e);
      if (!error) {
        setError('Une erreur est survenue lors de la création de la facture.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-white text-2xl font-black tracking-tight">Nouvelle facture</h2>
        <p className="text-white/40 text-sm mt-0.5">Remplissez les informations ci-dessous</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* Section client */}
      <div className="bg-[#0d1627] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-sm uppercase tracking-wider">Client</h3>
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

        {preselectedClient && clientNom === preselectedClient.nom && (
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 text-xs font-medium">Client pré-rempli depuis la liste</span>
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

      {/* Tableau des lignes */}
      <div className="bg-[#0d1627] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h3 className="text-white font-bold text-sm uppercase tracking-wider">Lignes de facturation</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-[#060d1a]">
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30">Désignation</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30">Référence</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30">Couleur</th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30">Format</th>
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-white/30">Qté (m²)</th>
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-white/30">Prix/m²</th>
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-white/30">Remise %</th>
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-white/30">Total</th>
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
                                produit_id: p.id,
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
                        <option value="">← Sélectionner produit</option>
                        {produits.map(p => (
                          <option key={p.id} value={p.id}>{p.nom}</option>
                        ))}
                      </select>
                      <input 
                        value={l.designation} 
                        onChange={e => updateLigne(l.id, { designation: e.target.value, produit_id: undefined })}
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
                      type="number"
                      value={l.quantite_m2}
                      onChange={e => updateLigne(l.id, { quantite_m2: parseFloat(e.target.value) || 0 })}
                      className={`w-full bg-transparent text-white text-right placeholder-white/20 focus:outline-none focus:bg-[#060d1a] rounded-lg px-2 py-1.5 border border-transparent focus:border-white/20 transition ${noSpinnerClass}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input 
                      type="number"
                      value={l.prix_unitaire}
                      onChange={e => updateLigne(l.id, { prix_unitaire: parseFloat(e.target.value) || 0 })}
                      className={`w-full bg-transparent text-white text-right placeholder-white/20 focus:outline-none focus:bg-[#060d1a] rounded-lg px-2 py-1.5 border border-transparent focus:border-white/20 transition ${noSpinnerClass}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative">
                      <input
                        type="number"
                        value={l.remise_pct}
                        onChange={e => updateLigne(l.id, { remise_pct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                        className={`w-full bg-transparent text-amber-400 text-right placeholder-white/20 focus:outline-none focus:bg-[#060d1a] rounded-lg px-2 py-1.5 border border-transparent focus:border-amber-500/30 transition pr-5 ${noSpinnerClass}`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 text-xs pointer-events-none">%</span>
                    </div>
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
        <div className="p-4 border-t border-white/5">
          <button onClick={addLigne}
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition">
            <Plus className="w-4 h-4" /> Ajouter une ligne
          </button>
        </div>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        <div className="bg-[#0d1627] border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider">Remise à déduire</label>
            <div className="relative w-32">
              <input 
                type="number"
                value={remiseMontant}
                onChange={e => setRemiseMontant(Math.max(0, parseFloat(e.target.value) || 0))}
                className={`w-full bg-[#060d1a] text-amber-400 text-right rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-amber-500/40 transition pr-7 text-sm ${noSpinnerClass}`}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 text-xs">F</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider">TVA</label>
            <div className="relative w-28">
              <input 
                type="number"
                value={tvaPct}
                onChange={e => setTvaPct(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                className={`w-full bg-[#060d1a] text-white text-right rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-emerald-500 transition pr-7 text-sm ${noSpinnerClass}`}
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

      {/* Boutons */}
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