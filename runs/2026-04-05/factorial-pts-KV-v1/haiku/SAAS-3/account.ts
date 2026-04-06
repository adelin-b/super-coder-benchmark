export type Event = 
  | { type: 'Deposited'; amount: number; timestamp: Date }
  | { type: 'Withdrawn'; amount: number; timestamp: Date }
  | { type: 'TransferredOut'; amount: number; recipientId: string; timestamp: Date }
  | { type: 'TransferredIn'; amount: number; senderId: string; timestamp: Date };

export class BankAccount {
  private id: string;
  private balance: number;
  private events: Event[] = [];

  constructor(id: string, initialBalance: number = 0) {
    this.id = id;
    this.balance = initialBalance;
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
    if (amount > this.balance) {
      throw new Error('Insufficient balance');
    }
    this.balance -= amount;
    this.events.push({
      type: 'Withdrawn',
      amount,
      timestamp: new Date()
    });
  }

  transfer(amount: number, recipientId: string): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    if (amount > this.balance) {
      throw new Error('Insufficient balance');
    }
    this.balance -= amount;
    this.events.push({
      type: 'TransferredOut',
      amount,
      recipientId,
      timestamp: new Date()
    });
  }

  receiveTransfer(amount: number, senderId: string): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    this.balance += amount;
    this.events.push({
      type: 'TransferredIn',
      amount,
      senderId,
      timestamp: new Date()
    });
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): Event[] {
    return [...this.events];
  }

  static fromEvents(id: string, events: Event[]): BankAccount {
    const account = new BankAccount(id, 0);
    for (const event of events) {
      if (event.type === 'Deposited') {
        account.balance += event.amount;
      } else if (event.type === 'Withdrawn') {
        account.balance -= event.amount;
      } else if (event.type === 'TransferredOut') {
        account.balance -= event.amount;
      } else if (event.type === 'TransferredIn') {
        account.balance += event.amount;
      }
      account.events.push(event);
    }
    return account;
  }
}