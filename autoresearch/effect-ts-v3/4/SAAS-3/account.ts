import { Effect, Data } from "effect";

// Domain errors as plain classes
class InsufficientFunds extends Error {
  constructor(available: number, requested: number) {
    super(`Insufficient funds: ${available} available, ${requested} requested`);
    this.name = "InsufficientFunds";
  }
}

class InvalidAmount extends Error {
  constructor(reason: string) {
    super(`Invalid amount: ${reason}`);
    this.name = "InvalidAmount";
  }
}

// Event types
export type Event =
  | { type: "AccountCreated"; id: string; initialBalance: number }
  | { type: "Deposited"; amount: number }
  | { type: "Withdrawn"; amount: number }
  | { type: "TransferInitiated"; recipientId: string; amount: number }
  | { type: "TransferReceived"; senderId: string; amount: number };

// Account state
export interface Account {
  id: string;
  balance: number;
  version: number;
  events: Event[];
}

// Internal: validate amount
function validateAmount(amount: number): void {
  if (amount <= 0) {
    throw new InvalidAmount("amount must be positive");
  }
  if (!Number.isFinite(amount)) {
    throw new InvalidAmount("amount must be finite");
  }
}

// Internal: apply event to account state
function applyEventInternal(account: Account, event: Event): Account {
  const updated = { ...account, events: [...account.events] };
  updated.events.push(event);
  updated.version += 1;

  if (event.type === "AccountCreated") {
    updated.id = event.id;
    updated.balance = event.initialBalance;
  } else if (event.type === "Deposited") {
    updated.balance += event.amount;
  } else if (event.type === "Withdrawn") {
    updated.balance -= event.amount;
  } else if (event.type === "TransferInitiated") {
    updated.balance -= event.amount;
  } else if (event.type === "TransferReceived") {
    updated.balance += event.amount;
  }

  return updated;
}

// EXPORTED: create initial account
export function createAccount(id: string, initialBalance: number = 0): Account {
  return {
    id,
    balance: initialBalance,
    version: 1,
    events: [{ type: "AccountCreated", id, initialBalance }],
  };
}

// EXPORTED: apply event to account state
export function applyEvent(account: Account, event: Event): Account {
  return applyEventInternal(account, event);
}

// EXPORTED: reconstruct account from event list
export function reconstruct(events: Event[]): Account {
  if (events.length === 0) {
    throw new Error("Cannot reconstruct account from empty event list");
  }

  let account: Account = {
    id: "",
    balance: 0,
    version: 0,
    events: [],
  };

  for (const event of events) {
    account = applyEventInternal(account, event);
  }

  return account;
}

// EXPORTED: deposit to account
export function deposit(account: Account, amount: number): Account {
  validateAmount(amount);
  return applyEventInternal(account, { type: "Deposited", amount });
}

// EXPORTED: withdraw from account
export function withdraw(account: Account, amount: number): Account {
  validateAmount(amount);
  if (account.balance < amount) {
    throw new InsufficientFunds(account.balance, amount);
  }
  return applyEventInternal(account, { type: "Withdrawn", amount });
}

// EXPORTED: transfer from one account to another
export function transfer(
  fromAccount: Account,
  toAccountId: string,
  amount: number
): Account {
  validateAmount(amount);
  if (fromAccount.balance < amount) {
    throw new InsufficientFunds(fromAccount.balance, amount);
  }
  return applyEventInternal(fromAccount, {
    type: "TransferInitiated",
    recipientId: toAccountId,
    amount,
  });
}