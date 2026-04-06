type AccountEvent = 
  | { type: 'Deposited'; amount: number }
  | { type: 'Withdrew'; amount: number }
  | { type: 'Transferred'; amount: number; to: string };

export class Account {
  private balance: number = 0;
  private events: AccountEvent[] = [];
  private id: string;

  constructor(id: string) {
    this.id = id;
  }

  deposit(amount: number): void {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    const event: AccountEvent = { type: 'Deposited', amount };
    this.applyEvent(event);
    this.events.push(event);
  }

  withdraw(amount: number): void {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }

    const event: AccountEvent = { type: 'Withdrew', amount };
    this.applyEvent(event);
    this.events.push(event);
  }

  transfer(amount: number, to: string): void {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }
    if (typeof to !== 'string' || to.trim() === '') {
      throw new Error('Target account must be a non-empty string');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }

    const event: AccountEvent = { type: 'Transferred', amount, to };
    this.applyEvent(event);
    this.events.push(event);
  }

  private applyEvent(event: AccountEvent): void {
    switch (event.type) {
      case 'Deposited':
        this.balance += event.amount;
        break;
      case 'Withdrew':
        this.balance -= event.amount;
        break;
      case 'Transferred':
        this.balance -= event.amount;
        break;
    }
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }

  loadFromHistory(events: AccountEvent[]): void {
    this.balance = 0;
    this.events = [];
    for (const event of events) {
      this.applyEvent(event);
      this.events.push(event);
    }
  }
}

export type { AccountEvent };