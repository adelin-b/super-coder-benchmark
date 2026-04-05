// Event types
export interface DepositEvent {
  type: 'deposit';
  accountId: string;
  amount: number;
  timestamp: Date;
}

export interface WithdrawEvent {
  type: 'withdraw';
  accountId: string;
  amount: number;
  timestamp: Date;
}

export interface TransferEvent {
  type: 'transfer';
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  timestamp: Date;
}

export type Event = DepositEvent | WithdrawEvent | TransferEvent;

// Error classes
export class InsufficientFundsError extends Error {
  constructor(balance: number, amount: number) {
    super(`Insufficient funds. Balance: ${balance}, Requested: ${amount}`);
    this.name = 'InsufficientFundsError';
  }
}

export class InvalidAmountError extends Error {
  constructor(amount: number) {
    super(`Amount must be positive. Got: ${amount}`);
    this.name = 'InvalidAmountError';
  }
}

// Account aggregate
export class Account {
  private accountId: string;
  private balance: number = 0;
  private events: Event[] = [];

  constructor(accountId: string) {
    if (!accountId || accountId.trim() === '') {
      throw new Error('Account ID cannot be empty');
    }
    this.accountId = accountId;
  }

  deposit(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new InvalidAmountError(amount);
    }

    this.balance += amount;
    this.events.push({
      type: 'deposit',
      accountId: this.accountId,
      amount,
      timestamp: new Date()
    });
  }

  withdraw(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new InvalidAmountError(amount);
    }

    if (amount > this.balance) {
      throw new InsufficientFundsError(this.balance, amount);
    }

    this.balance -= amount;
    this.events.push({
      type: 'withdraw',
      accountId: this.accountId,
      amount,
      timestamp: new Date()
    });
  }

  transfer(toAccountId: string, amount: number): void {
    if (!toAccountId || toAccountId.trim() === '') {
      throw new Error('Target account ID cannot be empty');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new InvalidAmountError(amount);
    }

    if (amount > this.balance) {
      throw new InsufficientFundsError(this.balance, amount);
    }

    this.balance -= amount;
    this.events.push({
      type: 'transfer',
      fromAccountId: this.accountId,
      toAccountId,
      amount,
      timestamp: new Date()
    });
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
    if (!accountId || accountId.trim() === '') {
      throw new Error('Account ID cannot be empty');
    }

    const account = new Account(accountId);

    for (const event of events) {
      if (event.type === 'deposit' && event.accountId === accountId) {
        account.balance += event.amount;
      } else if (event.type === 'withdraw' && event.accountId === accountId) {
        account.balance -= event.amount;
      } else if (event.type === 'transfer') {
        if (event.fromAccountId === accountId) {
          account.balance -= event.amount;
        } else if (event.toAccountId === accountId) {
          account.balance += event.amount;
        }
      }
    }

    account.events = [...events];
    return account;
  }
}