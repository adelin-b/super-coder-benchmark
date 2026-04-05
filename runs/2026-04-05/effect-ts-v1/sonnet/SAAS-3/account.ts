/**
 * SAAS-3: Event Sourcing Aggregate
 * Event-sourced bank account: deposit, withdraw, transfer.
 * State is fully reconstructed by folding over the event log.
 *
 * Architecture:
 *  - Effect TS  : every operation returns Effect<A, E, R>. Zero try/catch.
 *  - XState v5  : account operation lifecycle modelled as a state machine.
 *  - Effect Schema: all domain data validated at the boundary.
 *  - Retry policy : every EventStore call retries up to 3 times on failure.
 */

import {
  Context,
  Data,
  Effect,
  Layer,
  Ref,
  Schedule,
  Schema,
} from "effect"
import { assign, setup } from "xstate"

// ─────────────────────────────────────────────────────────────────────────────
// § 1. Branded Primitives
// ─────────────────────────────────────────────────────────────────────────────

/** Opaque string that uniquely identifies a bank account. */
export const AccountId = Schema.String.pipe(Schema.brand("AccountId"))
export type AccountId = typeof AccountId.Type

/**
 * A strictly-positive monetary amount.
 * Zero and negative values are rejected at the schema boundary.
 */
export const Money = Schema.Number.pipe(
  Schema.filter((n) => n > 0),
  Schema.brand("Money")
)
export type Money = typeof Money.Type

// ─────────────────────────────────────────────────────────────────────────────
// § 2. Domain Events — the immutable source of truth
// ─────────────────────────────────────────────────────────────────────────────

export class DepositedEvent extends Schema.Class<DepositedEvent>("DepositedEvent")({
  type: Schema.Literal("Deposited"),
  eventId: Schema.String,
  accountId: AccountId,
  amount: Money,
  timestamp: Schema.DateFromSelf,
}) {}

export class WithdrawnEvent extends Schema.Class<WithdrawnEvent>("WithdrawnEvent")({
  type: Schema.Literal("Withdrawn"),
  eventId: Schema.String,
  accountId: AccountId,
  amount: Money,
  timestamp: Schema.DateFromSelf,
}) {}

export class TransferredEvent extends Schema.Class<TransferredEvent>("TransferredEvent")({
  type: Schema.Literal("Transferred"),
  eventId: Schema.String,
  fromAccountId: AccountId,
  toAccountId: AccountId,
  amount: Money,
  timestamp: Schema.DateFromSelf,
}) {}

/** Discriminated union of all account domain events. */
export const AccountEventSchema = Schema.Union(
  DepositedEvent,
  WithdrawnEvent,
  TransferredEvent
)
export type AccountEvent = typeof AccountEventSchema.Type

// ─────────────────────────────────────────────────────────────────────────────
// § 3. Aggregate State
// ─────────────────────────────────────────────────────────────────────────────

export class AccountState extends Schema.Class<AccountState>("AccountState")({
  id: AccountId,
  /** Running balance derived exclusively from the event log. */
  balance: Schema.Number,
  status: Schema.Literal("open", "closed"),
  /** Monotonically increasing count of events applied; used for optimistic concurrency. */
  version: Schema.Number,
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// § 4. Typed Errors
// ─────────────────────────────────────────────────────────────────────────────

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string
  readonly field?: string | undefined
}> {}

export class InsufficientFundsError extends Data.TaggedError("InsufficientFundsError")<{
  readonly accountId: AccountId
  readonly balance: number
  readonly requested: number
}> {}

export class AccountNotFoundError extends Data.TaggedError("AccountNotFoundError")<{
  readonly accountId: AccountId
}> {}

export class EventStoreError extends Data.TaggedError("EventStoreError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// § 5. EventStore Service (dependency)
// ─────────────────────────────────────────────────────────────────────────────

export interface EventStoreService {
  readonly append: (event: AccountEvent) => Effect.Effect<void, EventStoreError>
  readonly getAll: () => Effect.Effect<ReadonlyArray<AccountEvent>, EventStoreError>
}

export class EventStore extends Context.Tag("EventStore")<
  EventStore,
  EventStoreService
>() {}

/** Thread-safe, in-memory append-only event log. */
export const EventStoreLive: Layer.Layer<EventStore> = Layer.effect(
  EventStore,
  Effect.gen(function* () {
    const log = yield* Ref.make<ReadonlyArray<AccountEvent>>([])
    return {
      append: (event: AccountEvent) =>
        Ref.update(log, (events) => [...events, event]),
      getAll: () => Ref.get(log),
    }
  })
)

// ─────────────────────────────────────────────────────────────────────────────
// § 6. XState v5 Machine — Account Operation Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export type AccountMachineContext = {
  readonly accountId: AccountId
  /** Projected state rebuilt from committedEvents. */
  readonly currentState: AccountState
  /** Ordered list of every event applied to this account since machine start. */
  readonly committedEvents: ReadonlyArray<AccountEvent>
  /** Which command is currently in-flight, or null when idle. */
  readonly pendingOperation: "deposit" | "withdraw" | "transfer" | null
  /** Human-readable error message from the last failed operation, or null. */
  readonly error: string | null
}

export type AccountMachineEvent =
  | { readonly type: "DEPOSIT"; readonly amount: number }
  | { readonly type: "WITHDRAW"; readonly amount: number }
  | {
      readonly type: "TRANSFER"
      readonly amount: number
      readonly targetAccountId: AccountId
    }
  | {
      readonly type: "OPERATION_SUCCESS"
      readonly event: AccountEvent
      readonly nextState: AccountState
    }
  | { readonly type: "OPERATION_FAILURE"; readonly error: string }
  | { readonly type: "RETRY" }
  | { readonly type: "RESET" }

/**
 * State machine that governs the lifecycle of an account's operations.
 *
 * ┌──────────────────────────────────────────────────┐
 * │                                                  │
 * │   idle ──DEPOSIT/WITHDRAW/TRANSFER──▶ processing │
 * │    ▲                                     │       │
 * │    │         OPERATION_SUCCESS           │       │
 * │    └─────────────────────────────────────┘       │
 * │                                                  │
 * │   processing ──OPERATION_FAILURE──▶ failed       │
 * │                                        │         │
 * │   failed ──RETRY / RESET───────────▶ idle        │
 * └──────────────────────────────────────────────────┘
 *
 * The Effect computations run outside the machine. The caller drives the
 * machine by sending OPERATION_SUCCESS or OPERATION_FAILURE once the Effect
 * resolves.
 */
export const accountMachine = setup({
  types: {} as {
    context: AccountMachineContext
    events: AccountMachineEvent
    input: { accountId: AccountId; initialState: AccountState }
  },
}).createMachine({
  id: "account",
  initial: "idle",

  context: ({ input }) => ({
    accountId: input.accountId,
    currentState: input.initialState,
    committedEvents: [],
    pendingOperation: null,
    error: null,
  }),

  states: {
    /** Quiescent: ready to accept a banking command. */
    idle: {
      on: {
        DEPOSIT: {
          target: "processing",
          actions: assign({
            pendingOperation: () => "deposit" as const,
            error: () => null as null,
          }),
        },
        WITHDRAW: {
          target: "processing",
          actions: assign({
            pendingOperation: () => "withdraw" as const,
            error: () => null as null,
          }),
        },
        TRANSFER: {
          target: "processing",
          actions: assign({
            pendingOperation: () => "transfer" as const,
            error: () => null as null,
          }),
        },
      },
    },

    /**
     * Processing: an Effect computation is in-flight.
     * Transitions via OPERATION_SUCCESS (commit) or OPERATION_FAILURE (reject).
     */
    processing: {
      on: {
        OPERATION_SUCCESS: {
          target: "idle",
          actions: assign({
            currentState: ({ event }) => event.nextState,
            committedEvents: ({ context, event }) => [
              ...context.committedEvents,
              event.event,
            ],
            pendingOperation: () => null as null,
            error: () => null as null,
          }),
        },
        OPERATION_FAILURE: {
          target: "failed",
          actions: assign({
            pendingOperation: () => null as null,
            error: ({ event }) => event.error,
          }),
        },
      },
    },

    /**
     * Failed: the last operation was rejected.
     * RETRY / RESET both transition back to idle (error is cleared).
     */
    failed: {
      on: {
        RETRY: {
          target: "idle",
          actions: assign({ error: () => null as null }),
        },
        RESET: {
          target: "idle",
          actions: assign({ error: () => null as null }),
        },
      },
    },
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// § 7. Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retry policy for every EventStore call.
 * Up to 3 total attempts (1 original + 2 retries) with exponential back-off
 * starting at 50 ms.
 */
const storeRetryPolicy: Schedule.Schedule<number, unknown> =
  Schedule.intersect(
    Schedule.recurs(2),
    Schedule.exponential("50 millis")
  )

/** Collision-resistant event identifier (no external dependency). */
const generateEventId: Effect.Effect<string> = Effect.sync(
  () => `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
)

/**
 * Pure reducer: apply one domain event to an AccountState snapshot.
 * Never throws; returns a new AccountState instance.
 */
const applyEvent = (state: AccountState, event: AccountEvent): AccountState => {
  switch (event.type) {
    case "Deposited":
      return new AccountState({
        ...state,
        balance: state.balance + event.amount,
        version: state.version + 1,
      })

    case "Withdrawn":
      return new AccountState({
        ...state,
        balance: state.balance - event.amount,
        version: state.version + 1,
      })

    case "Transferred":
      if (event.fromAccountId === state.id) {
        return new AccountState({
          ...state,
          balance: state.balance - event.amount,
          version: state.version + 1,
        })
      }
      if (event.toAccountId === state.id) {
        return new AccountState({
          ...state,
          balance: state.balance + event.amount,
          version: state.version + 1,
        })
      }
      return state
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8. Aggregate Operations (public API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reconstruct the current AccountState by replaying every event associated
 * with `accountId` from the event log.
 *
 * @returns AccountNotFoundError  – no events exist for this account.
 * @returns EventStoreError       – the event log could not be read.
 */
export const reconstruct = (
  accountId: AccountId
): Effect.Effect<
  AccountState,
  AccountNotFoundError | EventStoreError,
  EventStore
> =>
  Effect.gen(function* () {
    const store = yield* EventStore
    const allEvents = yield* store
      .getAll()
      .pipe(Effect.retry(storeRetryPolicy))

    const accountEvents = allEvents.filter((e) => {
      switch (e.type) {
        case "Deposited":
        case "Withdrawn":
          return e.accountId === accountId
        case "Transferred":
          return (
            e.fromAccountId === accountId || e.toAccountId === accountId
          )
      }
    })

    if (accountEvents.length === 0) {
      return yield* Effect.fail(new AccountNotFoundError({ accountId }))
    }

    const empty = new AccountState({
      id: accountId,
      balance: 0,
      status: "open",
      version: 0,
    })

    return accountEvents.reduce(applyEvent, empty)
  })

/**
 * Deposit `rawAmount` into `accountId`.
 * The first deposit implicitly opens the account in the event log.
 * The amount is validated via the Money schema before the event is persisted.
 *
 * @returns DepositedEvent  – the persisted event on success.
 * @returns ValidationError – `rawAmount` is not a positive number.
 * @returns EventStoreError – the event could not be persisted.
 */
export const deposit = (
  accountId: AccountId,
  rawAmount: number
): Effect.Effect<
  DepositedEvent,
  ValidationError | EventStoreError,
  EventStore
> =>
  Effect.gen(function* () {
    const amount = yield* Schema.decodeUnknown(Money)(rawAmount).pipe(
      Effect.mapError(
        () =>
          new ValidationError({
            message: `Deposit amount must be a positive number, received: ${rawAmount}`,
            field: "amount",
          })
      )
    )

    const eventId = yield* generateEventId
    const event = new DepositedEvent({
      type: "Deposited",
      eventId,
      accountId,
      amount,
      timestamp: new Date(),
    })

    const store = yield* EventStore
    yield* store.append(event).pipe(Effect.retry(storeRetryPolicy))

    return event
  })

/**
 * Withdraw `rawAmount` from `accountId`.
 * Reconstructs the current balance to guard against overdrafts.
 *
 * @returns WithdrawnEvent         – the persisted event on success.
 * @returns ValidationError        – `rawAmount` is not a positive number.
 * @returns AccountNotFoundError   – the account has no events.
 * @returns InsufficientFundsError – current balance < requested amount.
 * @returns EventStoreError        – the event could not be persisted.
 */
export const withdraw = (
  accountId: AccountId,
  rawAmount: number
): Effect.Effect<
  WithdrawnEvent,
  | ValidationError
  | AccountNotFoundError
  | InsufficientFundsError
  | EventStoreError,
  EventStore
> =>
  Effect.gen(function* () {
    const amount = yield* Schema.decodeUnknown(Money)(rawAmount).pipe(
      Effect.mapError(
        () =>
          new ValidationError({
            message: `Withdrawal amount must be a positive number, received: ${rawAmount}`,
            field: "amount",
          })
      )
    )

    const state = yield* reconstruct(accountId)

    if (state.balance < amount) {
      return yield* Effect.fail(
        new InsufficientFundsError({
          accountId,
          balance: state.balance,
          requested: amount,
        })
      )
    }

    const eventId = yield* generateEventId
    const event = new WithdrawnEvent({
      type: "Withdrawn",
      eventId,
      accountId,
      amount,
      timestamp: new Date(),
    })

    const store = yield* EventStore
    yield* store.append(event).pipe(Effect.retry(storeRetryPolicy))

    return event
  })

/**
 * Transfer `rawAmount` from `fromAccountId` to `toAccountId`.
 * Both accounts must already exist in the event log.
 * The source account must have sufficient balance.
 *
 * A single TransferredEvent is appended; both balances are updated when their
 * states are next reconstructed.
 *
 * @returns TransferredEvent       – the persisted event on success.
 * @returns ValidationError        – same-account transfer or invalid amount.
 * @returns AccountNotFoundError   – either account has no events.
 * @returns InsufficientFundsError – source balance < requested amount.
 * @returns EventStoreError        – the event could not be persisted.
 */
export const transfer = (
  fromAccountId: AccountId,
  toAccountId: AccountId,
  rawAmount: number
): Effect.Effect<
  TransferredEvent,
  | ValidationError
  | AccountNotFoundError
  | InsufficientFundsError
  | EventStoreError,
  EventStore
> =>
  Effect.gen(function* () {
    if (fromAccountId === toAccountId) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Source and destination accounts must differ",
          field: "toAccountId",
        })
      )
    }

    const amount = yield* Schema.decodeUnknown(Money)(rawAmount).pipe(
      Effect.mapError(
        () =>
          new ValidationError({
            message: `Transfer amount must be a positive number, received: ${rawAmount}`,
            field: "amount",
          })
      )
    )

    // Reconstruct source first; propagates AccountNotFoundError if absent.
    const fromState = yield* reconstruct(fromAccountId)

    // Verify the destination exists (AccountNotFoundError if absent).
    yield* reconstruct(toAccountId)

    if (fromState.balance < amount) {
      return yield* Effect.fail(
        new InsufficientFundsError({
          accountId: fromAccountId,
          balance: fromState.balance,
          requested: amount,
        })
      )
    }

    const eventId = yield* generateEventId
    const event = new TransferredEvent({
      type: "Transferred",
      eventId,
      fromAccountId,
      toAccountId,
      amount,
      timestamp: new Date(),
    })

    const store = yield* EventStore
    yield* store.append(event).pipe(Effect.retry(storeRetryPolicy))

    return event
  })