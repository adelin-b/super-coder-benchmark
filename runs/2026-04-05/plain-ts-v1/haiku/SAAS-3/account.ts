// Event types
type DepositedEvent = {
  type: 'Deposited';
  amount: number;
  timestamp: Date;
};

type WithdrawnEvent = {
  type: 'Withdrawn';
  amount: number;
  timestamp: Date;
};

type TransferredOutEvent = {
  type: 'TransferredOut';
  amount: number;
  toAccountId: string;
  timestamp: Date;
};

type TransferredInEvent = {
  type: 'TransferredIn';
  amount: number;
  fromAccountId: string;
  timestamp: Date;
};

type AccountEvent = DepositedEvent | WithdrawnEvent | TransferredOutEvent | TransferredInEvent;

// Custom errors
class InsufficientFundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientFundsError';
  }
}

class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAmountError';
  }
}

// Account aggregate
class Account {
  private balance: number = 0;
  private events: AccountEvent[] = [];
  private accountId: string;

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError('Deposit amount must be positive');
    }

    const event: DepositedEvent = {
      type: 'Deposited',
      amount,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError('Withdrawal amount must be positive');
    }

    if (this.balance < amount) {
      throw new InsufficientFundsError('Insufficient funds for withdrawal');
    }

    const event: WithdrawnEvent = {
      type: 'Withdrawn',
      amount,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  transfer(amount: number, toAccountId: string): void {
    if (amount <= 0) {
      throw new InvalidAmountError('Transfer amount must be positive');
    }

    if (this.balance < amount) {
      throw new InsufficientFundsError('Insufficient funds for transfer');
    }

    const event: TransferredOutEvent = {
      type: 'TransferredOut',
      amount,
      toAccountId,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  receiveTransfer(amount: number, fromAccountId: string): void {
    if (amount <= 0) {
      throw new InvalidAmountError('Transfer amount must be positive');
    }

    const event: TransferredInEvent = {
      type: 'TransferredIn',
      amount,
      fromAccountId,
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
      case 'TransferredOut':
        this.balance -= event.amount;
        break;
      case 'TransferredIn':
        this.balance += event.amount;
        break;
    }
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }

  getAccountId(): string {
    return this.accountId;
  }

  static reconstructFromEvents(accountId: string, events: AccountEvent[]): Account {
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
  AccountEvent,
  DepositedEvent,
  WithdrawnEvent,
  TransferredOutEvent,
  TransferredInEvent,
  InsufficientFundsError,
  InvalidAmountError,
};