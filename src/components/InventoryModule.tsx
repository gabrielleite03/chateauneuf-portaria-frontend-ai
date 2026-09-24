import React, { useEffect, useRef, useState } from 'react';
import { Edit3, Package, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { InventoryProduct, InventoryPurchase, InventorySnapshot, inventoryDate, inventoryDecimal, inventoryMoney, inventoryQuantity, inventoryRequest, inventoryRequestID, inventoryToday } from '../inventory';

const inputClass = 'mt-1 w-full rounded-sm border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-50';
const buttonClass = 'rounded-sm bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50';
const secondaryClass = 'rounded-sm border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:text-white disabled:opacity-50';
const units = ['un', 'frasco', 'galão', 'pacote', 'caixa', 'L', 'kg'];
const newProduct = () => ({ name: '', unit: 'un', minimum: '0', initial: '0', date: inventoryToday(), responsible: '' });
const newItem = () => ({ key: inventoryRequestID(), productId: '', quantity: '1', price: '' });
const newPurchase = () => ({ date: inventoryToday(), supplier: '', document: '', notes: '' });
const newWithdrawal = () => ({ productId: '', date: inventoryToday(), quantity: '', responsible: '', notes: '' });
type Tab = 'stock' | 'purchase' | 'withdrawal' | 'history';
type FieldProps = { label: string; value: string; change: (value: string) => void; required?: boolean; type?: string; maxLength?: number; placeholder?: string };
const Field: React.FC<FieldProps> = ({ label, value, change, required, type = 'text', maxLength, placeholder }) => <label className="block text-xs text-slate-400">{label}{required && ' *'}<input type={type === 'decimal' ? 'text' : type} inputMode={type === 'decimal' ? 'decimal' : undefined} required={required} maxLength={maxLength} placeholder={placeholder} min={type === 'date' ? '2000-01-01' : undefined} max={type === 'date' ? inventoryToday() : undefined} value={value} onChange={e => change(e.target.value)} className={inputClass} /></label>;
const Notes: React.FC<{ value: string; change: (value: string) => void }> = ({ value, change }) => <label className="block text-xs text-slate-400">Observações<textarea maxLength={1000} value={value} onChange={e => change(e.target.value)} className={inputClass} /></label>;

const InventoryModule: React.FC = () => {
  const [data, setData] = useState<InventorySnapshot>({ products: [], purchases: [], movements: [] });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('stock');
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [product, setProduct] = useState(newProduct);
  const [editing, setEditing] = useState<string | null>(null);
  const [purchase, setPurchase] = useState(newPurchase);
  const [items, setItems] = useState(() => [newItem()]);
  const [withdrawal, setWithdrawal] = useState(newWithdrawal);
  const [historyKind, setHistoryKind] = useState('');
  const [historyProduct, setHistoryProduct] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [supplier, setSupplier] = useState('');
  const lock = useRef(false);
  const productForm = useRef<HTMLFormElement>(null);
  const pending = useRef<{ signature: string; id: string } | null>(null);
  const refresh = async () => {
    setLoading(true);
    try { setData(await inventoryRequest<InventorySnapshot>()); setLoaded(true); }
    catch (err) { setLoaded(false); throw err; }
    finally { setLoading(false); }
  };
  useEffect(() => {
    const controller = new AbortController();
    inventoryRequest<InventorySnapshot>('', undefined, controller.signal)
      .then(value => { setData(value); setLoaded(true); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const message = (err: unknown) => err instanceof Error ? err.message : 'Não foi possível salvar.';
  const save = async (path: string, body: object, reset: () => void) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const signature = JSON.stringify({ path, body });
    if (pending.current?.signature !== signature) pending.current = { signature, id: inventoryRequestID() };
    try {
      await inventoryRequest(path, { ...body, requestId: pending.current.id });
      pending.current = null; reset(); setNotice('Registro salvo com sucesso.');
      try { await refresh(); } catch { setError('O registro foi salvo, mas não foi possível atualizar a lista. Clique em Atualizar.'); }
    } catch (err) { setError(message(err)); }
    finally { lock.current = false; setBusy(false); }
  };
  const disabled = busy || loading || !loaded;
  const quantities = (value: string) => { const n = inventoryDecimal(value, 3); return Number.isFinite(n) && n >= 0 && n <= 100000000 ? n : NaN; };
  const addProduct = (event: React.FormEvent) => {
    event.preventDefault();
    const minimumMilli = quantities(product.minimum), initialMilli = editing ? 0 : quantities(product.initial);
    if (!Number.isFinite(minimumMilli) || !Number.isFinite(initialMilli)) { setError('Informe quantidades entre 0 e 100.000, com até 3 casas decimais.'); return; }
    void save(editing ? `/products/${editing}` : '/products', { name: product.name, unit: product.unit, minimumMilli, initialMilli, date: product.date, responsible: product.responsible }, () => { setProduct(newProduct()); setEditing(null); });
  };
  const addPurchase = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = items.map(item => ({ productId: item.productId, quantityMilli: quantities(item.quantity), unitCostCents: inventoryDecimal(item.price, 2) }));
    if (parsed.some(item => !item.productId || !Number.isFinite(item.quantityMilli) || item.quantityMilli <= 0 || !Number.isFinite(item.unitCostCents) || item.unitCostCents < 0 || item.unitCostCents > 10000000)) { setError('Confira os itens: quantidade positiva (até 100.000) e preço entre R$ 0,00 e R$ 100.000,00, com até 2 casas decimais.'); return; }
    if (new Set(parsed.map(item => item.productId)).size !== parsed.length) { setError('Cada produto deve aparecer apenas uma vez na compra.'); return; }
    void save('/purchases', { ...purchase, items: parsed }, () => { setPurchase(newPurchase()); setItems([newItem()]); });
  };
  const addWithdrawal = (event: React.FormEvent) => {
    event.preventDefault();
    const quantityMilli = quantities(withdrawal.quantity);
    if (!Number.isFinite(quantityMilli) || quantityMilli <= 0) { setError('Informe uma quantidade positiva com até 3 casas decimais.'); return; }
    if (quantityMilli > (data.products.find(p => p.id === withdrawal.productId)?.stockMilli ?? 0)) { setError('A retirada não pode ultrapassar o saldo disponível.'); return; }
    const { quantity: _quantity, ...details } = withdrawal;
    void save('/withdrawals', { ...details, quantityMilli }, () => setWithdrawal(newWithdrawal()));
  };
  const editProduct = (p: InventoryProduct) => { setEditing(p.id); setProduct({ ...newProduct(), name: p.name, unit: p.unit, minimum: String(p.minimumMilli / 1000) }); productForm.current?.querySelector('input')?.focus(); };
  const productByID = new Map<string, InventoryProduct>(data.products.map(p => [p.id, p]));
  const purchaseByID = new Map<string, InventoryPurchase>(data.purchases.map(p => [p.id, p]));
  const lineTotal = (item: ReturnType<typeof newItem>) => { const q = quantities(item.quantity), p = inventoryDecimal(item.price, 2); return Number.isFinite(q) && Number.isFinite(p) && p <= 10000000 ? Math.floor((q * p + 500) / 1000) : 0; };
  const low = data.products.filter(p => p.stockMilli <= p.minimumMilli);
  const month = inventoryToday().slice(0, 7);
  const periodValid = !from || !to || from <= to;
  const inPeriod = (date: string) => periodValid && (!from || date >= from) && (!to || date <= to);
  const purchases = data.purchases.filter(p => inPeriod(p.date) && p.supplier.toLocaleLowerCase().includes(supplier.toLocaleLowerCase()) && (!historyProduct || data.movements.some(m => m.purchaseId === p.id && m.productId === historyProduct)));
  const movements = data.movements.filter(m => inPeriod(m.date) && (!historyKind || m.kind === historyKind) && (!historyProduct || m.productId === historyProduct) && (!supplier || (purchaseByID.get(m.purchaseId)?.supplier ?? '').toLocaleLowerCase().includes(supplier.toLocaleLowerCase())));
  const visibleProducts = data.products.filter(p => p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (!lowOnly || p.stockMilli <= p.minimumMilli));
  const selectProduct = (value: string, onChange: (id: string) => void, label = 'Produto') => <label className="block text-xs text-slate-400">{label} *<select required value={value} onChange={event => onChange(event.target.value)} className={inputClass}><option value="">Selecione um produto</option>{data.products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}</select></label>;

  return <section className="space-y-5 font-mono" aria-labelledby="inventory-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="inventory-heading" className="flex items-center gap-2 text-lg font-bold text-emerald-400"><Package size={22} /> Estoque de limpeza</h2><p className="mt-1 text-xs text-slate-400">Produtos, compras e consumo do condomínio.</p></div><button type="button" disabled={busy || loading} onClick={() => { setError(''); void refresh().catch(err => setError(message(err))); }} className={`${secondaryClass} flex items-center gap-2`}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar</button></div>
    {error && <p role="alert" className="rounded border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
    {loading && <p role="status" className="text-sm text-slate-400">Carregando estoque...</p>}
    <div className="grid gap-3 sm:grid-cols-3">{[
      ['Produtos cadastrados', loaded ? String(data.products.length) : '—'],
      ['No mínimo ou abaixo', loaded ? String(low.length) : '—'],
      [`Compras neste mês (${month.split('-').reverse().join('/')})`, loaded ? inventoryMoney(data.purchases.filter(p => p.date.startsWith(month)).reduce((sum, p) => sum + p.totalCents, 0)) : '—'],
    ].map(([label, value]) => <div key={label} className="rounded border border-slate-800 bg-slate-950 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-2xl text-white">{value}</p></div>)}</div>
    <nav aria-label="Controle de estoque" className="flex flex-wrap gap-2">{([['stock', 'Produtos e saldos'], ['purchase', 'Registrar compra'], ['withdrawal', 'Registrar saída'], ['history', 'Histórico']] as const).map(([id, label]) => <button type="button" key={id} disabled={busy} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setError(''); setNotice(''); }} className={tab === id ? buttonClass : secondaryClass}>{label}</button>)}</nav>

    {tab === 'stock' && <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,1fr)_2fr]">
      <form ref={productForm} onSubmit={addProduct} className="rounded border border-slate-800 bg-slate-950/40 p-4"><fieldset disabled={disabled} className="space-y-3"><legend className="mb-3 text-sm font-bold text-slate-200">{editing ? 'Editar produto' : 'Cadastrar produto'}</legend>
        <Field label="Nome do produto" required maxLength={120} value={product.name} change={name => setProduct({ ...product, name })} placeholder="Ex.: Água sanitária 5 L" />
        <label className="block text-xs text-slate-400">Unidade de controle *<select disabled={!!editing || disabled} value={product.unit} onChange={e => setProduct({ ...product, unit: e.target.value })} className={inputClass}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label>
        <p className="text-xs text-slate-500">Use a mesma unidade nas compras e saídas. Para contar galões fechados, escolha galão e informe o volume no nome.</p>
        <Field label={`Estoque mínimo (${product.unit})`} required type="decimal" value={product.minimum} change={minimum => setProduct({ ...product, minimum })} />
        {!editing && <><Field label={`Saldo inicial contado (${product.unit})`} required type="decimal" value={product.initial} change={initial => setProduct({ ...product, initial })} /><p className="text-xs text-slate-500">Conte o que já existe no condomínio. Esse saldo não será contabilizado como compra.</p>{inventoryDecimal(product.initial, 3) > 0 && <><Field label="Data da contagem" type="date" required value={product.date} change={date => setProduct({ ...product, date })} /><Field label="Responsável pela contagem" required maxLength={120} value={product.responsible} change={responsible => setProduct({ ...product, responsible })} /></>}</>}
        <div className="flex gap-2"><button className={buttonClass}>{busy ? 'Salvando...' : editing ? 'Salvar produto' : 'Cadastrar produto'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setProduct(newProduct()); }} className={secondaryClass}>Cancelar</button>}</div>
      </fieldset></form>
      <div className="space-y-3"><Field label="Buscar produto" value={search} change={setSearch} /><label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} /> Somente produtos no mínimo ou abaixo</label>
        <ul className="space-y-2">{visibleProducts.map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950 p-4"><div className="min-w-0 flex-1"><p className="break-words font-bold text-white">{p.name}</p><p className="mt-1 text-sm text-slate-300">Saldo: {inventoryQuantity(p.stockMilli)} {p.unit} · Mínimo: {inventoryQuantity(p.minimumMilli)} {p.unit}</p>{p.stockMilli <= p.minimumMilli && <p className="mt-1 text-xs text-amber-400">{p.stockMilli === 0 ? 'Sem estoque' : 'Repor estoque'}</p>}</div><button type="button" disabled={disabled} aria-label={`Editar ${p.name}`} onClick={() => editProduct(p)} className={secondaryClass}><Edit3 size={16} /></button></li>)}</ul>
        {loaded && !visibleProducts.length && <p className="text-sm text-slate-400">{data.products.length ? 'Nenhum produto encontrado para estes filtros.' : 'Comece cadastrando os produtos e o saldo contado no condomínio.'}</p>}
      </div>
    </div>}

    {tab === 'purchase' && <form onSubmit={addPurchase} className="rounded border border-slate-800 bg-slate-950/40 p-4"><fieldset disabled={disabled || !data.products.length} className="space-y-4"><legend className="mb-3 text-sm font-bold text-slate-200">Nova compra</legend>
      {!data.products.length && <p className="text-sm text-amber-400">Cadastre os produtos em Produtos e saldos antes de registrar a compra.</p>}
      <div className="grid gap-3 sm:grid-cols-3"><Field label="Data da compra" type="date" required value={purchase.date} change={date => setPurchase({ ...purchase, date })} /><label className="block text-xs text-slate-400">Fornecedor *<input required list="inventory-suppliers" maxLength={160} value={purchase.supplier} onChange={e => setPurchase({ ...purchase, supplier: e.target.value })} className={inputClass} /><datalist id="inventory-suppliers">{[...new Set(data.purchases.map(p => p.supplier))].map(name => <option key={name} value={name} />)}</datalist></label><Field label="Nota fiscal / comprovante" maxLength={100} value={purchase.document} change={document => setPurchase({ ...purchase, document })} /></div>
      <p className="text-xs text-slate-400">Informe o preço pago por unidade de controle, já considerando descontos. Cada item entra no estoque ao salvar a compra.</p>
      {items.map((item, index) => <div key={item.key} className="grid items-end gap-3 rounded border border-slate-800 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        {selectProduct(item.productId, productId => setItems(rows => rows.map(row => row.key === item.key ? { ...row, productId } : row)), `Item ${index + 1}`)}
        <Field label={`Quantidade (${productByID.get(item.productId)?.unit || 'unidade'})`} required type="decimal" value={item.quantity} change={quantity => setItems(rows => rows.map(row => row.key === item.key ? { ...row, quantity } : row))} />
        <Field label="Preço unitário (R$)" required type="decimal" placeholder="0,00" value={item.price} change={price => setItems(rows => rows.map(row => row.key === item.key ? { ...row, price } : row))} />
        <p className="py-2 text-sm text-slate-200">{inventoryMoney(lineTotal(item))}</p><button type="button" disabled={items.length === 1} aria-label={`Remover item ${index + 1}`} onClick={() => setItems(rows => rows.filter(row => row.key !== item.key))} className={secondaryClass}><Trash2 size={16} /></button>
      </div>)}
      <button type="button" disabled={items.length >= 100} onClick={() => setItems(rows => [...rows, newItem()])} className={`${secondaryClass} flex items-center gap-2`}><Plus size={14} /> Adicionar item</button>
      <Notes value={purchase.notes} change={notes => setPurchase({ ...purchase, notes })} />
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-lg font-bold text-white">Total dos itens: {inventoryMoney(items.reduce((sum, item) => sum + lineTotal(item), 0))}</p><button className={buttonClass}>{busy ? 'Salvando...' : 'Salvar compra e atualizar estoque'}</button></div>
    </fieldset></form>}

    {tab === 'withdrawal' && <form onSubmit={addWithdrawal} className="max-w-3xl rounded border border-slate-800 bg-slate-950/40 p-4"><fieldset disabled={disabled || !data.products.length} className="space-y-3"><legend className="mb-3 text-sm font-bold text-slate-200">Registrar consumo / retirada</legend>
      {!data.products.length && <p className="text-sm text-amber-400">Cadastre os produtos e registre o saldo inicial ou uma compra antes de retirar.</p>}
      {selectProduct(withdrawal.productId, productId => setWithdrawal({ ...withdrawal, productId }))}
      {withdrawal.productId && <p className="text-sm text-emerald-400">Disponível: {inventoryQuantity(productByID.get(withdrawal.productId)?.stockMilli ?? 0)} {productByID.get(withdrawal.productId)?.unit}</p>}
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Quantidade retirada" required type="decimal" value={withdrawal.quantity} change={quantity => setWithdrawal({ ...withdrawal, quantity })} /><Field label="Data da saída" required type="date" value={withdrawal.date} change={date => setWithdrawal({ ...withdrawal, date })} /></div>
      <Field label="Responsável pela retirada" required maxLength={120} value={withdrawal.responsible} change={responsible => setWithdrawal({ ...withdrawal, responsible })} /><Notes value={withdrawal.notes} change={notes => setWithdrawal({ ...withdrawal, notes })} />
      <button className={buttonClass}>{busy ? 'Salvando...' : 'Confirmar saída'}</button>
    </fieldset></form>}

    {tab === 'history' && <div className="space-y-4">
      <div className="grid gap-3 rounded border border-slate-800 p-4 sm:grid-cols-2 lg:grid-cols-5"><Field label="De" type="date" value={from} change={setFrom} /><Field label="Até" type="date" value={to} change={setTo} /><label className="text-xs text-slate-400">Produto<select value={historyProduct} onChange={e => setHistoryProduct(e.target.value)} className={inputClass}><option value="">Todos</option>{data.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="text-xs text-slate-400">Movimentação<select value={historyKind} onChange={e => setHistoryKind(e.target.value)} className={inputClass}><option value="">Todas</option><option value="purchase">Compras</option><option value="withdrawal">Saídas</option><option value="initial">Saldo inicial</option></select></label><Field label="Fornecedor" value={supplier} change={setSupplier} /></div>
      {!periodValid && <p role="alert" className="text-sm text-amber-400">A data inicial deve ser anterior ou igual à data final.</p>}
      {(!historyKind || historyKind === 'purchase') && <section className="space-y-3"><h3 className="text-sm font-bold text-emerald-400">Compras e valores pagos</h3><p className="text-xs text-slate-400">Total dos itens {historyProduct ? 'do produto selecionado' : 'no período'}: {inventoryMoney(purchases.reduce((sum, p) => sum + (historyProduct ? data.movements.filter(m => m.purchaseId === p.id && m.productId === historyProduct).reduce((subtotal, m) => subtotal + m.totalCents, 0) : p.totalCents), 0))}</p>
        {purchases.map(p => <details key={p.id} className="rounded border border-slate-800 bg-slate-950 p-3"><summary className="cursor-pointer text-sm text-slate-200">{inventoryDate(p.date)} · {p.supplier} · Total da compra: {inventoryMoney(p.totalCents)} {p.document && `· Nº ${p.document}`}</summary><ul className="mt-3 space-y-2">{data.movements.filter(m => m.purchaseId === p.id).map(m => <li key={m.id} className="text-xs text-slate-300">{productByID.get(m.productId)?.name} — {inventoryQuantity(m.quantityMilli)} {productByID.get(m.productId)?.unit} × {inventoryMoney(m.unitCostCents)} = {inventoryMoney(m.totalCents)}</li>)}</ul>{p.notes && <p className="mt-3 whitespace-pre-wrap break-words text-xs text-slate-400">{p.notes}</p>}</details>)}
        {!purchases.length && <p className="text-sm text-slate-500">Nenhuma compra encontrada.</p>}
      </section>}
      <h3 className="text-sm font-bold text-emerald-400">Movimentações</h3>
      <div className="overflow-x-auto rounded border border-slate-800"><table className="w-full text-left text-xs"><thead className="bg-slate-900 text-slate-400"><tr>{['Data', 'Produto', 'Tipo', 'Quantidade', 'Responsável / fornecedor', 'Observações'].map(title => <th key={title} className="p-3">{title}</th>)}</tr></thead><tbody>{movements.map(m => <tr key={m.id} className="border-t border-slate-800 text-slate-300"><td className="whitespace-nowrap p-3">{inventoryDate(m.date)}</td><td className="p-3">{productByID.get(m.productId)?.name}</td><td className="p-3">{{ initial: 'Saldo inicial', purchase: 'Compra', withdrawal: 'Saída' }[m.kind]}</td><td className={`whitespace-nowrap p-3 ${m.quantityMilli < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{m.quantityMilli > 0 ? '+' : ''}{inventoryQuantity(m.quantityMilli)} {productByID.get(m.productId)?.unit}</td><td className="p-3">{m.responsible || purchaseByID.get(m.purchaseId)?.supplier || '—'}</td><td className="max-w-xs whitespace-pre-wrap break-words p-3">{m.notes || purchaseByID.get(m.purchaseId)?.notes || '—'}</td></tr>)}</tbody></table></div>
      {!movements.length && <p className="text-sm text-slate-500">Nenhuma movimentação encontrada.</p>}
    </div>}
  </section>;
};

export default InventoryModule;
