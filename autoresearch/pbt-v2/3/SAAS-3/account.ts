// Event types for the event store
export type AccountEvent =
  | { type: 'AccountCreated'; accountId: string; balance: number; timestamp: number }
  | { type: 'DepositMade'; amount: number; timestamp: number }
  | { type: 'WithdrawalMade'; amount: number; timestamp: number }
  | { type: 'TransferSent'; amount: number; toAccountId: string; timestamp: number }
  | { type: 'TransferReceived'; amount: number; fromAccountId: string; timestamp: number };

export class Account {
  private accountId: string;
  private balance: number;
  private events: AccountEvent[];
  private version: number;

  constructor(accountId: string, initialBalance: number = 0) {
    if (initialBalance < 0) {
      throw new Error('Initial balance cannot be negative');
    }
    this.accountId = accountId;
    this.balance = initialBalance;
    this.version = 0;
    this.events = [
      {
        type: 'AccountCreated',
        accountId,
        balance: initialBalance,
        timestamp: Date.now(),
      },
    ];
  }

  getAccountId(): string {
    return this.accountId;
  }

  getBalance(): number {
    return this.balance;
  }

  getVersion(): number {
    return this.version;
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    this.balance += amount;
    this.version++;
    this.events.push({
      type: 'DepositMade',
      amount,
      timestamp: Date.now(),
    });
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    this.balance -= amount;
    this.version++;
    this.events.push({
      type: 'WithdrawalMade',
      amount,
      timestamp: Date.now(),
    });
  }

  transfer(amount: number, toAccountId: string): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    this.balance -= amount;
    this.version++;
    this.events.push({
      type: 'TransferSent',
      amount,
      toAccountId,
      timestamp: Date.now(),
    });
  }

  receiveTransfer(amount: number, fromAccountId: string): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    this.balance += amount;
    this.version++;
    this.events.push({
      type: 'TransferReceived',
      amount,
      fromAccountId,
      timestamp: Date.now(),
    });
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }

  static fromEvents(accountId: string, events: AccountEvent[]): Account {
    const account = new Account(accountId, 0);
    account.balance = 0;
    account.events = [];
    account.version = 0;

    for (const event of events) {
      switch (event.type) {
        case 'AccountCreated':
          account.balance = event.balance;
          break;
        case 'DepositMade':
          account.balance += event.amount;
          break;
        case 'WithdrawalMade':
          account.balance -= event.amount;
          break;
        case 'TransferSent':
          account.balance -= event.amount;
          break;
        case 'TransferReceived':
          account.balance += event.amount;
          break;
      }
      account.events.push(event);
      account.version++;
    }

    return account;
  }
}