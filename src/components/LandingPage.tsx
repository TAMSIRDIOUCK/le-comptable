// src/components/LandingPage.tsx
import { Building2, FileText, Package, TrendingUp, Shield, ChevronRight, Calculator } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const features = [
    { icon: FileText,    title: 'Factures professionnelles', desc: 'Générez des factures détaillées avec en-tête entreprise, TVA, remises et numérotation automatique.' },
    { icon: Package,     title: 'Gestion du stock',          desc: 'Suivi en temps réel du stock en m². Alertes de rupture, historique des sorties par vente.' },
    { icon: TrendingUp,  title: 'Tableau de bord',           desc: 'Chiffre d\'affaires, factures en attente, statistiques par période. Vue comptable claire.' },
    { icon: Building2,   title: 'Multi-produits',            desc: 'Carrelage, faïence, mosaïque, accessoires. Gestion par couleur, format et référence.' },
    { icon: Shield,      title: 'Données sécurisées',        desc: 'Chaque entreprise dispose de son espace isolé. Vos données sont privées et chiffrées.' },
    { icon: Calculator,  title: 'Comptabilité simple',       desc: 'Pas de formation requise. Interface épurée conçue pour les commerçants du bâtiment.' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white font-['DM_Sans',_system-ui,_sans-serif]" style={{
      backgroundImage: `radial-gradient(ellipse at 20% 50%, rgba(16,185,129,0.06) 0%, transparent 60%), 
                        radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.06) 0%, transparent 60%)`
    }}>
      {/* Grid pattern overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />

      {/* NAV */}
      <nav className="relative z-10 border-b border-white/5 bg-[#0a0f1e]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Calculator className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-[0.15em] text-sm uppercase text-white/90">Le Comptable</span>
          </div>
          <button onClick={onGetStarted}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]">
            Accéder <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative z-10 pt-24 pb-20 px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-xs font-medium px-4 py-1.5 rounded-full mb-10 tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Logiciel de comptabilité pour matériaux de construction
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] mb-6" style={{
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}>
          <span className="block text-white/20 text-2xl sm:text-3xl font-light tracking-[0.3em] uppercase mb-4">
            Bienvenue sur
          </span>
          <span className="block text-white">Le</span>
          <span className="block" style={{
            background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 50%, #10b981 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundSize: '200% auto',
            animation: 'gradient 4s linear infinite',
          }}>Comptable</span>
        </h1>

        <p className="text-white/50 text-lg max-w-xl mx-auto mb-12 leading-relaxed font-light">
          Gérez votre stock de carrelage, émettez des factures professionnelles
          et suivez votre chiffre d'affaires — depuis un seul endroit.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={onGetStarted}
            className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4 rounded-xl text-base transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:-translate-y-0.5">
            Créer mon espace gratuit
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={onGetStarted}
            className="inline-flex items-center justify-center gap-2 border border-white/10 hover:border-white/30 text-white/70 hover:text-white font-medium px-8 py-4 rounded-xl text-base transition-all">
            Se connecter
          </button>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-3 gap-6 max-w-md mx-auto">
          {[
            { val: '100%', lbl: 'Gratuit' },
            { val: 'Pro',  lbl: 'Factures PDF' },
            { val: 'Live', lbl: 'Stock temps réel' },
          ].map(s => (
            <div key={s.lbl} className="text-center">
              <div className="text-2xl font-black text-emerald-400">{s.val}</div>
              <div className="text-xs text-white/40 mt-1">{s.lbl}</div>
            </div>
          ))}
        </div>
      </section>

      {/* MOCKUP FACTURE */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-[0_40px_80px_rgba(0,0,0,0.5)] overflow-hidden border border-white/10">
            {/* En-tête facture */}
            <div className="bg-[#0a0f1e] px-8 py-5 flex justify-between items-start">
              <div>
                <div className="text-emerald-400 font-black text-xl tracking-wide uppercase">MAISON DU CARRELAGE</div>
                <div className="text-white/40 text-xs mt-1">Zone Industrielle, Dakar · +221 77 000 00 00</div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold text-lg">FAC-2026-0012</div>
                <div className="text-white/40 text-xs">20 avril 2026</div>
              </div>
            </div>
            {/* Corps facture */}
            <div className="p-8">
              <div className="flex justify-between mb-6 text-sm">
                <div>
                  <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Facturé à</div>
                  <div className="font-semibold text-gray-800">M. Abdou Diallo</div>
                  <div className="text-gray-500">+221 77 123 45 67</div>
                  <div className="text-gray-500">Cité Keur Gorgui, Dakar</div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">● ÉMISE</div>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-400 text-xs font-medium uppercase tracking-wide">Désignation</th>
                    <th className="text-right py-2 text-gray-400 text-xs font-medium uppercase tracking-wide">Qté (m²)</th>
                    <th className="text-right py-2 text-gray-400 text-xs font-medium uppercase tracking-wide">Prix/m²</th>
                    <th className="text-right py-2 text-gray-400 text-xs font-medium uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { d: 'Carrelage Sol 60x60 — Beige Sable', q: '45.00', p: '12 500', t: '562 500' },
                    { d: 'Faïence Mur 30x60 — Blanc Mat',     q: '28.00', p: '8 500',  t: '238 000' },
                    { d: 'Mosaïque Déco 5x5 — Bleu Nuit',     q: '6.50',  p: '18 000', t: '117 000' },
                  ].map((r, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-3 text-gray-700">{r.d}</td>
                      <td className="py-3 text-right text-gray-600">{r.q}</td>
                      <td className="py-3 text-right text-gray-600">{r.p}</td>
                      <td className="py-3 text-right font-semibold text-gray-800">{r.t}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex justify-end">
                <div className="w-56 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-500"><span>Sous-total</span><span>917 500 F</span></div>
                  <div className="flex justify-between text-gray-500"><span>TVA (18%)</span><span>165 150 F</span></div>
                  <div className="flex justify-between font-black text-gray-900 text-base border-t pt-2 mt-2"><span>TOTAL TTC</span><span>1 082 650 F</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-emerald-400 text-xs font-bold tracking-[0.2em] uppercase mb-3">Fonctionnalités</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Tout ce qu'il vous faut.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-emerald-500/20 rounded-2xl p-6 transition-all hover:-translate-y-1">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-bold text-base mb-2 text-white/90">{title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-3xl p-12">
            <h2 className="text-3xl font-black tracking-tight mb-4">Prêt à professionnaliser votre gestion ?</h2>
            <p className="text-white/50 text-sm mb-8">Inscription gratuite. Aucune carte bancaire requise.</p>
            <button onClick={onGetStarted}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-10 py-4 rounded-xl text-base transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]">
              Commencer maintenant <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center">
            <Calculator className="w-3 h-3 text-white" />
          </div>
          <span className="font-bold tracking-widest text-xs uppercase text-white/60">Le Comptable</span>
        </div>
        <p className="text-white/20 text-xs">Gestion comptable pour matériaux de construction · Dakar, Sénégal</p>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes gradient { 0% { background-position: 0% center } 100% { background-position: 200% center } }
      `}</style>
    </div>
  );
}