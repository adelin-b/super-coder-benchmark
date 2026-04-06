import { Effect, Data } from "effect"

// Domain Errors
class InvalidAmount extends Data.TaggedError("InvalidAmount")<{ amount: number }> {}
class InvalidAccountId extends Data.TaggedError("InvalidAccountId")<{ id: string }> {}
class InsufficientFunds extends Data.TaggedError("InsufficientFunds")<{ required: number; available: number }> {}

// Events
export type Event =
  | { type: 'AccountCreated'; accountId: string; initialBalance: number; timestamp: number }
  | { type: 'MoneyDeposited'; accountId: string; amount: number; timestamp: number }
  | { type: 'MoneyWithdrawn'; accountId: string; amount: number; timestamp: number }
  | { type: 'MoneyTransferred'; fromAccountId: string; toAccountId: string; amount: number; timestamp: number }

// Public Account interface
export interface Account {
  id: string
  balance: number
  getHistory(): Event[]
  deposit(amount: number): void
  withdraw(amount: number): void
  transfer(toAccount: Account, amount: number): void
}

// Internal state
interface AccountState {
  id: string
  balance: number
  events: Event[]
}

// Apply event to state immutably
function applyEventToState(state: AccountState, event: Event): AccountState {
  switch (event.type) {
    case 'AccountCreated':
      return { ...state, balance: event.initialBalance }
    case 'MoneyDeposited':
      if (event.accountId === state.id) {
        return { ...state, balance: state.balance + event.amount }
      }
      return state
    case 'MoneyWithdrawn':
      if (event.accountId === state.id) {
        return { ...state, balance: state.balance - event.amount }
      }
      return state
    case 'MoneyTransferred':
      if (event.fromAccountId === state.id) {
        return { ...state, balance: state.balance - event.amount }
      }
      if (event.toAccountId === state.id) {
        return { ...state, balance: state.balance + event.amount }
      }
      return state
  }
}

// Validate inputs
function validateAccountId(id: string): Effect.Effect<string, InvalidAccountId> {
  return id && id.trim().length > 0
    ? Effect.succeed(id)
    : Effect.fail(new InvalidAccountId({ id }))
}

function validateAmount(amount: number): Effect.Effect<number, InvalidAmount> {
  return amount > 0
    ? Effect.succeed(amount)
    : Effect.fail(new InvalidAmount({ amount }))
}

// Create account implementation
function createAccountImpl(id: string, initialBalance: number = 0): Effect.Effect<Account, InvalidAmount | InvalidAccountId> {
  return Effect.gen(function* () {
    yield* validateAccountId(id)
    if (initialBalance < 0) {
      yield* Effect.fail(new InvalidAmount({ amount: initialBalance }))
    }

    const state: AccountState = {
      id,
      balance: initialBalance,
      events: initialBalance > 0 ? [{
        type: 'AccountCreated',
        accountId: id,
        initialBalance,
        timestamp: Date.now()
      }] : []
    }

    const account: Account = {
      id: state.id,
      get balance() {
        return state.balance
      },
      getHistory: () => [...state.events],
      deposit: (amount: number) => {
        if (amount <= 0) throw new Error('Deposit amount must be positive')
        const event: Event = {
          type: 'MoneyDeposited',
          accountId: id,
          amount,
          timestamp: Date.now()
        }
        state.events.push(event)
        state.balance += amount
      },
      withdraw: (amount: number) => {
        if (amount <= 0) throw new Error('Withdrawal amount must be positive')
        if (state.balance < amount) throw new Error(`Insufficient funds: required ${amount}, available ${state.balance}`)
        const event: Event = {
          type: 'MoneyWithdrawn',
          accountId: id,
          amount,
          timestamp: Date.now()
        }
        state.events.push(event)
        state.balance -= amount
      },
      transfer: (toAccount: Account, amount: number) => {
        if (amount <= 0) throw new Error('Transfer amount must be positive')
        if (state.balance < amount) throw new Error(`Insufficient funds: required ${amount}, available ${state.balance}`)
        const event: Event = {
          type: 'MoneyTransferred',
          fromAccountId: id,
          toAccountId: toAccount.id,
          amount,
          timestamp: Date.now()
        }
        state.events.push(event)
        state.balance -= amount
        toAccount.deposit(amount)
      }
    }

    return account
  })
}

// Reconstruct account implementation
function reconstructAccountImpl(id: string, events: Event[]): Effect.Effect<Account, InvalidAccountId> {
  return Effect.gen(function* () {
    yield* validateAccountId(id)

    let state: AccountState = { id, balance: 0, events: [] }

    for (const event of events) {
      state = applyEventToState(state, event)
      state.events.push(event)
    }

    const account: Account = {
      id: state.id,
      get balance() {
        return state.balance
      },
      getHistory: () => [...state.events],
      deposit: (amount: number) => {
        if (amount <= 0) throw new Error('Deposit amount must be positive')
        const event: Event = {
          type: 'MoneyDeposited',
          accountId: id,
          amount,
          timestamp: Date.now()
        }
        state.events.push(event)
        state.balance += amount
      },
      withdraw: (amount: number) => {
        if (amount <= 0) throw new Error('Withdrawal amount must be positive')
        if (state.balance < amount) throw new Error(`Insufficient funds: required ${amount}, available ${state.balance}`)
        const event: Event = {
          type: 'MoneyWithdrawn',
          accountId: id,
          amount,
          timestamp: Date.now()
        }
        state.events.push(event)
        state.balance -= amount
      },
      transfer: (toAccount: Account, amount: number) => {
        if (amount <= 0) throw new Error('Transfer amount must be positive')
        if (state.balance < amount) throw new Error(`Insufficient funds: required ${amount}, available ${state.balance}`)
        const event: Event = {
          type: 'MoneyTransferred',
          fromAccountId: id,
          toAccountId: toAccount.id,
          amount,
          timestamp: Date.now()
        }
        state.events.push(event)
        state.balance -= amount
        toAccount.deposit(amount)
      }
    }

    return account
  })
}

// Public factory function
export function createAccount(id: string, initialBalance: number = 0): Account {
  try {
    return Effect.runSync(createAccountImpl(id, initialBalance))
  } catch (e) {
    if (e instanceof Error) throw e
    throw new Error(String(e))
  }
}

// Public reconstruction function
export function reconstructAccount(id: string, events: Event[]): Account {
  try {
    return Effect.runSync(reconstructAccountImpl(id, events))
  } catch (e) {
    if (e instanceof Error) throw e
    throw new Error(String(e))
  }
}