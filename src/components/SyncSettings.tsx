/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Settings, RefreshCw, Layers, Database, Wifi, WifiOff, FileText, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { SyncStatus } from '../types';

interface SyncSettingsProps {
  status: SyncStatus;
  onSync: () => Promise<void>;
  onToggleInternet: () => Promise<void>;
  isSyncing: boolean;
  onClearDatabase?: () => Promise<void>;
}

export default function SyncSettings({ status, onSync, onToggleInternet, isSyncing, onClearDatabase }: SyncSettingsProps) {
  
  const formatDateStr = (isoString: string | null) => {
    if (!isoString) return 'Não disponível';
    return new Date(isoString).toLocaleString('pt-BR');
  };

  return (
    <div className="bg-[#0a0d14] rounded-sm border border-slate-800/40 overflow-hidden" id="card-sync-settings">
      
      {/* Container Header */}
      <div className="bg-[#07090f] border-b border-slate-800/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0"></div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Painel de Sincronização & Rede</h2>
            <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">Auditoria técnica da sincronização com planos de fundo em nuvem</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        
        {/* Connection status panels */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* SQLite card */}
          <div className="border border-slate-800/60 rounded-sm p-4 bg-slate-950/40 hover:border-slate-700/60 flex items-start gap-3">
            <div className="p-2 bg-slate-900 border border-slate-800 text-emerald-400 rounded-sm shrink-0">
              <Database size={16} />
            </div>
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-mono tracking-wider">Banco Local</p>
              <h3 className="font-bold text-xs text-white uppercase tracking-wider mt-0.5">SQLite Ativo</h3>
              <span className="text-[11px] text-slate-400 block mt-1 leading-normal">
                Todas as operações são salvas de imediato no SQLite local.
              </span>
            </div>
          </div>

          {/* Sync status card */}
          <div className="border border-slate-800/60 rounded-sm p-4 bg-slate-950/40 hover:border-slate-700/60 flex items-start gap-3">
            <div className={`p-2 rounded-sm border shrink-0 ${
              status.isInternetOnline ? 'bg-slate-900 border-slate-800 text-emerald-400' : 'bg-slate-900 border-amber-900/60 text-amber-500'
            }`}>
              {status.isInternetOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
            </div>
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-mono tracking-wider">Serviços em Nuvem</p>
              <h3 className="font-bold text-xs text-white uppercase tracking-wider mt-0.5">
                {status.isInternetOnline ? 'Online (Pronto)' : 'Modo Offline'}
              </h3>
              <span className="text-[11px] text-slate-400 block mt-1 leading-normal">
                {status.isInternetOnline 
                  ? 'Conexão ativa com serviços externos.' 
                  : 'Internet indisponível. Operações empilhadas localmente.'}
              </span>
            </div>
          </div>

          {/* Pending records card */}
          <div className="border border-slate-800/60 rounded-sm p-4 bg-slate-950/40 hover:border-slate-700/60 flex items-start gap-3">
            <div className="p-2 bg-slate-900 border border-slate-800 text-emerald-400 rounded-sm shrink-0">
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            </div>
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-mono tracking-wider">Pilha de Envio</p>
              <h3 className="font-bold text-xs text-white uppercase tracking-wider mt-0.5">
                {status.pendingSyncCount} Registro{status.pendingSyncCount !== 1 ? 's' : ''}
              </h3>
              <span className="text-[11px] text-slate-400 block mt-1 leading-normal">
                Aguardando envio para o Google Sheets / Drive.
              </span>
            </div>
          </div>

        </div>

        {/* Sync actions row */}
        <div className="bg-slate-950 border border-slate-900 p-4 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
          <div>
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">[SINCRONIZAÇÃO FORÇADA]</h4>
            <p className="text-[11px] text-slate-500 mt-1">
              Último sincronismo registrado: <span className="text-white">{formatDateStr(status.lastSyncTime)}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={onToggleInternet}
              id="btn-settings-toggle-internet"
              className="text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-sm cursor-pointer transition active:scale-95 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800"
            >
              Simular {status.isInternetOnline ? 'Offline' : 'Online'}
            </button>
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
              Sincronizar Planilha ({status.pendingSyncCount})
            </button>
          </div>
        </div>

        {/* Integration Architecture Flow Representation */}
        <div className="border border-slate-800/50 rounded-sm p-5" id="architecture-diagram">
          <div className="flex items-center gap-1.5 mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Layers size={12} className="text-emerald-500" />
            <span>Topografia e Comunicação Física de Dados</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-9 items-center gap-2 lg:gap-1 text-center text-[10px] font-mono">
            
            <div className="lg:col-span-2 border border-slate-850 bg-slate-900 p-2.5 rounded-sm">
              <p className="font-bold text-white uppercase">[1. SPA PORTARIA]</p>
              <p className="text-[9px] text-slate-500 mt-1">Sinais & Componentização local</p>
            </div>

            <div className="lg:col-span-1 text-slate-600 flex justify-center rotate-90 lg:rotate-0">
              <ArrowRight size={14} />
            </div>

            <div className="lg:col-span-2 border border-slate-850 bg-slate-900 p-2.5 rounded-sm font-bold text-slate-300">
              <p className="text-emerald-400 uppercase">[2. GO LOCAL SERVER]</p>
              <p className="text-[9px] text-slate-500 font-normal mt-1">Gestão inteligente e offline</p>
            </div>

            <div className="lg:col-span-1 text-slate-600 flex justify-center rotate-90 lg:rotate-0">
              <ArrowRight size={14} />
            </div>

            <div className="lg:col-span-1.5 border border-slate-850 bg-slate-900 p-2.5 rounded-sm font-bold text-slate-300">
              <p className="text-slate-300 uppercase">[3. SQLITE]</p>
              <p className="text-[9px] text-slate-500 font-normal mt-1">Backup local imediato</p>
            </div>

            <div className="lg:col-span-0.5 text-slate-600 flex justify-center rotate-90 lg:rotate-0">
              <ArrowRight size={12} />
            </div>

            <div className="lg:col-span-1 text-slate-500 flex flex-col items-center">
              <span className="text-[8px] font-mono text-emerald-500 uppercase tracking-tighter">Sync Worker</span>
              <ArrowRight size={12} className="text-emerald-500" />
            </div>

            <div className="lg:col-span-1 border border-emerald-900/30 bg-emerald-950/20 p-2.5 rounded-sm font-bold text-emerald-400 border-dashed">
              <p className="uppercase">[4. GOOGLE CLOUD]</p>
              <p className="text-[9px] text-[#94a3b8]/60 font-normal mt-1">Saves em Sheets/Drive</p>
            </div>

          </div>

          <div className="mt-4 text-[10px] text-slate-400 leading-relaxed bg-[#05070a] p-3 rounded-sm border border-slate-800/60 font-mono">
            <span className="font-bold text-emerald-400 block mb-1 uppercase tracking-widest">[DOUTRE DE RESPONSABILIDADE LOCAL]</span>
            O Frontend coleta, valida campos obrigatórios e exibe o status de sincronia retornado pela API. O Backend Go e a Sync Worker cuidam da segurança, do SQLite, da autenticação com o Google e da conectividade em cenários instáveis sem expor segredos no cliente.
          </div>
        </div>

        {/* Sync logs history of backend */}
        <div>
          <div className="flex items-center gap-1.5 mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <FileText size={12} className="text-emerald-500" />
            <span>Logs Internos de Integridade</span>
          </div>

          <div className="border border-slate-800/80 rounded-sm divide-y divide-slate-900/60 overflow-hidden font-mono text-[10px]" id="logs-container">
            {status.syncHistory.length === 0 ? (
              <div className="text-center text-slate-500 py-6 bg-slate-950/20">Nenhum evento registrado no log local.</div>
            ) : (
              status.syncHistory.map((log) => (
                <div key={log.id} className="p-3 bg-slate-950/30 hover:bg-slate-950/80 transition flex items-start gap-2.5">
                  <div className="mt-0.5">
                    {log.status === 'success' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block" />}
                    {log.status === 'warning' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 block" />}
                    {log.status === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 block animate-ping" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className={`font-bold uppercase ${
                        log.status === 'success' ? 'text-emerald-400' : log.status === 'warning' ? 'text-amber-500' : 'text-red-400'
                      }`}>
                        [{log.status}]
                      </span>
                      <span className="text-slate-500 text-[9px]">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </span>
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
