// Domain Errors
class InsufficientFundsError extends Error {
  constructor(accountId: string, balance: number, requested: number) {
    super(`Insufficient funds: balance ${balance}, requested ${requested}`)
    this.name = 'InsufficientFundsError'
  }
}

class InvalidAmountError extends Error {
  constructor(amount: number, reason: string) {
    super(`Invalid amount ${amount}: ${reason}`)
    this.name = 'InvalidAmountError'
  }
}

// Event Types
export type DomainEvent =
  | { type: 'AccountCreated'; accountId: string; timestamp: string }
  | { type: 'DepositOccurred'; accountId: string; amount: number; timestamp: string }
  | { type: 'WithdrawalOccurred'; accountId: string; amount: number; timestamp: string }
  | { type: 'TransferOccurred'; fromAccountId: string; toAccountId: string; amount: number; timestamp: string }

// Account State Interface
export interface AccountState {
  accountId: string
  balance: number
}

// Account Aggregate
export class Account {
  private accountId: string
  private balance: number = 0
  private uncommittedEvents: DomainEvent[] = []

  constructor(accountId: string) {
    this.accountId = accountId
    this.balance = 0
    this.uncommittedEvents.push({
      type: 'AccountCreated',
      accountId,
      timestamp: new Date().toISOString(),
    })
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError(amount, 'must be positive')
    }
    this.balance += amount
    this.uncommittedEvents.push({
      type: 'DepositOccurred',
      accountId: this.accountId,
      amount,
      timestamp: new Date().toISOString(),
    })
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError(amount, 'must be positive')
    }
    if (this.balance < amount) {
      throw new InsufficientFundsError(this.accountId, this.balance, amount)
    }
    this.balance -= amount
    this.uncommittedEvents.push({
      type: 'WithdrawalOccurred',
      accountId: this.accountId,
      amount,
      timestamp: new Date().toISOString(),
    })
  }

  transfer(toAccountId: string, amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError(amount, 'must be positive')
    }
    if (this.balance < amount) {
      throw new InsufficientFundsError(this.accountId, this.balance, amount)
    }
    this.balance -= amount
    this.uncommittedEvents.push({
      type: 'TransferOccurred',
      fromAccountId: this.accountId,
      toAccountId,
      amount,
      timestamp: new Date().toISOString(),
    })
  }

  getBalance(): number {
    return this.balance
  }

  getAccountId(): string {
    return this.accountId
  }

  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents]
  }

  commitEvents(): void {
    this.uncommittedEvents = []
  }

  applyEvent(event: DomainEvent): void {
    switch (event.type) {
      case 'AccountCreated':
        this.accountId = event.accountId
        break
      case 'DepositOccurred':
        this.balance += event.amount
        break
      case 'WithdrawalOccurred':
        this.balance -= event.amount
        break
      case 'TransferOccurred':
        if (event.fromAccountId === this.accountId) {
          this.balance -= event.amount
        }
        break
    }
  }

  static loadFromEvents(accountId: string, events: DomainEvent[]): Account {
    const account = new Account(accountId)
    account.uncommittedEvents = []
    for (const event of events) {
      account.applyEvent(event)
    }
    return account
  }
}

export function reconstructAccountState(accountId: string, events: DomainEvent[]): AccountState {
  let balance = 0
  for (const event of events) {
    switch (event.type) {
      case 'DepositOccurred':
        balance += event.amount
        break
      case 'WithdrawalOccurred':
        balance -= event.amount
        break
      case 'TransferOccurred':
        if (event.fromAccountId === accountId) {
          balance -= event.amount
        }
        break
    }
  }
  return { accountId, balance }
}