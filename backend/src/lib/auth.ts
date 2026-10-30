import jwt from 'jsonwebtoken'

const secret = () => process.env.JWT_SECRET || 'dev-secret'

export function signToken(accountId: number) {
  return jwt.sign({ id: accountId }, secret(), { expiresIn: '7d' })
}

export function verifyToken(token: string): number | null {
  try {
    const p = jwt.verify(token, secret()) as { id: number }
    return p.id
  } catch {
    return null
  }
}
