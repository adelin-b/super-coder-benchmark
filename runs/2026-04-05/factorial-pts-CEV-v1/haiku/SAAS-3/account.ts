interface DepositEvent {
  type: 'deposit';
  amount: number;
  timestamp: Date;
}

interface WithdrawEvent {
  type: 'withdraw';
  amount: number;
  timestamp: Date;
}

interface TransferEvent {
  type: 'transfer';
  amount: number;
  to: string;
  timestamp: Date;
}

type Event = DepositEvent | WithdrawEvent | TransferEvent;

export class Account {
  private accountId: string;
  private balance: number = 0;
  private events: Event[] = [];

  constructor(accountId: string) {
    if (!accountId || typeof accountId !== 'string') {
      throw new Error('Account ID must be a non-empty string');
    }
    this.accountId = accountId;
  }

  deposit(amount: number): void {
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      throw new Error('Deposit amount must be a positive number');
    }
    const event: DepositEvent = {
      type: 'deposit',
      amount,
      timestamp: new Date()
    };
    this.applyEvent(event);
    this.events.push(event);
  }

  withdraw(amount: number): void {
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      throw new Error('Withdraw amount must be a positive number');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    const event: WithdrawEvent = {
      type: 'withdraw',
      amount,
      timestamp: new Date()
    };
    this.applyEvent(event);
    this.events.push(event);
  }

  transfer(amount: number, to: string): void {
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      throw new Error('Transfer amount must be a positive number');
    }
    if (!to || typeof to !== 'string') {
      throw new Error('Recipient account must be a non-empty string');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    const event: TransferEvent = {
      type: 'transfer',
      amount,
      to,
      timestamp: new Date()
    };
    this.applyEvent(event);
    this.events.push(event);
  }

  private applyEvent(event: Event): void {
    switch (event.type) {
      case 'deposit':
        this.balance += event.amount;
        break;
      case 'withdraw':
        this.balance -= event.amount;
        break;
      case 'transfer':
        this.balance -= event.amount;
        break;
    }
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): Event[] {
    return [...this.events];
  }

  getAccountId(): string {
    return this.accountId;
  }

  static fromEvents(accountId: string, events: Event[]): Account {
    if (!accountId || typeof accountId !== 'string') {
      throw new Error('Account ID must be a non-empty string');
    }
    if (!Array.isArray(events)) {
      throw new Error('Events must be an array');
    }

    const account = new Account(accountId);
    account.events = [];

    for (const event of events) {
      if (!event || typeof event !== 'object' || !event.type) {
        throw new Error('Invalid event object');
      }
      account.applyEvent(event as Event);
      account.events.push(event as Event);
    }

    return account;
  }
}

export type { Event, DepositEvent, WithdrawEvent, TransferEvent };