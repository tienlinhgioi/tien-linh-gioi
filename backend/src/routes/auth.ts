import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { signToken } from '../lib/auth'

export const authRouter = Router()

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(64),
})

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Thông tin không hợp lệ' })
  const { email, username, password } = parsed.data
  const exists = await prisma.account.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, { username }] },
  })
  if (exists) return res.status(409).json({ error: 'Gmail hoặc tên tài khoản đã tồn tại' })
  const acc = await prisma.account.create({
    data: { email: email.toLowerCase(), username, passwordHash: await bcrypt.hash(password, 10) },
  })
  res.json({ token: signToken(acc.id), username: acc.username })
})

// "account" là gmail hoặc tên tài khoản
const loginSchema = z.object({ account: z.string().min(1), password: z.string().min(1) })

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Thông tin không hợp lệ' })
  const { account, password } = parsed.data
  const acc = await prisma.account.findFirst({
    where: { OR: [{ email: account.toLowerCase() }, { username: account }] },
  })
  if (!acc || !(await bcrypt.compare(password, acc.passwordHash))) {
    return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' })
  }
  res.json({ token: signToken(acc.id), username: acc.username })
})
