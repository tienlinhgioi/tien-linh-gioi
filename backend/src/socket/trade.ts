import type { Server, Socket } from 'socket.io'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { REQUEST_TTL_MS } from '../data'
import { Ack, charOf, socketOf } from './common'

interface Side {
  id: number
  name: string
  items: Record<string, number>
  currencies: Record<string, number>
  confirmed: boolean
}
interface Trade {
  a: Side
  b: Side
}

const trades = new Map<number, Trade>() // key: characterId, hai bên trỏ cùng một giao dịch
const requests = new Map<number, { fromId: number; fromName: string; expiresAt: number }>() // key: người được mời

const view = (s: Side) => ({ name: s.name, items: s.items, currencies: s.currencies, confirmed: s.confirmed })
const other = (t: Trade, id: number) => (t.a.id === id ? t.b : t.a)

export function registerTrade(io: Server, socket: Socket) {
  const sendUpdate = (t: Trade) => {
    for (const [me, you] of [[t.a, t.b], [t.b, t.a]]) {
      socketOf(io, me.id)?.emit('trade:update', { me: view(me), other: view(you) })
    }
  }

  const end = (t: Trade, event: string, payload: object) => {
    for (const s of [t.a, t.b]) {
      trades.delete(s.id)
      socketOf(io, s.id)?.emit(event, payload)
    }
  }

  // chuyển đồ và tiền của hai bên trong một transaction; lỗi thì hủy hết
  const execute = async (t: Trade) => {
    try {
      await prisma.$transaction(async (tx) => {
        for (const [from, to] of [[t.a, t.b], [t.b, t.a]]) {
          for (const [code, n] of Object.entries(from.items)) {
            const item = await tx.item.findUniqueOrThrow({ where: { code } })
            const r = await tx.inventoryItem.updateMany({
              where: { characterId: from.id, itemId: item.id, count: { gte: n } },
              data: { count: { decrement: n } },
            })
            if (r.count === 0) throw new Error('Không đủ vật phẩm')
            await tx.inventoryItem.upsert({
              where: { characterId_itemId: { characterId: to.id, itemId: item.id } },
              update: { count: { increment: n } },
              create: { characterId: to.id, itemId: item.id, count: n },
            })
          }
          for (const [code, amount] of Object.entries(from.currencies)) {
            const cur = await tx.currency.findUniqueOrThrow({ where: { code } })
            const r = await tx.characterCurrency.updateMany({
              where: { characterId: from.id, currencyId: cur.id, amount: { gte: amount } },
              data: { amount: { decrement: amount } },
            })
            if (r.count === 0) throw new Error('Không đủ tiền tệ')
            await tx.characterCurrency.upsert({
              where: { characterId_currencyId: { characterId: to.id, currencyId: cur.id } },
              update: { amount: { increment: amount } },
              create: { characterId: to.id, currencyId: cur.id, amount },
            })
          }
        }
      })
      end(t, 'trade:completed', {})
    } catch (e) {
      end(t, 'trade:cancelled', { reason: e instanceof Error && e.message.startsWith('Không đủ') ? e.message : 'Giao dịch thất bại' })
    }
  }

  socket.on('trade:request', async (data: unknown, ack?: Ack) => {
    const parsed = z.object({ name: z.string() }).safeParse(data)
    const c = await charOf(socket)
    if (!parsed.success || !c) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const t = await prisma.character.findUnique({ where: { name: parsed.data.name } })
    if (!t || t.id === c.id) return ack?.({ error: 'Không tìm thấy người chơi' })
    const ts = socketOf(io, t.id)
    if (!ts) return ack?.({ error: 'Người này đang offline' })
    if (ts.data.blocked?.has(c.id) || socket.data.blocked?.has(t.id)) return ack?.({ error: 'Không thể giao dịch với người này' })
    if (trades.has(c.id) || trades.has(t.id)) return ack?.({ error: 'Đang trong một giao dịch' })
    requests.set(t.id, { fromId: c.id, fromName: c.name, expiresAt: Date.now() + REQUEST_TTL_MS })
    ts.emit('trade:requested', { from: c.name })
    ack?.({ ok: true })
  })

  socket.on('trade:accept', async (ack?: Ack) => {
    const c = await charOf(socket)
    if (!c) return ack?.({ error: 'Chưa có nhân vật' })
    const req = requests.get(c.id)
    requests.delete(c.id)
    if (!req || req.expiresAt < Date.now()) return ack?.({ error: 'Không có lời mời hợp lệ' })
    if (!socketOf(io, req.fromId)) return ack?.({ error: 'Người mời đã offline' })
    if (trades.has(c.id) || trades.has(req.fromId)) return ack?.({ error: 'Đang trong một giao dịch' })
    const t: Trade = {
      a: { id: req.fromId, name: req.fromName, items: {}, currencies: {}, confirmed: false },
      b: { id: c.id, name: c.name, items: {}, currencies: {}, confirmed: false },
    }
    trades.set(t.a.id, t)
    trades.set(t.b.id, t)
    for (const [me, you] of [[t.a, t.b], [t.b, t.a]]) socketOf(io, me.id)?.emit('trade:started', { with: you.name })
    sendUpdate(t)
    ack?.({ ok: true })
  })

  // đặt lại toàn bộ phần của mình; hai bên phải xác nhận lại
  socket.on('trade:offer', async (data: unknown, ack?: Ack) => {
    const parsed = z
      .object({
        items: z.array(z.object({ code: z.string(), count: z.number().int().min(1).max(999) })).max(20),
        currencies: z.array(z.object({ code: z.string(), amount: z.number().int().min(1) })).max(10),
      })
      .safeParse(data)
    const c = await charOf(socket)
    const t = c && trades.get(c.id)
    if (!parsed.success || !c || !t) return ack?.({ error: t === undefined ? 'Không trong giao dịch' : 'Dữ liệu không hợp lệ' })
    const items: Record<string, number> = {}
    for (const i of parsed.data.items) items[i.code] = (items[i.code] ?? 0) + i.count
    const currencies: Record<string, number> = {}
    for (const i of parsed.data.currencies) currencies[i.code] = (currencies[i.code] ?? 0) + i.amount
    for (const [code, n] of Object.entries(items)) {
      const item = await prisma.item.findUnique({ where: { code } })
      const have = item && (await prisma.inventoryItem.findUnique({ where: { characterId_itemId: { characterId: c.id, itemId: item.id } } }))
      if (!have || have.count < n) return ack?.({ error: 'Không đủ vật phẩm' })
    }
    for (const [code, n] of Object.entries(currencies)) {
      const cur = await prisma.currency.findUnique({ where: { code } })
      const have = cur && (await prisma.characterCurrency.findUnique({ where: { characterId_currencyId: { characterId: c.id, currencyId: cur.id } } }))
      if (!have || have.amount < n) return ack?.({ error: 'Không đủ tiền tệ' })
    }
    const me = t.a.id === c.id ? t.a : t.b
    me.items = items
    me.currencies = currencies
    t.a.confirmed = t.b.confirmed = false
    sendUpdate(t)
    ack?.({ ok: true })
  })

  socket.on('trade:confirm', async (ack?: Ack) => {
    const c = await charOf(socket)
    const t = c && trades.get(c.id)
    if (!c || !t) return ack?.({ error: 'Không trong giao dịch' })
    const me = t.a.id === c.id ? t.a : t.b
    me.confirmed = true
    sendUpdate(t)
    ack?.({ ok: true })
    if (t.a.confirmed && t.b.confirmed) await execute(t)
  })

  const cancel = async (reason: string) => {
    const c = await charOf(socket)
    const t = c && trades.get(c.id)
    if (!c || !t) return false
    end(t, 'trade:cancelled', { reason })
    return true
  }
  socket.on('trade:cancel', async (ack?: Ack) => {
    ack?.((await cancel('Đối phương đã hủy')) ? { ok: true } : { error: 'Không trong giao dịch' })
  })
  socket.on('disconnect', () => {
    const c = socket.data.char as { id: number } | undefined
    const t = c && trades.get(c.id)
    if (t) end(t, 'trade:cancelled', { reason: 'Đối phương đã ngắt kết nối' })
    if (c) requests.delete(c.id)
  })
}
