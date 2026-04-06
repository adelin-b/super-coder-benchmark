// ============ Error Types ============
export class InsufficientFunds extends Error {
  constructor(
    public readonly available: number,
    public readonly requested: number
  ) {
    super(`Insufficient funds: have ${available}, need ${requested}`)
    this.name = "InsufficientFunds"
  }
}

export class InvalidAmount extends Error {
  constructor(public readonly amount: number) {
    super(`Invalid amount: ${amount} must be positive`)
    this.name = "InvalidAmount"
  }
}

export class AccountNotFound extends Error {
  constructor(public readonly id: string) {
    super(`Account not found: ${id}`)
    this.name = "AccountNotFound"
  }
}

export class SelfTransferError extends Error {
  constructor() {
    super("Cannot transfer to the same account")
    this.name = "SelfTransferError"
  }
}

// ============ Event Types ============
export interface AccountCreatedEvent {
  readonly _tag: "AccountCreated"
  readonly id: string
  readonly timestamp: Date
}

export interface DepositedEvent {
  readonly _tag: "Deposited"
  readonly id: string
  readonly amount: number
  readonly timestamp: Date
}

export interface WithdrewEvent {
  readonly _tag: "Withdrew"
  readonly id: string
  readonly amount: number
  readonly timestamp: Date
}

export interface TransferredOutEvent {
  readonly _tag: "TransferredOut"
  readonly fromId: string
  readonly toId: string
  readonly amount: number
  readonly timestamp: Date
}

export interface TransferredInEvent {
  readonly _tag: "TransferredIn"
  readonly fromId: string
  readonly toId: string
  readonly amount: number
  readonly timestamp: Date
}

export type Event =
  | AccountCreatedEvent
  | DepositedEvent
  | WithdrewEvent
  | TransferredOutEvent
  | TransferredInEvent

// ============ Account State Type ============
export interface AccountState {
  readonly id: string
  readonly balance: number
  readonly events: readonly Event[]
}

// ============ Account Aggregate ============
export class Account {
  private state: AccountState

  constructor(id: string) {
    this.state = {
      id,
      balance: 0,
      events: [{ _tag: "AccountCreated", id, timestamp: new Date() }],
    }
  }

  getBalance(): number {
    return this.state.balance
  }

  getId(): string {
    return this.state.id
  }

  getEvents(): readonly Event[] {
    return this.state.events
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmount(amount)
    }

    const event: DepositedEvent = {
      _tag: "Deposited",
      id: this.state.id,
      amount,
      timestamp: new Date(),
    }

    this.state = {
      ...this.state,
      balance: this.state.balance + amount,
      events: [...this.state.events, event],
    }
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmount(amount)
    }

    if (this.state.balance < amount) {
      throw new InsufficientFunds(this.state.balance, amount)
    }

    const event: WithdrewEvent = {
      _tag: "Withdrew",
      id: this.state.id,
      amount,
      timestamp: new Date(),
    }

    this.state = {
      ...this.state,
      balance: this.state.balance - amount,
      events: [...this.state.events, event],
    }
  }

  static fromEvents(events: readonly Event[]): Account {
    if (events.length === 0) {
      throw new Error("Cannot reconstruct account from empty events")
    }

    const firstEvent = events[0]
    if (firstEvent._tag !== "AccountCreated") {
      throw new Error("First event must be AccountCreated")
    }

    const account = new Account(firstEvent.id)
    account.state = { ...account.state, events: [firstEvent] }

    for (let i = 1; i < events.length; i++) {
      const event = events[i]
      switch (event._tag) {
        case "Deposited":
          account.state = {
            ...account.state,
            balance: account.state.balance + event.amount,
            events: [...account.state.events, event],
          }
          break
        case "Withdrew":
          account.state = {
            ...account.state,
            balance: account.state.balance - event.amount,
            events: [...account.state.events, event],
          }
          break
        case "TransferredOut":
          account.state = {
            ...account.state,
            balance: account.state.balance - event.amount,
            events: [...account.state.events, event],
          }
          break
        case "TransferredIn":
          account.state = {
            ...account.state,
            balance: account.state.balance + event.amount,
            events: [...account.state.events, event],
          }
          break
      }
    }

    return account
  }
}

// ============ Event Store ============
export class EventStore {
  private accounts: Map<string, readonly Event[]> = new Map()

  createAccount(id: string): Account {
    if (this.accounts.has(id)) {
      throw new Error(`Account already exists: ${id}`)
    }

    const event: AccountCreatedEvent = {
      _tag: "AccountCreated",
      id,
      timestamp: new Date(),
    }

    this.accounts.set(id, [event])
    return Account.fromEvents([event])
  }

  getAccount(id: string): Account {
    const events = this.accounts.get(id)
    if (!events) {
      throw new AccountNotFound(id)
    }
    return Account.fromEvents(events)
  }

  saveAccount(account: Account): void {
    const events = account.getEvents()
    this.accounts.set(account.getId(), events)
  }

  getEvents(id: string): readonly Event[] {
    const events = this.accounts.get(id)
    if (!events) {
      throw new AccountNotFound(id)
    }
    return events
  }

  transfer(fromId: string, toId: string, amount: number): void {
    if (fromId === toId) {
      throw new SelfTransferError()
    }

    if (amount <= 0) {
      throw new InvalidAmount(amount)
    }

    const fromEvents = this.accounts.get(fromId)
    const toEvents = this.accounts.get(toId)

    if (!fromEvents) {
      throw new AccountNotFound(fromId)
    }
    if (!toEvents) {
      throw new AccountNotFound(toId)
    }

    const fromAccount = Account.fromEvents(fromEvents)

    if (fromAccount.getBalance() < amount) {
      throw new InsufficientFunds(fromAccount.getBalance(), amount)
    }

    const timestamp = new Date()

    const outEvent: TransferredOutEvent = {
      _tag: "TransferredOut",
      fromId,
      toId,
      amount,
      timestamp,
    }

    const inEvent: TransferredInEvent = {
      _tag: "TransferredIn",
      fromId,
      toId,
      amount,
      timestamp,
    }

    this.accounts.set(fromId, [...fromEvents, outEvent])
    this.accounts.set(toId, [...toEvents, inEvent])
  }
}