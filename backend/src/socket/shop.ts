import type { Server, Socket } from 'socket.io'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { SHOP_NPC, SHOP_RANGE, SHOP_CURRENCY, SHOP_GOODS } from '../data'
import { Ack, charOf } from './common'
import { players } from './world'

const order = z.object({ code: z.string(), count: z.number().int().min(1).max(99) })

export function registerShop(io: Server, socket: Socket) {
  socket.on('shop:list', async (ack?: Ack) => {
    const items = await prisma.item.findMany({ where: { code: { in: SHOP_GOODS.map((g) => g.item) } } })
    const cur = await prisma.currency.findUnique({ where: { code: SHOP_CURRENCY } })
    ack?.({
      npc: SHOP_NPC,
      currency: cur ? { code: cur.code, name: cur.name } : null,
      goods: SHOP_GOODS.map((g) => ({
        code: g.item,
        name: items.find((i) => i.code === g.item)?.name ?? g.item,
        price: g.price,
        sellPrice: Math.floor(g.price / 2),
      })),
    })
  })

  // mua/bán cần đang sống trong map và đứng gần NPC
  const guard = async () => {
    const c = await charOf(socket)
    const p = players.get(socket.id)
    if (!c || !p || p.dead) return { error: 'Cần ở trong map và còn sống' }
    if (Math.hypot(p.x - SHOP_NPC.x, p.y - SHOP_NPC.y) > SHOP_RANGE) return { error: 'Quá xa NPC' }
    return { c }
  }

  socket.on('shop:buy', async (data: unknown, ack?: Ack) => {
    const parsed = order.safeParse(data)
    if (!parsed.success) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const good = SHOP_GOODS.find((g) => g.item === parsed.data.code)
    if (!good) return ack?.({ error: 'NPC không bán món này' })
    const g = await guard()
    if ('error' in g) return ack?.(g)
    const [item, cur] = await Promise.all([
      prisma.item.findUniqueOrThrow({ where: { code: good.item } }),
      prisma.currency.findUniqueOrThrow({ where: { code: SHOP_CURRENCY } }),
    ])
    const cost = good.price * parsed.data.count
    const err = await prisma.$transaction(async (tx) => {
      const paid = await tx.characterCurrency.updateMany({
        where: { characterId: g.c.id, currencyId: cur.id, amount: { gte: cost } },
        data: { amount: { decrement: cost } },
      })
      if (paid.count === 0) return `Không đủ ${cur.name}`
      await tx.inventoryItem.upsert({
        where: { characterId_itemId: { characterId: g.c.id, itemId: item.id } },
        update: { count: { increment: parsed.data.count } },
        create: { characterId: g.c.id, itemId: item.id, count: parsed.data.count },
      })
      return null
    })
    ack?.(err ? { error: err } : { ok: true, spent: cost })
  })

  socket.on('shop:sell', async (data: unknown, ack?: Ack) => {
    const parsed = order.safeParse(data)
    if (!parsed.success) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const good = SHOP_GOODS.find((g) => g.item === parsed.data.code)
    if (!good) return ack?.({ error: 'NPC không thu món này' })
    const g = await guard()
    if ('error' in g) return ack?.(g)
    const [item, cur] = await Promise.all([
      prisma.item.findUniqueOrThrow({ where: { code: good.item } }),
      prisma.currency.findUniqueOrThrow({ where: { code: SHOP_CURRENCY } }),
    ])
    const gain = Math.floor(good.price / 2) * parsed.data.count
    const err = await prisma.$transaction(async (tx) => {
      const taken = await tx.inventoryItem.updateMany({
        where: { characterId: g.c.id, itemId: item.id, count: { gte: parsed.data.count } },
        data: { count: { decrement: parsed.data.count } },
      })
      if (taken.count === 0) return 'Không đủ số lượng'
      await tx.characterCurrency.upsert({
        where: { characterId_currencyId: { characterId: g.c.id, currencyId: cur.id } },
        update: { amount: { increment: gain } },
        create: { characterId: g.c.id, currencyId: cur.id, amount: gain },
      })
      return null
    })
    ack?.(err ? { error: err } : { ok: true, earned: gain })
  })
}
