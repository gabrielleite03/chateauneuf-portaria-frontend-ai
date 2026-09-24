import React, { useRef, useState } from 'react';
import { Edit3, Package, Trash2 } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

const ResidentAuthorizedRecipients: React.FC<Props> = ({ value, onChange, disabled }) => {
  const [name, setName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const recipients = value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);

  const reset = () => { setName(''); setEditingIndex(null); setError(''); };
  const save = () => {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) { setError('Informe o nome completo do terceiro.'); inputRef.current?.focus(); return; }
    if (recipients.some((item, index) => index !== editingIndex && item.replace(/\s+/g, ' ').toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setError('Este nome já está na lista de terceiros autorizados.');
      return;
    }
    onChange((editingIndex === null ? [...recipients, trimmed] : recipients.map((item, index) => index === editingIndex ? trimmed : item)).join('\n'));
    reset();
    inputRef.current?.focus();
  };

  return <section className="border border-slate-800 rounded-sm p-5 font-mono" aria-labelledby="authorized-recipients-heading">
    <h3 id="authorized-recipients-heading" className="flex items-center gap-2 text-sm font-bold text-emerald-400"><Package size={18} /> Terceiros autorizados para encomendas</h3>
    <p className="mt-2 text-xs text-slate-400">Cadastre os nomes informados antecipadamente pelo morador para que a portaria possa receber encomendas em nome desses terceiros.</p>
    <p className="mt-2 text-xs text-slate-400">Confirme as inclusões, edições e exclusões no botão Salvar Cadastro abaixo.</p>
    {error && <p id="recipient-error" role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    <div className="mt-4 space-y-3">
      <h4 className="text-xs font-bold text-slate-300">{editingIndex === null ? 'Adicionar terceiro' : 'Editar terceiro'}</h4>
      <label htmlFor="recipient-name" className="block text-xs text-slate-400">Nome completo
        <input id="recipient-name" ref={inputRef} type="text" value={name} disabled={disabled} placeholder="Ex.: Maria da Silva" aria-invalid={!!error} aria-describedby={error ? 'recipient-error' : undefined} onChange={event => { setName(event.target.value); setError(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); save(); } }} className="mt-1 w-full rounded-sm border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-50" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={save} className="rounded-sm bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50">{editingIndex === null ? 'Adicionar terceiro' : 'Confirmar edição'}</button>
        {editingIndex !== null && <button type="button" disabled={disabled} onClick={reset} className="rounded-sm border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-50">Cancelar edição</button>}
      </div>
      {name.trim() && <p className="text-xs text-amber-400">{editingIndex === null ? 'Adicione este nome à lista antes de salvar o cadastro.' : 'Confirme a edição antes de salvar o cadastro.'}</p>}
    </div>
    <ul className="mt-4 space-y-2">
      {recipients.map((recipient, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-slate-800 bg-slate-950 p-3">
        <p className="min-w-0 flex-1 break-words font-bold text-white">{recipient}</p>
        <div className="flex gap-2">
          <button type="button" disabled={disabled} aria-label={`Editar terceiro ${recipient}`} onClick={() => { setEditingIndex(index); setName(recipient); setError(''); inputRef.current?.focus(); }} className="rounded border border-slate-700 p-2 text-slate-300 hover:text-emerald-400 disabled:opacity-50"><Edit3 size={16} /></button>
          <button type="button" disabled={disabled} aria-label={`Excluir terceiro ${recipient}`} onClick={() => { if (window.confirm(`Excluir ${recipient} da lista de terceiros autorizados?`)) { onChange(recipients.filter((_, itemIndex) => itemIndex !== index).join('\n')); reset(); } }} className="rounded border border-slate-700 p-2 text-slate-300 hover:text-red-400 disabled:opacity-50"><Trash2 size={16} /></button>
        </div>
      </li>)}
      {recipients.length === 0 && <li className="text-sm text-slate-500">Nenhum terceiro autorizado neste apartamento.</li>}
    </ul>
  </section>;
};

export default ResidentAuthorizedRecipients;
