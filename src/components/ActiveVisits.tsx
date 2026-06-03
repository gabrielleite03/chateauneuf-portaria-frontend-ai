/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, LogOut, Clock, Shield, Car, Briefcase, FileText, Landmark, User, WifiOff, RefreshCw } from 'lucide-react';
import { Visit } from '../types';

interface ActiveVisitsProps {
  visits: Visit[];
  onRegisterExit: (id: string) => Promise<void>;
  isInternetOnline: boolean;
  onForceSync: () => Promise<void>;
}

export default function ActiveVisits({ visits, onRegisterExit, isInternetOnline, onForceSync }: ActiveVisitsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; name: string } | null>(null);

  // Update current time every 30 seconds to refresh calculated stay duration
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const activeProviders = visits.filter(v => !v.exitTime);

  // Filter based on search term
  const filteredProviders = activeProviders.filter(v => {
    const q = searchTerm.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      v.document.toLowerCase().includes(q) ||
      v.company.toLowerCase().includes(q) ||
      v.unit.toLowerCase().includes(q) ||
      (v.licensePlate && v.licensePlate.toLowerCase().includes(q))
    );
  });

  // Calculate elapsed stay duration
  const getStayDuration = (entryTimeISO: string) => {
    const entry = new Date(entryTimeISO).getTime();
    const diffMs = currentTime - entry;
    
    if (diffMs < 0) return "0 minutos";

    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMinutes / 60);
    const remMinutes = diffMinutes % 60;

    if (diffHours === 0) {
      return `${remMinutes}m`;
    }
    return `${diffHours}h ${remMinutes}m`;
  };

  const handleExitClick = async (id: string, name: string) => {
    if (window.confirm(`Confirma a saída do prestador "${name}"?`)) {
      setExitingId(id);
      try {
        await onRegisterExit(id);
      } catch (err) {
        console.error("Failed to register checkout", err);
      } finally {
        setExitingId(null);
      }
    }
  };
  return (
    <div className="bg-[#0a0d14] rounded-sm border border-slate-800/40 overflow-hidden" id="card-active-visits">
      
      {/* Container Header */}
      <div className="bg-[#07090f] border-b border-slate-800/40 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0"></div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Visitas em Andamento</h2>
              <span className="font-mono text-xs font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-sm shrink-0" id="badge-active-count">
                {activeProviders.length} ATIVO{activeProviders.length !== 1 ? 'S' : ''}
              </span>
            </div>
            <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">Acompanhamento e registro de saída em tempo real</p>
          </div>
        </div>

        {/* Quick Search Bar */}
        <div className="relative w-full sm:w-64">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
            <Search size={12} />
          </span>
          <input
            type="text"
            placeholder="Filtrar por nome, apto, empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            id="input-filter-active"
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-xs focus:outline-none focus:border-emerald-500/50 outline-none transition placeholder-slate-600"
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6">
        
        {/* State of pending offline entries */}
        {visits.some(v => v.syncStatus === 'pending') && (
          <div className="mb-4 bg-amber-950/20 border border-amber-900/30 p-3.5 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-500 leading-normal font-mono">
            <div className="flex items-start gap-2">
              <WifiOff size={14} className="text-amber-500 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <p className="font-bold uppercase tracking-wide">Pre-Gravação Offline Detectada</p>
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

        {filteredProviders.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-800/60 rounded-sm" id="no-active-visits">
            <div className="w-10 h-10 rounded-full bg-slate-900/70 flex items-center justify-center text-slate-600 mx-auto mb-3">
              <Search size={18} />
            </div>
            <h3 className="text-xs uppercase font-bold tracking-widest text-slate-400">Nenhum prestador encontrado</h3>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {activeProviders.length === 0 
                ? "Nenhum profissional possui liberação em andamento no condomínio no momento."
                : "A busca não retornou dados correspondentes. Verifique a grafia do nome, bloco ou placa."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" id="active-visits-grid">
            {filteredProviders.map((provider) => (
              <div 
                key={provider.id} 
                id={`active-card-${provider.id}`}
                className={`border rounded-sm p-4 flex flex-col justify-between transition relative overflow-hidden bg-slate-950/40 ${
                  exitingId === provider.id 
                    ? 'border-emerald-500 bg-emerald-950/10 opacity-70' 
                    : 'border-slate-800/80 hover:border-emerald-500/30 hover:bg-slate-950/80'
                }`}
              >
                
                {/* Pending Offline tag */}
                {provider.syncStatus === 'pending' && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 px-2 py-0.5 rounded-bl font-mono font-bold text-[8px] flex items-center gap-1 uppercase tracking-wider">
                    <WifiOff size={8} /> LOCAL PENDENTE
                  </div>
                )}

                {/* Visitor Info Card Body */}
                <div className="space-y-3">
                  
                  {/* Visitor header */}
                  <div className="flex items-start gap-3">
                    {provider.photo ? (
                      <img 
                        src={provider.photo} 
                        alt={provider.name} 
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-sm object-cover border border-slate-800 shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                        onClick={() => setSelectedPhoto({ url: provider.photo!, name: provider.name })}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-sm bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 font-mono shrink-0 font-bold text-xs uppercase">
                        {provider.name.substring(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-white truncate" title={provider.name}>
                        {provider.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">
                        Doc: {provider.document}
                      </p>
                    </div>
                  </div>

                  {/* Core details line */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs border-y border-slate-900/60 py-2.5 my-2">
                    
                    {/* Destination */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Landmark size={12} className="text-slate-500 shrink-0" />
                      <span className="text-slate-500 shrink-0 uppercase text-[9px] font-mono">Destino:</span>
                      <span className="font-semibold text-slate-200 truncate" title={provider.unit}>
                        {provider.unit}
                      </span>
                    </div>

                    {/* Entrance elapsed stay */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock size={12} className="text-emerald-400 shrink-0" />
                      <span className="text-[#94a3b8]/70 shrink-0 uppercase text-[9px] font-mono">Permanência:</span>
                      <span className="font-mono font-bold text-emerald-400 shrink-0 animate-pulse">
                        {getStayDuration(provider.entryTime)}
                      </span>
                    </div>

                    {/* Company */}
                    <div className="flex items-center gap-1.5 min-w-0 col-span-2">
                      <Briefcase size={12} className="text-slate-500 shrink-0" />
                      <span className="text-slate-500 shrink-0 uppercase text-[9px] font-mono">Serviço:</span>
                      <span className="font-medium text-slate-300 truncate" title={provider.company}>
                        {provider.company} <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1 rounded-sm ml-1.5 uppercase font-mono">{provider.visitorType}</span>
                      </span>
                    </div>

                    {/* Vehicle plate if any */}
                    {provider.licensePlate && (
                      <div className="flex items-center gap-1.5 col-span-2 min-w-0">
                        <Car size={12} className="text-slate-500 shrink-0" />
                        <span className="text-slate-500 shrink-0 uppercase text-[9px] font-mono">Veículo:</span>
                        <span className="font-mono font-bold text-emerald-400 bg-slate-900/80 border border-slate-800 px-1.5 py-0.5 rounded-sm text-[10px]" id={`plate-${provider.id}`}>
                          {provider.licensePlate.toUpperCase()}
                        </span>
                      </div>
                    )}

                  </div>

                  {/* Comments notes if present */}
                  {provider.notes && (
                    <div className="text-[10px] text-slate-400 bg-slate-950 font-sans p-2 rounded-sm border border-slate-900 mt-1 flex items-start gap-1">
                      <FileText size={11} className="text-emerald-500 mt-0.5 shrink-0" />
                      <p className="italic leading-relaxed">
                        "{provider.notes}"
                      </p>
                    </div>
                  )}

                </div>

                {/* Checkout Trigger button */}
                <div className="mt-4 pt-3 border-t border-slate-900/60 flex items-center justify-between gap-2">
                  <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock size={9} />
                    <span>ENTRADA: {new Date(provider.entryTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} hs</span>
                  </div>
                  
                  <button
                    id={`btn-exit-${provider.id}`}
                    onClick={() => handleExitClick(provider.id, provider.name)}
                    disabled={exitingId === provider.id}
                    title="Registrar saída do condomínio"
                    className="bg-emerald-950 hover:bg-emerald-900 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 transition-all font-bold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-sm flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <LogOut size={11} />
                    <span>Registrar Saída</span>
                  </button>
                </div>

              </div>
            ))}
          </div>
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
              REGISTRO FOTOGRÁFICO PORTARIA
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
