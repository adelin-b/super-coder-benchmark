import { Effect, Data, pipe } from "effect";

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

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
    this.name = 'LedgerError';
  }
}

export function createLedger(config: {
  reportingCurrency: string;
  staleRateThresholdMs: number;
}) {
  if (config.staleRateThresholdMs <= 0) {
    throw new LedgerError("staleRateThresholdMs must be > 0");
  }

  const accounts = new Map<string, Account>();
  const balances = new Map<string, number>();
  const entries: JournalEntry[] = [];
  const rates = new Map<string, ExchangeRate>();
  let entryIdCounter = 0;

  function rounding(value: number): number {
    return Number(value.toFixed(4));
  }

  function getRateKey(from: string, to: string): string {
    return `${from}->${to}`;
  }

  return {
    createAccount(account: Account): void {
      if (!account.id || !account.currency) {
        throw new LedgerError("Account ID and currency must be non-empty");
      }
      if (accounts.has(account.id)) {
        throw new LedgerError(`Account ${account.id} already exists`);
      }
      accounts.set(account.id, account);
      balances.set(account.id, 0);
    },

    setRate(rate: ExchangeRate): void {
      if (rate.rate <= 0) {
        throw new LedgerError("Exchange rate must be > 0");
      }
      rates.set(getRateKey(rate.from, rate.to), rate);
    },

    getRate(from: string, to: string): ExchangeRate | null {
      const direct = rates.get(getRateKey(from, to));
      if (direct) return direct;

      const inverse = rates.get(getRateKey(to, from));
      if (inverse) {
        return {
          from,
          to,
          rate: rounding(1 / inverse.rate),
          timestamp: inverse.timestamp,
        };
      }

      return null;
    },

    postEntry(entry: Omit<JournalEntry, 'id'>): string {
      if (entry.lines.length < 2) {
        throw new LedgerError("Journal entry must have at least 2 lines");
      }

      for (const line of entry.lines) {
        if (!accounts.has(line.accountId)) {
          throw new LedgerError(`Account ${line.accountId} does not exist`);
        }
      }

      let total = 0;
      for (const line of entry.lines) {
        if (line.currency === config.reportingCurrency) {
          total += line.amount;
        } else {
          const rate = (this as any).getRate(line.currency, config.reportingCurrency);
          if (!rate) {
            throw new LedgerError(`No rate from ${line.currency} to ${config.reportingCurrency}`);
          }
          if (entry.timestamp - rate.timestamp > config.staleRateThresholdMs) {
            throw new LedgerError(`Exchange rate is stale`);
          }
          total += rounding(line.amount * rate.rate);
        }
      }

      if (Math.abs(total) > 0.01) {
        throw new LedgerError("Journal entry is unbalanced");
      }

      const id = `entry-${entryIdCounter++}`;
      const fullEntry: JournalEntry = { ...entry, id };
      entries.push(fullEntry);

      for (const line of entry.lines) {
        const current = balances.get(line.accountId) || 0;
        balances.set(line.accountId, rounding(current + line.amount));
      }

      return id;
    },

    getBalance(accountId: string): number {
      if (!accounts.has(accountId)) {
        throw new LedgerError(`Account ${accountId} does not exist`);
      }
      return balances.get(accountId) || 0;
    },

    getBalanceIn(accountId: string, currency: string, atTime: number): number {
      const balance = (this as any).getBalance(accountId);
      const account = accounts.get(accountId);
      if (!account) {
        throw new LedgerError(`Account ${accountId} does not exist`);
      }

      if (account.currency === currency) {
        return balance;
      }

      const rate = (this as any).getRate(account.currency, currency);
      if (!rate) {
        throw new LedgerError(`No rate from ${account.currency} to ${currency}`);
      }
      if (atTime - rate.timestamp > config.staleRateThresholdMs) {
        throw new LedgerError(`Exchange rate is stale`);
      }

      return rounding(balance * rate.rate);
    },

    balanceSheet(atTime: number): BalanceSheet {
      const assets: BalanceSheet['assets'] = [];
      const liabilities: BalanceSheet['liabilities'] = [];
      const equity: BalanceSheet['equity'] = [];

      let totalAssetsValue = 0;
      let totalLiabilitiesValue = 0;
      let totalEquityValue = 0;
      let isBalanced = true;

      for (const [accountId, account] of accounts) {
        const balance = balances.get(accountId) || 0;
        let valueInReporting = balance;

        if (account.currency !== config.reportingCurrency) {
          const rate = (this as any).getRate(account.currency, config.reportingCurrency);
          if (!rate) {
            isBalanced = false;
            valueInReporting = 0;
          } else if (atTime - rate.timestamp > config.staleRateThresholdMs) {
            isBalanced = false;
            valueInReporting = 0;
          } else {
            valueInReporting = rounding(balance * rate.rate);
          }
        }

        if (account.type === 'asset') {
          assets.push({ accountId, balance, currency: account.currency });
          totalAssetsValue += valueInReporting;
        } else if (account.type === 'liability') {
          liabilities.push({ accountId, balance, currency: account.currency });
          totalLiabilitiesValue -= valueInReporting;
        } else {
          equity.push({ accountId, balance, currency: account.currency });
          totalEquityValue -= valueInReporting;
        }
      }

      totalAssetsValue = rounding(totalAssetsValue);
      totalLiabilitiesValue = rounding(totalLiabilitiesValue);
      totalEquityValue = rounding(totalEquityValue);

      const isBalancedCheck = Math.abs(totalAssetsValue - (totalLiabilitiesValue + totalEquityValue)) < 0.01;

      return {
        assets,
        liabilities,
        equity,
        totalAssets: totalAssetsValue,
        totalLiabilities: totalLiabilitiesValue,
        totalEquity: totalEquityValue,
        isBalanced: isBalanced && isBalancedCheck,
      };
    },

    getEntries(accountId: string): JournalEntry[] {
      return entries.filter((e) => e.lines.some((l) => l.accountId === accountId));
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

      const liabilityAccount = accounts.get(liabilityAccountId);
      const assetAccount = accounts.get(assetAccountId);

      if (!liabilityAccount || !assetAccount) {
        throw new LedgerError("Accounts do not exist");
      }

      if (liabilityAccount.type !== 'liability') {
        throw new LedgerError("First account must be a liability");
      }

      if (assetAccount.type !== 'asset') {
        throw new LedgerError("Second account must be an asset");
      }

      let liabilityAmount = amount;
      let assetAmount = -amount;

      if (liabilityAccount.currency !== assetAccount.currency) {
        const rate = (this as any).getRate(liabilityAccount.currency, assetAccount.currency);
        if (!rate) {
          throw new LedgerError(`No rate for settlement conversion`);
        }
        if (timestamp - rate.timestamp > config.staleRateThresholdMs) {
          throw new LedgerError(`Exchange rate is stale`);
        }
        assetAmount = -rounding(amount * rate.rate);
      }

      const entry: Omit<JournalEntry, 'id'> = {
        description: `Settlement of ${liabilityAccountId} with ${assetAccountId}`,
        timestamp,
        lines: [
          {
            accountId: liabilityAccountId,
            amount: liabilityAmount,
            currency: liabilityAccount.currency,
          },
          {
            accountId: assetAccountId,
            amount: assetAmount,
            currency: assetAccount.currency,
          },
        ],
      };

      return (this as any).postEntry(entry);
    },
  };
}