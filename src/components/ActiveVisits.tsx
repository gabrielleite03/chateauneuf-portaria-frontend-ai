/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Briefcase, Car, ChevronRight, Clock, FileText, Landmark, LogOut, Package, QrCode, RefreshCw, Search, UserRound, WifiOff, X } from 'lucide-react';
import QRCode from 'qrcode';
import { createPortal } from 'react-dom';
import { ShoppingDelivery, Visit } from '../types';
import { createDeliveryWithdrawalCode, fetchDeliveryWithdrawalStatus } from '../api';

interface ActiveVisitsProps {
  visits: Visit[];
  shoppingDeliveries: ShoppingDelivery[];
  onRegisterExit: (id: string) => Promise<void>;
  onWithdrawShopping: (id: string) => Promise<void>;
  isInternetOnline: boolean;
  onForceSync: () => Promise<void>;
}

export default function ActiveVisits({
  visits,
  shoppingDeliveries,
  onRegisterExit,
  onWithdrawShopping,
  isInternetOnline,
  onForceSync,
}: ActiveVisitsProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedRecord, setSelectedRecord] = useState<{ kind: 'visit' | 'shopping'; id: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; name: string; label: string } | null>(null);
  const [withdrawalSession, setWithdrawalSession] = useState<{ deliveryId: string; unit: string; code: string; expiresAt: string; qr: string } | null>(null);
  const [withdrawalSeconds, setWithdrawalSeconds] = useState(0);
  const [withdrawalError, setWithdrawalError] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!withdrawalSession) return;
    let completed = false;
    const poll = async () => {
      const remaining = Math.max(0, Math.ceil((new Date(withdrawalSession.expiresAt).getTime() - Date.now()) / 1000));
      setWithdrawalSeconds(remaining);
      if (remaining === 0) return;
      try {
        const result = await fetchDeliveryWithdrawalStatus(withdrawalSession.deliveryId);
        if (result.status === 'signed' && !completed) {
          completed = true;
          setWithdrawalSession(null);
          await onWithdrawShopping(withdrawalSession.deliveryId);
        } else if (result.status === 'expired') {
          setWithdrawalSeconds(0);
        }
      } catch (error) {
        console.error('Failed to read withdrawal signature status', error);
      }
    };
    poll();
    const timer = window.setInterval(poll, 1200);
    return () => window.clearInterval(timer);
  }, [withdrawalSession, onWithdrawShopping]);

  const activeProviders = visits.filter(v => !v.exitTime);
  const activeShopping = shoppingDeliveries.filter(delivery => delivery.status === 'aguardando_retirada');
  const selectedVisit = selectedRecord?.kind === 'visit' ? activeProviders.find(v => v.id === selectedRecord.id) : undefined;
  const selectedDelivery = selectedRecord?.kind === 'shopping' ? activeShopping.find(d => d.id === selectedRecord.id) : undefined;

  const closeDetails = () => {
    setSelectedRecord(null);
    setSelectedPhoto(null);
    setWithdrawalSession(null);
    setWithdrawalError('');
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selectedRecord && (selectedVisit || selectedDelivery)) {
      if (!dialog?.open) dialog?.showModal();
    } else {
      dialog?.close();
      if (selectedRecord) closeDetails();
    }
  }, [selectedRecord, selectedVisit, selectedDelivery]);

  const activeCount = activeProviders.length + activeShopping.length;
  const activeUnits = Array.from(new Set([
    ...activeProviders.map(v => v.unit).filter(Boolean),
    ...activeShopping.map(delivery => delivery.unit).filter(Boolean),
  ])).length;

  const filteredProviders = activeProviders.filter(v => {
    const q = searchTerm.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      v.document.toLowerCase().includes(q) ||
      v.company.toLowerCase().includes(q) ||
      v.unit.toLowerCase().includes(q) ||
      (v.notes && v.notes.toLowerCase().includes(q)) ||
      (v.licensePlate && v.licensePlate.toLowerCase().includes(q))
    );
  });

  const filteredShopping = activeShopping.filter(delivery => {
    const q = searchTerm.toLowerCase();
    return (
      delivery.unit.toLowerCase().includes(q) ||
      (delivery.recipient && delivery.recipient.toLowerCase().includes(q)) ||
      delivery.courierName.toLowerCase().includes(q) ||
      delivery.document.toLowerCase().includes(q) ||
      delivery.store.toLowerCase().includes(q) ||
      delivery.product.toLowerCase().includes(q) ||
      (delivery.notes && delivery.notes.toLowerCase().includes(q))
    );
  });
  const visibleCount = filteredProviders.length + filteredShopping.length;

  const getStayDuration = (entryTimeISO: string) => {
    const entry = new Date(entryTimeISO).getTime();
    const diffMs = currentTime - entry;

    if (!Number.isFinite(diffMs)) return '—';
    if (diffMs < 0) return '0m';

    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMinutes / 60);
    const remMinutes = diffMinutes % 60;

    if (diffHours === 0) {
      return `${remMinutes}m`;
    }
    return `${diffHours}h ${remMinutes}m`;
  };

  const handleExitClick = async (id: string, name: string) => {
    if (window.confirm(`Confirma a saída de "${name}"?`)) {
      setExitingId(`visit-${id}`);
      try {
        await onRegisterExit(id);
      } catch (err) {
        console.error('Failed to register checkout', err);
      } finally {
        setExitingId(null);
      }
    }
  };

  const handleShoppingWithdrawClick = async (id: string, unit: string) => {
    setExitingId(`shopping-${id}`);
    setWithdrawalError('');
    try {
      const session = await createDeliveryWithdrawalCode(id);
      const qr = await QRCode.toDataURL(session.code, { width: 420, margin: 4, errorCorrectionLevel: 'H' });
      setWithdrawalSession({ deliveryId: id, unit, ...session, qr });
      setWithdrawalSeconds(180);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível iniciar a assinatura da retirada.';
      setWithdrawalError(message);
    } finally {
      setExitingId(null);
    }
  };

  const hasPendingSync = visits.some(v => v.syncStatus === 'pending') || shoppingDeliveries.some(delivery => delivery.syncStatus === 'pending');

  return (
    <div className="bg-[#0a0d14] rounded-sm border border-slate-800/40 overflow-hidden" id="card-active-visits">
      <div className="bg-[#07090f] border-b border-slate-800/40 px-6 py-4 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Visitas e entregas</h2>
              <span className="font-mono text-xs font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-sm shrink-0" id="badge-active-count">
                {activeCount} ATIVO{activeCount !== 1 ? 'S' : ''}
              </span>
            </div>
            <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">Selecione um item para consultar os detalhes e registrar a baixa</p>
          </div>
        </div>

        <div className="relative w-full xl:w-[32rem]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
            <Search size={16} />
          </span>
          <input
            type="text"
            aria-label="Buscar visitas e entregas"
            placeholder="Buscar por apartamento, nome, placa, empresa, produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            id="input-filter-active"
            className="w-full pl-10 pr-3 py-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-sm focus:outline-none focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/20 outline-none transition placeholder-slate-600"
          />
        </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <SummaryTile label="Visitas no local" value={activeProviders.length} tone="emerald" />
          <SummaryTile label="Entregas aguardando" value={activeShopping.length} tone="cyan" />
          <SummaryTile label="Apartamentos envolvidos" value={activeUnits} tone="slate" />
          <SummaryTile label="Resultados na busca" value={visibleCount} tone={searchTerm ? 'amber' : 'slate'} />
        </div>
      </div>

      <div className="p-6">
        {hasPendingSync && (
          <div className="mb-4 bg-amber-950/20 border border-amber-900/30 p-3.5 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-500 leading-normal font-mono">
            <div className="flex items-start gap-2">
              <WifiOff size={14} className="text-amber-500 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <p className="font-bold uppercase tracking-wide">Pre-Gravacao Offline Detectada</p>
                <p className="text-slate-400 text-[11px]">Registros armazenados localmente e pendentes de sync no Sheets.</p>
              </div>
            </div>
            {isInternetOnline && (
              <button
                onClick={onForceSync}
                id="btn-force-sync-banner"
                className="self-start sm:self-center bg-amber-900/50 hover:bg-amber-950 text-amber-400 font-bold uppercase text-[9px] tracking-wider px-3 py-1.5 rounded-sm transition border border-amber-500/30 active:scale-95 cursor-pointer flex items-center gap-1 shrink-0"
              >
                <RefreshCw size={10} />
                <span>Transmitir Fila</span>
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start" id="active-visits-grid">
          <section aria-labelledby="active-visits-heading" className="min-w-0 rounded-sm border border-emerald-900/50 bg-slate-950/30">
            <div className="flex items-center justify-between gap-2 border-b border-emerald-900/40 px-4 py-3">
              <h3 id="active-visits-heading" className="flex items-center gap-2 font-bold text-emerald-400"><UserRound size={18} /> Visitas</h3>
              <span className="text-xs font-mono text-emerald-300">{filteredProviders.length} no local</span>
            </div>
            <div className="space-y-2 p-3">
              {filteredProviders.map(provider => (
                <div key={provider.id}><ActiveRecordButton id={`active-card-${provider.id}`} unit={provider.unit}
                  title={provider.name} subtitle={provider.company || provider.visitorType}
                  duration={getStayDuration(provider.entryTime)} timeLabel="Permanência" tone="emerald" syncStatus={provider.syncStatus}
                  onClick={() => setSelectedRecord({ kind: 'visit', id: provider.id })} /></div>
              ))}
              {filteredProviders.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">{searchTerm ? 'Nenhuma visita corresponde à busca.' : 'Nenhuma visita no local.'}</p>}
            </div>
          </section>
          <section aria-labelledby="active-deliveries-heading" className="min-w-0 rounded-sm border border-cyan-900/50 bg-slate-950/30">
            <div className="flex items-center justify-between gap-2 border-b border-cyan-900/40 px-4 py-3">
              <h3 id="active-deliveries-heading" className="flex items-center gap-2 font-bold text-cyan-300"><Package size={18} /> Entregas</h3>
              <span className="text-xs font-mono text-cyan-300">{filteredShopping.length} aguardando</span>
            </div>
            <div className="space-y-2 p-3">
              {filteredShopping.map(delivery => (
                <div key={delivery.id}><ActiveRecordButton id={`active-shopping-card-${delivery.id}`} unit={delivery.unit}
                  title={delivery.product || 'Mercadoria sem descrição'} subtitle={delivery.recipient || delivery.store || 'Destinatário não informado'}
                  duration={getStayDuration(delivery.receivedAt)} timeLabel="Aguardando" tone="cyan" syncStatus={delivery.syncStatus}
                  onClick={() => setSelectedRecord({ kind: 'shopping', id: delivery.id })} /></div>
              ))}
              {filteredShopping.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">{searchTerm ? 'Nenhuma entrega corresponde à busca.' : 'Nenhuma entrega aguardando retirada.'}</p>}
            </div>
          </section>
        </div>
      </div>

      {createPortal(
        <dialog ref={dialogRef} aria-labelledby="active-record-title"
          className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-lg border border-slate-700 bg-[#0a0d14] p-0 text-slate-100 shadow-2xl backdrop:bg-black/80"
          onClose={closeDetails}
          onCancel={event => {
            event.preventDefault();
            if (selectedPhoto) setSelectedPhoto(null);
            else if (withdrawalSession || withdrawalError) { setWithdrawalSession(null); setWithdrawalError(''); }
            else closeDetails();
          }}
          onClick={event => { if (event.target === event.currentTarget) closeDetails(); }}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
            <h3 id="active-record-title" className="font-bold">{selectedRecord?.kind === 'visit' ? 'Detalhes da visita' : 'Detalhes da entrega'}</h3>
            <button type="button" autoFocus onClick={closeDetails} aria-label="Fechar detalhes" className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400"><X size={20} /></button>
          </div>
          <div className="p-4">
            {(selectedVisit ? [selectedVisit] : []).map((provider) => (
              <div
                key={`visit-${provider.id}`}
                id={`visit-details-${provider.id}`}
                className={`border rounded-sm p-5 flex flex-col justify-between transition relative overflow-hidden bg-slate-950/40 ${
                  exitingId === `visit-${provider.id}`
                    ? 'border-emerald-500 bg-emerald-950/10 opacity-70'
                    : 'border-slate-800/80 hover:border-emerald-500/30 hover:bg-slate-950/80'
                }`}
              >
                {provider.syncStatus === 'pending' && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 px-2 py-0.5 rounded-bl font-mono font-bold text-[8px] flex items-center gap-1 uppercase tracking-wider">
                    <WifiOff size={8} /> LOCAL PENDENTE
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-start gap-4">
                    <div className="relative w-16 h-16 shrink-0">
                      {provider.photo ? (
                        <img
                          src={provider.photo}
                          alt={provider.name}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-sm object-cover border border-slate-800 cursor-pointer hover:opacity-85 transition-opacity"
                          onClick={() => setSelectedPhoto({ url: provider.photo!, name: provider.name, label: 'PRESTADOR' })}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-sm bg-emerald-950/30 border border-emerald-900/60 flex items-center justify-center text-emerald-400">
                          <UserRound size={24} />
                        </div>
                      )}
                      <div className="absolute -right-1 -bottom-1 w-5 h-5 rounded-sm bg-emerald-950 border border-emerald-500/50 text-emerald-300 flex items-center justify-center shadow-sm">
                        <UserRound size={12} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-lg text-white truncate" title={provider.name}>
                        {provider.name}
                      </p>
                      <div className="mt-1 inline-flex items-center gap-1 text-[9px] bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-sm uppercase font-mono font-bold leading-none">
                        <UserRound size={9} />
                        <span>Acesso</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono uppercase tracking-wide mt-1">
                        Doc: {provider.document}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-y border-slate-900/60 py-3 my-2">
                    <div className="min-w-0 bg-emerald-950/20 border border-emerald-500/20 rounded-sm p-3">
                      <div className="flex items-center gap-1.5 text-emerald-400 uppercase text-[9px] font-mono font-bold tracking-wider">
                        <Landmark size={13} className="shrink-0" />
                        <span>Destino</span>
                      </div>
                      <span className="block font-black text-2xl text-white truncate mt-1 leading-tight" title={provider.unit}>
                        {provider.unit}
                      </span>
                    </div>

                    <div className="min-w-0 bg-slate-950/60 border border-slate-800 rounded-sm p-3">
                      <div className="flex items-center gap-1.5 text-slate-400 uppercase text-[9px] font-mono font-bold tracking-wider">
                        <Clock size={13} className="text-emerald-400 shrink-0" />
                        <span>Permanencia</span>
                      </div>
                      <span className="block font-mono font-black text-2xl text-emerald-400 shrink-0 animate-pulse mt-1 leading-tight">
                        {getStayDuration(provider.entryTime)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0 sm:col-span-2">
                      <Briefcase size={12} className="text-slate-500 shrink-0" />
                      <span className="text-slate-500 shrink-0 uppercase text-[9px] font-mono">Servico:</span>
                      <span className="font-medium text-slate-300 truncate" title={provider.company}>
                        {provider.company} <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1 rounded-sm ml-1.5 uppercase font-mono">{provider.visitorType}</span>
                      </span>
                    </div>

                    {provider.licensePlate && (
                      <div className="flex items-center gap-1.5 col-span-2 min-w-0">
                        <Car size={12} className="text-slate-500 shrink-0" />
                        <span className="text-slate-500 shrink-0 uppercase text-[9px] font-mono">Veiculo:</span>
                        <span className="font-mono font-bold text-emerald-400 bg-slate-900/80 border border-slate-800 px-1.5 py-0.5 rounded-sm text-[10px]" id={`plate-${provider.id}`}>
                          {provider.licensePlate.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {provider.notes && (
                    <div className="text-[10px] text-slate-400 bg-slate-950 font-sans p-2 rounded-sm border border-slate-900 mt-1 flex items-start gap-1">
                      <FileText size={11} className="text-emerald-500 mt-0.5 shrink-0" />
                      <p className="italic leading-relaxed">"{provider.notes}"</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock size={9} />
                    <span>ENTRADA: {new Date(provider.entryTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} hs</span>
                  </div>

                  <button
                    id={`btn-exit-${provider.id}`}
                    onClick={() => handleExitClick(provider.id, provider.name)}
                    disabled={exitingId === `visit-${provider.id}`}
                    title="Registrar saida do condominio"
                    className="bg-emerald-950 hover:bg-emerald-900 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 transition-all font-bold text-[11px] uppercase tracking-wider px-4 py-2.5 rounded-sm flex items-center justify-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <LogOut size={11} />
                    <span>Registrar Saida</span>
                  </button>
                </div>
              </div>
            ))}

            {(selectedDelivery ? [selectedDelivery] : []).map((delivery) => (
              <div
                key={`shopping-${delivery.id}`}
                id={`delivery-details-${delivery.id}`}
                className={`border rounded-sm p-5 flex flex-col justify-between transition relative overflow-hidden bg-slate-950/40 ${
                  exitingId === `shopping-${delivery.id}`
                    ? 'border-cyan-500 bg-cyan-950/10 opacity-70'
                    : 'border-cyan-900/70 hover:border-cyan-500/30 hover:bg-slate-950/80'
                }`}
              >
                {delivery.syncStatus === 'pending' && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 px-2 py-0.5 rounded-bl font-mono font-bold text-[8px] flex items-center gap-1 uppercase tracking-wider">
                    <WifiOff size={8} /> LOCAL PENDENTE
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-start gap-4">
                    <div className="relative w-16 h-16 shrink-0">
                      {delivery.photo ? (
                        <img
                          src={delivery.photo}
                          alt={delivery.product}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-sm object-cover border border-slate-800 cursor-pointer hover:opacity-85 transition-opacity"
                          onClick={() => setSelectedPhoto({ url: delivery.photo!, name: delivery.product, label: 'PRODUTO' })}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-sm bg-cyan-950/30 border border-cyan-900/60 flex items-center justify-center text-cyan-300">
                          <Package size={24} />
                        </div>
                      )}
                      <div className="absolute -right-1 -bottom-1 w-5 h-5 rounded-sm bg-cyan-950 border border-cyan-500/50 text-cyan-300 flex items-center justify-center shadow-sm">
                        <Package size={12} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-lg text-white truncate" title={delivery.product || 'Mercadoria sem descricao'}>
                        {delivery.product || 'Mercadoria sem descricao'}
                      </p>
                      <div className="mt-1 inline-flex items-center gap-1 text-[9px] bg-cyan-950/50 border border-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded-sm uppercase font-mono font-bold leading-none">
                        <Package size={9} />
                        <span>Compra</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono uppercase tracking-wide mt-1">
                        Destinatario: {delivery.recipient || 'Nao informado'}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono uppercase tracking-wide mt-1">
                        Entregador: {delivery.courierName || 'Nao informado'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-y border-slate-900/60 py-3 my-2">
                    <div className="min-w-0 bg-cyan-950/20 border border-cyan-500/20 rounded-sm p-3">
                      <div className="flex items-center gap-1.5 text-cyan-300 uppercase text-[9px] font-mono font-bold tracking-wider">
                        <Landmark size={13} className="shrink-0" />
                        <span>Apartamento</span>
                      </div>
                      <span className="block font-black text-2xl text-white truncate mt-1 leading-tight" title={delivery.unit}>
                        {delivery.unit}
                      </span>
                    </div>

                    <div className="min-w-0 bg-slate-950/60 border border-slate-800 rounded-sm p-3">
                      <div className="flex items-center gap-1.5 text-slate-400 uppercase text-[9px] font-mono font-bold tracking-wider">
                        <Clock size={13} className="text-cyan-400 shrink-0" />
                        <span>Aguardando</span>
                      </div>
                      <span className="block font-mono font-black text-2xl text-cyan-400 shrink-0 animate-pulse mt-1 leading-tight">
                        {getStayDuration(delivery.receivedAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0 sm:col-span-2">
                      <Package size={12} className="text-cyan-400 shrink-0" />
                      <span className="text-slate-500 shrink-0 uppercase text-[9px] font-mono">Origem:</span>
                      <span className="font-medium text-slate-300 truncate" title={delivery.store}>
                        {delivery.store || 'Origem nao informada'} <span className="text-[9px] bg-cyan-950/50 border border-cyan-800/60 text-cyan-300 px-1 rounded-sm ml-1.5 uppercase font-mono">Compra</span>
                      </span>
                    </div>
                  </div>

                  {delivery.notes && (
                    <div className="text-[10px] text-slate-400 bg-slate-950 font-sans p-2 rounded-sm border border-slate-900 mt-1 flex items-start gap-1">
                      <FileText size={11} className="text-cyan-400 mt-0.5 shrink-0" />
                      <p className="italic leading-relaxed">"{delivery.notes}"</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock size={9} />
                    <span>RECEBIDA: {new Date(delivery.receivedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} hs</span>
                  </div>

                  <button
                    id={`btn-shopping-withdraw-${delivery.id}`}
                    onClick={() => handleShoppingWithdrawClick(delivery.id, delivery.unit)}
                    disabled={exitingId === `shopping-${delivery.id}`}
                    title="Registrar retirada da mercadoria"
                    className="bg-cyan-950 hover:bg-cyan-900 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 transition-all font-bold text-[11px] uppercase tracking-wider px-4 py-2.5 rounded-sm flex items-center justify-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <LogOut size={11} />
                    <span>Registrar Retirada</span>
                  </button>
                </div>
              </div>
            ))}
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
              REGISTRO FOTOGRAFICO PORTARIA
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

      {(withdrawalSession || withdrawalError) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-lg p-6 text-center text-[#172b35]">
            <button type="button" onClick={() => { setWithdrawalSession(null); setWithdrawalError(''); }} className="absolute right-3 top-3 text-slate-500" aria-label="Fechar"><X size={20} /></button>
            {withdrawalError ? (
              <><h3 className="font-bold text-red-700 mb-3">Não foi possível iniciar a retirada</h3><p className="text-sm">{withdrawalError}</p></>
            ) : withdrawalSession && (
              <>
                <h3 className="font-bold uppercase text-[#17495b]">Assinatura da retirada</h3>
                <p className="text-sm mt-1">Apartamento {withdrawalSession.unit}</p>
                <img src={withdrawalSession.qr} alt={`QR code ${withdrawalSession.code}`} className="w-72 h-72 max-w-full mx-auto" />
                <p className="font-mono text-3xl font-black tracking-[0.2em]">{withdrawalSession.code}</p>
                <p className={`text-sm mt-2 ${withdrawalSeconds > 0 ? 'text-slate-500' : 'text-red-600 font-bold'}`}>
                  {withdrawalSeconds > 0 ? `Expira em ${Math.floor(withdrawalSeconds / 60)}:${String(withdrawalSeconds % 60).padStart(2, '0')}` : 'Código expirado. Feche e gere um novo.'}
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500"><QrCode size={14} /> Selecione “Assinatura de entrega” no Android.</div>
              </>
            )}
          </div>
        </div>
      )}
        </dialog>, document.body
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'cyan' | 'amber' | 'slate' }) {
  const toneClasses = {
    emerald: 'border-emerald-500/25 bg-emerald-950/25 text-emerald-400',
    cyan: 'border-cyan-500/25 bg-cyan-950/25 text-cyan-300',
    amber: 'border-amber-500/25 bg-amber-950/25 text-amber-400',
    slate: 'border-slate-800 bg-slate-950/60 text-slate-300',
  };

  return (
    <div className={`border rounded-sm px-3 py-2.5 ${toneClasses[tone]}`}>
      <div className="text-[9px] uppercase tracking-widest font-mono font-bold opacity-75">{label}</div>
      <div className="text-2xl font-black leading-tight mt-0.5">{value}</div>
    </div>
  );
}

function ActiveRecordButton({ id, unit, title, subtitle, duration, timeLabel, tone, syncStatus, onClick }: {
  id: string; unit: string; title: string; subtitle: string; duration: string; timeLabel: string;
  tone: 'emerald' | 'cyan'; syncStatus: Visit['syncStatus']; onClick: () => void;
}) {
  const accent = tone === 'emerald' ? 'text-emerald-400' : 'text-cyan-300';
  const interactive = tone === 'emerald'
    ? 'hover:border-emerald-500/60 focus-visible:outline-emerald-400'
    : 'hover:border-cyan-500/60 focus-visible:outline-cyan-400';
  return (
    <button type="button" id={id} onClick={onClick} aria-haspopup="dialog"
      aria-label={`Abrir ${tone === 'emerald' ? 'visita' : 'entrega'}: ${title}, apartamento ${unit}, ${timeLabel.toLowerCase()} ${duration}`}
      className={`w-full rounded-sm border border-slate-800 bg-slate-950/60 p-3 text-left transition hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 ${interactive}`}>
      <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-wider text-slate-500">Apartamento</span>
          <span className="block break-words text-xl font-bold text-white">{unit || 'Não informado'}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[10px] uppercase tracking-wider text-slate-500">{timeLabel}</span>
          <span className={`flex items-center justify-end gap-1.5 font-mono text-lg font-bold ${accent}`}><Clock size={14} />{duration}</span>
        </span>
      </span>
      <span className="mt-2 flex items-center gap-2 border-t border-slate-800/60 pt-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-200" title={title}>{title}</span>
          <span className="block truncate text-xs text-slate-500" title={subtitle}>{subtitle}</span>
        </span>
        <ChevronRight size={16} className={accent} />
      </span>
      {syncStatus !== 'synced' && <span className="mt-2 flex items-center gap-1 text-[10px] text-amber-400"><WifiOff size={11} />{syncStatus === 'failed' ? 'Falha na sincronização' : 'Sincronização pendente'}</span>}
    </button>
  );
}
