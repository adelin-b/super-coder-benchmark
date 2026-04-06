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

export class Account {
  private id: string;
  private events: AccountEvent[] = [];

  constructor(id: string, events: AccountEvent[] = []) {
    if (!id || typeof id !== 'string') {
      throw new Error('Account ID must be a non-empty string');
    }
    this.id = id;
    this.events = [...events];
  }

  deposit(amount: number): void {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Deposit amount must be a positive number');
    }
    this.events.push({
      type: 'deposit',
      amount,
      timestamp: new Date()
    });
  }

  withdraw(amount: number): void {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Withdraw amount must be a positive number');
    }
    const balance = this.getBalance();
    if (balance < amount) {
      throw new Error('Insufficient funds');
    }
    this.events.push({
      type: 'withdraw',
      amount,
      timestamp: new Date()
    });
  }

  transfer(toAccountId: string, amount: number): void {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Transfer amount must be a positive number');
    }
    if (!toAccountId || typeof toAccountId !== 'string') {
      throw new Error('Recipient account ID must be a non-empty string');
    }
    const balance = this.getBalance();
    if (balance < amount) {
      throw new Error('Insufficient funds');
    }
    this.events.push({
      type: 'transfer',
      fromAccountId: this.id,
      toAccountId,
      amount,
      timestamp: new Date()
    });
  }

  getBalance(): number {
    return this.events.reduce((balance, event) => {
      switch (event.type) {
        case 'deposit':
          return balance + event.amount;
        case 'withdraw':
          return balance - event.amount;
        case 'transfer':
          if (event.fromAccountId === this.id) {
            return balance - event.amount;
          } else if (event.toAccountId === this.id) {
            return balance + event.amount;
          }
          return balance;
        default:
          return balance;
      }
    }, 0);
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }
}