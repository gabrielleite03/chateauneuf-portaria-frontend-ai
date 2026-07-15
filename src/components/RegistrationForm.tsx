/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, BookOpen, AlertCircle, CheckCircle2, ShieldCheck, Landmark, Tag, Car, FileText, Camera, Upload, Trash2 } from 'lucide-react';
import { Visit } from '../types';
import { cameraAccessErrorMessage } from '../utils/camera';

interface RegistrationFormProps {
  onRegister: (data: Omit<Visit, 'id' | 'entryTime' | 'syncStatus'>) => Promise<Visit | null>;
  isInternetOnline: boolean;
}

export default function RegistrationForm({ onRegister, isInternetOnline }: RegistrationFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    company: '',
    visitorType: 'Visitante' as 'Visitante' | 'Prestador de Serviço' | 'Fornecedor' | 'Outro',
    unit: '',
    licensePlate: '',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [registeredItem, setRegisteredItem] = useState<Visit | null>(null);

  // Photo & Webcam states
  const [photo, setPhoto] = useState<string | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });
      setStream(mediaStream);
      setIsWebcamActive(true);
    } catch (err) {
      console.error("Error accessing webcam", err);
      setErrors(prev => ({
        ...prev,
        form: cameraAccessErrorMessage(err)
      }));
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsWebcamActive(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      const width = videoRef.current.videoWidth || 1280;
      const height = videoRef.current.videoHeight || 720;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, width, height);
        const dataUrl = await resizeImageDataUrl(canvas.toDataURL('image/jpeg', 0.9));
        setPhoto(dataUrl);
        stopWebcam();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          setPhoto(await resizeImageDataUrl(reader.result as string));
        } catch (err) {
          console.error('Failed to resize uploaded visitor photo', err);
          setErrors(prev => ({ ...prev, form: 'Nao foi possivel reduzir a foto selecionada.' }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Turn off webcam tracks if component unmounts or stream changes
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Bind live stream immediately upon video render state update
  useEffect(() => {
    if (isWebcamActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [isWebcamActive, stream]);

  // Quick helper lists for fast click auto-complete (matching new apartment format 11 to 84)
  const quickUnits = ["Apto 11", "Apto 32", "Apto 54", "Cobertura", "Portaria", "Área Comum"];
  const quickCompanies = ["Pinturas Sul", "Gás Inspector", "Conserta Tudo", "Elevadores Otis", "Jardinagem Silva"];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for field on change
    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  // Nice document mask/sanitizer
  const formatDocument = (val: string) => {
    // Basic formatting for RG or CPF if user wants it, or keep clean
    return val;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'O nome do prestador é obrigatório.';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Por favor, informe o nome completo.';
    }

    if (!formData.document.trim()) {
      newErrors.document = 'O documento (RG / CPF) é obrigatório.';
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'Informe o destino (Apto, bloco ou área comum).';
    }

    // License plate validator (optional, but if filled, check basic length rule)
    if (formData.licensePlate.trim() && formData.licensePlate.trim().length < 7) {
      newErrors.licensePlate = 'Placa inválida (deve ter pelo menos 7 caracteres).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSuccessMessage(null);
    setRegisteredItem(null);

    try {
      const cleanData = {
        name: formData.name.trim(),
        document: formData.document.trim(),
        company: formData.company.trim(),
        visitorType: formData.visitorType,
        unit: formData.unit.trim(),
        licensePlate: formData.licensePlate.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        photo: photo || undefined
      };

      const result = await onRegister(cleanData);

      if (result) {
        setRegisteredItem(result);
        if (isInternetOnline) {
          setSuccessMessage(`Entrada de "${result.name}" registrada com sucesso e sincronizada com à nuvem!`);
        } else {
          setSuccessMessage(`Entrada de "${result.name}" gravada localmente com sucesso no SQLite! (Entrada pendente de sincronização com o Google Sheets)`);
        }

        // Reset form data
        setFormData({
          name: '',
          document: '',
          company: '',
          visitorType: 'Visitante',
          unit: '',
          licensePlate: '',
          notes: ''
        });
        setPhoto(null);
      }
    } catch (err) {
      setErrors({ form: 'Erro ao tentar conectar ao servidor local. Os dados não puderam ser gravados.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const autoFillField = (field: 'unit' | 'company', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  return (
    <div className="bg-[#0a0d14] rounded-sm border border-slate-800/40 overflow-hidden" id="card-register-visitor">
      
      {/* Container Header */}
      <div className="bg-slate-900/30 border-b border-slate-800/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0"></div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Nova Entrada</h2>
            <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">Cadastro corrente na Unidade Local</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {errors.form && (
          <div className="mb-4 bg-red-950/20 border border-red-900 text-red-400 p-4 rounded-sm flex items-start gap-2.5 text-xs font-mono">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase">[ERRO SISTEMA]:</span> {errors.form}
            </div>
          </div>
        )}

        {successMessage && registeredItem && (
          <div className={`mb-5 p-4 rounded-sm border flex items-start gap-3 text-xs font-mono transition-all duration-300 ${
            registeredItem.syncStatus === 'synced'
              ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
              : 'bg-amber-950/20 border-amber-800/40 text-amber-400'
          }`}>
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
            <div className="flex-1">
              <p className="font-bold uppercase tracking-wider">{registeredItem.syncStatus === 'synced' ? '[OK - REGISTRO SINCRONIZADO]' : '[PRE-GRAVAÇÃO LOCAL OK]'}</p>
              <p className="mt-1 text-slate-300 leading-normal">{successMessage}</p>
              <div className="mt-2 text-[9px] text-slate-500 bg-black/40 px-2 py-1 rounded inline-block">
                ID: {registeredItem.id} | HORA: {new Date(registeredItem.entryTime).toLocaleTimeString('pt-BR')} hs
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" id="form-entrance">
          
          {/* Form grid for inputs */}
          <div className="space-y-4">
            
            {/* Input Name */}
            <div>
              <label htmlFor="input-name" className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                Nome do visitante <span className="text-emerald-500">*</span>
              </label>
              <input
                type="text"
                id="input-name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Nome completo do portador"
                className={`w-full bg-slate-950 border text-slate-100 p-2.5 text-xs rounded-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-950/30 outline-none transition placeholder-slate-600 ${
                  errors.name ? 'border-red-900' : 'border-slate-800'
                }`}
              />
              {errors.name && <span className="text-[10px] text-red-400 font-mono mt-1 block">{errors.name}</span>}
            </div>

            {/* Document and Type inline Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Input Document  */}
              <div>
                <label htmlFor="input-document" className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                  Documento (RG / CPF) <span className="text-emerald-500">*</span>
                </label>
                <input
                  type="text"
                  id="input-document"
                  name="document"
                  value={formData.document}
                  onChange={handleInputChange}
                  placeholder="Doc. de Identidade"
                  className={`w-full bg-slate-950 border text-slate-100 p-2.5 text-xs rounded-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-950/30 outline-none transition placeholder-slate-600 ${
                    errors.document ? 'border-red-900' : 'border-slate-800'
                  }`}
                />
                {errors.document && <span className="text-[10px] text-red-400 font-mono mt-1 block">{errors.document}</span>}
              </div>

              {/* Select Visitor Type */}
              <div>
                <label htmlFor="input-visitorType" className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                  Categoria de Acesso
                </label>
                <select
                  id="input-visitorType"
                  name="visitorType"
                  value={formData.visitorType}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2.5 text-xs rounded-sm focus:border-emerald-500/50 outline-none cursor-pointer"
                >
                  <option value="Visitante">Visitante Normal</option>
                  <option value="Prestador de Serviço">Prestador de Serviço</option>
                  <option value="Fornecedor">Fornecedor</option>
                  <option value="Outro">Outro / Entregador</option>
                </select>
              </div>

            </div>

            {/* Input Company / Service type */}
            <div>
              <label htmlFor="input-company" className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                Empresa / Tipo de Serviço <span className="text-slate-600 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                id="input-company"
                name="company"
                value={formData.company}
                onChange={handleInputChange}
                placeholder="Ex: Net Claro, Jardinagem, Enel"
                className={`w-full bg-slate-950 border text-slate-100 p-2.5 text-xs rounded-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-950/30 outline-none transition placeholder-slate-600 ${
                  errors.company ? 'border-red-900' : 'border-slate-800'
                }`}
              />
              {errors.company && <span className="text-[10px] text-red-400 font-mono mt-1 block">{errors.company}</span>}
              
              {/* Quick companies badges */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {quickCompanies.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => autoFillField('company', c)}
                    className="text-[9px] font-mono bg-slate-950 border border-slate-800/60 hover:bg-slate-900 text-slate-400 hover:text-emerald-400 transition px-1.5 py-0.5 rounded-sm cursor-pointer"
                  >
                    + {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Destination inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Input Destination Unit */}
              <div>
                <label htmlFor="input-unit" className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                  Destino / Unidade <span className="text-emerald-500">*</span>
                </label>
                <input
                  type="text"
                  id="input-unit"
                  name="unit"
                  value={formData.unit}
                  onChange={handleInputChange}
                  placeholder="Apto ou Bloco"
                  className={`w-full bg-slate-950 border text-slate-100 p-2.5 text-xs rounded-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-950/30 outline-none transition placeholder-slate-600 ${
                    errors.unit ? 'border-red-900' : 'border-slate-800'
                  }`}
                />
                {errors.unit && <span className="text-[10px] text-red-400 font-mono mt-1 block">{errors.unit}</span>}

                {/* Quick destination units */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {quickUnits.map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => autoFillField('unit', u)}
                      className="text-[9px] font-mono bg-slate-950 border border-slate-800/60 hover:bg-slate-900 text-slate-400 hover:text-emerald-400 transition px-1.5 py-0.5 rounded-sm cursor-pointer"
                    >
                      + {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Vehicle Plate */}
              <div>
                <label htmlFor="input-licensePlate" className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                  Placa do Veículo (Opcional)
                </label>
                <input
                  type="text"
                  id="input-licensePlate"
                  name="licensePlate"
                  value={formData.licensePlate}
                  onChange={handleInputChange}
                  placeholder="Ex: BRA2E19"
                  className={`w-full bg-slate-950 border text-slate-100 p-2.5 text-xs rounded-sm font-mono uppercase focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-950/30 outline-none transition placeholder-slate-600 ${
                    errors.licensePlate ? 'border-red-900' : 'border-slate-800'
                  }`}
                />
                {errors.licensePlate && <span className="text-[10px] text-red-400 font-mono mt-1 block">{errors.licensePlate}</span>}
              </div>

            </div>

            {/* Input Observações */}
            <div>
              <label htmlFor="input-notes" className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                Notas adicionais do Atendimento
              </label>
              <textarea
                id="input-notes"
                name="notes"
                rows={2}
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Observações úteis para a portaria (ferramentas, etc.)"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2.5 text-xs rounded-sm focus:border-emerald-500/50 outline-none"
              />
            </div>

            {/* CAPTURA DE FOTO */}
            <div className="border border-slate-800/40 rounded p-4 bg-slate-950/20 space-y-3">
              <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Foto do Prestador / Visitante <span className="text-slate-600 font-normal">(Opcional)</span>
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
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-505 text-white font-mono font-bold text-[10px] uppercase tracking-wider rounded-sm transition cursor-pointer"
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
                    Utilize a webcam conectada ou selecione um arquivo de imagem para guardar no banco de dados.
                  </p>
                </div>

              </div>
            </div>

          </div>

          {/* Action Trigger */}
          <div className="pt-2">
            <button
              id="btn-register-submit"
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 rounded-sm font-bold uppercase tracking-widest text-xs transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 ${
                isSubmitting
                  ? 'bg-slate-850 text-slate-500 border border-slate-800 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md border border-emerald-500/35'
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Verificando Integridade...</span>
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  <span>Liberar Entrada</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}

async function resizeImageDataUrl(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const maxSides = [1280, 1024, 800];
  const qualities = [0.86, 0.78, 0.7];
  let lastCandidate = dataUrl;

  for (const maxSide of maxSides) {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    for (const quality of qualities) {
      const resized = canvas.toDataURL('image/jpeg', quality);
      lastCandidate = resized;
      if (resized.length <= 900000) {
        return resized;
      }
    }
  }

  return lastCandidate;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image load failed'));
    image.src = dataUrl;
  });
}
