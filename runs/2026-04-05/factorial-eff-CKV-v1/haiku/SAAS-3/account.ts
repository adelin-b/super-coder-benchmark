import { Effect } from "effect"

class InsufficientFunds extends Error {
  constructor(required: number, available: number) {
    super(`Insufficient funds: required ${required}, available ${available}`)
    this.name = "InsufficientFunds"
  }
}

class InvalidAmount extends Error {
  constructor(message: string) {
    super(`Invalid amount: ${message}`)
    this.name = "InvalidAmount"
  }
}

type Event =
  | {
      type: "AccountCreated"
      id: string
      initialBalance: number
      timestamp: number
    }
  | { type: "Deposited"; amount: number; timestamp: number }
  | { type: "Withdrawn"; amount: number; timestamp: number }
  | {
      type: "TransferredOut"
      amount: number
      recipientId: string
      timestamp: number
    }
  | {
      type: "TransferredIn"
      amount: number
      senderId: string
      timestamp: number
    }

interface AccountState {
  id: string
  balance: number
  events: Event[]
}

interface BankAccount {
  getId(): string
  getBalance(): number
  getEvents(): Event[]
  deposit(amount: number): void
  withdraw(amount: number): void
  transferTo(amount: number, recipientId: string): void
}

function createAccount(id: string, initialBalance: number): BankAccount {
  if (!id || typeof id !== "string" || id.trim() === "") {
    throw new InvalidAmount("account id must not be empty")
  }
  if (typeof initialBalance !== "number" || isNaN(initialBalance)) {
    throw new InvalidAmount("initial balance must be a valid number")
  }
  if (initialBalance < 0) {
    throw new InvalidAmount("initial balance cannot be negative")
  }

  const state: AccountState = {
    id,
    balance: initialBalance,
    events: [
      {
        type: "AccountCreated",
        id,
        initialBalance,
        timestamp: Date.now(),
      },
    ],
  }

  const deposit = (amount: number): void => {
    const effect = Effect.gen(function* () {
      if (typeof amount !== "number" || isNaN(amount)) {
        throw new InvalidAmount(
          "deposit amount must be a valid number"
        )
      }
      if (amount <= 0) {
        throw new InvalidAmount("deposit amount must be positive")
      }
      state.balance += amount
      state.events.push({
        type: "Deposited",
        amount,
        timestamp: Date.now(),
      })
    })

    try {
      Effect.runSync(effect)
    } catch (e) {
      if (e instanceof InvalidAmount) throw e
      throw new Error(String(e))
    }
  }

  const withdraw = (amount: number): void => {
    const effect = Effect.gen(function* () {
      if (typeof amount !== "number" || isNaN(amount)) {
        throw new InvalidAmount(
          "withdrawal amount must be a valid number"
        )
      }
      if (amount <= 0) {
        throw new InvalidAmount("withdrawal amount must be positive")
      }
      if (amount > state.balance) {
        throw new InsufficientFunds(amount, state.balance)
      }
      state.balance -= amount
      state.events.push({
        type: "Withdrawn",
        amount,
        timestamp: Date.now(),
      })
    })

    try {
      Effect.runSync(effect)
    } catch (e) {
      if (e instanceof InsufficientFunds || e instanceof InvalidAmount) throw e
      throw new Error(String(e))
    }
  }

  const transferTo = (amount: number, recipientId: string): void => {
    const effect = Effect.gen(function* () {
      if (typeof amount !== "number" || isNaN(amount)) {
        throw new InvalidAmount("transfer amount must be a valid number")
      }
      if (amount <= 0) {
        throw new InvalidAmount("transfer amount must be positive")
      }
      if (
        !recipientId ||
        typeof recipientId !== "string" ||
        recipientId.trim() === ""
      ) {
        throw new InvalidAmount("recipient id must not be empty")
      }
      if (amount > state.balance) {
        throw new InsufficientFunds(amount, state.balance)
      }
      state.balance -= amount
      state.events.push({
        type: "TransferredOut",
        amount,
        recipientId,
        timestamp: Date.now(),
      })
    })

    try {
      Effect.runSync(effect)
    } catch (e) {
      if (e instanceof InsufficientFunds || e instanceof InvalidAmount) throw e
      throw new Error(String(e))
    }
  }

  return {
    getId(): string {
      return state.id
    },
    getBalance(): number {
      return state.balance
    },
    getEvents(): Event[] {
      return [...state.events]
    },
    deposit,
    withdraw,
    transferTo,
  }
}

function replayEvents(events: Event[]): AccountState {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error("Cannot replay empty event list")
  }

  const firstEvent = events[0]
  if (firstEvent.type !== "AccountCreated") {
    throw new Error("First event must be AccountCreated")
  }

  const state: AccountState = {
    id: firstEvent.id,
    balance: firstEvent.initialBalance,
    events: [firstEvent],
  }

  for (let i = 1; i < events.length; i++) {
    const event = events[i]
    switch (event.type) {
      case "Deposited":
        state.balance += event.amount
        break
      case "Withdrawn":
        state.balance -= event.amount
        break
      case "TransferredOut":
        state.balance -= event.amount
        break
      case "TransferredIn":
        state.balance += event.amount
        break
    }
    state.events.push(event)
  }

  return state
}

export type { Event, AccountState, BankAccount }
export { createAccount, replayEvents, InsufficientFunds, InvalidAmount }