type DepositEvent = {
  type: 'deposit'
  amount: number
  timestamp: Date
}

type WithdrawEvent = {
  type: 'withdraw'
  amount: number
  timestamp: Date
}

type TransferEvent = {
  type: 'transfer'
  fromAccountId: string
  toAccountId: string
  amount: number
  timestamp: Date
}

type AccountEvent = DepositEvent | WithdrawEvent | TransferEvent

interface AccountState {
  id: string
  balance: number
  events: AccountEvent[]
}

class Account {
  private id: string
  private balance: number = 0
  private events: AccountEvent[] = []

  constructor(id: string) {
    this.id = id
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive')
    }
    const event: DepositEvent = {
      type: 'deposit',
      amount,
      timestamp: new Date(),
    }
    this.applyEvent(event)
    this.events.push(event)
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive')
    }
    if (this.balance < amount) {
      throw new Error('Insufficient balance')
    }
    const event: WithdrawEvent = {
      type: 'withdraw',
      amount,
      timestamp: new Date(),
    }
    this.applyEvent(event)
    this.events.push(event)
  }

  transfer(toAccountId: string, amount: number): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive')
    }
    if (this.balance < amount) {
      throw new Error('Insufficient balance')
    }
    const event: TransferEvent = {
      type: 'transfer',
      fromAccountId: this.id,
      toAccountId,
      amount,
      timestamp: new Date(),
    }
    this.applyEvent(event)
    this.events.push(event)
  }

  private applyEvent(event: AccountEvent): void {
    switch (event.type) {
      case 'deposit':
        this.balance += event.amount
        break
      case 'withdraw':
        this.balance -= event.amount
        break
      case 'transfer':
        if (event.fromAccountId === this.id) {
          this.balance -= event.amount
        } else if (event.toAccountId === this.id) {
          this.balance += event.amount
        }
        break
    }
  }

  getBalance(): number {
    return this.balance
  }

  getEvents(): AccountEvent[] {
    return [...this.events]
  }

  getState(): AccountState {
    return {
      id: this.id,
      balance: this.balance,
      events: [...this.events],
    }
  }

  static reconstructFromEvents(
    id: string,
    events: AccountEvent[]
  ): Account {
    const account = new Account(id)
    for (const event of events) {
      account.applyEvent(event)
    }
    account.events = [...events]
    return account
  }
}

export {
  Account,
  AccountEvent,
  AccountState,
  DepositEvent,
  TransferEvent,
  WithdrawEvent,
}