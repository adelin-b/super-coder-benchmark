import { Effect, Data, pipe } from "effect";

// Event types
type DepositEvent = {
  type: "Deposited";
  accountId: string;
  amount: number;
  timestamp: string;
};

type WithdrawEvent = {
  type: "Withdrawn";
  accountId: string;
  amount: number;
  timestamp: string;
};

type TransferEvent = {
  type: "TransferredOut" | "TransferredIn";
  accountId: string;
  otherAccountId: string;
  amount: number;
  timestamp: string;
};

export type Event = DepositEvent | WithdrawEvent | TransferEvent;

export type Account = {
  id: string;
  balance: number;
  eventHistory: Event[];
};

class InsufficientFundsError extends Data.TaggedError("InsufficientFunds")<{
  required: number;
  available: number;
}> {}

class InvalidAmountError extends Data.TaggedError("InvalidAmount")<{
  amount: number;
}> {}

function validateAmount(amount: number): Effect.Effect<number, InvalidAmountError> {
  return amount > 0
    ? Effect.succeed(amount)
    : Effect.fail(new InvalidAmountError({ amount }));
}

function validateSufficientFunds(
  balance: number,
  amount: number
): Effect.Effect<void, InsufficientFundsError> {
  return balance >= amount
    ? Effect.succeed(void 0)
    : Effect.fail(new InsufficientFunds({ required: amount, available: balance }));
}

export function createAccount(id: string, initialBalance: number): Account {
  if (initialBalance < 0) {
    throw new Error("Initial balance cannot be negative");
  }
  return {
    id,
    balance: initialBalance,
    eventHistory: [],
  };
}

export function applyEvent(account: Account, event: Event): Account {
  const result = Effect.runSync(
    Effect.gen(function* () {
      let newBalance = account.balance;

      if (event.type === "Deposited") {
        newBalance += event.amount;
      } else if (event.type === "Withdrawn") {
        newBalance -= event.amount;
      } else if (event.type === "TransferredOut") {
        newBalance -= event.amount;
      } else if (event.type === "TransferredIn") {
        newBalance += event.amount;
      }

      if (newBalance < 0) {
        yield* Effect.fail(
          new InsufficientFunds({
            required: event.amount,
            available: account.balance,
          })
        );
      }

      return {
        id: account.id,
        balance: newBalance,
        eventHistory: [...account.eventHistory, event],
      };
    })
  );
  return result;
}

export function getBalance(account: Account): number {
  return account.balance;
}

export function reconstruct(id: string, events: Event[]): Account {
  const account = createAccount(id, 0);
  let current = account;
  for (const event of events) {
    current = applyEvent(current, event);
  }
  return current;
}

export function deposit(account: Account, amount: number): Event {
  const result = Effect.runSync(
    Effect.gen(function* () {
      yield* validateAmount(amount);
      const timestamp = new Date().toISOString();
      const event: DepositEvent = {
        type: "Deposited",
        accountId: account.id,
        amount,
        timestamp,
      };
      return event;
    })
  );
  return result;
}

export function withdraw(account: Account, amount: number): Event {
  const result = Effect.runSync(
    Effect.gen(function* () {
      yield* validateAmount(amount);
      yield* validateSufficientFunds(account.balance, amount);
      const timestamp = new Date().toISOString();
      const event: WithdrawEvent = {
        type: "Withdrawn",
        accountId: account.id,
        amount,
        timestamp,
      };
      return event;
    })
  );
  return result;
}

export function transfer(
  fromAccount: Account,
  toAccount: Account,
  amount: number
): Event[] {
  const result = Effect.runSync(
    Effect.gen(function* () {
      yield* validateAmount(amount);
      yield* validateSufficientFunds(fromAccount.balance, amount);
      const timestamp = new Date().toISOString();
      const outEvent: TransferEvent = {
        type: "TransferredOut",
        accountId: fromAccount.id,
        otherAccountId: toAccount.id,
        amount,
        timestamp,
      };
      const inEvent: TransferEvent = {
        type: "TransferredIn",
        accountId: toAccount.id,
        otherAccountId: fromAccount.id,
        amount,
        timestamp,
      };
      return [outEvent, inEvent];
    })
  );
  return result;
}