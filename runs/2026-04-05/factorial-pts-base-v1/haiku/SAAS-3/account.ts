type AccountEvent = 
  | { type: 'AccountCreated'; accountId: string; initialBalance: number }
  | { type: 'Deposited'; accountId: string; amount: number }
  | { type: 'Withdrew'; accountId: string; amount: number }
  | { type: 'Transferred'; fromAccountId: string; toAccountId: string; amount: number };

class Account {
  private accountId: string;
  private balance: number;
  private events: AccountEvent[] = [];

  private constructor(accountId: string, initialBalance: number = 0) {
    this.accountId = accountId;
    this.balance = initialBalance;
  }

  static create(accountId: string, initialBalance: number = 0): Account {
    const account = new Account(accountId, initialBalance);
    account.events.push({
      type: 'AccountCreated',
      accountId,
      initialBalance,
    });
    return account;
  }

  private applyEvent(event: AccountEvent): void {
    switch (event.type) {
      case 'AccountCreated':
        this.balance = event.initialBalance;
        break;
      case 'Deposited':
        this.balance += event.amount;
        break;
      case 'Withdrew':
        this.balance -= event.amount;
        break;
      case 'Transferred':
        if (event.fromAccountId === this.accountId) {
          this.balance -= event.amount;
        } else if (event.toAccountId === this.accountId) {
          this.balance += event.amount;
        }
        break;
    }
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    const event: AccountEvent = {
      type: 'Deposited',
      accountId: this.accountId,
      amount,
    };
    this.events.push(event);
    this.applyEvent(event);
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    const event: AccountEvent = {
      type: 'Withdrew',
      accountId: this.accountId,
      amount,
    };
    this.events.push(event);
    this.applyEvent(event);
  }

  transfer(toAccountId: string, amount: number): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    const event: AccountEvent = {
      type: 'Transferred',
      fromAccountId: this.accountId,
      toAccountId,
      amount,
    };
    this.events.push(event);
    this.applyEvent(event);
  }

  getBalance(): number {
    return this.balance;
  }

  getAccountId(): string {
    return this.accountId;
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }

  static fromEvents(accountId: string, events: AccountEvent[]): Account {
    const account = new Account(accountId, 0);
    
    for (const event of events) {
      account.applyEvent(event);
      account.events.push(event);
    }

    return account;
  }
}

export { Account, AccountEvent };