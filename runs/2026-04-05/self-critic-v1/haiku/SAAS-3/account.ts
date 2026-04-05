// Event types
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
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  timestamp: Date;
};

export type AccountEvent = DepositEvent | WithdrawEvent | TransferEvent;

// Custom error classes
export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAmountError';
  }
}

export class InsufficientFundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientFundsError';
  }
}

// Account aggregate
export class Account {
  private id: string;
  private balance: number = 0;
  private events: AccountEvent[] = [];

  constructor(id: string) {
    this.id = id;
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError('Deposit amount must be positive');
    }

    const event: DepositEvent = {
      type: 'deposit',
      amount,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError('Withdraw amount must be positive');
    }

    if (this.balance < amount) {
      throw new InsufficientFundsError('Insufficient funds');
    }

    const event: WithdrawEvent = {
      type: 'withdraw',
      amount,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  transfer(toAccountId: string, amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError('Transfer amount must be positive');
    }

    if (this.balance < amount) {
      throw new InsufficientFundsError('Insufficient funds');
    }

    const event: TransferEvent = {
      type: 'transfer',
      fromAccountId: this.id,
      toAccountId,
      amount,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  private applyEvent(event: AccountEvent): void {
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

  getId(): string {
    return this.id;
  }

  getEvents(): readonly AccountEvent[] {
    return Object.freeze([...this.events]);
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