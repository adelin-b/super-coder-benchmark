// Event types
export type DepositedEvent = {
  type: 'Deposited';
  amount: number;
  timestamp: Date;
};

export type WithdrawnEvent = {
  type: 'Withdrawn';
  amount: number;
  timestamp: Date;
};

export type TransferredEvent = {
  type: 'Transferred';
  amount: number;
  toAccountId: string;
  timestamp: Date;
};

export type ReceivedEvent = {
  type: 'Received';
  amount: number;
  fromAccountId: string;
  timestamp: Date;
};

export type AccountEvent = DepositedEvent | WithdrawnEvent | TransferredEvent | ReceivedEvent;

export class Account {
  private accountId: string;
  private balance: number = 0;
  private events: AccountEvent[] = [];

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  deposit(amount: number, timestamp: Date = new Date()): void {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    const event: DepositedEvent = {
      type: 'Deposited',
      amount,
      timestamp,
    };
    this.events.push(event);
    this.balance += amount;
  }

  withdraw(amount: number, timestamp: Date = new Date()): void {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    const event: WithdrawnEvent = {
      type: 'Withdrawn',
      amount,
      timestamp,
    };
    this.events.push(event);
    this.balance -= amount;
  }

  transfer(amount: number, toAccountId: string, timestamp: Date = new Date()): void {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    const event: TransferredEvent = {
      type: 'Transferred',
      amount,
      toAccountId,
      timestamp,
    };
    this.events.push(event);
    this.balance -= amount;
  }

  receive(amount: number, fromAccountId: string, timestamp: Date = new Date()): void {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    const event: ReceivedEvent = {
      type: 'Received',
      amount,
      fromAccountId,
      timestamp,
    };
    this.events.push(event);
    this.balance += amount;
  }

  getBalance(): number {
    return this.balance;
  }

  getAccountId(): string {
    return this.accountId;
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }

  static fromEvents(accountId: string, events: AccountEvent[]): Account {
    const account = new Account(accountId);
    for (const event of events) {
      switch (event.type) {
        case 'Deposited':
          account.balance += event.amount;
          break;
        case 'Withdrawn':
          account.balance -= event.amount;
          break;
        case 'Transferred':
          account.balance -= event.amount;
          break;
        case 'Received':
          account.balance += event.amount;
          break;
      }
      account.events.push(event);
    }
    return account;
  }
}

export class InsufficientFundsError extends Error {
  constructor(message: string = 'Insufficient funds') {
    super(message);
    this.name = 'InsufficientFundsError';
  }
}

export class InvalidAmountError extends Error {
  constructor(message: string = 'Invalid amount') {
    super(message);
    this.name = 'InvalidAmountError';
  }
}