import { Effect, Data } from "effect";

// Event types for the event sourcing aggregate
export type Event =
  | { type: "Deposited"; amount: number; timestamp: Date }
  | { type: "Withdrawn"; amount: number; timestamp: Date }
  | { type: "Transferred"; amount: number; to: string; timestamp: Date }
  | { type: "TransferReceived"; amount: number; from: string; timestamp: Date };

// Account aggregate state
export interface Account {
  id: string;
  balance: number;
  events: Event[];
}

// Internal error definitions
class InsufficientFunds extends Data.TaggedError("InsufficientFunds")<{}> {}
class InvalidAmount extends Data.TaggedError("InvalidAmount")<{
  reason: string;
}> {}

// Internal effect-based operations
function depositEffect(account: Account, amount: number): Effect.Effect<Account, InvalidAmount | InsufficientFunds> {
  return Effect.gen(function* () {
    if (amount <= 0) {
      yield* Effect.fail(new InvalidAmount({ reason: "Deposit amount must be positive" }));
    }

    const event: Event = {
      type: "Deposited",
      amount,
      timestamp: new Date(),
    };

    return {
      ...account,
      balance: account.balance + amount,
      events: [...account.events, event],
    };
  });
}

function withdrawEffect(account: Account, amount: number): Effect.Effect<Account, InvalidAmount | InsufficientFunds> {
  return Effect.gen(function* () {
    if (amount <= 0) {
      yield* Effect.fail(new InvalidAmount({ reason: "Withdrawal amount must be positive" }));
    }

    if (account.balance < amount) {
      yield* Effect.fail(new InsufficientFunds());
    }

    const event: Event = {
      type: "Withdrawn",
      amount,
      timestamp: new Date(),
    };

    return {
      ...account,
      balance: account.balance - amount,
      events: [...account.events, event],
    };
  });
}

function transferEffect(
  fromAccount: Account,
  toAccount: Account,
  amount: number
): Effect.Effect<{ from: Account; to: Account }, InvalidAmount | InsufficientFunds> {
  return Effect.gen(function* () {
    if (amount <= 0) {
      yield* Effect.fail(new InvalidAmount({ reason: "Transfer amount must be positive" }));
    }

    if (fromAccount.balance < amount) {
      yield* Effect.fail(new InsufficientFunds());
    }

    const timestamp = new Date();

    const fromEvent: Event = {
      type: "Transferred",
      amount,
      to: toAccount.id,
      timestamp,
    };

    const toEvent: Event = {
      type: "TransferReceived",
      amount,
      from: fromAccount.id,
      timestamp,
    };

    const updatedFrom: Account = {
      ...fromAccount,
      balance: fromAccount.balance - amount,
      events: [...fromAccount.events, fromEvent],
    };

    const updatedTo: Account = {
      ...toAccount,
      balance: toAccount.balance + amount,
      events: [...toAccount.events, toEvent],
    };

    return { from: updatedFrom, to: updatedTo };
  });
}

// Create a new account
export function createAccount(id: string): Account {
  return {
    id,
    balance: 0,
    events: [],
  };
}

// Deposit funds into account
export function deposit(account: Account, amount: number): Account {
  try {
    return Effect.runSync(depositEffect(account, amount));
  } catch (e: unknown) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error("Deposit failed");
  }
}

// Withdraw funds from account
export function withdraw(account: Account, amount: number): Account {
  try {
    return Effect.runSync(withdrawEffect(account, amount));
  } catch (e: unknown) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error("Withdrawal failed");
  }
}

// Transfer funds between accounts
export function transfer(
  fromAccount: Account,
  toAccount: Account,
  amount: number
): { from: Account; to: Account } {
  try {
    return Effect.runSync(transferEffect(fromAccount, toAccount, amount));
  } catch (e: unknown) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error("Transfer failed");
  }
}

// Reconstruct account state by replaying events
export function reconstruct(id: string, events: Event[]): Account {
  let balance = 0;

  for (const event of events) {
    switch (event.type) {
      case "Deposited":
        balance += event.amount;
        break;
      case "Withdrawn":
        balance -= event.amount;
        break;
      case "Transferred":
        balance -= event.amount;
        break;
      case "TransferReceived":
        balance += event.amount;
        break;
    }
  }

  return {
    id,
    balance,
    events,
  };
}

// Get current balance
export function getBalance(account: Account): number {
  return account.balance;
}

// Get all events for an account
export function getEvents(account: Account): Event[] {
  return [...account.events];
}