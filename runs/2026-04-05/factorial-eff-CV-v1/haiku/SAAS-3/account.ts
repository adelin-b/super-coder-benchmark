import { Effect, Data } from "effect"

// Events
export type DepositedEvent = {
  _tag: "Deposited"
  amount: number
  timestamp: number
}

export type WithdrawnEvent = {
  _tag: "Withdrawn"
  amount: number
  timestamp: number
}

export type TransferredEvent = {
  _tag: "Transferred"
  toAccountId: string
  amount: number
  timestamp: number
}

export type AccountEvent = DepositedEvent | WithdrawnEvent | TransferredEvent

// State
export interface AccountState {
  accountId: string
  balance: number
  version: number
}

// Domain errors
export class InsufficientFundsError extends Error {
  constructor(
    public available: number,
    public requested: number
  ) {
    super(
      `Insufficient funds: available ${available}, requested ${requested}`
    )
    this.name = "InsufficientFundsError"
  }
}

export class InvalidAmountError extends Error {
  constructor(
    public amount: number,
    reason: string
  ) {
    super(`Invalid amount ${amount}: ${reason}`)
    this.name = "InvalidAmountError"
  }
}

// Internal Effect errors
class ValidationFailure extends Data.TaggedError("ValidationFailure")<{
  reason: string
}> {}

class InsufficientFailure extends Data.TaggedError("InsufficientFailure")<{
  available: number
  requested: number
}> {}

// Deposit
function depositEffect(amount: number) {
  return Effect.gen(function* () {
    if (amount <= 0) {
      yield* Effect.fail(
        new ValidationFailure({ reason: "Amount must be positive" })
      )
    }
    return {
      _tag: "Deposited" as const,
      amount,
      timestamp: Date.now(),
    }
  })
}

export function deposit(amount: number): DepositedEvent {
  try {
    return Effect.runSync(depositEffect(amount))
  } catch (e) {
    throw new InvalidAmountError(amount, "Amount must be positive")
  }
}

// Withdraw
function withdrawEffect(state: AccountState, amount: number) {
  return Effect.gen(function* () {
    if (amount <= 0) {
      yield* Effect.fail(
        new ValidationFailure({ reason: "Amount must be positive" })
      )
    }
    if (state.balance < amount) {
      yield* Effect.fail(
        new InsufficientFailure({
          available: state.balance,
          requested: amount,
        })
      )
    }
    return {
      _tag: "Withdrawn" as const,
      amount,
      timestamp: Date.now(),
    }
  })
}

export function withdraw(
  state: AccountState,
  amount: number
): WithdrawnEvent {
  try {
    return Effect.runSync(withdrawEffect(state, amount))
  } catch (e) {
    if (state.balance < amount) {
      throw new InsufficientFundsError(state.balance, amount)
    }
    throw new InvalidAmountError(amount, "Amount must be positive")
  }
}

// Transfer
function transferEffect(
  state: AccountState,
  toAccountId: string,
  amount: number
) {
  return Effect.gen(function* () {
    if (!toAccountId || toAccountId.length === 0) {
      yield* Effect.fail(
        new ValidationFailure({ reason: "Account ID cannot be empty" })
      )
    }
    if (amount <= 0) {
      yield* Effect.fail(
        new ValidationFailure({ reason: "Amount must be positive" })
      )
    }
    if (state.balance < amount) {
      yield* Effect.fail(
        new InsufficientFailure({
          available: state.balance,
          requested: amount,
        })
      )
    }
    return {
      _tag: "Transferred" as const,
      toAccountId,
      amount,
      timestamp: Date.now(),
    }
  })
}

export function transfer(
  state: AccountState,
  toAccountId: string,
  amount: number
): TransferredEvent {
  try {
    return Effect.runSync(transferEffect(state, toAccountId, amount))
  } catch (e) {
    if (state.balance < amount) {
      throw new InsufficientFundsError(state.balance, amount)
    }
    throw new InvalidAmountError(amount, "Amount must be positive")
  }
}

// Apply event to state
export function applyEvent(
  state: AccountState,
  event: AccountEvent
): AccountState {
  switch (event._tag) {
    case "Deposited":
      return {
        ...state,
        balance: state.balance + event.amount,
        version: state.version + 1,
      }
    case "Withdrawn":
      return {
        ...state,
        balance: state.balance - event.amount,
        version: state.version + 1,
      }
    case "Transferred":
      return {
        ...state,
        balance: state.balance - event.amount,
        version: state.version + 1,
      }
    default:
      const _exhaustive: never = event
      return _exhaustive
  }
}

// Reconstruct state from events
export function reconstructFromEvents(
  accountId: string,
  events: AccountEvent[]
): AccountState {
  if (!accountId || accountId.length === 0) {
    throw new InvalidAmountError(0, "Account ID cannot be empty")
  }

  let state: AccountState = {
    accountId,
    balance: 0,
    version: 0,
  }

  for (const event of events) {
    state = applyEvent(state, event)
  }

  return state
}