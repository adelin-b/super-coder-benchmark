// Error classes
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

// Event types
export interface DepositEvent {
  type: 'Deposit';
  accountId: string;
  amount: number;
  timestamp: number;
}

export interface WithdrawEvent {
  type: 'Withdraw';
  accountId: string;
  amount: number;
  timestamp: number;
}

export interface TransferEvent {
  type: 'Transfer';
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  timestamp: number;
}

export type AccountEvent = DepositEvent | WithdrawEvent | TransferEvent;

// Account aggregate
export class Account {
  private accountId: string;
  private events: AccountEvent[] = [];
  private balance: number = 0;

  constructor(accountId: string, initialEvents: AccountEvent[] = []) {
    if (!accountId || typeof accountId !== 'string') {
      throw new Error('Account ID is required');
    }
    this.accountId = accountId;
    for (const event of initialEvents) {
      this.applyEvent(event);
    }
  }

  private applyEvent(event: AccountEvent): void {
    if (event.type === 'Deposit' && event.accountId === this.accountId) {
      if (!Number.isFinite(event.amount) || event.amount <= 0) {
        throw new InvalidAmountError('Deposit amount must be positive and finite');
      }
      this.balance += event.amount;
      this.events.push(event);
    } else if (event.type === 'Withdraw' && event.accountId === this.accountId) {
      if (!Number.isFinite(event.amount) || event.amount <= 0) {
        throw new InvalidAmountError('Withdrawal amount must be positive and finite');
      }
      if (this.balance < event.amount) {
        throw new InsufficientFundsError('Insufficient funds for withdrawal');
      }
      this.balance -= event.amount;
      this.events.push(event);
    } else if (event.type === 'Transfer') {
      if (event.fromAccountId === this.accountId) {
        if (!Number.isFinite(event.amount) || event.amount <= 0) {
          throw new InvalidAmountError('Transfer amount must be positive and finite');
        }
        if (this.balance < event.amount) {
          throw new InsufficientFundsError('Insufficient funds for transfer');
        }
        this.balance -= event.amount;
        this.events.push(event);
      } else if (event.toAccountId === this.accountId) {
        if (!Number.isFinite(event.amount) || event.amount <= 0) {
          throw new InvalidAmountError('Transfer amount must be positive and finite');
        }
        this.balance += event.amount;
        this.events.push(event);
      }
    }
  }

  deposit(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new InvalidAmountError('Deposit amount must be positive and finite');
    }
    const event: DepositEvent = {
      type: 'Deposit',
      accountId: this.accountId,
      amount,
      timestamp: Date.now()
    };
    this.applyEvent(event);
  }

  withdraw(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new InvalidAmountError('Withdrawal amount must be positive and finite');
    }
    if (this.balance < amount) {
      throw new InsufficientFundsError('Insufficient funds for withdrawal');
    }
    const event: WithdrawEvent = {
      type: 'Withdraw',
      accountId: this.accountId,
      amount,
      timestamp: Date.now()
    };
    this.applyEvent(event);
  }

  transfer(toAccountId: string, amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new InvalidAmountError('Transfer amount must be positive and finite');
    }
    if (!toAccountId || typeof toAccountId !== 'string') {
      throw new Error('Target account ID is required');
    }
    if (this.balance < amount) {
      throw new InsufficientFundsError('Insufficient funds for transfer');
    }
    const event: TransferEvent = {
      type: 'Transfer',
      fromAccountId: this.accountId,
      toAccountId,
      amount,
      timestamp: Date.now()
    };
    this.applyEvent(event);
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): AccountEvent[] {
    return [...this.events];
  }

  getAccountId(): string {
    return this.accountId;
  }
}

export function createAccount(
  accountId: string,
  initialEvents: AccountEvent[] = []
): Account {
  return new Account(accountId, initialEvents);
}