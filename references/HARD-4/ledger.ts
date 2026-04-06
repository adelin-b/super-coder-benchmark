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
  constructor(msg: string) {
    super(msg);
    this.name = 'LedgerError';
  }
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

let entryCounter = 0;

export function createLedger(config: {
  reportingCurrency: string;
  staleRateThresholdMs: number;
}) {
  if (config.staleRateThresholdMs <= 0) throw new LedgerError('staleRateThresholdMs must be > 0');

  const accounts = new Map<string, Account>();
  const rates = new Map<string, ExchangeRate>(); // key: "FROM->TO"
  const entries: JournalEntry[] = [];
  const accountEntries = new Map<string, JournalEntry[]>();

  function rateKey(from: string, to: string): string {
    return `${from}->${to}`;
  }

  function findRate(from: string, to: string): ExchangeRate | null {
    if (from === to) return { from, to, rate: 1, timestamp: Infinity };
    // Direct
    const direct = rates.get(rateKey(from, to));
    if (direct) return direct;
    // Inverse
    const inverse = rates.get(rateKey(to, from));
    if (inverse) return { from, to, rate: round4(1 / inverse.rate), timestamp: inverse.timestamp };
    return null;
  }

  function isStale(rate: ExchangeRate, atTime: number): boolean {
    if (rate.from === rate.to) return false; // same currency
    return atTime - rate.timestamp > config.staleRateThresholdMs;
  }

  function convert(amount: number, fromCurrency: string, toCurrency: string, atTime: number, throwOnStale: boolean): { converted: number; stale: boolean } {
    if (fromCurrency === toCurrency) return { converted: amount, stale: false };
    const rate = findRate(fromCurrency, toCurrency);
    if (!rate) {
      if (throwOnStale) throw new LedgerError(`No exchange rate from ${fromCurrency} to ${toCurrency}`);
      return { converted: amount, stale: true };
    }
    const stale = isStale(rate, atTime);
    if (stale && throwOnStale) {
      throw new LedgerError(`Exchange rate from ${fromCurrency} to ${toCurrency} is stale`);
    }
    return { converted: round4(amount * rate.rate), stale };
  }

  return {
    createAccount(account: Account): void {
      if (!account.id) throw new LedgerError('Account id must be non-empty');
      if (accounts.has(account.id)) throw new LedgerError(`Account ${account.id} already exists`);
      if (!account.currency) throw new LedgerError('Currency must be non-empty');
      accounts.set(account.id, { ...account });
      accountEntries.set(account.id, []);
    },

    setRate(rate: ExchangeRate): void {
      if (rate.rate <= 0) throw new LedgerError('Rate must be > 0');
      if (!rate.from || !rate.to) throw new LedgerError('Currency codes must be non-empty');
      rates.set(rateKey(rate.from, rate.to), { ...rate });
    },

    getRate(from: string, to: string): ExchangeRate | null {
      return findRate(from, to);
    },

    postEntry(entry: Omit<JournalEntry, 'id'>): string {
      if (!entry.lines || entry.lines.length < 2) {
        throw new LedgerError('Journal entry must have at least 2 lines');
      }

      // Validate accounts exist
      for (const line of entry.lines) {
        if (!accounts.has(line.accountId)) {
          throw new LedgerError(`Account ${line.accountId} does not exist`);
        }
      }

      // Check balance in reporting currency
      let sum = 0;
      for (const line of entry.lines) {
        const { converted } = convert(line.amount, line.currency, config.reportingCurrency, entry.timestamp, true);
        sum += converted;
      }

      if (Math.abs(round4(sum)) > 0.01) {
        throw new LedgerError(`Journal entry is unbalanced: sum = ${sum} in ${config.reportingCurrency}`);
      }

      entryCounter++;
      const id = `JE-${entryCounter}`;
      const fullEntry: JournalEntry = {
        id,
        description: entry.description,
        timestamp: entry.timestamp,
        lines: entry.lines.map(l => ({ ...l })),
      };

      entries.push(fullEntry);

      for (const line of fullEntry.lines) {
        accountEntries.get(line.accountId)!.push(fullEntry);
      }

      return id;
    },

    getBalance(accountId: string): number {
      if (!accounts.has(accountId)) throw new LedgerError(`Account ${accountId} does not exist`);
      const acct = accounts.get(accountId)!;
      let balance = 0;
      for (const entry of accountEntries.get(accountId)!) {
        for (const line of entry.lines) {
          if (line.accountId === accountId) {
            // Convert line to account's native currency if different
            if (line.currency === acct.currency) {
              balance += line.amount;
            } else {
              // Find rate at entry time - use the stored rate
              const rate = findRate(line.currency, acct.currency);
              if (rate) {
                balance += round4(line.amount * rate.rate);
              } else {
                balance += line.amount; // fallback, shouldn't happen for valid entries
              }
            }
          }
        }
      }
      return round4(balance);
    },

    getBalanceIn(accountId: string, currency: string, atTime: number): number {
      if (!accounts.has(accountId)) throw new LedgerError(`Account ${accountId} does not exist`);
      const nativeBalance = this.getBalance(accountId);
      const acct = accounts.get(accountId)!;
      const { converted } = convert(nativeBalance, acct.currency, currency, atTime, true);
      return converted;
    },

    balanceSheet(atTime: number): BalanceSheet {
      const assets: { accountId: string; balance: number; currency: string }[] = [];
      const liabilities: { accountId: string; balance: number; currency: string }[] = [];
      const equity: { accountId: string; balance: number; currency: string }[] = [];

      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;
      let anyStale = false;

      for (const [id, acct] of accounts) {
        const balance = this.getBalance(id);
        const entry = { accountId: id, balance, currency: acct.currency };

        const { converted, stale } = convert(balance, acct.currency, config.reportingCurrency, atTime, false);
        if (stale) anyStale = true;

        switch (acct.type) {
          case 'asset':
            assets.push(entry);
            totalAssets += converted;
            break;
          case 'liability':
            liabilities.push(entry);
            totalLiabilities += converted;
            break;
          case 'equity':
            equity.push(entry);
            totalEquity += converted;
            break;
          case 'revenue':
            // Revenue increases equity
            equity.push(entry);
            totalEquity += converted;
            break;
          case 'expense':
            // Expenses decrease equity (but are tracked as assets-like debit accounts)
            // In a simple model, expenses reduce equity
            equity.push(entry);
            totalEquity += converted;
            break;
        }
      }

      totalAssets = round4(totalAssets);
      totalLiabilities = round4(totalLiabilities);
      totalEquity = round4(totalEquity);

      // Assets = Liabilities + Equity
      // Note: liabilities are stored as negative (credits), equity as negative (credits)
      // So totalAssets + totalLiabilities + totalEquity should be ~0
      const isBalanced = !anyStale && Math.abs(totalAssets + totalLiabilities + totalEquity) <= 0.01;

      return {
        assets,
        liabilities,
        equity,
        totalAssets,
        totalLiabilities: totalLiabilities,
        totalEquity: totalEquity,
        isBalanced,
      };
    },

    getEntries(accountId: string): JournalEntry[] {
      if (!accounts.has(accountId)) throw new LedgerError(`Account ${accountId} does not exist`);
      return [...(accountEntries.get(accountId) ?? [])];
    },

    settle(liabilityAccountId: string, assetAccountId: string, amount: number, timestamp: number): string {
      if (amount <= 0) throw new LedgerError('Settlement amount must be > 0');
      const liab = accounts.get(liabilityAccountId);
      const asset = accounts.get(assetAccountId);
      if (!liab) throw new LedgerError(`Account ${liabilityAccountId} does not exist`);
      if (!asset) throw new LedgerError(`Account ${assetAccountId} does not exist`);
      if (liab.type !== 'liability') throw new LedgerError(`Account ${liabilityAccountId} is not a liability account`);
      if (asset.type !== 'asset') throw new LedgerError(`Account ${assetAccountId} is not an asset account`);

      // Build journal lines
      const lines: JournalLine[] = [];

      if (liab.currency === asset.currency) {
        // Same currency: simple
        lines.push({ accountId: liabilityAccountId, amount: amount, currency: liab.currency }); // debit liability
        lines.push({ accountId: assetAccountId, amount: -amount, currency: asset.currency }); // credit asset
      } else {
        // Cross-currency
        const rate = findRate(liab.currency, asset.currency);
        if (!rate) throw new LedgerError(`No rate from ${liab.currency} to ${asset.currency}`);
        if (isStale(rate, timestamp)) throw new LedgerError(`Rate from ${liab.currency} to ${asset.currency} is stale`);

        const convertedAmount = round4(amount * rate.rate);
        lines.push({ accountId: liabilityAccountId, amount: amount, currency: liab.currency }); // debit liability
        lines.push({ accountId: assetAccountId, amount: -convertedAmount, currency: asset.currency }); // credit asset
      }

      return this.postEntry({
        description: `Settlement of ${liabilityAccountId}`,
        timestamp,
        lines,
      });
    },
  };
}
