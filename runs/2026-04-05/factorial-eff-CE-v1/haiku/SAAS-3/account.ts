// ===== Event Types =====
interface DepositOccurred {
  type: 'DepositOccurred'
  accountId: string
  amount: number
  timestamp: Date
}

interface WithdrawalOccurred {
  type: 'WithdrawalOccurred'
  accountId: string
  amount: number
  timestamp: Date
}

interface TransferOccurred {
  type: 'TransferOccurred'
  fromAccountId: string
  toAccountId: string
  amount: number
  timestamp: Date
}

type DomainEvent = DepositOccurred | WithdrawalOccurred | TransferOccurred

// ===== Account State =====
interface Account {
  id: string
  owner: string
  balance: number
}

// ===== Aggregate Functions =====
function createAccount(id: string, owner: string): Account {
  if (!id || id.trim().length === 0) {
    throw new Error('Account id must not be empty')
  }
  if (!owner || owner.trim().length === 0) {
    throw new Error('Owner must not be empty')
  }
  return { id, owner, balance: 0 }
}

function deposit(account: Account, amount: number): { account: Account; event: DepositOccurred } {
  if (amount <= 0) {
    throw new Error('Deposit amount must be positive')
  }
  const newAccount = { ...account, balance: account.balance + amount }
  const event: DepositOccurred = {
    type: 'DepositOccurred',
    accountId: account.id,
    amount,
    timestamp: new Date(),
  }
  return { account: newAccount, event }
}

function withdraw(account: Account, amount: number): { account: Account; event: WithdrawalOccurred } {
  if (amount <= 0) {
    throw new Error('Withdrawal amount must be positive')
  }
  if (account.balance < amount) {
    throw new Error('Insufficient funds')
  }
  const newAccount = { ...account, balance: account.balance - amount }
  const event: WithdrawalOccurred = {
    type: 'WithdrawalOccurred',
    accountId: account.id,
    amount,
    timestamp: new Date(),
  }
  return { account: newAccount, event }
}

function transfer(
  fromAccount: Account,
  toAccount: Account,
  amount: number
): { fromAccount: Account; toAccount: Account; event: TransferOccurred } {
  if (amount <= 0) {
    throw new Error('Transfer amount must be positive')
  }
  if (fromAccount.balance < amount) {
    throw new Error('Insufficient funds')
  }
  const newFromAccount = { ...fromAccount, balance: fromAccount.balance - amount }
  const newToAccount = { ...toAccount, balance: toAccount.balance + amount }
  const event: TransferOccurred = {
    type: 'TransferOccurred',
    fromAccountId: fromAccount.id,
    toAccountId: toAccount.id,
    amount,
    timestamp: new Date(),
  }
  return { fromAccount: newFromAccount, toAccount: newToAccount, event }
}

function reconstructFromEvents(accountId: string, owner: string, events: DomainEvent[]): Account {
  let balance = 0

  for (const event of events) {
    if (event.type === 'DepositOccurred' && event.accountId === accountId) {
      balance += event.amount
    } else if (event.type === 'WithdrawalOccurred' && event.accountId === accountId) {
      balance -= event.amount
    } else if (event.type === 'TransferOccurred') {
      if (event.fromAccountId === accountId) {
        balance -= event.amount
      } else if (event.toAccountId === accountId) {
        balance += event.amount
      }
    }
  }

  if (balance < 0) {
    throw new Error('Invalid event stream: balance cannot be negative')
  }

  return { id: accountId, owner, balance }
}

export type { Account, DomainEvent, DepositOccurred, WithdrawalOccurred, TransferOccurred }
export { createAccount, deposit, withdraw, transfer, reconstructFromEvents }