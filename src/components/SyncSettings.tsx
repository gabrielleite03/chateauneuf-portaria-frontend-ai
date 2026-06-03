import React from 'react';
import { ArrowRight, Database, FileText, Layers, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { SyncStatus } from '../types';

interface SyncSettingsProps {
  status: SyncStatus;
  onSync: () => Promise<void>;
  onToggleInternet?: () => Promise<void>;
  isSyncing: boolean;
}

export default function SyncSettings({ status, onSync, isSyncing }: SyncSettingsProps) {
  const formatDate = (value: string | null) => {
    if (!value) return 'Nao disponivel';
    return new Date(value).toLocaleString('pt-BR');
  };

  return (
    <div className="bg-[#0a0d14] rounded-sm border border-slate-800/40 overflow-hidden" id="card-sync-settings">
      <div className="bg-[#07090f] border-b border-slate-800/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Painel de Sincronizacao & Rede</h2>
            <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">Status retornado exclusivamente pela API Go local</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatusCard icon={<Database size={16} />} title="Backend Go" value={status.isBackendConnected ? 'Online' : 'Offline'}>
            API local em D:\Projects\Chateauneuf\chateauneuf-portaria-backend.
          </StatusCard>

          <StatusCard icon={status.isInternetOnline ? <Wifi size={16} /> : <WifiOff size={16} />} title="Sync Worker" value={status.isInternetOnline ? 'Online' : 'Offline'}>
            Estado de conectividade calculado pelo backend, sem simulacao no frontend.
          </StatusCard>

          <StatusCard icon={<RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />} title="Pendencias" value={`${status.pendingSyncCount} registro(s)`}>
            Aguardando envio para Google Sheets / Drive pelo worker Go.
          </StatusCard>
        </div>

        <div className="bg-slate-950 border border-slate-900 p-4 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
          <div>
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Sincronizacao manual</h4>
            <p className="text-[11px] text-slate-500 mt-1">
              Ultimo sincronismo registrado: <span className="text-white">{formatDate(status.lastSyncTime)}</span>
            </p>
          </div>
          <button
            onClick={onSync}
            id="btn-settings-sync-force"
            disabled={isSyncing || !status.isInternetOnline}
            className={`text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-sm cursor-pointer transition active:scale-95 flex items-center gap-1.5 ${
              isSyncing
                ? 'bg-emerald-600 text-white cursor-not-allowed border border-emerald-500'
                : !status.isInternetOnline
                  ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                  : 'bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-500/30'
            }`}
          >
            <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
            Sincronizar ({status.pendingSyncCount})
          </button>
        </div>

        <div className="border border-slate-800/50 rounded-sm p-5" id="architecture-diagram">
          <div className="flex items-center gap-1.5 mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Layers size={12} className="text-emerald-500" />
            <span>Fluxo validado</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-9 items-center gap-2 lg:gap-1 text-center text-[10px] font-mono">
            <FlowBox className="lg:col-span-2" title="Frontend" subtitle="Vite + React" />
            <Arrow />
            <FlowBox className="lg:col-span-2" title="Backend Go" subtitle="REST API local" highlight />
            <Arrow />
            <FlowBox title="SQLite" subtitle="Persistencia local" />
            <Arrow />
            <FlowBox className="lg:col-span-2" title="Google" subtitle="Sheets / Drive via worker" />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <FileText size={12} className="text-emerald-500" />
            <span>Eventos de sincronizacao</span>
          </div>

          <div className="border border-slate-800/80 rounded-sm divide-y divide-slate-900/60 overflow-hidden font-mono text-[10px]" id="logs-container">
            {status.syncHistory.length === 0 ? (
              <div className="text-center text-slate-500 py-6 bg-slate-950/20">Nenhum erro recente retornado pelo backend.</div>
            ) : (
              status.syncHistory.map(log => (
                <div key={log.id} className="p-3 bg-slate-950/30 hover:bg-slate-950/80 transition flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 block mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-bold uppercase text-red-400">[{log.status}]</span>
                      <span className="text-slate-500 text-[9px]">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-slate-400 mt-1 leading-normal">{log.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon, title, value, children }: { icon: React.ReactNode; title: string; value: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-800/60 rounded-sm p-4 bg-slate-950/40 hover:border-slate-700/60 flex items-start gap-3">
      <div className="p-2 bg-slate-900 border border-slate-800 text-emerald-400 rounded-sm shrink-0">{icon}</div>
      <div>
        <p className="text-[9px] text-slate-500 uppercase font-mono tracking-wider">{title}</p>
        <h3 className="font-bold text-xs text-white uppercase tracking-wider mt-0.5">{value}</h3>
        <span className="text-[11px] text-slate-400 block mt-1 leading-normal">{children}</span>
      </div>
    </div>
  );
}

function FlowBox({ title, subtitle, className = 'lg:col-span-1', highlight = false }: { title: string; subtitle: string; className?: string; highlight?: boolean }) {
  return (
    <div className={`${className} border ${highlight ? 'border-emerald-900/40 text-emerald-400' : 'border-slate-850 text-slate-300'} bg-slate-900 p-2.5 rounded-sm font-bold`}>
      <p className="uppercase">{title}</p>
      <p className="text-[9px] text-slate-500 font-normal mt-1">{subtitle}</p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="lg:col-span-1 text-slate-600 flex justify-center rotate-90 lg:rotate-0">
      <ArrowRight size={14} />
    </div>
  );
}
