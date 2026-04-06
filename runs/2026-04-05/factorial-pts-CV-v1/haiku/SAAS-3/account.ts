type AccountEvent = 
  | { type: 'Deposited'; amount: number; timestamp: number }
  | { type: 'Withdrawn'; amount: number; timestamp: number }
  | { type: 'Transferred'; amount: number; to: string; timestamp: number };

class Account {
  private balance: number = 0;
  private events: AccountEvent[] = [];
  private accountId: string;

  constructor(accountId: string) {
    if (!accountId || typeof accountId !== 'string') {
      throw new Error('Account ID must be a non-empty string');
    }
    this.accountId = accountId;
  }

  deposit(amount: number): void {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('Amount must be a valid number');
    }
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    const event: AccountEvent = {
      type: 'Deposited',
      amount,
      timestamp: Date.now()
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  withdraw(amount: number): void {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('Amount must be a valid number');
    }
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }

    const event: AccountEvent = {
      type: 'Withdrawn',
      amount,
      timestamp: Date.now()
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  transfer(amount: number, toAccountId: string): void {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('Amount must be a valid number');
    }
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    if (typeof toAccountId !== 'string' || !toAccountId.trim()) {
      throw new Error('Recipient account ID must be a non-empty string');
    }
    if (toAccountId === this.accountId) {
      throw new Error('Cannot transfer to the same account');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }

    const event: AccountEvent = {
      type: 'Transferred',
      amount,
      to: toAccountId,
      timestamp: Date.now()
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }

  loadEvents(events: AccountEvent[]): void {
    if (!Array.isArray(events)) {
      throw new Error('Events must be an array');
    }
    this.events = [];
    this.balance = 0;
    for (const event of events) {
      this.applyEvent(event);
      this.events.push(event);
    }
  }

  private applyEvent(event: AccountEvent): void {
    switch (event.type) {
      case 'Deposited':
        this.balance += event.amount;
        break;
      case 'Withdrawn':
        this.balance -= event.amount;
        break;
      case 'Transferred':
        this.balance -= event.amount;
        break;
    }
  }
}

function reconstructAccount(accountId: string, events: AccountEvent[]): Account {
  const account = new Account(accountId);
  account.loadEvents(events);
  return account;
}

export { Account, AccountEvent, reconstructAccount };