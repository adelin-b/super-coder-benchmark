import { Effect, Data } from "effect";

// Event types
export type DepositEvent = {
  readonly type: "Deposit";
  readonly amount: number;
  readonly timestamp: Date;
};

export type WithdrawEvent = {
  readonly type: "Withdraw";
  readonly amount: number;
  readonly timestamp: Date;
};

export type TransferEvent = {
  readonly type: "Transfer";
  readonly to: string;
  readonly amount: number;
  readonly timestamp: Date;
};

export type AccountEvent = DepositEvent | WithdrawEvent | TransferEvent;

export interface AccountState {
  readonly balance: number;
  readonly events: readonly AccountEvent[];
}

class InvalidAmountError extends Data.TaggedError("InvalidAmountError")<{
  reason: string;
}> {}

class InsufficientFundsError extends Data.TaggedError("InsufficientFundsError")<{
  balance: number;
  requested: number;
}> {}

function validateAmount(amount: number): Effect.Effect<number, InvalidAmountError> {
  return amount > 0
    ? Effect.succeed(amount)
    : Effect.fail(new InvalidAmountError({ reason: "amount must be positive" }));
}

function applyEventInternal(
  state: AccountState,
  event: AccountEvent
): Effect.Effect<AccountState, never> {
  const newBalance =
    event.type === "Deposit"
      ? state.balance + event.amount
      : state.balance - event.amount;

  return Effect.succeed({
    balance: newBalance,
    events: [...state.events, event],
  });
}

function depositInternal(
  state: AccountState,
  amount: number
): Effect.Effect<AccountState, InvalidAmountError> {
  return Effect.gen(function* () {
    yield* validateAmount(amount);
    const event: DepositEvent = {
      type: "Deposit",
      amount,
      timestamp: new Date(),
    };
    return yield* applyEventInternal(state, event);
  });
}

function withdrawInternal(
  state: AccountState,
  amount: number
): Effect.Effect<AccountState, InvalidAmountError | InsufficientFundsError> {
  return Effect.gen(function* () {
    yield* validateAmount(amount);
    if (state.balance < amount) {
      yield* Effect.fail(
        new InsufficientFundsError({ balance: state.balance, requested: amount })
      );
    }
    const event: WithdrawEvent = {
      type: "Withdraw",
      amount,
      timestamp: new Date(),
    };
    return yield* applyEventInternal(state, event);
  });
}

function transferInternal(
  state: AccountState,
  to: string,
  amount: number
): Effect.Effect<AccountState, InvalidAmountError | InsufficientFundsError> {
  return Effect.gen(function* () {
    if (!to || to.length === 0) {
      yield* Effect.fail(new InvalidAmountError({ reason: "recipient cannot be empty" }));
    }
    yield* validateAmount(amount);
    if (state.balance < amount) {
      yield* Effect.fail(
        new InsufficientFundsError({ balance: state.balance, requested: amount })
      );
    }
    const event: TransferEvent = {
      type: "Transfer",
      to,
      amount,
      timestamp: new Date(),
    };
    return yield* applyEventInternal(state, event);
  });
}

export function createAccount(): AccountState {
  return {
    balance: 0,
    events: [],
  };
}

export function deposit(state: AccountState, amount: number): AccountState {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }
  try {
    return Effect.runSync(depositInternal(state, amount));
  } catch (e) {
    throw new Error(`Deposit failed: ${String(e)}`);
  }
}

export function withdraw(state: AccountState, amount: number): AccountState {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }
  if (state.balance < amount) {
    throw new Error(
      `Insufficient funds: balance ${state.balance}, requested ${amount}`
    );
  }
  try {
    return Effect.runSync(withdrawInternal(state, amount));
  } catch (e) {
    throw new Error(`Withdrawal failed: ${String(e)}`);
  }
}

export function transfer(state: AccountState, to: string, amount: number): AccountState {
  if (!to || to.length === 0) {
    throw new Error("Recipient cannot be empty");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }
  if (state.balance < amount) {
    throw new Error(
      `Insufficient funds: balance ${state.balance}, requested ${amount}`
    );
  }
  try {
    return Effect.runSync(transferInternal(state, to, amount));
  } catch (e) {
    throw new Error(`Transfer failed: ${String(e)}`);
  }
}

export function reconstructFromEvents(events: readonly AccountEvent[]): AccountState {
  if (!Array.isArray(events)) {
    throw new Error("Events must be an array");
  }

  let state: AccountState = createAccount();

  for (const event of events) {
    try {
      state = Effect.runSync(applyEventInternal(state, event));
    } catch (e) {
      throw new Error(`Failed to apply event: ${String(e)}`);
    }
  }

  return state;
}