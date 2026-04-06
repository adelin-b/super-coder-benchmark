export type Event = 
  | { type: 'Deposit', accountId: string, amount: number, timestamp: Date }
  | { type: 'Withdrawal', accountId: string, amount: number, timestamp: Date }
  | { type: 'Transfer', fromAccountId: string, toAccountId: string, amount: number, timestamp: Date }

export class Account {
  private balance: number = 0
  private events: Event[] = []
  private accountId: string

  constructor(accountId: string) {
    this.accountId = accountId
  }

  deposit(amount: number): void {
    if (amount <= 0) throw new Error("Amount must be positive")
    
    const event: Event = {
      type: 'Deposit',
      accountId: this.accountId,
      amount,
      timestamp: new Date()
    }
    this.applyEvent(event)
    this.events.push(event)
  }

  withdraw(amount: number): void {
    if (amount <= 0) throw new Error("Amount must be positive")
    if (this.balance < amount) throw new Error("Insufficient funds")
    
    const event: Event = {
      type: 'Withdrawal',
      accountId: this.accountId,
      amount,
      timestamp: new Date()
    }
    this.applyEvent(event)
    this.events.push(event)
  }

  transfer(toAccountId: string, amount: number): void {
    if (amount <= 0) throw new Error("Amount must be positive")
    if (this.balance < amount) throw new Error("Insufficient funds")
    
    const event: Event = {
      type: 'Transfer',
      fromAccountId: this.accountId,
      toAccountId,
      amount,
      timestamp: new Date()
    }
    this.applyEvent(event)
    this.events.push(event)
  }

  private applyEvent(event: Event): void {
    switch (event.type) {
      case 'Deposit':
        this.balance += event.amount
        break
      case 'Withdrawal':
        this.balance -= event.amount
        break
      case 'Transfer':
        if (event.fromAccountId === this.accountId) {
          this.balance -= event.amount
        }
        break
    }
  }

  static fromEvents(accountId: string, events: Event[]): Account {
    const account = new Account(accountId)
    for (const event of events) {
      account.applyEvent(event)
    }
    account.events = [...events]
    return account
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
}