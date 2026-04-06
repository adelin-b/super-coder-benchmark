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

function round(amount: number): number {
  return Number(amount.toFixed(4));
}

export function createLedger(config: {
  reportingCurrency: string;
  staleRateThresholdMs: number;
}) {
  if (!config.reportingCurrency) {
    throw new LedgerError('Reporting currency must be non-empty');
  }
  if (config.staleRateThresholdMs <= 0) {
    throw new LedgerError('staleRateThresholdMs must be > 0');
  }

  const accounts = new Map<string, Account>();
  const rates = new Map<string, ExchangeRate>();
  const entries: JournalEntry[] = [];
  const balances = new Map<string, number>();

  function getRateKey(from: string, to: string): string {
    return `${from}:${to}`;
  }

  function getLatestRate(from: string, to: string): ExchangeRate | null {
    const directKey = getRateKey(from, to);
    if (rates.has(directKey)) {
      return rates.get(directKey)!;
    }
    const inverseKey = getRateKey(to, from);
    if (rates.has(inverseKey)) {
      const inverseRate = rates.get(inverseKey)!;
      return {
        from,
        to,
        rate: 1 / inverseRate.rate,
        timestamp: inverseRate.timestamp,
      };
    }
    return null;
  }

  function isRateStale(rate: ExchangeRate, entryTimestamp: number): boolean {
    return entryTimestamp - rate.timestamp > config.staleRateThresholdMs;
  }

  function convertToReportingCurrency(amount: number, currency: string, entryTimestamp: number): number {
    if (currency === config.reportingCurrency) {
      return amount;
    }
    const rate = getLatestRate(currency, config.reportingCurrency);
    if (!rate) {
      throw new LedgerError(`No exchange rate from ${currency} to ${config.reportingCurrency}`);
    }
    if (isRateStale(rate, entryTimestamp)) {
      throw new LedgerError(`Exchange rate from ${currency} to ${config.reportingCurrency} is stale`);
    }
    return round(amount * rate.rate);
  }

  return {
    createAccount(account: Account): void {
      if (!account.id || !account.currency) {
        throw new LedgerError('Account ID and currency must be non-empty');
      }
      if (accounts.has(account.id)) {
        throw new LedgerError(`Account ${account.id} already exists`);
      }
      accounts.set(account.id, account);
      balances.set(account.id, 0);
    },

    setRate(rate: ExchangeRate): void {
      if (rate.rate <= 0) {
        throw new LedgerError('Exchange rate must be > 0');
      }
      const key = getRateKey(rate.from, rate.to);
      rates.set(key, rate);
    },

    getRate(from: string, to: string): ExchangeRate | null {
      return getLatestRate(from, to);
    },

    postEntry(entry: Omit<JournalEntry, 'id'>): string {
      if (entry.lines.length < 2) {
        throw new LedgerError('Journal entry must have at least 2 lines');
      }

      for (const line of entry.lines) {
        if (!accounts.has(line.accountId)) {
          throw new LedgerError(`Account ${line.accountId} does not exist`);
        }
      }

      let totalInReportingCurrency = 0;
      for (const line of entry.lines) {
        const converted = convertToReportingCurrency(line.amount, line.currency, entry.timestamp);
        totalInReportingCurrency += converted;
      }

      if (Math.abs(totalInReportingCurrency) > 0.01) {
        throw new LedgerError(`Journal entry does not balance: sum is ${totalInReportingCurrency}`);
      }

      const id = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fullEntry: JournalEntry = {
        id,
        ...entry,
      };
      entries.push(fullEntry);

      for (const line of entry.lines) {
        const current = balances.get(line.accountId) || 0;
        balances.set(line.accountId, round(current + line.amount));
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
      if (!accounts.has(accountId)) {
        throw new LedgerError(`Account ${accountId} does not exist`);
      }
      const balance = balances.get(accountId) || 0;
      const account = accounts.get(accountId)!;
      return convertToReportingCurrency(balance, account.currency, atTime);
    },

    balanceSheet(atTime: number): BalanceSheet {
      const result: BalanceSheet = {
        assets: [],
        liabilities: [],
        equity: [],
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        isBalanced: false,
      };

      let hasStaleRate = false;

      for (const [accountId, account] of accounts) {
        const balance = balances.get(accountId) || 0;
        let convertedBalance = 0;

        try {
          convertedBalance = convertToReportingCurrency(balance, account.currency, atTime);
        } catch (e) {
          hasStaleRate = true;
          convertedBalance = balance;
        }

        const item = { accountId, balance, currency: account.currency };

        if (account.type === 'asset') {
          result.assets.push(item);
          result.totalAssets += convertedBalance;
        } else if (account.type === 'liability') {
          result.liabilities.push(item);
          result.totalLiabilities += convertedBalance;
        } else if (account.type === 'equity') {
          result.equity.push(item);
          result.totalEquity += convertedBalance;
        }
      }

      result.isBalanced = !hasStaleRate && Math.abs(result.totalAssets - (result.totalLiabilities + result.totalEquity)) < 0.01;
      return result;
    },

    getEntries(accountId: string): JournalEntry[] {
      if (!accounts.has(accountId)) {
        throw new LedgerError(`Account ${accountId} does not exist`);
      }
      return entries.filter(e => e.lines.some(l => l.accountId === accountId));
    },

    settle(liabilityAccountId: string, assetAccountId: string, amount: number, timestamp: number): string {
      if (amount <= 0) {
        throw new LedgerError('Settlement amount must be > 0');
      }

      if (!accounts.has(liabilityAccountId)) {
        throw new LedgerError(`Liability account ${liabilityAccountId} does not exist`);
      }
      if (!accounts.has(assetAccountId)) {
        throw new LedgerError(`Asset account ${assetAccountId} does not exist`);
      }

      const liabilityAccount = accounts.get(liabilityAccountId)!;
      const assetAccount = accounts.get(assetAccountId)!;

      if (liabilityAccount.type !== 'liability') {
        throw new LedgerError(`Account ${liabilityAccountId} is not a liability`);
      }
      if (assetAccount.type !== 'asset') {
        throw new LedgerError(`Account ${assetAccountId} is not an asset`);
      }

      let lines: JournalLine[] = [];

      if (liabilityAccount.currency === assetAccount.currency) {
        lines = [
          { accountId: liabilityAccountId, amount, currency: liabilityAccount.currency },
          { accountId: assetAccountId, amount: -amount, currency: assetAccount.currency },
        ];
      } else {
        const rate = getLatestRate(liabilityAccount.currency, assetAccount.currency);
        if (!rate) {
          throw new LedgerError(`No exchange rate from ${liabilityAccount.currency} to ${assetAccount.currency}`);
        }
        if (isRateStale(rate, timestamp)) {
          throw new LedgerError(`Exchange rate is stale`);
        }

        const assetAmount = round(amount * rate.rate);
        lines = [
          { accountId: liabilityAccountId, amount, currency: liabilityAccount.currency },
          { accountId: assetAccountId, amount: -assetAmount, currency: assetAccount.currency },
        ];
      }

      return this.postEntry({
        description: `Settlement of ${amount} from ${assetAccountId} to ${liabilityAccountId}`,
        timestamp,
        lines,
      });
    },
  };
}