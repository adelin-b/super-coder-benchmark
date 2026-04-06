export type AccountEvent =
  | { readonly type: 'Deposited'; readonly amount: number; readonly timestamp: Date }
  | { readonly type: 'Withdrew'; readonly amount: number; readonly timestamp: Date }
  | { readonly type: 'Transferred'; readonly amount: number; readonly to: string; readonly timestamp: Date }
  | { readonly type: 'ReceivedTransfer'; readonly amount: number; readonly from: string; readonly timestamp: Date }

export class Account {
  private balance: number
  private events: AccountEvent[]

  private constructor(balance: number, events: AccountEvent[]) {
    this.balance = balance
    this.events = events
  }

  static createNew(): Account {
    return new Account(0, [])
  }

  static fromEvents(events: readonly AccountEvent[]): Account {
    const account = new Account(0, [])
    for (const event of events) {
      account.events.push(event)
      account.applyEventToState(event)
    }
    return account
  }

  deposit(amount: number): void {
    if (amount <= 0) throw new Error('Deposit amount must be positive')
    const event: AccountEvent = {
      type: 'Deposited',
      amount,
      timestamp: new Date(),
    }
    this.events.push(event)
    this.applyEventToState(event)
  }

  withdraw(amount: number): void {
    if (amount <= 0) throw new Error('Withdraw amount must be positive')
    if (this.balance < amount) throw new Error('Insufficient funds')
    const event: AccountEvent = {
      type: 'Withdrew',
      amount,
      timestamp: new Date(),
    }
    this.events.push(event)
    this.applyEventToState(event)
  }

  transfer(amount: number, to: string): void {
    if (amount <= 0) throw new Error('Transfer amount must be positive')
    if (!to) throw new Error('Recipient account required')
    if (this.balance < amount) throw new Error('Insufficient funds')
    const event: AccountEvent = {
      type: 'Transferred',
      amount,
      to,
      timestamp: new Date(),
    }
    this.events.push(event)
    this.applyEventToState(event)
  }

  receiveTransfer(amount: number, from: string): void {
    if (amount <= 0) throw new Error('Transfer amount must be positive')
    if (!from) throw new Error('Sender account required')
    const event: AccountEvent = {
      type: 'ReceivedTransfer',
      amount,
      from,
      timestamp: new Date(),
    }
    this.events.push(event)
    this.applyEventToState(event)
  }

  getBalance(): number {
    return this.balance
  }

  getEvents(): readonly AccountEvent[] {
    return [...this.events]
  }

  private applyEventToState(event: AccountEvent): void {
    switch (event.type) {
      case 'Deposited':
        this.balance += event.amount
        break
      case 'Withdrew':
        this.balance -= event.amount
        break
      case 'Transferred':
        this.balance -= event.amount
        break
      case 'ReceivedTransfer':
        this.balance += event.amount
        break
    }
  }
}