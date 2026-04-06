interface Event {
  type: string;
  timestamp?: number;
  amount?: number;
  fromAccountId?: string;
  toAccountId?: string;
}

class DepositedEvent implements Event {
  type = 'DEPOSITED';
  timestamp: number;
  amount: number;

  constructor(amount: number) {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Deposit amount must be a positive number');
    }
    this.amount = amount;
    this.timestamp = Date.now();
  }
}

class WithdrewEvent implements Event {
  type = 'WITHDREW';
  timestamp: number;
  amount: number;

  constructor(amount: number) {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Withdrawal amount must be a positive number');
    }
    this.amount = amount;
    this.timestamp = Date.now();
  }
}

class TransferredEvent implements Event {
  type = 'TRANSFERRED';
  timestamp: number;
  amount: number;
  fromAccountId: string;
  toAccountId: string;

  constructor(fromAccountId: string, toAccountId: string, amount: number) {
    if (typeof fromAccountId !== 'string' || !fromAccountId) {
      throw new Error('From account ID must be a non-empty string');
    }
    if (typeof toAccountId !== 'string' || !toAccountId) {
      throw new Error('To account ID must be a non-empty string');
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Transfer amount must be a positive number');
    }
    this.fromAccountId = fromAccountId;
    this.toAccountId = toAccountId;
    this.amount = amount;
    this.timestamp = Date.now();
  }
}

export class Account {
  private id: string;
  private balance: number = 0;
  private events: Event[] = [];

  constructor(id: string) {
    if (typeof id !== 'string' || !id) {
      throw new Error('Account ID must be a non-empty string');
    }
    this.id = id;
  }

  getId(): string {
    return this.id;
  }

  deposit(amount: number): void {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Deposit amount must be a positive number');
    }
    const event = new DepositedEvent(amount);
    this.balance += event.amount;
    this.events.push(event);
  }

  withdraw(amount: number): void {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Withdrawal amount must be a positive number');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient balance for withdrawal');
    }
    const event = new WithdrewEvent(amount);
    this.balance -= event.amount;
    this.events.push(event);
  }

  transfer(toAccountId: string, amount: number): void {
    if (typeof toAccountId !== 'string' || !toAccountId) {
      throw new Error('Recipient account ID must be a non-empty string');
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Transfer amount must be a positive number');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient balance for transfer');
    }
    const event = new TransferredEvent(this.id, toAccountId, amount);
    this.balance -= event.amount;
    this.events.push(event);
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): Event[] {
    return [...this.events];
  }

  loadFromEvents(events: Event[]): void {
    if (!Array.isArray(events)) {
      throw new Error('Events must be an array');
    }
    this.balance = 0;
    this.events = [];
    for (const event of events) {
      this.validateEvent(event);
      this.applyEvent(event);
      this.events.push(event);
    }
  }

  private validateEvent(event: Event): void {
    if (!event || typeof event !== 'object') {
      throw new Error('Event must be a valid object');
    }
    if (typeof event.type !== 'string') {
      throw new Error('Event type must be a string');
    }
    if (event.type === 'DEPOSITED' || event.type === 'WITHDREW') {
      if (typeof event.amount !== 'number' || event.amount <= 0) {
        throw new Error(`Invalid amount in ${event.type} event`);
      }
    } else if (event.type === 'TRANSFERRED') {
      if (typeof event.amount !== 'number' || event.amount <= 0) {
        throw new Error('Invalid amount in TRANSFERRED event');
      }
      if (typeof event.fromAccountId !== 'string' || !event.fromAccountId) {
        throw new Error('Invalid fromAccountId in TRANSFERRED event');
      }
      if (typeof event.toAccountId !== 'string' || !event.toAccountId) {
        throw new Error('Invalid toAccountId in TRANSFERRED event');
      }
    } else {
      throw new Error(`Unknown event type: ${event.type}`);
    }
  }

  private applyEvent(event: Event): void {
    switch (event.type) {
      case 'DEPOSITED':
        this.balance += event.amount!;
        break;
      case 'WITHDREW':
        this.balance -= event.amount!;
        break;
      case 'TRANSFERRED':
        if (event.fromAccountId === this.id) {
          this.balance -= event.amount!;
        } else if (event.toAccountId === this.id) {
          this.balance += event.amount!;
        }
        break;
    }
  }
}

export { DepositedEvent, WithdrewEvent, TransferredEvent };
export type { Event };