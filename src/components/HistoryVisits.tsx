/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { History, Search, Calendar, Filter, FileSpreadsheet, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { Visit } from '../types';

interface HistoryVisitsProps {
  visits: Visit[];
}

export default function HistoryVisits({ visits }: HistoryVisitsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; name: string } | null>(null);

  // Format dates elegantly
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }) + 'h';
  };

  // Calculate stay duration
  const getCompletedStayDuration = (entryISO: string, exitISO: string) => {
    const entry = new Date(entryISO).getTime();
    const exit = new Date(exitISO).getTime();
    const diffMs = exit - entry;
    
    if (diffMs <= 0) return "--";

    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMinutes / 60);
    const remMinutes = diffMinutes % 60;

    if (diffHours === 0) {
      return `${remMinutes} min`;
    }
    return `${diffHours}h ${remMinutes}m`;
  };

  // Run filters
  const filteredVisits = visits.filter(v => {
    // 1. Term Search
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch = !q || (
      v.name.toLowerCase().includes(q) ||
      v.document.toLowerCase().includes(q) ||
      v.company.toLowerCase().includes(q) ||
      v.unit.toLowerCase().includes(q) ||
      (v.licensePlate && v.licensePlate.toLowerCase().includes(q))
    );

    // 2. Date Filter
    const entryDate = new Date(v.entryTime);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let matchesDate = true;
    if (dateFilter === 'today') {
      matchesDate = entryDate >= today;
    } else if (dateFilter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      oneWeekAgo.setHours(0, 0, 0, 0);
      matchesDate = entryDate >= oneWeekAgo;
    }

    // 3. Status Filter
    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = !v.exitTime;
    } else if (statusFilter === 'completed') {
      matchesStatus = !!v.exitTime;
    }

    return matchesSearch && matchesDate && matchesStatus;
  });

  return (
    <div className="bg-[#0a0d14] rounded-sm border border-slate-800/40 overflow-hidden" id="card-history-visits">
      
      {/* Container Header */}
      <div className="bg-[#07090f] border-b border-slate-800/40 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0"></div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Histórico de Acessos</h2>
              <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">Logs consolidados de entrada e saída na unidade local</p>
            </div>
          </div>

          <div className="text-[9px] font-mono bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-sm flex items-center gap-1.5 uppercase tracking-wider">
            <FileSpreadsheet size={12} className="text-emerald-400 shrink-0" />
            <span>Sincronismo Direto Google Sheets</span>
          </div>
        </div>

        {/* Filters control block */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-900/60">
          
          {/* Filter Search */}
          <div className="relative md:col-span-2">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
              <Search size={12} />
            </span>
            <input
              type="text"
              id="input-history-search"
              placeholder="Pesquisar por nome, apto, doc..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-xs focus:outline-none focus:border-emerald-500/50 transition placeholder-slate-600"
            />
          </div>

          {/* Filter Date */}
          <div className="flex items-center gap-1.5 relative">
            <Calendar size={12} className="text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              id="select-history-date-filter"
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-xs focus:outline-none focus:border-emerald-500/50 transition cursor-pointer"
            >
              <option value="all">Todas as datas</option>
              <option value="today">Hoje (Últimas 24h)</option>
              <option value="week">Últimos 7 dias</option>
            </select>
          </div>

          {/* Filter Status */}
          <div className="flex items-center gap-1.5 relative">
            <Filter size={12} className="text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              id="select-history-status-filter"
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-xs focus:outline-none focus:border-emerald-500/50 transition cursor-pointer"
            >
              <option value="all">Todos os status</option>
              <option value="active">Em andamento (Ativos)</option>
              <option value="completed">Concluídos (Saídas)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Content Grid/Table */}
      <div className="p-0 overflow-x-auto">
        {filteredVisits.length === 0 ? (
          <div className="text-center py-12 px-4" id="no-history-results">
            <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center text-slate-600 mx-auto mb-3 border border-slate-800">
              <History size={16} className="opacity-60" />
            </div>
            <h3 className="text-xs uppercase font-bold tracking-widest text-slate-400">Nenhum registro encontrado</h3>
            <p className="text-[11px] text-slate-500 mt-1">Sua busca com os filtros atuais não resultou em registros.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse" id="history-table">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-900 text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                <th className="px-6 py-3">Prestador / Documento</th>
                <th className="px-5 py-3">Serviço / Tipo</th>
                <th className="px-5 py-3">Destino</th>
                <th className="px-5 py-3">Análise Temporal</th>
                <th className="px-5 py-3 text-center">Permanência</th>
                <th className="px-6 py-3 text-right">Local de Guarda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-950 text-xs text-slate-300">
              {filteredVisits.map((visit) => {
                const isActive = !visit.exitTime;
                return (
                  <tr key={visit.id} id={`history-row-${visit.id}`} className="hover:bg-slate-900/20 transition-colors">
                    
                    {/* Visitor name & doc */}
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                        {visit.photo ? (
                          <img 
                            src={visit.photo} 
                            alt={visit.name} 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-sm object-cover border border-slate-800 shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                            onClick={() => setSelectedPhoto({ url: visit.photo!, name: visit.name })}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-sm bg-slate-900 border border-slate-800/60 flex items-center justify-center text-slate-600 font-mono shrink-0 font-bold text-[8px] uppercase">
                            S/ FOTO
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-white text-xs">{visit.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-tight">Doc: {visit.document}</div>
                        </div>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-300">{visit.company}</div>
                      <div className="text-[9px] mt-1 text-slate-400 font-bold font-mono uppercase bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-sm inline-block">
                        {visit.visitorType}
                      </div>
                    </td>

                    {/* Destination unit */}
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded-sm inline-block text-[10px]">
                        {visit.unit}
                      </span>
                      {visit.licensePlate && (
                        <span className="block mt-1 font-mono text-[9px] font-bold text-slate-400">
                          PLACA: {visit.licensePlate.toUpperCase()}
                        </span>
                      )}
                    </td>

                    {/* Entry/Exit Times */}
                    <td className="px-5 py-3.5 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Entrada" />
                        <span className="text-slate-300">{formatDate(visit.entryTime)} {formatTime(visit.entryTime)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {isActive ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Ativo" />
                            <span className="text-emerald-400 font-medium uppercase text-[9px]">Ativo no local</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" title="Saída" />
                            <span className="text-slate-500">{formatDate(visit.exitTime!)} {formatTime(visit.exitTime!)}</span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Stay duration */}
                    <td className="px-5 py-3.5 text-center font-mono">
                      {isActive ? (
                        <span className="text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-wider">
                          Em aberto
                        </span>
                      ) : (
                        <span className="text-slate-300 font-medium text-[11px]">
                          {getCompletedStayDuration(visit.entryTime, visit.exitTime!)}
                        </span>
                      )}
                    </td>

                    {/* Sync Status column */}
                    <td className="px-6 py-3.5 text-right font-mono">
                      {visit.syncStatus === 'synced' ? (
                        <div className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-2 py-0.5 rounded-sm font-bold text-[9px] uppercase tracking-wider">
                          <span>Google Sheets</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-amber-500 bg-amber-950/30 border border-amber-500/30 px-2 py-0.5 rounded-sm font-bold text-[9px] uppercase tracking-wider">
                          <span>SQLite Local</span>
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Lightbox / Modal for full photo preview */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setSelectedPhoto(null)}
        >
          <div 
            className="relative max-w-sm w-full bg-slate-900 border border-slate-800 p-4 rounded-sm shadow-2xl font-mono text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close trigger button */}
            <button 
              className="absolute top-2 right-3 text-slate-500 hover:text-white text-[10px] font-bold cursor-pointer transition"
              onClick={() => setSelectedPhoto(null)}
            >
              FECHAR [X]
            </button>
            <div className="mb-2 text-emerald-400 uppercase tracking-widest font-bold text-[9px]">
              REGISTRO FOTOGRÁFICO HISTÓRICO
            </div>
            <img 
              src={selectedPhoto.url} 
              alt={selectedPhoto.name}
              referrerPolicy="no-referrer"
              className="w-full aspect-[4/3] object-cover border border-slate-800 bg-slate-950 rounded-sm"
            />
            <div className="mt-3 text-slate-200">
              <span className="text-slate-500 font-bold uppercase text-[10px]">PRESTADOR:</span> 
              <p className="font-bold text-sm text-white mt-0.5 uppercase tracking-wide">{selectedPhoto.name}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
