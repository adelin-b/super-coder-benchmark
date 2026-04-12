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

  const RC = config.reportingCurrency;
  const accountsMap = new Map<string, Account>();
  const ratesMap = new Map<string, ExchangeRate>();
  const balances = new Map<string, number>();
  const accountEntryMap = new Map<string, JournalEntry[]>();

  function round4(n: number): number {
    return Number(n.toFixed(4));
  }

  function getRateInternal(from: string, to: string): ExchangeRate | null {
    if (from === to) return null;
    const direct = ratesMap.get(`${from}:${to}`);
    if (direct) return direct;
    const inv = ratesMap.get(`${to}:${from}`);
    if (inv) {
      return { from, to, rate: 1 / inv.rate, timestamp: inv.timestamp };
    }
    return null;
  }

  function isStale(rateTimestamp: number, refTimestamp: number): boolean {
    return refTimestamp - rateTimestamp > config.staleRateThresholdMs;
  }

  function postEntryInternal(entry: Omit<JournalEntry, "id">): string {
    if (entry.lines.length < 2) {
      throw new LedgerError("Journal entry must have at least 2 lines");
    }

    for (const line of entry.lines) {
      if (!accountsMap.has(line.accountId)) {
        throw new LedgerError(`Account ${line.accountId} does not exist`);
      }
    }

    // Balance check: sum of all lines converted to reporting currency must ≈ 0
    let sum = 0;
    for (const line of entry.lines) {
      if (line.currency === RC) {
        sum += line.amount;
      } else {
        const rate = getRateInternal(line.currency, RC);
        if (!rate) {
          throw new LedgerError(
            `No exchange rate for ${line.currency} -> ${RC}`
          );
        }
        if (isStale(rate.timestamp, entry.timestamp)) {
          throw new LedgerError(
            `Exchange rate ${line.currency} -> ${RC} is stale`
          );
        }
        sum += round4(line.amount * rate.rate);
      }
    }

    if (Math.abs(round4(sum)) > 0.01) {
      throw new LedgerError(
        `Journal entry is not balanced (reporting sum: ${sum})`
      );
    }

    const id = crypto.randomUUID();
    const fullEntry: JournalEntry = {
      id,
      description: entry.description,
      timestamp: entry.timestamp,
      lines: entry.lines.map((l) => ({ ...l })),
    };

    for (const line of entry.lines) {
      const prev = balances.get(line.accountId) ?? 0;
      balances.set(line.accountId, round4(prev + line.amount));
      accountEntryMap.get(line.accountId)!.push(fullEntry);
    }

    return id;
  }

  return {
    createAccount(account: Account): void {
      if (!account.id || account.id.trim() === "") {
        throw new LedgerError("Account ID must be non-empty");
      }
      if (!account.currency || account.currency.trim() === "") {
        throw new LedgerError("Currency must be non-empty");
      }
      if (accountsMap.has(account.id)) {
        throw new LedgerError(`Account ${account.id} already exists`);
      }
      accountsMap.set(account.id, { ...account });
      balances.set(account.id, 0);
      accountEntryMap.set(account.id, []);
    },

    setRate(rate: ExchangeRate): void {
      if (rate.rate <= 0) {
        throw new LedgerError("Exchange rate must be > 0");
      }
      const key = `${rate.from}:${rate.to}`;
      const existing = ratesMap.get(key);
      if (!existing || rate.timestamp >= existing.timestamp) {
        ratesMap.set(key, { ...rate });
      }
    },

    getRate(from: string, to: string): ExchangeRate | null {
      if (from === to) return null;
      return getRateInternal(from, to);
    },

    postEntry(entry: Omit<JournalEntry, "id">): string {
      return postEntryInternal(entry);
    },

    getBalance(accountId: string): number {
      if (!accountsMap.has(accountId)) {
        throw new LedgerError(`Account ${accountId} does not exist`);
      }
      return balances.get(accountId) ?? 0;
    },

    getBalanceIn(accountId: string, currency: string, atTime: number): number {
      if (!accountsMap.has(accountId)) {
        throw new LedgerError(`Account ${accountId} does not exist`);
      }
      const account = accountsMap.get(accountId)!;
      const balance = balances.get(accountId) ?? 0;

      if (account.currency === currency) return balance;

      const rate = getRateInternal(account.currency, currency);
      if (!rate) {
        throw new LedgerError(
          `No exchange rate for ${account.currency} -> ${currency}`
        );
      }
      if (isStale(rate.timestamp, atTime)) {
        throw new LedgerError(
          `Exchange rate ${account.currency} -> ${currency} is stale`
        );
      }
      return round4(balance * rate.rate);
    },

    balanceSheet(atTime: number): BalanceSheet {
      const assetsList: { accountId: string; balance: number; currency: string }[] = [];
      const liabilitiesList: { accountId: string; balance: number; currency: string }[] = [];
      const equityList: { accountId: string; balance: number; currency: string }[] = [];

      let totalAssetsSum = 0;
      let totalLiabilitiesSum = 0;
      let totalEquitySum = 0;
      let hasIssue = false;

      for (const [accountId, account] of accountsMap) {
        const type = account.type;
        if (type !== "asset" && type !== "liability" && type !== "equity") continue;

        const balance = balances.get(accountId) ?? 0;
        const item = { accountId, balance, currency: account.currency };

        let inReporting: number;
        if (account.currency === RC) {
          inReporting = balance;
        } else {
          const rate = getRateInternal(account.currency, RC);
          if (!rate) {
            hasIssue = true;
            inReporting = 0;
          } else {
            inReporting = round4(balance * rate.rate);
            if (isStale(rate.timestamp, atTime)) {
              hasIssue = true;
            }
          }
        }

        if (type === "asset") {
          assetsList.push(item);
          totalAssetsSum += inReporting;
        } else if (type === "liability") {
          liabilitiesList.push(item);
          totalLiabilitiesSum += inReporting;
        } else {
          equityList.push(item);
          totalEquitySum += inReporting;
        }
      }

      const totalAssets = round4(totalAssetsSum);
      // Liabilities and equity have negative raw balances (credits increase them).
      // Negate for conventional display as positive figures in the balance sheet.
      const totalLiabilities = round4(-totalLiabilitiesSum);
      const totalEquity = round4(-totalEquitySum);

      // Accounting equation: Assets = Liabilities + Equity (all positive)
      const isBalanced =
        !hasIssue &&
        Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

      return {
        assets: assetsList,
        liabilities: liabilitiesList,
        equity: equityList,
        totalAssets,
        totalLiabilities,
        totalEquity,
        isBalanced,
      };
    },

    getEntries(accountId: string): JournalEntry[] {
      if (!accountsMap.has(accountId)) {
        throw new LedgerError(`Account ${accountId} does not exist`);
      }
      return [...(accountEntryMap.get(accountId) ?? [])];
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
      if (!accountsMap.has(liabilityAccountId)) {
        throw new LedgerError(`Account ${liabilityAccountId} does not exist`);
      }
      if (!accountsMap.has(assetAccountId)) {
        throw new LedgerError(`Account ${assetAccountId} does not exist`);
      }

      const liabilityAcct = accountsMap.get(liabilityAccountId)!;
      const assetAcct = accountsMap.get(assetAccountId)!;

      if (liabilityAcct.type !== "liability") {
        throw new LedgerError(
          `Account ${liabilityAccountId} is not a liability account`
        );
      }
      if (assetAcct.type !== "asset") {
        throw new LedgerError(
          `Account ${assetAccountId} is not an asset account`
        );
      }

      let assetCreditAmount: number;

      if (liabilityAcct.currency === assetAcct.currency) {
        assetCreditAmount = amount;
      } else {
        const rate = getRateInternal(liabilityAcct.currency, assetAcct.currency);
        if (!rate) {
          throw new LedgerError(
            `No exchange rate for ${liabilityAcct.currency} -> ${assetAcct.currency}`
          );
        }
        if (isStale(rate.timestamp, timestamp)) {
          throw new LedgerError(
            `Exchange rate ${liabilityAcct.currency} -> ${assetAcct.currency} is stale`
          );
        }
        assetCreditAmount = round4(amount * rate.rate);
      }

      return postEntryInternal({
        description: `Settlement: ${liabilityAccountId} -> ${assetAccountId}`,
        timestamp,
        lines: [
          {
            accountId: liabilityAccountId,
            amount: amount,
            currency: liabilityAcct.currency,
          },
          {
            accountId: assetAccountId,
            amount: -assetCreditAmount,
            currency: assetAcct.currency,
          },
        ],
      });
    },
  };
}