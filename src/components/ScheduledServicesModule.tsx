/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  User, 
  CreditCard, 
  Building2, 
  CheckSquare, 
  Clock, 
  UserCheck, 
  Search, 
  Trash2, 
  Plus, 
  RefreshCw,
  X,
  Check,
  Camera,
  Upload,
  FileText,
  AlertCircle,
  Wrench,
  Ban,
  Activity
} from 'lucide-react';
import { ScheduledService } from '../types';

interface ScheduledServicesModuleProps {
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  isInternetOnline: boolean;
}

export default function ScheduledServicesModule({ showToast, isInternetOnline }: ScheduledServicesModuleProps) {
  // Main state lists
  const [schedules, setSchedules] = useState<ScheduledService[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'agendado' | 'realizado' | 'cancelado'>('todos');

  // Form states (Create Scheduled Service)
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [company, setCompany] = useState('');
  const [unit, setUnit] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check-In Photo & Webcam states for completing a schedule
  const [activeCheckInItem, setActiveCheckInItem] = useState<ScheduledService | null>(null);
  const [checkInPhoto, setCheckInPhoto] = useState<string | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; name: string } | null>(null);
  const [isProcessingCheckIn, setIsProcessingCheckIn] = useState(false);

  // Fetch schedules
  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/scheduled-services');
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      } else {
        showToast("Não foi possível carregar os agendamentos.", "error");
      }
    } catch {
      showToast("Erro ao conectar com o servidor.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const startWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }
      });
      setStream(mediaStream);
      setIsWebcamActive(true);
    } catch (err) {
      console.error("Error accessing webcam", err);
      showToast("Não foi possível acessar a webcam. Verifique se o dispositivo possui câmera ativa e permissão concedida.", "error");
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsWebcamActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCheckInPhoto(dataUrl);
        stopWebcam();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCheckInPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Turn off webcam tracks if component unmounts
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Bind live stream in video element when ready
  useEffect(() => {
    if (isWebcamActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [isWebcamActive, stream]);

  // Form submit handler
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!date) errors.date = 'Selecione a data agendada';
    if (!name.trim()) errors.name = 'Nome é obrigatório';
    if (!document.trim()) errors.document = 'Documento (RG/CPF) é obrigatório';
    if (!company.trim()) errors.company = 'Empresa/Serviço é obrigatória';
    if (!unit.trim()) errors.unit = 'Unidade/Destino é obrigatória';
    if (!authorizedBy.trim()) errors.authorizedBy = 'Autorizador é obrigatório';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast("Preencha todos os campos obrigatórios corretamente.", "error");
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/scheduled-services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date,
          name: name.trim(),
          document: document.trim(),
          company: company.trim(),
          unit: unit.trim(),
          authorizedBy: authorizedBy.trim(),
          notes: notes.trim() || undefined
        })
      });

      if (response.ok) {
        const newSchedule = await response.json();
        setSchedules(prev => [newSchedule, ...prev]);
        showToast(`Agendamento de ${name} salvo com sucesso!`, "success");
        // Reset Form
        setName('');
        setDocument('');
        setCompany('');
        setUnit('');
        setAuthorizedBy('');
        setNotes('');
        setDate(new Date().toISOString().split('T')[0]);
      } else {
        const errorData = await response.json();
        showToast(errorData.error || "Erro ao salvar agendamento.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao comunicar com o servidor.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Change trigger
  const handleUpdateStatus = async (id: string, status: 'realizado' | 'cancelado', photoUrl?: string) => {
    try {
      const arrivalTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // If status is 'realizado', we can optionally register this as a live entry in active visits
      let finalPhoto = photoUrl;

      const response = await fetch('/api/scheduled-services/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id,
          status,
          photo: finalPhoto,
          arrivalTime: status === 'realizado' ? arrivalTime : undefined
        })
      });

      if (response.ok) {
        const updated = await response.json();
        setSchedules(prev => prev.map(s => s.id === id ? updated : s));

        if (status === 'realizado') {
          showToast(`Check-In efetuado para ${updated.name}!`, "success");

          // PRO-FEATURE: Automatically log this entrance to the Main Active Visistors Log too!
          try {
            await fetch('/api/entry', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: updated.name,
                document: updated.document,
                company: updated.company,
                visitorType: 'Prestador de Serviço',
                unit: updated.unit.startsWith('Apto') ? updated.unit : `Apto ${updated.unit}`,
                notes: `Origem: Prestador Agendado. Obs: ${updated.notes || 'Nenhuma'} (Autorizado por: ${updated.authorizedBy})`,
                photo: finalPhoto || undefined
              })
            });
            showToast("Entrada integrada automaticamente no Painel de Controle Principal!", "success");
          } catch (err) {
            console.error("Failed auto integration of entry", err);
          }

        } else {
          showToast(`Agendamento de ${updated.name} foi cancelado.`, "warning");
        }
      } else {
        showToast("Erro ao atualizar o agendamento.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao conectar com o servidor.", "error");
    }
  };

  // Perform check-in (open dialog to capture photo/camera or complete directly)
  const triggerCheckIn = (item: ScheduledService) => {
    setActiveCheckInItem(item);
    setCheckInPhoto(null);
    setIsWebcamActive(false);
  };

  const confirmCheckIn = async () => {
    if (!activeCheckInItem) return;
    setIsProcessingCheckIn(true);
    await handleUpdateStatus(activeCheckInItem.id, 'realizado', checkInPhoto || undefined);
    setIsProcessingCheckIn(false);
    setActiveCheckInItem(null);
    setCheckInPhoto(null);
    stopWebcam();
  };

  // Delete Schedule
  const handleDeleteSchedule = async (id: string, providerName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o agendamento de ${providerName}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/scheduled-services/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      });

      if (response.ok) {
        setSchedules(prev => prev.filter(s => s.id !== id));
        showToast(`Agendamento de ${providerName} removido.`, "success");
      } else {
        showToast("Erro ao excluir agendamento.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao conectar com o servidor.", "error");
    }
  };

  // Filters application
  const filteredSchedules = schedules.filter(item => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      item.name.toLowerCase().includes(term) ||
      item.company.toLowerCase().includes(term) ||
      item.unit.toLowerCase().includes(term) ||
      item.document.toLowerCase().includes(term);

    const matchesDate = searchDate === '' || item.date === searchDate;

    const matchesStatus = statusFilter === 'todos' || item.status === statusFilter;

    return matchesSearch && matchesDate && matchesStatus;
  });

  return (
    <>
      <div id="prestadores-agendados-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Registration Scheduling Form */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800/80 rounded-lg p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 border-b border-slate-800/60 pb-4 mb-4">
              <div className="w-8 h-8 rounded-sm bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Wrench size={16} />
              </div>
              <div>
                <h3 className="font-mono font-bold text-xs uppercase tracking-widest text-[#eceff4]">
                  Novo Agendamento
                </h3>
                <p className="text-[10px] text-slate-500 font-mono uppercase mt-0.5">
                  Prestadores de Serviços Autorizados
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-4 font-mono text-xs">
              
              {/* DATE SELECTION */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                  <Calendar size={11} className="text-emerald-500" />
                  <span>Data Programada *</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full bg-slate-950 border ${formErrors.date ? 'border-red-500/50 text-red-400' : 'border-slate-800 text-slate-200'} rounded p-2 focus:outline-none focus:border-emerald-500 transition`}
                />
                {formErrors.date && <p className="text-[9px] text-red-500 uppercase mt-1 font-bold">{formErrors.date}</p>}
              </div>

              {/* NAME FIELDS */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                  <User size={11} className="text-emerald-500" />
                  <span>Nome do Prestador *</span>
                </label>
                <input
                  type="text"
                  placeholder="DIGITE O NOME COMPLETO..."
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  className={`w-full bg-slate-950 border ${formErrors.name ? 'border-red-500/50 text-red-400' : 'border-slate-800 text-slate-200'} rounded p-2 focus:outline-none focus:border-emerald-500 transition uppercase text-[11px]`}
                />
                {formErrors.name && <p className="text-[9px] text-red-500 uppercase mt-1 font-bold">{formErrors.name}</p>}
              </div>

              {/* DOCUMENT (RG/CPF) */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                  <CreditCard size={11} className="text-emerald-500" />
                  <span>Documento (RG / CPF) *</span>
                </label>
                <input
                  type="text"
                  placeholder="EX: 45.123.456-7 OU CPF..."
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  className={`w-full bg-slate-950 border ${formErrors.document ? 'border-red-500/50 text-red-400' : 'border-slate-800 text-slate-200'} rounded p-2 focus:outline-none focus:border-emerald-500 transition text-[11px]`}
                />
                {formErrors.document && <p className="text-[9px] text-red-500 uppercase mt-1 font-bold">{formErrors.document}</p>}
              </div>

              {/* SERVICE / COMPANY */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                  <Wrench size={11} className="text-emerald-500" />
                  <span>Empresa ou Serviço *</span>
                </label>
                <input
                  type="text"
                  placeholder="EX: CLARO, ELETRICISTA, ENEL, ETC."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className={`w-full bg-slate-950 border ${formErrors.company ? 'border-red-500/50 text-red-400' : 'border-slate-800 text-slate-200'} rounded p-2 focus:outline-none focus:border-emerald-500 transition text-[11px] uppercase`}
                />
                {formErrors.company && <p className="text-[9px] text-red-500 uppercase mt-1 font-bold">{formErrors.company}</p>}
              </div>

              {/* UNIT & AUTHORIZED BY */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                    <Building2 size={11} className="text-emerald-500" />
                    <span>Apto / Destino *</span>
                  </label>
                  <input
                    type="text"
                    placeholder="EX: 11"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className={`w-full bg-slate-950 border ${formErrors.unit ? 'border-red-500/50 text-red-400' : 'border-slate-800 text-slate-200'} rounded p-2 focus:outline-none focus:border-emerald-500 transition text-[11px]`}
                  />
                  {formErrors.unit && <p className="text-[9px] text-red-500 uppercase mt-1 font-bold">{formErrors.unit}</p>}
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                    <UserCheck size={11} className="text-emerald-500" />
                    <span>Autorizado Por *</span>
                  </label>
                  <input
                    type="text"
                    placeholder="EX: CARLOS ALBERTO"
                    value={authorizedBy}
                    onChange={(e) => setAuthorizedBy(e.target.value)}
                    className={`w-full bg-slate-950 border ${formErrors.authorizedBy ? 'border-red-500/50 text-red-400' : 'border-slate-800 text-slate-200'} rounded p-2 focus:outline-none focus:border-emerald-500 transition text-[11px] uppercase`}
                  />
                  {formErrors.authorizedBy && <p className="text-[9px] text-red-500 uppercase mt-1 font-bold">{formErrors.authorizedBy}</p>}
                </div>
              </div>

              {/* ADDITIONAL NOTES */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                  <FileText size={11} className="text-emerald-500" />
                  <span>Observações Adicionais</span>
                </label>
                <textarea
                  placeholder="EX: MANUTENÇÃO PREVENTIVA DE BANHEIRA, ENTRADA AUTORIZADA DAS 09H ÀS 17H..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded p-2 focus:outline-none focus:border-emerald-500 transition text-[11px] resize-none"
                />
              </div>

              {/* SUBMIT TRIGGER BUTTON */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs uppercase tracking-widest rounded transition active:scale-[0.99] cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={13} />
                      <span>Cadastrar Agendamento</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/40 text-[9px] text-slate-500 uppercase leading-relaxed font-mono">
            Agendamentos cadastrados aqui aparecem organizados por data. Ao realizar o check-in na portaria, o prestador é enviado para a lista geral de visitantes ativos.
          </div>
        </div>

        {/* RIGHT COLUMN: Filter and Scheduled Services List */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Filtering Header Box */}
          <div className="bg-[#07090f] border border-slate-900 rounded-lg p-4 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-md">
            
            {/* Search query input */}
            <div className="relative w-full sm:w-2/5">
              <span className="absolute top-2.5 left-3 pointer-events-none text-slate-500">
                <Search size={13} />
              </span>
              <input
                type="text"
                placeholder="BUSCAR PRESTADOR, EMPRESA..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-850 rounded pl-9 pr-3 py-2 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 transition focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Filter by target date */}
            <div className="w-full sm:w-1/4">
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-2 text-[10px] font-mono text-slate-400 hover:text-slate-200 transition focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Toggle tabs filter by status */}
            <div className="flex gap-1 bg-slate-950 p-1 border border-slate-850 rounded w-full sm:w-auto overflow-x-auto shrink-0">
              {(['todos', 'agendado', 'realizado', 'cancelado'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`text-[8px] font-mono font-bold uppercase tracking-wider py-1.5 px-2.5 rounded-sm transition shrink-0 cursor-pointer ${
                    statusFilter === status
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20'
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
                >
                  {status === 'todos' ? 'TODOS' : status}
                </button>
              ))}
            </div>

          </div>

          {/* Schedulings Cards Grid / List */}
          <div className="flex-1 min-h-[400px] bg-slate-900 border border-slate-800/60 rounded-lg p-5 shadow-inner relative overflow-y-auto max-h-[720px]">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw size={20} className="animate-spin text-emerald-400" />
                  <span>Carregando agendamentos...</span>
                </div>
              </div>
            ) : filteredSchedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-600 font-mono py-12">
                <AlertCircle size={28} className="text-slate-700 mb-2" />
                <p className="text-[10px] uppercase font-bold tracking-widest">Nenhum agendamento encontrado</p>
                <p className="text-[9px] uppercase mt-1 text-slate-700">Utilize o painel esquerdo para agendar um prestador.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                {filteredSchedules.map((item) => {
                  
                  // Setup status styling variations
                  let badgeColor = "bg-amber-950/40 text-amber-500 border border-amber-500/20";
                  let statusLabel = "Agendado";
                  if (item.status === 'realizado') {
                    badgeColor = "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20";
                    statusLabel = `Compareceu às ${item.arrivalTime || ''}`;
                  } else if (item.status === 'cancelado') {
                    badgeColor = "bg-red-950/40 text-red-500 border border-red-500/20";
                    statusLabel = "Cancelado";
                  }

                  // Check if scheduling is scheduled for today or in the past
                  const parsedItemDate = new Date(item.date + 'T00:00:00');
                  const parsedToday = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00');
                  const isToday = parsedItemDate.getTime() === parsedToday.getTime();
                  const isPast = parsedItemDate.getTime() < parsedToday.getTime() && item.status === 'agendado';

                  return (
                    <div 
                      key={item.id}
                      className={`border p-4 rounded bg-[#0a0d14] relative flex flex-col justify-between transition-all duration-300 hover:border-slate-750 ${
                        item.status === 'agendado' 
                          ? isToday 
                            ? 'border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.03)]' 
                            : isPast 
                              ? 'border-amber-500/20' 
                              : 'border-slate-800/80'
                          : 'border-slate-850 opacity-75'
                      }`}
                    >
                      {/* Top Header Row of Card */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-900">
                          <div>
                            <span className="text-[9px] text-slate-500 font-bold tracking-widest uppercase">
                              {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                            {isToday && item.status === 'agendado' && (
                              <span className="ml-1.5 bg-emerald-950/60 text-emerald-400 text-[7px] uppercase font-bold tracking-widest px-1 border border-emerald-500/20 rounded-xs">
                                Hoje
                              </span>
                            )}
                            {isPast && (
                              <span className="ml-1.5 bg-amber-950/60 text-amber-500 text-[7px] uppercase font-bold tracking-widest px-1 border border-amber-500/20 rounded-xs">
                                Expirado
                              </span>
                            )}
                          </div>
                          
                          {/* Status and Sync Flags */}
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs ${badgeColor}`}>
                              {statusLabel}
                            </span>
                            {item.syncStatus === 'pending' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Pendente de sincronização" />
                            )}
                          </div>
                        </div>

                        {/* Provider Detail Fields */}
                        <div className="space-y-1.5 text-[11px] mb-4">
                          <div className="flex items-start gap-1.5 text-white">
                            <User size={12} className="text-slate-500 shrink-0 mt-0.5" />
                            <div className="leading-tight font-bold">
                              {item.name}
                              <p className="text-[9px] font-normal text-slate-500 mt-0.5 uppercase tracking-wide">
                                DOC: {item.document}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-emerald-400">
                            <Wrench size={12} className="text-slate-500 shrink-0" />
                            <span className="uppercase font-bold tracking-wide">{item.company}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-1 text-[10px] uppercase text-slate-400 border-t border-slate-950 pt-2 mt-2">
                            <div>
                              <span className="text-slate-600 font-bold block text-[8px]">APTO DESTINO:</span>
                              <span className="text-slate-350 font-bold">AP {item.unit}</span>
                            </div>
                            <div>
                              <span className="text-slate-600 font-bold block text-[8px]">AUTORIZADO POR:</span>
                              <span className="text-slate-350 truncate block" title={item.authorizedBy}>{item.authorizedBy}</span>
                            </div>
                          </div>

                          {item.notes && (
                            <div className="bg-slate-950/40 border border-slate-900 p-2 rounded-xs text-[9px] text-slate-400 mt-2">
                              <span className="text-slate-600 font-bold block text-[8px] uppercase">OBSERVAÇÕES:</span>
                              {item.notes}
                            </div>
                          )}

                          {/* Completed Photo Preview inside scheduling log list */}
                          {item.photo && (
                            <div className="mt-3 relative w-full aspect-[4/2] rounded overflow-hidden bg-slate-950 border border-slate-850">
                              <img 
                                src={item.photo}
                                alt="Face morador"
                                className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                                referrerPolicy="no-referrer"
                                onClick={() => setSelectedPhoto({ url: item.photo || '', name: item.name })}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Decision Row (Actions) only available for 'agendado' state */}
                      <div className="flex items-center gap-2 border-t border-slate-900 pt-3 shrink-0">
                        {item.status === 'agendado' ? (
                          <>
                            <button
                              onClick={() => triggerCheckIn(item)}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 hover:text-white transition rounded-sm text-[9px] uppercase tracking-wider font-bold cursor-pointer"
                            >
                              <Check size={11} />
                              <span>Liberar / Check-In</span>
                            </button>

                            <button
                              onClick={() => handleUpdateStatus(item.id, 'cancelado')}
                              className="flex items-center justify-center gap-1 p-1.5 bg-red-950/20 hover:bg-red-900/40 border border-red-500/10 hover:border-red-500/30 text-red-400 transition rounded-sm text-[9px] cursor-pointer"
                              title="Cancelar Agendamento"
                            >
                              <Ban size={11} />
                            </button>
                          </>
                        ) : (
                          <div className="flex-1 flex items-center gap-1.5 text-[8px] text-slate-500 tracking-wide uppercase font-bold py-1">
                            <Activity size={10} className="text-slate-700" />
                            <span>Controle concluído pelo porteiro</span>
                          </div>
                        )}

                        <button
                          onClick={() => handleDeleteSchedule(item.id, item.name)}
                          className="p-1.5 bg-slate-950 hover:bg-red-950/40 border border-slate-850 hover:border-red-900/30 text-slate-500 hover:text-red-400 transition rounded-sm cursor-pointer ml-auto"
                          title="Excluir Definitivamente"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Lightbox photo viewing modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedPhoto(null)}
        >
          <div 
            className="relative max-w-sm w-full bg-slate-900 border border-slate-800 p-4 rounded-sm shadow-2xl font-mono text-xs animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="absolute top-2 right-3 text-slate-500 hover:text-white text-[10px] font-bold cursor-pointer transition"
              onClick={() => setSelectedPhoto(null)}
            >
              FECHAR [X]
            </button>
            <div className="mb-2 text-emerald-400 uppercase tracking-widest font-bold text-[9px]">
              REGISTRO FOTOGRÁFICO DO PRESTADOR
            </div>
            <img 
              src={selectedPhoto.url} 
              alt={selectedPhoto.name}
              referrerPolicy="no-referrer"
              className="w-full aspect-[4/3] object-cover border border-slate-800 bg-slate-950 rounded-sm"
            />
            <div className="mt-3 text-slate-200">
              <span className="text-slate-500 font-bold uppercase text-[10px]">PRESTADOR(A):</span> 
              <p className="font-bold text-sm text-white mt-0.5 uppercase tracking-wide">{selectedPhoto.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Check-In Webcam Capture & Confirm Modal */}
      {activeCheckInItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div 
            className="relative max-w-md w-full bg-[#07090f] border border-slate-800 p-5 rounded shadow-2xl font-mono text-xs space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Dialog */}
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div>
                <span className="text-emerald-400 font-bold uppercase text-[9px] tracking-widest block">CHECK-IN PORTARIA</span>
                <span className="text-white text-xs font-bold uppercase tracking-wide">
                  Autorizar {activeCheckInItem.name}
                </span>
              </div>
              <button 
                onClick={() => {
                  stopWebcam();
                  setActiveCheckInItem(null);
                }}
                className="text-slate-500 hover:text-white text-[10px] tracking-widest cursor-pointer font-bold"
              >
                FECHAR [X]
              </button>
            </div>

            {/* Webcam / photo registration */}
            <div className="border border-slate-800/40 rounded p-4 bg-slate-950/30 space-y-3">
              <label className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                Foto do Prestador <span className="text-slate-600 font-normal">(Recomendado no Check-In)</span>
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Photo Preview Frame */}
                <div className="relative w-40 h-32 bg-slate-950 border border-slate-850 flex items-center justify-center overflow-hidden rounded-sm shrink-0">
                  {isWebcamActive ? (
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                  ) : checkInPhoto ? (
                    <img 
                      src={checkInPhoto} 
                      alt="CheckIn Preview" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-700 text-center p-2.5">
                      <Camera size={20} className="mb-1 text-slate-700" />
                      <span className="text-[9px] uppercase tracking-wider font-bold">Sem Foto</span>
                    </div>
                  )}

                  {/* High Tech Framing Overlay */}
                  <div className="absolute inset-2 border border-slate-850/20 pointer-events-none rounded-xs"></div>
                  <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-emerald-500/50 pointer-events-none"></div>
                  <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-emerald-500/50 pointer-events-none"></div>
                  <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-emerald-500/50 pointer-events-none"></div>
                  <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-emerald-500/50 pointer-events-none"></div>
                </div>

                {/* Photo Controls */}
                <div className="flex-1 w-full space-y-2 flex flex-col justify-center">
                  {isWebcamActive ? (
                    <div className="flex flex-col gap-2 w-full">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-sm transition cursor-pointer"
                      >
                        <Camera size={12} />
                        <span>Capturar Foto</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopWebcam}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-250 text-[9px] uppercase tracking-wider rounded-sm transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 w-full">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={startWebcam}
                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 font-bold text-[9px] uppercase tracking-wider rounded-sm transition cursor-pointer"
                        >
                          <Camera size={11} />
                          <span>Câmera</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 font-bold text-[9px] uppercase tracking-wider rounded-sm transition cursor-pointer"
                        >
                          <Upload size={11} />
                          <span>Arquivo</span>
                        </button>
                      </div>

                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />

                      {checkInPhoto && (
                        <button
                          type="button"
                          onClick={() => setCheckInPhoto(null)}
                          className="flex items-center justify-center gap-1 py-1 px-3 bg-red-950/30 hover:bg-red-950/60 border border-red-900/30 hover:border-red-900 text-red-400 text-[9px] uppercase tracking-wider rounded-sm transition cursor-pointer"
                        >
                          Excluir Foto
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Complete or cancel operations */}
            <div className="flex gap-2.5 pt-2 border-t border-slate-900">
              <button
                type="button"
                onClick={() => {
                  stopWebcam();
                  setActiveCheckInItem(null);
                }}
                className="flex-1 py-2 px-3 border border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200 text-[10px] uppercase tracking-widest font-bold transition rounded-sm cursor-pointer"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={confirmCheckIn}
                disabled={isProcessingCheckIn}
                className="flex-[2_2_0%] py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] uppercase tracking-widest font-bold transition rounded-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isProcessingCheckIn ? (
                  <>
                    <RefreshCw size={11} className="animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <Check size={12} />
                    <span>Confirmar Entrada</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
