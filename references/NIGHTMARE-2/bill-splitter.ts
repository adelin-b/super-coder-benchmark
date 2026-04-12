export interface Item {
  id: string;
  name: string;
  price: number;
  personId: string;
}

export interface Discount {
  id: string;
  type: 'percentage' | 'fixed' | 'bogo';
  value: number;
  itemIds: string[];
  preTax: boolean;
}

export interface PersonShare {
  personId: string;
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  discountAmount: number;
  total: number;
}

export interface BillResult {
  originalTotal: number;
  taxTotal: number;
  tipTotal: number;
  discountTotal: number;
  grandTotal: number;
  shares: PersonShare[];
}

export class BillError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'BillError';
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface InternalItemAllocation {
  itemId: string;
  personId: string;
  amount: number;  // this person's share of the item price
}

export function createBillSplitter() {
  const persons = new Set<string>();
  const items = new Map<string, Item>();
  const discounts: Discount[] = [];
  const taxRates = new Map<string, number>(); // itemId -> rate
  let defaultTaxRate = 0;
  let tipPercent = 0;
  // itemId -> personIds[] (shared items)
  const sharedItems = new Map<string, string[]>();

  return {
    addPerson(id: string): void {
      if (persons.has(id)) throw new BillError(`Person ${id} already exists`);
      persons.add(id);
    },

    addItem(item: Item): void {
      if (items.has(item.id)) throw new BillError(`Item ${item.id} already exists`);
      if (!persons.has(item.personId)) throw new BillError(`Person ${item.personId} does not exist`);
      if (item.price < 0) throw new BillError('Item price must be >= 0');
      items.set(item.id, { ...item });
    },

    addDiscount(discount: Discount): void {
      if (discount.value < 0) throw new BillError('Discount value must be >= 0');
      discounts.push({ ...discount, itemIds: [...discount.itemIds] });
    },

    setTaxRate(itemId: string, rate: number): void {
      if (!items.has(itemId)) throw new BillError(`Item ${itemId} does not exist`);
      if (rate < 0 || rate > 1) throw new BillError('Tax rate must be between 0 and 1');
      taxRates.set(itemId, rate);
    },

    setDefaultTaxRate(rate: number): void {
      if (rate < 0 || rate > 1) throw new BillError('Tax rate must be between 0 and 1');
      defaultTaxRate = rate;
    },

    setTipPercent(pct: number): void {
      if (pct < 0) throw new BillError('Tip percent must be >= 0');
      tipPercent = pct;
    },

    splitSharedItem(itemId: string, personIds: string[]): void {
      if (!items.has(itemId)) throw new BillError(`Item ${itemId} does not exist`);
      for (const pid of personIds) {
        if (!persons.has(pid)) throw new BillError(`Person ${pid} does not exist`);
      }
      sharedItems.set(itemId, [...personIds]);
    },

    calculate(): BillResult {
      if (persons.size === 0) throw new BillError('No persons added');
      if (items.size === 0) throw new BillError('No items added');

      // Step 1: Compute base allocations (who owns what portion of each item)
      const allocations: InternalItemAllocation[] = [];

      for (const [itemId, item] of items) {
        const shared = sharedItems.get(itemId);
        if (shared && shared.length > 0) {
          // Shared item: split among persons
          const k = shared.length;
          const baseShare = round2(item.price / k);
          let distributed = 0;

          for (let i = 0; i < k; i++) {
            let amount: number;
            if (i < k - 1) {
              amount = baseShare;
            } else {
              // Last person gets remainder to ensure exact total
              amount = round2(item.price - distributed);
            }
            allocations.push({ itemId, personId: shared[i], amount });
            distributed = round2(distributed + amount);
          }
        } else {
          allocations.push({ itemId, personId: item.personId, amount: item.price });
        }
      }

      // Step 2: Apply pre-tax discounts
      // Track discount amount per person
      const preTaxDiscountPerPerson = new Map<string, number>();
      const postTaxDiscountPerPerson = new Map<string, number>();
      for (const pid of persons) {
        preTaxDiscountPerPerson.set(pid, 0);
        postTaxDiscountPerPerson.set(pid, 0);
      }

      // Track adjusted item amounts per allocation (after pre-tax discounts)
      const adjustedAmounts = new Map<string, number>(); // key: `${itemId}:${personId}`
      for (const alloc of allocations) {
        adjustedAmounts.set(`${alloc.itemId}:${alloc.personId}`, alloc.amount);
      }

      for (const discount of discounts) {
        const qualifyingItemIds = discount.itemIds.length > 0
          ? discount.itemIds.filter(id => items.has(id))
          : [...items.keys()];

        if (discount.type === 'bogo') {
          // BOGO: free cheapest qualifying item
          let cheapestId: string | null = null;
          let cheapestPrice = Infinity;
          for (const id of qualifyingItemIds) {
            const item = items.get(id)!;
            if (item.price < cheapestPrice) {
              cheapestPrice = item.price;
              cheapestId = id;
            }
          }
          if (cheapestId) {
            // Discount = full price of cheapest item, distributed to whoever has it
            const relevantAllocs = allocations.filter(a => a.itemId === cheapestId);
            for (const alloc of relevantAllocs) {
              const discountAmt = alloc.amount;
              const target = discount.preTax ? preTaxDiscountPerPerson : postTaxDiscountPerPerson;
              target.set(alloc.personId, round2((target.get(alloc.personId) ?? 0) + discountAmt));

              if (discount.preTax) {
                const key = `${alloc.itemId}:${alloc.personId}`;
                adjustedAmounts.set(key, round2((adjustedAmounts.get(key) ?? 0) - discountAmt));
              }
            }
          }
        } else if (discount.type === 'percentage') {
          // Percentage discount on each qualifying item
          for (const id of qualifyingItemIds) {
            const relevantAllocs = allocations.filter(a => a.itemId === id);
            for (const alloc of relevantAllocs) {
              const discountAmt = round2(alloc.amount * discount.value);
              const target = discount.preTax ? preTaxDiscountPerPerson : postTaxDiscountPerPerson;
              target.set(alloc.personId, round2((target.get(alloc.personId) ?? 0) + discountAmt));

              if (discount.preTax) {
                const key = `${alloc.itemId}:${alloc.personId}`;
                adjustedAmounts.set(key, round2((adjustedAmounts.get(key) ?? 0) - discountAmt));
              }
            }
          }
        } else if (discount.type === 'fixed') {
          // Fixed discount split proportionally across qualifying items
          const totalQualifyingPrice = qualifyingItemIds.reduce(
            (sum, id) => sum + items.get(id)!.price, 0
          );
          if (totalQualifyingPrice <= 0) continue;

          let discountRemaining = discount.value;
          const sortedIds = [...qualifyingItemIds].sort((a, b) =>
            items.get(b)!.price - items.get(a)!.price
          );

          for (let idx = 0; idx < sortedIds.length; idx++) {
            const id = sortedIds[idx];
            const item = items.get(id)!;
            let itemDiscount: number;

            if (idx === sortedIds.length - 1) {
              // Last item gets remainder
              itemDiscount = round2(discountRemaining);
            } else {
              itemDiscount = round2(discount.value * (item.price / totalQualifyingPrice));
              discountRemaining = round2(discountRemaining - itemDiscount);
            }

            // Distribute this item's discount to the person(s) who have it
            const relevantAllocs = allocations.filter(a => a.itemId === id);
            const totalAllocAmount = relevantAllocs.reduce((s, a) => s + a.amount, 0);

            for (const alloc of relevantAllocs) {
              const share = totalAllocAmount > 0 ? alloc.amount / totalAllocAmount : 1 / relevantAllocs.length;
              const personDiscount = round2(itemDiscount * share);
              const target = discount.preTax ? preTaxDiscountPerPerson : postTaxDiscountPerPerson;
              target.set(alloc.personId, round2((target.get(alloc.personId) ?? 0) + personDiscount));

              if (discount.preTax) {
                const key = `${alloc.itemId}:${alloc.personId}`;
                adjustedAmounts.set(key, round2((adjustedAmounts.get(key) ?? 0) - personDiscount));
              }
            }
          }
        }
      }

      // Step 3: Compute per-person per-item tax on adjusted amounts
      const taxPerPerson = new Map<string, number>();
      for (const pid of persons) taxPerPerson.set(pid, 0);

      for (const alloc of allocations) {
        const rate = taxRates.get(alloc.itemId) ?? defaultTaxRate;
        const key = `${alloc.itemId}:${alloc.personId}`;
        const adjustedAmount = Math.max(0, adjustedAmounts.get(key) ?? alloc.amount);
        const tax = round2(adjustedAmount * rate);
        taxPerPerson.set(alloc.personId, round2((taxPerPerson.get(alloc.personId) ?? 0) + tax));
      }

      // Step 4: Compute per-person tip on ORIGINAL (pre-discount) subtotals
      const subtotalPerPerson = new Map<string, number>();
      for (const pid of persons) subtotalPerPerson.set(pid, 0);
      for (const alloc of allocations) {
        subtotalPerPerson.set(
          alloc.personId,
          round2((subtotalPerPerson.get(alloc.personId) ?? 0) + alloc.amount)
        );
      }

      const tipPerPerson = new Map<string, number>();
      for (const pid of persons) {
        const personSubtotal = subtotalPerPerson.get(pid) ?? 0;
        tipPerPerson.set(pid, round2(tipPercent * personSubtotal));
      }

      // Step 5: Compute per-person total
      const originalTotal = round2([...items.values()].reduce((s, item) => s + item.price, 0));

      let taxTotal = 0;
      for (const t of taxPerPerson.values()) taxTotal = round2(taxTotal + t);

      let tipTotal = 0;
      for (const t of tipPerPerson.values()) tipTotal = round2(tipTotal + t);

      let discountTotal = 0;
      for (const d of preTaxDiscountPerPerson.values()) discountTotal = round2(discountTotal + d);
      for (const d of postTaxDiscountPerPerson.values()) discountTotal = round2(discountTotal + d);

      // Build per-person shares
      const shares: PersonShare[] = [];
      for (const pid of persons) {
        const subtotal = subtotalPerPerson.get(pid) ?? 0;
        const taxAmount = taxPerPerson.get(pid) ?? 0;
        const tipAmount = tipPerPerson.get(pid) ?? 0;
        const rawDiscount = round2(
          (preTaxDiscountPerPerson.get(pid) ?? 0) + (postTaxDiscountPerPerson.get(pid) ?? 0)
        );
        const preDiscountTotal = round2(subtotal + taxAmount + tipAmount);
        // Effective discount capped: can't discount more than person owes
        const discountAmount = round2(Math.min(rawDiscount, preDiscountTotal));
        const total = round2(preDiscountTotal - discountAmount);
        shares.push({ personId: pid, subtotal, taxAmount, tipAmount, discountAmount, total });
      }

      // Recompute actual discount total and grand total based on effective discounts
      discountTotal = shares.reduce((sum, s) => round2(sum + s.discountAmount), 0);
      const grandTotal = round2(originalTotal + taxTotal + tipTotal - discountTotal);

      // Step 6: Apply minimum charge (no negative totals) — should already be handled
      // by capping discounts above, but handle redistribution for safety
      let iterations = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const negativeShares = shares.filter(s => s.total < 0);
        if (negativeShares.length === 0) break;
        if (iterations++ >= 100) throw new BillError('Redistribution did not converge');

        let excessToRedistribute = 0;
        for (const s of negativeShares) {
          excessToRedistribute = round2(excessToRedistribute + Math.abs(s.total));
          s.total = 0;
        }

        const positiveShares = shares.filter(s => s.total > 0);
        const totalPositive = positiveShares.reduce((sum, s) => sum + s.total, 0);
        if (totalPositive <= 0) break;

        for (const s of positiveShares) {
          const proportion = s.total / totalPositive;
          s.total = round2(s.total + round2(excessToRedistribute * proportion));
        }
      }

      // Step 7: Reconciliation — enforce sum invariant
      let currentSum = shares.reduce((sum, s) => round2(sum + s.total), 0);
      let diff = round2(grandTotal - currentSum);

      if (Math.abs(diff) > 1.00) {
        throw new BillError(`Reconciliation diff too large: ${diff}`);
      }

      // Add/remove pennies to/from largest shares
      while (Math.abs(diff) >= 0.005) {
        // Sort by total descending, then by personId for deterministic tie-breaking
        shares.sort((a, b) => {
          if (b.total !== a.total) return b.total - a.total;
          return a.personId.localeCompare(b.personId);
        });

        if (diff > 0) {
          shares[0].total = round2(shares[0].total + 0.01);
          diff = round2(diff - 0.01);
        } else {
          shares[0].total = round2(shares[0].total - 0.01);
          diff = round2(diff + 0.01);
        }
      }

      // Sort shares by personId for consistent output
      shares.sort((a, b) => a.personId.localeCompare(b.personId));

      return {
        originalTotal,
        taxTotal,
        tipTotal,
        discountTotal,
        grandTotal,
        shares,
      };
    },
  };
}
