import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inventoryDecimal, inventoryRequestID, inventoryToday } from './inventory';

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
