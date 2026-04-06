import { Effect, Data } from "effect"

// ============================================================================
// Domain Types
// ============================================================================

export interface Account {
  readonly id: string
  readonly balance: number
  readonly createdAt: Date
}

export type Event =
  | {
      readonly type: "AccountCreated"
      readonly accountId: string
      readonly timestamp: Date
    }
  | {
      readonly type: "Deposited"
      readonly accountId: string
      readonly amount: number
      readonly timestamp: Date
    }
  | {
      readonly type: "Withdrawn"
      readonly accountId: string
      readonly amount: number
      readonly timestamp: Date
    }
  | {
      readonly type: "TransferSent"
      readonly accountId: string
      readonly amount: number
      readonly toAccountId: string
      readonly timestamp: Date
    }
  | {
      readonly type: "TransferReceived"
      readonly accountId: string
      readonly amount: number
      readonly fromAccountId: string
      readonly timestamp: Date
    }

// ============================================================================
// Error Types
// ============================================================================

class InvalidAmountError extends Data.TaggedError("InvalidAmountError")<{
  reason: string
}> {}

class InsufficientFundsError extends Data.TaggedError("InsufficientFundsError")<{
  available: number
  requested: number
}> {}

class AccountNotFoundError extends Data.TaggedError("AccountNotFoundError")<{
  id: string
}> {}

// ============================================================================
// Core Functions
// ============================================================================

export function createAccount(id: string): { account: Account; event: Event } {
  const program = Effect.gen(function* () {
    if (!id || id.trim() === "") {
      yield* Effect.fail(new InvalidAmountError({ reason: "Account ID cannot be empty" }))
    }

    const now = new Date()
    const account: Account = {
      id,
      balance: 0,
      createdAt: now,
    }

    const event: Event = {
      type: "AccountCreated",
      accountId: id,
      timestamp: now,
    }

    return { account, event }
  })

  try {
    return Effect.runSync(program)
  } catch (e) {
    if (e instanceof Error) throw e
    throw new Error(String(e))
  }
}

export function applyEvent(account: Account, event: Event): Account {
  const program = Effect.gen(function* () {
    if (event.accountId !== account.id && event.type !== "AccountCreated") {
      yield* Effect.fail(
        new AccountNotFoundError({ id: event.accountId })
      )
    }

    switch (event.type) {
      case "AccountCreated":
        return account

      case "Deposited":
        if (event.amount <= 0) {
          yield* Effect.fail(
            new InvalidAmountError({ reason: "Deposit amount must be positive" })
          )
        }
        return {
          ...account,
          balance: account.balance + event.amount,
        }

      case "Withdrawn":
        if (event.amount <= 0) {
          yield* Effect.fail(
            new InvalidAmountError({ reason: "Withdrawal amount must be positive" })
          )
        }
        if (account.balance < event.amount) {
          yield* Effect.fail(
            new InsufficientFundsError({
              available: account.balance,
              requested: event.amount,
            })
          )
        }
        return {
          ...account,
          balance: account.balance - event.amount,
        }

      case "TransferSent":
        if (event.amount <= 0) {
          yield* Effect.fail(
            new InvalidAmountError({ reason: "Transfer amount must be positive" })
          )
        }
        if (account.balance < event.amount) {
          yield* Effect.fail(
            new InsufficientFundsError({
              available: account.balance,
              requested: event.amount,
            })
          )
        }
        return {
          ...account,
          balance: account.balance - event.amount,
        }

      case "TransferReceived":
        if (event.amount <= 0) {
          yield* Effect.fail(
            new InvalidAmountError({ reason: "Transfer amount must be positive" })
          )
        }
        return {
          ...account,
          balance: account.balance + event.amount,
        }

      default:
        const _exhaustive: never = event
        return _exhaustive
    }
  })

  try {
    return Effect.runSync(program)
  } catch (e) {
    if (e instanceof Error) throw e
    throw new Error(String(e))
  }
}

export function reconstructFromEvents(events: Event[]): Account {
  const program = Effect.gen(function* () {
    if (events.length === 0) {
      yield* Effect.fail(new InvalidAmountError({ reason: "No events provided" }))
    }

    const firstEvent = events[0]
    if (firstEvent.type !== "AccountCreated") {
      yield* Effect.fail(
        new InvalidAmountError({
          reason: "First event must be AccountCreated",
        })
      )
    }

    let account: Account = {
      id: firstEvent.accountId,
      balance: 0,
      createdAt: firstEvent.timestamp,
    }

    for (const event of events.slice(1)) {
      account = yield* Effect.gen(function* () {
        const result = applyEvent(account, event)
        return result
      })
    }

    return account
  })

  try {
    return Effect.runSync(program)
  } catch (e) {
    if (e instanceof Error) throw e
    throw new Error(String(e))
  }
}

export function deposit(
  account: Account,
  amount: number
): { account: Account; event: Event } {
  const program = Effect.gen(function* () {
    if (amount <= 0) {
      yield* Effect.fail(
        new InvalidAmountError({ reason: "Deposit amount must be positive" })
      )
    }

    const now = new Date()
    const event: Event = {
      type: "Deposited",
      accountId: account.id,
      amount,
      timestamp: now,
    }

    const updatedAccount = yield* Effect.sync(() =>
      applyEvent(account, event)
    )

    return { account: updatedAccount, event }
  })

  try {
    return Effect.runSync(program)
  } catch (e) {
    if (e instanceof Error) throw e
    throw new Error(String(e))
  }
}

export function withdraw(
  account: Account,
  amount: number
): { account: Account; event: Event } {
  const program = Effect.gen(function* () {
    if (amount <= 0) {
      yield* Effect.fail(
        new InvalidAmountError({ reason: "Withdrawal amount must be positive" })
      )
    }

    if (account.balance < amount) {
      yield* Effect.fail(
        new InsufficientFundsError({
          available: account.balance,
          requested: amount,
        })
      )
    }

    const now = new Date()
    const event: Event = {
      type: "Withdrawn",
      accountId: account.id,
      amount,
      timestamp: now,
    }

    const updatedAccount = yield* Effect.sync(() =>
      applyEvent(account, event)
    )

    return { account: updatedAccount, event }
  })

  try {
    return Effect.runSync(program)
  } catch (e) {
    if (e instanceof Error) throw e
    throw new Error(String(e))
  }
}

export function transfer(
  fromAccount: Account,
  toAccount: Account,
  amount: number
): {
  events: Event[]
  accounts: [Account, Account]
} {
  const program = Effect.gen(function* () {
    if (amount <= 0) {
      yield* Effect.fail(
        new InvalidAmountError({ reason: "Transfer amount must be positive" })
      )
    }

    if (fromAccount.balance < amount) {
      yield* Effect.fail(
        new InsufficientFundsError({
          available: fromAccount.balance,
          requested: amount,
        })
      )
    }

    const now = new Date()

    const sentEvent: Event = {
      type: "TransferSent",
      accountId: fromAccount.id,
      amount,
      toAccountId: toAccount.id,
      timestamp: now,
    }

    const receivedEvent: Event = {
      type: "TransferReceived",
      accountId: toAccount.id,
      amount,
      fromAccountId: fromAccount.id,
      timestamp: now,
    }

    const updatedFromAccount = yield* Effect.sync(() =>
      applyEvent(fromAccount, sentEvent)
    )
    const updatedToAccount = yield* Effect.sync(() =>
      applyEvent(toAccount, receivedEvent)
    )

    return {
      events: [sentEvent, receivedEvent],
      accounts: [updatedFromAccount, updatedToAccount],
    }
  })

  try {
    return Effect.runSync(program)
  } catch (e) {
    if (e instanceof Error) throw e
    throw new Error(String(e))
  }
}