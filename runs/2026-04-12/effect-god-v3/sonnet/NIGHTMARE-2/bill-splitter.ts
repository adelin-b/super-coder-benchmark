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
    this.name = "BillError";
    Object.setPrototypeOf(this, BillError.prototype);
  }
}

export function createBillSplitter(): {
  addPerson(id: string): void;
  addItem(item: Item): void;
  addDiscount(discount: Discount): void;
  setTaxRate(itemId: string, rate: number): void;
  setDefaultTaxRate(rate: number): void;
  setTipPercent(pct: number): void;
  splitSharedItem(itemId: string, personIds: string[]): void;
  calculate(): BillResult;
} {
  const persons = new Set<string>();
  const items = new Map<string, Item>();
  const discounts: Discount[] = [];
  const itemTaxRates = new Map<string, number>();
  let defaultTaxRate = 0;
  let tipPercent = 0;
  const sharedItems = new Map<string, string[]>();

  function r2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  return {
    addPerson(id: string): void {
      if (persons.has(id)) throw new BillError(`Duplicate person ID: ${id}`);
      persons.add(id);
    },

    addItem(item: Item): void {
      if (items.has(item.id)) throw new BillError(`Duplicate item ID: ${item.id}`);
      if (!persons.has(item.personId)) throw new BillError(`Person ${item.personId} not registered`);
      if (item.price < 0) throw new BillError(`Item price cannot be negative`);
      items.set(item.id, { ...item });
    },

    addDiscount(discount: Discount): void {
      discounts.push({ ...discount });
    },

    setTaxRate(itemId: string, rate: number): void {
      if (!items.has(itemId)) throw new BillError(`Item ${itemId} not found`);
      if (rate < 0 || rate > 1) throw new BillError(`Tax rate must be between 0 and 1`);
      itemTaxRates.set(itemId, rate);
    },

    setDefaultTaxRate(rate: number): void {
      if (rate < 0 || rate > 1) throw new BillError(`Tax rate must be between 0 and 1`);
      defaultTaxRate = rate;
    },

    setTipPercent(pct: number): void {
      if (pct < 0) throw new BillError(`Tip percent cannot be negative`);
      tipPercent = pct;
    },

    splitSharedItem(itemId: string, personIds: string[]): void {
      if (!items.has(itemId)) throw new BillError(`Item ${itemId} not found`);
      for (const pid of personIds) {
        if (!persons.has(pid)) throw new BillError(`Person ${pid} not registered`);
      }
      sharedItems.set(itemId, [...personIds]);
    },

    calculate(): BillResult {
      if (persons.size === 0) throw new BillError("No persons registered");
      if (items.size === 0) throw new BillError("No items added");

      // Step 1: Build item assignments with share prices
      type Assignment = { personId: string; sharePrice: number };
      const itemAssignments = new Map<string, Assignment[]>();

      for (const [itemId, item] of items) {
        const sharers = sharedItems.get(itemId);
        if (sharers && sharers.length > 0) {
          const K = sharers.length;
          const totalCents = Math.round(item.price * 100);
          const baseShareCents = Math.floor(totalCents / K);
          const remainderCents = totalCents - K * baseShareCents;
          const assignments: Assignment[] = [];
          for (let i = 0; i < K; i++) {
            const cents = baseShareCents + (i < remainderCents ? 1 : 0);
            assignments.push({ personId: sharers[i], sharePrice: cents / 100 });
          }
          itemAssignments.set(itemId, assignments);
        } else {
          itemAssignments.set(itemId, [{ personId: item.personId, sharePrice: item.price }]);
        }
      }

      // Compute originalTotal
      const originalTotal = r2(Array.from(items.values()).reduce((s, i) => s + i.price, 0));

      // Step 2: Compute per-item discounts
      const preTaxDiscByItem = new Map<string, number>();
      const postTaxDiscByItem = new Map<string, number>();
      for (const id of items.keys()) {
        preTaxDiscByItem.set(id, 0);
        postTaxDiscByItem.set(id, 0);
      }

      for (const discount of discounts) {
        const qualIds = discount.itemIds.length > 0
          ? discount.itemIds.filter(id => items.has(id))
          : Array.from(items.keys());
        if (qualIds.length === 0) continue;

        const discMap = discount.preTax ? preTaxDiscByItem : postTaxDiscByItem;

        if (discount.type === 'percentage') {
          for (const id of qualIds) {
            const d = r2(items.get(id)!.price * discount.value);
            discMap.set(id, r2((discMap.get(id) ?? 0) + d));
          }
        } else if (discount.type === 'fixed') {
          const totalQualPrice = qualIds.reduce((s, id) => s + items.get(id)!.price, 0);
          if (totalQualPrice === 0) continue;

          const fixedCents = Math.round(discount.value * 100);
          const perItemCents = new Map<string, number>();
          let allocCents = 0;

          for (const id of qualIds) {
            const cents = Math.round(fixedCents * items.get(id)!.price / totalQualPrice);
            perItemCents.set(id, cents);
            allocCents += cents;
          }

          const remCents = fixedCents - allocCents;
          if (remCents !== 0) {
            let maxPrice = -Infinity;
            let maxId = qualIds[0];
            for (const id of qualIds) {
              if (items.get(id)!.price > maxPrice) {
                maxPrice = items.get(id)!.price;
                maxId = id;
              }
            }
            perItemCents.set(maxId, (perItemCents.get(maxId) ?? 0) + remCents);
          }

          for (const [id, cents] of perItemCents) {
            discMap.set(id, r2((discMap.get(id) ?? 0) + cents / 100));
          }
        } else if (discount.type === 'bogo') {
          let minPrice = Infinity;
          let minId = qualIds[0];
          for (const id of qualIds) {
            if (items.get(id)!.price < minPrice) {
              minPrice = items.get(id)!.price;
              minId = id;
            }
          }
          discMap.set(minId, r2((discMap.get(minId) ?? 0) + items.get(minId)!.price));
        }
      }

      // Compute per-person amounts
      const pSubtotal = new Map<string, number>();
      const pPreTaxDisc = new Map<string, number>();
      const pPostTaxDisc = new Map<string, number>();
      const pTax = new Map<string, number>();

      for (const pid of persons) {
        pSubtotal.set(pid, 0);
        pPreTaxDisc.set(pid, 0);
        pPostTaxDisc.set(pid, 0);
        pTax.set(pid, 0);
      }

      for (const [itemId, assignments] of itemAssignments) {
        const item = items.get(itemId)!;
        const taxRate = itemTaxRates.get(itemId) ?? defaultTaxRate;
        const totalPre = preTaxDiscByItem.get(itemId) ?? 0;
        const totalPost = postTaxDiscByItem.get(itemId) ?? 0;

        for (const { personId, sharePrice } of assignments) {
          // Step 1 subtotal accumulation
          pSubtotal.set(personId, r2((pSubtotal.get(personId) ?? 0) + sharePrice));

          // Distribute discounts proportionally by share
          const ratio = item.price > 0 ? sharePrice / item.price : 0;
          const personPre = r2(totalPre * ratio);
          const personPost = r2(totalPost * ratio);

          pPreTaxDisc.set(personId, r2((pPreTaxDisc.get(personId) ?? 0) + personPre));
          pPostTaxDisc.set(personId, r2((pPostTaxDisc.get(personId) ?? 0) + personPost));

          // Step 3: Tax on (sharePrice - personPreTaxDisc)
          const taxBase = Math.max(0, sharePrice - personPre);
          const tax = r2(taxBase * taxRate);
          pTax.set(personId, r2((pTax.get(personId) ?? 0) + tax));
        }
      }

      // Step 4: Tip per person on pre-discount subtotals
      const pTip = new Map<string, number>();
      for (const [pid, subtotal] of pSubtotal) {
        pTip.set(pid, r2(tipPercent * subtotal));
      }

      // Step 6: Compute per-person totals
      const pTotal = new Map<string, number>();
      for (const pid of persons) {
        const sub = pSubtotal.get(pid) ?? 0;
        const pre = pPreTaxDisc.get(pid) ?? 0;
        const post = pPostTaxDisc.get(pid) ?? 0;
        const tax = pTax.get(pid) ?? 0;
        const tip = pTip.get(pid) ?? 0;
        pTotal.set(pid, r2(sub - pre + tax + tip - post));
      }

      // Compute grand totals
      const taxTotal = r2(Array.from(pTax.values()).reduce((s, v) => s + v, 0));
      const tipTotal = r2(Array.from(pTip.values()).reduce((s, v) => s + v, 0));
      const discountTotal = r2(
        Array.from(preTaxDiscByItem.values()).reduce((s, v) => s + v, 0) +
        Array.from(postTaxDiscByItem.values()).reduce((s, v) => s + v, 0)
      );
      const grandTotal = r2(originalTotal + taxTotal + tipTotal - discountTotal);

      // Step 7: Minimum charge redistribution
      let converged = false;
      for (let iter = 0; iter < 100; iter++) {
        const negatives = Array.from(pTotal.entries()).filter(([, t]) => t < -0.001);
        if (negatives.length === 0) {
          converged = true;
          break;
        }

        let excess = 0;
        for (const [pid, t] of negatives) {
          excess = r2(excess + Math.abs(t));
          pTotal.set(pid, 0);
        }

        const positives = Array.from(pTotal.entries()).filter(([, t]) => t > 0.001);
        const posSum = positives.reduce((s, [, t]) => s + t, 0);

        if (posSum <= 0) {
          converged = true;
          break;
        }

        let remaining = excess;
        for (let i = 0; i < positives.length; i++) {
          const [pid, t] = positives[i];
          if (i === positives.length - 1) {
            pTotal.set(pid, r2(t + remaining));
          } else {
            const share = r2(excess * (t / posSum));
            pTotal.set(pid, r2(t + share));
            remaining = r2(remaining - share);
          }
        }
      }

      if (!converged) {
        throw new BillError("Redistribution did not converge after 100 iterations");
      }

      // Step 8: Reconciliation — enforce sum(shares) === grandTotal exactly
      const sumTotals = Array.from(pTotal.values()).reduce((s, v) => s + v, 0);
      const diffCents = Math.round((grandTotal - sumTotals) * 100);

      if (Math.abs(diffCents) > 100) {
        throw new BillError(`Reconciliation diff ${diffCents} cents exceeds $1.00 — logic error`);
      }

      if (diffCents !== 0) {
        // Sort descending by total, ties broken by personId alphabetically
        const sortedPids = Array.from(persons).sort((a, b) => {
          const ta = pTotal.get(a) ?? 0;
          const tb = pTotal.get(b) ?? 0;
          const d = tb - ta;
          if (Math.abs(d) > 0.001) return d > 0 ? 1 : -1;
          return a < b ? -1 : 1;
        });

        const absDiff = Math.abs(diffCents);
        const dir = diffCents > 0 ? 0.01 : -0.01;
        for (let i = 0; i < absDiff; i++) {
          const pid = sortedPids[i % sortedPids.length];
          pTotal.set(pid, r2((pTotal.get(pid) ?? 0) + dir));
        }
      }

      // Build result
      const shares: PersonShare[] = Array.from(persons).map(pid => ({
        personId: pid,
        subtotal: pSubtotal.get(pid) ?? 0,
        taxAmount: pTax.get(pid) ?? 0,
        tipAmount: pTip.get(pid) ?? 0,
        discountAmount: r2((pPreTaxDisc.get(pid) ?? 0) + (pPostTaxDisc.get(pid) ?? 0)),
        total: pTotal.get(pid) ?? 0,
      }));

      return { originalTotal, taxTotal, tipTotal, discountTotal, grandTotal, shares };
    },
  };
}