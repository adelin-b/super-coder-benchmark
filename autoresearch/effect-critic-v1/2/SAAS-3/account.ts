import { Effect } from "effect";

// Event types
interface DepositedEvent {
  type: 'deposited';
  amount: number;
  timestamp: number;
}

interface WithdrawnEvent {
  type: 'withdrawn';
  amount: number;
  timestamp: number;
}

interface TransferredEvent {
  type: 'transferred';
  amount: number;
  toAccount: string;
  timestamp: number;
}

export type AccountEvent = DepositedEvent | WithdrawnEvent | TransferredEvent;

// Account state
export interface Account {
  id: string;
  balance: number;
  events: AccountEvent[];
}

// Error class
export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountError';
    Object.setPrototypeOf(this, AccountError.prototype);
  }
}

// Helper to round to 2 decimals
function roundBalance(balance: number): number {
  return Math.round(balance * 100) / 100;
}

// Create a new account
export function createAccount(id: string): Account {
  return {
    id,
    balance: 0,
    events: [],
  };
}

// Apply an event to an account, returning new account state
export function applyEvent(account: Account, event: AccountEvent): Account {
  // Validate and apply event
  if (event.type === 'deposited') {
    if (event.amount < 0) {
      throw new AccountError('Deposit amount cannot be negative');
    }
    const newBalance = roundBalance(account.balance + event.amount);
    return {
      ...account,
      balance: newBalance,
      events: [...account.events, event],
    };
  } else if (event.type === 'withdrawn') {
    if (event.amount < 0) {
      throw new AccountError('Withdrawal amount cannot be negative');
    }
    if (account.balance < event.amount) {
      throw new AccountError('Insufficient funds');
    }
    const newBalance = roundBalance(account.balance - event.amount);
    return {
      ...account,
      balance: newBalance,
      events: [...account.events, event],
    };
  } else if (event.type === 'transferred') {
    if (event.amount < 0) {
      throw new AccountError('Transfer amount cannot be negative');
    }
    if (account.balance < event.amount) {
      throw new AccountError('Insufficient funds');
    }
    const newBalance = roundBalance(account.balance - event.amount);
    return {
      ...account,
      balance: newBalance,
      events: [...account.events, event],
    };
  }
  
  // Exhaustiveness check
  const _: never = event;
  return _;
}

// Get balance from account
export function getBalance(account: Account): number {
  return account.balance;
}

// Reconstruct account state from event history
export function reconstruct(id: string, events: AccountEvent[]): Account {
  let account = createAccount(id);
  for (const event of events) {
    account = applyEvent(account, event);
  }
  return account;
}