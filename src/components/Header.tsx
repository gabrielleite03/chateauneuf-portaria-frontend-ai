import React, { useEffect, useState } from 'react';
import { Clock, RefreshCw, ShieldCheck } from 'lucide-react';
import { SyncStatus } from '../types';

interface HeaderProps {
  status: SyncStatus;
  onSync: () => Promise<void>;
  onToggleInternet?: () => Promise<void>;
  isSyncing: boolean;
}

export default function Header({ status, onSync, isSyncing }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const lastSync = status.lastSyncTime
    ? new Date(status.lastSyncTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Nunca';

  return (
    <header id="app-header" className="bg-[#0a0d14] text-slate-100 border-b border-slate-800/60 shadow-[0_4px_20px_rgba(0,0,0,0.4)] px-6 py-4 shrink-0">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <ShieldCheck size={24} id="icon-shield-check" className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white uppercase leading-none">
              Portaria Chateauneuf <span className="text-slate-500 font-normal">| MVP</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-1">
              Frontend conectado exclusivamente ao backend Go
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2.5 bg-[#05070a] px-3.5 py-1.5 rounded-sm border border-slate-800/60 text-slate-200">
            <Clock size={15} className="text-emerald-400" />
            <div className="flex flex-col">
              <span className="font-mono text-xs leading-none font-bold text-white tracking-widest">
                {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </span>
              <span className="text-[9px] text-slate-500 leading-none mt-1 capitalize tracking-tighter">
                {time.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          <StatusPill
            ok={status.isBackendConnected}
            label={`Backend Go: ${status.isBackendConnected ? 'Online' : 'Offline'}`}
            warn={false}
          />

          <StatusPill
            ok={status.isInternetOnline}
            label={`Sync: ${status.isInternetOnline ? 'Online' : 'Offline'} | ${lastSync}`}
            warn={!status.isInternetOnline}
          />

          <button
            id="btn-sync-now"
            onClick={onSync}
            disabled={isSyncing || !status.isInternetOnline}
            title={status.isInternetOnline ? 'Sincronizar dados pendentes' : 'Sincronizacao indisponivel offline'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-sm font-bold uppercase text-[10px] tracking-wider cursor-pointer transition-all ${
              isSyncing
                ? 'bg-emerald-600 text-white cursor-not-allowed'
                : !status.isInternetOnline
                  ? 'bg-slate-900/40 text-slate-600 border border-slate-800/40 cursor-not-allowed'
                  : 'bg-emerald-950 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-500/40 shadow-sm active:scale-95'
            }`}
          >
            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
            <span>Sincronizar ({status.pendingSyncCount})</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function StatusPill({ ok, warn, label }: { ok: boolean; warn: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 px-3.5 py-2 rounded-sm border ${
      ok
        ? 'bg-[#05070a] border-slate-800/60 text-emerald-400'
        : warn
          ? 'bg-amber-950/20 border-amber-900/40 text-amber-500'
          : 'bg-red-950/20 border-red-900/60 text-red-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : warn ? 'bg-amber-500' : 'bg-red-500'} shrink-0`} />
      <span className="font-mono text-[10px] uppercase tracking-wider">{label}</span>
    </div>
  );
}
