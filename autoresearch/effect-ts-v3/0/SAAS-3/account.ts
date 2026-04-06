import { Effect, Data } from "effect";

// ===== Domain Errors =====
class InsufficientFunds extends Data.TaggedError("InsufficientFunds")<{
  required: number;
  available: number;
}> {}

class InvalidAmount extends Data.TaggedError("InvalidAmount")<{
  reason: string;
}> {}

// ===== Events =====
export type AccountEvent =
  | {
      type: "AccountCreated";
      accountId: string;
      initialBalance: number;
      timestamp: Date;
    }
  | { type: "Deposited"; amount: number; timestamp: Date }
  | { type: "Withdrawn"; amount: number; timestamp: Date }
  | {
      type: "TransferCompleted";
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      timestamp: Date;
    };

// ===== Account Aggregate =====
export interface Account {
  id: string;
  balance: number;
  events: AccountEvent[];
}

// ===== Internal validation functions =====
const validateAmount = (amount: number): void => {
  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }
};

const checkBalance = (current: number, required: number): void => {
  if (current < required) {
    throw new Error(`Insufficient funds: required ${required}, available ${current}`);
  }
};

// ===== Exported plain TypeScript functions =====
export function createAccount(id: string, initialBalance: number): Account {
  if (initialBalance < 0) {
    throw new Error("Initial balance cannot be negative");
  }
  const event: AccountEvent = {
    type: "AccountCreated",
    accountId: id,
    initialBalance,
    timestamp: new Date(),
  };
  return {
    id,
    balance: initialBalance,
    events: [event],
  };
}

export function deposit(account: Account, amount: number): Account {
  validateAmount(amount);
  const event: AccountEvent = {
    type: "Deposited",
    amount,
    timestamp: new Date(),
  };
  return {
    ...account,
    balance: account.balance + amount,
    events: [...account.events, event],
  };
}

export function withdraw(account: Account, amount: number): Account {
  validateAmount(amount);
  checkBalance(account.balance, amount);
  const event: AccountEvent = {
    type: "Withdrawn",
    amount,
    timestamp: new Date(),
  };
  return {
    ...account,
    balance: account.balance - amount,
    events: [...account.events, event],
  };
}

export function transfer(
  fromAccount: Account,
  toAccount: Account,
  amount: number
): { from: Account; to: Account } {
  validateAmount(amount);
  checkBalance(fromAccount.balance, amount);

  const transferEvent: AccountEvent = {
    type: "TransferCompleted",
    fromAccountId: fromAccount.id,
    toAccountId: toAccount.id,
    amount,
    timestamp: new Date(),
  };

  const updatedFrom = {
    ...fromAccount,
    balance: fromAccount.balance - amount,
    events: [...fromAccount.events, transferEvent],
  };

  const updatedTo = {
    ...toAccount,
    balance: toAccount.balance + amount,
    events: [...toAccount.events, transferEvent],
  };

  return {
    from: updatedFrom,
    to: updatedTo,
  };
}

export function reconstructFromEvents(
  accountId: string,
  events: AccountEvent[]
): Account {
  let balance = 0;

  for (const event of events) {
    switch (event.type) {
      case "AccountCreated":
        balance = event.initialBalance;
        break;
      case "Deposited":
        balance += event.amount;
        break;
      case "Withdrawn":
        balance -= event.amount;
        break;
      case "TransferCompleted":
        if (event.fromAccountId === accountId) {
          balance -= event.amount;
        } else if (event.toAccountId === accountId) {
          balance += event.amount;
        }
        break;
    }
  }

  return {
    id: accountId,
    balance,
    events,
  };
}