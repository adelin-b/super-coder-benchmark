// Event types
export type AccountEvent = 
  | DepositEvent 
  | WithdrawEvent 
  | TransferSentEvent 
  | TransferReceivedEvent;

export interface DepositEvent {
  type: 'DEPOSIT';
  accountId: string;
  amount: number;
  timestamp: Date;
  id: string;
}

export interface WithdrawEvent {
  type: 'WITHDRAW';
  accountId: string;
  amount: number;
  timestamp: Date;
  id: string;
}

export interface TransferSentEvent {
  type: 'TRANSFER_SENT';
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  timestamp: Date;
  id: string;
  transferId: string;
}

export interface TransferReceivedEvent {
  type: 'TRANSFER_RECEIVED';
  toAccountId: string;
  fromAccountId: string;
  amount: number;
  timestamp: Date;
  id: string;
  transferId: string;
}

export interface AccountState {
  accountId: string;
  balance: number;
  version: number;
}

export class InsufficientFundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientFundsError';
  }
}

export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAmountError';
  }
}

export class BankAccount {
  private accountId: string;
  private balance: number = 0;
  private version: number = 0;
  private events: AccountEvent[] = [];

  constructor(accountId: string, initialEvents: AccountEvent[] = []) {
    this.accountId = accountId;
    this.loadFromEvents(initialEvents);
  }

  private loadFromEvents(events: AccountEvent[]): void {
    this.balance = 0;
    this.version = 0;
    this.events = [];

    for (const event of events) {
      this.applyEvent(event);
      this.version++;
    }
  }

  private applyEvent(event: AccountEvent): void {
    switch (event.type) {
      case 'DEPOSIT':
        if (event.accountId === this.accountId) {
          this.balance += event.amount;
        }
        break;
      case 'WITHDRAW':
        if (event.accountId === this.accountId) {
          this.balance -= event.amount;
        }
        break;
      case 'TRANSFER_SENT':
        if (event.fromAccountId === this.accountId) {
          this.balance -= event.amount;
        }
        break;
      case 'TRANSFER_RECEIVED':
        if (event.toAccountId === this.accountId) {
          this.balance += event.amount;
        }
        break;
    }
    this.events.push(event);
  }

  deposit(amount: number): DepositEvent {
    if (amount <= 0) {
      throw new InvalidAmountError('Deposit amount must be positive');
    }

    const event: DepositEvent = {
      type: 'DEPOSIT',
      accountId: this.accountId,
      amount,
      timestamp: new Date(),
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.applyEvent(event);
    this.version++;
    return event;
  }

  withdraw(amount: number): WithdrawEvent {
    if (amount <= 0) {
      throw new InvalidAmountError('Withdraw amount must be positive');
    }

    if (this.balance < amount) {
      throw new InsufficientFundsError(
        `Insufficient funds. Balance: ${this.balance}, Requested: ${amount}`
      );
    }

    const event: WithdrawEvent = {
      type: 'WITHDRAW',
      accountId: this.accountId,
      amount,
      timestamp: new Date(),
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.applyEvent(event);
    this.version++;
    return event;
  }

  transfer(toAccountId: string, amount: number): TransferSentEvent {
    if (amount <= 0) {
      throw new InvalidAmountError('Transfer amount must be positive');
    }

    if (this.balance < amount) {
      throw new InsufficientFundsError(
        `Insufficient funds for transfer. Balance: ${this.balance}, Requested: ${amount}`
      );
    }

    if (this.accountId === toAccountId) {
      throw new InvalidAmountError('Cannot transfer to the same account');
    }

    const transferId = `txf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const event: TransferSentEvent = {
      type: 'TRANSFER_SENT',
      fromAccountId: this.accountId,
      toAccountId,
      amount,
      timestamp: new Date(),
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transferId,
    };

    this.applyEvent(event);
    this.version++;
    return event;
  }

  getState(): AccountState {
    return {
      accountId: this.accountId,
      balance: this.balance,
      version: this.version,
    };
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }

  getBalance(): number {
    return this.balance;
  }

  getVersion(): number {
    return this.version;
  }

  static fromEvents(accountId: string, events: AccountEvent[]): BankAccount {
    return new BankAccount(accountId, events);
  }
}

export function reconstructAccountState(
  accountId: string,
  events: AccountEvent[]
): AccountState {
  const account = new BankAccount(accountId, events);
  return account.getState();
}