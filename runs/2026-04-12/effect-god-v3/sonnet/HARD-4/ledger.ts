import crypto from "crypto";

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
}

export interface JournalEntry {
  id: string;
  description: string;
  timestamp: number;
  lines: JournalLine[];
}

export interface JournalLine {
  accountId: string;
  amount: number;
  currency: string;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
}

export interface BalanceSheet {
  assets: { accountId: string; balance: number; currency: string }[];
  liabilities: { accountId: string; balance: number; currency: string }[];
  equity: { accountId: string; balance: number; currency: string }[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
    Object.setPrototypeOf(this, LedgerError.prototype);
  }
}

export function createLedger(config: {
  reportingCurrency: string;
  staleRateThresholdMs: number;
}): {
  createAccount(account: Account): void;
  setRate(rate: ExchangeRate): void;
  getRate(from: string, to: string): ExchangeRate | null;
  postEntry(entry: Omit<JournalEntry, "id">): string;
  getBalance(accountId: string): number;
  getBalanceIn(accountId: string, currency: string, atTime: number): number;
  balanceSheet(atTime: number): BalanceSheet;
  getEntries(accountId: string): JournalEntry[];
  settle(
    liabilityAccountId: string,
    assetAccountId: string,
    amount: number,
    timestamp: number
  ): string;
} {
  if (config.staleRateThresholdMs <= 0) {
    throw new LedgerError("staleRateThresholdMs must be > 0");
  }

  const accounts = new Map<string, Account>();
  const journalEntries: JournalEntry[] = [];
  // key: "FROM:TO", value: latest ExchangeRate
  const rates = new Map<string, ExchangeRate>();

  function round4(n: number): number {
    return Number(n.toFixed(4));
  }

  function rateKey(from: string, to: string): string {
    return `${from}:${to}`;
  }

  /**
   * Returns the best available rate from `from` to `to`:
   * - Checks direct rate first
   * - Falls back to inverse of the reverse rate
   * - Returns null if neither exists
   * - For same currency, returns synthetic rate of 1
   */
  function getLatestRate(from: string, to: string): ExchangeRate | null {
    if (from === to) {
      return { from, to, rate: 1, timestamp: Number.MAX_SAFE_INTEGER };
    }

    const direct = rates.get(rateKey(from, to));
    const inverseBase = rates.get(rateKey(to, from));

    const inverse: ExchangeRate | null = inverseBase
      ? { from, to, rate: 1 / inverseBase.rate, timestamp: inverseBase.timestamp }
      : null;

    if (!direct && !inverse) return null;
    if (!direct) return inverse!;
    if (!inverse) return direct;

    // Both exist — prefer the one with the later timestamp
    return direct.timestamp >= inverseBase!.timestamp ? direct : inverse;
  }

  function isStale(rate: ExchangeRate, entryTimestamp: number): boolean {
    return entryTimestamp - rate.timestamp > config.staleRateThresholdMs;
  }

  /**
   * Converts `amount` in `currency` to the reporting currency.
   * Throws LedgerError if no rate found or if rate is stale (when throwOnStale=true).
   */
  function toReporting(
    amount: number,
    currency: string,
    entryTimestamp: number,
    throwOnStale: boolean
  ): number {
    if (currency === config.reportingCurrency) return amount;

    const rate = getLatestRate(currency, config.reportingCurrency);
    if (!rate) {
      throw new LedgerError(
        `No exchange rate available for ${currency} -> ${config.reportingCurrency}`
      );
    }
    if (throwOnStale && isStale(rate, entryTimestamp)) {
      throw new LedgerError(
        `Exchange rate for ${currency} -> ${config.reportingCurrency} is stale`
      );
    }
    return round4(amount * rate.rate);
  }

  const ledger = {
    createAccount(account: Account): void {
      if (!account.id) throw new LedgerError("Account ID must be non-empty");
      if (!account.currency) throw new LedgerError("Currency code must be non-empty");
      if (accounts.has(account.id)) {
        throw new LedgerError(`Account '${account.id}' already exists`);
      }
      accounts.set(account.id, { ...account });
    },

    setRate(rate: ExchangeRate): void {
      if (rate.rate <= 0) throw new LedgerError("Exchange rate must be > 0");
      if (!rate.from || !rate.to) throw new LedgerError("Currency codes must be non-empty");

      const key = rateKey(rate.from, rate.to);
      const existing = rates.get(key);
      // Only update if new rate is at least as recent
      if (!existing || rate.timestamp >= existing.timestamp) {
        rates.set(key, { ...rate });
      }
    },

    getRate(from: string, to: string): ExchangeRate | null {
      if (from === to) {
        return { from, to, rate: 1, timestamp: Date.now() };
      }
      return getLatestRate(from, to);
    },

    postEntry(entry: Omit<JournalEntry, "id">): string {
      if (entry.lines.length < 2) {
        throw new LedgerError("Journal entry must have at least 2 lines");
      }

      // Validate all accounts exist
      for (const line of entry.lines) {
        if (!accounts.has(line.accountId)) {
          throw new LedgerError(`Account '${line.accountId}' does not exist`);
        }
      }

      // Balance check: all lines converted to reporting currency must sum to zero
      let sum = 0;
      for (const line of entry.lines) {
        sum += toReporting(line.amount, line.currency, entry.timestamp, true);
      }

      const roundedSum = round4(sum);
      if (Math.abs(roundedSum) > 0.0001) {
        throw new LedgerError(
          `Journal entry is not balanced: reporting-currency sum = ${roundedSum}`
        );
      }

      const id = crypto.randomUUID();
      journalEntries.push({
        id,
        description: entry.description,
        timestamp: entry.timestamp,
        lines: entry.lines.map((l) => ({ ...l })),
      });
      return id;
    },

    getBalance(accountId: string): number {
      if (!accounts.has(accountId)) {
        throw new LedgerError(`Account '${accountId}' does not exist`);
      }
      let balance = 0;
      for (const entry of journalEntries) {
        for (const line of entry.lines) {
          if (line.accountId === accountId) {
            balance += line.amount;
          }
        }
      }
      return round4(balance);
    },

    getBalanceIn(accountId: string, currency: string, atTime: number): number {
      if (!accounts.has(accountId)) {
        throw new LedgerError(`Account '${accountId}' does not exist`);
      }
      const account = accounts.get(accountId)!;
      const balance = ledger.getBalance(accountId);

      if (account.currency === currency) return balance;

      const rate = getLatestRate(account.currency, currency);
      if (!rate) {
        throw new LedgerError(
          `No exchange rate available for ${account.currency} -> ${currency}`
        );
      }
      if (isStale(rate, atTime)) {
        throw new LedgerError(
          `Exchange rate for ${account.currency} -> ${currency} is stale`
        );
      }
      return round4(balance * rate.rate);
    },

    balanceSheet(atTime: number): BalanceSheet {
      const assetItems: { accountId: string; balance: number; currency: string }[] = [];
      const liabilityItems: { accountId: string; balance: number; currency: string }[] = [];
      const equityItems: { accountId: string; balance: number; currency: string }[] = [];

      // Raw sums in reporting currency (natural signs preserved)
      let rawAssets = 0;
      let rawLiabilities = 0;
      let rawEquity = 0;
      let hasStaleOrMissing = false;

      for (const account of accounts.values()) {
        const balance = ledger.getBalance(account.id);
        const item = { accountId: account.id, balance, currency: account.currency };

        let converted: number;
        if (account.currency === config.reportingCurrency) {
          converted = balance;
        } else {
          const rate = getLatestRate(account.currency, config.reportingCurrency);
          if (!rate) {
            hasStaleOrMissing = true;
            converted = 0;
          } else {
            if (isStale(rate, atTime)) {
              hasStaleOrMissing = true;
            }
            converted = round4(balance * rate.rate);
          }
        }

        if (account.type === "asset") {
          assetItems.push(item);
          rawAssets += converted;
        } else if (account.type === "liability") {
          liabilityItems.push(item);
          rawLiabilities += converted;
        } else {
          // equity, revenue, expense — all affect owners' equity
          equityItems.push(item);
          rawEquity += converted;
        }
      }

      // Assets have natural positive balances.
      // Liabilities and equity have natural negative balances (credits).
      // Negate so that balance sheet totals are positive and satisfy:
      //   totalAssets = totalLiabilities + totalEquity
      const totalAssets = round4(rawAssets);
      const totalLiabilities = round4(-rawLiabilities);
      const totalEquity = round4(-rawEquity);

      const isBalanced =
        !hasStaleOrMissing &&
        Math.abs(totalAssets - (totalLiabilities + totalEquity)) <= 0.01;

      return {
        assets: assetItems,
        liabilities: liabilityItems,
        equity: equityItems,
        totalAssets,
        totalLiabilities,
        totalEquity,
        isBalanced,
      };
    },

    getEntries(accountId: string): JournalEntry[] {
      if (!accounts.has(accountId)) {
        throw new LedgerError(`Account '${accountId}' does not exist`);
      }
      return journalEntries.filter((e) => e.lines.some((l) => l.accountId === accountId));
    },

    settle(
      liabilityAccountId: string,
      assetAccountId: string,
      amount: number,
      timestamp: number
    ): string {
      if (amount <= 0) throw new LedgerError("Settlement amount must be > 0");

      const liabilityAcc = accounts.get(liabilityAccountId);
      const assetAcc = accounts.get(assetAccountId);

      if (!liabilityAcc) {
        throw new LedgerError(`Account '${liabilityAccountId}' does not exist`);
      }
      if (!assetAcc) {
        throw new LedgerError(`Account '${assetAccountId}' does not exist`);
      }
      if (liabilityAcc.type !== "liability") {
        throw new LedgerError(
          `Account '${liabilityAccountId}' is not a liability account (type: ${liabilityAcc.type})`
        );
      }
      if (assetAcc.type !== "asset") {
        throw new LedgerError(
          `Account '${assetAccountId}' is not an asset account (type: ${assetAcc.type})`
        );
      }

      let lines: JournalLine[];

      if (liabilityAcc.currency === assetAcc.currency) {
        // Same currency — debit liability, credit asset by equal amounts
        lines = [
          { accountId: liabilityAccountId, amount: amount, currency: liabilityAcc.currency },
          { accountId: assetAccountId, amount: -amount, currency: assetAcc.currency },
        ];
      } else {
        // Different currencies — convert liability amount to asset currency
        const rate = getLatestRate(liabilityAcc.currency, assetAcc.currency);
        if (!rate) {
          throw new LedgerError(
            `No exchange rate for ${liabilityAcc.currency} -> ${assetAcc.currency}`
          );
        }
        if (isStale(rate, timestamp)) {
          throw new LedgerError(
            `Exchange rate for ${liabilityAcc.currency} -> ${assetAcc.currency} is stale`
          );
        }
        const convertedAmount = round4(amount * rate.rate);
        lines = [
          { accountId: liabilityAccountId, amount: amount, currency: liabilityAcc.currency },
          { accountId: assetAccountId, amount: -convertedAmount, currency: assetAcc.currency },
        ];
      }

      return ledger.postEntry({
        description: `Settlement: ${liabilityAccountId} -> ${assetAccountId}`,
        timestamp,
        lines,
      });
    },
  };

  return ledger;
}