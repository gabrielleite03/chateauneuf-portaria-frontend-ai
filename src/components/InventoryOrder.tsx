import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { InventoryProduct, inventoryDate, inventoryDecimal, inventoryQuantity, inventoryRequestID, inventoryToday } from '../inventory';
import './InventoryOrder.css';

const inputClass = 'mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white';
const buttonClass = 'rounded border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-50';
const suggested = (p: InventoryProduct) => Math.max(0, p.minimumMilli - p.stockMilli);

export default function InventoryOrder({ products, active, close }: { products: InventoryProduct[]; active: boolean; close: () => void }) {
  const [items, setItems] = useState(() => products.filter(p => !p.deleted && suggested(p) > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map(p => ({ key: inventoryRequestID(), productId: p.id, quantity: String(suggested(p) / 1000) })));
  const [date] = useState(inventoryToday);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const available = products.filter(p => !p.deleted).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const byID = new Map(available.map(p => [p.id, p]));
  const print = (event: React.FormEvent) => {
    event.preventDefault();
    if (!items.length) { setError('Adicione pelo menos um produto ao pedido.'); return; }
    if (items.some(item => !byID.has(item.productId) || !Number.isFinite(inventoryDecimal(item.quantity, 3)) || inventoryDecimal(item.quantity, 3) <= 0 || inventoryDecimal(item.quantity, 3) > 100000000)) {
      setError('Selecione os produtos e informe quantidades maiores que zero, até 100.000, com até 3 casas decimais.'); return;
    }
    if (new Set(items.map(item => item.productId)).size !== items.length) { setError('Cada produto deve aparecer apenas uma vez no pedido.'); return; }
    setError('');
    window.print();
  };
  return <>
    <form onSubmit={print} className="space-y-4 rounded border border-emerald-900 bg-slate-950 p-4" aria-labelledby="inventory-order-heading">
      <h3 id="inventory-order-heading" className="font-bold text-emerald-400">Fazer pedido</h3>
      <p className="text-xs text-slate-400">Sugestão de compra: quantidade necessária para atingir o estoque mínimo. Ajuste os itens antes de imprimir. O estoque será atualizado ao registrar a compra recebida.</p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!items.length && <p className="text-sm text-slate-300">O pedido está vazio. Adicione um produto para começar.</p>}
      {items.map((item, index) => {
        const product = byID.get(item.productId);
        return <div key={item.key} className="grid items-end gap-3 rounded border border-slate-800 p-3 sm:grid-cols-[2fr_1fr_auto]">
          <label className="text-xs text-slate-400">Produto {index + 1} *
            <select autoFocus={index === 0} required value={item.productId} className={inputClass} onChange={e => {
              const productId = e.target.value, next = byID.get(productId);
              setItems(rows => rows.map(row => row.key === item.key ? { ...row, productId, quantity: next && suggested(next) > 0 ? String(suggested(next) / 1000) : '1' } : row));
            }}>
              <option value="">Selecione um produto</option>
              {available.map(p => <option key={p.id} value={p.id} disabled={items.some(row => row.key !== item.key && row.productId === p.id)}>{p.name} ({p.unit})</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Quantidade ({product?.unit || 'unidade'}) *<input required inputMode="decimal" value={item.quantity} className={inputClass} onChange={e => { const quantity = e.target.value; setItems(rows => rows.map(row => row.key === item.key ? { ...row, quantity } : row)); }} /></label>
          <button type="button" className={buttonClass} aria-label={`Excluir item ${index + 1} do pedido`} onClick={() => setItems(rows => rows.filter(row => row.key !== item.key))}>Excluir item</button>
          {product && <p className="text-xs text-slate-400 sm:col-span-3">Saldo: {inventoryQuantity(product.stockMilli)} {product.unit} · Mínimo: {inventoryQuantity(product.minimumMilli)} {product.unit} · Compra sugerida: {inventoryQuantity(suggested(product))} {product.unit}</p>}
        </div>;
      })}
      <button type="button" className={buttonClass} disabled={items.length >= available.length} onClick={() => setItems(rows => [...rows, { key: inventoryRequestID(), productId: '', quantity: '1' }])}>Adicionar produto</button>
      <label className="block text-xs text-slate-400">Observações<textarea maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} /></label>
      <div className="flex flex-wrap gap-2">
        <button disabled={!items.length} className="rounded bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Imprimir pedido</button>
        <button type="button" className={buttonClass} onClick={() => { if (window.confirm('Excluir este pedido e descartar os itens selecionados?')) close(); }}>Excluir pedido</button>
      </div>
    </form>
    {active && createPortal(<article className="inventory-order-print">
      <h1>Condomínio Chateauneuf</h1><h2>Pedido de produtos de limpeza</h2><p>Data: {inventoryDate(date)}</p>
      <table><thead><tr><th>Item</th><th>Produto</th><th>Quantidade</th><th>Unidade</th></tr></thead>
        <tbody>{items.map((item, index) => <tr key={item.key}><td>{index + 1}</td><td>{byID.get(item.productId)?.name}</td><td>{Number.isFinite(inventoryDecimal(item.quantity, 3)) ? inventoryQuantity(inventoryDecimal(item.quantity, 3)) : ''}</td><td>{byID.get(item.productId)?.unit}</td></tr>)}</tbody>
      </table>
      {notes && <p className="order-notes"><strong>Observações:</strong><br />{notes}</p>}
      <p>Total de itens: {items.length}</p><p className="order-signature">Responsável: ________________________________________</p>
    </article>, document.body)}
  </>;
}
