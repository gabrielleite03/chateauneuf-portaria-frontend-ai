import React, { useState } from 'react';
import { deleteShoppingDelivery } from '../api';

export default function DeleteDelivery({ id, onDeleted }: { id: string; onDeleted: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { await deleteShoppingDelivery(id, password); onDeleted(id); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível excluir a entrega.'); }
    finally { setPassword(''); setBusy(false); }
  };
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-3 rounded border border-red-900 px-3 py-2 text-xs text-red-300">Excluir entrada incorreta</button>;
  return <form onSubmit={submit} className="mt-3 space-y-3 rounded border border-red-900 p-3">
    <p className="text-sm text-slate-300">Confirme a exclusão desta entrada. Ela será removida das listas de entregas; o registro será preservado para auditoria.</p>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block text-xs text-slate-400">Senha para autorizar a exclusão
        <input autoFocus required type="password" autoComplete="off" maxLength={256} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
      </label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-3"><button className="rounded bg-red-800 px-3 py-2 text-xs text-white">{busy ? 'Excluindo...' : 'Confirmar exclusão'}</button><button type="button" className="text-xs text-slate-300" onClick={() => { setOpen(false); setPassword(''); setError(''); }}>Cancelar</button></div>
    </fieldset>
  </form>;
}
