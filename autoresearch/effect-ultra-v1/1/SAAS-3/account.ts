import { Effect, Data, pipe } from "effect";

// === INTERNAL: Effect-based Error Types ===
class InvalidAmountError extends Data.TaggedError("InvalidAmountError")<{
  reason: string;
}> {}

class InsufficientBalanceError extends Data.TaggedError(
  "InsufficientBalanceError"
)<{ balance: number; amount: number }> {}

class InvalidEventError extends Data.TaggedError("InvalidEventError")<{
  reason: string;
}> {}

// === TYPE DEFINITIONS ===
export type DepositedEvent = {
  type: "Deposited";
  amount: number;
  timestamp: number;
};

export type WithdrawnEvent = {
  type: "Withdrawn";
  amount: number;
  timestamp: number;
};

export type TransferredEvent = {
  type: "Transferred";
  amount: number;
  from: string;
  to: string;
  timestamp: number;
};

export type Event = DepositedEvent | WithdrawnEvent | TransferredEvent;

export type Account = {
  id: string;
  balance: number;
};

// === INTERNAL: Effect Operations ===
const validateAmount = (amount: number): Effect.Effect<number, InvalidAmountError> =>
  amount > 0
    ? Effect.succeed(amount)
    : Effect.fail(new InvalidAmountError({ reason: "Amount must be positive" }));

const validateDeposit = (amount: number): Effect.Effect<number, InvalidAmountError> =>
  validateAmount(amount);

const validateWithdrawal = (
  amount: number,
  balance: number
): Effect.Effect<number, InvalidAmountError | InsufficientBalanceError> =>
  pipe(
    validateAmount(amount),
    Effect.flatMap((validAmount) =>
      validAmount <= balance
        ? Effect.succeed(validAmount)
        : Effect.fail(new InsufficientBalanceError({ balance, amount }))
    )
  );

const applyDepositInternal = (
  account: Account,
  amount: number
): Effect.Effect<Account, InvalidAmountError> =>
  pipe(
    validateDeposit(amount),
    Effect.map((validAmount) => ({
      ...account,
      balance: account.balance + validAmount,
    }))
  );

const applyWithdrawalInternal = (
  account: Account,
  amount: number
): Effect.Effect<Account, InvalidAmountError | InsufficientBalanceError> =>
  pipe(
    validateWithdrawal(amount, account.balance),
    Effect.map((validAmount) => ({
      ...account,
      balance: account.balance - validAmount,
    }))
  );

const applyTransferInternal = (
  account: Account,
  amount: number
): Effect.Effect<Account, InvalidAmountError | InsufficientBalanceError> =>
  pipe(
    validateWithdrawal(amount, account.balance),
    Effect.map((validAmount) => ({
      ...account,
      balance: account.balance - validAmount,
    }))
  );

const applyEventInternal = (
  account: Account,
  event: Event
): Effect.Effect<Account, InvalidAmountError | InsufficientBalanceError | InvalidEventError> =>
  Effect.gen(function* () {
    switch (event.type) {
      case "Deposited":
        return yield* applyDepositInternal(account, event.amount);
      case "Withdrawn":
        return yield* applyWithdrawalInternal(account, event.amount);
      case "Transferred":
        return yield* applyTransferInternal(account, event.amount);
      default:
        return yield* Effect.fail(new InvalidEventError({ reason: "Unknown event type" }));
    }
  });

const reconstructInternal = (
  events: Event[]
): Effect.Effect<Account, InvalidAmountError | InsufficientBalanceError | InvalidEventError> =>
  Effect.gen(function* () {
    if (!Array.isArray(events)) {
      return yield* Effect.fail(new InvalidEventError({ reason: "Events must be an array" }));
    }

    let account: Account = { id: "reconstructed", balance: 0 };

    for (const event of events) {
      account = yield* applyEventInternal(account, event);
    }

    return account;
  });

// === EXPORTED: Plain TypeScript ===
export function createAccount(id: string, initialBalance: number = 0): Account {
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Account ID must be a non-empty string");
  }
  if (initialBalance < 0) {
    throw new Error("Initial balance cannot be negative");
  }
  return { id, balance: initialBalance };
}

export function applyEvent(account: Account, event: Event): Account {
  if (!account || !event) {
    throw new Error("Account and event are required");
  }

  try {
    return Effect.runSync(applyEventInternal(account, event));
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}

export function getBalance(account: Account): number {
  if (!account) {
    throw new Error("Account is required");
  }
  return account.balance;
}

export function reconstruct(events: Event[]): Account {
  if (!Array.isArray(events)) {
    throw new Error("Events must be an array");
  }

  try {
    return Effect.runSync(reconstructInternal(events));
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}