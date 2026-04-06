export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountError';
  }
}

export interface DepositedEvent {
  type: 'deposited';
  amount: number;
  timestamp: number;
}

export interface WithdrawnEvent {
  type: 'withdrawn';
  amount: number;
  timestamp: number;
}

export interface TransferredEvent {
  type: 'transferred';
  amount: number;
  toAccount: string;
  timestamp: number;
}

export type AccountEvent = DepositedEvent | WithdrawnEvent | TransferredEvent;

export interface Account {
  id: string;
  events: AccountEvent[];
}

export function createAccount(id: string): Account {
  return { id, events: [] };
}

function calculateBalance(account: Account): number {
  let balance = 0;
  for (const event of account.events) {
    if (event.type === 'deposited') {
      balance += event.amount;
    } else if (event.type === 'withdrawn') {
      balance -= event.amount;
    } else if (event.type === 'transferred') {
      balance -= event.amount;
    }
  }
  return Math.round(balance * 100) / 100;
}

export function applyEvent(account: Account, event: AccountEvent): Account {
  if ('amount' in event && event.amount <= 0) {
    throw new AccountError(`Invalid amount: ${event.amount}`);
  }

  if (event.type === 'withdrawn' || event.type === 'transferred') {
    const currentBalance = calculateBalance(account);
    if (currentBalance < event.amount) {
      throw new AccountError(`Insufficient funds. Balance: ${currentBalance}, Requested: ${event.amount}`);
    }
  }

  return {
    ...account,
    events: [...account.events, event],
  };
}

export function getBalance(account: Account): number {
  return calculateBalance(account);
}

export function reconstruct(id: string, events: AccountEvent[]): Account {
  let account = createAccount(id);
  for (const event of events) {
    account = applyEvent(account, event);
  }
  return account;
}