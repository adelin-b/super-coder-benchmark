export type DepositEvent = {
  readonly type: 'Deposited'
  readonly amount: number
  readonly timestamp: number
}

export type WithdrawnEvent = {
  readonly type: 'Withdrawn'
  readonly amount: number
  readonly timestamp: number
}

export type TransferredEvent = {
  readonly type: 'Transferred'
  readonly amount: number
  readonly to: string
  readonly timestamp: number
}

export type AccountEvent = DepositEvent | WithdrawnEvent | TransferredEvent

export class Account {
  private balance: number
  private events: AccountEvent[] = []
  private readonly accountId: string

  constructor(accountId: string, initialBalance: number = 0) {
    if (initialBalance < 0) {
      throw new Error('Initial balance cannot be negative')
    }
    this.accountId = accountId
    this.balance = initialBalance
  }

  getAccountId(): string {
    return this.accountId
  }

  getBalance(): number {
    return this.balance
  }

  getEvents(): readonly AccountEvent[] {
    return [...this.events]
  }

  deposit(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Deposit amount must be a positive number')
    }
    const event: DepositEvent = {
      type: 'Deposited',
      amount,
      timestamp: Date.now()
    }
    this.balance += amount
    this.events.push(event)
  }

  withdraw(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Withdrawal amount must be a positive number')
    }
    if (amount > this.balance) {
      throw new Error('Insufficient funds')
    }
    const event: WithdrawnEvent = {
      type: 'Withdrawn',
      amount,
      timestamp: Date.now()
    }
    this.balance -= amount
    this.events.push(event)
  }

  transfer(amount: number, toAccountId: string): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Transfer amount must be a positive number')
    }
    if (!toAccountId || typeof toAccountId !== 'string') {
      throw new Error('Invalid recipient account ID')
    }
    if (amount > this.balance) {
      throw new Error('Insufficient funds')
    }
    const event: TransferredEvent = {
      type: 'Transferred',
      amount,
      to: toAccountId,
      timestamp: Date.now()
    }
    this.balance -= amount
    this.events.push(event)
  }
}

export function replayEvents(
  accountId: string,
  events: readonly AccountEvent[]
): Account {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Invalid account ID')
  }
  if (!Array.isArray(events)) {
    throw new Error('Events must be an array')
  }

  const account = new Account(accountId, 0)
  for (const event of events) {
    if (!event || typeof event !== 'object') {
      throw new Error('Invalid event')
    }
    switch (event.type) {
      case 'Deposited': {
        if (typeof event.amount !== 'number' || event.amount <= 0) {
          throw new Error('Invalid deposit amount in event')
        }
        account['balance'] += event.amount
        account['events'].push(event)
        break
      }
      case 'Withdrawn': {
        if (typeof event.amount !== 'number' || event.amount <= 0) {
          throw new Error('Invalid withdrawal amount in event')
        }
        if (event.amount > account['balance']) {
          throw new Error('Event replay failed: insufficient funds at event')
        }
        account['balance'] -= event.amount
        account['events'].push(event)
        break
      }
      case 'Transferred': {
        if (typeof event.amount !== 'number' || event.amount <= 0) {
          throw new Error('Invalid transfer amount in event')
        }
        if (event.amount > account['balance']) {
          throw new Error('Event replay failed: insufficient funds at event')
        }
        account['balance'] -= event.amount
        account['events'].push(event)
        break
      }
      default: {
        const _exhaustive: never = event
        throw new Error(`Unknown event type`)
      }
    }
  }
  return account
}