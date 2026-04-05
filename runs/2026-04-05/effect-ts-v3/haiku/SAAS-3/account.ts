export type Event =
  | { type: 'AccountCreated'; accountId: string; timestamp: Date }
  | { type: 'Deposited'; amount: number; timestamp: Date }
  | { type: 'Withdrew'; amount: number; timestamp: Date }
  | { type: 'Transferred'; amount: number; to: string; timestamp: Date }
  | { type: 'TransferReceived'; amount: number; from: string; timestamp: Date }

export class Account {
  private events: Event[] = []
  private balance: number = 0

  constructor(private accountId: string) {
    this.events.push({
      type: 'AccountCreated',
      accountId,
      timestamp: new Date()
    })
  }

  deposit(amount: number): void {
    if (amount <= 0) throw new Error('Deposit amount must be positive')
    this.events.push({
      type: 'Deposited',
      amount,
      timestamp: new Date()
    })
    this.balance += amount
  }

  withdraw(amount: number): void {
    if (amount <= 0) throw new Error('Withdrawal amount must be positive')
    if (this.balance < amount) throw new Error('Insufficient funds')
    this.events.push({
      type: 'Withdrew',
      amount,
      timestamp: new Date()
    })
    this.balance -= amount
  }

  transfer(amount: number, to: string): void {
    if (amount <= 0) throw new Error('Transfer amount must be positive')
    if (this.balance < amount) throw new Error('Insufficient funds')
    this.events.push({
      type: 'Transferred',
      amount,
      to,
      timestamp: new Date()
    })
    this.balance -= amount
  }

  receiveTransfer(amount: number, from: string): void {
    if (amount <= 0) throw new Error('Transfer amount must be positive')
    this.events.push({
      type: 'TransferReceived',
      amount,
      from,
      timestamp: new Date()
    })
    this.balance += amount
  }

  getBalance(): number {
    return this.balance
  }

  getEvents(): Event[] {
    return [...this.events]
  }

  getAccountId(): string {
    return this.accountId
  }

  static loadFromEvents(accountId: string, events: Event[]): Account {
    const account = new Account(accountId)
    account.events = []
    account.balance = 0

    for (const event of events) {
      switch (event.type) {
        case 'AccountCreated':
          break
        case 'Deposited':
          account.balance += event.amount
          break
        case 'Withdrew':
          account.balance -= event.amount
          break
        case 'Transferred':
          account.balance -= event.amount
          break
        case 'TransferReceived':
          account.balance += event.amount
          break
      }
      account.events.push(event)
    }

    return account
  }
}

export function createAccount(accountId: string): Account {
  return new Account(accountId)
}

export function reconstructAccount(accountId: string, events: Event[]): Account {
  return Account.loadFromEvents(accountId, events)
}