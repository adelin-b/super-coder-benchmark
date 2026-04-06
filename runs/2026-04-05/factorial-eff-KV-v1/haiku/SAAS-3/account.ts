export type Event =
  | { type: "AccountCreated"; accountId: string; initialBalance: number; timestamp: Date }
  | { type: "Deposited"; accountId: string; amount: number; timestamp: Date }
  | { type: "Withdrawn"; accountId: string; amount: number; timestamp: Date }
  | {
      type: "Transferred";
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      timestamp: Date;
    };

export interface Account {
  accountId: string;
  balance: number;
  events: Event[];
}

export function createAccount(
  accountId: string,
  initialBalance: number
): Account {
  if (initialBalance < 0) {
    throw new Error("Initial balance cannot be negative");
  }

  return {
    accountId,
    balance: initialBalance,
    events: [
      {
        type: "AccountCreated",
        accountId,
        initialBalance,
        timestamp: new Date(),
      },
    ],
  };
}

export function deposit(account: Account, amount: number): Account {
  if (amount <= 0) {
    throw new Error("Deposit amount must be positive");
  }

  const newEvent: Event = {
    type: "Deposited",
    accountId: account.accountId,
    amount,
    timestamp: new Date(),
  };

  return {
    ...account,
    balance: account.balance + amount,
    events: [...account.events, newEvent],
  };
}

export function withdraw(account: Account, amount: number): Account {
  if (amount <= 0) {
    throw new Error("Withdrawal amount must be positive");
  }
  if (account.balance < amount) {
    throw new Error("Insufficient funds");
  }

  const newEvent: Event = {
    type: "Withdrawn",
    accountId: account.accountId,
    amount,
    timestamp: new Date(),
  };

  return {
    ...account,
    balance: account.balance - amount,
    events: [...account.events, newEvent],
  };
}

export function transfer(
  fromAccount: Account,
  toAccount: Account,
  amount: number
): { from: Account; to: Account } {
  if (amount <= 0) {
    throw new Error("Transfer amount must be positive");
  }
  if (fromAccount.balance < amount) {
    throw new Error("Insufficient funds for transfer");
  }

  const newEvent: Event = {
    type: "Transferred",
    fromAccountId: fromAccount.accountId,
    toAccountId: toAccount.accountId,
    amount,
    timestamp: new Date(),
  };

  return {
    from: {
      ...fromAccount,
      balance: fromAccount.balance - amount,
      events: [...fromAccount.events, newEvent],
    },
    to: {
      ...toAccount,
      balance: toAccount.balance + amount,
      events: [...toAccount.events, newEvent],
    },
  };
}

export function reconstructFromEvents(
  accountId: string,
  events: Event[]
): Account {
  let balance = 0;

  for (const event of events) {
    if (event.type === "AccountCreated" && event.accountId === accountId) {
      balance = event.initialBalance;
    } else if (event.type === "Deposited" && event.accountId === accountId) {
      balance += event.amount;
    } else if (event.type === "Withdrawn" && event.accountId === accountId) {
      balance -= event.amount;
    } else if (event.type === "Transferred") {
      if (event.fromAccountId === accountId) {
        balance -= event.amount;
      } else if (event.toAccountId === accountId) {
        balance += event.amount;
      }
    }
  }

  const relevantEvents = events.filter((e) => {
    if (e.type === "AccountCreated" && e.accountId === accountId) return true;
    if (e.type === "Deposited" && e.accountId === accountId) return true;
    if (e.type === "Withdrawn" && e.accountId === accountId) return true;
    if (
      e.type === "Transferred" &&
      (e.fromAccountId === accountId || e.toAccountId === accountId)
    )
      return true;
    return false;
  });

  return {
    accountId,
    balance,
    events: relevantEvents,
  };
}