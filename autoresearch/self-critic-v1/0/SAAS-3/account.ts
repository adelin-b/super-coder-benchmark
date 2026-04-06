// Event types
export type AccountEvent =
  | { type: "AccountCreated"; accountId: string; initialBalance: number; timestamp: Date }
  | { type: "Deposited"; accountId: string; amount: number; timestamp: Date }
  | { type: "Withdrew"; accountId: string; amount: number; timestamp: Date }
  | { type: "TransferredOut"; accountId: string; amount: number; recipientId: string; timestamp: Date }
  | { type: "TransferredIn"; accountId: string; amount: number; senderId: string; timestamp: Date };

export class InsufficientFundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientFundsError";
  }
}

export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAmountError";
  }
}

export class AccountNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountNotFoundError";
  }
}

export interface AccountState {
  accountId: string;
  balance: number;
  createdAt: Date;
}

export class Account {
  private accountId: string;
  private balance: number = 0;
  private createdAt: Date;
  private events: AccountEvent[] = [];

  constructor(accountId: string, initialBalance: number = 0) {
    if (initialBalance < 0) {
      throw new InvalidAmountError("Initial balance cannot be negative");
    }
    this.accountId = accountId;
    this.balance = initialBalance;
    this.createdAt = new Date();
    this.events.push({
      type: "AccountCreated",
      accountId,
      initialBalance,
      timestamp: this.createdAt,
    });
  }

  public getState(): AccountState {
    return {
      accountId: this.accountId,
      balance: this.balance,
      createdAt: this.createdAt,
    };
  }

  public getEvents(): AccountEvent[] {
    return [...this.events];
  }

  public deposit(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError("Deposit amount must be positive");
    }
    this.balance += amount;
    this.events.push({
      type: "Deposited",
      accountId: this.accountId,
      amount,
      timestamp: new Date(),
    });
  }

  public withdraw(amount: number): void {
    if (amount <= 0) {
      throw new InvalidAmountError("Withdrawal amount must be positive");
    }
    if (this.balance < amount) {
      throw new InsufficientFundsError(
        `Insufficient funds. Current balance: ${this.balance}, requested: ${amount}`
      );
    }
    this.balance -= amount;
    this.events.push({
      type: "Withdrew",
      accountId: this.accountId,
      amount,
      timestamp: new Date(),
    });
  }

  public transferOut(amount: number, recipientId: string): void {
    if (amount <= 0) {
      throw new InvalidAmountError("Transfer amount must be positive");
    }
    if (this.balance < amount) {
      throw new InsufficientFundsError(
        `Insufficient funds. Current balance: ${this.balance}, requested: ${amount}`
      );
    }
    this.balance -= amount;
    this.events.push({
      type: "TransferredOut",
      accountId: this.accountId,
      amount,
      recipientId,
      timestamp: new Date(),
    });
  }

  public transferIn(amount: number, senderId: string): void {
    if (amount <= 0) {
      throw new InvalidAmountError("Transfer amount must be positive");
    }
    this.balance += amount;
    this.events.push({
      type: "TransferredIn",
      accountId: this.accountId,
      amount,
      senderId,
      timestamp: new Date(),
    });
  }

  public static reconstructFromEvents(accountId: string, events: AccountEvent[]): Account {
    const accountEvents = events.filter((e) => e.accountId === accountId);
    if (accountEvents.length === 0) {
      throw new AccountNotFoundError(`No events found for account ${accountId}`);
    }

    const createdEvent = accountEvents.find((e) => e.type === "AccountCreated");
    if (!createdEvent || createdEvent.type !== "AccountCreated") {
      throw new AccountNotFoundError(`Account creation event not found for ${accountId}`);
    }

    const account = new Account(accountId, createdEvent.initialBalance);
    account.events = []; // Reset events to reconstruct from history
    account.balance = createdEvent.initialBalance;
    account.createdAt = createdEvent.timestamp;

    for (const event of accountEvents) {
      if (event.type === "AccountCreated") {
        account.events.push(event);
      } else if (event.type === "Deposited") {
        account.balance += event.amount;
        account.events.push(event);
      } else if (event.type === "Withdrew") {
        account.balance -= event.amount;
        account.events.push(event);
      } else if (event.type === "TransferredOut") {
        account.balance -= event.amount;
        account.events.push(event);
      } else if (event.type === "TransferredIn") {
        account.balance += event.amount;
        account.events.push(event);
      }
    }

    return account;
  }
}

export function transfer(from: Account, to: Account, amount: number): void {
  try {
    from.transferOut(amount, to.getState().accountId);
    to.transferIn(amount, from.getState().accountId);
  } catch (error) {
    // Rollback the transfer-out if transfer-in fails
    if (error instanceof InvalidAmountError || error instanceof InsufficientFundsError) {
      throw error;
    }
    throw error;
  }
}