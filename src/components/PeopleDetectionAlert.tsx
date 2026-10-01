import { useEffect, useRef } from 'react';
import { ScanSearch } from 'lucide-react';
import { Analysis } from '../detection';
import { cameraName } from '../cameras';

export default function PeopleDetectionAlert({ result, onClose, onOpen, pendingCount = 0 }: { result: Analysis | null; onClose: () => void; onOpen: () => void; pendingCount?: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (result && !dialog.current?.open) dialog.current?.showModal(); else if (!result) dialog.current?.close(); }, [result]);
  const people = result?.detections.filter(d => d.kind === 'person') ?? [];
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="people-alert-title" className="m-auto w-[min(92vw,480px)] rounded-2xl border border-emerald-500/40 bg-[#0a0d14] p-6 text-slate-100 shadow-2xl backdrop:bg-black/70">
    {pendingCount > 1 && <p className="mb-3 text-sm text-amber-500">{pendingCount - 1} outro(s) alerta(s) aguardando.</p>}
    {result && <><ScanSearch className="mb-4 text-emerald-400" size={32} /><h2 id="people-alert-title" className="text-xl font-semibold">Presença detectada</h2><p className="mt-3 text-lg">{cameraName(result.channel)} · Canal {result.channel}</p><p className="mt-2 text-sm text-slate-400">{people.length} pessoa(s) detectada(s) em {new Date(result.analyzed_at).toLocaleString('pt-BR')}.</p><p className="mt-2 text-sm text-slate-400">Maior confiança: {(Math.max(0, ...people.map(d => d.confidence)) * 100).toFixed(1)}%.</p><div className="mt-6 flex flex-wrap gap-3"><button autoFocus onClick={onClose} className="rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-slate-950">Entendido</button><button onClick={() => { onOpen(); onClose(); }} className="rounded-lg border border-slate-700 px-4 py-3">Ver detecções</button></div></>}
  </dialog>;
}
