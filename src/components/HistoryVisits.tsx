/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calendar, FileSpreadsheet, Filter, History, Key, Package, Search } from 'lucide-react';
import { KeyRecord, ShoppingDelivery, Visit } from '../types';

interface HistoryVisitsProps {
  visits: Visit[];
  shoppingDeliveries: ShoppingDelivery[];
  keyRecords: KeyRecord[];
}

type HistoryRecord =
  | { kind: 'visit'; date: string; data: Visit }
  | { kind: 'shopping'; date: string; data: ShoppingDelivery }
  | { kind: 'key'; date: string; data: KeyRecord };

export default function HistoryVisits({ visits, shoppingDeliveries, keyRecords }: HistoryVisitsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; name: string; label: string } | null>(null);

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + 'h';
  };

  const getCompletedDuration = (startISO: string, endISO?: string) => {
    if (!endISO) return 'Em aberto';

    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();
    const diffMs = end - start;
    if (diffMs <= 0) return '--';

    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMinutes / 60);
    const remMinutes = diffMinutes % 60;

    if (diffHours === 0) return `${remMinutes} min`;
    return `${diffHours}h ${remMinutes}m`;
  };

  const keyDateTime = (date: string, time: string) => `${date}T${time.length === 5 ? `${time}:00` : time}`;

  const matchesDateFilter = (isoString: string) => {
    const recordDate = new Date(isoString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateFilter === 'today') return recordDate >= today;
    if (dateFilter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      oneWeekAgo.setHours(0, 0, 0, 0);
      return recordDate >= oneWeekAgo;
    }
    return true;
  };

  const records: HistoryRecord[] = [
    ...visits.map((visit): HistoryRecord => ({ kind: 'visit', date: visit.entryTime, data: visit })),
    ...shoppingDeliveries.map((delivery): HistoryRecord => ({ kind: 'shopping', date: delivery.receivedAt, data: delivery })),
    ...keyRecords.map((keyRecord): HistoryRecord => ({ kind: 'key', date: keyDateTime(keyRecord.date, keyRecord.pickupTime), data: keyRecord })),
  ];

  const filteredRecords = records
    .filter(record => {
      const q = searchTerm.toLowerCase().trim();
      let matchesSearch = !q;
      if (!matchesSearch && record.kind === 'visit') {
        matchesSearch = (
          record.data.name.toLowerCase().includes(q) ||
          record.data.document.toLowerCase().includes(q) ||
          record.data.company.toLowerCase().includes(q) ||
          record.data.unit.toLowerCase().includes(q) ||
          (record.data.licensePlate && record.data.licensePlate.toLowerCase().includes(q)) ||
          false
        );
      }
      if (!matchesSearch && record.kind === 'shopping') {
        matchesSearch = (
          record.data.unit.toLowerCase().includes(q) ||
          (record.data.recipient && record.data.recipient.toLowerCase().includes(q)) ||
          record.data.courierName.toLowerCase().includes(q) ||
          record.data.document.toLowerCase().includes(q) ||
          record.data.store.toLowerCase().includes(q) ||
          record.data.product.toLowerCase().includes(q) ||
          (record.data.notes && record.data.notes.toLowerCase().includes(q)) ||
          false
        );
      }
      if (!matchesSearch && record.kind === 'key') {
        matchesSearch = (
          record.data.local.toLowerCase().includes(q) ||
          record.data.residentName.toLowerCase().includes(q) ||
          record.data.unit.toLowerCase().includes(q) ||
          record.data.gatekeeper.toLowerCase().includes(q)
        );
      }

      const isActive =
        record.kind === 'visit'
          ? !record.data.exitTime
          : record.kind === 'shopping'
            ? record.data.status === 'aguardando_retirada'
            : record.data.status === 'retirada';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && isActive) ||
        (statusFilter === 'completed' && !isActive);

      return matchesSearch && matchesDateFilter(record.date) && matchesStatus;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="bg-[#0a0d14] rounded-sm border border-slate-800/40 overflow-hidden" id="card-history-visits">
      <div className="bg-[#07090f] border-b border-slate-800/40 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Historico Geral</h2>
              <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">Acessos, compras e chaves consolidados na unidade local</p>
            </div>
          </div>

          <div className="text-[9px] font-mono bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-sm flex items-center gap-1.5 uppercase tracking-wider">
            <FileSpreadsheet size={12} className="text-emerald-400 shrink-0" />
            <span>Sincronismo Direto Google Sheets</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-900/60">
          <div className="relative md:col-span-2">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
              <Search size={16} />
            </span>
            <input
              type="text"
              id="input-history-search"
              placeholder="Pesquisar por apartamento, nome, documento, produto, chave..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-sm focus:outline-none focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/20 transition placeholder-slate-600"
            />
          </div>

          <div className="flex items-center gap-1.5 relative">
            <Calendar size={12} className="text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              id="select-history-date-filter"
              className="w-full pl-9 pr-3 py-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-sm focus:outline-none focus:border-emerald-500/50 transition cursor-pointer"
            >
              <option value="all">Todas as datas</option>
              <option value="today">Hoje</option>
              <option value="week">Ultimos 7 dias</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 relative">
            <Filter size={12} className="text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              id="select-history-status-filter"
              className="w-full pl-9 pr-3 py-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-sm focus:outline-none focus:border-emerald-500/50 transition cursor-pointer"
            >
              <option value="all">Todos os status</option>
              <option value="active">Em andamento</option>
              <option value="completed">Concluidos</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p-0 overflow-x-auto">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-12 px-4" id="no-history-results">
            <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center text-slate-600 mx-auto mb-3 border border-slate-800">
              <History size={16} className="opacity-60" />
            </div>
            <h3 className="text-xs uppercase font-bold tracking-widest text-slate-400">Nenhum registro encontrado</h3>
            <p className="text-[11px] text-slate-500 mt-1">Sua busca com os filtros atuais nao resultou em registros.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse" id="history-table">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-950/80 border-b border-slate-900 text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                <th className="px-6 py-3">Registro / Documento</th>
                <th className="px-5 py-3">Origem / Tipo</th>
                <th className="px-5 py-3">Destino</th>
                <th className="px-5 py-3">Analise Temporal</th>
                <th className="px-5 py-3 text-center">Duracao</th>
                <th className="px-6 py-3 text-right">Local de Guarda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-950 text-xs text-slate-300">
              {filteredRecords.map((record) => {
                if (record.kind === 'key') {
                  const keyRecord = record.data;
                  const isActive = keyRecord.status === 'retirada';
                  const pickupISO = keyDateTime(keyRecord.date, keyRecord.pickupTime);
                  const returnISO = keyRecord.returnTime ? keyDateTime(keyRecord.date, keyRecord.returnTime) : undefined;
                  return (
                    <tr key={`key-${keyRecord.id}`} id={`history-key-row-${keyRecord.id}`} className="hover:bg-slate-900/20 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                          <div className="w-10 h-10 rounded-sm bg-slate-900 border border-slate-800/60 flex items-center justify-center text-amber-400 shrink-0">
                            <Key size={16} />
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs">{keyRecord.local}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-tight">
                              Morador: {keyRecord.residentName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-300">Controle de Chaves</div>
                        <div className="text-[9px] mt-1 text-amber-300 font-bold font-mono uppercase bg-amber-950/40 border border-amber-800/60 px-1.5 py-0.5 rounded-sm inline-block">
                          Chave
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded-sm inline-block text-[10px]">
                          Apto {keyRecord.unit}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Retirada" />
                          <span className="text-slate-300">{formatDate(pickupISO)} {keyRecord.pickupTime}h</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {isActive ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Chave retirada" />
                              <span className="text-amber-300 font-medium uppercase text-[9px]">Chave retirada</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" title="Devolucao" />
                              <span className="text-slate-500">Devolvida {keyRecord.returnTime}h</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center font-mono">
                        {isActive ? (
                          <span className="text-amber-300 font-bold bg-amber-950/30 border border-amber-500/20 px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-wider">
                            Em aberto
                          </span>
                        ) : (
                          <span className="text-slate-300 font-medium text-[11px]">
                            {getCompletedDuration(pickupISO, returnISO)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono">
                        {keyRecord.syncStatus === 'synced' ? (
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
                }

                if (record.kind === 'shopping') {
                  const delivery = record.data;
                  const isActive = delivery.status === 'aguardando_retirada';
                  return (
                    <tr key={`shopping-${delivery.id}`} id={`history-shopping-row-${delivery.id}`} className="hover:bg-slate-900/20 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                          {delivery.photo ? (
                            <img
                              src={delivery.photo}
                              alt={delivery.product}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-sm object-cover border border-slate-800 shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                              onClick={() => setSelectedPhoto({ url: delivery.photo!, name: delivery.product, label: 'PRODUTO' })}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-sm bg-slate-900 border border-slate-800/60 flex items-center justify-center text-cyan-400 shrink-0">
                              <Package size={16} />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white text-xs">{delivery.product}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-tight">Destinatario: {delivery.recipient || 'Nao informado'} | Entregador: {delivery.courierName || 'Nao informado'} | Doc: {delivery.document || 'Nao informado'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-300">{delivery.store}</div>
                        <div className="text-[9px] mt-1 text-cyan-300 font-bold font-mono uppercase bg-cyan-950/40 border border-cyan-800/60 px-1.5 py-0.5 rounded-sm inline-block">
                          Compra
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded-sm inline-block text-[10px]">
                          {delivery.unit}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" title="Recebimento" />
                          <span className="text-slate-300">{formatDate(delivery.receivedAt)} {formatTime(delivery.receivedAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {isActive ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" title="Aguardando retirada" />
                              <span className="text-cyan-300 font-medium uppercase text-[9px]">Aguardando retirada</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" title="Retirada" />
                              <span className="text-slate-500">{formatDate(delivery.withdrawnAt!)} {formatTime(delivery.withdrawnAt!)}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center font-mono">
                        {isActive ? (
                          <span className="text-cyan-300 font-bold bg-cyan-950/30 border border-cyan-500/20 px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-wider">
                            Em aberto
                          </span>
                        ) : (
                          <span className="text-slate-300 font-medium text-[11px]">
                            {getCompletedDuration(delivery.receivedAt, delivery.withdrawnAt)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono">
                        {delivery.syncStatus === 'synced' ? (
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
                }

                const visit = record.data;
                const isActive = !visit.exitTime;
                return (
                  <tr key={`visit-${visit.id}`} id={`history-row-${visit.id}`} className="hover:bg-slate-900/20 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                        {visit.photo ? (
                          <img
                            src={visit.photo}
                            alt={visit.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-sm object-cover border border-slate-800 shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                            onClick={() => setSelectedPhoto({ url: visit.photo!, name: visit.name, label: 'PRESTADOR' })}
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
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-300">{visit.company}</div>
                      <div className="text-[9px] mt-1 text-slate-400 font-bold font-mono uppercase bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-sm inline-block">
                        {visit.visitorType}
                      </div>
                    </td>
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
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" title="Saida" />
                            <span className="text-slate-500">{formatDate(visit.exitTime!)} {formatTime(visit.exitTime!)}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center font-mono">
                      {isActive ? (
                        <span className="text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-wider">
                          Em aberto
                        </span>
                      ) : (
                        <span className="text-slate-300 font-medium text-[11px]">
                          {getCompletedDuration(visit.entryTime, visit.exitTime)}
                        </span>
                      )}
                    </td>
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

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-5xl w-full bg-slate-900 border border-slate-800 p-4 rounded-sm shadow-2xl font-mono text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-3 text-slate-500 hover:text-white text-[10px] font-bold cursor-pointer transition"
              onClick={() => setSelectedPhoto(null)}
            >
              FECHAR [X]
            </button>
            <div className="mb-2 text-emerald-400 uppercase tracking-widest font-bold text-[9px]">
              REGISTRO FOTOGRAFICO HISTORICO
            </div>
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.name}
              referrerPolicy="no-referrer"
              className="w-full max-h-[78vh] object-contain border border-slate-800 bg-slate-950 rounded-sm"
            />
            <div className="mt-3 text-slate-200">
              <span className="text-slate-500 font-bold uppercase text-[10px]">{selectedPhoto.label}:</span>
              <p className="font-bold text-sm text-white mt-0.5 uppercase tracking-wide">{selectedPhoto.name}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
