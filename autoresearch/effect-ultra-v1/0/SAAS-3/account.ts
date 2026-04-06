import { Effect, Data, pipe } from "effect";

// Event types
export type AccountEvent = 
  | { type: "deposited"; amount: number; timestamp: Date }
  | { type: "withdrawn"; amount: number; timestamp: Date }
  | { type: "transferred_out"; amount: number; toAccountId: string; timestamp: Date }
  | { type: "transferred_in"; amount: number; fromAccountId: string; timestamp: Date };

class InvalidAmountError extends Data.TaggedError("InvalidAmountError")<{
  reason: string;
}> {}

class InsufficientBalanceError extends Data.TaggedError("InsufficientBalanceError")<{
  required: number;
  available: number;
}> {}

export class Account {
  private events: AccountEvent[] = [];
  private readonly id: string;

  constructor(id: string, events: AccountEvent[] = []) {
    this.id = id;
    this.events = [...events];
  }

  private validateAmount(amount: number): Effect.Effect<number, InvalidAmountError> {
    return Effect.gen(function* () {
      if (amount <= 0) {
        yield* Effect.fail(
          new InvalidAmountError({ reason: "amount must be positive" })
        );
      }
      if (!Number.isFinite(amount)) {
        yield* Effect.fail(
          new InvalidAmountError({ reason: "amount must be finite" })
        );
      }
      return amount;
    });
  }

  private validateBalance(
    requiredAmount: number
  ): Effect.Effect<number, InsufficientBalanceError> {
    return Effect.gen(function* () {
      const available = this.getBalance();
      if (available < requiredAmount) {
        yield* Effect.fail(
          new InsufficientBalanceError({
            required: requiredAmount,
            available,
          })
        );
      }
      return available;
    });
  }

  getBalance(): number {
    return this.events.reduce((balance, event) => {
      switch (event.type) {
        case "deposited":
        case "transferred_in":
          return balance + event.amount;
        case "withdrawn":
        case "transferred_out":
          return balance - event.amount;
      }
    }, 0);
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }

  getId(): string {
    return this.id;
  }

  deposit(amount: number): void {
    const effect = Effect.gen(function* () {
      yield* this.validateAmount(amount);
      const event: AccountEvent = {
        type: "deposited",
        amount,
        timestamp: new Date(),
      };
      this.events.push(event);
      return undefined;
    });

    try {
      Effect.runSync(effect);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(e.message);
      }
      throw e;
    }
  }

  withdraw(amount: number): void {
    const effect = Effect.gen(function* () {
      yield* this.validateAmount(amount);
      yield* this.validateBalance(amount);
      const event: AccountEvent = {
        type: "withdrawn",
        amount,
        timestamp: new Date(),
      };
      this.events.push(event);
      return undefined;
    });

    try {
      Effect.runSync(effect);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(e.message);
      }
      throw e;
    }
  }

  transfer(amount: number, toAccountId: string, toAccount: Account): void {
    const effect = Effect.gen(function* () {
      yield* this.validateAmount(amount);
      yield* this.validateBalance(amount);

      const fromEvent: AccountEvent = {
        type: "transferred_out",
        amount,
        toAccountId,
        timestamp: new Date(),
      };
      const toEvent: AccountEvent = {
        type: "transferred_in",
        amount,
        fromAccountId: this.id,
        timestamp: new Date(),
      };

      this.events.push(fromEvent);
      toAccount.events.push(toEvent);
      return undefined;
    });

    try {
      Effect.runSync(effect);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(e.message);
      }
      throw e;
    }
  }

  static fromEvents(id: string, events: AccountEvent[]): Account {
    return new Account(id, events);
  }
}