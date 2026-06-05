import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, Landmark, PackagePlus, ReceiptText, Trash2, Upload, UserRound } from 'lucide-react';
import { ShoppingDelivery } from '../types';

interface ShoppingModuleProps {
  onRegister: (data: Omit<ShoppingDelivery, 'id' | 'receivedAt' | 'withdrawnAt' | 'status' | 'syncStatus'>) => Promise<ShoppingDelivery | null>;
  isInternetOnline: boolean;
}

export default function ShoppingModule({ onRegister, isInternetOnline }: ShoppingModuleProps) {
  const [formData, setFormData] = useState({
    unit: '',
    courierName: '',
    document: '',
    store: '',
    product: '',
    notes: '',
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [registeredItem, setRegisteredItem] = useState<ShoppingDelivery | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const quickUnits = ['Apto 11', 'Apto 22', 'Apto 33', 'Apto 44', 'Apto 55', 'Apto 66', 'Apto 77', 'Apto 84'];
  const quickStores = ['Mercado Livre', 'Amazon', 'Shopee', 'iFood', 'Correios', 'Transportadora'];

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    if (isWebcamActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [isWebcamActive, stream]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const autoFillField = (field: 'unit' | 'store', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const startWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'environment' },
      });
      setStream(mediaStream);
      setIsWebcamActive(true);
    } catch (err) {
      console.error('Error accessing webcam', err);
      setErrors(prev => ({
        ...prev,
        form: 'Nao foi possivel acessar a camera. Verifique a permissao do navegador ou use upload de arquivo.',
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
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
    setPhoto(await resizeImageDataUrl(canvas.toDataURL('image/jpeg', 0.7)));
    stopWebcam();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        setPhoto(await resizeImageDataUrl(reader.result as string));
      } catch (err) {
        console.error('Failed to resize uploaded product photo', err);
        setErrors(prev => ({ ...prev, photo: 'Nao foi possivel reduzir a foto selecionada.' }));
      }
    };
    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.unit.trim()) newErrors.unit = 'Informe o apartamento da entrega.';
    if (!formData.courierName.trim()) newErrors.courierName = 'Informe o nome do entregador.';
    if (!formData.document.trim()) newErrors.document = 'Informe um documento, codigo ou identificacao do entregador.';
    if (!formData.store.trim()) newErrors.store = 'Informe a loja, transportadora ou origem.';
    if (!formData.product.trim()) newErrors.product = 'Descreva a mercadoria recebida.';
    if (!photo) newErrors.photo = 'Registre uma foto da mercadoria.';

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
      const result = await onRegister({
        unit: formData.unit.trim(),
        courierName: formData.courierName.trim(),
        document: formData.document.trim(),
        store: formData.store.trim(),
        product: formData.product.trim(),
        notes: formData.notes.trim() || undefined,
        photo: photo || undefined,
      });

      if (result) {
        setRegisteredItem(result);
        setSuccessMessage(
          isInternetOnline
            ? `Compra do ${result.unit} registrada e sincronizada.`
            : `Compra do ${result.unit} gravada localmente e pendente de sincronizacao.`,
        );
        setFormData({ unit: '', courierName: '', document: '', store: '', product: '', notes: '' });
        setPhoto(null);
      }
    } catch (err) {
      console.error(err);
      setErrors({ form: 'Nao foi possivel registrar a mercadoria no backend local.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#0a0d14] rounded-sm border border-slate-800/40 overflow-hidden" id="card-register-shopping">
      <div className="bg-[#07090f] border-b border-slate-800/40 px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Nova Compra</h2>
            <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">Recebimento de mercadoria na portaria</p>
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
          <div className={`mb-5 p-4 rounded-sm border flex items-start gap-3 text-xs font-mono ${
            registeredItem.syncStatus === 'synced'
              ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
              : 'bg-amber-950/20 border-amber-800/40 text-amber-400'
          }`}>
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
            <div className="flex-1">
              <p className="font-bold uppercase tracking-wider">{registeredItem.syncStatus === 'synced' ? '[COMPRA SINCRONIZADA]' : '[COMPRA LOCAL OK]'}</p>
              <p className="mt-1 text-slate-300 leading-normal">{successMessage}</p>
              <div className="mt-2 text-[9px] text-slate-500 bg-black/40 px-2 py-1 rounded inline-block">
                ID: {registeredItem.id} | HORA: {new Date(registeredItem.receivedAt).toLocaleTimeString('pt-BR')} hs
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" id="form-shopping">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="input-shopping-unit" className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                Apartamento <span className="text-emerald-500">*</span>
              </label>
              <div className="relative">
                <Landmark size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  id="input-shopping-unit"
                  name="unit"
                  value={formData.unit}
                  onChange={handleInputChange}
                  placeholder="Ex: Apto 32"
                  className={`w-full bg-slate-950 border text-slate-100 pl-9 pr-3 py-2.5 text-xs rounded-sm focus:border-emerald-500/50 outline-none transition placeholder-slate-600 ${errors.unit ? 'border-red-900' : 'border-slate-800'}`}
                />
              </div>
              {errors.unit && <span className="text-[10px] text-red-400 font-mono mt-1 block">{errors.unit}</span>}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {quickUnits.map(unit => (
                  <button key={unit} type="button" onClick={() => autoFillField('unit', unit)} className="text-[9px] font-mono bg-slate-950 border border-slate-800/60 hover:bg-slate-900 text-slate-400 hover:text-emerald-400 transition px-1.5 py-0.5 rounded-sm cursor-pointer">
                    + {unit}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="input-shopping-courier" className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                Nome do Entregador <span className="text-emerald-500">*</span>
              </label>
              <div className="relative">
                <UserRound size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  id="input-shopping-courier"
                  name="courierName"
                  value={formData.courierName}
                  onChange={handleInputChange}
                  placeholder="Nome completo ou identificacao"
                  className={`w-full bg-slate-950 border text-slate-100 pl-9 pr-3 py-2.5 text-xs rounded-sm focus:border-emerald-500/50 outline-none transition placeholder-slate-600 ${errors.courierName ? 'border-red-900' : 'border-slate-800'}`}
                />
              </div>
              {errors.courierName && <span className="text-[10px] text-red-400 font-mono mt-1 block">{errors.courierName}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="input-shopping-document" className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                Documento / Codigo <span className="text-emerald-500">*</span>
              </label>
              <input
                id="input-shopping-document"
                name="document"
                value={formData.document}
                onChange={handleInputChange}
                placeholder="RG, CPF, cracha ou codigo"
                className={`w-full bg-slate-950 border text-slate-100 p-2.5 text-xs rounded-sm focus:border-emerald-500/50 outline-none transition placeholder-slate-600 ${errors.document ? 'border-red-900' : 'border-slate-800'}`}
              />
              {errors.document && <span className="text-[10px] text-red-400 font-mono mt-1 block">{errors.document}</span>}
            </div>

            <div>
              <label htmlFor="input-shopping-store" className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                Loja / Transportadora <span className="text-emerald-500">*</span>
              </label>
              <input
                id="input-shopping-store"
                name="store"
                value={formData.store}
                onChange={handleInputChange}
                placeholder="Origem da mercadoria"
                className={`w-full bg-slate-950 border text-slate-100 p-2.5 text-xs rounded-sm focus:border-emerald-500/50 outline-none transition placeholder-slate-600 ${errors.store ? 'border-red-900' : 'border-slate-800'}`}
              />
              {errors.store && <span className="text-[10px] text-red-400 font-mono mt-1 block">{errors.store}</span>}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {quickStores.map(store => (
                  <button key={store} type="button" onClick={() => autoFillField('store', store)} className="text-[9px] font-mono bg-slate-950 border border-slate-800/60 hover:bg-slate-900 text-slate-400 hover:text-emerald-400 transition px-1.5 py-0.5 rounded-sm cursor-pointer">
                    + {store}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="input-shopping-product" className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
              Mercadoria <span className="text-emerald-500">*</span>
            </label>
            <div className="relative">
              <ReceiptText size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                id="input-shopping-product"
                name="product"
                value={formData.product}
                onChange={handleInputChange}
                placeholder="Ex: caixa pequena, envelope, sacola refrigerada"
                className={`w-full bg-slate-950 border text-slate-100 pl-9 pr-3 py-2.5 text-xs rounded-sm focus:border-emerald-500/50 outline-none transition placeholder-slate-600 ${errors.product ? 'border-red-900' : 'border-slate-800'}`}
              />
            </div>
            {errors.product && <span className="text-[10px] text-red-400 font-mono mt-1 block">{errors.product}</span>}
          </div>

          <div className="border border-slate-800/40 rounded p-4 bg-slate-950/20 space-y-3">
            <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Foto do Produto <span className="text-emerald-500">*</span>
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className={`relative w-44 h-32 bg-slate-950 border flex items-center justify-center overflow-hidden rounded-sm shrink-0 ${errors.photo ? 'border-red-900' : 'border-slate-800'}`}>
                {isWebcamActive ? (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : photo ? (
                  <img src={photo} alt="Produto recebido" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-700 font-mono text-center p-2.5">
                    <Camera size={20} className="mb-1 text-slate-700" />
                    <span className="text-[9px] uppercase tracking-wider font-bold">Sem Foto</span>
                  </div>
                )}
              </div>

              <div className="flex-1 w-full space-y-2">
                {isWebcamActive ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" onClick={capturePhoto} className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[10px] uppercase tracking-wider rounded-sm transition cursor-pointer">
                      <Camera size={12} />
                      <span>Capturar Foto</span>
                    </button>
                    <button type="button" onClick={stopWebcam} className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-mono text-[10px] uppercase tracking-wider rounded-sm transition cursor-pointer">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={startWebcam} className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 font-mono font-bold text-[10px] uppercase tracking-wider rounded-sm transition cursor-pointer">
                      <Camera size={12} />
                      <span>Camera</span>
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 font-mono font-bold text-[10px] uppercase tracking-wider rounded-sm transition cursor-pointer">
                      <Upload size={12} />
                      <span>Arquivo</span>
                    </button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                {photo && !isWebcamActive && (
                  <button type="button" onClick={() => setPhoto(null)} className="w-full flex items-center justify-center gap-1 py-1.5 px-3 bg-red-950/30 hover:bg-red-950/60 border border-red-900/30 hover:border-red-900 text-red-400 font-mono text-[9px] uppercase tracking-wider rounded-sm transition cursor-pointer">
                    <Trash2 size={10} />
                    <span>Excluir Foto</span>
                  </button>
                )}
                {errors.photo && <span className="text-[10px] text-red-400 font-mono block">{errors.photo}</span>}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="input-shopping-notes" className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
              Observacoes
            </label>
            <textarea
              id="input-shopping-notes"
              name="notes"
              rows={2}
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Ex: volume pesado, gelado, avaria visivel, entregue sem assinatura"
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2.5 text-xs rounded-sm focus:border-emerald-500/50 outline-none placeholder-slate-600"
            />
          </div>

          <button
            id="btn-shopping-submit"
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 rounded-sm font-bold uppercase tracking-widest text-xs transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 ${
              isSubmitting
                ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md border border-emerald-500/35'
            }`}
          >
            <PackagePlus size={14} />
            <span>{isSubmitting ? 'Registrando Compra...' : 'Registrar Mercadoria'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

async function resizeImageDataUrl(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const maxSides = [240, 200, 160, 120];
  const qualities = [0.65, 0.55, 0.45, 0.35];
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
      if (resized.length <= 45000) {
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
