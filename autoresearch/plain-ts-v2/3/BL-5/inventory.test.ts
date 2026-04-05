import { describe, it, expect } from 'vitest';
import { createInventory, InventoryError } from './inventory.js';

describe('BL-5: Inventory Reservation', () => {
  it('basic reserve and check', () => {
    const inv = createInventory();
    inv.setStock('A', 10);
    expect(inv.getAvailable('A')).toBe(10);
    inv.reserve('A', 3);
    expect(inv.getAvailable('A')).toBe(7);
  });
  it('reserve fails when insufficient', () => {
    const inv = createInventory();
    inv.setStock('A', 5);
    expect(() => inv.reserve('A', 10)).toThrow(InventoryError);
  });
  it('release restores availability', () => {
    const inv = createInventory();
    inv.setStock('A', 10);
    const id = inv.reserve('A', 5);
    expect(inv.getAvailable('A')).toBe(5);
    inv.release(id);
    expect(inv.getAvailable('A')).toBe(10);
  });
  it('confirm reduces stock', () => {
    const inv = createInventory();
    inv.setStock('A', 10);
    const id = inv.reserve('A', 3);
    inv.confirm(id);
    expect(inv.getAvailable('A')).toBe(7);
  });
  it('expired reservation frees stock', () => {
    const inv = createInventory();
    inv.setStock('A', 10);
    inv.reserve('A', 5, 1); // 1ms TTL
    return new Promise<void>(resolve => setTimeout(() => {
      expect(inv.getAvailable('A')).toBe(10);
      resolve();
    }, 10));
  });
  it('unknown sku = 0 available', () => {
    const inv = createInventory();
    expect(inv.getAvailable('X')).toBe(0);
  });
  it('throws on negative qty', () => {
    const inv = createInventory();
    inv.setStock('A', 10);
    expect(() => inv.reserve('A', -1)).toThrow(InventoryError);
  });
});
