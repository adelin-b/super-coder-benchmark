// Event types
export interface DepositEvent {
  type: 'deposit';
  amount: number;
  accountId: string;
  timestamp: number;
}

export interface WithdrawEvent {
  type: 'withdraw';
  amount: number;
  accountId: string;
  timestamp: number;
}

export interface TransferEvent {
  type: 'transfer';
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  timestamp: number;
}

export type Event = DepositEvent | WithdrawEvent | TransferEvent;

// Account state
export interface AccountState {
  accountId: string;
  balance: number;
}

// Custom error classes
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

// Apply a single event to account state
export function applyEvent(state: AccountState, event: Event): AccountState {
  if (event.type === 'deposit') {
    if (event.amount <= 0) {
      throw new InvalidAmountError('Deposit amount must be positive');
    }
    return {
      ...state,
      balance: state.balance + event.amount,
    };
  }

  if (event.type === 'withdraw') {
    if (event.amount <= 0) {
      throw new InvalidAmountError('Withdrawal amount must be positive');
    }
    if (state.balance < event.amount) {
      throw new InsufficientFundsError(
        `Cannot withdraw ${event.amount}. Current balance: ${state.balance}`
      );
    }
    return {
      ...state,
      balance: state.balance - event.amount,
    };
  }

  if (event.type === 'transfer') {
    if (event.amount <= 0) {
      throw new InvalidAmountError('Transfer amount must be positive');
    }
    if (event.fromAccountId === state.accountId) {
      if (state.balance < event.amount) {
        throw new InsufficientFundsError(
          `Cannot transfer ${event.amount}. Current balance: ${state.balance}`
        );
      }
      return {
        ...state,
        balance: state.balance - event.amount,
      };
    }
    if (event.toAccountId === state.accountId) {
      return {
        ...state,
        balance: state.balance + event.amount,
      };
    }
  }

  return state;
}

// Reconstruct account state from event history
export function reconstruct(
  accountId: string,
  events: Event[]
): AccountState {
  let state: AccountState = {
    accountId,
    balance: 0,
  };

  for (const event of events) {
    state = applyEvent(state, event);
  }

  return state;
}

// Get the current balance from account state
export function getBalance(state: AccountState): number {
  return state.balance;
}

// Create an initial account state
export function createAccount(accountId: string): AccountState {
  return {
    accountId,
    balance: 0,
  };
}

// Factory functions to create events
export function createDepositEvent(
  accountId: string,
  amount: number,
  timestamp: number = Date.now()
): DepositEvent {
  if (amount <= 0) {
    throw new InvalidAmountError('Deposit amount must be positive');
  }
  return {
    type: 'deposit',
    amount,
    accountId,
    timestamp,
  };
}

export function createWithdrawEvent(
  accountId: string,
  amount: number,
  timestamp: number = Date.now()
): WithdrawEvent {
  if (amount <= 0) {
    throw new InvalidAmountError('Withdrawal amount must be positive');
  }
  return {
    type: 'withdraw',
    amount,
    accountId,
    timestamp,
  };
}

export function createTransferEvent(
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  timestamp: number = Date.now()
): TransferEvent {
  if (amount <= 0) {
    throw new InvalidAmountError('Transfer amount must be positive');
  }
  return {
    type: 'transfer',
    fromAccountId,
    toAccountId,
    amount,
    timestamp,
  };
}