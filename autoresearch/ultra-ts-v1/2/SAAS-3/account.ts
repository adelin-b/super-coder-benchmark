export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountError';
  }
}

type Event = 
  | { type: 'deposited'; amount: number; timestamp: number }
  | { type: 'withdrawn'; amount: number; timestamp: number }
  | { type: 'transferred'; amount: number; toAccount: string; timestamp: number };

interface Account {
  id: string;
  balance: number;
  events: Event[];
}

export function createAccount(id: string): Account {
  return {
    id,
    balance: 0,
    events: [],
  };
}

export function applyEvent(account: Account, event: Event): Account {
  if (event.type === 'deposited' && event.amount < 0) {
    throw new AccountError('Deposit amount cannot be negative');
  }
  
  if (event.type === 'withdrawn' && event.amount > account.balance) {
    throw new AccountError('Insufficient funds');
  }

  const newBalance = (() => {
    if (event.type === 'deposited') {
      return Math.round((account.balance + event.amount) * 100) / 100;
    } else if (event.type === 'withdrawn') {
      return Math.round((account.balance - event.amount) * 100) / 100;
    } else if (event.type === 'transferred') {
      return Math.round((account.balance - event.amount) * 100) / 100;
    }
    return account.balance;
  })();

  return {
    ...account,
    balance: newBalance,
    events: [...account.events, event],
  };
}

export function reconstruct(id: string, events: Event[]): Account {
  let account = createAccount(id);
  for (const event of events) {
    account = applyEvent(account, event);
  }
  return account;
}

export function getBalance(account: Account): number {
  return account.balance;
}