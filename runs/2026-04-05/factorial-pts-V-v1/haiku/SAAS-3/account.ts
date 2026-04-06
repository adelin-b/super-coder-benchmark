interface Event {
  id: string;
  aggregateId: string;
  timestamp: Date;
  type: string;
  data: unknown;
}

interface DepositEvent extends Event {
  type: 'Deposit';
  data: {
    amount: number;
  };
}

interface WithdrawEvent extends Event {
  type: 'Withdraw';
  data: {
    amount: number;
  };
}

interface TransferEvent extends Event {
  type: 'Transfer';
  data: {
    amount: number;
    fromAccountId: string;
    toAccountId: string;
  };
}

class Account {
  private id: string;
  private balance: number = 0;
  private events: Event[] = [];

  constructor(id: string) {
    this.id = id;
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    const event: DepositEvent = {
      id: this.generateEventId(),
      aggregateId: this.id,
      timestamp: new Date(),
      type: 'Deposit',
      data: { amount },
    };

    this.apply(event);
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
      id: this.generateEventId(),
      aggregateId: this.id,
      timestamp: new Date(),
      type: 'Withdraw',
      data: { amount },
    };

    this.apply(event);
    this.events.push(event);
  }

  transfer(amount: number, toAccountId: string): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }

    const event: TransferEvent = {
      id: this.generateEventId(),
      aggregateId: this.id,
      timestamp: new Date(),
      type: 'Transfer',
      data: { amount, fromAccountId: this.id, toAccountId },
    };

    this.apply(event);
    this.events.push(event);
  }

  loadFromEvents(events: Event[]): void {
    this.balance = 0;
    this.events = [];
    events.forEach((event) => {
      this.apply(event);
      this.events.push(event);
    });
  }

  private apply(event: Event): void {
    switch (event.type) {
      case 'Deposit':
        this.balance += (event as DepositEvent).data.amount;
        break;
      case 'Withdraw':
        this.balance -= (event as WithdrawEvent).data.amount;
        break;
      case 'Transfer':
        this.balance -= (event as TransferEvent).data.amount;
        break;
    }
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): Event[] {
    return [...this.events];
  }

  getId(): string {
    return this.id;
  }

  private generateEventId(): string {
    return `${this.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export { Account, Event, DepositEvent, WithdrawEvent, TransferEvent };