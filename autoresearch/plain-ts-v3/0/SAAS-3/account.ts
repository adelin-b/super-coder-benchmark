// Event types
interface DomainEvent {
  id: string;
  timestamp: Date;
  aggregateId: string;
  version: number;
}

interface AccountCreatedEvent extends DomainEvent {
  type: 'AccountCreated';
  initialBalance: number;
}

interface DepositedEvent extends DomainEvent {
  type: 'Deposited';
  amount: number;
}

interface WithdrawnEvent extends DomainEvent {
  type: 'Withdrawn';
  amount: number;
}

interface TransferredEvent extends DomainEvent {
  type: 'Transferred';
  amount: number;
  toAccountId: string;
}

interface TransferReceivedEvent extends DomainEvent {
  type: 'TransferReceived';
  amount: number;
  fromAccountId: string;
}

type AccountEvent =
  | AccountCreatedEvent
  | DepositedEvent
  | WithdrawnEvent
  | TransferredEvent
  | TransferReceivedEvent;

// Custom errors
class InsufficientFundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientFundsError';
    Object.setPrototypeOf(this, InsufficientFundsError.prototype);
  }
}

class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAmountError';
    Object.setPrototypeOf(this, InvalidAmountError.prototype);
  }
}

class AccountNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountNotFoundError';
    Object.setPrototypeOf(this, AccountNotFoundError.prototype);
  }
}

// Account aggregate
class Account {
  private id: string;
  private balance: number = 0;
  private events: AccountEvent[] = [];
  private version: number = 0;

  constructor(id: string) {
    this.id = id;
  }

  getId(): string {
    return this.id;
  }

  getBalance(): number {
    return this.balance;
  }

  getVersion(): number {
    return this.version;
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }

  deposit(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError('Deposit amount must be positive');
    }

    const event: DepositedEvent = {
      id: this.generateEventId(),
      type: 'Deposited',
      timestamp: new Date(),
      aggregateId: this.id,
      version: this.version + 1,
      amount,
    };

    this.applyEvent(event);
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError('Withdrawal amount must be positive');
    }

    if (this.balance < amount) {
      throw new InsufficientFundsError(
        `Insufficient funds. Current balance: ${this.balance}, requested: ${amount}`
      );
    }

    const event: WithdrawnEvent = {
      id: this.generateEventId(),
      type: 'Withdrawn',
      timestamp: new Date(),
      aggregateId: this.id,
      version: this.version + 1,
      amount,
    };

    this.applyEvent(event);
  }

  transfer(amount: number, toAccountId: string): void {
    if (amount <= 0) {
      throw new InvalidAmountError('Transfer amount must be positive');
    }

    if (this.balance < amount) {
      throw new InsufficientFundsError(
        `Insufficient funds for transfer. Current balance: ${this.balance}, requested: ${amount}`
      );
    }

    if (!toAccountId || toAccountId.trim() === '') {
      throw new AccountNotFoundError('Target account ID must be provided');
    }

    const event: TransferredEvent = {
      id: this.generateEventId(),
      type: 'Transferred',
      timestamp: new Date(),
      aggregateId: this.id,
      version: this.version + 1,
      amount,
      toAccountId,
    };

    this.applyEvent(event);
  }

  receiveTransfer(amount: number, fromAccountId: string): void {
    if (amount <= 0) {
      throw new InvalidAmountError('Transfer amount must be positive');
    }

    const event: TransferReceivedEvent = {
      id: this.generateEventId(),
      type: 'TransferReceived',
      timestamp: new Date(),
      aggregateId: this.id,
      version: this.version + 1,
      amount,
      fromAccountId,
    };

    this.applyEvent(event);
  }

  loadFromEvents(events: AccountEvent[]): void {
    for (const event of events) {
      this.applyEvent(event);
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
      case 'TransferReceived':
        this.balance += event.amount;
        break;
      case 'AccountCreated':
        this.balance = event.initialBalance;
        break;
    }

    this.events.push(event);
    this.version = event.version;
  }

  private generateEventId(): string {
    return `${this.id}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

export {
  Account,
  InsufficientFundsError,
  InvalidAmountError,
  AccountNotFoundError,
  DomainEvent,
  AccountEvent,
  AccountCreatedEvent,
  DepositedEvent,
  WithdrawnEvent,
  TransferredEvent,
  TransferReceivedEvent,
};