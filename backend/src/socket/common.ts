import type { Socket } from 'socket.io'
import { prisma } from '../lib/prisma'
import { expNeeded } from '../data'

export type Ack = (res: unknown) => void

export const guildRoom = (guildId: number) => `guild:${guildId}`

export async function loadMe(accountId: number) {
  const c = await prisma.character.findUnique({
    where: { accountId },
    include: { realm: true, currencies: true, guild: true },
  })
  if (!c) return null
  const all = await prisma.currency.findMany({ orderBy: { id: 'asc' } })
  return {
    id: c.id,
    name: c.name,
    realm: { order: c.realm.order, name: c.realm.name },
    subRealm: c.subRealm,
    exp: c.exp,
    expNeeded: expNeeded(c.realm.order, c.subRealm),
    currencies: all.map((cur) => ({
      code: cur.code,
      name: cur.name,
      amount: c.currencies.find((x) => x.currencyId === cur.id)?.amount ?? 0,
    })),
    map: c.mapId === null ? null : { id: c.mapId, x: c.posX, y: c.posY },
    guild: c.guild ? { id: c.guild.id, name: c.guild.name } : null,
  }
}

// Nhân vật của socket (id, tên), lưu tạm; đồng thời vào room bang nếu có
export async function charOf(socket: Socket) {
  if (socket.data.char) return socket.data.char as { id: number; name: string }
  const c = await prisma.character.findUnique({ where: { accountId: socket.data.accountId } })
  if (!c) return null
  socket.data.char = { id: c.id, name: c.name }
  if (c.guildId) socket.join(guildRoom(c.guildId))
  return socket.data.char as { id: number; name: string }
}
