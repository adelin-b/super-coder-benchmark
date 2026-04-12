import { Effect, Data, Exit, Cause } from "effect";
import crypto from "node:crypto";

// ============ Internal Tagged Errors ============

class InsufficientFundsInternal extends Data.TaggedError("InsufficientFundsInternal")<{
  balance: number;
  amount: number;
}> {}

class InvalidAmountInternal extends Data.TaggedError("InvalidAmountInternal")<{
  reason: string;
}> {}

// ============ Public Error Classes ============

export class InsufficientFundsError extends Error {
  readonly balance: number;
  readonly amount: number;

  constructor(balance: number, amount: number) {
    super(`Insufficient funds: balance ${balance}, attempted ${amount}`);
    this.name = "InsufficientFundsError";
    this.balance = balance;
    this.amount = amount;
    Object.setPrototypeOf(this, InsufficientFundsError.prototype);
  }
}

export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAmountError";
    Object.setPrototypeOf(this, InvalidAmountError.prototype);
  }
}

// ============ Event Types ============

export type DepositEvent = {
  readonly type: "deposited";
  readonly accountId: string;
  readonly amount: number;
  readonly timestamp: Date;
  readonly eventId: string;
};

export type WithdrawEvent = {
  readonly type: "withdrawn";
  readonly accountId: string;
  readonly amount: number;
  readonly timestamp: Date;
  readonly eventId: string;
};

export type TransferEvent = {
  readonly type: "transferred";
  readonly fromAccountId: string;
  readonly toAccountId: string;
  readonly amount: number;
  readonly timestamp: Date;
  readonly eventId: string;
};

export type AccountEvent = DepositEvent | WithdrawEvent | TransferEvent;

// ============ Account State ============

export type AccountState = {
  readonly id: string;
  readonly balance: number;
};

// ============ Internal State Application ============

function applyEventToState(state: AccountState, event: AccountEvent): AccountState {
  switch (event.type) {
    case "deposited":
      if (event.accountId !== state.id) return state;
      return { ...state, balance: state.balance + event.amount };
    case "withdrawn":
      if (event.accountId !== state.id) return state;
      return { ...state, balance: state.balance - event.amount };
    case "transferred":
      if (event.fromAccountId === state.id) {
        return { ...state, balance: state.balance - event.amount };
      } else if (event.toAccountId === state.id) {
        return { ...state, balance: state.balance + event.amount };
      }
      return state;
  }
}

// ============ Internal Effects ============

type DepositResult = { newBalance: number; event: DepositEvent };
type WithdrawResult = { newBalance: number; event: WithdrawEvent };

const makeDepositEffect = (
  state: AccountState,
  amount: number
): Effect.Effect<DepositResult, InvalidAmountInternal> =>
  Effect.gen(function* () {
    if (amount <= 0) {
      yield* Effect.fail(new InvalidAmountInternal({ reason: "Amount must be positive" }));
    }
    const event: DepositEvent = {
      type: "deposited",
      accountId: state.id,
      amount,
      timestamp: new Date(),
      eventId: crypto.randomUUID(),
    };
    const newState = applyEventToState(state, event);
    return { newBalance: newState.balance, event };
  });

const makeWithdrawEffect = (
  state: AccountState,
  amount: number
): Effect.Effect<WithdrawResult, InvalidAmountInternal | InsufficientFundsInternal> =>
  Effect.gen(function* () {
    if (amount <= 0) {
      yield* Effect.fail(new InvalidAmountInternal({ reason: "Amount must be positive" }));
    }
    if (state.balance < amount) {
      yield* Effect.fail(
        new InsufficientFundsInternal({ balance: state.balance, amount })
      );
    }
    const event: WithdrawEvent = {
      type: "withdrawn",
      accountId: state.id,
      amount,
      timestamp: new Date(),
      eventId: crypto.randomUUID(),
    };
    const newState = applyEventToState(state, event);
    return { newBalance: newState.balance, event };
  });

// ============ BankAccount Interface ============

export type BankAccount = {
  getId(): string;
  getBalance(): number;
  getEvents(): AccountEvent[];
  deposit(amount: number): DepositEvent;
  withdraw(amount: number): WithdrawEvent;
  transfer(toAccount: BankAccount, amount: number): TransferEvent;
};

// ============ Internal Mutable State via WeakMap ============

type InternalData = {
  id: string;
  balance: number;
  events: AccountEvent[];
};

const _registry = new WeakMap<BankAccount, InternalData>();

// ============ Factory ============

export function createAccount(id?: string): BankAccount {
  const accountId = id ?? crypto.randomUUID();
  const data: InternalData = {
    id: accountId,
    balance: 0,
    events: [],
  };

  const account: BankAccount = {
    getId(): string {
      return data.id;
    },

    getBalance(): number {
      return data.balance;
    },

    getEvents(): AccountEvent[] {
      return [...data.events];
    },

    deposit(amount: number): DepositEvent {
      if (amount <= 0) throw new InvalidAmountError("Amount must be positive");

      const state: AccountState = { id: data.id, balance: data.balance };
      const exit = Effect.runSyncExit(makeDepositEffect(state, amount));

      if (Exit.isFailure(exit)) {
        const raw = Cause.squash(exit.cause);
        const msg =
          raw instanceof Error
            ? raw.message
            : (raw as { reason?: string }).reason ?? String(raw);
        throw new InvalidAmountError(msg);
      }

      const { newBalance, event } = exit.value;
      data.balance = newBalance;
      data.events.push(event);
      return event;
    },

    withdraw(amount: number): WithdrawEvent {
      if (amount <= 0) throw new InvalidAmountError("Amount must be positive");
      if (data.balance < amount)
        throw new InsufficientFundsError(data.balance, amount);

      const state: AccountState = { id: data.id, balance: data.balance };
      const exit = Effect.runSyncExit(makeWithdrawEffect(state, amount));

      if (Exit.isFailure(exit)) {
        const raw = Cause.squash(exit.cause) as {
          _tag?: string;
          balance?: number;
          amount?: number;
          reason?: string;
          message?: string;
        };
        if (raw._tag === "InsufficientFundsInternal") {
          throw new InsufficientFundsError(raw.balance ?? 0, raw.amount ?? 0);
        }
        const msg =
          raw instanceof Error ? raw.message : raw.reason ?? String(raw);
        throw new InvalidAmountError(msg as string);
      }

      const { newBalance, event } = exit.value;
      data.balance = newBalance;
      data.events.push(event);
      return event;
    },

    transfer(toAccount: BankAccount, amount: number): TransferEvent {
      if (amount <= 0) throw new InvalidAmountError("Amount must be positive");
      if (data.balance < amount)
        throw new InsufficientFundsError(data.balance, amount);

      const event: TransferEvent = {
        type: "transferred",
        fromAccountId: data.id,
        toAccountId: toAccount.getId(),
        amount,
        timestamp: new Date(),
        eventId: crypto.randomUUID(),
      };

      // Apply to source (deduct)
      data.balance -= amount;
      data.events.push(event);

      // Apply to destination (credit) via registry
      const toData = _registry.get(toAccount);
      if (toData) {
        toData.balance += amount;
        toData.events.push(event);
      }

      return event;
    },
  };

  _registry.set(account, data);
  return account;
}

// ============ reconstructFromEvents ============

export function reconstructFromEvents(
  events: AccountEvent[],
  accountId?: string
): AccountState {
  // Infer account ID from first relevant event if not provided
  let id = accountId;
  if (!id) {
    for (const event of events) {
      if (event.type === "deposited" || event.type === "withdrawn") {
        id = event.accountId;
        break;
      } else if (event.type === "transferred") {
        id = event.fromAccountId;
        break;
      }
    }
    if (!id) id = "";
  }

  let state: AccountState = { id, balance: 0 };
  for (const event of events) {
    state = applyEventToState(state, event);
  }
  return state;
}