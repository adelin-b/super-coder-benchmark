import { Effect, Data } from "effect";

// Domain errors
class InsufficientFunds extends Data.TaggedError("InsufficientFunds")<{ amount: number; balance: number }> {}
class InvalidAmount extends Data.TaggedError("InvalidAmount")<{ reason: string }> {}

// Event types
export type DepositedEvent = {
  type: "Deposited";
  amount: number;
  timestamp: Date;
};

export type WithdrawnEvent = {
  type: "Withdrawn";
  amount: number;
  timestamp: Date;
};

export type TransferredEvent = {
  type: "Transferred";
  to: string;
  amount: number;
  timestamp: Date;
};

export type Event = DepositedEvent | WithdrawnEvent | TransferredEvent;

// Account aggregate
export interface Account {
  id: string;
  balance: number;
  events: Event[];
}

// Internal: apply event effect
function applyEventEffect(account: Account, event: Event): Effect.Effect<Account, InsufficientFunds | InvalidAmount> {
  return Effect.gen(function* () {
    let newBalance = account.balance;

    if (event.type === "Deposited") {
      newBalance += event.amount;
    } else if (event.type === "Withdrawn") {
      if (event.amount > account.balance) {
        yield* Effect.fail(new InsufficientFunds({ amount: event.amount, balance: account.balance }));
      }
      newBalance -= event.amount;
    } else if (event.type === "Transferred") {
      if (event.amount > account.balance) {
        yield* Effect.fail(new InsufficientFunds({ amount: event.amount, balance: account.balance }));
      }
      newBalance -= event.amount;
    }

    return {
      ...account,
      balance: newBalance,
      events: [...account.events, event],
    };
  });
}

// Exported: apply event to account
export function applyEvent(account: Account, event: Event): Account {
  try {
    return Effect.runSync(applyEventEffect(account, event));
  } catch (err) {
    if (err instanceof InsufficientFunds) {
      throw new Error(`Insufficient funds: required ${err.amount}, have ${err.balance}`);
    }
    if (err instanceof InvalidAmount) {
      throw new Error(`Invalid amount: ${err.reason}`);
    }
    throw err;
  }
}

// Exported: reconstruct account from event history
export function reconstruct(accountId: string, events: Event[]): Account {
  const effect = Effect.gen(function* () {
    let account: Account = {
      id: accountId,
      balance: 0,
      events: [],
    };

    for (const event of events) {
      account = yield* applyEventEffect(account, event);
    }

    return account;
  });

  try {
    return Effect.runSync(effect);
  } catch (err) {
    if (err instanceof InsufficientFunds) {
      throw new Error(`Insufficient funds: required ${err.amount}, have ${err.balance}`);
    }
    if (err instanceof InvalidAmount) {
      throw new Error(`Invalid amount: ${err.reason}`);
    }
    throw err;
  }
}

// Exported: deposit operation
export function deposit(account: Account, amount: number): Account {
  const effect = Effect.gen(function* () {
    if (amount <= 0) {
      yield* Effect.fail(new InvalidAmount({ reason: "amount must be positive" }));
    }

    const event: DepositedEvent = {
      type: "Deposited",
      amount,
      timestamp: new Date(),
    };

    return yield* applyEventEffect(account, event);
  });

  try {
    return Effect.runSync(effect);
  } catch (err) {
    if (err instanceof InvalidAmount) {
      throw new Error(`Invalid amount: ${err.reason}`);
    }
    if (err instanceof InsufficientFunds) {
      throw new Error(`Insufficient funds: required ${err.amount}, have ${err.balance}`);
    }
    throw err;
  }
}

// Exported: withdraw operation
export function withdraw(account: Account, amount: number): Account {
  const effect = Effect.gen(function* () {
    if (amount <= 0) {
      yield* Effect.fail(new InvalidAmount({ reason: "amount must be positive" }));
    }

    const event: WithdrawnEvent = {
      type: "Withdrawn",
      amount,
      timestamp: new Date(),
    };

    return yield* applyEventEffect(account, event);
  });

  try {
    return Effect.runSync(effect);
  } catch (err) {
    if (err instanceof InvalidAmount) {
      throw new Error(`Invalid amount: ${err.reason}`);
    }
    if (err instanceof InsufficientFunds) {
      throw new Error(`Insufficient funds: required ${err.amount}, have ${err.balance}`);
    }
    throw err;
  }
}

// Exported: transfer operation
export function transfer(account: Account, toAccountId: string, amount: number): Account {
  const effect = Effect.gen(function* () {
    if (amount <= 0) {
      yield* Effect.fail(new InvalidAmount({ reason: "amount must be positive" }));
    }

    const event: TransferredEvent = {
      type: "Transferred",
      to: toAccountId,
      amount,
      timestamp: new Date(),
    };

    return yield* applyEventEffect(account, event);
  });

  try {
    return Effect.runSync(effect);
  } catch (err) {
    if (err instanceof InvalidAmount) {
      throw new Error(`Invalid amount: ${err.reason}`);
    }
    if (err instanceof InsufficientFunds) {
      throw new Error(`Insufficient funds: required ${err.amount}, have ${err.balance}`);
    }
    throw err;
  }
}