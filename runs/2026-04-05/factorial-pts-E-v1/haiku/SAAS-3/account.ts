// Event types
interface DepositedEvent {
  type: 'deposited';
  amount: number;
  timestamp: Date;
}

interface WithdrewEvent {
  type: 'withdrew';
  amount: number;
  timestamp: Date;
}

interface TransferredEvent {
  type: 'transferred';
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  timestamp: Date;
}

type Event = DepositedEvent | WithdrewEvent | TransferredEvent;

class Account {
  private accountId: string;
  private balance = 0;
  private events: Event[] = [];
  private uncommittedEvents: Event[] = [];

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    const event: DepositedEvent = {
      type: 'deposited',
      amount,
      timestamp: new Date()
    };
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    const event: WithdrewEvent = {
      type: 'withdrew',
      amount,
      timestamp: new Date()
    };
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }

  transfer(toAccountId: string, amount: number): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    const event: TransferredEvent = {
      type: 'transferred',
      fromAccountId: this.accountId,
      toAccountId,
      amount,
      timestamp: new Date()
    };
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }

  private applyEvent(event: Event): void {
    switch (event.type) {
      case 'deposited':
        this.balance += event.amount;
        break;
      case 'withdrew':
        this.balance -= event.amount;
        break;
      case 'transferred':
        if (event.fromAccountId === this.accountId) {
          this.balance -= event.amount;
        } else if (event.toAccountId === this.accountId) {
          this.balance += event.amount;
        }
        break;
    }
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): Event[] {
    return [...this.events];
  }

  getUncommittedEvents(): Event[] {
    return [...this.uncommittedEvents];
  }

  loadFromHistory(events: Event[]): void {
    this.events = [...events];
    this.balance = 0;
    for (const event of events) {
      this.applyEvent(event);
    }
  }

  commitEvents(): void {
    this.events.push(...this.uncommittedEvents);
    this.uncommittedEvents = [];
  }
}

export { Account, Event, DepositedEvent, WithdrewEvent, TransferredEvent };