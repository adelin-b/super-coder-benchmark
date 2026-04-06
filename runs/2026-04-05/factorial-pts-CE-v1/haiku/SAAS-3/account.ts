interface Event {
  type: 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER';
  timestamp: Date;
  amount: number;
  fromAccountId?: string;
  toAccountId?: string;
}

class Account {
  private balance: number = 0;
  private accountId: string;
  private events: Event[] = [];

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    const event: Event = {
      type: 'DEPOSIT',
      amount,
      timestamp: new Date(),
    };
    this.applyEvent(event);
    this.events.push(event);
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new Error('Withdraw amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    const event: Event = {
      type: 'WITHDRAW',
      amount,
      timestamp: new Date(),
    };
    this.applyEvent(event);
    this.events.push(event);
  }

  transfer(amount: number, toAccount: Account): void {
    if (!toAccount) {
      throw new Error('Target account must be provided');
    }
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }

    const event: Event = {
      type: 'TRANSFER',
      amount,
      fromAccountId: this.accountId,
      toAccountId: toAccount.accountId,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    this.events.push(event);
    toAccount.applyEvent(event);
    toAccount.events.push(event);
  }

  private applyEvent(event: Event): void {
    switch (event.type) {
      case 'DEPOSIT':
        this.balance += event.amount;
        break;
      case 'WITHDRAW':
        this.balance -= event.amount;
        break;
      case 'TRANSFER':
        if (event.fromAccountId === this.accountId) {
          this.balance -= event.amount;
        } else if (event.toAccountId === this.accountId) {
          this.balance += event.amount;
        }
        break;
    }
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): Event[] {
    return [...this.events];
  }

  static fromEvents(accountId: string, events: Event[]): Account {
    const account = new Account(accountId);
    events.forEach((event) => {
      account.applyEvent(event);
    });
    account.events = [...events];
    return account;
  }
}

export { Account, Event };