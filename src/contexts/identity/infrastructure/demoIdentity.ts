import type { Role, Session } from '../domain/session'

interface DemoAccount {
  email: string
  password: string
  name: string
  role: Role
}

const demoAccounts: readonly DemoAccount[] = [
  { email: 'admin@sensework.test', password: '123456', name: 'Demo Admin', role: 'ADMIN' },
  { email: 'member@sensework.test', password: '123456', name: 'Demo Member', role: 'MEMBER' },
]

// Accounts created through the demo sign-up form last only while this page is open.
const temporaryAccounts = new Map<string, DemoAccount>()

function sessionFor(account: DemoAccount): Session {
  return { token: 'demo', email: account.email, name: account.name, role: account.role, expiresAt: Date.now() + 86400000 }
}

export function signInDemo(email: string, password: string): Session {
  const normalized = email.trim().toLowerCase()
  const account = [...demoAccounts, ...temporaryAccounts.values()].find(item => item.email === normalized && item.password === password)
  if (!account) throw new Error('Invalid demo email or password.')
  return sessionFor(account)
}

export function registerDemo(email: string, password: string, name: string, role: Role): Session {
  const normalized = email.trim().toLowerCase()
  if ([...demoAccounts, ...temporaryAccounts.values()].some(item => item.email === normalized))
    throw new Error('This email is already used in the demo.')
  const account = { email: normalized, password, name, role }
  temporaryAccounts.set(normalized, account)
  return sessionFor(account)
}
