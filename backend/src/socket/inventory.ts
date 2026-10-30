import type { Server, Socket } from 'socket.io'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { expNeeded } from '../data'
import { Ack, charOf } from './common'
import { players, healPlayer } from './world'

export function registerInventory(io: Server, socket: Socket) {
  socket.on('inventory:get', async (ack?: Ack) => {
    const c = await charOf(socket)
    if (!c) return ack?.({ error: 'Chưa có nhân vật' })
    const rows = await prisma.inventoryItem.findMany({
      where: { characterId: c.id, count: { gt: 0 } },
      include: { item: true },
      orderBy: { itemId: 'asc' },
    })
    ack?.({ items: rows.map((r) => ({ code: r.item.code, name: r.item.name, count: r.count, healHp: r.item.healHp, expGain: r.item.expGain, slot: r.item.slot, quality: r.item.quality, atkBonus: r.item.atkBonus, hpBonus: r.item.hpBonus })) })
  })

  // dùng 1 vật phẩm: hồi máu (cần đang trong map) và/hoặc cộng tu vi
  socket.on('inventory:use', async (data: unknown, ack?: Ack) => {
    const parsed = z.object({ code: z.string() }).safeParse(data)
    const c = await charOf(socket)
    if (!parsed.success || !c) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const item = await prisma.item.findUnique({ where: { code: parsed.data.code } })
    if (!item) return ack?.({ error: 'Vật phẩm không tồn tại' })
    if (item.slot) return ack?.({ error: 'Hãy dùng chức năng mặc trang bị' })
    const p = players.get(socket.id)
    if (item.healHp > 0 && (!p || p.dead)) return ack?.({ error: 'Cần ở trong map và còn sống' })
    const used = await prisma.inventoryItem.updateMany({
      where: { characterId: c.id, itemId: item.id, count: { gte: 1 } },
      data: { count: { decrement: 1 } },
    })
    if (used.count === 0) return ack?.({ error: 'Không có vật phẩm' })
    if (item.healHp > 0 && p) healPlayer(io, p, item.healHp)
    if (item.expGain > 0) {
      const ch = await prisma.character.update({
        where: { id: c.id },
        data: { exp: { increment: item.expGain } },
        include: { realm: true },
      })
      socket.emit('player:exp', { exp: ch.exp, expNeeded: expNeeded(ch.realm.order, ch.subRealm) })
    }
    ack?.({ ok: true })
  })

  socket.on('inventory:drop', async (data: unknown, ack?: Ack) => {
    const parsed = z.object({ code: z.string(), count: z.number().int().min(1) }).safeParse(data)
    const c = await charOf(socket)
    if (!parsed.success || !c) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const item = await prisma.item.findUnique({ where: { code: parsed.data.code } })
    if (!item) return ack?.({ error: 'Vật phẩm không tồn tại' })
    const r = await prisma.inventoryItem.updateMany({
      where: { characterId: c.id, itemId: item.id, count: { gte: parsed.data.count } },
      data: { count: { decrement: parsed.data.count } },
    })
    ack?.(r.count === 0 ? { error: 'Không đủ số lượng' } : { ok: true })
  })
}
