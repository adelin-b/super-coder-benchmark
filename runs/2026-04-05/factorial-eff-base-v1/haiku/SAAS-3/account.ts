import { Effect, Data } from "effect"

// Event types - plain data structures
interface DepositedEvent {
  type: "Deposited"
  amount: number
  timestamp: Date
}

interface WithdrawnEvent {
  type: "Withdrawn"
  amount: number
  timestamp: Date
}

interface TransferredEvent {
  type: "Transferred"
  toAccountId: string
  amount: number
  timestamp: Date
}

export type Event = DepositedEvent | WithdrawnEvent | TransferredEvent

export interface Account {
  id: string
  balance: number
  appliedEvents: Event[]
}

class InsufficientBalance extends Data.TaggedError("InsufficientBalance")<{
  required: number
  available: number
}> {}

class InvalidAmount extends Data.TaggedError("InvalidAmount")<{
  amount: number
}> {}

export function createAccount(id: string): Account {
  return { id, balance: 0, appliedEvents: [] }
}

export function deposit(amount: number): DepositedEvent {
  return { type: "Deposited", amount, timestamp: new Date() }
}

export function withdraw(amount: number): WithdrawnEvent {
  return { type: "Withdrawn", amount, timestamp: new Date() }
}

export function transfer(toAccountId: string, amount: number): TransferredEvent {
  return { type: "Transferred", toAccountId, amount, timestamp: new Date() }
}

export function applyEvent(account: Account, event: Event): Account {
  try {
    const updated = Effect.runSync(
      Effect.gen(function* () {
        if (event.type === "Deposited") {
          if (event.amount <= 0) {
            yield* Effect.fail(new InvalidAmount({ amount: event.amount }))
          }
          return {
            ...account,
            balance: account.balance + event.amount,
            appliedEvents: [...account.appliedEvents, event],
          }
        } else if (event.type === "Withdrawn") {
          if (event.amount <= 0) {
            yield* Effect.fail(new InvalidAmount({ amount: event.amount }))
          }
          if (account.balance < event.amount) {
            yield* Effect.fail(
              new InsufficientBalance({
                required: event.amount,
                available: account.balance,
              })
            )
          }
          return {
            ...account,
            balance: account.balance - event.amount,
            appliedEvents: [...account.appliedEvents, event],
          }
        } else if (event.type === "Transferred") {
          if (event.amount <= 0) {
            yield* Effect.fail(new InvalidAmount({ amount: event.amount }))
          }
          if (account.balance < event.amount) {
            yield* Effect.fail(
              new InsufficientBalance({
                required: event.amount,
                available: account.balance,
              })
            )
          }
          return {
            ...account,
            balance: account.balance - event.amount,
            appliedEvents: [...account.appliedEvents, event],
          }
        }
        return account
      })
    )
    return updated
  } catch (e) {
    if (e instanceof InsufficientBalance) {
      throw new Error(
        `Insufficient balance: required ${e.required}, available ${e.available}`
      )
    }
    if (e instanceof InvalidAmount) {
      throw new Error(`Invalid amount: ${e.amount}`)
    }
    throw e
  }
}

export function fromEvents(id: string, events: Event[]): Account {
  const account = createAccount(id)
  return events.reduce((acc, event) => applyEvent(acc, event), account)
}