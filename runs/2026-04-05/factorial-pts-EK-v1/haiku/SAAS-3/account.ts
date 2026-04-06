type AccountEvent = 
  | { type: 'AccountCreated'; accountId: string; initialBalance: number }
  | { type: 'Deposited'; amount: number; timestamp: Date }
  | { type: 'Withdrawn'; amount: number; timestamp: Date }
  | { type: 'Transferred'; toAccountId: string; amount: number; timestamp: Date }
  | { type: 'TransferReceived'; fromAccountId: string; amount: number; timestamp: Date };

class Account {
  private accountId: string;
  private balance: number;
  private events: AccountEvent[];

  constructor(accountId: string, initialBalance: number = 0) {
    if (!accountId || accountId.trim() === '') {
      throw new Error('Account ID cannot be empty');
    }
    if (initialBalance < 0) {
      throw new Error('Initial balance cannot be negative');
    }
    
    this.accountId = accountId;
    this.balance = initialBalance;
    this.events = [{
      type: 'AccountCreated',
      accountId,
      initialBalance
    }];
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    
    this.balance += amount;
    this.events.push({
      type: 'Deposited',
      amount,
      timestamp: new Date()
    });
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient balance');
    }
    
    this.balance -= amount;
    this.events.push({
      type: 'Withdrawn',
      amount,
      timestamp: new Date()
    });
  }

  transfer(toAccountId: string, amount: number, toAccount: Account): void {
    if (!toAccountId || toAccountId.trim() === '') {
      throw new Error('Target account ID cannot be empty');
    }
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient balance');
    }
    if (toAccount.accountId !== toAccountId) {
      throw new Error('Target account ID mismatch');
    }

    this.balance -= amount;
    this.events.push({
      type: 'Transferred',
      toAccountId,
      amount,
      timestamp: new Date()
    });

    toAccount.balance += amount;
    toAccount.events.push({
      type: 'TransferReceived',
      fromAccountId: this.accountId,
      amount,
      timestamp: new Date()
    });
  }

  getBalance(): number {
    return this.balance;
  }

  getHistory(): AccountEvent[] {
    return [...this.events];
  }

  static fromEvents(accountId: string, events: AccountEvent[]): Account {
    if (!accountId || accountId.trim() === '') {
      throw new Error('Account ID cannot be empty');
    }
    if (!events || events.length === 0) {
      throw new Error('Events cannot be empty');
    }

    const account = Object.create(Account.prototype);
    account.accountId = accountId;
    account.balance = 0;
    account.events = [];

    for (const event of events) {
      if (event.type === 'AccountCreated') {
        if (event.initialBalance < 0) {
          throw new Error('Invalid event: negative initial balance');
        }
        account.balance = event.initialBalance;
      } else if (event.type === 'Deposited') {
        if (event.amount <= 0) {
          throw new Error('Invalid event: non-positive deposit');
        }
        account.balance += event.amount;
      } else if (event.type === 'Withdrawn') {
        if (event.amount <= 0) {
          throw new Error('Invalid event: non-positive withdrawal');
        }
        account.balance -= event.amount;
      } else if (event.type === 'TransferReceived') {
        if (event.amount <= 0) {
          throw new Error('Invalid event: non-positive transfer received');
        }
        account.balance += event.amount;
      } else if (event.type === 'Transferred') {
        if (event.amount <= 0) {
          throw new Error('Invalid event: non-positive transfer');
        }
        account.balance -= event.amount;
      }
    }

    if (account.balance < 0) {
      throw new Error('Event replay resulted in negative balance');
    }

    account.events = events;
    return account;
  }
}

export { Account, AccountEvent };