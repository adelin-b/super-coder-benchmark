interface Event {
  type: string;
  timestamp: Date;
}

interface DepositEvent extends Event {
  type: 'Deposited';
  accountId: string;
  amount: number;
}

interface WithdrawEvent extends Event {
  type: 'Withdrawn';
  accountId: string;
  amount: number;
}

interface TransferEvent extends Event {
  type: 'Transferred';
  fromAccountId: string;
  toAccountId: string;
  amount: number;
}

type AccountEvent = DepositEvent | WithdrawEvent | TransferEvent;

class Account {
  private balance: number = 0;
  private accountId: string;
  private events: AccountEvent[] = [];

  constructor(accountId: string, events: AccountEvent[] = []) {
    this.accountId = accountId;
    this.events = events;
    this.reconstructFromEvents();
  }

  private reconstructFromEvents(): void {
    this.balance = 0;
    for (const event of this.events) {
      this.applyEvent(event);
    }
  }

  private applyEvent(event: AccountEvent): void {
    if (event.type === 'Deposited') {
      this.balance += (event as DepositEvent).amount;
    } else if (event.type === 'Withdrawn') {
      this.balance -= (event as WithdrawEvent).amount;
    } else if (event.type === 'Transferred') {
      const transferEvent = event as TransferEvent;
      if (transferEvent.fromAccountId === this.accountId) {
        this.balance -= transferEvent.amount;
      } else if (transferEvent.toAccountId === this.accountId) {
        this.balance += transferEvent.amount;
      }
    }
  }

  deposit(amount: number): DepositEvent {
    if (amount <= 0) throw new Error('Deposit amount must be positive');
    const event: DepositEvent = {
      type: 'Deposited',
      timestamp: new Date(),
      accountId: this.accountId,
      amount,
    };
    this.events.push(event);
    this.applyEvent(event);
    return event;
  }

  withdraw(amount: number): WithdrawEvent {
    if (amount <= 0) throw new Error('Withdrawal amount must be positive');
    if (this.balance < amount) throw new Error('Insufficient balance');
    const event: WithdrawEvent = {
      type: 'Withdrawn',
      timestamp: new Date(),
      accountId: this.accountId,
      amount,
    };
    this.events.push(event);
    this.applyEvent(event);
    return event;
  }

  transfer(toAccountId: string, amount: number): TransferEvent {
    if (amount <= 0) throw new Error('Transfer amount must be positive');
    if (!toAccountId) throw new Error('Destination account ID is required');
    if (this.balance < amount) throw new Error('Insufficient balance');
    const event: TransferEvent = {
      type: 'Transferred',
      timestamp: new Date(),
      fromAccountId: this.accountId,
      toAccountId,
      amount,
    };
    this.events.push(event);
    this.applyEvent(event);
    return event;
  }

  getBalance(): number {
    return this.balance;
  }

  getEvents(): readonly AccountEvent[] {
    return this.events;
  }
}

export { Account, AccountEvent, DepositEvent, WithdrawEvent, TransferEvent };