/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, UserCheck, History, Settings, RefreshCw, LayoutDashboard, WifiOff, FileText, CheckCircle2, Building2, Sparkles, Wrench, Key } from 'lucide-react';

import { Visit, SyncStatus } from './types';
import Header from './components/Header';
import RegistrationForm from './components/RegistrationForm';
import ActiveVisits from './components/ActiveVisits';
import HistoryVisits from './components/HistoryVisits';
import SyncSettings from './components/SyncSettings';
import ResidentsModule from './components/ResidentsModule';
import DiaristasModule from './components/DiaristasModule';
import ScheduledServicesModule from './components/ScheduledServicesModule';
import KeyControlModule from './components/KeyControlModule';

export default function App() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isInternetOnline: true,
    isBackendConnected: false,
    lastSyncTime: null,
    pendingSyncCount: 0,
    syncHistory: []
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'control' | 'history' | 'status' | 'residents' | 'diaristas' | 'scheduled' | 'keys'>('control');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // Fetch initial data from custom express backend
  const fetchData = async () => {
    try {
      // 1. Get connection and synchronization status
      const statusRes = await fetch('/api/status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setSyncStatus(prev => ({
          ...prev,
          isBackendConnected: true,
          isInternetOnline: statusData.isInternetOnline,
          lastSyncTime: statusData.lastSyncTime,
          pendingSyncCount: statusData.pendingSyncCount,
          syncHistory: statusData.syncHistory || []
        }));
      }

      // 2. Get visits log
      const visitsRes = await fetch('/api/visits');
      if (visitsRes.ok) {
        const visitsData = await visitsRes.json();
        setVisits(visitsData);
      }
    } catch (err) {
      console.error("Backend unreachable. Running fallback states.", err);
      setSyncStatus(prev => ({
        ...prev,
        isBackendConnected: false
      }));
      showToast("Aviso: Conexão esgotada com o servidor Go local. Os dados mostrados podem estar desatualizados.", 'error');
    }
  };

  useEffect(() => {
    fetchData();
    // Poll updates every 6 seconds to capture background sync updates or checkout stay duration
    const poll = setInterval(fetchData, 6000);
    return () => clearInterval(poll);
  }, []);

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Register entrance (Calls POST /api/entry)
  const handleRegisterEntrance = async (newData: Omit<Visit, 'id' | 'entryTime' | 'syncStatus'>) => {
    try {
      const response = await fetch('/api/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      });

      if (!response.ok) {
        throw new Error("Erro ao criar entrada no servidor");
      }

      const createdVisit: Visit = await response.json();
      
      // Update local state and status counters
      setVisits(prev => [createdVisit, ...prev]);
      
      // Trigger status fetch to sync counters instantly
      await fetchData();
      
      if (syncStatus.isInternetOnline) {
        showToast(`Entrada de ${createdVisit.name} sincronizada com sucesso!`, 'success');
      } else {
        showToast(`Entrada de ${createdVisit.name} gravada offline no SQLite.`, 'warning');
      }

      return createdVisit;
    } catch (err) {
      console.error(err);
      showToast("Não foi possível salvar a entrada. Falha na comunicação com o backend.", 'error');
      return null;
    }
  };

  // Register exit (Calls POST /api/exit)
  const handleRegisterExit = async (id: string) => {
    try {
      const response = await fetch('/api/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (!response.ok) {
        throw new Error("Erro ao registrar saída no servidor");
      }

      const updatedVisit: Visit = await response.json();

      // Mirror the update inside state
      setVisits(prev => prev.map(v => v.id === id ? updatedVisit : v));
      
      // Trigger status fetch to sync counters instantly
      await fetchData();

      if (syncStatus.isInternetOnline) {
        showToast(`Saída de ${updatedVisit.name} registrada e sincronizada!`, 'success');
      } else {
        showToast(`Saída de ${updatedVisit.name} gravada no SQLite (Offline).`, 'warning');
      }
    } catch (err) {
      console.error(err);
      showToast("Não foi possível gravar a saída. Verifique seu servidor local.", 'error');
    }
  };

  // Handle forcing synchronizer (Calls POST /api/sync)
  const handleManualSync = async () => {
    if (!syncStatus.isInternetOnline) return;
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error("Falha na sincronização");
      }

      const data = await response.json();
      showToast(
        data.syncedCount > 0 
          ? `Sucesso: ${data.syncedCount} registros locais sincronizados com o Google Sheets!`
          : "Sincronização OK. Todos os dados da portaria já estão atualizados no Sheets.",
        'success'
      );
      
      await fetchData();
    } catch (err) {
      console.error(err);
      showToast("Ocorreu um erro ao sincronizar com as planilhas do Google.", 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Toggle internet (Calls POST /api/status/toggle-internet)
  const handleToggleInternetSimulation = async () => {
    try {
      const response = await fetch('/api/status/toggle-internet', {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(prev => ({
          ...prev,
          isInternetOnline: data.isInternetOnline
        }));
        showToast(
          data.isInternetOnline 
            ? "Conectividade reestabelecida. Sincronização automatizada ativada." 
            : "Internet simulada como indisponível. Entradas/saídas serão guardadas no SQLite local.",
          data.isInternetOnline ? 'success' : 'warning'
        );
        await fetchData();
      }
    } catch (err) {
      console.error(err);
      showToast("Não foi possível alterar o status de internet.", 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#030508] flex flex-col font-sans selection:bg-emerald-500 selection:text-[#030508] text-slate-100 animate-fadeIn">
      
      {/* Top Header Segment */}
      <Header 
        status={syncStatus} 
        onSync={handleManualSync} 
        onToggleInternet={handleToggleInternetSimulation}
        isSyncing={isSyncing}
      />

      {/* Main navigation menu for tabs */}
      <nav className="bg-[#07090f] border-b border-slate-900/80">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-8">
            
            <button
              id="tab-control-access"
              onClick={() => setActiveTab('control')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-mono font-bold text-xs uppercase tracking-widest transition cursor-pointer ${
                activeTab === 'control'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800/80'
              }`}
            >
              <LayoutDashboard size={14} className="text-current" />
              <span>Painel de Controle</span>
            </button>

            <button
              id="tab-residents"
              onClick={() => setActiveTab('residents')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-mono font-bold text-xs uppercase tracking-widest transition cursor-pointer ${
                activeTab === 'residents'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800/80'
              }`}
            >
              <Building2 size={14} className="text-current" />
              <span>Moradores</span>
            </button>

            <button
              id="tab-diaristas"
              onClick={() => setActiveTab('diaristas')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-mono font-bold text-xs uppercase tracking-widest transition cursor-pointer ${
                activeTab === 'diaristas'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800/80'
              }`}
            >
              <Sparkles size={14} className="text-current" />
              <span>Diaristas</span>
            </button>

            <button
              id="tab-scheduled"
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-mono font-bold text-xs uppercase tracking-widest transition cursor-pointer ${
                activeTab === 'scheduled'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800/80'
              }`}
            >
              <Wrench size={14} className="text-current" />
              <span>Serviços Agendados</span>
            </button>

            <button
              id="tab-keys"
              onClick={() => setActiveTab('keys')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-mono font-bold text-xs uppercase tracking-widest transition cursor-pointer ${
                activeTab === 'keys'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800/80'
              }`}
            >
              <Key size={14} className="text-current" />
              <span>Controle de Chaves</span>
            </button>

            <button
              id="tab-history"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-mono font-bold text-xs uppercase tracking-widest transition cursor-pointer ${
                activeTab === 'history'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800/80'
              }`}
            >
              <History size={14} className="text-current" />
              <span>Historico Geral</span>
            </button>

            <button
              id="tab-settings-sync"
              onClick={() => setActiveTab('status')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-mono font-bold text-xs uppercase tracking-widest transition cursor-pointer ${
                activeTab === 'status'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800/80'
              }`}
            >
              <Settings size={14} className="text-current" />
              <span>Sincronizacao & Rede</span>
              {syncStatus.pendingSyncCount > 0 && (
                <span className="bg-amber-950 border border-amber-500/30 text-amber-400 font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-sm animate-pulse ml-1.5 font-bold">
                  {syncStatus.pendingSyncCount}
                </span>
              )}
            </button>

          </div>
        </div>
      </nav>

      {/* Primary content area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        
        {/* Connection lost warning banner */}
        {!syncStatus.isBackendConnected && (
          <div className="mb-6 bg-red-950/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm flex items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span>
                <strong>SISTEMA OFFLINE:</strong> Sem resposta do servidor local. Certifique-se de que o backend em Go esta sendo executado localmente.
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
                
                {/* Left side: Register Form */}
                <div className="lg:col-span-5">
                  <RegistrationForm 
                    onRegister={handleRegisterEntrance} 
                    isInternetOnline={syncStatus.isInternetOnline} 
                  />
                </div>

                {/* Right side: Visitors currently inside */}
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
              <div id="residents-tab-content">
                <ResidentsModule 
                  showToast={showToast} 
                  isInternetOnline={syncStatus.isInternetOnline} 
                />
              </div>
            )}

            {activeTab === 'diaristas' && (
              <div id="diaristas-tab-content">
                <DiaristasModule 
                  showToast={showToast} 
                  isInternetOnline={syncStatus.isInternetOnline} 
                />
              </div>
            )}

            {activeTab === 'scheduled' && (
              <div id="scheduled-tab-content">
                <ScheduledServicesModule 
                  showToast={showToast} 
                  isInternetOnline={syncStatus.isInternetOnline} 
                />
              </div>
            )}

            {activeTab === 'keys' && (
              <div id="keys-tab-content">
                <KeyControlModule 
                  showToast={showToast} 
                  isInternetOnline={syncStatus.isInternetOnline} 
                />
              </div>
            )}

            {activeTab === 'history' && (
              <div id="history-tab-content">
                <HistoryVisits visits={visits} />
              </div>
            )}

            {activeTab === 'status' && (
              <div id="settings-tab-content">
                <SyncSettings 
                  status={syncStatus} 
                  onSync={handleManualSync}
                  onToggleInternet={handleToggleInternetSimulation}
                  isSyncing={isSyncing}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

      </main>

      {/* Floating global notification banner */}
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
              {notification.type === 'warning' && <WifiOff size={14} className="text-amber-400 shrink-0 mt-0.5" />}
              {notification.type === 'error' && <WifiOff size={14} className="text-red-400 shrink-0 mt-0.5" />}
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

      {/* Footer System Credits */}
      <footer className="bg-[#05070a] border-t border-slate-900/60 py-6 text-center text-xs text-slate-500 mt-12 font-mono">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="uppercase text-[9px] text-slate-600 tracking-wider">© 2026 Condominio Chateauneuf. Servico de Portaria.</p>
          <div className="flex items-center gap-3 font-mono text-[9px] text-slate-600">
            <span>CLIENT-SPA: REACT 19 + TAILWIND 4</span>
            <span className="text-slate-900">|</span>
            <span>DATA ENGINE: GO SPECS SQLite BACKEND v1.0</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
