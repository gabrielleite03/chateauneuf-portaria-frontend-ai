import React, { useEffect, useRef, useState } from 'react';
import { addReservationGuest, confirmReservationGuest, fetchReservationGuests, ReservationGuest } from '../api';

const ReservationGuests: React.FC<{ reservationId: string }> = ({ reservationId }) => {
  const [guests, setGuests] = useState<ReservationGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchReservationGuests(reservationId)
      .then(rows => { if (active) setGuests(rows); })
      .catch(() => { if (active) setError('Não foi possível carregar a lista de convidados.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reservationId, reload]);

  const save = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar o convidado.'); }
    finally { lock.current = false; setBusy(false); }
  };

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !document.trim()) { setError('Informe o nome e o número do documento.'); return; }
    void save(async () => {
      const guest = await addReservationGuest(reservationId, name.trim(), document.trim());
      setGuests(rows => [...rows, guest]);
      setName('');
      setDocument('');
    });
  };

  return <section className="mt-4 rounded-sm border border-slate-800 p-4" aria-labelledby="guest-list-title">
    <div className="flex items-center justify-between gap-3">
      <h3 id="guest-list-title" className="font-bold text-emerald-400">Lista de convidados</h3>
      <button type="button" disabled={busy || loading} onClick={() => setReload(value => value + 1)} className="text-xs text-slate-400 disabled:opacity-50">Atualizar</button>
    </div>
    <p className="mt-1 text-xs text-slate-400">{guests.filter(guest => guest.confirmed).length} de {guests.length} com entrada confirmada</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    <form onSubmit={add} className="mt-4 space-y-3">
      <label className="block text-xs text-slate-400">Nome do convidado
        <input required maxLength={200} value={name} onChange={event => setName(event.target.value)} disabled={busy || loading} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
      </label>
      <label className="block text-xs text-slate-400">Número do documento
        <input type="text" required maxLength={100} value={document} onChange={event => setDocument(event.target.value)} disabled={busy || loading} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
      </label>
      <button type="submit" disabled={busy || loading} className="rounded bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50">{busy ? 'Salvando...' : 'Adicionar convidado'}</button>
    </form>
    {loading ? <p role="status" className="mt-4 text-sm text-slate-400">Carregando convidados...</p> : <ul className="mt-4 space-y-2">
      {guests.map(guest => <li key={guest.id} className="rounded border border-slate-800 bg-slate-950 p-3">
        <p className="break-words text-sm font-bold text-white">{guest.name}</p>
        <p className="break-words text-xs text-slate-400">Documento: {guest.document}</p>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={guest.confirmed} disabled={busy} aria-label={`Entrada confirmada de ${guest.name}`} className="h-4 w-4 accent-emerald-500" onChange={event => {
            const confirmed = event.target.checked;
            void save(async () => {
              const result = await confirmReservationGuest(reservationId, guest.id, confirmed);
              setGuests(rows => rows.map(row => row.id === guest.id ? { ...row, confirmed: result.confirmed } : row));
            });
          }} />Entrada confirmada
        </label>
      </li>)}
      {!guests.length && !error && <li className="text-sm text-slate-500">Nenhum convidado cadastrado nesta reserva.</li>}
    </ul>}
  </section>;
};

export default ReservationGuests;
