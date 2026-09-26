import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InventoryProduct, inventoryDecimal, inventoryRequestID, inventorySuggestedPurchase, inventoryToday } from './inventory';

test('orders include all five replenishment products, including two at the minimum', () => {
  const product = (stockMilli: number, minimumMilli: number, deleted = false): InventoryProduct => ({ id: '', name: '', unit: 'L', initialMilli: 0, stockMilli, minimumMilli, deleted });
  const products = [product(0, 5000), product(1000, 3000), product(1250, 1500), product(2000, 2000), product(0, 0), product(5000, 2000), product(0, 1000, true)];
  assert.deepEqual(products.map(inventorySuggestedPurchase), [5000, 2000, 250, 1000, 1000, 0, 0]);
  assert.equal(products.filter(p => inventorySuggestedPurchase(p) > 0).length, 5);
  assert.equal(products.filter(p => inventorySuggestedPurchase(p) > 0).length, products.filter(p => !p.deleted && p.stockMilli <= p.minimumMilli).length);
});

test('Brazilian decimal quantities and prices keep their precision', () => {
  assert.equal(inventoryDecimal('1,5', 3), 1500);
  assert.equal(inventoryDecimal('19,99', 2), 1999);
  assert.equal(inventoryDecimal('0.001', 3), 1);
  assert.equal(inventoryDecimal('0', 2), 0);
  for (const value of ['', '-1', '1,234', '1.000,00', 'Infinity', '1e3']) assert.ok(Number.isNaN(inventoryDecimal(value, 2)), value);
});
test('request identifiers work without HTTPS-only randomUUID', () => {
  const one = inventoryRequestID(), two = inventoryRequestID();
  assert.match(one, /^[a-f0-9]{32}$/);
  assert.notEqual(one, two);
  assert.match(inventoryToday(), /^\d{4}-\d{2}-\d{2}$/);
});
