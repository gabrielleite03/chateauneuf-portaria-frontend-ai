/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Calendar, 
  User, 
  CreditCard, 
  Building2, 
  CheckSquare, 
  Clock, 
  UserCheck, 
  Search, 
  LogOut, 
  Plus, 
  RefreshCw,
  Archive,
  ArrowRight,
  Database,
  Camera,
  Upload,
  Trash2
} from 'lucide-react';
import { DiaristaEntry } from '../types';
import { cameraAccessErrorMessage } from '../utils/camera';

interface DiaristasModuleProps {
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  isInternetOnline: boolean;
}

export default function DiaristasModule({ showToast, isInternetOnline }: DiaristasModuleProps) {
  // Main data list
  const [entries, setEntries] = useState<DiaristaEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [rg, setRg] = useState('');
  const [unit, setUnit] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [entryTime, setEntryTime] = useState('');
  const [gatekeeper, setGatekeeper] = useState('Porteiro de Plantão');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photo & Webcam states
  const [photo, setPhoto] = useState<string | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; name: string } | null>(null);

  const startWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }
      });
      setStream(mediaStream);
      setIsWebcamActive(true);
    } catch (err) {
      console.error("Error accessing webcam", err);
      showToast(cameraAccessErrorMessage(err), "error");
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
        setPhoto(dataUrl);
        stopWebcam();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
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

  // Exit modification states
  const [editingExitId, setEditingExitId] = useState<string | null>(null);
  const [customExitTime, setCustomExitTime] = useState('');

  // Fetch all diarista log files from express backend
  const fetchEntries = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch('/api/diaristas');
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      } else {
        showToast("Falha ao carregar registros de diaristas.", "error");
      }
    } catch (err) {
      showToast("Erro ao conectar com o servidor.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    // Auto fill correct local HH:MM time
    const updateTime = () => {
      const now = new Date();
      const HH = String(now.getHours()).padStart(2, '0');
      const MM = String(now.getMinutes()).padStart(2, '0');
      setEntryTime(`${HH}:${MM}`);
    };
    updateTime();
  }, []);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Nome é obrigatório.";
    if (!rg.trim()) errors.rg = "RG é obrigatório.";
    if (!unit.trim()) errors.unit = "Número do apartamento é obrigatório.";
    if (!authorizedBy.trim()) errors.authorizedBy = "Quem autorizou é obrigatório.";
    if (!date) errors.date = "Data é obrigatória.";
    if (!entryTime) errors.entryTime = "Hora da entrada é obrigatória.";
    if (!gatekeeper.trim()) errors.gatekeeper = "Porteiro responsável é obrigatório.";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast("Por favor, preencha todos os campos obrigatórios.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/diaristas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date,
          name: name.trim(),
          rg: rg.trim(),
          unit: unit.trim().toUpperCase(),
          authorizedBy: authorizedBy.trim(),
          entryTime,
          gatekeeper: gatekeeper.trim(),
          photo: photo || undefined
        })
      });

      if (response.ok) {
        showToast(`Entrada da diarista ${name} registrada com sucesso!`, "success");
        // Clear fields, reset time
        setName('');
        setRg('');
        setUnit('');
        setAuthorizedBy('');
        setPhoto(null);
        const now = new Date();
        const HH = String(now.getHours()).padStart(2, '0');
        const MM = String(now.getMinutes()).padStart(2, '0');
        setEntryTime(`${HH}:${MM}`);
        setDate(new Date().toISOString().split('T')[0]);
        setFormErrors({});
        // Reload entries
        fetchEntries(true);
      } else {
        const errData = await response.json();
        showToast(errData.error || "Erro ao registrar diarista.", "error");
      }
    } catch (err) {
      showToast("Erro de conexão ao tentar registrar diarista.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckout = async (id: string, customTime?: string) => {
    const now = new Date();
    const HH = String(now.getHours()).padStart(2, '0');
    const MM = String(now.getMinutes()).padStart(2, '0');
    const timeToSave = customTime || `${HH}:${MM}`;

    try {
      const response = await fetch('/api/diaristas/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, exitTime: timeToSave })
      });

      if (response.ok) {
        showToast("Saída de diarista registrada com sucesso!", "success");
        setEditingExitId(null);
        setCustomExitTime('');
        fetchEntries(true);
      } else {
        const err = await response.json();
        showToast(err.error || "Erro ao realizar checkout.", "error");
      }
    } catch (err) {
      showToast("Erro ao tentar registrar saída no servidor.", "error");
    }
  };

  // Filter lists
  const activeEntries = entries.filter(e => !e.exitTime);
  const archivedEntries = entries.filter(e => e.exitTime);

  // Apply search filtering on archived list or general list
  const filteredArchive = archivedEntries.filter(e => {
    const matchesKeyword = e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           e.unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           e.rg.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = searchDate ? e.date === searchDate : true;
    return matchesKeyword && matchesDate;
  });

  return (
    <>
      <div id="controle-diaristas-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* LEFT COLUMN: Registration Form */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800/80 rounded-lg p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500"></div>
        
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-sm">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-slate-100">
              Registrar Entrada de Diarista
            </h2>
            <p className="text-[10px] text-slate-400 font-mono">CADASTRO DIÁRIO DE LIMPEZA E SERVIÇOS</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          
          {/* Data */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
              Data da Visita *
            </label>
            <div className="relative">
              <span className="absolute top-2.5 left-3 pointer-events-none text-slate-500">
                <Calendar size={13} />
              </span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full pl-9 pr-3 bg-slate-950 border ${formErrors.date ? 'border-red-500/60' : 'border-slate-800'} text-slate-100 p-2 text-xs rounded-sm focus:border-emerald-500/50 outline-none`}
              />
            </div>
            {formErrors.date && <p className="text-[10px] text-red-400 mt-1">{formErrors.date}</p>}
          </div>

          {/* Nome */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
              Nome Completo da Diarista *
            </label>
            <div className="relative">
              <span className="absolute top-2.5 left-3 pointer-events-none text-slate-500">
                <User size={13} />
              </span>
              <input
                type="text"
                placeholder="Ex: Maria das Graças Silva"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full pl-9 pr-3 bg-slate-950 border ${formErrors.name ? 'border-red-500/60' : 'border-slate-800'} text-slate-100 p-2 text-xs placeholder:text-slate-600 rounded-sm focus:border-emerald-500/50 outline-none`}
              />
            </div>
            {formErrors.name && <p className="text-[10px] text-red-400 mt-1">{formErrors.name}</p>}
          </div>

          {/* RG */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
              RG / Documento Identificador *
            </label>
            <div className="relative">
              <span className="absolute top-2.5 left-3 pointer-events-none text-slate-500">
                <CreditCard size={13} />
              </span>
              <input
                type="text"
                placeholder="Ex: 50.123.456-7"
                required
                value={rg}
                onChange={(e) => setRg(e.target.value)}
                className={`w-full pl-9 pr-3 bg-slate-950 border ${formErrors.rg ? 'border-red-500/60' : 'border-slate-800'} text-slate-100 p-2 text-xs placeholder:text-slate-600 rounded-sm focus:border-emerald-500/50 outline-none`}
              />
            </div>
            {formErrors.rg && <p className="text-[10px] text-red-400 mt-1">{formErrors.rg}</p>}
          </div>

          {/* Apartment Selector & Quick Select Panel */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
              Apartamento Destino *
            </label>
            <div className="relative">
              <span className="absolute top-2.5 left-3 pointer-events-none text-slate-500">
                <Building2 size={13} />
              </span>
              <input
                type="text"
                placeholder="Ex: Apto 11, Apto 32"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={`w-full pl-9 pr-3 bg-slate-950 border ${formErrors.unit ? 'border-red-500/60' : 'border-slate-800'} text-slate-100 p-2 text-xs placeholder:text-slate-600 rounded-sm focus:border-emerald-500/50 outline-none`}
              />
            </div>
            
            {/* Quick selectors matching building from 11 to 84 */}
            <div className="mt-2 flex flex-wrap gap-1">
              {["11", "22", "34", "51", "74", "84"].map(u => (
                <button
                  type="button"
                  key={u}
                  onClick={() => setUnit(`Apto ${u}`)}
                  className="px-1.5 py-0.5 bg-slate-950 hover:bg-slate-800 text-[9px] text-slate-400 hover:text-slate-200 border border-slate-850 rounded-sm transition cursor-pointer"
                >
                  Apto {u}
                </button>
              ))}
            </div>
            {formErrors.unit && <p className="text-[10px] text-red-400 mt-1">{formErrors.unit}</p>}
          </div>

          {/* Authorized By */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
              Autorizado por (Morador / Responsável) *
            </label>
            <div className="relative">
              <span className="absolute top-2.5 left-3 pointer-events-none text-slate-500">
                <UserCheck size={13} />
              </span>
              <input
                type="text"
                placeholder="Ex: Carlos Alberto (Proprietário)"
                required
                value={authorizedBy}
                onChange={(e) => setAuthorizedBy(e.target.value)}
                className={`w-full pl-9 pr-3 bg-slate-950 border ${formErrors.authorizedBy ? 'border-red-500/60' : 'border-slate-800'} text-slate-100 p-2 text-xs placeholder:text-slate-600 rounded-sm focus:border-emerald-500/50 outline-none`}
              />
            </div>
            {formErrors.authorizedBy && <p className="text-[10px] text-red-400 mt-1">{formErrors.authorizedBy}</p>}
          </div>

          {/* Time & Porteiro Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
                Hora da Entrada *
              </label>
              <div className="relative">
                <span className="absolute top-2.5 left-3 pointer-events-none text-slate-500">
                  <Clock size={13} />
                </span>
                <input
                  type="text"
                  placeholder="Ex: 08:00"
                  required
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  className={`w-full pl-9 pr-3 bg-slate-950 border ${formErrors.entryTime ? 'border-red-500/60' : 'border-slate-800'} text-slate-100 p-2 text-xs rounded-sm focus:border-emerald-500/50 outline-none`}
                />
              </div>
              {formErrors.entryTime && <p className="text-[10px] text-red-400 mt-1">{formErrors.entryTime}</p>}
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
                Porteiro de Plantão *
              </label>
              <div className="relative">
                <span className="absolute top-2.5 left-3 pointer-events-none text-slate-500">
                  <CheckSquare size={13} />
                </span>
                <input
                  type="text"
                  placeholder="Ex: Manuel"
                  required
                  value={gatekeeper}
                  onChange={(e) => setGatekeeper(e.target.value)}
                  className={`w-full pl-9 pr-3 bg-slate-950 border ${formErrors.gatekeeper ? 'border-red-500/60' : 'border-slate-800'} text-slate-100 p-2 text-xs rounded-sm focus:border-emerald-500/50 outline-none`}
                />
              </div>
              {formErrors.gatekeeper && <p className="text-[10px] text-red-400 mt-1">{formErrors.gatekeeper}</p>}
            </div>
          </div>

          {/* CAPTURA DE FOTO */}
          <div className="border border-slate-800/40 rounded p-4 bg-slate-950/20 space-y-3">
            <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Foto da Diarista <span className="text-slate-600 font-normal">(Opcional)</span>
            </label>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              
              {/* Photo or WebCam Preview Box */}
              <div className="relative w-40 h-32 bg-slate-950 border border-slate-850 flex items-center justify-center overflow-hidden rounded-sm shrink-0">
                {isWebcamActive ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                ) : photo ? (
                  <img 
                    src={photo} 
                    alt="Preview" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-700 font-mono text-center p-2.5">
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

              {/* Webcam Controls */}
              <div className="flex-1 w-full space-y-2 flex flex-col justify-center">
                {isWebcamActive ? (
                  <div className="flex flex-col gap-2 w-full">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[10px] uppercase tracking-wider rounded-sm transition cursor-pointer"
                    >
                      <Camera size={12} />
                      <span>Capturar Foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopWebcam}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-mono text-[9px] uppercase tracking-wider rounded-sm transition cursor-pointer"
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
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 font-mono font-bold text-[10px] uppercase tracking-wider rounded-sm transition cursor-pointer"
                      >
                        <Camera size={12} />
                        <span>Câmera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 font-mono font-bold text-[10px] uppercase tracking-wider rounded-sm transition cursor-pointer"
                      >
                        <Upload size={12} />
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

                    {photo && (
                      <button
                        type="button"
                        onClick={() => setPhoto(null)}
                        className="flex items-center justify-center gap-1 py-1 px-3 bg-red-950/30 hover:bg-red-950/60 border border-red-900/30 hover:border-red-900 text-red-400 font-mono text-[9px] uppercase tracking-wider rounded-sm transition cursor-pointer"
                      >
                        <Trash2 size={10} />
                        <span>Excluir Foto</span>
                      </button>
                    )}
                  </div>
                )}

                <p className="text-[8px] text-slate-600 font-mono leading-relaxed uppercase">
                  Utilize a câmera do dispositivo ou selecione um arquivo de imagem para armazenar o registro.
                </p>
              </div>

            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              id="submit-diarista-form"
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-slate-50 py-2.5 px-4 font-mono font-bold text-xs uppercase tracking-widest rounded-sm transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <Plus size={13} />
                  <span>Registrar Entrada</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>

      {/* RIGHT COLUMN: Active List & Search Log */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        
        {/* TOP: Active Diaristas */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-500"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
              <div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-slate-100">
                  Diaristas Ativas no Condomínio (Trabalhando)
                </h3>
                <p className="text-[10px] text-slate-400 font-mono">ATUALIZAÇÃO EM TEMPO REAL</p>
              </div>
            </div>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-slate-950 border border-slate-800 text-amber-400 rounded-sm">
              {activeEntries.length} PRESENTES
            </span>
          </div>

          {activeEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-950 border border-slate-950 rounded-sm">
              <UserCheck size={20} className="text-slate-700 mb-2" />
              <p className="font-mono text-xs text-slate-400 font-bold uppercase tracking-wider">Nenhuma diarista ativa</p>
              <p className="font-mono text-[10px] text-slate-600 mt-1">Todas as prestadoras registraram a saída.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {activeEntries.map((item) => (
                <div 
                  key={item.id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-sm transition"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {item.photo ? (
                      <img 
                        src={item.photo} 
                        alt={item.name} 
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-sm object-cover border border-slate-800 shrink-0 cursor-pointer hover:opacity-85 transition-opacity pointer-events-auto"
                        onClick={() => setSelectedPhoto({ url: item.photo!, name: item.name })}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-sm bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 font-mono shrink-0 font-bold text-xs uppercase">
                        {item.name.substring(0, 2)}
                      </div>
                    )}
                    <div className="space-y-1 font-mono text-xs min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 uppercase truncate" title={item.name}>{item.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 rounded-xs uppercase tracking-wider">
                          {item.unit}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 text-[10px] text-slate-400">
                        <div>
                          <span className="text-slate-600 uppercase font-bold">RG:</span> {item.rg}
                        </div>
                        <div>
                          <span className="text-slate-600 uppercase font-bold">AUTORIZADO POR:</span> <span className="text-slate-300">{item.authorizedBy}</span>
                        </div>
                        <div>
                          <span className="text-slate-600 uppercase font-bold">ENTRADA:</span> <span className="text-emerald-400 font-bold">{item.entryTime}</span>
                        </div>
                        <div>
                          <span className="text-slate-600 uppercase font-bold">PORTEIRO:</span> {item.gatekeeper}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Checkout Actions */}
                  <div className="sm:self-center flex items-center gap-1">
                    {editingExitId === item.id ? (
                      <div className="flex items-center gap-1.5 bg-slate-900 p-1 border border-slate-800 rounded-sm">
                        <input
                          type="text"
                          placeholder="HH:MM"
                          value={customExitTime}
                          onChange={(e) => setCustomExitTime(e.target.value)}
                          className="w-14 bg-slate-950 border border-slate-800 text-[10px] text-slate-200 text-center p-1 font-mono outline-none focus:border-amber-500/50"
                        />
                        <button
                          onClick={() => handleCheckout(item.id, customExitTime)}
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[9px] rounded-xs uppercase tracking-wider transition cursor-pointer"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingExitId(null)}
                          className="px-1 py-1 hover:bg-slate-800 text-slate-400 text-[9px] uppercase tracking-wider rounded-xs cursor-pointer"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          id={`checkout-diarista-instant-${item.id}`}
                          onClick={() => handleCheckout(item.id)}
                          className="flex items-center gap-1 py-1.5 px-3.5 bg-slate-900 border border-dashed border-slate-800 hover:border-amber-500/50 hover:bg-amber-950/20 text-slate-300 hover:text-amber-400 font-bold text-[10px] uppercase tracking-widest rounded-sm transition cursor-pointer"
                        >
                          <LogOut size={11} />
                          <span>Saída Agora</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            setEditingExitId(item.id);
                            const now = new Date();
                            setCustomExitTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                          }}
                          className="p-1.5 hover:bg-slate-900 hover:text-slate-200 text-slate-500 rounded-sm transition text-[10px] cursor-pointer font-bold uppercase tracking-wider"
                          title="Definir hora de saída manual"
                        >
                          Aj. Hora
                        </button>
                      </>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}

        </div>

        {/* BOTTOM: Search Ledger History */}
        <div className="flex-1 bg-slate-900 border border-slate-800/80 rounded-lg p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-slate-800"></div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-950/60 text-slate-400 border border-slate-850 rounded-sm">
                <Archive size={14} />
              </div>
              <div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-slate-100">
                  Histórico Geral de Diaristas
                </h3>
                <p className="text-[10px] text-slate-400 font-mono">REGISTROS LOGADOS E ARQUIVADOS</p>
              </div>
            </div>

            {/* Quick reload tracker */}
            <button 
              onClick={() => fetchEntries()}
              disabled={isLoading}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-slate-200 font-mono font-bold uppercase tracking-wider rounded-sm transition cursor-pointer"
            >
              <RefreshCw size={9} className={isLoading ? "animate-spin" : ""} />
              <span>Atualizar</span>
            </button>
          </div>

          {/* Search tool block */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="relative">
              <span className="absolute top-2.5 left-3 pointer-events-none text-slate-500">
                <Search size={13} />
              </span>
              <input
                type="text"
                placeholder="Pesquisar por nome, apto, rg..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 bg-slate-950 border border-slate-800 text-[11px] text-slate-200 font-mono p-2 rounded-sm focus:border-emerald-500/50 outline-none placeholder:text-slate-600"
              />
            </div>

            <div className="relative">
              <span className="absolute top-2.5 left-3 pointer-events-none text-slate-500">
                <Calendar size={13} />
              </span>
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="w-full pl-9 pr-3 bg-slate-950 border border-slate-800 text-[11px] text-slate-200 font-mono p-2 rounded-sm focus:border-emerald-500/50 outline-none"
              />
              {searchDate && (
                <button 
                  onClick={() => setSearchDate('')}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 font-bold text-[10px] cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Table list representation */}
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw size={18} className="text-emerald-500 animate-spin" />
            </div>
          ) : filteredArchive.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-950 border border-slate-950 rounded-sm">
              <Database size={18} className="text-slate-800 mb-2" />
              <p className="font-mono text-xs text-slate-500 font-bold uppercase tracking-wider">Nenhum registro no histórico</p>
              <p className="font-mono text-[10px] text-slate-600 mt-1">Experimente remover filtros para expandir a busca.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-850 rounded-sm max-h-[300px] overflow-y-auto">
              <table className="w-full text-left border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                    <th className="p-2.5">Data</th>
                    <th className="p-2.5">Diarista</th>
                    <th className="p-2.5">Apto</th>
                    <th className="p-2.5">Autorizado Por</th>
                    <th className="p-2.5">Entrada</th>
                    <th className="p-2.5">Saída</th>
                    <th className="p-2.5">Porteiro</th>
                    <th className="p-2.5 text-right w-[70px]">Nuvem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredArchive.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-950/60 text-slate-300 transition">
                      <td className="p-2.5 whitespace-nowrap text-slate-400 font-bold">
                        {entry.date ? entry.date.split('-').reverse().join('/') : '-'}
                      </td>
                      <td className="p-2.5 font-bold text-slate-100 uppercase">
                        <div className="flex items-center gap-2">
                          {entry.photo ? (
                            <img 
                              src={entry.photo} 
                              alt={entry.name} 
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-sm object-cover border border-slate-800 shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                              onClick={() => setSelectedPhoto({ url: entry.photo!, name: entry.name })}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-sm bg-slate-905 border border-slate-850/60 flex items-center justify-center text-slate-600 font-mono shrink-0 font-bold text-[8px] uppercase">
                              S/FOTO
                            </div>
                          )}
                          <div>
                            <div>{entry.name}</div>
                            <div className="text-[9px] text-slate-500 font-normal">RG: {entry.rg}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5 font-bold text-slate-200">{entry.unit}</td>
                      <td className="p-2.5 text-slate-400">{entry.authorizedBy}</td>
                      <td className="p-2.5 text-emerald-400 font-bold">{entry.entryTime}</td>
                      <td className="p-2.5 text-amber-500 font-bold">{entry.exitTime || '-'}</td>
                      <td className="p-2.5 text-slate-400">{entry.gatekeeper}</td>
                      <td className="p-2.5 text-right whitespace-nowrap">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          entry.syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-amber-400'
                        }`} title={entry.syncStatus === 'synced' ? "Sincronizado" : "Pendente"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>

    </div>

      {/* Lightbox / Modal for full photo preview */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in"
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
              REGISTRO FOTOGRÁFICO DIARISTA
            </div>
            <img 
              src={selectedPhoto.url} 
              alt={selectedPhoto.name}
              referrerPolicy="no-referrer"
              className="w-full aspect-[4/3] object-cover border border-slate-800 bg-slate-950 rounded-sm"
            />
            <div className="mt-3 text-slate-200">
              <span className="text-slate-500 font-bold uppercase text-[10px]">DIARISTA:</span> 
              <p className="font-bold text-sm text-white mt-0.5 uppercase tracking-wide">{selectedPhoto.name}</p>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
