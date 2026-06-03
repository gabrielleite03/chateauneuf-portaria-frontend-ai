import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, CheckCircle2, History, Key, LayoutDashboard, Settings, Sparkles, WifiOff, Wrench } from 'lucide-react';

import { checkoutVisit, createVisit, fetchSyncStatus, fetchVisits, runSync } from './api';
import { SyncStatus, Visit } from './types';
import ActiveVisits from './components/ActiveVisits';
import Header from './components/Header';
import HistoryVisits from './components/HistoryVisits';
import KeyControlModule from './components/KeyControlModule';
import RegistrationForm from './components/RegistrationForm';
import ResidentsModule from './components/ResidentsModule';
import DiaristasModule from './components/DiaristasModule';
import ScheduledServicesModule from './components/ScheduledServicesModule';
import SyncSettings from './components/SyncSettings';

type Tab = 'control' | 'residents' | 'diaristas' | 'scheduled' | 'keys' | 'history' | 'status';
type ThemeMode = 'light' | 'dark';

function getTimeTheme(date = new Date()): ThemeMode {
  const hour = date.getHours();
  return hour >= 7 && hour < 19 ? 'light' : 'dark';
}

export default function App() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isInternetOnline: true,
    isBackendConnected: false,
    lastSyncTime: null,
    pendingSyncCount: 0,
    syncHistory: [],
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('control');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getTimeTheme());

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setNotification({ message, type });
    window.setTimeout(() => setNotification(null), 5000);
  };

  const fetchData = async () => {
    try {
      const [statusData, visitsData] = await Promise.all([
        fetchSyncStatus(),
        fetchVisits(),
      ]);

      setSyncStatus(statusData);
      setVisits(visitsData);
    } catch (err) {
      console.error('Backend Go indisponivel.', err);
      setSyncStatus(prev => ({
        ...prev,
        isBackendConnected: false,
      }));
      showToast('Sem resposta do backend Go local. Verifique se ele esta rodando em http://localhost:8080.', 'error');
    }
  };

  useEffect(() => {
    fetchData();
    const poll = window.setInterval(fetchData, 6000);
    return () => window.clearInterval(poll);
  }, []);

  useEffect(() => {
    const updateTheme = () => setThemeMode(getTimeTheme());
    updateTheme();

    const timer = window.setInterval(updateTheme, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  const handleRegisterEntrance = async (newData: Omit<Visit, 'id' | 'entryTime' | 'syncStatus'>) => {
    try {
      const createdVisit = await createVisit(newData);
      setVisits(prev => [createdVisit, ...prev]);
      await fetchData();

      showToast(
        syncStatus.isInternetOnline
          ? `Entrada de ${createdVisit.name} registrada no backend Go.`
          : `Entrada de ${createdVisit.name} gravada localmente e pendente de sincronizacao.`,
        syncStatus.isInternetOnline ? 'success' : 'warning',
      );

      return createdVisit;
    } catch (err) {
      console.error(err);
      showToast('Nao foi possivel salvar a entrada no backend Go.', 'error');
      return null;
    }
  };

  const handleRegisterExit = async (id: string) => {
    try {
      const updatedVisit = await checkoutVisit(id);
      setVisits(prev => prev.map(v => (v.id === id ? updatedVisit : v)));
      await fetchData();

      showToast(
        syncStatus.isInternetOnline
          ? `Saida de ${updatedVisit.name} registrada no backend Go.`
          : `Saida de ${updatedVisit.name} gravada localmente e pendente de sincronizacao.`,
        syncStatus.isInternetOnline ? 'success' : 'warning',
      );
    } catch (err) {
      console.error(err);
      showToast('Nao foi possivel registrar a saida no backend Go.', 'error');
    }
  };

  const handleManualSync = async () => {
    if (!syncStatus.isInternetOnline) return;

    setIsSyncing(true);
    try {
      const status = await runSync();
      setSyncStatus(status);
      await fetchData();

      showToast(
        status.pendingSyncCount > 0
          ? `Sincronizacao executada. Ainda ha ${status.pendingSyncCount} registro(s) pendente(s).`
          : 'Sincronizacao concluida. Nenhum registro pendente.',
        status.pendingSyncCount > 0 ? 'warning' : 'success',
      );
    } catch (err) {
      console.error(err);
      showToast('O backend Go retornou erro ao executar a sincronizacao.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleInternetSimulation = async () => {
    showToast('A simulacao foi removida: o status de internet agora vem exclusivamente do backend Go.', 'warning');
    await fetchData();
  };

  return (
    <div className="min-h-screen bg-[#030508] flex flex-col font-sans selection:bg-emerald-500 selection:text-[#030508] text-slate-100 animate-fadeIn">
      <Header
        status={syncStatus}
        onSync={handleManualSync}
        onToggleInternet={handleToggleInternetSimulation}
        isSyncing={isSyncing}
      />

      <nav className="bg-[#07090f] border-b border-slate-900/80">
        <div className="max-w-7xl mx-auto px-6 overflow-x-auto">
          <div className="flex space-x-8 min-w-max">
            <TabButton active={activeTab === 'control'} onClick={() => setActiveTab('control')} icon={<LayoutDashboard size={14} />}>
              Painel de Controle
            </TabButton>
            <TabButton active={activeTab === 'residents'} onClick={() => setActiveTab('residents')} icon={<Building2 size={14} />}>
              Moradores
            </TabButton>
            <TabButton active={activeTab === 'diaristas'} onClick={() => setActiveTab('diaristas')} icon={<Sparkles size={14} />}>
              Diaristas
            </TabButton>
            <TabButton active={activeTab === 'scheduled'} onClick={() => setActiveTab('scheduled')} icon={<Wrench size={14} />}>
              Servicos Agendados
            </TabButton>
            <TabButton active={activeTab === 'keys'} onClick={() => setActiveTab('keys')} icon={<Key size={14} />}>
              Controle de Chaves
            </TabButton>
            <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={14} />}>
              Historico Geral
            </TabButton>
            <TabButton active={activeTab === 'status'} onClick={() => setActiveTab('status')} icon={<Settings size={14} />}>
              Sincronizacao & Rede
              {syncStatus.pendingSyncCount > 0 && (
                <span className="bg-amber-950 border border-amber-500/30 text-amber-400 font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-sm animate-pulse ml-1.5 font-bold">
                  {syncStatus.pendingSyncCount}
                </span>
              )}
            </TabButton>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {!syncStatus.isBackendConnected && (
          <div className="mb-6 bg-red-950/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm flex items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span>
                <strong>SISTEMA OFFLINE:</strong> Sem resposta do backend Go local. Rode o backend em
                {' '}D:\Projects\Chateauneuf\chateauneuf-portaria-backend.
              </span>
            </div>
            <button
              onClick={fetchData}
              className="text-[10px] uppercase tracking-wider bg-red-950 hover:bg-red-900 text-red-400 font-bold border border-red-500/30 px-3 py-1.5 rounded-sm transition active:scale-95 cursor-pointer font-mono"
            >
              Reconectar
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'control' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-tab-content">
                <div className="lg:col-span-5">
                  <RegistrationForm onRegister={handleRegisterEntrance} isInternetOnline={syncStatus.isInternetOnline} />
                </div>
                <div className="lg:col-span-7">
                  <ActiveVisits
                    visits={visits}
                    onRegisterExit={handleRegisterExit}
                    isInternetOnline={syncStatus.isInternetOnline}
                    onForceSync={handleManualSync}
                  />
                </div>
              </div>
            )}

            {activeTab === 'residents' && (
              <ResidentsModule showToast={showToast} isInternetOnline={syncStatus.isInternetOnline} />
            )}

            {activeTab === 'diaristas' && (
              <DiaristasModule showToast={showToast} isInternetOnline={syncStatus.isInternetOnline} />
            )}

            {activeTab === 'scheduled' && (
              <ScheduledServicesModule showToast={showToast} isInternetOnline={syncStatus.isInternetOnline} />
            )}

            {activeTab === 'keys' && (
              <KeyControlModule showToast={showToast} isInternetOnline={syncStatus.isInternetOnline} />
            )}

            {activeTab === 'history' && <HistoryVisits visits={visits} />}

            {activeTab === 'status' && (
              <SyncSettings
                status={syncStatus}
                onSync={handleManualSync}
                onToggleInternet={handleToggleInternetSimulation}
                isSyncing={isSyncing}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full font-mono"
            id="toast-notification"
          >
            <div className={`p-4 rounded-sm border text-[11px] flex items-start gap-3 shadow-2xl ${
              notification.type === 'success'
                ? 'bg-[#0a0d14] border-emerald-500/30 text-emerald-400'
                : notification.type === 'warning'
                  ? 'bg-[#0a0d14] border-amber-500/30 text-amber-500'
                  : 'bg-[#0a0d14] border-red-500/30 text-red-400'
            }`}>
              {notification.type === 'success' && <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />}
              {notification.type !== 'success' && <WifiOff size={14} className="shrink-0 mt-0.5" />}
              <div className="flex-1">
                <p className="font-bold uppercase tracking-wider">
                  {notification.type === 'success' ? 'Sucesso' : notification.type === 'warning' ? 'Aviso' : 'Falha'}
                </p>
                <p className="text-slate-400 mt-1 leading-relaxed">{notification.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="bg-[#05070a] border-t border-slate-900/60 py-6 text-center text-xs text-slate-500 mt-12 font-mono">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="uppercase text-[9px] text-slate-600 tracking-wider">2026 Condominio Chateauneuf. Servico de Portaria.</p>
          <div className="flex items-center gap-3 font-mono text-[9px] text-slate-600">
            <span>CLIENT-SPA: REACT 19 + TAILWIND 4</span>
            <span className="text-slate-900">|</span>
            <span>DATA ENGINE: GO BACKEND + SQLITE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TabButton({ active, children, icon, onClick }: { active: boolean; children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 py-4 px-1 border-b-2 font-mono font-bold text-xs uppercase tracking-widest transition cursor-pointer ${
        active
          ? 'border-emerald-500 text-emerald-400'
          : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800/80'
      }`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
