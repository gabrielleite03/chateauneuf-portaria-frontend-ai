export interface InventoryProduct { id: string; name: string; unit: string; minimumMilli: number; stockMilli: number; initialMilli: number; deleted: boolean }
export interface InventoryPurchase { id: string; date: string; supplier: string; document: string; notes: string; totalCents: number }
export interface InventoryMovement { id: number; productId: string; purchaseId: string; kind: 'initial' | 'purchase' | 'withdrawal'; date: string; quantityMilli: number; unitCostCents: number; totalCents: number; responsible: string; notes: string }
export interface InventorySnapshot { products: InventoryProduct[]; purchases: InventoryPurchase[]; movements: InventoryMovement[] }

export function inventorySuggestedPurchase(product: InventoryProduct): number {
  if (product.deleted || product.stockMilli > product.minimumMilli) return 0;
  return product.stockMilli === product.minimumMilli ? 1000 : product.minimumMilli - product.stockMilli;
}

export async function inventoryRequest<T>(path = '', input?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/inventory${path}`, input === undefined ? { signal } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Não foi possível acessar o estoque. Verifique a conexão com o servidor.');
  return data;
}
export const inventoryToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const inventoryMoney = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const inventoryQuantity = (milli: number) => (milli / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
export const inventoryDate = (date: string) => date.split('-').reverse().join('/');
export function inventoryDecimal(value: string, decimals: number): number {
  const normalized = value.trim().replace(',', '.');
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(normalized)) return NaN;
  const [whole, fraction = ''] = normalized.split('.');
  const result = Number(whole) * 10 ** decimals + Number(fraction.padEnd(decimals, '0'));
  return Number.isSafeInteger(result) ? result : NaN;
}
export function inventoryRequestID() {
  // LAN HTTP does not expose randomUUID; getRandomValues works there too.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
