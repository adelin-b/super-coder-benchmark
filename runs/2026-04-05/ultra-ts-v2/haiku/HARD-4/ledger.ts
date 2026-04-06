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
  if (!config.reportingCurrency) throw new LedgerError('reporting currency required');
  if (config.staleRateThresholdMs <= 0) throw new LedgerError('staleRateThresholdMs must be > 0');

  const accounts = new Map<string, Account>();
  const entries: JournalEntry[] = [];
  const rates = new Map<string, ExchangeRate>();
  let entryIdCounter = 0;

  function round(value: number): number {
    return Number(value.toFixed(4));
  }

  function generateId(): string {
    return String(++entryIdCounter);
  }

  function createAccount(account: Account): void {
    if (!account.id) throw new LedgerError('account id required');
    if (!account.name) throw new LedgerError('account name required');
    if (!account.currency) throw new LedgerError('currency required');
    if (accounts.has(account.id)) throw new LedgerError('account already exists');
    accounts.set(account.id, account);
  }

  function setRate(rate: ExchangeRate): void {
    if (!rate.from) throw new LedgerError('from currency required');
    if (!rate.to) throw new LedgerError('to currency required');
    if (rate.rate <= 0) throw new LedgerError('rate must be > 0');
    const key = `${rate.from}:${rate.to}`;
    rates.set(key, rate);
  }

  function getRate(from: string, to: string): ExchangeRate | null {
    const key = `${from}:${to}`;
    const directRate = rates.get(key);
    if (directRate) return directRate;

    const inverseKey = `${to}:${from}`;
    const inverseRate = rates.get(inverseKey);
    if (inverseRate) {
      return {
        from,
        to,
        rate: round(1 / inverseRate.rate),
        timestamp: inverseRate.timestamp,
      };
    }

    return null;
  }

  function isRateStale(rate: ExchangeRate, entryTimestamp: number): boolean {
    return entryTimestamp - rate.timestamp > config.staleRateThresholdMs;
  }

  function convertAmount(amount: number, rate: ExchangeRate): number {
    return round(amount * rate.rate);
  }

  function postEntry(entry: Omit<JournalEntry, 'id'>): string {
    if (!entry.description) throw new LedgerError('description required');
    if (!entry.lines || entry.lines.length < 2) throw new LedgerError('at least 2 lines required');

    for (const line of entry.lines) {
      if (!accounts.has(line.accountId)) {
        throw new LedgerError(`account ${line.accountId} does not exist`);
      }
    }

    let sum = 0;
    for (const line of entry.lines) {
      if (line.currency === config.reportingCurrency) {
        sum = round(sum + line.amount);
      } else {
        const rate = getRate(line.currency, config.reportingCurrency);
        if (!rate) throw new LedgerError(`rate ${line.currency}->${config.reportingCurrency} not found`);
        if (isRateStale(rate, entry.timestamp)) {
          throw new LedgerError(`rate ${line.currency}->${config.reportingCurrency} is stale`);
        }
        const converted = convertAmount(line.amount, rate);
        sum = round(sum + converted);
      }
    }

    if (Math.abs(sum) > 0.01) {
      throw new LedgerError(`entry not balanced: sum = ${sum}`);
    }

    const id = generateId();
    const fullEntry: JournalEntry = { ...entry, id };
    entries.push(fullEntry);

    return id;
  }

  function getBalance(accountId: string): number {
    if (!accounts.has(accountId)) throw new LedgerError(`account ${accountId} not found`);
    
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

  function getBalanceIn(accountId: string, currency: string, atTime: number): number {
    if (!accounts.has(accountId)) throw new LedgerError(`account ${accountId} not found`);
    
    const account = accounts.get(accountId)!;
    const nativeBalance = getBalance(accountId);
    
    if (account.currency === currency) {
      return nativeBalance;
    }

    const rate = getRate(account.currency, currency);
    if (!rate) throw new LedgerError(`rate ${account.currency}->${currency} not found`);
    if (isRateStale(rate, atTime)) {
      throw new LedgerError(`rate ${account.currency}->${currency} is stale`);
    }

    return convertAmount(nativeBalance, rate);
  }

  function balanceSheet(atTime: number): BalanceSheet {
    const assets: { accountId: string; balance: number; currency: string }[] = [];
    const liabilities: { accountId: string; balance: number; currency: string }[] = [];
    const equity: { accountId: string; balance: number; currency: string }[] = [];

    let anyRateStale = false;

    for (const [accountId, account] of accounts.entries()) {
      if (account.type === 'expense' || account.type === 'revenue') continue;

      const balance = getBalance(accountId);
      let balanceInReporting = balance;

      if (account.currency !== config.reportingCurrency) {
        const rate = getRate(account.currency, config.reportingCurrency);
        if (!rate) {
          anyRateStale = true;
          balanceInReporting = balance;
        } else if (isRateStale(rate, atTime)) {
          anyRateStale = true;
          balanceInReporting = convertAmount(balance, rate);
        } else {
          balanceInReporting = convertAmount(balance, rate);
        }
      }

      const reportedBalance = account.type === 'asset' ? balanceInReporting : -balanceInReporting;

      const entry = {
        accountId,
        balance: reportedBalance,
        currency: config.reportingCurrency,
      };

      if (account.type === 'asset') {
        assets.push(entry);
      } else if (account.type === 'liability') {
        liabilities.push(entry);
      } else if (account.type === 'equity') {
        equity.push(entry);
      }
    }

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
    const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);

    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) <= 0.01 && !anyRateStale;

    return {
      assets,
      liabilities,
      equity,
      totalAssets: round(totalAssets),
      totalLiabilities: round(totalLiabilities),
      totalEquity: round(totalEquity),
      isBalanced,
    };
  }

  function getEntries(accountId: string): JournalEntry[] {
    if (!accounts.has(accountId)) throw new LedgerError(`account ${accountId} not found`);
    
    return entries.filter(entry => entry.lines.some(line => line.accountId === accountId));
  }

  function settle(liabilityAccountId: string, assetAccountId: string, amount: number, timestamp: number): string {
    if (!accounts.has(liabilityAccountId)) {
      throw new LedgerError(`account ${liabilityAccountId} not found`);
    }
    if (!accounts.has(assetAccountId)) {
      throw new LedgerError(`account ${assetAccountId} not found`);
    }
    if (amount <= 0) throw new LedgerError('settlement amount must be > 0');

    const liabilityAccount = accounts.get(liabilityAccountId)!;
    const assetAccount = accounts.get(assetAccountId)!;

    if (liabilityAccount.type !== 'liability') {
      throw new LedgerError('first account must be a liability');
    }
    if (assetAccount.type !== 'asset') {
      throw new LedgerError('second account must be an asset');
    }

    const assetAmount = liabilityAccount.currency === assetAccount.currency
      ? amount
      : (() => {
        const rate = getRate(liabilityAccount.currency, assetAccount.currency);
        if (!rate) throw new LedgerError(`rate ${liabilityAccount.currency}->${assetAccount.currency} not found`);
        if (isRateStale(rate, timestamp)) {
          throw new LedgerError(`rate ${liabilityAccount.currency}->${assetAccount.currency} is stale`);
        }
        return convertAmount(amount, rate);
      })();

    const entry: Omit<JournalEntry, 'id'> = {
      description: `Settlement of ${amount} ${liabilityAccount.currency}`,
      timestamp,
      lines: [
        {
          accountId: liabilityAccountId,
          amount,
          currency: liabilityAccount.currency,
        },
        {
          accountId: assetAccountId,
          amount: -assetAmount,
          currency: assetAccount.currency,
        },
      ],
    };

    return postEntry(entry);
  }

  return {
    createAccount,
    setRate,
    getRate,
    postEntry,
    getBalance,
    getBalanceIn,
    balanceSheet,
    getEntries,
    settle,
  };
}