// src/components/ClientsPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Plus, Pencil, Trash2, X, Check, Search, FileText } from 'lucide-react';
import type { Client } from '../types';

interface ClientsPageProps { 
  userId: string;
  onCreerFacture?: (client: Client) => void;  // ← Nouvelle prop
}

interface FormState { nom: string; phone: string; adresse: string; email: string; }
const emptyForm: FormState = { nom: '', phone: '', adresse: '', email: '' };

export default function ClientsPage({ userId, onCreerFacture }: ClientsPageProps) {
  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState<Client | null>(null);
  const [form, setForm]         = useState<FormState>(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [searchQ, setSearchQ]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('clients_comptable').select('*').eq('user_id', userId).order('nom');
    setClients(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ nom: c.nom, phone: c.phone ?? '', adresse: c.adresse ?? '', email: c.email ?? '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nom.trim()) return;
    setSaving(true);
    const payload = { 
      nom: form.nom.trim(), 
      phone: form.phone.trim() || null, 
      adresse: form.adresse.trim() || null, 
      email: form.email.trim() || null, 
      user_id: userId,
      updated_at: new Date().toISOString()
    };
    
    if (editing) {
      await supabase.from('clients_comptable').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('clients_comptable').insert({ 
        ...payload, 
        created_at: new Date().toISOString() 
      });
    }
    setSaving(false); 
    setShowModal(false); 
    load();
  };

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Supprimer le client "${nom}" ?`)) return;
    await supabase.from('clients_comptable').delete().eq('id', id);
    setClients(c => c.filter(x => x.id !== id));
  };

  const handleCreerFacture = (client: Client) => {
    if (onCreerFacture) {
      onCreerFacture(client);
    }
  };

  const filtered = clients.filter(c => {
    const q = searchQ.toLowerCase();
    return !q || c.nom.toLowerCase().includes(q) || (c.phone ?? '').includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-2xl font-black tracking-tight">Clients</h2>
          <p className="text-white/40 text-sm mt-0.5">{clients.length} client{clients.length > 1 ? 's' : ''} enregistré{clients.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-5 py-2.5 rounded-xl transition">
          <Plus className="w-4 h-4" /> Nouveau client
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input 
          value={searchQ} 
          onChange={e => setSearchQ(e.target.value)} 
          placeholder="Rechercher un client..."
          className="w-full bg-[#0d1627] text-white rounded-xl pl-9 pr-4 py-2.5 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20 text-sm" 
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-white/30 animate-pulse">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[#0d1627] border border-white/5 rounded-2xl">
          <Users className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-white/30">Aucun client trouvé</p>
          <button onClick={openAdd} className="mt-4 text-emerald-400 hover:text-emerald-300 text-sm">Ajouter un client →</button>
        </div>
      ) : (
        <div className="bg-[#0d1627] border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30">Téléphone</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30">Adresse</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/30">Email</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-white/30">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition ${i % 2 ? 'bg-white/[0.01]' : ''}`}>
                    <td className="px-4 py-3.5 text-white font-semibold text-sm">{c.nom}</td>
                    <td className="px-4 py-3.5 text-white/60 text-sm">{c.phone || '—'}</td>
                    <td className="px-4 py-3.5 text-white/60 text-sm">{c.adresse || '—'}</td>
                    <td className="px-4 py-3.5 text-white/60 text-sm">{c.email || '—'}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-2 justify-center">
                        {/* Bouton Créer une facture */}
                        <button 
                          onClick={() => handleCreerFacture(c)} 
                          className="text-emerald-400 hover:text-emerald-300 transition p-1.5 bg-emerald-500/10 rounded-lg"
                          title="Créer une facture pour ce client"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openEdit(c)} 
                          className="text-white/30 hover:text-white transition p-1.5"
                          title="Modifier le client"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(c.id, c.nom)} 
                          className="text-white/30 hover:text-red-400 transition p-1.5"
                          title="Supprimer le client"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal ajout/édition */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[#0d1627] border border-white/10 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h3 className="text-white font-bold text-lg">{editing ? 'Modifier le client' : 'Nouveau client'}</h3>
              <button onClick={() => setShowModal(false)} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Nom *', key: 'nom', placeholder: 'M. Abdou Diallo / Société XYZ', required: true },
                { label: 'Téléphone', key: 'phone', placeholder: '+221 77 000 00 00', required: false },
                { label: 'Adresse', key: 'adresse', placeholder: 'Cité Keur Gorgui, Dakar', required: false },
                { label: 'Email', key: 'email', placeholder: 'client@email.com', required: false },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1.5 block">
                    {label} {!label.includes('*') && <span className="text-white/20 text-[10px]">(optionnel)</span>}
                  </label>
                  <input 
                    value={(form as any)[key]} 
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-[#060d1a] text-white rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-emerald-500 transition placeholder-white/20" 
                  />
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-white/10 text-white/50 hover:text-white py-3 rounded-xl font-medium transition">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.nom.trim()}
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