import { Effect, Data } from "effect"

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
  accountId: string
}> {}

// ============================================================================
// Event Types
// ============================================================================

export interface AccountCreated {
  readonly type: "AccountCreated"
  readonly accountId: string
  readonly initialBalance: number
  readonly timestamp: number
}

export interface Deposited {
  readonly type: "Deposited"
  readonly amount: number
  readonly timestamp: number
}

export interface Withdrawn {
  readonly type: "Withdrawn"
  readonly amount: number
  readonly timestamp: number
}

export interface TransferredOut {
  readonly type: "TransferredOut"
  readonly amount: number
  readonly targetAccountId: string
  readonly timestamp: number
}

export interface TransferredIn {
  readonly type: "TransferredIn"
  readonly amount: number
  readonly sourceAccountId: string
  readonly timestamp: number
}

export type AccountEvent =
  | AccountCreated
  | Deposited
  | Withdrawn
  | TransferredOut
  | TransferredIn

// ============================================================================
// Account State
// ============================================================================

export interface AccountState {
  readonly accountId: string
  readonly balance: number
}

// ============================================================================
// Account Aggregate
// ============================================================================

export class Account {
  private balance: number
  private accountId: string
  private events: AccountEvent[]

  constructor(accountId: string, initialBalance: number = 0) {
    this.accountId = accountId
    this.balance = Math.max(0, initialBalance)
    this.events = [
      {
        type: "AccountCreated",
        accountId,
        initialBalance: this.balance,
        timestamp: Date.now(),
      },
    ]
  }

  getState(): AccountState {
    return {
      accountId: this.accountId,
      balance: this.balance,
    }
  }

  getEvents(): readonly AccountEvent[] {
    return Object.freeze([...this.events])
  }

  deposit(amount: number): Deposited {
    const program = Effect.gen(function* () {
      if (amount <= 0) {
        yield* Effect.fail(new InvalidAmount({ amount }))
      }
      return { amount }
    })

    try {
      const { amount: validAmount } = Effect.runSync(program)
      this.balance += validAmount
      const event: Deposited = {
        type: "Deposited",
        amount: validAmount,
        timestamp: Date.now(),
      }
      this.events.push(event)
      return event
    } catch (e) {
      throw new Error(
        `Invalid deposit: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  withdraw(amount: number): Withdrawn {
    const program = Effect.gen(function* () {
      if (amount <= 0) {
        yield* Effect.fail(new InvalidAmount({ amount }))
      }
      if (amount > this.balance) {
        yield* Effect.fail(
          new InsufficientBalance({ required: amount, available: this.balance })
        )
      }
      return { amount }
    })

    try {
      const { amount: validAmount } = Effect.runSync(program)
      this.balance -= validAmount
      const event: Withdrawn = {
        type: "Withdrawn",
        amount: validAmount,
        timestamp: Date.now(),
      }
      this.events.push(event)
      return event
    } catch (e) {
      throw new Error(
        `Invalid withdrawal: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  transfer(targetAccountId: string, amount: number): TransferredOut {
    const program = Effect.gen(function* () {
      if (!targetAccountId || targetAccountId.trim().length === 0) {
        yield* Effect.fail(new InvalidAccountId({ accountId: targetAccountId }))
      }
      if (amount <= 0) {
        yield* Effect.fail(new InvalidAmount({ amount }))
      }
      if (amount > this.balance) {
        yield* Effect.fail(
          new InsufficientBalance({ required: amount, available: this.balance })
        )
      }
      return { targetAccountId, amount }
    })

    try {
      const { targetAccountId: validTarget, amount: validAmount } = Effect.runSync(program)
      this.balance -= validAmount
      const event: TransferredOut = {
        type: "TransferredOut",
        amount: validAmount,
        targetAccountId: validTarget,
        timestamp: Date.now(),
      }
      this.events.push(event)
      return event
    } catch (e) {
      throw new Error(
        `Invalid transfer: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  applyEvent(event: AccountEvent): void {
    const program = Effect.gen(function* () {
      switch (event.type) {
        case "AccountCreated":
          this.accountId = event.accountId
          this.balance = event.initialBalance
          break
        case "Deposited":
          this.balance += event.amount
          break
        case "Withdrawn":
          if (event.amount > this.balance) {
            yield* Effect.fail(
              new InsufficientBalance({
                required: event.amount,
                available: this.balance,
              })
            )
          }
          this.balance -= event.amount
          break
        case "TransferredOut":
          if (event.amount > this.balance) {
            yield* Effect.fail(
              new InsufficientBalance({
                required: event.amount,
                available: this.balance,
              })
            )
          }
          this.balance -= event.amount
          break
        case "TransferredIn":
          this.balance += event.amount
          break
      }
    })

    try {
      Effect.runSync(program)
      if (!this.events.includes(event)) {
        this.events.push(event)
      }
    } catch (e) {
      throw new Error(
        `Failed to apply event: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }
}

// ============================================================================
// Reconstruction from Events
// ============================================================================

export function createAccountFromEvents(
  accountId: string,
  events: readonly AccountEvent[]
): Account {
  const program = Effect.gen(function* () {
    if (!accountId || accountId.trim().length === 0) {
      yield* Effect.fail(new InvalidAccountId({ accountId }))
    }
    if (!Array.isArray(events) || events.length === 0) {
      yield* Effect.fail(
        new InvalidAmount({ amount: -1 })
      )
    }
    return { accountId }
  })

  try {
    Effect.runSync(program)
  } catch (e) {
    throw new Error(
      `Invalid account creation parameters: ${e instanceof Error ? e.message : String(e)}`
    )
  }

  const account = new Account(accountId, 0)
  account.getEvents() // clear initial creation event
  const state = account.getState()
  
  for (const event of events) {
    account.applyEvent(event)
  }

  return account
}

export function reconstructAccountBalance(events: readonly AccountEvent[]): number {
  let balance = 0

  for (const event of events) {
    switch (event.type) {
      case "AccountCreated":
        balance = event.initialBalance
        break
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

  return Math.max(0, balance)
}