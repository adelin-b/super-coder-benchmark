import { Data, Effect } from "effect"

// Domain Errors
class InsufficientFunds extends Data.TaggedError("InsufficientFunds")<{
  available: number
  requested: number
}> {}

class InvalidAmount extends Data.TaggedError("InvalidAmount")<{
  reason: string
}> {}

class AccountClosed extends Data.TaggedError("AccountClosed")<{}> {}

// Events
type AccountEvent =
  | { type: "AccountCreated"; accountId: string; initialBalance: number }
  | { type: "Deposited"; amount: number; timestamp: number }
  | { type: "Withdrawn"; amount: number; timestamp: number }
  | { type: "TransferSent"; amount: number; recipientId: string; timestamp: number }
  | { type: "TransferReceived"; amount: number; senderId: string; timestamp: number }
  | { type: "AccountClosed"; timestamp: number }

// State
interface AccountState {
  accountId: string
  balance: number
  closed: boolean
  events: AccountEvent[]
}

// Create empty state
const createEmptyState = (accountId: string): AccountState => ({
  accountId,
  balance: 0,
  closed: false,
  events: [],
})

// Apply single event to state
const applyEvent = (state: AccountState, event: AccountEvent): AccountState => {
  switch (event.type) {
    case "AccountCreated":
      return { ...state, balance: event.initialBalance }
    case "Deposited":
      return { ...state, balance: state.balance + event.amount }
    case "Withdrawn":
      return { ...state, balance: state.balance - event.amount }
    case "TransferSent":
      return { ...state, balance: state.balance - event.amount }
    case "TransferReceived":
      return { ...state, balance: state.balance + event.amount }
    case "AccountClosed":
      return { ...state, closed: true }
    default:
      const _exhaustive: never = event
      return _exhaustive
  }
}

// Rebuild state from events
const rebuildState = (accountId: string, events: AccountEvent[]): AccountState => {
  let state = createEmptyState(accountId)
  for (const event of events) {
    state = applyEvent(state, event)
  }
  return state
}

// Deposit command
const deposit = (
  state: AccountState,
  amount: number
): Effect.Effect<AccountEvent, InvalidAmount | AccountClosed> =>
  Effect.gen(function* () {
    if (state.closed) {
      yield* Effect.fail(new AccountClosed({}))
    }
    if (amount <= 0) {
      yield* Effect.fail(new InvalidAmount({ reason: "amount must be positive" }))
    }
    return {
      type: "Deposited" as const,
      amount,
      timestamp: Date.now(),
    }
  })

// Withdraw command
const withdraw = (
  state: AccountState,
  amount: number
): Effect.Effect<AccountEvent, InvalidAmount | AccountClosed | InsufficientFunds> =>
  Effect.gen(function* () {
    if (state.closed) {
      yield* Effect.fail(new AccountClosed({}))
    }
    if (amount <= 0) {
      yield* Effect.fail(new InvalidAmount({ reason: "amount must be positive" }))
    }
    if (state.balance < amount) {
      yield* Effect.fail(
        new InsufficientFunds({ available: state.balance, requested: amount })
      )
    }
    return {
      type: "Withdrawn" as const,
      amount,
      timestamp: Date.now(),
    }
  })

// Transfer command (produces two events: sent and received)
const transfer = (
  state: AccountState,
  amount: number,
  recipientId: string
): Effect.Effect<
  [AccountEvent, AccountEvent],
  InvalidAmount | AccountClosed | InsufficientFunds
> =>
  Effect.gen(function* () {
    if (state.closed) {
      yield* Effect.fail(new AccountClosed({}))
    }
    if (amount <= 0) {
      yield* Effect.fail(new InvalidAmount({ reason: "amount must be positive" }))
    }
    if (state.balance < amount) {
      yield* Effect.fail(
        new InsufficientFunds({ available: state.balance, requested: amount })
      )
    }
    const timestamp = Date.now()
    return [
      {
        type: "TransferSent" as const,
        amount,
        recipientId,
        timestamp,
      },
      {
        type: "TransferReceived" as const,
        amount,
        senderId: state.accountId,
        timestamp,
      },
    ]
  })

// Close account command
const closeAccount = (
  state: AccountState
): Effect.Effect<AccountEvent, AccountClosed> =>
  Effect.gen(function* () {
    if (state.closed) {
      yield* Effect.fail(new AccountClosed({}))
    }
    return {
      type: "AccountClosed" as const,
      timestamp: Date.now(),
    }
  })

export {
  AccountEvent,
  AccountState,
  InsufficientFunds,
  InvalidAmount,
  AccountClosed,
  createEmptyState,
  applyEvent,
  rebuildState,
  deposit,
  withdraw,
  transfer,
  closeAccount,
}