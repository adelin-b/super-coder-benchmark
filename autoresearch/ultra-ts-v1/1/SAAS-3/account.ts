type Event = {
  type: 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER_OUT' | 'TRANSFER_IN';
  accountId: string;
  amount: number;
  timestamp?: number;
  toAccountId?: string;
  fromAccountId?: string;
};

type Account = {
  id: string;
  balance: number;
  events: Event[];
};

export function createAccount(id: string): Account {
  if (!id || typeof id !== 'string') throw new Error('Account id required');
  return {
    id,
    balance: 0,
    events: []
  };
}

export function applyEvent(account: Account, event: Event): Account {
  if (!account) throw new Error('Account required');
  if (!event) throw new Error('Event required');
  if (typeof event.amount !== 'number' || event.amount < 0) {
    throw new Error('Amount must be a non-negative number');
  }

  const newAccount = {
    ...account,
    balance: account.balance,
    events: [...account.events, event]
  };

  switch (event.type) {
    case 'DEPOSIT':
      newAccount.balance += event.amount;
      break;
    case 'WITHDRAW':
      if (newAccount.balance < event.amount) {
        throw new Error('Insufficient funds');
      }
      newAccount.balance -= event.amount;
      break;
    case 'TRANSFER_OUT':
      if (newAccount.balance < event.amount) {
        throw new Error('Insufficient funds');
      }
      newAccount.balance -= event.amount;
      break;
    case 'TRANSFER_IN':
      newAccount.balance += event.amount;
      break;
    default:
      throw new Error('Unknown event type');
  }

  return newAccount;
}

export function getBalance(account: Account): number {
  if (!account) throw new Error('Account required');
  return account.balance;
}

export function reconstruct(events: Event[]): Account {
  if (!events) throw new Error('Events required');
  if (!Array.isArray(events)) throw new Error('Events must be an array');
  if (events.length === 0) throw new Error('Events array cannot be empty');

  const firstEvent = events[0];
  const accountId = firstEvent.accountId;

  if (!accountId) throw new Error('Account id required in events');

  let account = createAccount(accountId);

  for (const event of events) {
    account = applyEvent(account, event);
  }

  return account;
}