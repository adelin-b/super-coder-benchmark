export type DepositEvent = {
  type: 'deposit';
  amount: number;
  timestamp: Date;
};

export type WithdrawEvent = {
  type: 'withdraw';
  amount: number;
  timestamp: Date;
};

export type TransferEvent = {
  type: 'transfer';
  amount: number;
  targetAccountId: string;
  timestamp: Date;
};

export type AccountEvent = DepositEvent | WithdrawEvent | TransferEvent;

export class Account {
  private balance: number = 0;
  private events: AccountEvent[] = [];
  private accountId: string;

  constructor(accountId: string) {
    if (!accountId || accountId.trim() === '') {
      throw new Error('Account ID cannot be empty');
    }
    this.accountId = accountId;
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    const event: DepositEvent = {
      type: 'deposit',
      amount,
      timestamp: new Date(),
    };
    this.events.push(event);
    this.balance += amount;
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    const event: WithdrawEvent = {
      type: 'withdraw',
      amount,
      timestamp: new Date(),
    };
    this.events.push(event);
    this.balance -= amount;
  }

  transfer(amount: number, targetAccountId: string): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    if (!targetAccountId || targetAccountId.trim() === '') {
      throw new Error('Target account ID cannot be empty');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    const event: TransferEvent = {
      type: 'transfer',
      amount,
      targetAccountId,
      timestamp: new Date(),
    };
    this.events.push(event);
    this.balance -= amount;
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }

  reconstructFromEvents(events: AccountEvent[]): void {
    this.balance = 0;
    this.events = [...events];

    for (const event of this.events) {
      if (event.type === 'deposit') {
        this.balance += event.amount;
      } else if (event.type === 'withdraw') {
        this.balance -= event.amount;
      } else if (event.type === 'transfer') {
        this.balance -= event.amount;
      }
    }
  }
}