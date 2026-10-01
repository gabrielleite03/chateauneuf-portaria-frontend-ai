import React, { useState } from 'react';
import { Camera, ScanSearch, Clock3, Pause, Play } from 'lucide-react';
import { cameras, cameraName } from '../cameras';
import { validSchedule } from '../detection';
import { PeopleDetectionController } from './usePeopleDetection';

function localInput(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
const inputClass = 'mt-2 w-full rounded-lg border border-slate-700 bg-[#07090f] px-3 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500';
const phaseLabels = { paused: 'Pausado', waiting: 'Agendado', active: 'Monitorando', finished: 'Encerrado' };

export default function PeopleDetectionModule({ controller: c }: { controller: PeopleDetectionController }) {
  const [channels, setChannels] = useState<number[]>(c.schedule?.channels ?? [12]);
  const [channel, setChannel] = useState(c.schedule?.channels[0] ?? 12);
  const [start, setStart] = useState(c.schedule ? localInput(new Date(c.schedule.start)) : localInput(new Date(Date.now() + 60_000)));
  const [end, setEnd] = useState(c.schedule ? localInput(new Date(c.schedule.end)) : localInput(new Date(Date.now() + 3_600_000)));
  const [formError, setFormError] = useState('');
  const [preview, setPreview] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const activate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!channels.length) { setFormError('Selecione pelo menos uma câmera.'); return; }
    const value = { channels, start, end, enabled: true };
    if (!validSchedule(value) || Date.parse(end) <= Date.now()) { setFormError('Informe um período válido, com término após o início e no futuro.'); return; }
    c.saveSchedule({ ...value, start: new Date(start).toISOString(), end: new Date(end).toISOString() }); setFormError('');
  };
  return <section className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="flex items-center gap-3 text-2xl font-semibold"><ScanSearch className="text-emerald-400" /> Detecção de pessoas</h1><p className="mt-2 text-sm text-slate-400">Selecione várias câmeras para monitorar no mesmo período.</p></div>
      <span className="rounded-full border border-emerald-500/30 px-4 py-2 text-sm text-emerald-400" role="status">{c.busyChannel !== null ? `Analisando ${cameraName(c.busyChannel)}…` : phaseLabels[c.phase]}</span>
    </header>
    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-500">Mantenha esta página aberta e o computador ligado. O monitoramento continua ao trocar de menu, mas pode ser interrompido se o navegador suspender a página. Os horários seguem o relógio deste computador.</div>
    <div className="grid gap-6 xl:grid-cols-2">
      <form onSubmit={activate} className="space-y-5 rounded-xl border border-slate-800 bg-[#0a0d14] p-6">
        <h2 className="flex items-center gap-2 font-semibold"><Clock3 size={18} /> Agendar monitoramento</h2>
        <fieldset>
          <legend className="text-sm text-slate-400">Câmeras do agendamento ({channels.length} selecionadas)</legend>
          <div className="my-3 flex gap-4 text-sm text-emerald-400">
            <button type="button" onClick={() => setChannels(cameras.map(camera => camera.id))}>Selecionar todas</button>
            <button type="button" onClick={() => setChannels([])}>Limpar seleção</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">{cameras.map(camera => <label key={camera.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${channels.includes(camera.id) ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-800'}`}>
            <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={channels.includes(camera.id)} onChange={event => setChannels(previous => event.target.checked ? [...previous, camera.id] : previous.filter(id => id !== camera.id))} />
            {camera.id} — {camera.label}
          </label>)}</div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-400">Início<input required className={inputClass} type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label>
          <label className="block text-sm text-slate-400">Término<input required className={inputClass} type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label>
        </div>
        <p className="text-xs leading-relaxed text-slate-400">As câmeras são verificadas em rodízio, com intervalo mínimo de 15 segundos por câmera. Com mais câmeras, cada rodada pode demorar mais. Alertas da mesma câmera têm intervalo mínimo de 1 minuto.</p>
        {formError && <p role="alert" className="text-sm text-red-400">{formError}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950"><Play size={16} /> {c.schedule ? 'Salvar agendamento' : 'Agendar'}</button>
          <button type="button" disabled={!c.schedule?.enabled} onClick={() => c.schedule && c.saveSchedule({ ...c.schedule, enabled: false })} className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-3 text-sm disabled:opacity-40"><Pause size={16} /> Pausar</button>
        </div>
        {c.schedule && <p className="text-sm text-slate-400">Salvo: <strong>{c.schedule.channels.map(cameraName).join(', ')}</strong>, de {new Date(c.schedule.start).toLocaleString('pt-BR')} até {new Date(c.schedule.end).toLocaleString('pt-BR')}.</p>}
        {(c.error || c.storageError) && <p role="alert" className="rounded-lg border border-red-500/30 p-3 text-sm text-red-400">{c.error || c.storageError}</p>}
      </form>
      <div className="space-y-4 rounded-xl border border-slate-800 bg-[#0a0d14] p-6">
        <label className="block text-sm text-slate-400">Câmera para prévia e análise manual<select className={inputClass} value={channel} onChange={e => { setChannel(Number(e.target.value)); setPreview(''); setPreviewError(false); }}>{cameras.map(camera => <option key={camera.id} value={camera.id}>{camera.id} — {camera.label}</option>)}</select></label>
        <button type="button" disabled={c.busy} onClick={() => void c.run(channel)} className="rounded-lg border border-emerald-500/40 px-4 py-3 text-sm text-emerald-400 disabled:opacity-40">Analisar agora</button>
        <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><Camera size={18} /> {cameraName(channel)}</h2><button type="button" onClick={() => { setPreviewError(false); setPreview(`/stream-api/api/camera/frame?channel=${channel}&t=${Date.now()}`); }} className="text-sm text-emerald-400">Atualizar imagem</button></div>
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-slate-950 text-center text-sm text-slate-400">{preview && !previewError ? <img src={preview} alt={`Imagem atual de ${cameraName(channel)}`} onError={() => setPreviewError(true)} className="h-full w-full object-contain" /> : <p className="px-4">{previewError ? 'Não foi possível carregar a câmera.' : 'Clique em Atualizar imagem para conferir a câmera.'}</p>}</div>
        <p className="text-xs text-slate-400">Prévia atual da câmera; não corresponde necessariamente ao frame analisado.</p>
        {c.lastResult && <div className="border-t border-slate-800 pt-4 text-sm" aria-live="polite"><p className="font-medium">Última análise — {cameraName(c.lastResult.channel)}</p><p className="mt-1 text-slate-400">{new Date(c.lastResult.analyzed_at).toLocaleString('pt-BR')} · {c.lastResult.detections.filter(d => d.kind === 'person').length} pessoa(s) detectada(s)</p></div>}
        <p className="text-xs leading-relaxed text-slate-400">A detecção pode falhar com baixa resolução ou pessoas encobertas. Nenhuma detecção não garante que o local esteja vazio.</p>
      </div>
    </div>
    {c.schedule && <div className="rounded-xl border border-slate-800 bg-[#0a0d14] p-6"><h2 className="font-semibold">Câmeras monitoradas</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{c.schedule.channels.map(id => <li key={id} className="rounded-lg border border-slate-800 p-4 text-sm">
        <p className="font-medium">{id} — {cameraName(id)}</p>
        {c.busyChannel === id && <p className="mt-2 text-emerald-400">Analisando…</p>}
        {c.errors[id] && <p className="mt-2 text-red-400">{c.errors[id]}</p>}
        {c.results[id] ? <p className="mt-2 text-slate-400">Última análise: {new Date(c.results[id].analyzed_at).toLocaleString('pt-BR')} · {c.results[id].detections.filter(d => d.kind === 'person').length} pessoa(s)</p> : <p className="mt-2 text-slate-400">{c.phase === 'active' ? 'Aguardando verificação' : phaseLabels[c.phase]}</p>}
      </li>)}</ul>
    </div>}
    <div className="rounded-xl border border-slate-800 bg-[#0a0d14] p-6"><h2 className="font-semibold">Detecções nesta sessão</h2><p className="mt-1 text-xs text-slate-400">Últimos 30 resultados positivos; este histórico é apagado ao recarregar a página.</p>
      {!c.history.length ? <p className="mt-5 text-sm text-slate-400">Nenhuma detecção registrada nesta sessão.</p> : <ul className="mt-4 divide-y divide-slate-800">{c.history.map((result, index) => <li key={`${result.analyzed_at}-${index}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{cameraName(result.channel)} · {result.detections.filter(d => d.kind === 'person').length} pessoa(s)</span><time className="text-slate-400">{new Date(result.analyzed_at).toLocaleString('pt-BR')}</time></li>)}</ul>}
    </div>
  </section>;
}
