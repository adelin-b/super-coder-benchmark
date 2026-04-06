import { Effect, Data, Exit, Cause } from "effect"

// Domain errors
class InsufficientFunds extends Data.TaggedError("InsufficientFunds")<{
  accountId: string
  balance: number
  requested: number
}> {}

class InvalidAmount extends Data.TaggedError("InvalidAmount")<{
  amount: number
  reason: string
}> {}

// Event types
export type AccountEvent =
  | { type: "Deposited"; accountId: string; amount: number; timestamp: Date }
  | { type: "Withdrawn"; accountId: string; amount: number; timestamp: Date }
  | {
      type: "TransferOut"
      fromAccountId: string
      toAccountId: string
      amount: number
      timestamp: Date
    }
  | {
      type: "TransferIn"
      fromAccountId: string
      toAccountId: string
      amount: number
      timestamp: Date
    }

// Account aggregate root
export class Account {
  private balance: number = 0
  private events: AccountEvent[] = []
  private id: string

  constructor(id: string) {
    this.id = id
  }

  static fromEvents(id: string, events: AccountEvent[]): Account {
    const account = new Account(id)
    account.loadFromHistory(events)
    return account
  }

  private loadFromHistory(events: AccountEvent[]): void {
    this.balance = 0
    this.events = []
    for (const event of events) {
      if (event.type === "Deposited" && event.accountId === this.id) {
        this.balance += event.amount
        this.events.push(event)
      } else if (event.type === "Withdrawn" && event.accountId === this.id) {
        this.balance -= event.amount
        this.events.push(event)
      } else if (event.type === "TransferOut" && event.fromAccountId === this.id) {
        this.balance -= event.amount
        this.events.push(event)
      } else if (event.type === "TransferIn" && event.toAccountId === this.id) {
        this.balance += event.amount
        this.events.push(event)
      }
    }
  }

  getId(): string {
    return this.id
  }

  getBalance(): number {
    return this.balance
  }

  getEvents(): AccountEvent[] {
    return [...this.events]
  }

  deposit(amount: number): void {
    const validateEffect = Effect.gen(function* () {
      if (amount <= 0) {
        yield* Effect.fail(new InvalidAmount({ amount, reason: "Amount must be positive" }))
      }
    })

    const exit = Effect.runSyncExit(validateEffect)
    if (Exit.isFailure(exit)) {
      throw Cause.squash(exit.cause)
    }

    this.balance += amount
    this.events.push({
      type: "Deposited",
      accountId: this.id,
      amount,
      timestamp: new Date(),
    })
  }

  withdraw(amount: number): void {
    const validateEffect = Effect.gen(function* () {
      if (amount <= 0) {
        yield* Effect.fail(new InvalidAmount({ amount, reason: "Amount must be positive" }))
      }
      if (this.balance < amount) {
        yield* Effect.fail(
          new InsufficientFunds({
            accountId: this.id,
            balance: this.balance,
            requested: amount,
          })
        )
      }
    })

    const exit = Effect.runSyncExit(validateEffect)
    if (Exit.isFailure(exit)) {
      throw Cause.squash(exit.cause)
    }

    this.balance -= amount
    this.events.push({
      type: "Withdrawn",
      accountId: this.id,
      amount,
      timestamp: new Date(),
    })
  }

  transfer(toAccountId: string, amount: number): void {
    const validateEffect = Effect.gen(function* () {
      if (amount <= 0) {
        yield* Effect.fail(new InvalidAmount({ amount, reason: "Amount must be positive" }))
      }
      if (this.balance < amount) {
        yield* Effect.fail(
          new InsufficientFunds({
            accountId: this.id,
            balance: this.balance,
            requested: amount,
          })
        )
      }
    })

    const exit = Effect.runSyncExit(validateEffect)
    if (Exit.isFailure(exit)) {
      throw Cause.squash(exit.cause)
    }

    this.balance -= amount
    this.events.push({
      type: "TransferOut",
      fromAccountId: this.id,
      toAccountId,
      amount,
      timestamp: new Date(),
    })
  }

  receiveTransfer(fromAccountId: string, amount: number): void {
    this.balance += amount
    this.events.push({
      type: "TransferIn",
      fromAccountId,
      toAccountId: this.id,
      amount,
      timestamp: new Date(),
    })
  }
}