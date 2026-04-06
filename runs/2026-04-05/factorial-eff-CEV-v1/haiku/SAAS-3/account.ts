import { Effect, Data } from "effect"

// ============================================================================
// Event Types
// ============================================================================

type AccountEvent =
  | { type: "Deposited"; amount: number; timestamp: number }
  | { type: "Withdrawn"; amount: number; timestamp: number }
  | { type: "TransferredOut"; to: string; amount: number; timestamp: number }
  | { type: "TransferredIn"; from: string; amount: number; timestamp: number }

// ============================================================================
// Error Types
// ============================================================================

class InsufficientBalance extends Data.TaggedError("InsufficientBalance")<{
  required: number
  available: number
}> {}

class InvalidAmount extends Data.TaggedError("InvalidAmount")<{
  amount: number
}> {}

class InvalidAccountId extends Data.TaggedError("InvalidAccountId")<{
  id: string
}> {}

// ============================================================================
// Account State
// ============================================================================

export interface AccountState {
  id: string
  balance: number
}

// ============================================================================
// Account Aggregate
// ============================================================================

export class Account {
  private constructor(
    private state: AccountState,
    private events: AccountEvent[]
  ) {}

  static create(id: string): Account {
    if (!id || typeof id !== "string") {
      throw new Error("Account ID must be a non-empty string")
    }
    return new Account({ id, balance: 0 }, [])
  }

  static fromEvents(id: string, events: AccountEvent[]): Account {
    if (!id || typeof id !== "string") {
      throw new Error("Account ID must be a non-empty string")
    }
    if (!Array.isArray(events)) {
      throw new Error("Events must be an array")
    }

    let balance = 0
    for (const event of events) {
      switch (event.type) {
        case "Deposited":
          balance += event.amount
          break
        case "Withdrawn":
          balance -= event.amount
          break
        case "TransferredOut":
          balance -= event.amount
          break
        case "TransferredIn":
          balance += event.amount
          break
      }
    }

    return new Account({ id, balance }, events)
  }

  deposit(amount: number): Account {
    try {
      const result = Effect.runSync(
        Effect.gen(function* () {
          if (typeof amount !== "number" || amount <= 0 || !isFinite(amount)) {
            yield* Effect.fail(new InvalidAmount({ amount }))
          }

          const event: AccountEvent = {
            type: "Deposited",
            amount,
            timestamp: Date.now(),
          }

          return {
            state: { ...this.state, balance: this.state.balance + amount },
            events: [...this.events, event],
          }
        })
      )

      return new Account(result.state, result.events)
    } catch (e) {
      if (e instanceof Error && e.message.includes("InvalidAmount")) {
        throw new Error(`Invalid deposit amount: ${amount}`)
      }
      throw e
    }
  }

  withdraw(amount: number): Account {
    try {
      const result = Effect.runSync(
        Effect.gen(function* () {
          if (typeof amount !== "number" || amount <= 0 || !isFinite(amount)) {
            yield* Effect.fail(new InvalidAmount({ amount }))
          }

          if (this.state.balance < amount) {
            yield* Effect.fail(
              new InsufficientBalance({
                required: amount,
                available: this.state.balance,
              })
            )
          }

          const event: AccountEvent = {
            type: "Withdrawn",
            amount,
            timestamp: Date.now(),
          }

          return {
            state: { ...this.state, balance: this.state.balance - amount },
            events: [...this.events, event],
          }
        })
      )

      return new Account(result.state, result.events)
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes("InvalidAmount")) {
          throw new Error(`Invalid withdrawal amount: ${amount}`)
        }
        if (e.message.includes("InsufficientBalance")) {
          throw new Error(
            `Insufficient balance: required ${amount}, available ${this.state.balance}`
          )
        }
      }
      throw e
    }
  }

  transfer(toAccountId: string, amount: number): Account {
    try {
      const result = Effect.runSync(
        Effect.gen(function* () {
          if (!toAccountId || typeof toAccountId !== "string") {
            yield* Effect.fail(new InvalidAccountId({ id: toAccountId }))
          }

          if (toAccountId === this.state.id) {
            throw new Error("Cannot transfer to the same account")
          }

          if (typeof amount !== "number" || amount <= 0 || !isFinite(amount)) {
            yield* Effect.fail(new InvalidAmount({ amount }))
          }

          if (this.state.balance < amount) {
            yield* Effect.fail(
              new InsufficientBalance({
                required: amount,
                available: this.state.balance,
              })
            )
          }

          const event: AccountEvent = {
            type: "TransferredOut",
            to: toAccountId,
            amount,
            timestamp: Date.now(),
          }

          return {
            state: { ...this.state, balance: this.state.balance - amount },
            events: [...this.events, event],
          }
        })
      )

      return new Account(result.state, result.events)
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes("InvalidAccountId")) {
          throw new Error(`Invalid recipient account ID: ${toAccountId}`)
        }
        if (e.message.includes("InvalidAmount")) {
          throw new Error(`Invalid transfer amount: ${amount}`)
        }
        if (e.message.includes("InsufficientBalance")) {
          throw new Error(
            `Insufficient balance: required ${amount}, available ${this.state.balance}`
          )
        }
        if (e.message.includes("Cannot transfer to the same account")) {
          throw e
        }
      }
      throw e
    }
  }

  getState(): AccountState {
    return { ...this.state }
  }

  getEvents(): AccountEvent[] {
    return [...this.events]
  }

  getBalance(): number {
    return this.state.balance
  }

  getId(): string {
    return this.state.id
  }
}

// ============================================================================
// Public exports
// ============================================================================

export function createAccount(id: string): Account {
  return Account.create(id)
}

export function reconstructAccount(
  id: string,
  events: AccountEvent[]
): Account {
  return Account.fromEvents(id, events)
}

export type { AccountEvent }