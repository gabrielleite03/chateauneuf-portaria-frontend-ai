/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Key, 
  User, 
  MapPin, 
  Building2, 
  Clock, 
  Trash2, 
  Plus, 
  RefreshCw,
  X,
  Check,
  Search,
  Filter,
  UserCheck,
  Calendar
} from 'lucide-react';
import { KeyRecord } from '../types';

interface KeyControlModuleProps {
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  isInternetOnline: boolean;
}

export default function KeyControlModule({ showToast, isInternetOnline }: KeyControlModuleProps) {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'retirada' | 'devolvida'>('todos');

  // Form states
  const [local, setLocal] = useState('');
  const [residentName, setResidentName] = useState('');
  const [unit, setUnit] = useState('');
  const [pickupTime, setPickupTime] = useState(() => {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  });
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [gatekeeper, setGatekeeper] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch key records
  const fetchKeys = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      } else {
        showToast("Não foi possível carregar o controle de chaves.", "error");
      }
    } catch {
      showToast("Erro ao conectar com o servidor.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreateKeyRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!local.trim()) errors.local = 'Local ou área é obrigatório';
    if (!residentName.trim()) errors.residentName = 'Nome do morador é obrigatório';
    if (!unit.trim()) errors.unit = 'Apartamento/Unidade é obrigatório';
    if (!pickupTime.trim()) errors.pickupTime = 'Hora de entrega é obrigatório';
    if (!gatekeeper.trim()) errors.gatekeeper = 'Porteiro responsável é obrigatório';
    if (!date) errors.date = 'Selecione a data';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast("Por favor, preencha todos os campos obrigatórios.", "warning");
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          local: local.trim(),
          residentName: residentName.trim(),
          unit: unit.trim(),
          pickupTime: pickupTime.trim(),
          gatekeeper: gatekeeper.trim()
        })
      });

      if (res.ok) {
        const newRecord = await res.json();
        setKeys(prev => [newRecord, ...prev]);
        showToast(`Retirada de chave para ${local} cadastrada com sucesso!`, 'success');
        
        // Reset form except gatekeeper and date for easier double entry
        setLocal('');
        setResidentName('');
        setUnit('');
        setPickupTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      } else {
        const errData = await res.json();
        showToast(errData.error || "Erro ao salvar registro de chave.", "error");
      }
    } catch {
      showToast("Falha na comunicação com o servidor.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnKey = async (id: string) => {
    const defaultTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const promptTime = prompt("Confirme a hora de devolução da chave (HH:MM):", defaultTime);
    
    if (promptTime === null) return; // cancelled
    
    try {
      const res = await fetch('/api/keys/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          returnTime: promptTime.trim() || defaultTime
        })
      });

      if (res.ok) {
        const updatedRecord = await res.json();
        setKeys(prev => prev.map(k => k.id === id ? updatedRecord : k));
        showToast("Devolução de chave registrada com sucesso!", "success");
      } else {
        showToast("Não foi possível registrar a devolução.", "error");
      }
    } catch {
      showToast("Erro ao conectar ao servidor.", "error");
    }
  };

  const handleDeleteRecord = async (id: string, localName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o registro de chave para "${localName}"?`)) return;

    try {
      const res = await fetch('/api/keys/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (res.ok) {
        setKeys(prev => prev.filter(k => k.id !== id));
        showToast("Registro de controle excluído com sucesso.", "success");
      } else {
        showToast("Erro ao excluir do servidor.", "error");
      }
    } catch {
      showToast("Não foi possível excluir o registro.", "error");
    }
  };

  // Filter records
  const filteredKeys = keys.filter(k => {
    const matchSearch = 
      k.local.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.residentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.gatekeeper.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchStatus = 
      statusFilter === 'todos' || 
      k.status === statusFilter;

    return matchSearch && matchStatus;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="key-control-module">
      
      {/* CADASTRO FORM - 4 Columns on lg */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-md backdrop-blur-sm shadow-xl" id="card-key-registration">
          <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-800">
            <div className="p-2 bg-amber-500/10 text-amber-505 rounded-sm">
              <Key size={18} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold tracking-wider text-slate-200 uppercase">
                Nova Entrega de Chave
              </h2>
              <p className="text-[10px] text-slate-500 font-mono uppercase">
                Controle de Saída de Chaves Comuns
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateKeyRecord} className="space-y-4">
            
            {/* DATA */}
            <div className="space-y-1">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Data
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                  <Calendar size={13} />
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 bg-slate-950 border text-slate-100 rounded-sm text-xs focus:outline-none focus:border-amber-500/50 transition font-mono ${
                    formErrors.date ? 'border-red-500' : 'border-slate-800'
                  }`}
                />
              </div>
              {formErrors.date && <p className="text-[9px] text-red-400 font-mono uppercase">{formErrors.date}</p>}
            </div>

            {/* LOCAL / AREA */}
            <div className="space-y-1">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Local / Dependência
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                  <MapPin size={13} />
                </span>
                <input
                  type="text"
                  placeholder="Ex: Salão de Festas, Academia, Copa"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 bg-slate-950 border text-slate-100 rounded-sm text-xs focus:outline-none focus:border-amber-500/50 transition font-mono ${
                    formErrors.local ? 'border-red-500' : 'border-slate-800'
                  }`}
                />
              </div>
              {formErrors.local && <p className="text-[9px] text-red-400 font-mono uppercase">{formErrors.local}</p>}
            </div>

            {/* APARTAMENTO & MORADOR */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-1">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Apto
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-500">
                    <Building2 size={13} />
                  </span>
                  <input
                    type="text"
                    placeholder="12"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className={`w-full pl-8 pr-2 py-2 bg-slate-950 border text-slate-100 rounded-sm text-xs text-center focus:outline-none focus:border-amber-500/50 transition font-mono ${
                      formErrors.unit ? 'border-red-500' : 'border-slate-800'
                    }`}
                  />
                </div>
                {formErrors.unit && <p className="text-[9px] text-red-400 font-mono uppercase">{formErrors.unit}</p>}
              </div>

              <div className="col-span-2 space-y-1">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Morador / Solicitante
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <User size={13} />
                  </span>
                  <input
                    type="text"
                    placeholder="Nome completo do morador"
                    value={residentName}
                    onChange={(e) => setResidentName(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 bg-slate-950 border text-slate-100 rounded-sm text-xs focus:outline-none focus:border-amber-500/50 transition font-mono ${
                      formErrors.residentName ? 'border-red-500' : 'border-slate-800'
                    }`}
                  />
                </div>
                {formErrors.residentName && <p className="text-[9px] text-red-400 font-mono uppercase">{formErrors.residentName}</p>}
              </div>
            </div>

            {/* HORA ENTREGA & PORTEIRO */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Hora Entrega
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <Clock size={13} />
                  </span>
                  <input
                    type="text"
                    placeholder="14:30"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 bg-slate-950 border text-slate-100 rounded-sm text-xs focus:outline-none focus:border-amber-500/50 transition font-mono ${
                      formErrors.pickupTime ? 'border-red-500' : 'border-slate-800'
                    }`}
                  />
                </div>
                {formErrors.pickupTime && <p className="text-[9px] text-red-400 font-mono uppercase">{formErrors.pickupTime}</p>}
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Porteiro Entrada
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <UserCheck size={13} />
                  </span>
                  <input
                    type="text"
                    placeholder="Nome do porteiro"
                    value={gatekeeper}
                    onChange={(e) => setGatekeeper(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 bg-slate-950 border text-slate-100 rounded-sm text-xs focus:outline-none focus:border-amber-500/50 transition font-mono ${
                      formErrors.gatekeeper ? 'border-red-500' : 'border-slate-800'
                    }`}
                  />
                </div>
                {formErrors.gatekeeper && <p className="text-[9px] text-red-400 font-mono uppercase">{formErrors.gatekeeper}</p>}
              </div>
            </div>

            <button
              id="btn-save-key-record"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase tracking-widest py-3 px-4 rounded-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-900/20"
            >
              <Plus size={14} />
              <span>{isSubmitting ? "Cadastrando..." : "Registrar Saída"}</span>
            </button>

          </form>
        </div>
      </div>

      {/* LISTA & MONITOREO - 8 Columns on lg */}
      <div className="lg:col-span-8 flex flex-col space-y-4">
        
        {/* FILTER BAR */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-3 rounded-md flex flex-col md:flex-row gap-3 items-center justify-between" id="filter-bar-key-control">
          
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Buscar por local, morador ou apto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-xs focus:outline-none focus:border-amber-500/30 transition placeholder-slate-700 font-mono"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto shrink-0">
            <div className="flex bg-slate-950 p-1 border border-slate-850 rounded-sm w-full md:w-auto">
              {(['todos', 'retirada', 'devolvida'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatusFilter(option)}
                  className={`flex-1 md:flex-none font-mono text-[9px] font-bold uppercase tracking-wider py-1 px-3 rounded-xs transition cursor-pointer ${
                    statusFilter === option
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-slate-500 hover:text-slate-350 border border-transparent'
                  }`}
                >
                  {option === 'todos' ? 'Todos' : option === 'retirada' ? 'Retiradas' : 'Devolvidas'}
                </button>
              ))}
            </div>

            <button
              onClick={fetchKeys}
              title="Sincronizar"
              disabled={isLoading}
              className="p-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-sm shadow-sm transition shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin text-amber-500' : ''} />
            </button>
          </div>

        </div>

        {/* LIST / TABLE CARD */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-md overflow-hidden flex-1 shadow-lg flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20">
              <RefreshCw size={24} className="animate-spin text-amber-500 mb-2" />
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                Carregando chaves cadastradas...
              </p>
            </div>
          ) : filteredKeys.length > 0 ? (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left" id="table-keys-list">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[9px] uppercase font-mono text-slate-550 font-bold tracking-wider">
                    <th className="py-3 px-4">Local da Chave</th>
                    <th className="py-3 px-4">Morador Solicitante</th>
                    <th className="py-3 px-4 text-center">Unidade</th>
                    <th className="py-3 px-4">Retirada (Hora)</th>
                    <th className="py-3 px-4">Devolução (Hora)</th>
                    <th className="py-3 px-4">Porteiro</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-xs">
                  {filteredKeys.map((key) => {
                    const isReturned = key.status === 'devolvida';
                    return (
                      <tr 
                        key={key.id} 
                        className={`hover:bg-slate-950/20 transition ${
                          !isReturned ? 'bg-amber-950/5' : ''
                        }`}
                      >
                        {/* LOCAL */}
                        <td className="py-3 px-4 font-mono">
                          <div className="flex items-center gap-1.5">
                            <Key size={12} className={isReturned ? 'text-slate-500' : 'text-amber-400'} />
                            <span className="font-bold text-slate-205">{key.local}</span>
                          </div>
                        </td>

                        {/* MORADOR */}
                        <td className="py-3 px-4 text-slate-300 font-mono">
                          {key.residentName}
                        </td>

                        {/* UNIT */}
                        <td className="py-3 px-4 text-center font-mono">
                          <span className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 font-bold text-slate-400 rounded-sm text-[10px]">
                            Apto {key.unit}
                          </span>
                        </td>

                        {/* PICKUP */}
                        <td className="py-3 px-4 text-slate-300 font-mono">
                          <div className="flex flex-col">
                            <span className="font-bold">{key.pickupTime}</span>
                            <span className="text-[9px] text-slate-500">{key.date}</span>
                          </div>
                        </td>

                        {/* RETURN */}
                        <td className="py-3 px-4 font-mono">
                          {isReturned ? (
                            <span className="text-emerald-400 font-bold">{key.returnTime}</span>
                          ) : (
                            <span className="text-amber-500 text-[10px] uppercase font-bold tracking-wider px-1 bg-amber-500/10 border border-amber-500/20 rounded-xs">
                              Retirada
                            </span>
                          )}
                        </td>

                        {/* PORTEIRO */}
                        <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">
                          {key.gatekeeper}
                        </td>

                        {/* ACTIONS */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex gap-2">
                            {!isReturned && (
                              <button
                                onClick={() => handleReturnKey(key.id)}
                                title="Registrar Devolução"
                                className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-mono text-[9px] uppercase font-bold tracking-wider rounded-sm transition cursor-pointer flex items-center gap-1"
                              >
                                <Check size={10} />
                                <span>Devolver</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteRecord(key.id, key.local)}
                              title="Excluir Registro"
                              className="p-1 text-slate-500 hover:text-red-400 rounded-sm hover:bg-slate-950/40 transition cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-full text-slate-600 mb-3">
                <Key size={32} />
              </div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">
                Nenhum registro de chave encontrado
              </h3>
              <p className="text-[10px] text-slate-600 font-mono uppercase max-w-sm leading-relaxed">
                Tente alterar os termos de pesquisa ou registrar uma nova saída no formulário lateral.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
