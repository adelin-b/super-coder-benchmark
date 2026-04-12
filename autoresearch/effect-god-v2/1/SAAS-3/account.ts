import { Effect, Data, Exit, Cause } from "effect"

// ─── Internal tagged errors ────────────────────────────────────────────────

class InternalInsufficientFunds extends Data.TaggedError("InternalInsufficientFunds")<{
  balance: number
  amount: number
}> {}

class InternalInvalidAmount extends Data.TaggedError("InternalInvalidAmount")<{
  amount: number
}> {}

// ─── Public error classes ──────────────────────────────────────────────────

export class InsufficientFundsError extends Error {
  readonly balance: number
  readonly amount: number
  constructor(balance: number, amount: number) {
    super(`Insufficient funds: balance=${balance}, attempted=${amount}`)
    this.name = "InsufficientFundsError"
    this.balance = balance
    this.amount = amount
    Object.setPrototypeOf(this, InsufficientFundsError.prototype)
  }
}

export class InvalidAmountError extends Error {
  readonly amount: number
  constructor(amount: number) {
    super(`Invalid amount: ${amount}`)
    this.name = "InvalidAmountError"
    this.amount = amount
    Object.setPrototypeOf(this, InvalidAmountError.prototype)
  }
}

// ─── Event types ───────────────────────────────────────────────────────────

export interface DepositedEvent {
  type: "deposited"
  accountId: string
  amount: number
}

export interface WithdrawnEvent {
  type: "withdrawn"
  accountId: string
  amount: number
}

export interface TransferredOutEvent {
  type: "transferred_out"
  accountId: string
  amount: number
  toAccountId: string
}

export interface TransferredInEvent {
  type: "transferred_in"
  accountId: string
  amount: number
  fromAccountId: string
}

export type AccountEvent =
  | DepositedEvent
  | WithdrawnEvent
  | TransferredOutEvent
  | TransferredInEvent

// ─── Internal state ────────────────────────────────────────────────────────

interface AccountData {
  id: string
  balance: number
  events: AccountEvent[]
}

// ─── Public Account interface ──────────────────────────────────────────────

export interface Account {
  getId(): string
  getBalance(): number
  getEvents(): AccountEvent[]
  deposit(amount: number): Account
  withdraw(amount: number): Account
  transfer(to: Account, amount: number): [Account, Account]
}

// ─── Internal Effect-based operations ─────────────────────────────────────

const effectDeposit = (
  data: AccountData,
  amount: number
): Effect.Effect<AccountData, InternalInvalidAmount> =>
  Effect.gen(function* () {
    if (amount <= 0) yield* Effect.fail(new InternalInvalidAmount({ amount }))
    const event: DepositedEvent = { type: "deposited", accountId: data.id, amount }
    return {
      id: data.id,
      balance: data.balance + amount,
      events: [...data.events, event],
    }
  })

const effectWithdraw = (
  data: AccountData,
  amount: number
): Effect.Effect<AccountData, InternalInvalidAmount | InternalInsufficientFunds> =>
  Effect.gen(function* () {
    if (amount <= 0) yield* Effect.fail(new InternalInvalidAmount({ amount }))
    if (data.balance < amount)
      yield* Effect.fail(new InternalInsufficientFunds({ balance: data.balance, amount }))
    const event: WithdrawnEvent = { type: "withdrawn", accountId: data.id, amount }
    return {
      id: data.id,
      balance: data.balance - amount,
      events: [...data.events, event],
    }
  })

const effectTransfer = (
  fromData: AccountData,
  toData: AccountData,
  amount: number
): Effect.Effect<
  [AccountData, AccountData],
  InternalInvalidAmount | InternalInsufficientFunds
> =>
  Effect.gen(function* () {
    if (amount <= 0) yield* Effect.fail(new InternalInvalidAmount({ amount }))
    if (fromData.balance < amount)
      yield* Effect.fail(
        new InternalInsufficientFunds({ balance: fromData.balance, amount })
      )
    const outEvent: TransferredOutEvent = {
      type: "transferred_out",
      accountId: fromData.id,
      amount,
      toAccountId: toData.id,
    }
    const inEvent: TransferredInEvent = {
      type: "transferred_in",
      accountId: toData.id,
      amount,
      fromAccountId: fromData.id,
    }
    const newFrom: AccountData = {
      id: fromData.id,
      balance: fromData.balance - amount,
      events: [...fromData.events, outEvent],
    }
    const newTo: AccountData = {
      id: toData.id,
      balance: toData.balance + amount,
      events: [...toData.events, inEvent],
    }
    return [newFrom, newTo] as [AccountData, AccountData]
  })

// ─── Error unwrapping utility ──────────────────────────────────────────────

function unwrapError(cause: Cause.Cause<unknown>): never {
  const raw = Cause.squash(cause) as any
  if (raw._tag === "InternalInsufficientFunds") {
    throw new InsufficientFundsError(raw.balance, raw.amount)
  }
  if (raw._tag === "InternalInvalidAmount") {
    throw new InvalidAmountError(raw.amount)
  }
  throw new Error(raw?.message ?? String(raw))
}

// ─── Account factory ───────────────────────────────────────────────────────

function makeAccount(data: AccountData): Account {
  const account: Account & { _internal: AccountData } = {
    _internal: data,

    getId(): string {
      return data.id
    },

    getBalance(): number {
      return data.balance
    },

    getEvents(): AccountEvent[] {
      return [...data.events]
    },

    deposit(amount: number): Account {
      const exit = Effect.runSyncExit(effectDeposit(data, amount))
      if (Exit.isFailure(exit)) unwrapError(exit.cause)
      return makeAccount((exit as Exit.Success<AccountData, never>).value)
    },

    withdraw(amount: number): Account {
      const exit = Effect.runSyncExit(effectWithdraw(data, amount))
      if (Exit.isFailure(exit)) unwrapError(exit.cause)
      return makeAccount((exit as Exit.Success<AccountData, never>).value)
    },

    transfer(to: Account, amount: number): [Account, Account] {
      const toData = (to as Account & { _internal: AccountData })._internal
      const exit = Effect.runSyncExit(effectTransfer(data, toData, amount))
      if (Exit.isFailure(exit)) unwrapError(exit.cause)
      const [newFromData, newToData] = (
        exit as Exit.Success<[AccountData, AccountData], never>
      ).value
      return [makeAccount(newFromData), makeAccount(newToData)]
    },
  }

  return account
}

// ─── Public API ────────────────────────────────────────────────────────────

export function createAccount(id: string): Account {
  if (!id || typeof id !== "string") throw new Error("Account id must be a non-empty string")
  return makeAccount({ id, balance: 0, events: [] })
}

export function reconstructFromEvents(events: AccountEvent[]): Account {
  if (!Array.isArray(events)) throw new Error("Events must be an array")

  // Derive the account id from the first event, or use empty string for no events
  const accountId =
    events.length === 0
      ? ""
      : events[0].type === "transferred_in"
      ? events[0].accountId
      : events[0].accountId

  let balance = 0

  for (const event of events) {
    switch (event.type) {
      case "deposited":
        balance += event.amount
        break
      case "withdrawn":
        balance -= event.amount
        break
      case "transferred_out":
        balance -= event.amount
        break
      case "transferred_in":
        balance += event.amount
        break
    }
  }

  return makeAccount({ id: accountId, balance, events: [...events] })
}