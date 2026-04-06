export type BankEvent = 
  | DepositEvent
  | WithdrawEvent
  | TransferEvent;

export interface DepositEvent {
  type: 'Deposit';
  amount: number;
  timestamp: Date;
}

export interface WithdrawEvent {
  type: 'Withdraw';
  amount: number;
  timestamp: Date;
}

export interface TransferEvent {
  type: 'Transfer';
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  timestamp: Date;
}

export interface AccountState {
  accountId: string;
  balance: number;
}

export class Account {
  private accountId: string;
  private balance: number = 0;
  private events: BankEvent[] = [];

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    const event: DepositEvent = {
      type: 'Deposit',
      amount,
      timestamp: new Date(),
    };
    this.applyEvent(event);
    this.events.push(event);
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient balance');
    }
    const event: WithdrawEvent = {
      type: 'Withdraw',
      amount,
      timestamp: new Date(),
    };
    this.applyEvent(event);
    this.events.push(event);
  }

  transfer(toAccountId: string, amount: number): void {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient balance');
    }
    const event: TransferEvent = {
      type: 'Transfer',
      fromAccountId: this.accountId,
      toAccountId,
      amount,
      timestamp: new Date(),
    };
    this.applyEvent(event);
    this.events.push(event);
  }

  private applyEvent(event: BankEvent): void {
    switch (event.type) {
      case 'Deposit':
        this.balance += event.amount;
        break;
      case 'Withdraw':
        this.balance -= event.amount;
        break;
      case 'Transfer':
        this.balance -= event.amount;
        break;
    }
  }

  getBalance(): number {
    return this.balance;
  }

  getState(): AccountState {
    return {
      accountId: this.accountId,
      balance: this.balance,
    };
  }

  getEvents(): BankEvent[] {
    return [...this.events];
  }

  static fromEvents(accountId: string, events: BankEvent[]): Account {
    const account = new Account(accountId);
    for (const event of events) {
      account.applyEvent(event);
      account.events.push(event);
    }
    return account;
  }
}