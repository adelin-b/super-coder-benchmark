interface Event {
  type: string;
  timestamp: Date;
}

interface DepositedEvent extends Event {
  type: 'deposited';
  amount: number;
}

interface WithdrewEvent extends Event {
  type: 'withdrew';
  amount: number;
}

interface TransferredEvent extends Event {
  type: 'transferred';
  amount: number;
  toAccountId: string;
}

type AccountEvent = DepositedEvent | WithdrewEvent | TransferredEvent;

class Account {
  private events: AccountEvent[] = [];
  private balance: number = 0;

  constructor(private accountId: string) {}

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    const event: DepositedEvent = {
      type: 'deposited',
      amount,
      timestamp: new Date()
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
    const event: WithdrewEvent = {
      type: 'withdrew',
      amount,
      timestamp: new Date()
    };
    this.events.push(event);
    this.balance -= amount;
  }

  transfer(amount: number, toAccountId: string): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    if (!toAccountId) {
      throw new Error('Recipient account ID is required');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    const event: TransferredEvent = {
      type: 'transferred',
      amount,
      toAccountId,
      timestamp: new Date()
    };
    this.events.push(event);
    this.balance -= amount;
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): ReadonlyArray<AccountEvent> {
    return [...this.events];
  }

  static fromEvents(accountId: string, events: AccountEvent[]): Account {
    const account = new Account(accountId);
    account.events = [];
    account.balance = 0;

    for (const event of events) {
      if (event.type === 'deposited') {
        account.balance += (event as DepositedEvent).amount;
      } else if (event.type === 'withdrew') {
        account.balance -= (event as WithdrewEvent).amount;
      } else if (event.type === 'transferred') {
        account.balance -= (event as TransferredEvent).amount;
      }
    }

    account.events = [...events];
    return account;
  }
}

export { Account, Event, DepositedEvent, WithdrewEvent, TransferredEvent, AccountEvent };