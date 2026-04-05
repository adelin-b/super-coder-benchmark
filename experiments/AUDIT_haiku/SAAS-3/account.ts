// Event types
interface Event {
  timestamp: Date;
  type: string;
}

interface AccountCreatedEvent extends Event {
  type: 'ACCOUNT_CREATED';
  accountId: string;
  initialBalance: number;
}

interface DepositedEvent extends Event {
  type: 'DEPOSITED';
  amount: number;
}

interface WithdrewEvent extends Event {
  type: 'WITHDREW';
  amount: number;
}

interface TransferredEvent extends Event {
  type: 'TRANSFERRED';
  amount: number;
  toAccountId: string;
}

type DomainEvent = AccountCreatedEvent | DepositedEvent | WithdrewEvent | TransferredEvent;

// Account state
interface AccountState {
  accountId: string;
  balance: number;
}

// Account aggregate
class Account {
  private accountId: string;
  private balance: number;
  private events: DomainEvent[] = [];

  constructor(accountId: string, initialBalance: number = 0) {
    this.accountId = accountId;
    this.balance = 0;

    if (initialBalance > 0) {
      const event: AccountCreatedEvent = {
        timestamp: new Date(),
        type: 'ACCOUNT_CREATED',
        accountId,
        initialBalance
      };
      this.applyEvent(event);
      this.events.push(event);
    }
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    const event: DepositedEvent = {
      timestamp: new Date(),
      type: 'DEPOSITED',
      amount
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }

    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }

    const event: WithdrewEvent = {
      timestamp: new Date(),
      type: 'WITHDREW',
      amount
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  transfer(toAccountId: string, amount: number): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }

    const event: TransferredEvent = {
      timestamp: new Date(),
      type: 'TRANSFERRED',
      amount,
      toAccountId
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  private applyEvent(event: DomainEvent): void {
    switch (event.type) {
      case 'ACCOUNT_CREATED':
        this.balance = event.initialBalance;
        break;
      case 'DEPOSITED':
        this.balance += event.amount;
        break;
      case 'WITHDREW':
        this.balance -= event.amount;
        break;
      case 'TRANSFERRED':
        this.balance -= event.amount;
        break;
    }
  }

  getState(): AccountState {
    return {
      accountId: this.accountId,
      balance: this.balance
    };
  }

  getEvents(): DomainEvent[] {
    return [...this.events];
  }

  getBalance(): number {
    return this.balance;
  }

  getAccountId(): string {
    return this.accountId;
  }

  static reconstruct(accountId: string, events: DomainEvent[]): Account {
    const account = new Account(accountId, 0);
    account.events = [];
    account.balance = 0;

    for (const event of events) {
      account.applyEvent(event);
      account.events.push(event);
    }

    return account;
  }
}

export {
  Account,
  DomainEvent,
  AccountCreatedEvent,
  DepositedEvent,
  WithdrewEvent,
  TransferredEvent,
  AccountState,
  Event
};