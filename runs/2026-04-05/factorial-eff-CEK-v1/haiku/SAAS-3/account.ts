// Events
export type Event = 
  | AccountCreated
  | Deposited
  | Withdrawn
  | Transferred

export interface AccountCreated {
  readonly _tag: "AccountCreated"
  readonly accountId: string
  readonly initialBalance: number
  readonly timestamp: Date
}

export interface Deposited {
  readonly _tag: "Deposited"
  readonly accountId: string
  readonly amount: number
  readonly timestamp: Date
}

export interface Withdrawn {
  readonly _tag: "Withdrawn"
  readonly accountId: string
  readonly amount: number
  readonly timestamp: Date
}

export interface Transferred {
  readonly _tag: "Transferred"
  readonly fromAccountId: string
  readonly toAccountId: string
  readonly amount: number
  readonly timestamp: Date
}

// Account aggregate
export interface Account {
  readonly accountId: string
  readonly balance: number
  readonly events: readonly Event[]
}

// Create account
export function createAccount(accountId: string, initialBalance: number): Account {
  if (initialBalance < 0) {
    throw new Error("Initial balance cannot be negative")
  }
  if (!accountId || accountId.trim().length === 0) {
    throw new Error("Account ID cannot be empty")
  }
  
  const event: AccountCreated = {
    _tag: "AccountCreated",
    accountId,
    initialBalance,
    timestamp: new Date(),
  }
  return {
    accountId,
    balance: initialBalance,
    events: [event],
  }
}

// Deposit
export function deposit(account: Account, amount: number): Account {
  if (amount <= 0) {
    throw new Error("Deposit amount must be positive")
  }
  
  const event: Deposited = {
    _tag: "Deposited",
    accountId: account.accountId,
    amount,
    timestamp: new Date(),
  }
  return {
    ...account,
    balance: account.balance + amount,
    events: [...account.events, event],
  }
}

// Withdraw
export function withdraw(account: Account, amount: number): Account {
  if (amount <= 0) {
    throw new Error("Withdrawal amount must be positive")
  }
  if (account.balance < amount) {
    throw new Error("Insufficient funds")
  }
  
  const event: Withdrawn = {
    _tag: "Withdrawn",
    accountId: account.accountId,
    amount,
    timestamp: new Date(),
  }
  return {
    ...account,
    balance: account.balance - amount,
    events: [...account.events, event],
  }
}

// Transfer
export function transfer(
  source: Account,
  destination: Account,
  amount: number
): [Account, Account] {
  if (amount <= 0) {
    throw new Error("Transfer amount must be positive")
  }
  if (source.accountId === destination.accountId) {
    throw new Error("Cannot transfer to the same account")
  }
  if (source.balance < amount) {
    throw new Error("Insufficient funds for transfer")
  }
  
  const transferEvent: Transferred = {
    _tag: "Transferred",
    fromAccountId: source.accountId,
    toAccountId: destination.accountId,
    amount,
    timestamp: new Date(),
  }
  
  const newSource: Account = {
    ...source,
    balance: source.balance - amount,
    events: [...source.events, transferEvent],
  }
  
  const newDest: Account = {
    ...destination,
    balance: destination.balance + amount,
    events: [...destination.events, transferEvent],
  }
  
  return [newSource, newDest]
}

// Reconstruct account from events
export function reconstructAccount(accountId: string, events: readonly Event[]): Account {
  if (!accountId || accountId.trim().length === 0) {
    throw new Error("Account ID cannot be empty")
  }
  
  let balance = 0
  const validatedEvents: Event[] = []
  let isInitialized = false
  
  for (const event of events) {
    // Verify event belongs to this account
    if (event._tag === "AccountCreated") {
      if (event.accountId !== accountId) {
        throw new Error(`Event does not belong to account ${accountId}`)
      }
      isInitialized = true
      balance = event.initialBalance
      validatedEvents.push(event)
    } else if (event._tag === "Deposited") {
      if (event.accountId !== accountId) {
        throw new Error(`Event does not belong to account ${accountId}`)
      }
      balance += event.amount
      validatedEvents.push(event)
    } else if (event._tag === "Withdrawn") {
      if (event.accountId !== accountId) {
        throw new Error(`Event does not belong to account ${accountId}`)
      }
      balance -= event.amount
      validatedEvents.push(event)
    } else if (event._tag === "Transferred") {
      if (event.fromAccountId !== accountId && event.toAccountId !== accountId) {
        throw new Error(`Transfer event does not involve account ${accountId}`)
      }
      if (event.fromAccountId === accountId) {
        balance -= event.amount
      } else {
        balance += event.amount
      }
      validatedEvents.push(event)
    }
  }
  
  if (!isInitialized && events.length > 0) {
    throw new Error("Account must start with AccountCreated event")
  }
  
  if (balance < 0) {
    throw new Error("Reconstructed balance cannot be negative")
  }
  
  return {
    accountId,
    balance,
    events: validatedEvents,
  }
}

// Get events
export function getEvents(account: Account): readonly Event[] {
  return account.events
}