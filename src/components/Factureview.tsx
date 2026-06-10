// src/components/Factureview.tsx
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Printer, ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle, Download, Mail, MessageCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { updateStockForPaidInvoice, restoreStockForCancelledInvoice } from './Nouvelleventepage';
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
  emise: { label: 'Émise', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: AlertCircle },
  payee: { label: 'Payée', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle },
  annulee: { label: 'Annulée', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: XCircle },
};

function getPhoneNumbers(profile: Profile): string[] {
  if ((profile as any).phones) {
    try {
      const parsed = JSON.parse((profile as any).phones);
      if (Array.isArray(parsed) && parsed.length) return parsed.filter(Boolean);
    } catch { }
  }
  return [profile.phone, (profile as any).phone2, (profile as any).phone3].filter(Boolean) as string[];
}

const PRINT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .facture { max-width: 800px; margin: 0 auto; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 3px solid #10b981; flex-wrap: wrap; gap: 16px; }
  .company-name { font-size: 26px; font-weight: 900; text-transform: uppercase; color: #0a0f1e; letter-spacing: 0.05em; }
  .logo { max-height: 60px; max-width: 180px; object-fit: contain; margin-bottom: 8px; display: block; }
  .tagline { font-size: 12px; font-style: italic; color: #10b981; margin-top: 4px; }
  .company-details { font-size: 11px; color: #6b7280; margin-top: 6px; line-height: 1.6; }
  .nif-rc { font-size: 10px; color: #9ca3af; margin-top: 4px; }
  .facture-info { text-align: right; }
  .facture-label { font-size: 13px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
  .facture-numero { font-size: 24px; font-weight: 900; color: #10b981; }
  .facture-date { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .statut-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 8px; }
  .s-brouillon { background: #f3f4f6; color: #6b7280; }
  .s-emise     { background: #dbeafe; color: #1d4ed8; }
  .s-payee     { background: #d1fae5; color: #065f46; }
  .s-annulee   { background: #fee2e2; color: #991b1b; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 35px; }
  .partie-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; font-weight: 700; margin-bottom: 8px; }
  .partie-nom { font-size: 15px; font-weight: 700; color: #111; }
  .partie-detail { font-size: 12px; color: #6b7280; margin-top: 3px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
  thead { background: #0a0f1e; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  th { padding: 12px 14px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: white; font-weight: 700; }
  th.r, td.r { text-align: right; }
  td { padding: 12px 14px; font-size: 12px; border-bottom: 1px solid #f3f4f6; }
  tr:nth-child(even) td { background: #f9fafb; }
  .td-name { font-weight: 600; color: #111; font-size: 13px; }
  .td-ref { font-size: 10px; color: #9ca3af; margin-top: 2px; }
  .totaux { display: flex; justify-content: flex-end; margin-bottom: 30px; }
  .totaux-inner { width: 280px; }
  .totaux-ligne { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #6b7280; }
  .totaux-remise { color: #d97706; }
  .totaux-total { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; font-size: 17px; font-weight: 900; border-top: 2px solid #e5e7eb; margin-top: 6px; background: #0a0f1e; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .totaux-total-label { color: #fff; text-transform: uppercase; }
  .totaux-total-value { color: #10b981; }
  .notes { border-top: 1px solid #e5e7eb; padding-top: 20px; margin-bottom: 20px; }
  .notes-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; font-weight: 700; margin-bottom: 6px; }
  .notes-text { font-size: 12px; color: #6b7280; line-height: 1.6; white-space: pre-wrap; }
  .footer { border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 11px; color: #9ca3af; text-align: center; line-height: 1.6; }
  .footer strong { color: #111; text-transform: uppercase; letter-spacing: 0.05em; }
  @media print { .facture { padding: 30px; } }
`;

export default function FactureView({ factureId, profile, onBack }: FactureViewProps) {
  const [facture, setFacture] = useState<Facture | null>(null);
  const [lignes, setLignes] = useState<LigneFacture[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: f } = await supabase
        .from('factures_comptable').select('*').eq('id', factureId).single();
      const { data: l } = await supabase
        .from('facture_lignes_comptable').select('*')
        .eq('facture_id', factureId).order('ordre');
      setFacture(f);
      setLignes(l || []);
      setLoading(false);
    };
    load();
  }, [factureId]);

  // Fonction pour mettre à jour le statut avec gestion du stock
  const updateStatut = async (newStatut: Facture['statut']) => {
    if (!facture || updating) return;

    setUpdating(true);
    setError(null);

    try {
      const oldStatut = facture.statut;
      console.log(`Changement de statut: ${oldStatut} → ${newStatut}`);

      // Cas 1: Passage à "payée" (quel que soit l'ancien statut)
      if (newStatut === 'payee' && oldStatut !== 'payee') {
        console.log('Facture payée → diminution du stock');
        await updateStockForPaidInvoice(factureId, profile.id);
      }

      // Cas 2: Passage à "annulée" depuis "payée" → RESTAURER le stock
      if (newStatut === 'annulee' && oldStatut === 'payee') {
        console.log('Facture annulée (était payée) → restauration du stock');
        await restoreStockForCancelledInvoice(factureId, profile.id);
      }

      // Cas 3: Passage de "annulée" à autre chose (réactivation)
      if (oldStatut === 'annulee' && newStatut !== 'annulee') {
        console.log('Réactivation de facture annulée → diminution du stock');
        await updateStockForPaidInvoice(factureId, profile.id);
      }

      // Mise à jour du statut dans la base
      const updateData: any = {
        statut: newStatut,
        updated_at: new Date().toISOString()
      };

      if (newStatut === 'payee') {
        updateData.date_paiement = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('factures_comptable')
        .update(updateData)
        .eq('id', factureId);

      if (updateError) throw updateError;

      // Mettre à jour l'état local
      setFacture(f => f ? { ...f, statut: newStatut } : f);
      console.log(`Statut mis à jour avec succès: ${newStatut}`);

    } catch (err: any) {
      console.error('Erreur lors du changement de statut:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current || !facture) return;
    const win = window.open('', '', 'width=900,height=1200');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Facture ${facture.numero}</title>
      <style>${PRINT_CSS}</style></head>
      <body>${printRef.current.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const handleDownloadPDF = () => {
    if (!printRef.current || !facture) return;
    html2pdf().set({
      margin: 0,
      filename: `Facture_${facture.numero}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    }).from(printRef.current).save();
  };

  const handleShare = (type: 'email' | 'whatsapp') => {
    if (!facture) return;
    const subject = `Facture ${facture.numero} — ${profile.company_name}`;
    const message = `Bonjour,\n\nVeuillez trouver ci-joint la facture n°${facture.numero}.\nMontant TTC : ${fmt(facture.total_ttc)} F CFA\n\nCordialement,\n${profile.company_name}`;
    if (type === 'email') {
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    } else {
      const phone = (facture.client_phone || '').replace(/\D/g, '');
      if (phone) {
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
      } else {
        setError('Numéro de téléphone du client non disponible');
      }
    }
  };

  if (loading) return <div className="text-center py-20 text-white/30 animate-pulse">Chargement de la facture…</div>;
  if (!facture) return <div className="text-center py-20 text-red-400">Facture introuvable</div>;

  const cfg = STATUT_CONFIG[facture.statut];
  const StatutIcon = cfg.icon;
  const phones = getPhoneNumbers(profile);
  const tagline = (profile as any).tagline || '';
  const website = (profile as any).website || '';
  const logoUrl = (profile as any).logo_url || '';

  const canMarkAsPaid = facture.statut !== 'payee' && facture.statut !== 'annulee' && !updating;
  const canMarkAsCancelled = facture.statut !== 'annulee' && !updating;
  const canMarkAsIssued = facture.statut === 'brouillon' && !updating;

  const s = {
    page: { maxWidth: '800px', margin: '0 auto', padding: '40px', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: '#1a1a1a' } as React.CSSProperties,
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', paddingBottom: '30px', borderBottom: '3px solid #10b981', flexWrap: 'wrap' as const, gap: '16px' },
    coNom: { fontSize: '26px', fontWeight: 900, textTransform: 'uppercase' as const, color: '#0a0f1e', letterSpacing: '0.05em' },
    coMeta: { fontSize: '11px', color: '#6b7280', marginTop: '8px', lineHeight: '1.6' },
    nifRc: { fontSize: '10px', color: '#9ca3af', marginTop: '4px' },
    facNum: { fontSize: '24px', fontWeight: 900, color: '#10b981' },
    facLabel: { fontSize: '13px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '6px' },
    facDate: { fontSize: '12px', color: '#6b7280', marginTop: '4px' },
    partLabel: { fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#9ca3af', fontWeight: 700, marginBottom: '8px' },
    partNom: { fontSize: '15px', fontWeight: 700, color: '#111' },
    partDetail: { fontSize: '12px', color: '#6b7280', marginTop: '3px', lineHeight: '1.5' },
    td: { padding: '12px 14px', borderBottom: '1px solid #f3f4f6', fontSize: '12px', verticalAlign: 'middle' as const },
    tdR: { padding: '12px 14px', borderBottom: '1px solid #f3f4f6', fontSize: '13px', textAlign: 'right' as const, verticalAlign: 'middle' as const },
  };

  const statutStyle = {
    display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '10px',
    fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginTop: '8px',
    background: facture.statut === 'payee' ? '#d1fae5' : facture.statut === 'emise' ? '#dbeafe' : facture.statut === 'annulee' ? '#fee2e2' : '#f3f4f6',
    color: facture.statut === 'payee' ? '#065f46' : facture.statut === 'emise' ? '#1d4ed8' : facture.statut === 'annulee' ? '#991b1b' : '#6b7280',
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-white/40 hover:text-white transition text-sm">
          <ArrowLeft className="w-4 h-4" /> Retour aux factures
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          {canMarkAsPaid && (
            <button onClick={() => updateStatut('payee')}
              disabled={updating}
              className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold px-3 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
              <CheckCircle className="w-3.5 h-3.5" /> {updating ? 'Mise à jour...' : 'Marquer payée'}
            </button>
          )}
          {canMarkAsIssued && (
            <button onClick={() => updateStatut('emise')}
              disabled={updating}
              className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 text-xs font-bold px-3 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
              Émettre
            </button>
          )}
          {canMarkAsCancelled && (
            <button onClick={() => updateStatut('annulee')}
              disabled={updating}
              className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-bold px-3 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
              <XCircle className="w-3.5 h-3.5" /> Annuler
            </button>
          )}
          <button onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-emerald-500 text-black font-bold px-5 py-2 rounded-xl transition hover:bg-emerald-400">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 bg-white text-black font-bold px-5 py-2 rounded-xl transition hover:bg-zinc-100">
            <Printer className="w-4 h-4" /> Imprimer
          </button>
          <button onClick={() => handleShare('email')}
            className="flex items-center gap-2 bg-white/10 border border-white/20 text-white font-bold px-4 py-2 rounded-xl transition hover:bg-white/20"
            title="Envoyer par email">
            <Mail className="w-4 h-4" />
          </button>
          <button onClick={() => handleShare('whatsapp')}
            className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 font-bold px-4 py-2 rounded-xl transition hover:bg-green-500/20"
            title="Envoyer par WhatsApp">
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${cfg.color}`}>
        <StatutIcon className="w-3.5 h-3.5" /> {cfg.label}
      </div>

      <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
        <style>{PRINT_CSS}</style>
        <div ref={printRef}>
          <div style={s.page}>

            <div style={s.header}>
              <div style={{ maxWidth: '60%' }}>
                {logoUrl && <img src={logoUrl} alt="Logo" style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain', marginBottom: '8px', display: 'block' }} />}
                <div style={s.coNom}>{profile.company_name}</div>
                {tagline && <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#10b981', marginTop: '4px' }}>{tagline}</div>}
                <div style={s.coMeta}>
                  {profile.address && <div>{profile.address}</div>}
                  {phones.length > 0 && <div>Tél : {phones.join(' / ')}</div>}
                  {profile.email && <div>{profile.email}</div>}
                  {website && <div>{website}</div>}
                </div>
                {(profile.nif || profile.rc) && (
                  <div style={s.nifRc}>
                    {profile.nif && <span>NIF : {profile.nif}&nbsp;&nbsp;</span>}
                    {profile.rc && <span>RC : {profile.rc}</span>}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={s.facLabel}>Facture</div>
                <div style={s.facNum}>{facture.numero}</div>
                <div style={s.facDate}>Date : {fmtDate(facture.date_facture)}</div>
                {facture.echeance && <div style={s.facDate}>Échéance : {fmtDate(facture.echeance)}</div>}
                <div><span style={statutStyle}>{STATUT_CONFIG[facture.statut].label}</span></div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '35px' }}>
              <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={s.partLabel}>Fournisseur</div>
                <div style={s.partNom}>{profile.company_name}</div>
                {profile.address && <div style={s.partDetail}>{profile.address}</div>}
                {phones.length > 0 && <div style={s.partDetail}>Tél : {phones.join(' / ')}</div>}
                {profile.email && <div style={s.partDetail}>{profile.email}</div>}
              </div>
              <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={s.partLabel}>Facturé à</div>
                <div style={s.partNom}>{facture.client_nom}</div>
                {facture.client_phone && <div style={s.partDetail}>{facture.client_phone}</div>}
                {facture.client_adresse && <div style={s.partDetail}>{facture.client_adresse}</div>}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
              <thead>
                <tr style={{ background: '#0a0f1e' }}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'white', fontWeight: 700, width: '30%' }}>Désignation</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'white', fontWeight: 700, width: '20%' }}>Couleur / Format</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'white', fontWeight: 700, width: '12%' }}>Qté (m²)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'white', fontWeight: 700, width: '18%' }}>Prix/m²</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'white', fontWeight: 700, width: '20%' }}>Total</th>
                 </tr>
              </thead>
              <tbody>
                {lignes.map((l, idx) => (
                  <tr key={l.id ?? idx} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={s.td}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#111' }}>{l.designation}</div>
                      {l.reference && <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>Réf : {l.reference}</div>}
                     </td>
                    <td style={s.td}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {[l.couleur, l.format].filter(Boolean).join(' · ') || '—'}
                      </span>
                     </td>
                    <td style={{ ...s.tdR, fontWeight: 600 }}>{l.quantite_m2} m²</td>
                    <td style={s.tdR}>{fmt(l.prix_unitaire)}</td>
                    <td style={{ ...s.tdR, fontWeight: 700, color: '#111' }}>{fmt(l.total_ligne)}</td>
                   </tr>
                ))}
              </tbody>
             </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
              <div style={{ width: '280px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#6b7280' }}>
                  <span>Sous-total HT</span><span>{fmt(facture.sous_total)} F</span>
                </div>
                {facture.remise_montant > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#d97706' }}>
                    <span>Remise</span>
                    <span>− {fmt(facture.remise_montant)} F</span>
                  </div>
                )}
                {facture.tva_montant > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#6b7280' }}>
                    <span>TVA{facture.tva_pct > 0 ? ` (${facture.tva_pct}%)` : ''}</span>
                    <span>{fmt(facture.tva_montant)} F</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', fontSize: '17px', fontWeight: 900, borderTop: '2px solid #e5e7eb', marginTop: '6px', background: '#0a0f1e' }}>
                  <span style={{ color: '#fff', textTransform: 'uppercase' }}>Total TTC</span>
                  <span style={{ color: '#10b981' }}>{fmt(facture.total_ttc)} F CFA</span>
                </div>
              </div>
            </div>

            {facture.notes && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px', marginBottom: '20px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', fontWeight: 700, marginBottom: '6px' }}>Notes &amp; Conditions</div>
                <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{facture.notes}</div>
              </div>
            )}

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px', fontSize: '11px', color: '#9ca3af', textAlign: 'center', lineHeight: '1.6' }}>
              <strong style={{ color: '#111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{profile.company_name}</strong>
              <br />Merci de votre confiance.
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}