export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountError';
  }
}

type DepositedEvent = {
  type: 'deposited';
  amount: number;
  timestamp: number;
};

type WithdrawnEvent = {
  type: 'withdrawn';
  amount: number;
  timestamp: number;
};

type TransferredEvent = {
  type: 'transferred';
  amount: number;
  toAccount: string;
  timestamp: number;
};

type Event = DepositedEvent | WithdrawnEvent | TransferredEvent;

type Account = {
  id: string;
  balance: number;
  events: Event[];
};

export function createAccount(id: string): Account {
  return {
    id,
    balance: 0,
    events: [],
  };
}

export function applyEvent(account: Account, event: Event): Account {
  const newAccount = {
    ...account,
    events: [...account.events, event],
  };

  switch (event.type) {
    case 'deposited': {
      if (event.amount < 0) {
        throw new AccountError('Cannot deposit negative amount');
      }
      newAccount.balance = account.balance + event.amount;
      break;
    }
    case 'withdrawn': {
      if (account.balance < event.amount) {
        throw new AccountError('Insufficient funds');
      }
      newAccount.balance = account.balance - event.amount;
      break;
    }
    case 'transferred': {
      if (account.balance < event.amount) {
        throw new AccountError('Insufficient funds');
      }
      newAccount.balance = account.balance - event.amount;
      break;
    }
  }

  newAccount.balance = Math.round(newAccount.balance * 100) / 100;
  return newAccount;
}

export function getBalance(account: Account): number {
  return account.balance;
}

export function reconstruct(id: string, events: Event[]): Account {
  let account = createAccount(id);
  for (const event of events) {
    account = applyEvent(account, event);
  }
  return account;
}