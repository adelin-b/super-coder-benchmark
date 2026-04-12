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
  constructor(msg: string) {
    super(msg);
    this.name = "LedgerError";
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
  const rates = new Map<string, ExchangeRate>();
  const entries: JournalEntry[] = [];

  function round4(n: number): number {
    return Number(n.toFixed(4));
  }

  // Returns a rate object (with synthetic timestamp for same-currency), or null if unavailable.
  function getRateInternal(from: string, to: string): ExchangeRate | null {
    if (from === to) {
      // Synthetic same-currency rate — never stale
      return { from, to, rate: 1, timestamp: Number.NEGATIVE_INFINITY };
    }
    const direct = rates.get(`${from}|${to}`);
    if (direct) return { ...direct };
    const inverse = rates.get(`${to}|${from}`);
    if (inverse) {
      return { from, to, rate: 1 / inverse.rate, timestamp: inverse.timestamp };
    }
    return null;
  }

  function isRateStale(rate: ExchangeRate, atTime: number): boolean {
    // Same-currency synthetic rate is never stale
    if (rate.from === rate.to) return false;
    // Synthetic sentinel for same-currency (extra guard)
    if (rate.timestamp === Number.NEGATIVE_INFINITY) return false;
    return atTime - rate.timestamp > config.staleRateThresholdMs;
  }

  function convertToReporting(
    amount: number,
    currency: string,
    atTime: number,
    checkStale: boolean
  ): number {
    if (currency === config.reportingCurrency) return amount;
    const rate = getRateInternal(currency, config.reportingCurrency);
    if (!rate) {
      throw new LedgerError(
        `No exchange rate available for ${currency} -> ${config.reportingCurrency}`
      );
    }
    if (checkStale && isRateStale(rate, atTime)) {
      throw new LedgerError(
        `Exchange rate ${currency} -> ${config.reportingCurrency} is stale`
      );
    }
    return round4(amount * rate.rate);
  }

  function computeRawBalance(accountId: string): number {
    let balance = 0;
    for (const entry of entries) {
      for (const line of entry.lines) {
        if (line.accountId === accountId) {
          balance += line.amount;
        }
      }
    }
    return balance;
  }

  return {
    createAccount(account: Account): void {
      if (!account.id) throw new LedgerError("Account ID must be non-empty");
      if (!account.currency) throw new LedgerError("Currency must be non-empty");
      if (accounts.has(account.id)) {
        throw new LedgerError(`Account ${account.id} already exists`);
      }
      accounts.set(account.id, { ...account });
    },

    setRate(rate: ExchangeRate): void {
      if (!rate.from || !rate.to) {
        throw new LedgerError("Currency codes must be non-empty");
      }
      if (rate.rate <= 0) {
        throw new LedgerError("Exchange rate must be > 0");
      }
      rates.set(`${rate.from}|${rate.to}`, { ...rate });
    },

    getRate(from: string, to: string): ExchangeRate | null {
      // Same-currency has no "set" rate
      if (from === to) return null;
      return getRateInternal(from, to);
    },

    postEntry(entry: Omit<JournalEntry, "id">): string {
      if (entry.lines.length < 2) {
        throw new LedgerError("Journal entry must have at least 2 lines");
      }

      // Validate all account IDs exist
      for (const line of entry.lines) {
        if (!accounts.has(line.accountId)) {
          throw new LedgerError(`Account ${line.accountId} does not exist`);
        }
      }

      const currencies = new Set(entry.lines.map((l) => l.currency));

      if (currencies.size === 1) {
        // Single-currency: lines must sum to exactly zero
        const sum = entry.lines.reduce((s, l) => s + l.amount, 0);
        if (Math.abs(sum) > 1e-9) {
          throw new LedgerError("Journal entry lines do not sum to zero");
        }
      } else {
        // Multi-currency: convert all lines to reporting currency and verify balance
        // Also enforces staleness check on any rates needed
        let reportingSum = 0;
        for (const line of entry.lines) {
          reportingSum += convertToReporting(
            line.amount,
            line.currency,
            entry.timestamp,
            true
          );
        }
        if (Math.abs(reportingSum) > 0.001) {
          throw new LedgerError(
            "Journal entry lines do not sum to zero in reporting currency"
          );
        }
      }

      const id = crypto.randomUUID();
      entries.push({
        ...entry,
        id,
        lines: entry.lines.map((l) => ({ ...l })),
      });
      return id;
    },

    getBalance(accountId: string): number {
      if (!accounts.has(accountId)) {
        throw new LedgerError(`Account ${accountId} does not exist`);
      }
      return round4(computeRawBalance(accountId));
    },

    getBalanceIn(accountId: string, currency: string, atTime: number): number {
      if (!accounts.has(accountId)) {
        throw new LedgerError(`Account ${accountId} does not exist`);
      }
      const account = accounts.get(accountId)!;
      const balance = computeRawBalance(accountId);

      if (account.currency === currency) return round4(balance);

      const rate = getRateInternal(account.currency, currency);
      if (!rate) {
        throw new LedgerError(
          `No exchange rate available for ${account.currency} -> ${currency}`
        );
      }
      if (isRateStale(rate, atTime)) {
        throw new LedgerError(
          `Exchange rate ${account.currency} -> ${currency} is stale`
        );
      }
      return round4(balance * rate.rate);
    },

    balanceSheet(atTime: number): BalanceSheet {
      const assetList: { accountId: string; balance: number; currency: string }[] = [];
      const liabilityList: { accountId: string; balance: number; currency: string }[] = [];
      const equityList: { accountId: string; balance: number; currency: string }[] = [];

      let rawTotalAssets = 0;
      let rawTotalLiabilities = 0;
      let rawTotalEquity = 0;
      let hasStaleOrMissingRate = false;

      for (const [id, account] of accounts) {
        if (!["asset", "liability", "equity"].includes(account.type)) continue;

        const balance = round4(computeRawBalance(id));

        let reportingBalance: number;
        if (account.currency === config.reportingCurrency) {
          reportingBalance = balance;
        } else {
          const rate = getRateInternal(account.currency, config.reportingCurrency);
          if (!rate) {
            hasStaleOrMissingRate = true;
            reportingBalance = 0;
          } else {
            if (isRateStale(rate, atTime)) {
              hasStaleOrMissingRate = true;
            }
            reportingBalance = round4(balance * rate.rate);
          }
        }

        if (account.type === "asset") {
          assetList.push({ accountId: id, balance, currency: account.currency });
          rawTotalAssets += reportingBalance;
        } else if (account.type === "liability") {
          liabilityList.push({ accountId: id, balance, currency: account.currency });
          rawTotalLiabilities += reportingBalance;
        } else if (account.type === "equity") {
          equityList.push({ accountId: id, balance, currency: account.currency });
          rawTotalEquity += reportingBalance;
        }
      }

      // totalAssets: sum of asset balances in reporting (positive for healthy assets)
      // totalLiabilities: magnitude of liability balances (negate raw negative balance)
      // totalEquity: magnitude of equity balances (negate raw negative balance)
      // Standard accounting equation: Assets = Liabilities + Equity
      const totalAssets = round4(rawTotalAssets);
      const totalLiabilities = round4(-rawTotalLiabilities);
      const totalEquity = round4(-rawTotalEquity);

      const isBalanced =
        !hasStaleOrMissingRate &&
        Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.01;

      return {
        assets: assetList,
        liabilities: liabilityList,
        equity: equityList,
        totalAssets,
        totalLiabilities,
        totalEquity,
        isBalanced,
      };
    },

    getEntries(accountId: string): JournalEntry[] {
      if (!accounts.has(accountId)) {
        throw new LedgerError(`Account ${accountId} does not exist`);
      }
      return entries
        .filter((e) => e.lines.some((l) => l.accountId === accountId))
        .map((e) => ({ ...e, lines: e.lines.map((l) => ({ ...l })) }));
    },

    settle(
      liabilityAccountId: string,
      assetAccountId: string,
      amount: number,
      timestamp: number
    ): string {
      if (amount <= 0) {
        throw new LedgerError("Settlement amount must be > 0");
      }

      const liabAccount = accounts.get(liabilityAccountId);
      const assetAccount = accounts.get(assetAccountId);

      if (!liabAccount) {
        throw new LedgerError(`Account ${liabilityAccountId} does not exist`);
      }
      if (!assetAccount) {
        throw new LedgerError(`Account ${assetAccountId} does not exist`);
      }
      if (liabAccount.type !== "liability") {
        throw new LedgerError(
          `Account ${liabilityAccountId} is not a liability account`
        );
      }
      if (assetAccount.type !== "asset") {
        throw new LedgerError(
          `Account ${assetAccountId} is not an asset account`
        );
      }

      const liabCurrency = liabAccount.currency;
      const assetCurrency = assetAccount.currency;

      // Determine the asset-side amount (in asset currency)
      let assetAmount: number;
      if (liabCurrency === assetCurrency) {
        assetAmount = amount;
      } else {
        const rate = getRateInternal(liabCurrency, assetCurrency);
        if (!rate) {
          throw new LedgerError(
            `No exchange rate available for ${liabCurrency} -> ${assetCurrency}`
          );
        }
        if (isRateStale(rate, timestamp)) {
          throw new LedgerError(
            `Exchange rate ${liabCurrency} -> ${assetCurrency} is stale`
          );
        }
        assetAmount = round4(amount * rate.rate);
      }

      // Debit liability (positive line) reduces liability balance
      // Credit asset (negative line) reduces asset balance
      const id = crypto.randomUUID();
      entries.push({
        id,
        description: `Settlement of ${liabilityAccountId} via ${assetAccountId}`,
        timestamp,
        lines: [
          { accountId: liabilityAccountId, amount, currency: liabCurrency },
          { accountId: assetAccountId, amount: -assetAmount, currency: assetCurrency },
        ],
      });
      return id;
    },
  };
}