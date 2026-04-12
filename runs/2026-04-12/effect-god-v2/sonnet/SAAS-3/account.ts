import { Effect, Data, Exit, Cause } from "effect";

// ─── Domain Errors ────────────────────────────────────────────────────────────

export class InsufficientFundsError extends Error {
  constructor(public readonly balance: number, public readonly amount: number) {
    super(`Insufficient funds: balance ${balance}, requested ${amount}`);
    this.name = "InsufficientFundsError";
  }
}

export class InvalidAmountError extends Error {
  constructor(public readonly amount: number) {
    super(`Invalid amount: ${amount}`);
    this.name = "InvalidAmountError";
  }
}

// ─── Internal Tagged Errors ───────────────────────────────────────────────────

class InternalInsufficientFunds extends Data.TaggedError("InsufficientFunds")<{
  balance: number;
  amount: number;
}> {}

class InternalInvalidAmount extends Data.TaggedError("InvalidAmount")<{
  amount: number;
}> {}

type InternalError = InternalInsufficientFunds | InternalInvalidAmount;

// ─── Events ───────────────────────────────────────────────────────────────────

export interface DepositedEvent {
  readonly type: "deposited";
  readonly accountId: string;
  readonly amount: number;
  readonly version: number;
}

export interface WithdrawnEvent {
  readonly type: "withdrawn";
  readonly accountId: string;
  readonly amount: number;
  readonly version: number;
}

export interface TransferredEvent {
  readonly type: "transferred";
  readonly fromAccountId: string;
  readonly toAccountId: string;
  readonly amount: number;
  readonly version: number;
}

export type AccountEvent = DepositedEvent | WithdrawnEvent | TransferredEvent;

// ─── State ────────────────────────────────────────────────────────────────────

export interface AccountState {
  readonly id: string;
  readonly balance: number;
  readonly version: number;
}

// ─── Internal Effect Logic ────────────────────────────────────────────────────

const validateAmount = (amount: number): Effect.Effect<number, InternalInvalidAmount> =>
  Effect.gen(function* () {
    if (!Number.isFinite(amount) || amount <= 0) {
      yield* Effect.fail(new InternalInvalidAmount({ amount }));
    }
    return amount;
  });

const applyEventInternal = (
  state: AccountState,
  event: AccountEvent
): Effect.Effect<AccountState, never> =>
  Effect.gen(function* () {
    switch (event.type) {
      case "deposited": {
        if (event.accountId !== state.id) return state;
        return {
          ...state,
          balance: state.balance + event.amount,
          version: event.version,
        };
      }
      case "withdrawn": {
        if (event.accountId !== state.id) return state;
        return {
          ...state,
          balance: state.balance - event.amount,
          version: event.version,
        };
      }
      case "transferred": {
        if (event.fromAccountId === state.id) {
          return {
            ...state,
            balance: state.balance - event.amount,
            version: event.version,
          };
        }
        if (event.toAccountId === state.id) {
          return {
            ...state,
            balance: state.balance + event.amount,
            version: event.version,
          };
        }
        return state;
      }
    }
  });

const depositEffect = (
  state: AccountState,
  amount: number
): Effect.Effect<{ state: AccountState; events: AccountEvent[] }, InternalError> =>
  Effect.gen(function* () {
    yield* validateAmount(amount);
    const version = state.version + 1;
    const event: DepositedEvent = {
      type: "deposited",
      accountId: state.id,
      amount,
      version,
    };
    const newState = yield* applyEventInternal(state, event);
    return { state: newState, events: [event] };
  });

const withdrawEffect = (
  state: AccountState,
  amount: number
): Effect.Effect<{ state: AccountState; events: AccountEvent[] }, InternalError> =>
  Effect.gen(function* () {
    yield* validateAmount(amount);
    if (state.balance < amount) {
      yield* Effect.fail(
        new InternalInsufficientFunds({ balance: state.balance, amount })
      );
    }
    const version = state.version + 1;
    const event: WithdrawnEvent = {
      type: "withdrawn",
      accountId: state.id,
      amount,
      version,
    };
    const newState = yield* applyEventInternal(state, event);
    return { state: newState, events: [event] };
  });

const transferEffect = (
  from: AccountState,
  to: AccountState,
  amount: number
): Effect.Effect<
  { from: AccountState; to: AccountState; events: AccountEvent[] },
  InternalError
> =>
  Effect.gen(function* () {
    yield* validateAmount(amount);
    if (from.balance < amount) {
      yield* Effect.fail(
        new InternalInsufficientFunds({ balance: from.balance, amount })
      );
    }
    const version = Math.max(from.version, to.version) + 1;
    const event: TransferredEvent = {
      type: "transferred",
      fromAccountId: from.id,
      toAccountId: to.id,
      amount,
      version,
    };
    const newFrom = yield* applyEventInternal(from, event);
    const newTo = yield* applyEventInternal(to, event);
    return { from: newFrom, to: newTo, events: [event] };
  });

const reconstructEffect = (
  id: string,
  events: AccountEvent[]
): Effect.Effect<AccountState, never> =>
  Effect.gen(function* () {
    let state: AccountState = { id, balance: 0, version: 0 };
    for (const event of events) {
      state = yield* applyEventInternal(state, event);
    }
    return state;
  });

// ─── Boundary Helper ──────────────────────────────────────────────────────────

function runOrThrow<A>(effect: Effect.Effect<A, InternalError>): A {
  const exit = Effect.runSyncExit(effect);
  if (Exit.isFailure(exit)) {
    const err = Cause.squash(exit.cause);
    if (err instanceof InternalInsufficientFunds) {
      throw new InsufficientFundsError(err.balance, err.amount);
    }
    if (err instanceof InternalInvalidAmount) {
      throw new InvalidAmountError(err.amount);
    }
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }
  return exit.value;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new account with zero balance.
 */
export function createAccount(id: string): AccountState {
  if (!id || typeof id !== "string" || id.trim() === "") {
    throw new Error("Account id must be a non-empty string");
  }
  return { id: id.trim(), balance: 0, version: 0 };
}

/**
 * Deposit amount into account. Returns updated state and emitted events.
 */
export function deposit(
  account: AccountState,
  amount: number
): { state: AccountState; events: AccountEvent[] } {
  return runOrThrow(depositEffect(account, amount));
}

/**
 * Withdraw amount from account. Throws InsufficientFundsError if balance < amount.
 */
export function withdraw(
  account: AccountState,
  amount: number
): { state: AccountState; events: AccountEvent[] } {
  return runOrThrow(withdrawEffect(account, amount));
}

/**
 * Transfer amount from one account to another. Returns updated states and emitted events.
 */
export function transfer(
  from: AccountState,
  to: AccountState,
  amount: number
): { from: AccountState; to: AccountState; events: AccountEvent[] } {
  return runOrThrow(transferEffect(from, to, amount));
}

/**
 * Apply a single event to a state to produce the next state.
 * Events for other accounts are ignored (state returned unchanged).
 */
export function applyEvent(state: AccountState, event: AccountEvent): AccountState {
  const exit = Effect.runSyncExit(applyEventInternal(state, event));
  if (Exit.isFailure(exit)) {
    const err = Cause.squash(exit.cause);
    throw err instanceof Error ? err : new Error(String(err));
  }
  return exit.value;
}

/**
 * Reconstruct account state by replaying all events from scratch.
 * Invariant: reconstruct(id, events) === sequential applyEvent calls.
 */
export function reconstruct(id: string, events: AccountEvent[]): AccountState {
  const exit = Effect.runSyncExit(reconstructEffect(id, events));
  if (Exit.isFailure(exit)) {
    const err = Cause.squash(exit.cause);
    throw err instanceof Error ? err : new Error(String(err));
  }
  return exit.value;
}

/**
 * Get the current balance of an account.
 */
export function getBalance(account: AccountState): number {
  return account.balance;
}

/**
 * Get the current version (number of events applied) of an account.
 */
export function getVersion(account: AccountState): number {
  return account.version;
}