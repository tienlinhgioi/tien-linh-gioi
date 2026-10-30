import type { Server, Socket } from 'socket.io'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { SLOTS } from '../data'
import { Ack, charOf } from './common'
import { players, setBonuses } from './world'

// Tổng chỉ số cộng thêm từ trang bị đang mặc
export async function loadBonuses(characterId: number) {
  const rows = await prisma.equipment.findMany({ where: { characterId }, include: { item: true } })
  return {
    atk: rows.reduce((n, r) => n + r.item.atkBonus, 0),
    hp: rows.reduce((n, r) => n + r.item.hpBonus, 0),
  }
}

async function equipmentView(characterId: number) {
  const rows = await prisma.equipment.findMany({ where: { characterId }, include: { item: true } })
  const slots: Record<string, unknown> = {}
  for (const slot of SLOTS) {
    const r = rows.find((x) => x.slot === slot)
    slots[slot] = r ? { code: r.item.code, name: r.item.name, atkBonus: r.item.atkBonus, hpBonus: r.item.hpBonus } : null
  }
  return slots
}

export function registerEquipment(io: Server, socket: Socket) {
  const apply = async (characterId: number) => {
    const p = players.get(socket.id)
    if (!p) return
    const b = await loadBonuses(characterId)
    setBonuses(io, p, b.atk, b.hp)
  }

  socket.on('equipment:get', async (ack?: Ack) => {
    const c = await charOf(socket)
    if (!c) return ack?.({ error: 'Chưa có nhân vật' })
    ack?.({ slots: await equipmentView(c.id) })
  })

  // mặc trang bị từ túi đồ; ô đang có đồ thì đồ cũ trả về túi
  socket.on('equipment:equip', async (data: unknown, ack?: Ack) => {
    const parsed = z.object({ code: z.string() }).safeParse(data)
    const c = await charOf(socket)
    if (!parsed.success || !c) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const item = await prisma.item.findUnique({ where: { code: parsed.data.code } })
    if (!item || !item.slot) return ack?.({ error: 'Không phải trang bị' })
    const slot = item.slot
    const err = await prisma.$transaction(async (tx) => {
      const taken = await tx.inventoryItem.updateMany({
        where: { characterId: c.id, itemId: item.id, count: { gte: 1 } },
        data: { count: { decrement: 1 } },
      })
      if (taken.count === 0) return 'Không có vật phẩm'
      const old = await tx.equipment.findUnique({ where: { characterId_slot: { characterId: c.id, slot } } })
      if (old) {
        await tx.inventoryItem.upsert({
          where: { characterId_itemId: { characterId: c.id, itemId: old.itemId } },
          update: { count: { increment: 1 } },
          create: { characterId: c.id, itemId: old.itemId, count: 1 },
        })
      }
      await tx.equipment.upsert({
        where: { characterId_slot: { characterId: c.id, slot } },
        update: { itemId: item.id },
        create: { characterId: c.id, slot, itemId: item.id },
      })
      return null
    })
    if (err) return ack?.({ error: err })
    await apply(c.id)
    ack?.({ slots: await equipmentView(c.id) })
  })

  socket.on('equipment:unequip', async (data: unknown, ack?: Ack) => {
    const parsed = z.object({ slot: z.enum(SLOTS as [string, ...string[]]) }).safeParse(data)
    const c = await charOf(socket)
    if (!parsed.success || !c) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const err = await prisma.$transaction(async (tx) => {
      const cur = await tx.equipment.findUnique({ where: { characterId_slot: { characterId: c.id, slot: parsed.data.slot } } })
      if (!cur) return 'Ô trống'
      await tx.equipment.delete({ where: { characterId_slot: { characterId: c.id, slot: parsed.data.slot } } })
      await tx.inventoryItem.upsert({
        where: { characterId_itemId: { characterId: c.id, itemId: cur.itemId } },
        update: { count: { increment: 1 } },
        create: { characterId: c.id, itemId: cur.itemId, count: 1 },
      })
      return null
    })
    if (err) return ack?.({ error: err })
    await apply(c.id)
    ack?.({ slots: await equipmentView(c.id) })
  })
}
