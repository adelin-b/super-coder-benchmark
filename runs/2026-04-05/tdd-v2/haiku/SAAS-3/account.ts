// Event types
export interface Event {
  type: string;
  timestamp: Date;
  accountId: string;
}

export interface DepositEvent extends Event {
  type: 'DEPOSIT';
  amount: number;
}

export interface WithdrawEvent extends Event {
  type: 'WITHDRAW';
  amount: number;
}

export interface TransferEvent extends Event {
  type: 'TRANSFER';
  fromAccountId: string;
  toAccountId: string;
  amount: number;
}

export type BankEvent = DepositEvent | WithdrawEvent | TransferEvent;

// Account state
export interface AccountState {
  id: string;
  balance: number;
  events: BankEvent[];
}

// Account aggregate
export class Account {
  private id: string;
  private balance: number;
  private events: BankEvent[] = [];

  constructor(id: string, initialBalance: number = 0) {
    this.id = id;
    this.balance = initialBalance;
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    const event: DepositEvent = {
      type: 'DEPOSIT',
      timestamp: new Date(),
      accountId: this.id,
      amount,
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

    const event: WithdrawEvent = {
      type: 'WITHDRAW',
      timestamp: new Date(),
      accountId: this.id,
      amount,
    };

    this.applyEvent(event);
    this.events.push(event);
  }

  transfer(toAccountId: string, amount: number, targetAccount: Account): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }

    const event: TransferEvent = {
      type: 'TRANSFER',
      timestamp: new Date(),
      fromAccountId: this.id,
      toAccountId,
      amount,
    };

    this.applyEvent(event);
    this.events.push(event);

    const depositEvent: DepositEvent = {
      type: 'DEPOSIT',
      timestamp: new Date(),
      accountId: toAccountId,
      amount,
    };

    targetAccount.applyEvent(depositEvent);
    targetAccount.events.push(depositEvent);
  }

  private applyEvent(event: BankEvent): void {
    if (event.type === 'DEPOSIT') {
      this.balance += (event as DepositEvent).amount;
    } else if (event.type === 'WITHDRAW') {
      this.balance -= (event as WithdrawEvent).amount;
    } else if (event.type === 'TRANSFER') {
      const transferEvent = event as TransferEvent;
      if (transferEvent.fromAccountId === this.id) {
        this.balance -= transferEvent.amount;
      } else if (transferEvent.toAccountId === this.id) {
        this.balance += transferEvent.amount;
      }
    }
  }

  getBalance(): number {
    return this.balance;
  }

  getId(): string {
    return this.id;
  }

  getEvents(): BankEvent[] {
    return [...this.events];
  }

  getState(): AccountState {
    return {
      id: this.id,
      balance: this.balance,
      events: [...this.events],
    };
  }

  loadFromEvents(events: BankEvent[]): void {
    this.balance = 0;
    this.events = [];

    for (const event of events) {
      this.applyEvent(event);
      this.events.push(event);
    }
  }

  static reconstructFromEvents(
    id: string,
    events: BankEvent[]
  ): Account {
    const account = new Account(id, 0);
    account.loadFromEvents(events);
    return account;
  }
}