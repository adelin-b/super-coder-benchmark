# HARD-4: Multi-Currency Double-Entry Ledger

## Overview
Implement a double-entry bookkeeping ledger that supports multiple currencies, currency conversion with rate staleness detection, and maintains the fundamental accounting equation at all times. The ledger must handle rounding correctly across conversions and support partial settlements.

## Exported API

```ts
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;          // ISO 4217 code (e.g., 'USD', 'EUR')
}

export interface JournalEntry {
  id: string;
  description: string;
  timestamp: number;
  lines: JournalLine[];
}

export interface JournalLine {
  accountId: string;
  amount: number;            // positive = debit, negative = credit
  currency: string;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;              // 1 unit of `from` = `rate` units of `to`
  timestamp: number;
}

export interface BalanceSheet {
  assets: { accountId: string; balance: number; currency: string }[];
  liabilities: { accountId: string; balance: number; currency: string }[];
  equity: { accountId: string; balance: number; currency: string }[];
  totalAssets: number;       // in reporting currency
  totalLiabilities: number;  // in reporting currency
  totalEquity: number;       // in reporting currency
  isBalanced: boolean;       // totalAssets === totalLiabilities + totalEquity
}

export class LedgerError extends Error {}

export function createLedger(config: {
  reportingCurrency: string;
  staleRateThresholdMs: number;  // rates older than this are "stale"
}): {
  /** Create an account. */
  createAccount(account: Account): void;

  /** Set an exchange rate. */
  setRate(rate: ExchangeRate): void;

  /** Get the latest rate between two currencies. Returns null if not set. */
  getRate(from: string, to: string): ExchangeRate | null;

  /**
   * Post a journal entry. All lines must sum to zero (balanced).
   * Throws LedgerError if unbalanced, if accounts don't exist,
   * or if cross-currency conversion uses a stale rate.
   */
  postEntry(entry: Omit<JournalEntry, 'id'>): string;

  /** Get account balance in its native currency. */
  getBalance(accountId: string): number;

  /**
   * Get account balance converted to target currency.
   * Throws LedgerError if rate is stale or missing.
   */
  getBalanceIn(accountId: string, currency: string, atTime: number): number;

  /** Generate balance sheet in the reporting currency at given time. */
  balanceSheet(atTime: number): BalanceSheet;

  /** Get all journal entries for an account. */
  getEntries(accountId: string): JournalEntry[];

  /**
   * Settle a liability partially or fully.
   * Creates a journal entry debiting the liability and crediting the asset.
   * Returns the settlement entry ID.
   */
  settle(liabilityAccountId: string, assetAccountId: string, amount: number, timestamp: number): string;
};
```

## Detailed Requirements

### Double-Entry Rule
Every journal entry must have lines that sum to exactly zero. Positive amounts are debits, negative amounts are credits.

For different account types, the natural balance direction is:
- **Assets, Expenses**: increased by debits (positive)
- **Liabilities, Equity, Revenue**: increased by credits (negative)

`getBalance` returns the natural balance: sum of all line amounts for that account. For assets, a positive balance means you have assets. For liabilities, a negative balance means you owe money.

### Multi-Currency Journal Entries
A single journal entry can have lines in different currencies. When this happens:
- The entry is balanced if, when all amounts are converted to the reporting currency using the latest rates, they sum to zero.
- The conversion must use rates that are not stale (age <= `staleRateThresholdMs` relative to the entry's timestamp).
- Rounding: all amounts are rounded to 4 decimal places (banker's rounding / round half to even).

### Exchange Rates
- Rates are directional: setting USD->EUR does not automatically set EUR->USD.
- However, `getRate` should check for the inverse if the direct rate is not available. If only USD->EUR is set at rate R, then EUR->USD should return rate 1/R (with the same timestamp).
- Transitive rates are NOT supported. If you need GBP->JPY, you must have a direct rate (or its inverse). You cannot chain GBP->USD->JPY.

### Staleness
- A rate is stale if `entryTimestamp - rate.timestamp > staleRateThresholdMs`.
- Posting an entry with stale rates throws `LedgerError`.
- `getBalanceIn` with stale rates throws `LedgerError`.
- `balanceSheet` uses the latest available rates and flags `isBalanced: false` if any rate is stale.

### Settlement
`settle` creates a journal entry that:
- Debits (positive line) the liability account by `amount` (reducing the liability).
- Credits (negative line) the asset account by `amount` (reducing the asset).
- If the accounts are in different currencies, converts using the latest rate at the settlement timestamp. Throws if the rate is stale.
- Throws if `amount` <= 0, if accounts don't exist, or if the liability account is not type 'liability' or the asset account is not type 'asset'.

### Validation
- Account IDs must be unique and non-empty.
- Currency codes must be non-empty strings.
- `staleRateThresholdMs` must be > 0.
- `rate` in ExchangeRate must be > 0.
- Journal entry must have at least 2 lines.
- All account IDs in journal lines must exist.

### Rounding
Use banker's rounding (round half to even) to 4 decimal places for all currency conversions:
- 2.55005 -> 2.5500 (round down, 0 is even)
- 2.55015 -> 2.5502 (round up, 2 is even)
- Standard: `Number(amount.toFixed(4))` is acceptable as an approximation.

## Invariants
1. After every `postEntry`, the sum of all account balances converted to reporting currency equals zero (within rounding tolerance of 0.01).
2. `balanceSheet.isBalanced` is true when totalAssets === totalLiabilities + totalEquity (within rounding tolerance).
3. Every journal entry's lines sum to zero (in reporting currency).
4. `getBalance` returns the sum of all line amounts for that account.
5. No entry can be posted with stale exchange rates.
