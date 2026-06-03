/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Clock, Database, CloudLightning, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';
import { SyncStatus } from '../types';

interface HeaderProps {
  status: SyncStatus;
  onSync: () => Promise<void>;
  onToggleInternet: () => Promise<void>;
  isSyncing: boolean;
}

export default function Header({ status, onSync, onToggleInternet, isSyncing }: HeaderProps) {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatBrazilianDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatLastSync = (isoString: string | null) => {
    if (!isoString) return 'Nunca sincronizado';
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <header id="app-header" className="bg-[#0a0d14] text-slate-100 border-b border-slate-800/60 shadow-[0_4px_20px_rgba(0,0,0,0.4)] px-6 py-4 shrink-0">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Brand & Condominium Segment */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <ShieldCheck size={24} id="icon-shield-check" className="text-emerald-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white uppercase leading-none">
              Portaria Chateauneuf <span className="text-slate-500 font-normal">| v2.1</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-1">
              Unidade de Controle Local
            </p>
          </div>
        </div>

        {/* Real-time Status indicators */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          
          {/* Real-time Clock */}
          <div className="flex items-center gap-2.5 bg-[#05070a] px-3.5 py-1.5 rounded-sm border border-slate-800/60 text-slate-200">
            <Clock size={15} className="text-emerald-400" />
            <div className="flex flex-col">
              <span className="font-mono text-xs leading-none font-bold text-white tracking-widest">{formatTime(time)}</span>
              <span className="text-[9px] text-slate-500 leading-none mt-1 capitalize tracking-tighter">{formatBrazilianDate(time)}</span>
            </div>
          </div>

          {/* Backend Connection State */}
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-sm border ${
            status.isBackendConnected 
              ? 'bg-[#05070a] border-slate-800/60 text-emerald-400' 
              : 'bg-red-950/20 border-red-900/60 text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.isBackendConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-red-500'} shrink-0`} />
            <span className="font-mono text-[10px] uppercase tracking-wider">
              SQLite: {status.isBackendConnected ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Internet / Cloud Sync Connection State */}
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-sm border transition-all duration-300 ${
            status.isInternetOnline 
              ? 'bg-[#05070a] border-slate-800/60 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.05)]' 
              : 'bg-amber-950/20 border-amber-900/40 text-amber-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.isInternetOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-amber-500'} shrink-0`} />
            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-wider leading-none">
                Google Sheets: {status.isInternetOnline ? 'Online' : 'Aguardando Sync'}
              </span>
              {status.lastSyncTime && (
                <span className="text-[8px] text-slate-500 mt-0.5 font-mono">
                  Sinc: {formatLastSync(status.lastSyncTime)}
                </span>
              )}
            </div>
          </div>

          {/* Sync Trigger Action */}
          <button
            id="btn-sync-now"
            onClick={onSync}
            disabled={isSyncing || !status.isInternetOnline}
            title={status.isInternetOnline ? "Sincronizar dados pendentes" : "Sincronização indisponível offline"}
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

          {/* Simulated Network Toggle (Great for testing the offline capabilities easily) */}
          <button
            id="btn-toggle-internet-simulation"
            onClick={onToggleInternet}
            title="Clique para alternar o status da internet e testar o funcionamento offline"
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-sm text-slate-400 hover:text-white transition active:scale-95 cursor-pointer"
          >
            <span className="text-[9px] text-slate-500 font-mono tracking-tighter uppercase">Simulação Internet:</span>
            {status.isInternetOnline ? (
              <div className="flex items-center gap-1 text-emerald-400 font-bold text-[9px] font-mono">
                <span>ON</span>
                <ToggleRight size={16} className="text-emerald-500" />
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-500 font-bold text-[9px] font-mono">
                <span>OFF</span>
                <ToggleLeft size={16} className="text-slate-500" />
              </div>
            )}
          </button>

        </div>
      </div>
    </header>
  );
}
