// src/components/NouvelleVentePage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Search, Check, FileText } from 'lucide-react';
import type { Produit, LigneFacture } from '../types';

interface NouvelleVentePageProps {
  userId: string;
  onFactureCreee: (factureId: string) => void;
}

const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(Math.round(v));

// Ligne vide manuelle (sans produit catalogue)
const newLigneManuelle = (ordre: number): LigneFacture => ({
  produit_id: undefined,
  designation: '',
  reference: undefined,
  couleur: undefined,
  format: undefined,
  quantite_m2: 1,
  prix_unitaire: 0,
  total_ligne: 0,
  ordre,
});

export default function NouvelleVentePage({ userId, onFactureCreee }: NouvelleVentePageProps) {
  const [produits, setProduits]           = useState<Produit[]>([]);
  const [lignes, setLignes]               = useState<LigneFacture[]>([]);
  const [clientNom, setClientNom]         = useState('');
  const [clientPhone, setClientPhone]     = useState('');
  const [clientAdresse, setClientAdresse] = useState('');
  const [dateFacture, setDateFacture]     = useState(new Date().toISOString().split('T')[0]);
  const [tvaPct, setTvaPct]               = useState('0');
  const [notes, setNotes]                 = useState('');
  const [saving, setSaving]               = useState(false);
  const [searchProd, setSearchProd]       = useState('');
  const [showProdModal, setShowProdModal] = useState(false);

  useEffect(() => {
    supabase
      .from('produits_comptable')
      .select('*')
      .eq('user_id', userId)
      .eq('actif', true)
      .order('nom')
      .then(({ data }) => setProduits(data || []));
  }, [userId]);

  // ── Calculs ────────────────────────────────────────────────────────────────
  const calculs = useMemo(() => {
    const sousTotal  = lignes.reduce((s, l) => s + l.total_ligne, 0);
    const tvaMontant = sousTotal * (parseFloat(tvaPct) || 0) / 100;
    return { sousTotal, tvaMontant, totalTTC: sousTotal + tvaMontant };
  }, [lignes, tvaPct]);

  // ── Gestion des lignes ─────────────────────────────────────────────────────

  /** Ajoute une ligne depuis le catalogue (prix à 0 — l'utilisateur le saisit ensuite) */
  const addLigneFromCatalogue = (produit: Produit) => {
    setLignes(prev => [
      ...prev,
      {
        produit_id:    produit.id,
        designation:   produit.nom,
        reference:     produit.reference,
        couleur:       produit.couleur,
        format:        produit.format,
        quantite_m2:   1,
        prix_unitaire: 0,   // ← à saisir manuellement
        total_ligne:   0,
        ordre:         prev.length,
      },
    ]);
    setShowProdModal(false);
    setSearchProd('');
  };

  /** Ajoute une ligne entièrement manuelle */
  const addLigneManuelle = () => {
    setLignes(prev => [...prev, newLigneManuelle(prev.length)]);
    setShowProdModal(false);
    setSearchProd('');
  };

  const updateDesignation = (idx: number, val: string) =>
    setLignes(prev => prev.map((l, i) => i === idx ? { ...l, designation: val } : l));

  const updateQte = (idx: number, val: string) => {
    const q = parseFloat(val) || 0;
    setLignes(prev =>
      prev.map((l, i) => i === idx ? { ...l, quantite_m2: q, total_ligne: q * l.prix_unitaire } : l),
    );
  };

  const updatePrix = (idx: number, val: string) => {
    const p = parseFloat(val) || 0;
    setLignes(prev =>
      prev.map((l, i) => i === idx ? { ...l, prix_unitaire: p, total_ligne: l.quantite_m2 * p } : l),
    );
  };

  const removeLigne = (idx: number) =>
    setLignes(prev => prev.filter((_, i) => i !== idx));

  // ── Numérotation ───────────────────────────────────────────────────────────
  const nextNumero = useCallback(async (): Promise<string> => {
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('factures_comptable')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${year}-01-01`)
      .lte('created_at', `${year}-12-31`);
    const n = (count ?? 0) + 1;
    return `FAC-${year}-${String(n).padStart(4, '0')}`;
  }, [userId]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!clientNom.trim()) return 'Le nom du client est requis.';
    if (lignes.length === 0) return 'Ajoutez au moins un produit.';
    for (let i = 0; i < lignes.length; i++) {
      if (!lignes[i].designation.trim()) return `La ligne ${i + 1} doit avoir une désignation.`;
    }
    return null;
  };

  // ── Sauvegarde ─────────────────────────────────────────────────────────────
  const handleSave = async (statut: 'brouillon' | 'emise') => {
    const err = validate();
    if (err) { alert(err); return; }

    setSaving(true);
    try {
      const numero = await nextNumero();
      const { data: facture, error: fErr } = await supabase
        .from('factures_comptable')
        .insert({
          user_id:          userId,
          numero,
          client_nom:       clientNom.trim(),
          client_phone:     clientPhone.trim(),
          client_adresse:   clientAdresse.trim(),
          date_facture:     dateFacture,
          sous_total:       calculs.sousTotal,
          tva_pct:          parseFloat(tvaPct) || 0,
          tva_montant:      calculs.tvaMontant,
          remise_pct:       0,
          remise_montant:   0,
          total_ttc:        calculs.totalTTC,
          statut,
          notes:            notes.trim(),
          created_at:       new Date().toISOString(),
          updated_at:       new Date().toISOString(),
        })
        .select()
        .single();

      if (fErr) throw fErr;

      // Insérer les lignes
      const lignesPayload = lignes.map((l, i) => ({
        facture_id:    facture.id,
        produit_id:    l.produit_id ?? null,
        designation:   l.designation,
        reference:     l.reference ?? null,
        couleur:       l.couleur ?? null,
        format:        l.format ?? null,
        quantite_m2:   l.quantite_m2,
        prix_unitaire: l.prix_unitaire,
        total_ligne:   l.total_ligne,
        ordre:         i,
      }));
      await supabase.from('facture_lignes_comptable').insert(lignesPayload);

      // Déduire le stock uniquement pour les produits du catalogue
      for (const l of lignes) {
        if (l.produit_id) {
          const prod = produits.find(p => p.id === l.produit_id);
          if (prod) {
            const newStock = Math.max(0, prod.stock_m2 - l.quantite_m2);
            await supabase
              .from('produits_comptable')
              .update({ stock_m2: newStock, updated_at: new Date().toISOString() })
              .eq('id', l.produit_id);
          }
        }
      }

      onFactureCreee(facture.id);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const filteredProduits = produits.filter(p => {
    const q = searchProd.toLowerCase();
    return (
      !q ||
      p.nom.toLowerCase().includes(q) ||
      (p.reference ?? '').toLowerCase().includes(q) ||
      (p.couleur ?? '').toLowerCase().includes(q)
    );
  });

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-white text-2xl font-black tracking-tight">Nouvelle Facture</h2>
        <p className="text-white/40 text-sm mt-0.5">Créez et émettez une facture professionnelle</p>
      </div>

      {/* ── Infos client + TVA ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client */}
        <div className="bg-[#0d1627] border border-white/5 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <span className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-md flex items-center justify-center text-xs font-black">1</span>
            Informations client
          </h3>

          <div>
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Nom du client *</label>
            <input
              value={clientNom}
              onChange={e => setClientNom(e.target.value)}
              placeholder="M. Abdou Diallo / Société XYZ"
              className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Téléphone</label>
              <input
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
                placeholder="+221 77 000 00 00"
                className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Date facture</label>
              <input
                type="date"
                value={dateFacture}
                onChange={e => setDateFacture(e.target.value)}
                className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Adresse</label>
            <input
              value={clientAdresse}
              onChange={e => setClientAdresse(e.target.value)}
              placeholder="Cité Keur Gorgui, Dakar"
              className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20"
            />
          </div>
        </div>

        {/* TVA + notes */}
        <div className="bg-[#0d1627] border border-white/5 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <span className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-md flex items-center justify-center text-xs font-black">2</span>
            TVA &amp; Notes
          </h3>

          <div>
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">TVA (%)</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={tvaPct}
                onChange={e => setTvaPct(e.target.value)}
                className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                {['0', '10', '18'].map(v => (
                  <button
                    key={v}
                    onClick={() => setTvaPct(v)}
                    className={`text-xs px-1.5 py-0.5 rounded transition ${tvaPct === v ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/40 hover:bg-white/20'}`}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Notes / Conditions</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Paiement sous 30 jours. Merci pour votre confiance."
              className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20 resize-none text-sm"
            />
          </div>
        </div>
      </div>

      {/* ── Lignes produits ─────────────────────────────────────────────────── */}
      <div className="bg-[#0d1627] border border-white/5 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <span className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-md flex items-center justify-center text-xs font-black">3</span>
            Produits ({lignes.length} ligne{lignes.length !== 1 ? 's' : ''})
          </h3>
          <button
            onClick={() => setShowProdModal(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold px-4 py-2 rounded-xl transition"
          >
            <Plus className="w-4 h-4" /> Ajouter un produit
          </button>
        </div>

        {lignes.length === 0 ? (
          <div className="text-center py-12 text-white/20">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun produit ajouté. Cliquez sur "Ajouter un produit".</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/[0.02]">
                <tr>
                  {['Désignation *', 'Couleur / Format', 'Qté (m²)', 'Prix/m² (F)', 'Total (F)', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, idx) => (
                  <tr key={idx} className="border-t border-white/[0.03]">
                    {/* Désignation — toujours éditable */}
                    <td className="px-4 py-3 min-w-[180px]">
                      <input
                        value={l.designation}
                        onChange={e => updateDesignation(idx, e.target.value)}
                        placeholder="Désignation *"
                        className={`w-full bg-[#060d1a] text-white rounded-lg px-3 py-1.5 border focus:outline-none focus:border-emerald-500 transition text-sm placeholder-white/20 ${
                          !l.designation.trim() ? 'border-red-500/50' : 'border-white/10'
                        }`}
                      />
                      {l.reference && (
                        <div className="text-white/30 text-xs mt-1 pl-1">Réf: {l.reference}</div>
                      )}
                    </td>

                    {/* Couleur / Format */}
                    <td className="px-4 py-3 text-white/40 text-sm whitespace-nowrap">
                      {[l.couleur, l.format].filter(Boolean).join(' · ') || '—'}
                    </td>

                    {/* Quantité */}
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={l.quantite_m2}
                        onChange={e => updateQte(idx, e.target.value)}
                        className="w-24 bg-[#060d1a] text-white rounded-lg px-3 py-1.5 border border-white/10 focus:outline-none focus:border-emerald-500 transition text-sm"
                      />
                    </td>

                    {/* Prix — toujours à saisir manuellement */}
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={l.prix_unitaire || ''}
                        onChange={e => updatePrix(idx, e.target.value)}
                        placeholder="Prix"
                        className={`w-32 bg-[#060d1a] text-white rounded-lg px-3 py-1.5 border focus:outline-none focus:border-emerald-500 transition text-sm placeholder-white/20 ${
                          l.prix_unitaire === 0 ? 'border-amber-500/40' : 'border-white/10'
                        }`}
                      />
                    </td>

                    {/* Total */}
                    <td className="px-4 py-3 text-emerald-400 font-bold text-sm whitespace-nowrap">
                      {fmt(l.total_ligne)} F
                    </td>

                    {/* Supprimer */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeLigne(idx)}
                        className="text-white/20 hover:text-red-400 transition p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totaux */}
        {lignes.length > 0 && (
          <div className="border-t border-white/5 p-5 flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between text-white/50">
                <span>Sous-total HT</span>
                <span>{fmt(calculs.sousTotal)} F</span>
              </div>
              {parseFloat(tvaPct) > 0 && (
                <div className="flex justify-between text-white/50">
                  <span>TVA ({tvaPct}%)</span>
                  <span>{fmt(calculs.tvaMontant)} F</span>
                </div>
              )}
              <div className="flex justify-between text-white font-black text-base border-t border-white/10 pt-2">
                <span>TOTAL TTC</span>
                <span className="text-emerald-400">{fmt(calculs.totalTTC)} F</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pb-8">
        <button
          onClick={() => handleSave('brouillon')}
          disabled={saving}
          className="flex-1 sm:flex-none border border-white/10 hover:border-white/30 text-white/60 hover:text-white font-medium px-6 py-3.5 rounded-xl transition disabled:opacity-50"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder en brouillon'}
        </button>
        <button
          onClick={() => handleSave('emise')}
          disabled={saving}
          className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-3.5 rounded-xl transition hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          {saving ? '...' : 'Émettre la facture'}
        </button>
      </div>

      {/* ── Modal sélection produit ─────────────────────────────────────────── */}
      {showProdModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => { setShowProdModal(false); setSearchProd(''); }}
        >
          <div
            className="bg-[#0d1627] border border-white/10 rounded-2xl w-full max-w-lg max-h-[75vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/5">
              <h3 className="text-white font-bold mb-3">Ajouter un produit</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  autoFocus
                  value={searchProd}
                  onChange={e => setSearchProd(e.target.value)}
                  placeholder="Rechercher dans le catalogue..."
                  className="w-full bg-[#060d1a] text-white rounded-xl pl-9 pr-4 py-2.5 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-1">
              {/* Ligne manuelle */}
              <button
                onClick={addLigneManuelle}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-500/10 border border-dashed border-white/10 hover:border-emerald-500/30 transition text-left mb-2"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-emerald-400 font-semibold text-sm">Ligne manuelle</div>
                  <div className="text-white/30 text-xs">Saisir désignation et prix manuellement</div>
                </div>
              </button>

              {/* Séparateur */}
              {filteredProduits.length > 0 && (
                <div className="flex items-center gap-2 py-1 px-1">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-white/20 text-xs uppercase tracking-wider">Catalogue</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
              )}

              {/* Produits catalogue */}
              {filteredProduits.length === 0 && searchProd && (
                <p className="text-center text-white/30 py-6 text-sm">Aucun produit trouvé dans le catalogue</p>
              )}
              {filteredProduits.map(p => (
                <button
                  key={p.id}
                  onClick={() => addLigneFromCatalogue(p)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition text-left"
                >
                  <div>
                    <div className="text-white font-medium text-sm">{p.nom}</div>
                    <div className="text-white/30 text-xs mt-0.5">
                      {[p.reference, p.couleur, p.format].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-white/40 text-xs">Catalogue</div>
                    <div className={`text-xs mt-0.5 ${p.stock_m2 <= p.seuil_alerte ? 'text-amber-400' : 'text-white/30'}`}>
                      Stock: {fmt(p.stock_m2)} m²
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}