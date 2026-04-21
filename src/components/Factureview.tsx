// src/components/FactureView.tsx
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Printer, ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import type { Facture, LigneFacture, Profile } from '../types';

interface FactureViewProps {
  factureId: string;
  profile: Profile;
  onBack: () => void;
}

const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(Math.round(v));
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

const STATUT_CONFIG = {
  brouillon: { label: 'Brouillon', color: 'text-white/40 bg-white/5 border-white/10', icon: Clock },
  emise:     { label: 'Émise',     color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: AlertCircle },
  payee:     { label: 'Payée',     color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle },
  annulee:   { label: 'Annulée',   color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: XCircle },
};

export default function FactureView({ factureId, profile, onBack }: FactureViewProps) {
  const [facture, setFacture] = useState<Facture | null>(null);
  const [lignes, setLignes]   = useState<LigneFacture[]>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: f } = await supabase.from('factures_comptable').select('*').eq('id', factureId).single();
      const { data: l } = await supabase.from('facture_lignes_comptable').select('*').eq('facture_id', factureId).order('ordre');
      setFacture(f); setLignes(l || []);
      setLoading(false);
    };
    load();
  }, [factureId]);

  const updateStatut = async (statut: Facture['statut']) => {
    await supabase.from('factures_comptable').update({ statut, updated_at: new Date().toISOString() }).eq('id', factureId);
    setFacture(f => f ? { ...f, statut } : f);
  };

  const handlePrint = () => {
    if (!printRef.current || !facture) return;
    const win = window.open('', '', 'width=900,height=1200');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Facture ${facture.numero} — ${profile.company_name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; background: white; }
          .facture { max-width: 800px; margin: 0 auto; padding: 40px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 3px solid #10b981; }
          .company-name { font-size: 26px; font-weight: 900; text-transform: uppercase; color: #0a0f1e; letter-spacing: 0.05em; }
          .company-details { font-size: 11px; color: #6b7280; margin-top: 6px; line-height: 1.6; }
          .facture-info { text-align: right; }
          .facture-numero { font-size: 22px; font-weight: 800; color: #10b981; }
          .facture-date { font-size: 12px; color: #6b7280; margin-top: 4px; }
          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 35px; }
          .partie-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; font-weight: 700; margin-bottom: 8px; }
          .partie-nom { font-size: 16px; font-weight: 700; color: #111; }
          .partie-detail { font-size: 12px; color: #6b7280; margin-top: 3px; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          thead { background: #0a0f1e; }
          th { padding: 12px 14px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: white; font-weight: 700; }
          th:last-child, td:last-child { text-align: right; }
          td { padding: 12px 14px; font-size: 12px; border-bottom: 1px solid #f3f4f6; }
          tr:nth-child(even) td { background: #f9fafb; }
          .td-designation { font-weight: 600; color: #111; }
          .td-ref { font-size: 10px; color: #9ca3af; margin-top: 2px; }
          .totaux { display: flex; justify-content: flex-end; margin-bottom: 30px; }
          .totaux-inner { width: 260px; }
          .totaux-ligne { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #6b7280; }
          .totaux-total { display: flex; justify-content: space-between; padding: 12px 0; font-size: 17px; font-weight: 900; color: #111; border-top: 2px solid #e5e7eb; margin-top: 6px; }
          .total-ttc { color: #10b981; }
          .footer { border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 11px; color: #9ca3af; text-align: center; line-height: 1.6; }
          .statut-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
          .statut-emise { background: #dbeafe; color: #1d4ed8; }
          .statut-payee { background: #d1fae5; color: #065f46; }
          .statut-brouillon { background: #f3f4f6; color: #6b7280; }
          .statut-annulee { background: #fee2e2; color: #991b1b; }
          .nif-rc { font-size: 10px; color: #9ca3af; margin-top: 4px; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${printRef.current.innerHTML}
      </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  if (loading) return (
    <div className="text-center py-20 text-white/30 animate-pulse">Chargement de la facture...</div>
  );
  if (!facture) return (
    <div className="text-center py-20 text-red-400">Facture introuvable</div>
  );

  const cfg = STATUT_CONFIG[facture.statut];
  const StatutIcon = cfg.icon;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Actions barre */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-white/40 hover:text-white transition text-sm">
          <ArrowLeft className="w-4 h-4" /> Retour aux factures
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Changer statut */}
          <div className="flex gap-2">
            {facture.statut !== 'payee' && facture.statut !== 'annulee' && (
              <button onClick={() => updateStatut('payee')}
                className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold px-3 py-2 rounded-lg transition">
                <CheckCircle className="w-3.5 h-3.5" /> Marquer payée
              </button>
            )}
            {facture.statut === 'brouillon' && (
              <button onClick={() => updateStatut('emise')}
                className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 text-xs font-bold px-3 py-2 rounded-lg transition">
                Émettre
              </button>
            )}
            {facture.statut !== 'annulee' && (
              <button onClick={() => updateStatut('annulee')}
                className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-bold px-3 py-2 rounded-lg transition">
                Annuler
              </button>
            )}
          </div>
          <button onClick={handlePrint}
            className="flex items-center gap-2 bg-white text-black font-bold px-5 py-2 rounded-xl transition hover:bg-zinc-100">
            <Printer className="w-4 h-4" /> Imprimer
          </button>
        </div>
      </div>

      {/* Badge statut */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${cfg.color}`}>
        <StatutIcon className="w-3.5 h-3.5" /> {cfg.label}
      </div>

      {/* Facture (rendu imprimable) */}
      <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
        <div ref={printRef}>
          <div className="facture" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: '#1a1a1a' }}>
            
            {/* En-tête entreprise */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', paddingBottom: '30px', borderBottom: '3px solid #10b981' }}>
              <div>
                <div style={{ fontSize: '26px', fontWeight: '900', textTransform: 'uppercase', color: '#0a0f1e', letterSpacing: '0.05em' }}>
                  {profile.company_name}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px', lineHeight: '1.6' }}>
                  {profile.address && <div>{profile.address}</div>}
                  {profile.phone && <div>Tél: {profile.phone}</div>}
                  {profile.email && <div>{profile.email}</div>}
                </div>
                {(profile.nif || profile.rc) && (
                  <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                    {profile.nif && <span>NIF: {profile.nif}  </span>}
                    {profile.rc && <span>RC: {profile.rc}</span>}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Facture</div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#10b981' }}>{facture.numero}</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  Date: {fmtDate(facture.date_facture)}
                </div>
                {facture.echeance && (
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Échéance: {fmtDate(facture.echeance)}
                  </div>
                )}
                <div style={{ marginTop: '8px' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '10px',
                    fontWeight: '700', textTransform: 'uppercase',
                    background: facture.statut === 'payee' ? '#d1fae5' : facture.statut === 'emise' ? '#dbeafe' : '#f3f4f6',
                    color: facture.statut === 'payee' ? '#065f46' : facture.statut === 'emise' ? '#1d4ed8' : '#6b7280'
                  }}>
                    {STATUT_CONFIG[facture.statut].label}
                  </span>
                </div>
              </div>
            </div>

            {/* Client */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '35px' }}>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', fontWeight: '700', marginBottom: '8px' }}>Fournisseur</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#111' }}>{profile.company_name}</div>
                {profile.address && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>{profile.address}</div>}
              </div>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', fontWeight: '700', marginBottom: '8px' }}>Facturé à</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#111' }}>{facture.client_nom}</div>
                {facture.client_phone && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>{facture.client_phone}</div>}
                {facture.client_adresse && <div style={{ fontSize: '12px', color: '#6b7280' }}>{facture.client_adresse}</div>}
              </div>
            </div>

            {/* Tableau produits */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
              <thead>
                <tr style={{ background: '#0a0f1e' }}>
                  {['Désignation', 'Couleur / Format', 'Qté (m²)', 'Prix/m² (F CFA)', 'Total (F CFA)'].map((h, i) => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: i >= 2 ? 'right' : 'left', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'white', fontWeight: '700' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#111' }}>{l.designation}</div>
                      {l.reference && <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>Réf: {l.reference}</div>}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', fontSize: '12px', color: '#6b7280' }}>
                      {[l.couleur, l.format].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontSize: '13px', color: '#374151', fontWeight: '600' }}>
                      {l.quantite_m2} m²
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontSize: '13px', color: '#374151' }}>
                      {fmt(l.prix_unitaire)}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontSize: '13px', fontWeight: '700', color: '#111' }}>
                      {fmt(l.total_ligne)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totaux */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
              <div style={{ width: '280px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#6b7280' }}>
                  <span>Sous-total HT</span><span>{fmt(facture.sous_total)} F</span>
                </div>
                {facture.remise_pct > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#d97706' }}>
                    <span>Remise ({facture.remise_pct}%)</span><span>- {fmt(facture.remise_montant)} F</span>
                  </div>
                )}
                {facture.tva_pct > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#6b7280' }}>
                    <span>TVA ({facture.tva_pct}%)</span><span>{fmt(facture.tva_montant)} F</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', fontSize: '18px', fontWeight: '900', borderTop: '2px solid #e5e7eb', marginTop: '6px' }}>
                  <span style={{ color: '#111' }}>TOTAL TTC</span>
                  <span style={{ color: '#10b981' }}>{fmt(facture.total_ttc)} F CFA</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {facture.notes && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px', marginBottom: '20px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', fontWeight: '700', marginBottom: '6px' }}>Notes & Conditions</div>
                <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.6' }}>{facture.notes}</div>
              </div>
            )}

            {/* Footer */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px', fontSize: '11px', color: '#9ca3af', textAlign: 'center', lineHeight: '1.6' }}>
              <strong style={{ color: '#111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{profile.company_name}</strong>
              {profile.address && ` — ${profile.address}`}
              {profile.phone && ` — Tél: ${profile.phone}`}
              <br />Merci de votre confiance.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}