export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidAmountError"
  }
}

export class InsufficientFundsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InsufficientFundsError"
  }
}

export type DepositedEvent = {
  type: "Deposited"
  amount: number
  timestamp: string
}

export type WithdrawnEvent = {
  type: "Withdrawn"
  amount: number
  timestamp: string
}

export type TransferredEvent = {
  type: "Transferred"
  toAccountId: string
  amount: number
  timestamp: string
}

export type AccountEvent = DepositedEvent | WithdrawnEvent | TransferredEvent

export class Account {
  private balance: number = 0
  private committedEvents: AccountEvent[] = []
  private uncommittedEvents: AccountEvent[] = []

  constructor(private id: string) {}

  getId(): string {
    return this.id
  }

  getBalance(): number {
    return this.balance
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError("Deposit amount must be positive")
    }

    const event: DepositedEvent = {
      type: "Deposited",
      amount,
      timestamp: new Date().toISOString(),
    }

    this.applyEvent(event)
    this.uncommittedEvents.push(event)
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError("Withdrawal amount must be positive")
    }

    if (this.balance < amount) {
      throw new InsufficientFundsError(
        `Cannot withdraw ${amount}. Current balance: ${this.balance}`
      )
    }

    const event: WithdrawnEvent = {
      type: "Withdrawn",
      amount,
      timestamp: new Date().toISOString(),
    }

    this.applyEvent(event)
    this.uncommittedEvents.push(event)
  }

  transfer(toAccountId: string, amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError("Transfer amount must be positive")
    }

    if (this.balance < amount) {
      throw new InsufficientFundsError(
        `Cannot transfer ${amount}. Current balance: ${this.balance}`
      )
    }

    const event: TransferredEvent = {
      type: "Transferred",
      toAccountId,
      amount,
      timestamp: new Date().toISOString(),
    }

    this.applyEvent(event)
    this.uncommittedEvents.push(event)
  }

  private applyEvent(event: AccountEvent): void {
    switch (event.type) {
      case "Deposited":
        this.balance += event.amount
        break
      case "Withdrawn":
        this.balance -= event.amount
        break
      case "Transferred":
        this.balance -= event.amount
        break
    }
  }

  getUncommittedEvents(): AccountEvent[] {
    return [...this.uncommittedEvents]
  }

  getCommittedEvents(): AccountEvent[] {
    return [...this.committedEvents]
  }

  getAllEvents(): AccountEvent[] {
    return [...this.committedEvents, ...this.uncommittedEvents]
  }

  commitEvents(): void {
    this.committedEvents.push(...this.uncommittedEvents)
    this.uncommittedEvents = []
  }

  loadFromEvents(events: AccountEvent[]): void {
    this.balance = 0
    this.committedEvents = [...events]
    this.uncommittedEvents = []

    for (const event of events) {
      this.applyEvent(event)
    }
  }
}