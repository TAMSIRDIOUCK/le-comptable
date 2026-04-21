// src/components/ProduitsPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, Plus, Pencil, Trash2, AlertTriangle, X, Check } from 'lucide-react';
import type { Produit } from '../types';

interface ProduitsPageProps { userId: string; }

const CATEGORIES = ['Carrelage Sol', 'Carrelage Mur', 'Faïence', 'Mosaïque', 'Grès Cérame', 'Accessoire', 'Autre'];
const COULEURS   = ['Beige', 'Blanc', 'Gris Clair', 'Gris Foncé', 'Noir', 'Marron', 'Crème', 'Bleu', 'Vert', 'Rouge', 'Autres'];
const FORMATS    = ['20x20', '30x30', '30x60', '40x40', '45x45', '60x60', '60x120', '75x75', '80x80', '90x90', '120x120', 'Autre'];

const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(v);

interface FormState {
  nom: string; reference: string; categorie: string; couleur: string;
  format: string; stock_m2: string; prix_m2: string; seuil_alerte: string;
}
const emptyForm: FormState = {
  nom: '',
  reference: '',
  categorie: 'Carrelage Sol',  // valeur par défaut mais non obligatoire
  couleur: 'Beige',
  format: '60x60',
  stock_m2: '',
  prix_m2: '',
  seuil_alerte: '10'           // valeur par défaut
};

export default function ProduitsPage({ userId }: ProduitsPageProps) {
  const [produits, setProduits]     = useState<Produit[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Produit | null>(null);
  const [form, setForm]             = useState<FormState>(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [searchQ, setSearchQ]       = useState('');
  const [catFilter, setCatFilter]   = useState('Tous');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('produits_comptable').select('*').eq('user_id', userId).eq('actif', true).order('created_at', { ascending: false });
    setProduits(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (p: Produit) => {
    setEditing(p);
    setForm({
      nom: p.nom,
      reference: p.reference ?? '',
      categorie: p.categorie ?? 'Carrelage Sol',
      couleur: p.couleur ?? 'Beige',
      format: p.format ?? '60x60',
      stock_m2: p.stock_m2 !== undefined ? String(p.stock_m2) : '',
      prix_m2: p.prix_m2 !== undefined ? String(p.prix_m2) : '',
      seuil_alerte: String(p.seuil_alerte ?? 10)
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    // Validation : seulement nom, couleur et format sont obligatoires
    if (!form.nom.trim() || !form.couleur || !form.format) {
      alert('Veuillez remplir tous les champs obligatoires : Désignation, Couleur, Format.');
      return;
    }
    setSaving(true);
    // Conversion : stock et prix optionnels → 0 si vide
    const stock = form.stock_m2 === '' ? 0 : parseFloat(form.stock_m2);
    const prix = form.prix_m2 === '' ? 0 : parseFloat(form.prix_m2);
    const seuil = form.seuil_alerte === '' ? 10 : parseFloat(form.seuil_alerte);

    const payload = {
      nom: form.nom.trim(),
      reference: form.reference.trim() || null,
      categorie: form.categorie || null,
      couleur: form.couleur,
      format: form.format,
      stock_m2: isNaN(stock) ? 0 : stock,
      prix_m2: isNaN(prix) ? 0 : prix,
      seuil_alerte: isNaN(seuil) ? 10 : seuil,
      user_id: userId,
      actif: true,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('produits_comptable').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('produits_comptable').insert({ ...payload, created_at: new Date().toISOString() });
    }
    setSaving(false); setShowModal(false); load();
  };

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Supprimer "${nom}" ?`)) return;
    await supabase.from('produits_comptable').update({ actif: false }).eq('id', id);
    setProduits(p => p.filter(x => x.id !== id));
  };

  const filtered = produits.filter(p => {
    const q = searchQ.toLowerCase();
    const matchCat = catFilter === 'Tous' || p.categorie === catFilter;
    const matchQ = !q || p.nom.toLowerCase().includes(q) || (p.reference ?? '').toLowerCase().includes(q) || (p.couleur ?? '').toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  const cats = ['Tous', ...CATEGORIES.filter(c => produits.some(p => p.categorie === c))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-2xl font-black tracking-tight">Catalogue Produits</h2>
          <p className="text-white/40 text-sm mt-0.5">{produits.length} article{produits.length > 1 ? 's' : ''} en stock</p>
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-5 py-2.5 rounded-xl transition hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]">
          <Plus className="w-4 h-4" /> Nouveau produit
        </button>
      </div>

      {/* Alertes stock bas (uniquement si stock >0 et <= seuil) */}
      {produits.filter(p => p.stock_m2 > 0 && p.stock_m2 <= p.seuil_alerte).length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-semibold text-sm">Stock bas détecté</p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              {produits.filter(p => p.stock_m2 > 0 && p.stock_m2 <= p.seuil_alerte).map(p => p.nom).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
          placeholder="Rechercher par nom, référence, couleur..."
          className="flex-1 bg-[#0d1627] text-white rounded-xl px-4 py-2.5 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20 text-sm" />
        <div className="flex gap-2 flex-wrap">
          {cats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${catFilter === c ? 'bg-emerald-500 text-white' : 'bg-[#0d1627] text-white/40 hover:text-white border border-white/10'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-white/30 animate-pulse">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[#0d1627] border border-white/5 rounded-2xl">
          <Package className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-white/30">Aucun produit trouvé</p>
          <button onClick={openAdd} className="mt-4 text-emerald-400 hover:text-emerald-300 text-sm">Ajouter un premier produit →</button>
        </div>
      ) : (
        <div className="bg-[#0d1627] border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Désignation', 'Catégorie', 'Format', 'Couleur', 'Stock (m²)', 'Prix/m²', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const stockBas = p.stock_m2 > 0 && p.stock_m2 <= p.seuil_alerte;
                  return (
                    <tr key={p.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white text-sm">{p.nom}</div>
                        {p.reference && <div className="text-white/30 text-xs mt-0.5">Réf: {p.reference}</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        {p.categorie ? (
                          <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md font-medium">{p.categorie}</span>
                        ) : (
                          <span className="text-white/30 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-white/60 text-sm">{p.format || '—'}</td>
                      <td className="px-4 py-3.5 text-white/60 text-sm">{p.couleur || '—'}</td>
                      <td className="px-4 py-3.5">
                        {p.stock_m2 > 0 ? (
                          <div className={`flex items-center gap-1.5 text-sm font-bold ${stockBas ? 'text-amber-400' : 'text-white/80'}`}>
                            {stockBas && <AlertTriangle className="w-3.5 h-3.5" />}
                            {fmt(p.stock_m2)} m²
                          </div>
                        ) : (
                          <span className="text-white/30 text-sm">—</span>
                        )}
                        {stockBas && <div className="text-amber-400/50 text-xs">Seuil: {p.seuil_alerte} m²</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        {p.prix_m2 > 0 ? (
                          <span className="text-emerald-400 font-bold text-sm">{fmt(p.prix_m2)} F/m²</span>
                        ) : (
                          <span className="text-white/30 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(p)} className="text-white/30 hover:text-white transition p-1"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(p.id, p.nom)} className="text-white/30 hover:text-red-400 transition p-1"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal ajout/édition */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[#0d1627] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h3 className="text-white font-bold text-lg">{editing ? 'Modifier le produit' : 'Nouveau produit'}</h3>
              <button onClick={() => setShowModal(false)} className="text-white/30 hover:text-white transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Désignation (obligatoire) */}
              <div>
                <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Désignation *</label>
                <input value={form.nom} onChange={e => setForm(f => ({...f, nom: e.target.value}))}
                  placeholder="Ex: Carrelage Sol Beige Sable 60x60"
                  className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Référence (optionnel) */}
                <div>
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Référence (optionnel)</label>
                  <input value={form.reference} onChange={e => setForm(f => ({...f, reference: e.target.value}))}
                    placeholder="REF-001"
                    className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20" />
                </div>
                {/* Catégorie (optionnel) */}
                <div>
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Catégorie (optionnel)</label>
                  <select value={form.categorie} onChange={e => setForm(f => ({...f, categorie: e.target.value}))}
                    className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition">
                    <option value="">— Non spécifiée —</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Couleur (obligatoire) */}
                <div>
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Couleur *</label>
                  <select value={form.couleur} onChange={e => setForm(f => ({...f, couleur: e.target.value}))}
                    className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition">
                    {COULEURS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* Format (obligatoire) */}
                <div>
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Format (cm) *</label>
                  <select value={form.format} onChange={e => setForm(f => ({...f, format: e.target.value}))}
                    className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition">
                    {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {/* Stock (optionnel) */}
                <div>
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Stock (m²) (optionnel)</label>
                  <input type="number" min="0" step="0.01" value={form.stock_m2} onChange={e => setForm(f => ({...f, stock_m2: e.target.value}))}
                    placeholder="0"
                    className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20" />
                </div>
                {/* Prix/m² (optionnel) */}
                <div>
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Prix/m² (F) (optionnel)</label>
                  <input type="number" min="0" value={form.prix_m2} onChange={e => setForm(f => ({...f, prix_m2: e.target.value}))}
                    placeholder="12500"
                    className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20" />
                </div>
                {/* Seuil alerte (optionnel) */}
                <div>
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">Seuil alerte (optionnel)</label>
                  <input type="number" min="0" value={form.seuil_alerte} onChange={e => setForm(f => ({...f, seuil_alerte: e.target.value}))}
                    placeholder="10"
                    className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition" />
                </div>
              </div>
              <p className="text-white/30 text-xs mt-2">* Champs obligatoires : Désignation, Couleur, Format</p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-white/10 text-white/50 hover:text-white py-3 rounded-xl font-medium transition">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.nom.trim() || !form.couleur || !form.format}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2">
                {saving ? '...' : <><Check className="w-4 h-4" /> {editing ? 'Modifier' : 'Ajouter'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}