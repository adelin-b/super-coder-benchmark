import { Data, Effect } from "effect"

// ─── Events ────────────────────────────────────────────────────────────────

export type AccountEvent =
  | AccountOpenedEvent
  | DepositedEvent
  | WithdrawnEvent
  | TransferSentEvent
  | TransferReceivedEvent

export class AccountOpenedEvent extends Data.TaggedClass("AccountOpened")<{
  accountId: string
  initialBalance: number
  occurredAt: Date
}> {}

export class DepositedEvent extends Data.TaggedClass("Deposited")<{
  accountId: string
  amount: number
  occurredAt: Date
}> {}

export class WithdrawnEvent extends Data.TaggedClass("Withdrawn")<{
  accountId: string
  amount: number
  occurredAt: Date
}> {}

export class TransferSentEvent extends Data.TaggedClass("TransferSent")<{
  accountId: string
  toAccountId: string
  amount: number
  occurredAt: Date
}> {}

export class TransferReceivedEvent extends Data.TaggedClass("TransferReceived")<{
  accountId: string
  fromAccountId: string
  amount: number
  occurredAt: Date
}> {}

// ─── Errors ─────────────────────────────────────────────────────────────────

export class AccountNotFound extends Data.TaggedError("AccountNotFound")<{
  accountId: string
}> {}

export class InsufficientFunds extends Data.TaggedError("InsufficientFunds")<{
  accountId: string
  requested: number
  available: number
}> {}

export class InvalidAmount extends Data.TaggedError("InvalidAmount")<{
  amount: number
  reason: string
}> {}

export class AccountAlreadyExists extends Data.TaggedError("AccountAlreadyExists")<{
  accountId: string
}> {}

export class UninitializedAccount extends Data.TaggedError("UninitializedAccount")<{
  accountId: string
}> {}

// ─── State ──────────────────────────────────────────────────────────────────

export interface AccountState {
  readonly accountId: string
  readonly balance: number
  readonly isOpen: boolean
  readonly version: number
}

export interface AccountAggregate {
  readonly state: AccountState
  readonly uncommittedEvents: ReadonlyArray<AccountEvent>
}

// ─── Projection (apply single event → state) ────────────────────────────────

export const applyEvent = (
  state: AccountState | null,
  event: AccountEvent
): AccountState => {
  switch (event._tag) {
    case "AccountOpened":
      return {
        accountId: event.accountId,
        balance: event.initialBalance,
        isOpen: true,
        version: (state?.version ?? 0) + 1,
      }
    case "Deposited":
      if (!state) throw new Error("Cannot apply Deposited to uninitialised account")
      return { ...state, balance: state.balance + event.amount, version: state.version + 1 }
    case "Withdrawn":
      if (!state) throw new Error("Cannot apply Withdrawn to uninitialised account")
      return { ...state, balance: state.balance - event.amount, version: state.version + 1 }
    case "TransferSent":
      if (!state) throw new Error("Cannot apply TransferSent to uninitialised account")
      return { ...state, balance: state.balance - event.amount, version: state.version + 1 }
    case "TransferReceived":
      if (!state) throw new Error("Cannot apply TransferReceived to uninitialised account")
      return { ...state, balance: state.balance + event.amount, version: state.version + 1 }
  }
}

// ─── Reconstruct state from event history ───────────────────────────────────

export const reconstruct = (
  accountId: string,
  events: ReadonlyArray<AccountEvent>
): Effect.Effect<AccountState, AccountNotFound> =>
  Effect.gen(function* () {
    if (events.length === 0) {
      return yield* Effect.fail(new AccountNotFound({ accountId }))
    }
    return events.reduce<AccountState>(
      (state, event) => applyEvent(state, event),
      null as unknown as AccountState
    )
  })

// ─── Command handlers ────────────────────────────────────────────────────────

export const openAccount = (
  accountId: string,
  initialBalance: number
): Effect.Effect<AccountAggregate, InvalidAmount | AccountAlreadyExists> =>
  Effect.gen(function* () {
    if (initialBalance < 0) {
      return yield* Effect.fail(
        new InvalidAmount({ amount: initialBalance, reason: "Initial balance cannot be negative" })
      )
    }

    const event = new AccountOpenedEvent({
      accountId,
      initialBalance,
      occurredAt: new Date(),
    })

    const state = applyEvent(null, event)

    return {
      state,
      uncommittedEvents: [event],
    }
  })

export const deposit = (
  aggregate: AccountAggregate,
  amount: number
): Effect.Effect<AccountAggregate, InvalidAmount> =>
  Effect.gen(function* () {
    if (amount <= 0) {
      return yield* Effect.fail(
        new InvalidAmount({ amount, reason: "Deposit amount must be greater than zero" })
      )
    }

    const event = new DepositedEvent({
      accountId: aggregate.state.accountId,
      amount,
      occurredAt: new Date(),
    })

    const nextState = applyEvent(aggregate.state, event)

    return {
      state: nextState,
      uncommittedEvents: [...aggregate.uncommittedEvents, event],
    }
  })

export const withdraw = (
  aggregate: AccountAggregate,
  amount: number
): Effect.Effect<AccountAggregate, InvalidAmount | InsufficientFunds> =>
  Effect.gen(function* () {
    if (amount <= 0) {
      return yield* Effect.fail(
        new InvalidAmount({ amount, reason: "Withdrawal amount must be greater than zero" })
      )
    }

    if (aggregate.state.balance < amount) {
      return yield* Effect.fail(
        new InsufficientFunds({
          accountId: aggregate.state.accountId,
          requested: amount,
          available: aggregate.state.balance,
        })
      )
    }

    const event = new WithdrawnEvent({
      accountId: aggregate.state.accountId,
      amount,
      occurredAt: new Date(),
    })

    const nextState = applyEvent(aggregate.state, event)

    return {
      state: nextState,
      uncommittedEvents: [...aggregate.uncommittedEvents, event],
    }
  })

export interface TransferResult {
  readonly sender: AccountAggregate
  readonly receiver: AccountAggregate
}

export const transfer = (
  sender: AccountAggregate,
  receiver: AccountAggregate,
  amount: number
): Effect.Effect<TransferResult, InvalidAmount | InsufficientFunds> =>
  Effect.gen(function* () {
    if (amount <= 0) {
      return yield* Effect.fail(
        new InvalidAmount({ amount, reason: "Transfer amount must be greater than zero" })
      )
    }

    if (sender.state.balance < amount) {
      return yield* Effect.fail(
        new InsufficientFunds({
          accountId: sender.state.accountId,
          requested: amount,
          available: sender.state.balance,
        })
      )
    }

    const now = new Date()

    const sentEvent = new TransferSentEvent({
      accountId: sender.state.accountId,
      toAccountId: receiver.state.accountId,
      amount,
      occurredAt: now,
    })

    const receivedEvent = new TransferReceivedEvent({
      accountId: receiver.state.accountId,
      fromAccountId: sender.state.accountId,
      amount,
      occurredAt: now,
    })

    const nextSenderState = applyEvent(sender.state, sentEvent)
    const nextReceiverState = applyEvent(receiver.state, receivedEvent)

    return {
      sender: {
        state: nextSenderState,
        uncommittedEvents: [...sender.uncommittedEvents, sentEvent],
      },
      receiver: {
        state: nextReceiverState,
        uncommittedEvents: [...receiver.uncommittedEvents, receivedEvent],
      },
    }
  })

// ─── Helper: clear uncommitted events after persistence ─────────────────────

export const clearUncommittedEvents = (aggregate: AccountAggregate): AccountAggregate => ({
  state: aggregate.state,
  uncommittedEvents: [],
})