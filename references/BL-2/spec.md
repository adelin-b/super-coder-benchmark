# BL-2: Invoice Line Item Calculator

## Spec
Calculate invoice line items with quantity, unit price, tax rate, and discount.
Support multiple tax rates, percentage and fixed discounts, rounding to cents.

## Interface
```typescript
interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;      // decimal, e.g. 0.20 for 20% VAT
  discount?: { type: 'percentage' | 'fixed'; value: number };
}

interface InvoiceResult {
  lines: Array<{
    subtotal: number;    // quantity * unitPrice
    discountAmount: number;
    taxableAmount: number; // subtotal - discountAmount
    taxAmount: number;
    total: number;       // taxableAmount + taxAmount
  }>;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
}

function calculateInvoice(items: LineItem[]): InvoiceResult;
```

## Invariants
1. grandTotal === sum of line totals
2. Each line total === taxableAmount + taxAmount
3. taxableAmount >= 0 (discount can't exceed subtotal)
4. All amounts rounded to 2 decimal places

## Known Bugs
1. **tax_on_discount**: Apply tax to subtotal instead of taxableAmount (over-taxes)
2. **discount_exceeds_subtotal**: Percentage discount > 100% makes taxableAmount negative
3. **rounding_order**: Round at end instead of per-line → accumulation error
4. **fixed_discount_wrong_sign**: Fixed discount added instead of subtracted
