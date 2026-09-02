import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import TicketModal from './components/TicketModal';
import Toast from './components/Toast';

import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import OperatorsView from './views/OperatorsView';
import OperatorDetailView from './views/OperatorDetailView';
import ManualPointsView from './views/ManualPointsView';
import MassPointsView from './views/MassPointsView';
import ExtratoView from './views/ExtratoView';
import TicketsView from './views/TicketsView';
import RankingView from './views/RankingView';
import HighlightsView from './views/HighlightsView';
import RouletteView from './views/RouletteView';
import PrizesView from './views/PrizesView';
import ChallengesView from './views/ChallengesView';
import ReportsView from './views/ReportsView';
import TVModeView from './views/TVModeView';
import RulesView from './views/RulesView';
import AuditView from './views/AuditView';
import SettingsView from './views/SettingsView';
import IptuAdminView from './views/IptuAdminView';
import IptuOperatorExamView from './views/IptuOperatorExamView';

import { apiFetch, getToken, removeToken } from './services/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [campaign, setCampaign] = useState(null);
  const [publicExamToken, setPublicExamToken] = useState(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/prova-iptu/')) {
      return window.location.pathname.replace('/prova-iptu/', '').trim();
    }
    return null;
  });

  // Notifications
  const [toasts, setToasts] = useState([]);
  const [ticketAlert, setTicketAlert] = useState(null);

  // Sub-tab for points (manual or mass)
  const [pointsSubTab, setPointsSubTab] = useState('manual');

  useEffect(() => {
    checkAuth();
    loadCampaign();

    const handleExpired = () => {
      setUser(null);
      showToast('Sessão expirada. Faça login novamente.', 'error');
    };

    window.addEventListener('auth_expired', handleExpired);
    return () => window.removeEventListener('auth_expired', handleExpired);
  }, []);

  const checkAuth = async () => {
    const token = getToken();
    if (!token) {
      setLoadingAuth(false);
      return;
    }
    try {
      const res = await apiFetch('/auth/me');
      setUser(res.user);
    } catch (err) {
      removeToken();
      setUser(null);
    } finally {
      setLoadingAuth(false);
    }
  };

  const loadCampaign = async () => {
    try {
      const res = await apiFetch('/campaign/status');
      setCampaign(res);
    } catch (err) {
      console.error('Failed to load campaign status:', err);
    }
  };

  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleLogout = () => {
    removeToken();
    setUser(null);
    showToast('Sessão encerrada com sucesso.', 'info');
  };

  if (publicExamToken) {
    return (
      <IptuOperatorExamView
        tokenCode={publicExamToken}
        onBackToApp={() => {
          window.history.pushState({}, '', '/');
          setPublicExamToken(null);
        }}
      />
    );
  }

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={(u) => { setUser(u); loadCampaign(); }} />;
  }

  // TV Mode is fullscreen standalone
  if (activeTab === 'tv') {
    return <TVModeView campaign={campaign} onExit={() => setActiveTab('dashboard')} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <Navbar
        user={user}
        campaign={campaign}
        onLogout={handleLogout}
        onNavigate={(tab) => setActiveTab(tab)}
        activeTab={activeTab}
      />

      <div className="flex-1 flex">
        {/* Sidebar */}
        <Sidebar activeTab={activeTab.split('-')[0]} onNavigate={(tab) => setActiveTab(tab)} />

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {/* Campaign Lock Warning Banner if locked */}
          {campaign?.isLocked && (
            <div className="mb-6 bg-rose-500/10 border border-rose-500/40 text-rose-200 p-4 rounded-2xl text-xs font-semibold flex items-center gap-3">
              <span className="text-xl">🔒</span>
              <div>
                <strong>CAMPANHA ENCERRADA E CONGELADA:</strong> Os pontos e bilhetes estão congelados para realização do sorteio físico. Novos lançamentos de pontos estão desabilitados.
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView onNavigate={(tab) => setActiveTab(tab)} campaign={campaign} />
          )}

          {activeTab === 'prova-iptu' && (
            <IptuAdminView showToast={showToast} />
          )}

          {activeTab === 'operadores' && (
            <OperatorsView onNavigate={(tab) => setActiveTab(tab)} showToast={showToast} />
          )}

          {activeTab.startsWith('operador-') && (
            <OperatorDetailView
              operatorId={activeTab.replace('operador-', '')}
              onBack={() => setActiveTab('operadores')}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'pontos' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  onClick={() => setPointsSubTab('manual')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                    pointsSubTab === 'manual' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  ➕ Lançamento Manual
                </button>
                <button
                  onClick={() => setPointsSubTab('massa')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                    pointsSubTab === 'massa' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  ⚡ Lançamento em Massa
                </button>
              </div>

              {pointsSubTab === 'manual' ? (
                <ManualPointsView showToast={showToast} onTicketAlert={(a) => setTicketAlert(a)} />
              ) : (
                <MassPointsView showToast={showToast} onTicketAlert={(a) => setTicketAlert(a)} />
              )}
            </div>
          )}

          {activeTab === 'extrato' && (
            <ExtratoView showToast={showToast} />
          )}

          {activeTab === 'bilhetes' && (
            <TicketsView showToast={showToast} />
          )}

          {activeTab === 'ranking' && (
            <RankingView onNavigate={(tab) => setActiveTab(tab)} showToast={showToast} />
          )}

          {activeTab === 'destaques' && (
            <HighlightsView showToast={showToast} onTicketAlert={(a) => setTicketAlert(a)} />
          )}

          {activeTab === 'roleta' && (
            <RouletteView showToast={showToast} onTicketAlert={(a) => setTicketAlert(a)} />
          )}

          {activeTab === 'premios' && (
            <PrizesView showToast={showToast} />
          )}

          {activeTab === 'desafios' && (
            <ChallengesView showToast={showToast} onTicketAlert={(a) => setTicketAlert(a)} />
          )}

          {activeTab === 'relatorios' && (
            <ReportsView showToast={showToast} />
          )}

          {activeTab === 'regras' && (
            <RulesView showToast={showToast} />
          )}

          {activeTab === 'auditoria' && (
            <AuditView showToast={showToast} />
          )}

          {activeTab === 'configuracoes' && (
            <SettingsView campaign={campaign} onCampaignUpdate={loadCampaign} showToast={showToast} />
          )}
        </main>
      </div>

      {/* Global Ticket Unlock Modal */}
      <TicketModal alertData={ticketAlert} onClose={() => setTicketAlert(null)} />

      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  );
}
