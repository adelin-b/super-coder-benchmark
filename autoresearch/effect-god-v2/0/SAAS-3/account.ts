import { Effect, Data, Exit, Cause } from "effect";

// ─── Domain Events ────────────────────────────────────────────────────────────

export type AccountEvent =
  | { _tag: "Deposited"; accountId: string; amount: number; timestamp: string }
  | { _tag: "Withdrawn"; accountId: string; amount: number; timestamp: string }
  | { _tag: "TransferSent"; accountId: string; amount: number; toAccountId: string; timestamp: string }
  | { _tag: "TransferReceived"; accountId: string; amount: number; fromAccountId: string; timestamp: string };

// ─── Domain Errors ───────────────────────────────────────────────────────────

export class InsufficientFundsError extends Error {
  constructor(public readonly balance: number, public readonly amount: number) {
    super(`Insufficient funds: balance ${balance}, requested ${amount}`);
    this.name = "InsufficientFundsError";
  }
}

export class InvalidAmountError extends Error {
  constructor(amount: number) {
    super(`Invalid amount: ${amount}. Must be positive.`);
    this.name = "InvalidAmountError";
  }
}

// ─── Internal Tagged Errors ───────────────────────────────────────────────────

class InternalInsufficientFunds extends Data.TaggedError("InternalInsufficientFunds")<{
  balance: number;
  amount: number;
}> {}

class InternalInvalidAmount extends Data.TaggedError("InternalInvalidAmount")<{
  amount: number;
}> {}

// ─── State ────────────────────────────────────────────────────────────────────

interface AccountState {
  id: string;
  balance: number;
  events: AccountEvent[];
}

// ─── Account Object Interface ─────────────────────────────────────────────────

export interface Account {
  getId(): string;
  getBalance(): number;
  getEvents(): AccountEvent[];
  deposit(amount: number): void;
  withdraw(amount: number): void;
  transfer(amount: number, toAccount: Account): void;
  applyTransferReceived(amount: number, fromAccountId: string): void;
}

// ─── Event Application ────────────────────────────────────────────────────────

function applyEvent(state: AccountState, event: AccountEvent): AccountState {
  switch (event._tag) {
    case "Deposited":
      return { ...state, balance: state.balance + event.amount };
    case "Withdrawn":
      return { ...state, balance: state.balance - event.amount };
    case "TransferSent":
      return { ...state, balance: state.balance - event.amount };
    case "TransferReceived":
      return { ...state, balance: state.balance + event.amount };
  }
}

function replayEvents(id: string, events: AccountEvent[]): AccountState {
  return events.reduce(applyEvent, { id, balance: 0, events: [] });
}

// ─── Internal Effect Logic ────────────────────────────────────────────────────

const validateAmount = (amount: number): Effect.Effect<number, InternalInvalidAmount> =>
  Effect.gen(function* () {
    if (amount <= 0 || !isFinite(amount) || isNaN(amount)) {
      yield* Effect.fail(new InternalInvalidAmount({ amount }));
    }
    return amount;
  });

const validateSufficientFunds = (
  balance: number,
  amount: number
): Effect.Effect<void, InternalInsufficientFunds> =>
  Effect.gen(function* () {
    if (balance < amount) {
      yield* Effect.fail(new InternalInsufficientFunds({ balance, amount }));
    }
  });

// ─── Factory ──────────────────────────────────────────────────────────────────

function buildAccount(initialState: AccountState): Account {
  let state: AccountState = { ...initialState, events: [...initialState.events] };

  function record(event: AccountEvent): void {
    state = applyEvent(state, event);
    state.events.push(event);
  }

  const account: Account = {
    getId(): string {
      return state.id;
    },

    getBalance(): number {
      return state.balance;
    },

    getEvents(): AccountEvent[] {
      return [...state.events];
    },

    deposit(amount: number): void {
      if (amount <= 0 || !isFinite(amount) || isNaN(amount)) {
        throw new InvalidAmountError(amount);
      }

      const effect = Effect.gen(function* () {
        yield* validateAmount(amount);
        return { _tag: "Deposited" as const, accountId: state.id, amount, timestamp: new Date().toISOString() };
      });

      const exit = Effect.runSyncExit(effect);
      if (Exit.isFailure(exit)) {
        const err = Cause.squash(exit.cause);
        if (err instanceof InternalInvalidAmount) throw new InvalidAmountError(err.amount);
        throw err instanceof Error ? err : new Error(String(err));
      }
      record(exit.value);
    },

    withdraw(amount: number): void {
      if (amount <= 0 || !isFinite(amount) || isNaN(amount)) {
        throw new InvalidAmountError(amount);
      }

      const effect = Effect.gen(function* () {
        yield* validateAmount(amount);
        yield* validateSufficientFunds(state.balance, amount);
        return { _tag: "Withdrawn" as const, accountId: state.id, amount, timestamp: new Date().toISOString() };
      });

      const exit = Effect.runSyncExit(effect);
      if (Exit.isFailure(exit)) {
        const err = Cause.squash(exit.cause);
        if (err instanceof InternalInsufficientFunds) throw new InsufficientFundsError(err.balance, err.amount);
        if (err instanceof InternalInvalidAmount) throw new InvalidAmountError(err.amount);
        throw err instanceof Error ? err : new Error(String(err));
      }
      record(exit.value);
    },

    transfer(amount: number, toAccount: Account): void {
      if (amount <= 0 || !isFinite(amount) || isNaN(amount)) {
        throw new InvalidAmountError(amount);
      }

      const effect = Effect.gen(function* () {
        yield* validateAmount(amount);
        yield* validateSufficientFunds(state.balance, amount);
        return amount;
      });

      const exit = Effect.runSyncExit(effect);
      if (Exit.isFailure(exit)) {
        const err = Cause.squash(exit.cause);
        if (err instanceof InternalInsufficientFunds) throw new InsufficientFundsError(err.balance, err.amount);
        if (err instanceof InternalInvalidAmount) throw new InvalidAmountError(err.amount);
        throw err instanceof Error ? err : new Error(String(err));
      }

      const ts = new Date().toISOString();
      record({ _tag: "TransferSent", accountId: state.id, amount, toAccountId: toAccount.getId(), timestamp: ts });
      toAccount.applyTransferReceived(amount, state.id);
    },

    applyTransferReceived(amount: number, fromAccountId: string): void {
      const ts = new Date().toISOString();
      record({ _tag: "TransferReceived", accountId: state.id, amount, fromAccountId, timestamp: ts });
    },
  };

  return account;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createAccount(id: string): Account {
  if (!id || typeof id !== "string") {
    throw new Error("Account ID must be a non-empty string");
  }
  return buildAccount({ id, balance: 0, events: [] });
}

export function reconstruct(events: AccountEvent[]): Account {
  if (!Array.isArray(events)) {
    throw new Error("Events must be an array");
  }
  if (events.length === 0) {
    throw new Error("Cannot reconstruct account from empty event list");
  }

  const id = events[0].accountId;
  const replayed = replayEvents(id, events);
  const state: AccountState = {
    id,
    balance: replayed.balance,
    events: [...events],
  };
  return buildAccount(state);
}

export function getSnapshot(account: Account): { id: string; balance: number; events: AccountEvent[] } {
  return {
    id: account.getId(),
    balance: account.getBalance(),
    events: account.getEvents(),
  };
}