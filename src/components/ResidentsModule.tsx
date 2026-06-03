/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Home, User, Phone, Users, ShieldAlert, Edit3, Save, Search, RefreshCw, X, Check, Eye, Camera, Upload, Trash2 } from 'lucide-react';
import { Resident } from '../types';

interface ResidentsModuleProps {
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  isInternetOnline: boolean;
}

export default function ResidentsModule({ showToast, isInternetOnline }: ResidentsModuleProps) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected apartment for detail/editing
  const [selectedUnit, setSelectedUnit] = useState<string | null>("11");
  
  // Form editing states
  const [owner, setOwner] = useState('');
  const [phones, setPhones] = useState('');
  const [tenant, setTenant] = useState('');
  const [familyMembers, setFamilyMembers] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  // Building structure constants (8 floors x 4 apartments starting from 11 up to 84)
  const FLOORS = [8, 7, 6, 5, 4, 3, 2, 1];
  const UNITS_PER_FLOOR = ["1", "2", "3", "4"];

  // Fetch residents list
  const fetchResidents = async (showSilently = false) => {
    if (!showSilently) setLoading(true);
    try {
      const res = await fetch('/api/residents');
      if (res.ok) {
        const data = await res.json();
        setResidents(data);
        
        // Auto-fill form if a unit is selected
        const currentActive = selectedUnit || "11";
        const resObj = data.find((r: Resident) => r.unit === currentActive);
        if (resObj) {
          setOwner(resObj.owner || '');
          setPhones(resObj.phones || '');
          setTenant(resObj.tenant || '');
          setFamilyMembers(resObj.familyMembers || '');
          setPhoto(resObj.photo || null);
        }
      } else {
        showToast("Não foi possível carregar os moradores do servidor.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Falha de rede ao tentar carregar base de moradores.", "error");
    } finally {
      if (!showSilently) setLoading(false);
    }
  };

  useEffect(() => {
    fetchResidents();
  }, []);

  // Update form inputs when selectedUnit changes
  useEffect(() => {
    stopWebcam();
    if (selectedUnit) {
      const resObj = residents.find(r => r.unit === selectedUnit);
      if (resObj) {
        setOwner(resObj.owner || '');
        setPhones(resObj.phones || '');
        setTenant(resObj.tenant || '');
        setFamilyMembers(resObj.familyMembers || '');
        setPhoto(resObj.photo || null);
        setErrors({});
      } else {
        // Safe default fallback
        setOwner('');
        setPhones('');
        setTenant('');
        setFamilyMembers('');
        setPhoto(null);
        setErrors({});
      }
    }
  }, [selectedUnit, residents]);

  // Handle unit selection
  const handleSelectUnit = (unitNum: string) => {
    setSelectedUnit(unitNum);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!owner.trim()) {
      newErrors.owner = "O proprietário é um campo obrigatório para controle cadastral.";
    }
    if (!phones.trim()) {
      newErrors.phones = "Informe pelo menos um telefone ou canal de contato rápido.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit/Update resident details
  const handleSaveResident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const payload = {
        unit: selectedUnit,
        owner: owner.trim(),
        phones: phones.trim(),
        tenant: tenant.trim() || undefined,
        familyMembers: familyMembers.trim() || undefined,
        photo: photo || undefined
      };

      const res = await fetch('/api/residents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        setResidents(prev => prev.map(r => r.unit === selectedUnit ? updated : r));
        
        if (isInternetOnline) {
          showToast(`Moradores do Apto ${selectedUnit} salvos e integrados na planilha!`, 'success');
        } else {
          showToast(`Moradores do Apto ${selectedUnit} gravados no SQLite (Modo Offline).`, 'warning');
        }
        
        // Refresh silently from backend to make sure logs and synchronization counter reflect changes
        fetchResidents(true);
      } else {
        showToast("Erro ao tentar gravar dados do morador no servidor local.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Não foi possível conectar com o backend Go local.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Check if a resident object is fully populated or empty
  const getResidentStatus = (resObj?: Resident) => {
    if (!resObj) return 'empty';
    if (!resObj.owner && !resObj.tenant) return 'empty';
    return 'registered';
  };

  // Text-based filtering for searching residents
  const filteredResidentsList = residents.filter(r => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return (
      r.unit.toLowerCase().includes(term) ||
      (r.owner && r.owner.toLowerCase().includes(term)) ||
      (r.phones && r.phones.toLowerCase().includes(term)) ||
      (r.tenant && r.tenant.toLowerCase().includes(term)) ||
      (r.familyMembers && r.familyMembers.toLowerCase().includes(term))
    );
  });

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="com-moradores-module">
      
      {/* Left Column: Tower Grid and Search */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        
        {/* Search and Metadata Bar */}
        <div className="bg-[#0a0d14] rounded-sm p-4 border border-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0"></div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">Controle de Ocupação</h3>
              <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">Torre Única • 32 Unidades (4 por andar)</p>
            </div>
          </div>
          
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
              <Search size={12} />
            </span>
            <input
              type="text"
              placeholder="Pesquisar por apto, nome, tel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-xs focus:outline-none focus:border-emerald-500/50 transition placeholder-slate-600 font-mono"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute inset-y-0 right-0 py-1.5 px-2.5 flex items-center text-slate-500 hover:text-slate-300 transition"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* The tower visualization */}
        <div className="bg-[#0a0d14] rounded-sm border border-slate-800/40 overflow-hidden">
          
          {/* Header */}
          <div className="bg-[#07090f] border-b border-slate-800/40 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Home size={14} className="text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Torre do Châteauneuf</h2>
            </div>
            
            <div className="flex items-center gap-4 text-[9px] uppercase font-mono tracking-wider text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-emerald-950 border border-emerald-500/40 rounded-sm"></div>
                <span>Cadastrado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-slate-950 border border-slate-800 rounded-sm"></div>
                <span>Em Aberto</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2 font-mono text-xs">
                <RefreshCw size={20} className="animate-spin text-emerald-400" />
                <span>Carregando topologia do edifício...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 font-mono">
                {FLOORS.map((floorNum) => {
                  return (
                    <div 
                      key={floorNum} 
                      className="grid grid-cols-12 items-center border border-slate-900 bg-slate-950/20 p-2 rounded-sm gap-2 hover:border-slate-800/50 transition"
                    >
                      {/* Floor Indicator Label */}
                      <div className="col-span-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider text-center border-r border-slate-900">
                        {floorNum}º AND
                      </div>
                      
                      {/* Apartment Units in the floor */}
                      <div className="col-span-10 grid grid-cols-4 gap-2">
                        {UNITS_PER_FLOOR.map((unitSuffix) => {
                          const aptNumber = `${floorNum}${unitSuffix}`;
                          const residentInfo = residents.find(r => r.unit === aptNumber);
                          const status = getResidentStatus(residentInfo);
                          const isSelected = selectedUnit === aptNumber;
                          
                          // Quick match search filter highlight
                          const isMatch = searchTerm 
                            ? filteredResidentsList.some(r => r.unit === aptNumber)
                            : true;

                          let btnClasses = "p-2 rounded-sm border transition text-left cursor-pointer relative ";
                          let indicatorClasses = "w-1.5 h-1.5 rounded-full absolute top-1.5 right-1.5 ";
                          
                          if (isSelected) {
                            btnClasses += "bg-emerald-950/40 border-emerald-500 text-[#030508] text-emerald-400 font-bold ";
                          } else if (!isMatch) {
                            btnClasses += "bg-[#04060b]/20 border-slate-950 text-slate-700 pointer-events-none opacity-20 ";
                          } else if (status === 'registered') {
                            btnClasses += "bg-[#070b12] hover:bg-slate-900 border-emerald-900/30 text-white ";
                          } else {
                            btnClasses += "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-500 border-dashed ";
                          }

                          if (status === 'registered') {
                            indicatorClasses += "bg-emerald-500 animate-pulse";
                          } else {
                            indicatorClasses += "bg-slate-800";
                          }

                          return (
                            <button
                              key={aptNumber}
                              onClick={() => handleSelectUnit(aptNumber)}
                              disabled={!isMatch && !!searchTerm}
                              title={
                                status === 'registered' 
                                  ? `Apto ${aptNumber} - ${residentInfo?.tenant || residentInfo?.owner}` 
                                  : `Apto ${aptNumber} - Sem registro ativo`
                              }
                              className={btnClasses}
                              id={`apt-block-${aptNumber}`}
                            >
                              <div className="flex items-center gap-1.5">
                                {residentInfo?.photo && (
                                  <img 
                                    src={residentInfo.photo} 
                                    alt="Morador" 
                                    referrerPolicy="no-referrer"
                                    className="w-4 h-4 rounded-full object-cover border border-slate-800 shrink-0"
                                  />
                                )}
                                <div className="text-[11px] font-bold">AP {aptNumber}</div>
                              </div>
                              <div className="text-[8px] uppercase truncate max-w-full text-slate-400 mt-1 block">
                                {status === 'registered' 
                                  ? (residentInfo?.tenant || residentInfo?.owner)
                                  : 'Sem Cadastro'}
                              </div>
                              <span className={indicatorClasses}></span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="bg-[#05060a] px-6 py-3 border-t border-slate-900 text-slate-500 text-[9px] font-mono leading-relaxed">
            <span className="font-bold text-emerald-400 uppercase tracking-widest block mb-0.5">[MAPA ESTRUTURAL]</span>
            Clique em qualquer unidade acima para preencher, atualizar ou auditar a ficha de ocupação residente no local.
          </div>
        </div>

      </div>

      {/* Right Column: Detail / Registration Form */}
      <div className="lg:col-span-5">
        {selectedUnit ? (
          <div className="bg-[#0a0d14] rounded-sm border border-slate-800/40 overflow-hidden" id="card-resident-editor">
            
            {/* Header */}
            <div className="bg-[#07090f] border-b border-slate-800/40 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0"></div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">Ficha de Ocupação</h3>
                  <p className="text-[9px] text-[#34d399] font-mono uppercase mt-0.5">Apartamento {selectedUnit}</p>
                </div>
              </div>
              <div className="text-[9px] bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded-sm uppercase">
                Edição Registrada
              </div>
            </div>

            <form onSubmit={handleSaveResident} className="p-6 flex flex-col gap-5 text-xs font-mono">
              
              {/* APARTAMENTO INDICATOR (Read-Only) */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">Unidade Local (Apto)</label>
                <div className="w-full bg-slate-950 border border-slate-900 px-3 py-2 text-white font-bold rounded-sm cursor-not-allowed select-none">
                  Apartamento {selectedUnit} — Bloco Único
                </div>
              </div>

              {/* OWNER (PROPRIETÁRIO) */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5 flex justify-between">
                  <span>Proprietário Legal *</span>
                  {errors.owner && <span className="text-red-400 text-[8px] font-normal lowercase">{errors.owner}</span>}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <User size={13} />
                  </span>
                  <input
                    type="text"
                    name="owner"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="Nome completo do proprietário"
                    className={`w-full pl-9 pr-3 py-2 bg-slate-950 border text-slate-100 rounded-sm text-xs focus:outline-none focus:border-emerald-500/50 transition placeholder-slate-700 ${
                      errors.owner ? 'border-red-500/50' : 'border-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* PHONES (TELEFONES) */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5 flex justify-between">
                  <span>Telefones de Contato *</span>
                  {errors.phones && <span className="text-red-400 text-[8px] font-normal lowercase">{errors.phones}</span>}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <Phone size={13} />
                  </span>
                  <input
                    type="text"
                    name="phones"
                    value={phones}
                    onChange={(e) => setPhones(e.target.value)}
                    placeholder="(DDD) XXXXX-XXXX / WhatsApp"
                    className={`w-full pl-9 pr-3 py-2 bg-slate-950 border text-slate-100 rounded-sm text-xs focus:outline-none focus:border-emerald-500/50 transition placeholder-slate-700 ${
                      errors.phones ? 'border-red-500/50' : 'border-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* TENANT (INQUILINO) */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
                  Inquilino Atual <span className="text-slate-650 text-[9px] font-normal lowercase">(se alugado)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <User size={13} className="opacity-60" />
                  </span>
                  <input
                    type="text"
                    name="tenant"
                    value={tenant}
                    onChange={(e) => setTenant(e.target.value)}
                    placeholder="Nome completo do locatário atual"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-xs focus:outline-none focus:border-emerald-500/50 transition placeholder-slate-700"
                  />
                </div>
              </div>

              {/* FAMILY MEMBERS (FAMILIARES) */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5 flex justify-between">
                  <span>Familiares / Moradores Adicionais</span>
                </label>
                <div className="relative">
                  <span className="absolute top-2.5 left-3 pointer-events-none text-slate-500">
                    <Users size={13} />
                  </span>
                  <textarea
                    name="familyMembers"
                    rows={3}
                    value={familyMembers}
                    onChange={(e) => setFamilyMembers(e.target.value)}
                    placeholder="Nomes, vínculos de parentesco, funcionários ou outros residentes permanentes desta unidade"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-xs focus:outline-none focus:border-emerald-500/50 transition placeholder-slate-700 leading-normal"
                  />
                </div>
              </div>

              {/* CAPTURA DE FOTO */}
              <div className="border border-slate-800/40 rounded p-4 bg-slate-950/20 space-y-3">
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Foto do Morador Principal <span className="text-slate-600 font-normal">(Opcional)</span>
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
                        className="w-full h-full object-cover cursor-pointer hover:opacity-85 transition-opacity" 
                        referrerPolicy="no-referrer"
                        onClick={() => setSelectedPhoto({ url: photo, name: tenant || owner || `Morador Apto ${selectedUnit}` })}
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
                      Armazene a foto do morador principal ou inquilino para auxiliar na identificação visual rápida na portaria.
                    </p>
                  </div>

                </div>
              </div>

              {/* SAVE BUTTON */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  id="btn-save-resident"
                  className="w-full py-2.5 bg-emerald-950 border border-emerald-500/30 text-[#030508] text-emerald-400 hover:text-white font-mono hover:bg-emerald-900 font-bold uppercase tracking-widest rounded-sm cursor-pointer transition active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Gravando...</span>
                    </>
                  ) : (
                    <>
                      <Save size={13} />
                      <span>Salvar Cadastro</span>
                    </>
                  )}
                </button>
              </div>

            </form>

            {/* Last Updated Timestamp from API */}
            {residents.find(r => r.unit === selectedUnit)?.lastUpdated && (
              <div className="bg-[#05060a]/50 p-3 border-t border-slate-900 text-[9px] text-slate-500 font-mono text-center">
                Última alteração: {new Date(residents.find(r => r.unit === selectedUnit)!.lastUpdated!).toLocaleString('pt-BR')}
              </div>
            )}
            
          </div>
        ) : (
          <div className="bg-[#0a0d14] rounded-sm border border-slate-800/40 p-8 text-center" id="empty-resident-details">
            <User size={24} className="text-slate-600 mx-auto mb-3 opacity-40 animate-pulse" />
            <h3 className="text-xs uppercase font-bold tracking-widest text-[#94a3b8]">Detalhes do Apartamento</h3>
            <p className="text-[10px] text-slate-500 font-mono mt-1">Nenhum apartamento selecionado. Escolha um número na torre ao lado para visualizar a ficha cadastral.</p>
          </div>
        )}
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
              REGISTRO FOTOGRÁFICO MORADOR
            </div>
            <img 
              src={selectedPhoto.url} 
              alt={selectedPhoto.name}
              referrerPolicy="no-referrer"
              className="w-full aspect-[4/3] object-cover border border-slate-800 bg-slate-950 rounded-sm"
            />
            <div className="mt-3 text-slate-200">
              <span className="text-slate-500 font-bold uppercase text-[10px]">MORADOR(A):</span> 
              <p className="font-bold text-sm text-white mt-0.5 uppercase tracking-wide">{selectedPhoto.name}</p>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
