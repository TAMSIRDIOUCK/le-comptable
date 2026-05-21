// src/App.tsx (extrait modifié avec la gestion du client pré-sélectionné)
import { useState } from 'react';
import { ClientApp, type AuthUser } from './components/Clientapp';
import DashboardPage from './components/Dashboardpage';
import ProduitsPage from "./components/produits/ProduitsPage";
import NouvelleVentePage from './components/Nouvelleventepage';
import FacturesPage from './components/Facturespage';
import ClientsPage from './components/Clientspage';
import ParametresPage from './components/Parametrespage';
import { Calculator, LayoutDashboard, Package, FileText, Plus, Users, Settings, Menu, X, LogOut } from 'lucide-react';
import type { Profile, Client } from './types';

type Tab = 'dashboard' | 'produits' | 'nouvelle-vente' | 'factures' | 'clients' | 'parametres';

function AppShell({ authUser, onLogout }: { authUser: AuthUser; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [profile, setProfile] = useState<Profile>(authUser.profile);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFactureId, setOpenFactureId] = useState<string | null>(null);
  const [preselectedClient, setPreselectedClient] = useState<Client | null>(null); // ← Nouveau state

  const navItems: { key: Tab; label: string; icon: any; primary?: boolean }[] = [
    { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { key: 'nouvelle-vente', label: 'Nouvelle vente', icon: Plus, primary: true },
    { key: 'factures', label: 'Factures', icon: FileText },
    { key: 'produits', label: 'Produits', icon: Package },
    { key: 'clients', label: 'Clients', icon: Users },
    { key: 'parametres', label: 'Paramètres', icon: Settings },
  ];

  const navigate = (t: Tab, factureId?: string, client?: Client | null) => {
    setTab(t);
    if (factureId) setOpenFactureId(factureId);
    else setOpenFactureId(null);
    
    // Gérer le client pré-sélectionné
    if (client) {
      setPreselectedClient(client);
    } else if (t !== 'nouvelle-vente') {
      // Réinitialiser quand on quitte la page nouvelle vente
      setPreselectedClient(null);
    }
    
    setMenuOpen(false);
  };

  const handleFactureCreee = (factureId: string) => {
    navigate('factures', factureId);
    setPreselectedClient(null); // Réinitialiser après création
  };

  const handleCreerFactureFromClient = (client: Client) => {
    navigate('nouvelle-vente', undefined, client);
  };

  return (
    <div className="min-h-screen bg-[#060d1a] font-['DM_Sans',_system-ui,_sans-serif]">
      {/* Sidebar desktop - inchangée */}
      <aside className="fixed left-0 top-0 bottom-0 w-60 bg-[#0a0f1e] border-r border-white/5 flex flex-col z-30 hidden lg:flex">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-black text-sm tracking-wider uppercase">Le Comptable</div>
              <div className="text-white/30 text-xs truncate max-w-[140px]">{profile.company_name}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === item.key
                  ? item.primary
                    ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'bg-white/10 text-white'
                  : item.primary
                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/5">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-white/30 hover:text-white hover:bg-white/5 transition"
          >
            <LogOut className="w-4 h-4" /> Se déconnecter
          </button>
        </div>
      </aside>

      {/* Header mobile - inchangé */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#0a0f1e]/95 backdrop-blur border-b border-white/5 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Calculator className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-black text-sm uppercase tracking-wider">Le Comptable</span>
        </div>
        <button onClick={() => setMenuOpen(m => !m)} className="text-white/60 hover:text-white transition p-1">
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Menu mobile overlay - inchangé */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)}>
          <div className="absolute left-0 top-14 bottom-0 w-64 bg-[#0a0f1e] border-r border-white/5 p-4 space-y-1 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-2 mb-2">
              <div className="text-white/40 text-xs uppercase tracking-wide">Entreprise</div>
              <div className="text-white font-bold text-sm truncate">{profile.company_name}</div>
            </div>
            {navItems.map(item => (
              <button key={item.key} onClick={() => navigate(item.key)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${tab === item.key ? (item.primary ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white') : (item.primary ? 'bg-emerald-500/10 text-emerald-400' : 'text-white/40 hover:text-white hover:bg-white/5')}`}>
                <item.icon className="w-4 h-4" /> {item.label}
              </button>
            ))}
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/30 hover:text-white hover:bg-white/5 transition mt-4">
              <LogOut className="w-4 h-4" /> Se déconnecter
            </button>
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <main className="lg:pl-60">
        <div className="min-h-screen pt-14 lg:pt-0 p-4 sm:p-6 lg:p-8">
          {tab === 'dashboard' && <DashboardPage userId={authUser.id} profile={profile} onGoTo={t => navigate(t as Tab)} />}
          {tab === 'produits' && <ProduitsPage userId={authUser.id} />}
          {tab === 'nouvelle-vente' && (
            <NouvelleVentePage 
              userId={authUser.id} 
              onFactureCreee={handleFactureCreee} 
              preselectedClient={preselectedClient}  // ← Passer le client pré-sélectionné
            />
          )}
          {tab === 'factures' && <FacturesPage userId={authUser.id} profile={profile} onNouvelleFacture={() => navigate('nouvelle-vente')} openFactureId={openFactureId} />}
          {tab === 'clients' && (
            <ClientsPage 
              userId={authUser.id} 
              onCreerFacture={handleCreerFactureFromClient}  // ← Passer la callback
            />
          )}
          {tab === 'parametres' && <ParametresPage profile={profile} onProfileUpdated={setProfile} onLogout={onLogout} />}
        </div>
      </main>

      {/* Bottom nav mobile - inchangé */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0a0f1e]/95 backdrop-blur border-t border-white/5 grid grid-cols-5 h-16">
        {[
          { key: 'dashboard' as Tab, icon: LayoutDashboard, label: 'Accueil' },
          { key: 'produits' as Tab, icon: Package, label: 'Stock' },
          { key: 'nouvelle-vente' as Tab, icon: Plus, label: 'Vente', primary: true },
          { key: 'factures' as Tab, icon: FileText, label: 'Factures' },
          { key: 'clients' as Tab, icon: Users, label: 'Clients' },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => navigate(item.key)}
            className={`flex flex-col items-center justify-center gap-1 transition ${tab === item.key ? (item.primary ? 'text-emerald-400' : 'text-white') : 'text-white/30 hover:text-white'}`}
          >
            {item.primary ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)] -mt-3">
                <item.icon className="w-5 h-5 text-white" />
              </div>
            ) : (
              <item.icon className="w-5 h-5" />
            )}
            {!item.primary && <span className="text-[9px] font-medium">{item.label}</span>}
          </button>
        ))}
      </nav>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800;900&display=swap');
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <ClientApp>
      {(authUser, onLogout) => <AppShell authUser={authUser} onLogout={onLogout} />}
    </ClientApp>
  );
}