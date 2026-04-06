/**
 * Event Sourcing Aggregate for Bank Account
 * Supports deposit, withdraw, and transfer operations
 * Reconstructs state from event history
 */

// Event types
export type AccountEvent = 
  | { readonly type: 'Deposited'; readonly amount: number; readonly timestamp: Date }
  | { readonly type: 'Withdrawn'; readonly amount: number; readonly timestamp: Date }
  | { readonly type: 'Transferred'; readonly amount: number; readonly to: string; readonly timestamp: Date }
  | { readonly type: 'AccountCreated'; readonly accountId: string; readonly timestamp: Date };

// Account state snapshot
export interface AccountState {
  readonly accountId: string;
  readonly balance: number;
  readonly events: readonly AccountEvent[];
}

/**
 * Event-sourced bank account aggregate
 */
export class Account {
  private balance: number = 0;
  private events: AccountEvent[] = [];

  constructor(private readonly accountId: string) {
    this.recordEvent({
      type: 'AccountCreated',
      accountId,
      timestamp: new Date(),
    });
  }

  /**
   * Deposit funds into the account
   */
  deposit(amount: number): AccountEvent {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    const event: AccountEvent = {
      type: 'Deposited',
      amount,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    return event;
  }

  /**
   * Withdraw funds from the account
   */
  withdraw(amount: number): AccountEvent {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }

    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }

    const event: AccountEvent = {
      type: 'Withdrawn',
      amount,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    return event;
  }

  /**
   * Transfer funds to another account
   */
  transfer(amount: number, toAccountId: string): AccountEvent {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    if (!toAccountId || toAccountId.trim().length === 0) {
      throw new Error('Recipient account ID must be specified');
    }

    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }

    const event: AccountEvent = {
      type: 'Transferred',
      amount,
      to: toAccountId,
      timestamp: new Date(),
    };

    this.applyEvent(event);
    return event;
  }

  /**
   * Get current account balance
   */
  getBalance(): number {
    return this.balance;
  }

  /**
   * Get account ID
   */
  getAccountId(): string {
    return this.accountId;
  }

  /**
   * Get all recorded events
   */
  getEvents(): readonly AccountEvent[] {
    return Object.freeze([...this.events]);
  }

  /**
   * Get current state snapshot
   */
  getState(): AccountState {
    return {
      accountId: this.accountId,
      balance: this.balance,
      events: Object.freeze([...this.events]),
    };
  }

  /**
   * Apply event to state (internal)
   */
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
      case 'AccountCreated':
        // Initial state, no balance change
        break;
    }
    this.recordEvent(event);
  }

  /**
   * Record event in history
   */
  private recordEvent(event: AccountEvent): void {
    this.events.push(event);
  }
}

/**
 * Reconstruct account state from event history
 */
export function reconstructAccount(
  accountId: string,
  events: readonly AccountEvent[]
): Account {
  const account = new Account(accountId);
  
  // Clear initial AccountCreated event and replay all events
  (account as any).events = [];
  (account as any).balance = 0;

  for (const event of events) {
    applyEventToAccount(account, event);
  }

  return account;
}

/**
 * Apply a single event to an account
 */
export function applyEventToAccount(
  account: Account,
  event: AccountEvent
): void {
  const state = account.getState();
  
  switch (event.type) {
    case 'Deposited':
      if (event.amount <= 0) throw new Error('Invalid event: positive amount required');
      (account as any).balance = state.balance + event.amount;
      (account as any).events.push(event);
      break;
    case 'Withdrawn':
      if (event.amount <= 0) throw new Error('Invalid event: positive amount required');
      if (state.balance < event.amount) throw new Error('Invalid event: insufficient funds');
      (account as any).balance = state.balance - event.amount;
      (account as any).events.push(event);
      break;
    case 'Transferred':
      if (event.amount <= 0) throw new Error('Invalid event: positive amount required');
      if (state.balance < event.amount) throw new Error('Invalid event: insufficient funds');
      (account as any).balance = state.balance - event.amount;
      (account as any).events.push(event);
      break;
    case 'AccountCreated':
      // Account creation already handled in constructor
      break;
  }
}

/**
 * Create a new account with specified ID
 */
export function createAccount(accountId: string): Account {
  if (!accountId || accountId.trim().length === 0) {
    throw new Error('Account ID must be specified');
  }
  return new Account(accountId);
}