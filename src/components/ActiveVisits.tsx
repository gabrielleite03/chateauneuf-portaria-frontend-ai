/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Briefcase, Car, Clock, FileText, Landmark, LogOut, Package, RefreshCw, Search, UserRound, WifiOff } from 'lucide-react';
import { ShoppingDelivery, Visit } from '../types';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; name: string; label: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const activeProviders = visits.filter(v => !v.exitTime);
  const activeShopping = shoppingDeliveries.filter(delivery => delivery.status === 'aguardando_retirada');
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

    if (diffMs < 0) return '0 minutos';

    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMinutes / 60);
    const remMinutes = diffMinutes % 60;

    if (diffHours === 0) {
      return `${remMinutes}m`;
    }
    return `${diffHours}h ${remMinutes}m`;
  };

  const handleExitClick = async (id: string, name: string) => {
    if (window.confirm(`Confirma a saida do prestador "${name}"?`)) {
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

  const handleShoppingWithdrawClick = async (id: string, unit: string, product: string) => {
    const productLabel = product || 'mercadoria';
    if (window.confirm(`Confirma a retirada da mercadoria "${productLabel}" do ${unit}?`)) {
      setExitingId(`shopping-${id}`);
      try {
        await onWithdrawShopping(id);
      } catch (err) {
        console.error('Failed to register shopping withdraw', err);
      } finally {
        setExitingId(null);
      }
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
              <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Visitas e Compras em Andamento</h2>
              <span className="font-mono text-xs font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-sm shrink-0" id="badge-active-count">
                {activeCount} ATIVO{activeCount !== 1 ? 'S' : ''}
              </span>
            </div>
            <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">Acompanhamento e registro de saida ou retirada em tempo real</p>
          </div>
        </div>

        <div className="relative w-full xl:w-[32rem]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
            <Search size={16} />
          </span>
          <input
            type="text"
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
          <SummaryTile label="Compras aguardando" value={activeShopping.length} tone="cyan" />
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

        {filteredProviders.length === 0 && filteredShopping.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-800/60 rounded-sm" id="no-active-visits">
            <div className="w-10 h-10 rounded-full bg-slate-900/70 flex items-center justify-center text-slate-600 mx-auto mb-3">
              <Search size={18} />
            </div>
            <h3 className="text-xs uppercase font-bold tracking-widest text-slate-400">Nenhum registro encontrado</h3>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {activeCount === 0
                ? 'Nenhum acesso ou compra aguardando atendimento no momento.'
                : 'A busca nao retornou dados correspondentes. Verifique a grafia do nome, apartamento, produto ou placa.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5" id="active-visits-grid">
            {filteredProviders.map((provider) => (
              <div
                key={`visit-${provider.id}`}
                id={`active-card-${provider.id}`}
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

            {filteredShopping.map((delivery) => (
              <div
                key={`shopping-${delivery.id}`}
                id={`active-shopping-card-${delivery.id}`}
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
                    onClick={() => handleShoppingWithdrawClick(delivery.id, delivery.unit, delivery.product)}
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
