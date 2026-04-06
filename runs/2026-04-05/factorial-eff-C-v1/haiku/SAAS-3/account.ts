import { Data, Effect } from "effect"

// ============================================================================
// Error Types
// ============================================================================

class InsufficientFundsError extends Error {
  constructor(balance: number, required: number) {
    super(`Insufficient funds: balance ${balance}, required ${required}`)
    this.name = "InsufficientFundsError"
  }
}

class InvalidAmountError extends Error {
  constructor(amount: number) {
    super(`Invalid amount: ${amount}`)
    this.name = "InvalidAmountError"
  }
}

class NoEventsError extends Error {
  constructor(accountId: string) {
    super(`No events found for account ${accountId}`)
    this.name = "NoEventsError"
  }
}

// ============================================================================
// Domain Events
// ============================================================================

export interface AccountCreated {
  readonly _tag: "AccountCreated"
  readonly accountId: string
  readonly timestamp: Date
  readonly initialBalance: number
}

export interface Deposited {
  readonly _tag: "Deposited"
  readonly accountId: string
  readonly timestamp: Date
  readonly amount: number
}

export interface Withdrawn {
  readonly _tag: "Withdrawn"
  readonly accountId: string
  readonly timestamp: Date
  readonly amount: number
}

export interface TransferInitiated {
  readonly _tag: "TransferInitiated"
  readonly fromAccountId: string
  readonly toAccountId: string
  readonly timestamp: Date
  readonly amount: number
}

export type DomainEvent =
  | AccountCreated
  | Deposited
  | Withdrawn
  | TransferInitiated

// ============================================================================
// Account State
// ============================================================================

export interface Account {
  readonly id: string
  readonly balance: number
  readonly createdAt: Date
  readonly events: readonly DomainEvent[]
}

// ============================================================================
// Internal Effect-based Operations
// ============================================================================

const validateAmount = (amount: number): Effect.Effect<number, InvalidAmountError> =>
  amount <= 0
    ? Effect.fail(new InvalidAmountError(amount))
    : Effect.succeed(amount)

const checkSufficientFunds = (
  balance: number,
  required: number
): Effect.Effect<void, InsufficientFundsError> =>
  balance < required
    ? Effect.fail(new InsufficientFundsError(balance, required))
    : Effect.succeed(void 0)

const applyEvent = (
  account: Account,
  event: DomainEvent
): Account => {
  switch (event._tag) {
    case "AccountCreated":
      return {
        ...account,
        balance: event.initialBalance,
        createdAt: event.timestamp,
      }
    case "Deposited":
      return {
        ...account,
        balance: account.balance + event.amount,
      }
    case "Withdrawn":
      return {
        ...account,
        balance: account.balance - event.amount,
      }
    case "TransferInitiated":
      return {
        ...account,
        balance:
          account.id === event.fromAccountId
            ? account.balance - event.amount
            : account.id === event.toAccountId
              ? account.balance + event.amount
              : account.balance,
      }
  }
}

const reconstructFromEventsEffect = (
  events: readonly DomainEvent[]
): Effect.Effect<Account, NoEventsError> => {
  if (events.length === 0) {
    return Effect.fail(new NoEventsError("unknown"))
  }

  const firstEvent = events[0]
  if (firstEvent._tag !== "AccountCreated") {
    return Effect.fail(new NoEventsError(firstEvent.accountId))
  }

  const initialAccount: Account = {
    id: firstEvent.accountId,
    balance: firstEvent.initialBalance,
    createdAt: firstEvent.timestamp,
    events: [firstEvent],
  }

  return Effect.succeed(
    events.slice(1).reduce((acc, event) => {
      const updated = applyEvent(acc, event)
      return {
        ...updated,
        events: [...acc.events, event],
      }
    }, initialAccount)
  )
}

// ============================================================================
// Public API (Plain TypeScript)
// ============================================================================

export function createAccountEvent(
  accountId: string,
  initialBalance: number = 0
): AccountCreated {
  return {
    _tag: "AccountCreated",
    accountId,
    timestamp: new Date(),
    initialBalance,
  }
}

export function deposit(
  account: Account,
  amount: number
): { account: Account; event: Deposited } {
  try {
    Effect.runSync(validateAmount(amount))
  } catch (e) {
    throw e instanceof InvalidAmountError
      ? e
      : new InvalidAmountError(amount)
  }

  const event: Deposited = {
    _tag: "Deposited",
    accountId: account.id,
    timestamp: new Date(),
    amount,
  }

  const updated = applyEvent(account, event)

  return {
    account: {
      ...updated,
      events: [...account.events, event],
    },
    event,
  }
}

export function withdraw(
  account: Account,
  amount: number
): { account: Account; event: Withdrawn } {
  try {
    Effect.runSync(validateAmount(amount))
  } catch (e) {
    throw e instanceof InvalidAmountError
      ? e
      : new InvalidAmountError(amount)
  }

  try {
    Effect.runSync(checkSufficientFunds(account.balance, amount))
  } catch (e) {
    throw e instanceof InsufficientFundsError
      ? e
      : new InsufficientFundsError(account.balance, amount)
  }

  const event: Withdrawn = {
    _tag: "Withdrawn",
    accountId: account.id,
    timestamp: new Date(),
    amount,
  }

  const updated = applyEvent(account, event)

  return {
    account: {
      ...updated,
      events: [...account.events, event],
    },
    event,
  }
}

export function transfer(
  fromAccount: Account,
  toAccountId: string,
  amount: number
): { fromAccount: Account; event: TransferInitiated } {
  try {
    Effect.runSync(validateAmount(amount))
  } catch (e) {
    throw e instanceof InvalidAmountError
      ? e
      : new InvalidAmountError(amount)
  }

  try {
    Effect.runSync(checkSufficientFunds(fromAccount.balance, amount))
  } catch (e) {
    throw e instanceof InsufficientFundsError
      ? e
      : new InsufficientFundsError(fromAccount.balance, amount)
  }

  const event: TransferInitiated = {
    _tag: "TransferInitiated",
    fromAccountId: fromAccount.id,
    toAccountId,
    timestamp: new Date(),
    amount,
  }

  const updated = applyEvent(fromAccount, event)

  return {
    fromAccount: {
      ...updated,
      events: [...fromAccount.events, event],
    },
    event,
  }
}

export function reconstructAccountFromEvents(
  events: readonly DomainEvent[]
): Account {
  try {
    return Effect.runSync(reconstructFromEventsEffect(events))
  } catch (e) {
    throw e instanceof NoEventsError
      ? e
      : new NoEventsError("unknown")
  }
}

export function initializeAccount(
  accountId: string,
  initialBalance: number = 0
): Account {
  const createEvent = createAccountEvent(accountId, initialBalance)
  return {
    id: accountId,
    balance: initialBalance,
    createdAt: createEvent.timestamp,
    events: [createEvent],
  }
}