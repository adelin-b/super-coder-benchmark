import { Data, Effect } from "effect";

// Event types
export interface DepositEvent {
  type: "Deposit";
  amount: number;
  timestamp: number;
}

export interface WithdrawEvent {
  type: "Withdraw";
  amount: number;
  timestamp: number;
}

export interface TransferEvent {
  type: "Transfer";
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  timestamp: number;
}

export type Event = DepositEvent | WithdrawEvent | TransferEvent;

// Account aggregate
export interface Account {
  id: string;
  balance: number;
  events: Event[];
}

class InsufficientFunds extends Data.TaggedError("InsufficientFunds")<{
  required: number;
  available: number;
}> {}

class InvalidAmount extends Data.TaggedError("InvalidAmount")<{
  reason: string;
}> {}

// Create new account
export function createAccount(id: string): Account {
  return {
    id,
    balance: 0,
    events: [],
  };
}

// Apply event to account
function applyEventInternal(
  account: Account,
  event: Event
): Effect.Effect<Account, never> {
  return Effect.sync(() => {
    const updated = { ...account };

    switch (event.type) {
      case "Deposit":
        updated.balance += event.amount;
        break;
      case "Withdraw":
        updated.balance -= event.amount;
        break;
      case "Transfer":
        if (event.fromAccountId === account.id) {
          updated.balance -= event.amount;
        } else if (event.toAccountId === account.id) {
          updated.balance += event.amount;
        }
        break;
    }

    updated.events = [...account.events, event];
    return updated;
  });
}

// Reconstruct account from events
export function reconstructAccount(id: string, events: Event[]): Account {
  const reconstructEffect = Effect.gen(function* () {
    let account = createAccount(id);
    for (const event of events) {
      account = yield* applyEventInternal(account, event);
    }
    return account;
  });

  return Effect.runSync(reconstructEffect);
}

// Deposit
export function deposit(account: Account, amount: number): Account {
  if (amount <= 0) {
    throw new Error("Deposit amount must be positive");
  }

  const depositEffect = Effect.gen(function* () {
    const event: DepositEvent = {
      type: "Deposit",
      amount,
      timestamp: Date.now(),
    };
    return yield* applyEventInternal(account, event);
  });

  return Effect.runSync(depositEffect);
}

// Withdraw
export function withdraw(account: Account, amount: number): Account {
  if (amount <= 0) {
    throw new Error("Withdraw amount must be positive");
  }

  const withdrawEffect = Effect.gen(function* () {
    if (account.balance < amount) {
      yield* Effect.fail(
        new InsufficientFunds({ required: amount, available: account.balance })
      );
    }

    const event: WithdrawEvent = {
      type: "Withdraw",
      amount,
      timestamp: Date.now(),
    };
    return yield* applyEventInternal(account, event);
  });

  try {
    return Effect.runSync(withdrawEffect);
  } catch (e) {
    if (e instanceof Error) {
      if (e.message.includes("InsufficientFunds")) {
        throw new Error("Insufficient funds");
      }
      throw e;
    }
    throw new Error("Insufficient funds");
  }
}

// Transfer between accounts
export function transfer(
  fromAccount: Account,
  toAccount: Account,
  amount: number
): { from: Account; to: Account } {
  if (amount <= 0) {
    throw new Error("Transfer amount must be positive");
  }

  const transferEffect = Effect.gen(function* () {
    if (fromAccount.balance < amount) {
      yield* Effect.fail(
        new InsufficientFunds({
          required: amount,
          available: fromAccount.balance,
        })
      );
    }

    const event: TransferEvent = {
      type: "Transfer",
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      amount,
      timestamp: Date.now(),
    };

    const updatedFrom = yield* applyEventInternal(fromAccount, event);
    const updatedTo = yield* applyEventInternal(toAccount, event);

    return { from: updatedFrom, to: updatedTo };
  });

  try {
    return Effect.runSync(transferEffect);
  } catch (e) {
    if (e instanceof Error) {
      if (e.message.includes("InsufficientFunds")) {
        throw new Error("Insufficient funds");
      }
      throw e;
    }
    throw new Error("Insufficient funds");
  }
}

// Apply multiple events to reconstruct state (batch apply)
export function applyEvents(account: Account, events: Event[]): Account {
  const applyEffect = Effect.gen(function* () {
    let current = account;
    for (const event of events) {
      current = yield* applyEventInternal(current, event);
    }
    return current;
  });

  return Effect.runSync(applyEffect);
}