export type AccountEvent = 
  | { type: 'AccountOpened'; accountId: string; initialBalance: number }
  | { type: 'MoneyDeposited'; amount: number; timestamp: Date }
  | { type: 'MoneyWithdrawn'; amount: number; timestamp: Date }
  | { type: 'MoneyTransferred'; amount: number; recipientId: string; timestamp: Date };

export class Account {
  private accountId: string;
  private balance: number = 0;
  private events: AccountEvent[] = [];

  constructor(accountId: string, initialBalance: number = 0) {
    this.accountId = accountId;
    if (initialBalance < 0) {
      throw new Error('Initial balance cannot be negative');
    }
    if (initialBalance > 0) {
      const event: AccountEvent = {
        type: 'AccountOpened',
        accountId,
        initialBalance
      };
      this.events.push(event);
      this.balance = initialBalance;
    }
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    this.balance += amount;
    this.events.push({
      type: 'MoneyDeposited',
      amount,
      timestamp: new Date()
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
    this.events.push({
      type: 'MoneyWithdrawn',
      amount,
      timestamp: new Date()
    });
  }

  transfer(amount: number, toAccount: Account): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    this.balance -= amount;
    this.events.push({
      type: 'MoneyTransferred',
      amount,
      recipientId: toAccount.accountId,
      timestamp: new Date()
    });
    toAccount.balance += amount;
    toAccount.events.push({
      type: 'MoneyDeposited',
      amount,
      timestamp: new Date()
    });
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }

  static fromEvents(accountId: string, events: AccountEvent[]): Account {
    const account = new Account(accountId, 0);
    account.events = [];
    account.balance = 0;

    for (const event of events) {
      switch (event.type) {
        case 'AccountOpened':
          account.balance = event.initialBalance;
          break;
        case 'MoneyDeposited':
          account.balance += event.amount;
          break;
        case 'MoneyWithdrawn':
          account.balance -= event.amount;
          break;
        case 'MoneyTransferred':
          account.balance -= event.amount;
          break;
      }
      account.events.push(event);
    }

    return account;
  }
}