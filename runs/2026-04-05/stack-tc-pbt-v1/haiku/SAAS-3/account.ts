// Event types
export interface AccountCreatedEvent {
  type: 'AccountCreated';
  accountId: string;
  initialBalance: number;
  timestamp: Date;
}

export interface DepositedEvent {
  type: 'Deposited';
  accountId: string;
  amount: number;
  timestamp: Date;
}

export interface WithdrawnEvent {
  type: 'Withdrawn';
  accountId: string;
  amount: number;
  timestamp: Date;
}

export interface TransferredEvent {
  type: 'Transferred';
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  timestamp: Date;
}

export type Event = AccountCreatedEvent | DepositedEvent | WithdrawnEvent | TransferredEvent;

export class Account {
  private accountId: string;
  private balance: number;
  private events: Event[];

  constructor(accountId: string, initialBalance: number = 0) {
    this.accountId = accountId;
    this.balance = initialBalance;
    this.events = [];

    if (initialBalance > 0) {
      this.events.push({
        type: 'AccountCreated',
        accountId,
        initialBalance,
        timestamp: new Date(),
      });
    }
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    this.balance += amount;
    this.events.push({
      type: 'Deposited',
      accountId: this.accountId,
      amount,
      timestamp: new Date(),
    });
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient balance');
    }
    this.balance -= amount;
    this.events.push({
      type: 'Withdrawn',
      accountId: this.accountId,
      amount,
      timestamp: new Date(),
    });
  }

  transfer(toAccountId: string, amount: number): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient balance');
    }
    this.balance -= amount;
    this.events.push({
      type: 'Transferred',
      fromAccountId: this.accountId,
      toAccountId,
      amount,
      timestamp: new Date(),
    });
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): Event[] {
    return [...this.events];
  }

  static fromEvents(accountId: string, events: Event[]): Account {
    const account = new Account(accountId, 0);
    account.balance = 0;
    account.events = [];

    for (const event of events) {
      switch (event.type) {
        case 'AccountCreated':
          account.balance = event.initialBalance;
          break;
        case 'Deposited':
          if (event.accountId === accountId) {
            account.balance += event.amount;
          }
          break;
        case 'Withdrawn':
          if (event.accountId === accountId) {
            account.balance -= event.amount;
          }
          break;
        case 'Transferred':
          if (event.fromAccountId === accountId) {
            account.balance -= event.amount;
          } else if (event.toAccountId === accountId) {
            account.balance += event.amount;
          }
          break;
      }
    }

    account.events = [...events];
    return account;
  }
}