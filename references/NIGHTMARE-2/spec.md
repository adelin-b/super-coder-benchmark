# NIGHTMARE-2: Exact Bill Splitting with Cascading Adjustments

## Overview
Implement a restaurant bill splitter that handles tax, tip, discounts, shared items, minimum charges, and a final reconciliation pass ensuring the sum of individual shares equals the original total exactly (to the cent). The interplay of per-step rounding, pre-tax vs post-tax discounts, and the redistribution of negative shares creates circular adjustment chains that defeat naive left-to-right calculation.

## Exported API

```ts
export interface Item {
  id: string;
  name: string;
  price: number;       // in dollars, e.g. 12.99
  personId: string;    // who ordered it (before sharing)
}

export interface Discount {
  id: string;
  type: 'percentage' | 'fixed' | 'bogo';  // buy-one-get-one
  /** For 'percentage': decimal rate (0.10 = 10%). For 'fixed': dollar amount. For 'bogo': applies to cheapest qualifying item. */
  value: number;
  /** Which items this discount applies to (item IDs). Empty = all items. */
  itemIds: string[];
  /** If true, discount is applied pre-tax (reduces tax base). If false, applied post-tax. */
  preTax: boolean;
}

export interface PersonShare {
  personId: string;
  subtotal: number;      // pre-tax, pre-tip, pre-discount share
  taxAmount: number;
  tipAmount: number;
  discountAmount: number;
  total: number;         // final amount owed (can be 0, never negative after redistribution)
}

export interface BillResult {
  originalTotal: number;    // sum of all item prices
  taxTotal: number;
  tipTotal: number;
  discountTotal: number;
  grandTotal: number;       // originalTotal + taxTotal + tipTotal - discountTotal
  shares: PersonShare[];
}

export class BillError extends Error {}

export function createBillSplitter(): {
  addPerson(id: string): void;
  addItem(item: Item): void;
  addDiscount(discount: Discount): void;
  setTaxRate(itemId: string, rate: number): void;
  setDefaultTaxRate(rate: number): void;
  setTipPercent(pct: number): void;
  splitSharedItem(itemId: string, personIds: string[]): void;
  calculate(): BillResult;
};
```

## Detailed Requirements

### Persons
- `addPerson(id)` registers a person. Duplicate IDs throw `BillError`.
- At least one person must exist before `calculate()`. Throw `BillError` if no persons.

### Items
- `addItem(item)` adds a menu item assigned to a person.
- `item.personId` must refer to a registered person. Throw `BillError` if not.
- `item.price` must be >= 0. Throw `BillError` if negative.
- An item can later be shared via `splitSharedItem`.

### Tax
- `setTaxRate(itemId, rate)` sets a per-item tax rate (decimal, e.g. 0.08 for 8%).
- `setDefaultTaxRate(rate)` sets the default tax rate for items without a specific rate.
- Tax rate must be >= 0 and <= 1. Throw `BillError` otherwise.
- Tax is computed **per-person per-item**: for each item assigned to a person, `tax = round2(itemSharePrice * taxRate)`.
- **Critical**: tax is rounded per-person per-item, NOT aggregated then rounded. This produces different results.
- If an item is shared among K people, each person's tax is `round2((itemPrice / K) * taxRate)`, which may not sum to `round2(itemPrice * taxRate)`.

### Tip
- `setTipPercent(pct)` sets tip as a percentage of the pre-tax, pre-discount subtotal. `pct` is a decimal (0.18 = 18%).
- Tip must be >= 0. Throw `BillError` if negative.
- Tip is split proportionally by each person's share of the subtotal.
- Each person's tip: `round2(tipPercent * personSubtotal)`.
- **Critical**: rounding tip per-person means the sum of tips may not equal `round2(tipPercent * totalSubtotal)`.

### Discounts

#### Percentage Discount
- Reduces the price of specified items (or all items if `itemIds` is empty) by the given percentage.
- Applied to each item independently: `discountPerItem = round2(itemPrice * rate)`.

#### Fixed Discount
- A fixed dollar amount off the specified items. If multiple items, split proportionally by price.
- `discountPerItem = round2(fixedAmount * (itemPrice / totalQualifyingItemsPrice))`.
- The sum of per-item discounts must equal the fixed amount. Remainder pennies go to the most expensive item.

#### BOGO (Buy One Get One)
- Applies to the cheapest qualifying item among `itemIds`. That item becomes free.
- If the cheapest item is shared, each sharer gets their proportional discount.

#### Pre-Tax vs Post-Tax
- **Pre-tax discounts** reduce the item price BEFORE tax is calculated. Tax is computed on `(price - preTaxDiscount)`.
- **Post-tax discounts** reduce the total AFTER tax and tip are added.
- A pre-tax discount changes the tax base, which changes the per-person tax amount.

### Shared Items
- `splitSharedItem(itemId, personIds)` splits an item among the given persons.
- All personIds must be registered. The item's `personId` is replaced by the shared group.
- Split: each person's share = `round2(itemPrice / K)` where K = number of sharers.
- **Remainder distribution**: `itemPrice - K * round2(itemPrice / K)` pennies are distributed round-robin to sharers (first person in the list gets first extra penny).
- Tax on shared items: each person's tax = `round2(theirShare * taxRate)`.

### Minimum Charge
- Each person's final total (after tax, tip, discounts) cannot be below $0.
- If a discount makes someone's share negative, their share is set to $0 and the excess (absolute value of the negative amount) is **redistributed** to all other persons with positive shares, proportionally to their share sizes.
- **Critical**: redistribution may itself cause someone else's share to become negative (if they had a large discount). This requires iterative redistribution until all shares are >= 0.
- Maximum 100 iterations. Throw `BillError` if redistribution does not converge.

### Reconciliation (The Core Trap)
- **Invariant**: `sum(shares[].total) === grandTotal` exactly, to the cent.
- After computing all per-person totals, the sum may differ from `grandTotal` due to accumulated rounding.
- **Reconciliation pass**: compute `diff = grandTotal - sum(allTotals)`.
  - If `diff > 0`: add pennies ($0.01) one at a time to persons, starting with the person who has the **largest** total (ties broken by person ID alphabetically).
  - If `diff < 0`: remove pennies one at a time from persons with the **largest** total.
- The diff should be at most a few cents for typical bills. If `|diff| > $1.00`, throw `BillError` (indicates a logic error).

### Calculation Order
1. Compute base subtotals per person (including shared item splits).
2. Apply pre-tax discounts (adjust subtotals and track discount amounts).
3. Compute per-person per-item tax on adjusted subtotals.
4. Compute per-person tip on pre-discount subtotals (tip is on original prices, not discounted).
5. Apply post-tax discounts.
6. Compute per-person total = subtotal - preTaxDiscount + tax + tip - postTaxDiscount.
7. Apply minimum charge (redistribute negatives).
8. Reconciliation pass to enforce sum invariant.

### Validation
- Calling `calculate()` with no items throws `BillError`.
- Calling `calculate()` with no persons throws `BillError`.
- Duplicate item IDs throw `BillError`.
- `splitSharedItem` on non-existent item throws `BillError`.
- `setTaxRate` on non-existent item throws `BillError`.

## Invariants
1. `sum(shares[].total) === grandTotal` exactly.
2. All `shares[].total >= 0`.
3. `grandTotal === originalTotal + taxTotal + tipTotal - discountTotal`.
4. Each person's share breakdown: `total = subtotal + taxAmount + tipAmount - discountAmount` (before reconciliation adjustment).
5. Tax is always rounded per-person per-item.
6. Tip is always based on pre-discount subtotals.
