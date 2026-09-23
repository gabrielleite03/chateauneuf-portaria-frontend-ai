import React, { useEffect, useRef, useState } from 'react';
import { Car, Edit3, Trash2 } from 'lucide-react';
import { createResidentVehicle, deleteResidentVehicle, fetchResidentVehicles, ResidentVehicle, ResidentVehicleInput, updateResidentVehicle } from '../api';

const emptyVehicle: ResidentVehicleInput = { plate: '', brand: '', model: '', color: '' };
const fields: { key: keyof ResidentVehicleInput; label: string; maxLength: number; placeholder: string }[] = [
  { key: 'plate', label: 'Placa', maxLength: 20, placeholder: 'ABC1D23' },
  { key: 'brand', label: 'Marca', maxLength: 100, placeholder: 'Ex.: Fiat' },
  { key: 'model', label: 'Modelo', maxLength: 100, placeholder: 'Ex.: Argo' },
  { key: 'color', label: 'Cor', maxLength: 60, placeholder: 'Ex.: Prata' },
];

const ResidentVehicles: React.FC<{ unit: string; registered: boolean }> = ({ unit, registered }) => {
  const [vehicles, setVehicles] = useState<ResidentVehicle[]>([]);
  const [form, setForm] = useState<ResidentVehicleInput>(emptyVehicle);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  const plateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchResidentVehicles(unit)
      .then(rows => { if (active) { setVehicles(rows); setLoaded(true); } })
      .catch(() => { if (active) { setError('Não foi possível carregar os veículos. Clique em Atualizar para tentar novamente.'); setLoaded(false); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [unit, reload]);

  const reset = () => { setForm(emptyVehicle); setEditingId(null); };
  const mutate = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar a alteração.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input = { plate: form.plate.trim().toUpperCase().replace(/[ -]/g, ''), brand: form.brand.trim(), model: form.model.trim(), color: form.color.trim() };
    if (Object.values(input).some(value => !value)) { setError('Preencha placa, marca, modelo e cor.'); return; }
    if (!/^[A-Z0-9]{1,20}$/.test(input.plate)) { setError('A placa deve conter apenas letras e números.'); return; }
    void mutate(async () => {
      const saved = editingId ? await updateResidentVehicle(unit, editingId, input) : await createResidentVehicle(unit, input);
      setVehicles(rows => (editingId ? rows.map(row => row.id === editingId ? saved : row) : [...rows, saved]).sort((a, b) => a.plate.localeCompare(b.plate)));
      reset();
      setNotice(editingId ? 'Veículo atualizado.' : 'Veículo cadastrado.');
    });
  };
  const remove = (vehicle: ResidentVehicle) => {
    if (!window.confirm(`Excluir o veículo ${vehicle.plate} do apartamento ${unit}?`)) return;
    void mutate(async () => {
      await deleteResidentVehicle(unit, vehicle.id);
      setVehicles(rows => rows.filter(row => row.id !== vehicle.id));
      if (editingId === vehicle.id) reset();
      setNotice('Veículo excluído.');
    });
  };
  const disabled = busy || loading || !loaded || !registered;

  return <section className="border-t border-slate-800 p-5 font-mono" aria-labelledby="resident-vehicles-title">
    <div className="flex items-center justify-between gap-3">
      <h3 id="resident-vehicles-title" className="flex items-center gap-2 text-sm font-bold text-emerald-400"><Car size={18} /> Veículos do apartamento {unit}</h3>
      <button type="button" disabled={busy || loading} onClick={() => setReload(value => value + 1)} className="text-xs text-slate-400 hover:text-white disabled:opacity-50">Atualizar</button>
    </div>
    <p className="mt-2 text-xs text-slate-400">Cadastre os veículos deste apartamento. Cada alteração é salva ao confirmar.</p>
    {!registered && <p className="mt-3 text-sm text-amber-400">Salve o cadastro do apartamento acima para adicionar veículos.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-400">{notice}</p>}
    <form onSubmit={submit} className="mt-4 space-y-3">
      <h4 className="text-xs font-bold text-slate-300">{editingId ? 'Editar veículo' : 'Adicionar veículo'}</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map(field => <label key={field.key} className="block text-xs text-slate-400">{field.label} *
          <input ref={field.key === 'plate' ? plateRef : undefined} type="text" required maxLength={field.maxLength} value={form[field.key]} disabled={disabled} placeholder={field.placeholder} onChange={event => setForm(current => ({ ...current, [field.key]: field.key === 'plate' ? event.target.value.toUpperCase() : event.target.value }))} className="mt-1 w-full rounded-sm border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-50" />
        </label>)}
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={disabled} className="rounded-sm bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50">{busy ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar veículo'}</button>
        {editingId && <button type="button" disabled={busy} onClick={() => { reset(); setError(''); }} className="rounded-sm border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-50">Cancelar edição</button>}
      </div>
    </form>
    {loading ? <p role="status" className="mt-4 text-sm text-slate-400">Carregando veículos...</p> : loaded && <ul className="mt-4 space-y-2">
      {vehicles.map(vehicle => <li key={vehicle.id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-slate-800 bg-slate-950 p-3">
        <div className="min-w-0 flex-1 break-words"><p className="font-bold text-white">{vehicle.plate}</p><p className="text-sm text-slate-300">{vehicle.brand} · {vehicle.model}</p><p className="text-xs text-slate-400">Cor: {vehicle.color}</p></div>
        <div className="flex gap-2">
          <button type="button" disabled={busy} aria-label={`Editar veículo ${vehicle.plate}`} onClick={() => { setEditingId(vehicle.id); setForm({ plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model, color: vehicle.color }); setError(''); setNotice(''); plateRef.current?.focus(); }} className="rounded border border-slate-700 p-2 text-slate-300 hover:text-emerald-400 disabled:opacity-50"><Edit3 size={16} /></button>
          <button type="button" disabled={busy} aria-label={`Excluir veículo ${vehicle.plate}`} onClick={() => remove(vehicle)} className="rounded border border-slate-700 p-2 text-slate-300 hover:text-red-400 disabled:opacity-50"><Trash2 size={16} /></button>
        </div>
      </li>)}
      {vehicles.length === 0 && <li className="text-sm text-slate-500">Nenhum veículo cadastrado neste apartamento.</li>}
    </ul>}
  </section>;
};

export default ResidentVehicles;
