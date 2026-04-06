// Event types
type AccountEvent = DepositedEvent | WithdrawnEvent | TransferredEvent;

interface DepositedEvent {
  type: 'Deposited';
  amount: number;
  timestamp: Date;
}

interface WithdrawnEvent {
  type: 'Withdrawn';
  amount: number;
  timestamp: Date;
}

interface TransferredEvent {
  type: 'Transferred';
  amount: number;
  to: string;
  timestamp: Date;
}

// Event-sourced Account aggregate
class Account {
  private balance: number = 0;
  private events: AccountEvent[] = [];
  private id: string;

  constructor(id: string) {
    if (!id) throw new Error('Account ID is required');
    this.id = id;
  }

  deposit(amount: number): void {
    if (amount <= 0) throw new Error('Deposit amount must be positive');

    const event: DepositedEvent = {
      type: 'Deposited',
      amount,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  withdraw(amount: number): void {
    if (amount <= 0) throw new Error('Withdrawal amount must be positive');
    if (this.balance < amount) throw new Error('Insufficient funds');

    const event: WithdrawnEvent = {
      type: 'Withdrawn',
      amount,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  transfer(amount: number, to: string): void {
    if (amount <= 0) throw new Error('Transfer amount must be positive');
    if (!to) throw new Error('Recipient account is required');
    if (this.balance < amount) throw new Error('Insufficient funds');

    const event: TransferredEvent = {
      type: 'Transferred',
      amount,
      to,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    this.events.push(event);
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
  }

  getBalance(): number {
    return this.balance;
  }

  getId(): string {
    return this.id;
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }

  static fromEvents(id: string, events: AccountEvent[]): Account {
    const account = new Account(id);
    for (const event of events) {
      account.applyEvent(event);
      account.events.push(event);
    }
    return account;
  }
}

export {
  Account,
  AccountEvent,
  DepositedEvent,
  WithdrawnEvent,
  TransferredEvent,
};