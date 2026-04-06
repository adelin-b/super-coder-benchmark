import { describe, it, expect } from 'vitest';
import { createLedger, LedgerError } from './ledger.js';

describe('HARD-4: Multi-Currency Double-Entry Ledger', () => {
  function setupBasicLedger() {
    const ledger = createLedger({ reportingCurrency: 'USD', staleRateThresholdMs: 60000 });
    ledger.createAccount({ id: 'cash', name: 'Cash', type: 'asset', currency: 'USD' });
    ledger.createAccount({ id: 'revenue', name: 'Revenue', type: 'revenue', currency: 'USD' });
    ledger.createAccount({ id: 'loan', name: 'Loan', type: 'liability', currency: 'USD' });
    ledger.createAccount({ id: 'equity', name: 'Owner Equity', type: 'equity', currency: 'USD' });
    return ledger;
  }

  // --- Basic double-entry ---
  it('posts a balanced journal entry', () => {
    const ledger = setupBasicLedger();
    const id = ledger.postEntry({
      description: 'Sale',
      timestamp: 1000,
      lines: [
        { accountId: 'cash', amount: 100, currency: 'USD' },
        { accountId: 'revenue', amount: -100, currency: 'USD' },
      ],
    });
    expect(id).toBeTruthy();
    expect(ledger.getBalance('cash')).toBe(100);
    expect(ledger.getBalance('revenue')).toBe(-100);
  });

  it('rejects unbalanced entry', () => {
    const ledger = setupBasicLedger();
    expect(() => ledger.postEntry({
      description: 'Bad',
      timestamp: 1000,
      lines: [
        { accountId: 'cash', amount: 100, currency: 'USD' },
        { accountId: 'revenue', amount: -50, currency: 'USD' },
      ],
    })).toThrow(LedgerError);
  });

  it('rejects entry with fewer than 2 lines', () => {
    const ledger = setupBasicLedger();
    expect(() => ledger.postEntry({
      description: 'One line',
      timestamp: 1000,
      lines: [{ accountId: 'cash', amount: 0, currency: 'USD' }],
    })).toThrow(LedgerError);
  });

  // --- Multi-currency ---
  it('posts cross-currency entry with exchange rate', () => {
    const ledger = createLedger({ reportingCurrency: 'USD', staleRateThresholdMs: 60000 });
    ledger.createAccount({ id: 'cash_usd', name: 'USD Cash', type: 'asset', currency: 'USD' });
    ledger.createAccount({ id: 'cash_eur', name: 'EUR Cash', type: 'asset', currency: 'EUR' });
    ledger.setRate({ from: 'EUR', to: 'USD', rate: 1.1, timestamp: 950 });

    // Buy EUR with USD: debit EUR cash, credit USD cash
    // 100 EUR = 110 USD
    ledger.postEntry({
      description: 'Buy EUR',
      timestamp: 1000,
      lines: [
        { accountId: 'cash_eur', amount: 100, currency: 'EUR' },    // +100 EUR
        { accountId: 'cash_usd', amount: -110, currency: 'USD' },   // -110 USD
      ],
    });

    expect(ledger.getBalance('cash_eur')).toBe(100);
    expect(ledger.getBalance('cash_usd')).toBe(-110);
  });

  // --- Exchange rate inverse ---
  it('getRate returns inverse when direct rate is not set', () => {
    const ledger = createLedger({ reportingCurrency: 'USD', staleRateThresholdMs: 60000 });
    ledger.setRate({ from: 'USD', to: 'EUR', rate: 0.9, timestamp: 1000 });
    const rate = ledger.getRate('EUR', 'USD');
    expect(rate).not.toBeNull();
    expect(rate!.rate).toBeCloseTo(1 / 0.9, 3);
  });

  it('getRate returns null when no rate exists', () => {
    const ledger = createLedger({ reportingCurrency: 'USD', staleRateThresholdMs: 60000 });
    expect(ledger.getRate('GBP', 'JPY')).toBeNull();
  });

  // --- Staleness ---
  it('rejects entry with stale exchange rate', () => {
    const ledger = createLedger({ reportingCurrency: 'USD', staleRateThresholdMs: 5000 });
    ledger.createAccount({ id: 'a', name: 'A', type: 'asset', currency: 'USD' });
    ledger.createAccount({ id: 'b', name: 'B', type: 'asset', currency: 'EUR' });
    ledger.setRate({ from: 'EUR', to: 'USD', rate: 1.1, timestamp: 1000 });

    // Entry at time 7000, rate from 1000, threshold 5000 -> stale (7000-1000=6000 > 5000)
    expect(() => ledger.postEntry({
      description: 'Stale',
      timestamp: 7000,
      lines: [
        { accountId: 'b', amount: 100, currency: 'EUR' },
        { accountId: 'a', amount: -110, currency: 'USD' },
      ],
    })).toThrow(LedgerError);
  });

  it('getBalanceIn throws on stale rate', () => {
    const ledger = createLedger({ reportingCurrency: 'USD', staleRateThresholdMs: 5000 });
    ledger.createAccount({ id: 'a', name: 'A', type: 'asset', currency: 'EUR' });
    ledger.setRate({ from: 'EUR', to: 'USD', rate: 1.1, timestamp: 1000 });
    expect(() => ledger.getBalanceIn('a', 'USD', 7000)).toThrow(LedgerError);
  });

  // --- getBalanceIn ---
  it('converts balance to target currency', () => {
    const ledger = createLedger({ reportingCurrency: 'USD', staleRateThresholdMs: 60000 });
    ledger.createAccount({ id: 'eur_cash', name: 'EUR Cash', type: 'asset', currency: 'EUR' });
    ledger.createAccount({ id: 'contra', name: 'Contra', type: 'equity', currency: 'EUR' });
    ledger.setRate({ from: 'EUR', to: 'USD', rate: 1.1, timestamp: 1000 });

    ledger.postEntry({
      description: 'Initial',
      timestamp: 1000,
      lines: [
        { accountId: 'eur_cash', amount: 100, currency: 'EUR' },
        { accountId: 'contra', amount: -100, currency: 'EUR' },
      ],
    });

    const balInUsd = ledger.getBalanceIn('eur_cash', 'USD', 1000);
    expect(balInUsd).toBeCloseTo(110, 1);
  });

  // --- Balance sheet ---
  it('balance sheet shows isBalanced true for correct entries', () => {
    const ledger = setupBasicLedger();
    ledger.postEntry({
      description: 'Investment',
      timestamp: 1000,
      lines: [
        { accountId: 'cash', amount: 1000, currency: 'USD' },
        { accountId: 'equity', amount: -1000, currency: 'USD' },
      ],
    });
    const bs = ledger.balanceSheet(1000);
    expect(bs.isBalanced).toBe(true);
    expect(bs.totalAssets).toBe(1000);
  });

  it('balance sheet marks stale rates as unbalanced', () => {
    const ledger = createLedger({ reportingCurrency: 'USD', staleRateThresholdMs: 5000 });
    ledger.createAccount({ id: 'eur', name: 'EUR', type: 'asset', currency: 'EUR' });
    ledger.createAccount({ id: 'eq', name: 'Equity', type: 'equity', currency: 'EUR' });
    ledger.setRate({ from: 'EUR', to: 'USD', rate: 1.1, timestamp: 1000 });

    ledger.postEntry({
      description: 'Init',
      timestamp: 1000,
      lines: [
        { accountId: 'eur', amount: 100, currency: 'EUR' },
        { accountId: 'eq', amount: -100, currency: 'EUR' },
      ],
    });

    // At time 7000, rate is stale
    const bs = ledger.balanceSheet(7000);
    expect(bs.isBalanced).toBe(false);
  });

  // --- Settlement ---
  it('settles a liability with an asset', () => {
    const ledger = setupBasicLedger();
    // Create initial balances
    ledger.postEntry({
      description: 'Receive loan',
      timestamp: 1000,
      lines: [
        { accountId: 'cash', amount: 500, currency: 'USD' },
        { accountId: 'loan', amount: -500, currency: 'USD' },
      ],
    });

    expect(ledger.getBalance('loan')).toBe(-500);

    const settleId = ledger.settle('loan', 'cash', 200, 2000);
    expect(settleId).toBeTruthy();
    expect(ledger.getBalance('loan')).toBe(-300); // -500 + 200
    expect(ledger.getBalance('cash')).toBe(300);  // 500 - 200
  });

  it('settle throws for wrong account types', () => {
    const ledger = setupBasicLedger();
    expect(() => ledger.settle('cash', 'loan', 100, 1000)).toThrow(LedgerError); // cash is asset not liability
  });

  it('settle throws for non-positive amount', () => {
    const ledger = setupBasicLedger();
    expect(() => ledger.settle('loan', 'cash', 0, 1000)).toThrow(LedgerError);
    expect(() => ledger.settle('loan', 'cash', -10, 1000)).toThrow(LedgerError);
  });

  // --- Rounding ---
  it('handles rounding in currency conversion', () => {
    const ledger = createLedger({ reportingCurrency: 'USD', staleRateThresholdMs: 60000 });
    ledger.createAccount({ id: 'a', name: 'A', type: 'asset', currency: 'JPY' });
    ledger.createAccount({ id: 'b', name: 'B', type: 'equity', currency: 'JPY' });
    ledger.setRate({ from: 'JPY', to: 'USD', rate: 0.0067, timestamp: 1000 });

    ledger.postEntry({
      description: 'Fund',
      timestamp: 1000,
      lines: [
        { accountId: 'a', amount: 10000, currency: 'JPY' },
        { accountId: 'b', amount: -10000, currency: 'JPY' },
      ],
    });

    const balUsd = ledger.getBalanceIn('a', 'USD', 1000);
    // 10000 * 0.0067 = 67
    expect(balUsd).toBeCloseTo(67, 0);
  });

  // --- Validation ---
  it('throws on duplicate account ID', () => {
    const ledger = setupBasicLedger();
    expect(() => ledger.createAccount({ id: 'cash', name: 'Another Cash', type: 'asset', currency: 'USD' }))
      .toThrow(LedgerError);
  });

  it('throws on non-existent account in entry', () => {
    const ledger = setupBasicLedger();
    expect(() => ledger.postEntry({
      description: 'Bad',
      timestamp: 1000,
      lines: [
        { accountId: 'cash', amount: 100, currency: 'USD' },
        { accountId: 'nonexistent', amount: -100, currency: 'USD' },
      ],
    })).toThrow(LedgerError);
  });

  it('throws on invalid rate', () => {
    const ledger = createLedger({ reportingCurrency: 'USD', staleRateThresholdMs: 60000 });
    expect(() => ledger.setRate({ from: 'USD', to: 'EUR', rate: 0, timestamp: 1000 })).toThrow(LedgerError);
    expect(() => ledger.setRate({ from: 'USD', to: 'EUR', rate: -1, timestamp: 1000 })).toThrow(LedgerError);
  });

  // --- getEntries ---
  it('returns journal entries for an account', () => {
    const ledger = setupBasicLedger();
    ledger.postEntry({
      description: 'Entry 1',
      timestamp: 1000,
      lines: [
        { accountId: 'cash', amount: 100, currency: 'USD' },
        { accountId: 'revenue', amount: -100, currency: 'USD' },
      ],
    });
    ledger.postEntry({
      description: 'Entry 2',
      timestamp: 2000,
      lines: [
        { accountId: 'cash', amount: 50, currency: 'USD' },
        { accountId: 'revenue', amount: -50, currency: 'USD' },
      ],
    });

    const cashEntries = ledger.getEntries('cash');
    expect(cashEntries).toHaveLength(2);
    const loanEntries = ledger.getEntries('loan');
    expect(loanEntries).toHaveLength(0);
  });

  // --- Complex multi-entry scenario ---
  it('multiple entries maintain accounting equation', () => {
    const ledger = setupBasicLedger();
    // Owner invests
    ledger.postEntry({
      description: 'Investment',
      timestamp: 1000,
      lines: [
        { accountId: 'cash', amount: 1000, currency: 'USD' },
        { accountId: 'equity', amount: -1000, currency: 'USD' },
      ],
    });
    // Take loan
    ledger.postEntry({
      description: 'Loan',
      timestamp: 2000,
      lines: [
        { accountId: 'cash', amount: 500, currency: 'USD' },
        { accountId: 'loan', amount: -500, currency: 'USD' },
      ],
    });
    // Make sale
    ledger.postEntry({
      description: 'Sale',
      timestamp: 3000,
      lines: [
        { accountId: 'cash', amount: 200, currency: 'USD' },
        { accountId: 'revenue', amount: -200, currency: 'USD' },
      ],
    });

    const bs = ledger.balanceSheet(3000);
    // Assets: cash = 1700
    // Liabilities: loan = -500
    // Equity: equity=-1000, revenue=-200
    expect(bs.totalAssets).toBe(1700);
    expect(bs.isBalanced).toBe(true);
  });
});
