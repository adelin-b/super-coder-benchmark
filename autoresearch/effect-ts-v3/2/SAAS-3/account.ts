import { Effect, Data } from "effect";

// Typed errors for domain logic
class InsufficientFunds extends Data.TaggedError("InsufficientFunds")<{
  balance: number;
  requested: number;
}> {}

class InvalidAmount extends Data.TaggedError("InvalidAmount")<{
  amount: number;
}> {}

// Event types
export type AccountEvent =
  | {
      type: "AccountCreated";
      accountId: string;
      initialBalance: number;
    }
  | { type: "MoneyDeposited"; amount: number }
  | { type: "MoneyWithdrawn"; amount: number }
  | { type: "MoneyTransferred"; targetAccountId: string; amount: number };

// Account aggregate state
export interface Account {
  id: string;
  balance: number;
}

// Internal Effect-based logic
const applyEventEffect = (
  account: Account,
  event: AccountEvent
): Effect.Effect<Account, never> => {
  return Effect.gen(function* () {
    if (event.type === "AccountCreated") {
      return { id: event.accountId, balance: event.initialBalance };
    }
    if (event.type === "MoneyDeposited") {
      return { ...account, balance: account.balance + event.amount };
    }
    if (event.type === "MoneyWithdrawn") {
      return { ...account, balance: account.balance - event.amount };
    }
    if (event.type === "MoneyTransferred") {
      return { ...account, balance: account.balance - event.amount };
    }
    return account;
  });
};

const reconstructEffect = (
  events: AccountEvent[]
): Effect.Effect<Account, Error> => {
  return Effect.gen(function* () {
    if (!events || events.length === 0) {
      yield* Effect.fail(new Error("events must not be empty"));
    }

    let account: Account | null = null;

    for (const event of events) {
      if (event.type === "AccountCreated") {
        account = { id: event.accountId, balance: event.initialBalance };
      } else if (account) {
        account = yield* applyEventEffect(account, event);
      }
    }

    if (!account) {
      yield* Effect.fail(new Error("no AccountCreated event found"));
    }

    return account as Account;
  });
};

// Export boundary: plain TypeScript functions

/**
 * Apply an event to an account to evolve its state
 */
export function applyEvent(account: Account, event: AccountEvent): Account {
  if (!account || account.id === undefined) {
    throw new Error("account is required");
  }
  if (!event || !event.type) {
    throw new Error("event is required");
  }
  return Effect.runSync(applyEventEffect(account, event));
}

/**
 * Reconstruct an account from its complete event history
 */
export function reconstruct(events: AccountEvent[]): Account {
  if (!events) {
    throw new Error("events is required");
  }
  return Effect.runSync(reconstructEffect(events));
}

/**
 * Create a deposit event
 */
export function deposit(accountId: string, amount: number): AccountEvent {
  if (!accountId) {
    throw new Error("accountId is required");
  }
  if (typeof amount !== "number" || isNaN(amount)) {
    throw new Error("amount must be a valid number");
  }
  if (amount <= 0) {
    throw new Error("amount must be positive");
  }
  return { type: "MoneyDeposited", amount };
}

/**
 * Create a withdrawal event (validates sufficient funds)
 */
export function withdraw(account: Account, amount: number): AccountEvent {
  if (!account || account.id === undefined) {
    throw new Error("account is required");
  }
  if (typeof amount !== "number" || isNaN(amount)) {
    throw new Error("amount must be a valid number");
  }
  if (amount <= 0) {
    throw new Error("amount must be positive");
  }
  if (account.balance < amount) {
    throw new Error("insufficient funds");
  }
  return { type: "MoneyWithdrawn", amount };
}

/**
 * Create a transfer event (validates sufficient funds)
 */
export function transfer(
  account: Account,
  targetAccountId: string,
  amount: number
): AccountEvent {
  if (!account || account.id === undefined) {
    throw new Error("account is required");
  }
  if (!targetAccountId) {
    throw new Error("targetAccountId is required");
  }
  if (typeof amount !== "number" || isNaN(amount)) {
    throw new Error("amount must be a valid number");
  }
  if (amount <= 0) {
    throw new Error("amount must be positive");
  }
  if (account.balance < amount) {
    throw new Error("insufficient funds");
  }
  return { type: "MoneyTransferred", targetAccountId, amount };
}

/**
 * Get the current balance of an account
 */
export function getBalance(account: Account): number {
  if (!account || account.id === undefined) {
    throw new Error("account is required");
  }
  return account.balance;
}

/**
 * Create an account created event
 */
export function createAccount(
  accountId: string,
  initialBalance: number
): AccountEvent {
  if (!accountId) {
    throw new Error("accountId is required");
  }
  if (typeof initialBalance !== "number" || isNaN(initialBalance)) {
    throw new Error("initialBalance must be a valid number");
  }
  if (initialBalance < 0) {
    throw new Error("initialBalance cannot be negative");
  }
  return {
    type: "AccountCreated",
    accountId,
    initialBalance,
  };
}