interface DepositedEvent {
  type: 'Deposited';
  amount: number;
  timestamp: number;
}

interface WithdrawnEvent {
  type: 'Withdrawn';
  amount: number;
  timestamp: number;
}

interface TransferredEvent {
  type: 'Transferred';
  amount: number;
  toAccountId: string;
  timestamp: number;
}

type AccountEvent = DepositedEvent | WithdrawnEvent | TransferredEvent;

export class Account {
  private accountId: string;
  private balance: number = 0;
  private version: number = 0;
  private uncommittedEvents: AccountEvent[] = [];

  constructor(accountId: string) {
    if (!accountId) throw new Error('accountId required');
    this.accountId = accountId;
  }

  deposit(amount: number): void {
    if (amount <= 0) throw new Error('amount must be positive');

    const event: DepositedEvent = {
      type: 'Deposited',
      amount,
      timestamp: Date.now(),
    };

    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }

  withdraw(amount: number): void {
    if (amount <= 0) throw new Error('amount must be positive');
    if (this.balance < amount) throw new Error('insufficient funds');

    const event: WithdrawnEvent = {
      type: 'Withdrawn',
      amount,
      timestamp: Date.now(),
    };

    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }

  transfer(amount: number, toAccountId: string): void {
    if (amount <= 0) throw new Error('amount must be positive');
    if (!toAccountId) throw new Error('toAccountId required');
    if (this.balance < amount) throw new Error('insufficient funds');

    const event: TransferredEvent = {
      type: 'Transferred',
      amount,
      toAccountId,
      timestamp: Date.now(),
    };

    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }

  private applyEvent(event: AccountEvent): void {
    switch (event.type) {
      case 'Deposited':
        this.balance += event.amount;
        break;
      case 'Withdrawn':
        this.balance -= event.amount;
        break;
      case 'Transferred':
        this.balance -= event.amount;
        break;
    }
    this.version++;
  }

  loadFromEvents(events: AccountEvent[]): void {
    if (!events) throw new Error('events required');

    this.balance = 0;
    this.version = 0;

    for (const event of events) {
      this.applyEvent(event);
    }
  }

  getBalance(): number {
    return this.balance;
  }

  getAccountId(): string {
    return this.accountId;
  }

  getVersion(): number {
    return this.version;
  }

  getUncommittedEvents(): AccountEvent[] {
    return [...this.uncommittedEvents];
  }

  commitEvents(): void {
    this.uncommittedEvents = [];
  }
}

export type { AccountEvent, DepositedEvent, TransferredEvent, WithdrawnEvent };