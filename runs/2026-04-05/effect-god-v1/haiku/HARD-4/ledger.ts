import { Effect, Exit, Cause, Data } from "effect";

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
    this.name = "LedgerError";
  }
}

class InternalLedgerError extends Data.TaggedError("InternalLedgerError")<{
  message: string;
}> {}

export function createLedger(config: {
  reportingCurrency: string;
  staleRateThresholdMs: number;
}) {
  if (config.staleRateThresholdMs <= 0) {
    throw new LedgerError("staleRateThresholdMs must be > 0");
  }
  if (!config.report