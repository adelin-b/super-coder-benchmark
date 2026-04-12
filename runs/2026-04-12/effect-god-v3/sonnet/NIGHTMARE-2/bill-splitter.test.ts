import { describe, it, expect } from 'vitest';
import { createBillSplitter, BillError } from './bill-splitter.js';
import type { BillResult } from './bill-splitter.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Invariant checker: sum of shares === grandTotal */
function assertSumInvariant(result: BillResult): void {
  const sum = result.shares.reduce((s, sh) => round2(s + sh.total), 0);
  expect(sum).toBe(result.grandTotal);
}

/** Invariant checker: no negative totals */
function assertNoNegativeTotals(result: BillResult): void {
  for (const share of result.shares) {
    expect(share.total).toBeGreaterThanOrEqual(0);
  }
}

describe('NIGHTMARE-2: Exact Bill Splitting with Cascading Adjustments', () => {
  // ==================== Input Validation ====================

  it('throws BillError for duplicate person', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    expect(() => bs.addPerson('alice')).toThrow(BillError);
  });

  it('throws BillError when adding item for non-existent person', () => {
    const bs = createBillSplitter();
    expect(() => bs.addItem({ id: 'i1', name: 'Burger', price: 10, personId: 'nobody' }))
      .toThrow(BillError);
  });

  it('throws BillError for negative item price', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    expect(() => bs.addItem({ id: 'i1', name: 'Burger', price: -5, personId: 'alice' }))
      .toThrow(BillError);
  });

  it('throws BillError for calculate with no persons', () => {
    const bs = createBillSplitter();
    expect(() => bs.calculate()).toThrow(BillError);
  });

  it('throws BillError for calculate with no items', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    expect(() => bs.calculate()).toThrow(BillError);
  });

  it('throws BillError for duplicate item ID', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addItem({ id: 'i1', name: 'Burger', price: 10, personId: 'alice' });
    expect(() => bs.addItem({ id: 'i1', name: 'Fries', price: 5, personId: 'alice' }))
      .toThrow(BillError);
  });

  it('throws BillError for tax rate out of range', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addItem({ id: 'i1', name: 'Burger', price: 10, personId: 'alice' });
    expect(() => bs.setTaxRate('i1', 1.5)).toThrow(BillError);
    expect(() => bs.setTaxRate('i1', -0.1)).toThrow(BillError);
  });

  it('throws BillError for negative tip', () => {
    const bs = createBillSplitter();
    expect(() => bs.setTipPercent(-0.1)).toThrow(BillError);
  });

  it('throws BillError for split on non-existent item', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    expect(() => bs.splitSharedItem('nope', ['alice'])).toThrow(BillError);
  });

  // ==================== Basic Bill (No Tax, No Tip) ====================

  it('simple split: one person, one item', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addItem({ id: 'i1', name: 'Burger', price: 12.50, personId: 'alice' });
    const result = bs.calculate();
    expect(result.originalTotal).toBe(12.50);
    expect(result.grandTotal).toBe(12.50);
    expect(result.shares).toHaveLength(1);
    expect(result.shares[0].total).toBe(12.50);
    assertSumInvariant(result);
  });

  it('two persons, separate items, no tax or tip', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addItem({ id: 'i1', name: 'Burger', price: 12.00, personId: 'alice' });
    bs.addItem({ id: 'i2', name: 'Salad', price: 8.00, personId: 'bob' });
    const result = bs.calculate();
    expect(result.originalTotal).toBe(20.00);
    const alice = result.shares.find(s => s.personId === 'alice')!;
    const bob = result.shares.find(s => s.personId === 'bob')!;
    expect(alice.total).toBe(12.00);
    expect(bob.total).toBe(8.00);
    assertSumInvariant(result);
  });

  // ==================== Tax Calculation ====================

  it('per-item tax with default rate', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addItem({ id: 'i1', name: 'Burger', price: 10.00, personId: 'alice' });
    bs.setDefaultTaxRate(0.08);
    const result = bs.calculate();
    expect(result.taxTotal).toBe(0.80);
    expect(result.grandTotal).toBe(10.80);
    assertSumInvariant(result);
  });

  it('per-item tax rate overrides default', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addItem({ id: 'i1', name: 'Burger', price: 10.00, personId: 'alice' });
    bs.addItem({ id: 'i2', name: 'Beer', price: 6.00, personId: 'alice' });
    bs.setDefaultTaxRate(0.08);
    bs.setTaxRate('i2', 0.12); // alcohol tax
    const result = bs.calculate();
    // Burger tax: round2(10 * 0.08) = 0.80
    // Beer tax: round2(6 * 0.12) = 0.72
    expect(result.taxTotal).toBe(1.52);
    assertSumInvariant(result);
  });

  it('tax rounded per-person per-item differs from aggregated rounding', () => {
    // This is the CRITICAL trap: per-item rounding !== round(sum * rate)
    const bs = createBillSplitter();
    bs.addPerson('alice');
    // Three items at $3.33 each, tax 7%
    bs.addItem({ id: 'i1', name: 'A', price: 3.33, personId: 'alice' });
    bs.addItem({ id: 'i2', name: 'B', price: 3.33, personId: 'alice' });
    bs.addItem({ id: 'i3', name: 'C', price: 3.33, personId: 'alice' });
    bs.setDefaultTaxRate(0.07);
    const result = bs.calculate();
    // Per-item: round2(3.33 * 0.07) = round2(0.2331) = 0.23 each = 0.69 total
    // Aggregated would be: round2(9.99 * 0.07) = round2(0.6993) = 0.70
    // Per-item rounding gives 0.69, NOT 0.70
    expect(result.taxTotal).toBe(0.69);
    assertSumInvariant(result);
  });

  // ==================== Tip Calculation ====================

  it('tip split proportionally by subtotal', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addItem({ id: 'i1', name: 'Steak', price: 30.00, personId: 'alice' });
    bs.addItem({ id: 'i2', name: 'Salad', price: 10.00, personId: 'bob' });
    bs.setTipPercent(0.20);
    const result = bs.calculate();
    const alice = result.shares.find(s => s.personId === 'alice')!;
    const bob = result.shares.find(s => s.personId === 'bob')!;
    // Alice tip: round2(0.20 * 30) = 6.00
    // Bob tip: round2(0.20 * 10) = 2.00
    expect(alice.tipAmount).toBe(6.00);
    expect(bob.tipAmount).toBe(2.00);
    expect(result.tipTotal).toBe(8.00);
    assertSumInvariant(result);
  });

  it('tip rounding per-person may differ from total rounding', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addItem({ id: 'i1', name: 'A', price: 11.11, personId: 'alice' });
    bs.addItem({ id: 'i2', name: 'B', price: 11.11, personId: 'bob' });
    bs.setTipPercent(0.18);
    const result = bs.calculate();
    // Per-person: round2(11.11 * 0.18) = round2(1.9998) = 2.00 each = 4.00
    // If computed on total: round2(22.22 * 0.18) = round2(3.9996) = 4.00
    // Same in this case, but the principle matters
    expect(result.tipTotal).toBe(4.00);
    assertSumInvariant(result);
  });

  // ==================== Shared Items ====================

  it('shared item split evenly among 2 persons', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addItem({ id: 'i1', name: 'Pizza', price: 20.00, personId: 'alice' });
    bs.splitSharedItem('i1', ['alice', 'bob']);
    const result = bs.calculate();
    const alice = result.shares.find(s => s.personId === 'alice')!;
    const bob = result.shares.find(s => s.personId === 'bob')!;
    expect(alice.subtotal).toBe(10.00);
    expect(bob.subtotal).toBe(10.00);
    assertSumInvariant(result);
  });

  it('shared item with indivisible amount distributes remainder', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addPerson('carol');
    bs.addItem({ id: 'i1', name: 'Nachos', price: 10.00, personId: 'alice' });
    bs.splitSharedItem('i1', ['alice', 'bob', 'carol']);
    const result = bs.calculate();
    // 10.00 / 3 = 3.333... -> round2 = 3.33 each, but 3 * 3.33 = 9.99, remainder = 0.01
    // First two get 3.33, last gets 3.34
    const alice = result.shares.find(s => s.personId === 'alice')!;
    const bob = result.shares.find(s => s.personId === 'bob')!;
    const carol = result.shares.find(s => s.personId === 'carol')!;
    expect(alice.subtotal).toBe(3.33);
    expect(bob.subtotal).toBe(3.33);
    expect(carol.subtotal).toBe(3.34);
    assertSumInvariant(result);
  });

  it('shared item tax computed per-person on their share', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addItem({ id: 'i1', name: 'Wine', price: 15.00, personId: 'alice' });
    bs.splitSharedItem('i1', ['alice', 'bob']);
    bs.setDefaultTaxRate(0.07);
    const result = bs.calculate();
    // Each gets 7.50, tax per person: round2(7.50 * 0.07) = round2(0.525) = 0.53 each
    // Total tax: 1.06
    // If computed on total: round2(15.00 * 0.07) = 1.05 (different!)
    const alice = result.shares.find(s => s.personId === 'alice')!;
    expect(alice.taxAmount).toBe(0.53);
    expect(result.taxTotal).toBe(1.06);
    assertSumInvariant(result);
  });

  // ==================== Discounts ====================

  it('percentage discount pre-tax reduces tax base', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addItem({ id: 'i1', name: 'Burger', price: 20.00, personId: 'alice' });
    bs.setDefaultTaxRate(0.10);
    bs.addDiscount({ id: 'd1', type: 'percentage', value: 0.25, itemIds: ['i1'], preTax: true });
    const result = bs.calculate();
    // Discount: round2(20 * 0.25) = 5.00
    // Tax base: 20 - 5 = 15, tax: round2(15 * 0.10) = 1.50
    // Grand total: 20 + 1.50 - 5.00 = 16.50
    expect(result.discountTotal).toBe(5.00);
    expect(result.taxTotal).toBe(1.50);
    expect(result.grandTotal).toBe(16.50);
    assertSumInvariant(result);
  });

  it('percentage discount post-tax does NOT reduce tax base', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addItem({ id: 'i1', name: 'Burger', price: 20.00, personId: 'alice' });
    bs.setDefaultTaxRate(0.10);
    bs.addDiscount({ id: 'd1', type: 'percentage', value: 0.25, itemIds: ['i1'], preTax: false });
    const result = bs.calculate();
    // Tax on full price: round2(20 * 0.10) = 2.00
    // Discount: round2(20 * 0.25) = 5.00
    // Grand total: 20 + 2.00 - 5.00 = 17.00
    expect(result.taxTotal).toBe(2.00);
    expect(result.discountTotal).toBe(5.00);
    expect(result.grandTotal).toBe(17.00);
    assertSumInvariant(result);
  });

  it('pre-tax vs post-tax discount produces different tax amounts', () => {
    // Same discount amount, different application point -> different tax
    const bs1 = createBillSplitter();
    bs1.addPerson('alice');
    bs1.addItem({ id: 'i1', name: 'Meal', price: 40.00, personId: 'alice' });
    bs1.setDefaultTaxRate(0.10);
    bs1.addDiscount({ id: 'd1', type: 'fixed', value: 10.00, itemIds: ['i1'], preTax: true });

    const bs2 = createBillSplitter();
    bs2.addPerson('alice');
    bs2.addItem({ id: 'i1', name: 'Meal', price: 40.00, personId: 'alice' });
    bs2.setDefaultTaxRate(0.10);
    bs2.addDiscount({ id: 'd1', type: 'fixed', value: 10.00, itemIds: ['i1'], preTax: false });

    const r1 = bs1.calculate();
    const r2 = bs2.calculate();
    // Pre-tax: tax on (40-10)=30 -> 3.00, total = 40 + 3 - 10 = 33.00
    // Post-tax: tax on 40 -> 4.00, total = 40 + 4 - 10 = 34.00
    expect(r1.taxTotal).toBe(3.00);
    expect(r2.taxTotal).toBe(4.00);
    expect(r1.grandTotal).toBe(33.00);
    expect(r2.grandTotal).toBe(34.00);
  });

  it('fixed discount distributed proportionally across items', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addItem({ id: 'i1', name: 'Steak', price: 30.00, personId: 'alice' });
    bs.addItem({ id: 'i2', name: 'Salad', price: 10.00, personId: 'alice' });
    bs.addDiscount({ id: 'd1', type: 'fixed', value: 8.00, itemIds: ['i1', 'i2'], preTax: true });
    const result = bs.calculate();
    // Total qualifying: 40, Steak: 30/40 = 0.75, Salad: 10/40 = 0.25
    // Steak discount: round2(8 * 0.75) = 6.00, Salad discount: round2(8 * 0.25) = 2.00
    expect(result.discountTotal).toBe(8.00);
    assertSumInvariant(result);
  });

  it('BOGO discount frees cheapest item', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addItem({ id: 'i1', name: 'Steak', price: 30.00, personId: 'alice' });
    bs.addItem({ id: 'i2', name: 'Salad', price: 8.00, personId: 'alice' });
    bs.addDiscount({ id: 'd1', type: 'bogo', value: 0, itemIds: ['i1', 'i2'], preTax: true });
    const result = bs.calculate();
    // Cheapest is Salad at 8.00
    expect(result.discountTotal).toBe(8.00);
    assertSumInvariant(result);
  });

  // ==================== Tip is on Pre-Discount Subtotals ====================

  it('tip computed on original subtotal, not discounted amount', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addItem({ id: 'i1', name: 'Burger', price: 20.00, personId: 'alice' });
    bs.addDiscount({ id: 'd1', type: 'fixed', value: 5.00, itemIds: ['i1'], preTax: true });
    bs.setTipPercent(0.20);
    const result = bs.calculate();
    // Tip on 20.00 (original), not 15.00 (discounted)
    expect(result.tipTotal).toBe(4.00); // round2(0.20 * 20)
    assertSumInvariant(result);
  });

  // ==================== Minimum Charge (No Negative Totals) ====================

  it('discount exceeding share sets total to 0, redistributes', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addItem({ id: 'i1', name: 'Freebie', price: 5.00, personId: 'alice' });
    bs.addItem({ id: 'i2', name: 'Steak', price: 25.00, personId: 'bob' });
    // Alice gets a $10 discount on a $5 item (post-tax)
    bs.addDiscount({ id: 'd1', type: 'fixed', value: 10.00, itemIds: ['i1'], preTax: false });
    const result = bs.calculate();
    assertNoNegativeTotals(result);
    assertSumInvariant(result);
    const alice = result.shares.find(s => s.personId === 'alice')!;
    expect(alice.total).toBe(0);
  });

  // ==================== Reconciliation ====================

  it('reconciliation adjusts pennies to match grandTotal exactly', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addPerson('carol');
    // Three items that produce rounding differences
    bs.addItem({ id: 'i1', name: 'A', price: 33.33, personId: 'alice' });
    bs.addItem({ id: 'i2', name: 'B', price: 33.33, personId: 'bob' });
    bs.addItem({ id: 'i3', name: 'C', price: 33.34, personId: 'carol' });
    bs.setDefaultTaxRate(0.0875);
    bs.setTipPercent(0.18);
    const result = bs.calculate();
    assertSumInvariant(result);
  });

  it('reconciliation with shared items and tip', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addPerson('carol');
    bs.addItem({ id: 'i1', name: 'Appetizer', price: 14.99, personId: 'alice' });
    bs.splitSharedItem('i1', ['alice', 'bob', 'carol']);
    bs.addItem({ id: 'i2', name: 'Entree', price: 22.50, personId: 'bob' });
    bs.setDefaultTaxRate(0.0925);
    bs.setTipPercent(0.20);
    const result = bs.calculate();
    assertSumInvariant(result);
  });

  // ==================== Complex Scenarios ====================

  it('full scenario: 4 people, shared items, mixed tax, tip, discounts', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addPerson('carol');
    bs.addPerson('dave');

    bs.addItem({ id: 'app', name: 'Appetizer', price: 12.00, personId: 'alice' });
    bs.splitSharedItem('app', ['alice', 'bob', 'carol', 'dave']);
    bs.addItem({ id: 'steak', name: 'Steak', price: 34.99, personId: 'alice' });
    bs.addItem({ id: 'fish', name: 'Fish', price: 28.50, personId: 'bob' });
    bs.addItem({ id: 'pasta', name: 'Pasta', price: 18.75, personId: 'carol' });
    bs.addItem({ id: 'salad', name: 'Salad', price: 14.25, personId: 'dave' });
    bs.addItem({ id: 'wine', name: 'Wine Bottle', price: 45.00, personId: 'alice' });
    bs.splitSharedItem('wine', ['alice', 'bob']);

    bs.setDefaultTaxRate(0.08);
    bs.setTaxRate('wine', 0.12);
    bs.setTipPercent(0.20);

    bs.addDiscount({ id: 'd1', type: 'percentage', value: 0.10, itemIds: ['steak', 'fish'], preTax: true });

    const result = bs.calculate();
    assertSumInvariant(result);
    assertNoNegativeTotals(result);
    expect(result.shares).toHaveLength(4);
  });

  it('property: sum invariant holds with many items and 5 persons', () => {
    const bs = createBillSplitter();
    const people = ['p1', 'p2', 'p3', 'p4', 'p5'];
    for (const p of people) bs.addPerson(p);

    const prices = [7.99, 12.50, 3.33, 22.45, 8.88, 15.00, 6.66, 9.99, 11.11, 4.44];
    for (let i = 0; i < prices.length; i++) {
      bs.addItem({
        id: `item${i}`,
        name: `Item ${i}`,
        price: prices[i],
        personId: people[i % people.length],
      });
    }
    bs.setDefaultTaxRate(0.0875);
    bs.setTipPercent(0.18);
    bs.splitSharedItem('item0', ['p1', 'p2', 'p3']);
    bs.addDiscount({ id: 'd1', type: 'percentage', value: 0.15, itemIds: [], preTax: true });

    const result = bs.calculate();
    assertSumInvariant(result);
    assertNoNegativeTotals(result);
  });

  // ==================== Edge Cases ====================

  it('zero-price item', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addItem({ id: 'i1', name: 'Water', price: 0, personId: 'alice' });
    bs.addItem({ id: 'i2', name: 'Burger', price: 10.00, personId: 'alice' });
    const result = bs.calculate();
    expect(result.originalTotal).toBe(10.00);
    assertSumInvariant(result);
  });

  it('100% discount pre-tax makes tax zero', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addItem({ id: 'i1', name: 'Burger', price: 20.00, personId: 'alice' });
    bs.setDefaultTaxRate(0.10);
    bs.addDiscount({ id: 'd1', type: 'percentage', value: 1.0, itemIds: ['i1'], preTax: true });
    const result = bs.calculate();
    // Pre-tax discount = 20.00, tax base = 0, tax = 0
    expect(result.taxTotal).toBe(0);
    expect(result.discountTotal).toBe(20.00);
    assertSumInvariant(result);
  });

  it('person with no items still included in shares', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addItem({ id: 'i1', name: 'Burger', price: 15.00, personId: 'alice' });
    const result = bs.calculate();
    expect(result.shares).toHaveLength(2);
    const bob = result.shares.find(s => s.personId === 'bob')!;
    expect(bob.total).toBe(0);
    assertSumInvariant(result);
  });

  it('BOGO on shared item distributes discount to sharers', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addItem({ id: 'i1', name: 'Expensive', price: 30.00, personId: 'alice' });
    bs.addItem({ id: 'i2', name: 'Cheap', price: 10.00, personId: 'alice' });
    bs.splitSharedItem('i2', ['alice', 'bob']);
    bs.addDiscount({ id: 'd1', type: 'bogo', value: 0, itemIds: ['i1', 'i2'], preTax: true });
    const result = bs.calculate();
    // BOGO frees cheapest (i2 = 10.00). Alice and Bob each had 5.00 share.
    // Each gets 5.00 discount.
    expect(result.discountTotal).toBe(10.00);
    assertSumInvariant(result);
  });

  it('multiple discounts on same item stack', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addItem({ id: 'i1', name: 'Burger', price: 20.00, personId: 'alice' });
    bs.addDiscount({ id: 'd1', type: 'percentage', value: 0.10, itemIds: ['i1'], preTax: true });
    bs.addDiscount({ id: 'd2', type: 'fixed', value: 3.00, itemIds: ['i1'], preTax: true });
    bs.setDefaultTaxRate(0.08);
    const result = bs.calculate();
    // Discount 1: round2(20 * 0.10) = 2.00
    // Discount 2: 3.00
    // Total discount: 5.00
    // Tax base: 20 - 2 - 3 = 15, tax: round2(15 * 0.08) = 1.20
    expect(result.discountTotal).toBe(5.00);
    expect(result.taxTotal).toBe(1.20);
    assertSumInvariant(result);
  });

  it('tax + tip + discount with shared item: reconciliation needed', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addPerson('carol');

    bs.addItem({ id: 'i1', name: 'Nachos', price: 11.97, personId: 'alice' });
    bs.splitSharedItem('i1', ['alice', 'bob', 'carol']);
    bs.addItem({ id: 'i2', name: 'Beer', price: 7.50, personId: 'bob' });

    bs.setDefaultTaxRate(0.0875);
    bs.setTipPercent(0.20);
    bs.addDiscount({ id: 'd1', type: 'percentage', value: 0.10, itemIds: ['i1'], preTax: true });

    const result = bs.calculate();
    assertSumInvariant(result);
    assertNoNegativeTotals(result);
  });

  it('grandTotal = originalTotal + taxTotal + tipTotal - discountTotal', () => {
    const bs = createBillSplitter();
    bs.addPerson('alice');
    bs.addPerson('bob');
    bs.addItem({ id: 'i1', name: 'A', price: 25.99, personId: 'alice' });
    bs.addItem({ id: 'i2', name: 'B', price: 18.50, personId: 'bob' });
    bs.setDefaultTaxRate(0.09);
    bs.setTipPercent(0.18);
    bs.addDiscount({ id: 'd1', type: 'fixed', value: 5.00, itemIds: [], preTax: true });
    const result = bs.calculate();
    const expected = round2(
      result.originalTotal + result.taxTotal + result.tipTotal - result.discountTotal
    );
    expect(result.grandTotal).toBe(expected);
    assertSumInvariant(result);
  });

  // ==================== Penny Distribution Stress ====================

  it('three-way split of $0.01 item', () => {
    const bs = createBillSplitter();
    bs.addPerson('a');
    bs.addPerson('b');
    bs.addPerson('c');
    bs.addItem({ id: 'i1', name: 'Mint', price: 0.01, personId: 'a' });
    bs.splitSharedItem('i1', ['a', 'b', 'c']);
    const result = bs.calculate();
    // 0.01 / 3 = 0.003... -> round2 = 0.00 each. Last person gets 0.01.
    assertSumInvariant(result);
    expect(result.grandTotal).toBe(0.01);
  });

  it('large bill with many rounding points', () => {
    const bs = createBillSplitter();
    for (let i = 0; i < 10; i++) bs.addPerson(`p${i}`);
    for (let i = 0; i < 30; i++) {
      bs.addItem({
        id: `item${i}`,
        name: `Item${i}`,
        price: round2(Math.PI * (i + 1)), // irrational-ish prices
        personId: `p${i % 10}`,
      });
    }
    bs.setDefaultTaxRate(0.0925);
    bs.setTipPercent(0.22);
    bs.addDiscount({ id: 'd1', type: 'percentage', value: 0.05, itemIds: [], preTax: true });
    const result = bs.calculate();
    assertSumInvariant(result);
    assertNoNegativeTotals(result);
  });
});
