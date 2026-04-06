export type AccountEvent =
  | { type: 'Deposited'; amount: number; timestamp: Date }
  | { type: 'Withdrawn'; amount: number; timestamp: Date }
  | { type: 'Transferred'; amount: number; toAccountId: string; timestamp: Date }

export interface Account {
  id: string
  balance: number
  events: AccountEvent[]
}

export function createAccount(id: string): Account {
  return { id, balance: 0, events: [] }
}

export function deposit(account: Account, amount: number): Account {
  if (amount <= 0) throw new Error('Amount must be positive')

  const event: AccountEvent = {
    type: 'Deposited',
    amount,
    timestamp: new Date(),
  }

  return {
    ...account,
    balance: account.balance + amount,
    events: [...account.events, event],
  }
}

export function withdraw(account: Account, amount: number): Account {
  if (amount <= 0) throw new Error('Amount must be positive')
  if (account.balance < amount) throw new Error('Insufficient funds')

  const event: AccountEvent = {
    type: 'Withdrawn',
    amount,
    timestamp: new Date(),
  }

  return {
    ...account,
    balance: account.balance - amount,
    events: [...account.events, event],
  }
}

export function transfer(
  from: Account,
  to: Account,
  amount: number
): [Account, Account] {
  if (amount <= 0) throw new Error('Amount must be positive')
  if (from.balance < amount) throw new Error('Insufficient funds')

  const fromEvent: AccountEvent = {
    type: 'Transferred',
    amount,
    toAccountId: to.id,
    timestamp: new Date(),
  }

  const toEvent: AccountEvent = {
    type: 'Deposited',
    amount,
    timestamp: new Date(),
  }

  const updatedFrom = {
    ...from,
    balance: from.balance - amount,
    events: [...from.events, fromEvent],
  }

  const updatedTo = {
    ...to,
    balance: to.balance + amount,
    events: [...to.events, toEvent],
  }

  return [updatedFrom, updatedTo]
}

export function fromEvents(accountId: string, events: AccountEvent[]): Account {
  let account: Account = { id: accountId, balance: 0, events: [] }

  for (const event of events) {
    account = applyEvent(account, event)
  }

  return account
}

function applyEvent(account: Account, event: AccountEvent): Account {
  switch (event.type) {
    case 'Deposited':
      return {
        ...account,
        balance: account.balance + event.amount,
        events: [...account.events, event],
      }
    case 'Withdrawn':
      return {
        ...account,
        balance: account.balance - event.amount,
        events: [...account.events, event],
      }
    case 'Transferred':
      return {
        ...account,
        balance: account.balance - event.amount,
        events: [...account.events, event],
      }
  }
}