import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Match from "effect/Match";
import { createMachine } from "xstate";

// Events
export type AccountEvent =
  | { type: "Initialized"; initialBalance: number; timestamp: Date }
  | { type: "Deposited"; amount: number; timestamp: Date }
  | { type: "Withdrawn"; amount: number; timestamp: Date }
  | {
      type: "Transferred";
      toAccountId: string;
      amount: number;
      timestamp: Date;
    };

// Validation Schemas
const PositiveNumber = Schema.pipe(
  Schema.Number,
  Schema.positive({ message: "Amount must be positive" })
);

const DepositEventSchema = Schema.Struct({
  type: Schema.Literal("Deposited"),
  amount: PositiveNumber,
  timestamp: Schema.Date,
});

const WithdrawEventSchema = Schema.Struct({
  type: Schema.Literal("Withdrawn"),
  amount: PositiveNumber,
  timestamp: Schema.Date,
});

const TransferEventSchema = Schema.Struct({
  type: Schema.Literal("Transferred"),
  toAccountId: Schema.String,
  amount: PositiveNumber,
  timestamp: Schema.Date,
});

export const AccountEventSchema = Schema.Union(
  DepositEventSchema,
  WithdrawEventSchema,
  TransferEventSchema
);

// Errors
export class InsufficientFundsError extends Error {
  readonly _tag = "InsufficientFundsError";
  constructor(required: number, available: number) {
    super(
      `Insufficient funds. Required: ${required}, Available: ${available}`
    );
    Object.setPrototypeOf(this, InsufficientFundsError.prototype);
  }
}

export class InvalidAmountError extends Error {
  readonly _tag = "InvalidAmountError";
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, InvalidAmountError.prototype);
  }
}

// Account State
export interface Account {
  id: string;
  balance: number;
  events: AccountEvent[];
}

// XState Machine for Account Lifecycle
export const accountMachine = createMachine(
  {
    id: "account",
    initial: "initialized",
    states: {
      initialized: {
        on: {
          DEPOSIT: "active",
          WITHDRAW: "active",
          TRANSFER: "active",
        },
      },
      active: {
        on: {
          DEPOSIT: "active",
          WITHDRAW: "active",
          TRANSFER: "active",
        },
      },
    },
  },
  {}
);

// Apply event to account state
const applyEvent = (account: Account, event: AccountEvent): Account =>
  Match.value(event).pipe(
    Match.when({ type: "Deposited" }, (e) => ({
      ...account,
      balance: account.balance + e.amount,
      events: [...account.events, event],
    })),
    Match.when({ type: "Withdrawn" }, (e) => ({
      ...account,
      balance: account.balance - e.amount,
      events: [...account.events, event],
    })),
    Match.when({ type: "Transferred" }, (e) => ({
      ...account,
      balance: account.balance - e.amount,
      events: [...account.events, event],
    })),
    Match.orElse(() => ({
      ...account,
      events: [...account.events, event],
    }))
  );

// Create new account with initial balance
export const createAccount = (
  id: string,
  initialBalance: number
): Effect.Effect<Account, InvalidAmountError> =>
  Effect.sync(() => {
    if (initialBalance < 0) {
      throw new InvalidAmountError("Initial balance cannot be negative");
    }
    const initEvent: AccountEvent = {
      type: "Initialized",
      initialBalance,
      timestamp: new Date(),
    };
    return {
      id,
      balance: initialBalance,
      events: [initEvent],
    };
  }).pipe(
    Effect.catchAll(() =>
      Effect.fail(new InvalidAmountError("Failed to create account"))
    )
  );

// Deposit operation
export const deposit = (
  account: Account,
  amount: number
): Effect.Effect<Account, InvalidAmountError> =>
  Effect.sync(() => {
    if (amount <= 0) {
      throw new InvalidAmountError("Deposit amount must be positive");
    }
    const event: AccountEvent = {
      type: "Deposited",
      amount,
      timestamp: new Date(),
    };
    return applyEvent(account, event);
  }).pipe(
    Effect.catchAll((e) => {
      if (e instanceof InvalidAmountError) {
        return Effect.fail(e);
      }
      return Effect.fail(new InvalidAmountError("Deposit operation failed"));
    })
  );

// Withdraw operation
export const withdraw = (
  account: Account,
  amount: number
): Effect.Effect<Account, InsufficientFundsError | InvalidAmountError> =>
  Effect.sync(() => {
    if (amount <= 0) {
      throw new InvalidAmountError("Withdrawal amount must be positive");
    }
    if (account.balance < amount) {
      throw new InsufficientFundsError(amount, account.balance);
    }
    const event: AccountEvent = {
      type: "Withdrawn",
      amount,
      timestamp: new Date(),
    };
    return applyEvent(account, event);
  }).pipe(
    Effect.catchAll((e) => {
      if (e instanceof InsufficientFundsError) {
        return Effect.fail(e);
      }
      if (e instanceof InvalidAmountError) {
        return Effect.fail(e);
      }
      return Effect.fail(
        new InvalidAmountError("Withdrawal operation failed")
      );
    })
  );

// Transfer operation
export const transfer = (
  account: Account,
  toAccountId: string,
  amount: number
): Effect.Effect<Account, InsufficientFundsError | InvalidAmountError> =>
  Effect.sync(() => {
    if (amount <= 0) {
      throw new InvalidAmountError("Transfer amount must be positive");
    }
    if (!toAccountId || toAccountId.trim() === "") {
      throw new InvalidAmountError("Invalid recipient account ID");
    }
    if (account.balance < amount) {
      throw new InsufficientFundsError(amount, account.balance);
    }
    const event: AccountEvent = {
      type: "Transferred",
      toAccountId,
      amount,
      timestamp: new Date(),
    };
    return applyEvent(account, event);
  }).pipe(
    Effect.catchAll((e) => {
      if (e instanceof InsufficientFundsError) {
        return Effect.fail(e);
      }
      if (e instanceof InvalidAmountError) {
        return Effect.fail(e);
      }
      return Effect.fail(new InvalidAmountError("Transfer operation failed"));
    })
  );

// Reconstruct account state from event history
export const reconstructAccount = (
  id: string,
  events: AccountEvent[]
): Effect.Effect<Account, InvalidAmountError> =>
  Effect.sync(() => {
    if (events.length === 0) {
      throw new InvalidAmountError("No events provided");
    }
    const initEvent = events[0];
    if (initEvent.type !== "Initialized") {
      throw new InvalidAmountError("First event must be Initialized");
    }
    const initialBalance = initEvent.initialBalance;
    const reconstructed: Account = {
      id,
      balance: initialBalance,
      events: [],
    };
    return events.reduce(applyEvent, reconstructed);
  }).pipe(
    Effect.catchAll((e) => {
      if (e instanceof InvalidAmountError) {
        return Effect.fail(e);
      }
      return Effect.fail(new InvalidAmountError("Failed to reconstruct account"));
    })
  );

// Validate event before applying
export const validateEvent = (
  event: unknown
): Effect.Effect<AccountEvent, InvalidAmountError> =>
  Effect.try({
    try: () => Schema.decodeSync(AccountEventSchema)(event as any),
    catch: () =>
      new InvalidAmountError("Event validation failed: invalid event structure"),
  });

// Get current balance
export const getBalance = (account: Account): Effect.Effect<number> =>
  Effect.succeed(account.balance);

// Get event history
export const getEvents = (account: Account): Effect.Effect<AccountEvent[]> =>
  Effect.succeed([...account.events]);

// Get account ID
export const getAccountId = (account: Account): Effect.Effect<string> =>
  Effect.succeed(account.id);