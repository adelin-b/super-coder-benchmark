import { Effect, Data } from "effect"

// Domain errors
class InsufficientFunds extends Data.TaggedError("InsufficientFunds")<{
  accountId: string
  requested: number
  available: number
}> {}

class InvalidAmount extends Data.TaggedError("InvalidAmount")<{
  amount: number
}> {}

// Events
export interface Deposited {
  type: "Deposited"
  accountId: string
  amount: number
  timestamp: Date
}

export interface Withdrawn {
  type: "Withdrawn"
  accountId: string
  amount: number
  timestamp: Date
}

export interface Transferred {
  type: "Transferred"
  fromAccountId: string
  toAccountId: string
  amount: number
  timestamp: Date
}

export type DomainEvent = Deposited | Withdrawn | Transferred

// Account state
export interface AccountState {
  accountId: string
  balance: number
  version: number
}

// Event-sourced aggregate
export class BankAccount {
  private balance: number
  private events: DomainEvent[]
  private version: number

  constructor(
    private accountId: string,
    events: DomainEvent[] = []
  ) {
    this.balance = 0
    this.version = 0
    this.events = []
    this.applyEvents(events)
  }

  private applyEvents(events: DomainEvent[]): void {
    for (const event of events) {
      this.applyEvent(event)
    }
  }

  private applyEvent(event: DomainEvent): void {
    switch (event.type) {
      case "Deposited":
        if (event.accountId === this.accountId) {
          this.balance += event.amount
          this.version += 1
        }
        break
      case "Withdrawn":
        if (event.accountId === this.accountId) {
          this.balance -= event.amount
          this.version += 1
        }
        break
      case "Transferred":
        if (event.fromAccountId === this.accountId) {
          this.balance -= event.amount
          this.version += 1
        } else if (event.toAccountId === this.accountId) {
          this.balance += event.amount
          this.version += 1
        }
        break
    }
    this.events.push(event)
  }

  deposit(amount: number): Deposited {
    const effect = Effect.gen(function* () {
      if (amount <= 0) {
        yield* Effect.fail(new InvalidAmount({ amount }))
      }
      return {
        type: "Deposited" as const,
        accountId: this.accountId,
        amount,
        timestamp: new Date()
      }
    })

    try {
      const event = Effect.runSync(effect)
      this.applyEvent(event)
      return event
    } catch (e) {
      if (e instanceof InvalidAmount) {
        throw new Error(`Invalid deposit amount: ${e.amount}`)
      }
      throw e
    }
  }

  withdraw(amount: number): Withdrawn {
    const effect = Effect.gen(function* () {
      if (amount <= 0) {
        yield* Effect.fail(new InvalidAmount({ amount }))
      }
      if (amount > this.balance) {
        yield* Effect.fail(
          new InsufficientFunds({
            accountId: this.accountId,
            requested: amount,
            available: this.balance
          })
        )
      }
      return {
        type: "Withdrawn" as const,
        accountId: this.accountId,
        amount,
        timestamp: new Date()
      }
    })

    try {
      const event = Effect.runSync(effect)
      this.applyEvent(event)
      return event
    } catch (e) {
      if (e instanceof InvalidAmount) {
        throw new Error(`Invalid withdrawal amount: ${e.amount}`)
      }
      if (e instanceof InsufficientFunds) {
        throw new Error(
          `Insufficient funds: requested ${e.requested}, available ${e.available}`
        )
      }
      throw e
    }
  }

  transfer(toAccountId: string, amount: number): Transferred {
    const effect = Effect.gen(function* () {
      if (amount <= 0) {
        yield* Effect.fail(new InvalidAmount({ amount }))
      }
      if (amount > this.balance) {
        yield* Effect.fail(
          new InsufficientFunds({
            accountId: this.accountId,
            requested: amount,
            available: this.balance
          })
        )
      }
      return {
        type: "Transferred" as const,
        fromAccountId: this.accountId,
        toAccountId,
        amount,
        timestamp: new Date()
      }
    })

    try {
      const event = Effect.runSync(effect)
      this.applyEvent(event)
      return event
    } catch (e) {
      if (e instanceof InvalidAmount) {
        throw new Error(`Invalid transfer amount: ${e.amount}`)
      }
      if (e instanceof InsufficientFunds) {
        throw new Error(
          `Insufficient funds for transfer: requested ${e.requested}, available ${e.available}`
        )
      }
      throw e
    }
  }

  getState(): AccountState {
    return {
      accountId: this.accountId,
      balance: this.balance,
      version: this.version
    }
  }

  getBalance(): number {
    return this.balance
  }

  getEvents(): DomainEvent[] {
    return [...this.events]
  }

  getAccountId(): string {
    return this.accountId
  }
}

export function reconstructFromEvents(
  accountId: string,
  events: DomainEvent[]
): BankAccount {
  return new BankAccount(accountId, events)
}