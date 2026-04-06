interface DepositedEvent {
  type: 'deposited';
  amount: number;
  timestamp: Date;
}

interface WithdrawnEvent {
  type: 'withdrawn';
  amount: number;
  timestamp: Date;
}

interface TransferredEvent {
  type: 'transferred';
  amount: number;
  toAccountId: string;
  timestamp: Date;
}

interface TransferReceivedEvent {
  type: 'transfer_received';
  amount: number;
  fromAccountId: string;
  timestamp: Date;
}

type Event =
  | DepositedEvent
  | WithdrawnEvent
  | TransferredEvent
  | TransferReceivedEvent;

class Account {
  private accountId: string;
  private balance: number = 0;
  private events: Event[] = [];

  constructor(accountId: string) {
    if (!accountId) throw new Error('Account ID is required');
    this.accountId = accountId;
  }

  deposit(amount: number): void {
    if (amount <= 0) throw new Error('Deposit amount must be positive');

    const event: DepositedEvent = {
      type: 'deposited',
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
      type: 'withdrawn',
      amount,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  transfer(amount: number, toAccountId: string): void {
    if (amount <= 0) throw new Error('Transfer amount must be positive');
    if (!toAccountId) throw new Error('Recipient account ID is required');
    if (this.balance < amount) throw new Error('Insufficient funds');

    const event: TransferredEvent = {
      type: 'transferred',
      amount,
      toAccountId,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  receiveTransfer(amount: number, fromAccountId: string): void {
    if (amount <= 0) throw new Error('Transfer amount must be positive');
    if (!fromAccountId) throw new Error('Sender account ID is required');

    const event: TransferReceivedEvent = {
      type: 'transfer_received',
      amount,
      fromAccountId,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  private applyEvent(event: Event): void {
    switch (event.type) {
      case 'deposited':
        this.balance += event.amount;
        break;
      case 'withdrawn':
        this.balance -= event.amount;
        break;
      case 'transferred':
        this.balance -= event.amount;
        break;
      case 'transfer_received':
        this.balance += event.amount;
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
    if (!accountId) throw new Error('Account ID is required');
    if (!Array.isArray(events)) throw new Error('Events must be an array');

    const account = new Account(accountId);
    for (const event of events) {
      account.applyEvent(event);
      account.events.push(event);
    }
    return account;
  }
}

export {
  Account,
  Event,
  DepositedEvent,
  WithdrawnEvent,
  TransferredEvent,
  TransferReceivedEvent,
};