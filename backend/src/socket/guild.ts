import type { Server, Socket } from 'socket.io'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { GUILD_NAME_MIN, GUILD_NAME_MAX, GUILD_INVITE_TTL_MS } from '../data'
import { Ack, charOf, guildRoom } from './common'

interface Invite {
  guildId: number
  guildName: string
  from: string
  expiresAt: number
}
const invites = new Map<number, Invite>() // key: characterId được mời

async function guildInfo(io: Server, guildId: number) {
  const g = await prisma.guild.findUnique({ where: { id: guildId }, include: { members: { orderBy: { id: 'asc' } } } })
  if (!g) return null
  const online = new Set([...io.sockets.sockets.values()].map((s) => s.data.char?.id))
  return {
    id: g.id,
    name: g.name,
    leader: g.members.find((m) => m.id === g.leaderId)?.name ?? null,
    members: g.members.map((m) => ({ name: m.name, online: online.has(m.id) })),
  }
}

export function registerGuild(io: Server, socket: Socket) {
  socket.on('guild:info', async (ack?: Ack) => {
    const c = await charOf(socket)
    if (!c) return ack?.({ error: 'Chưa có nhân vật' })
    const me = await prisma.character.findUniqueOrThrow({ where: { id: c.id } })
    ack?.({ guild: me.guildId ? await guildInfo(io, me.guildId) : null })
  })

  socket.on('guild:create', async (data: unknown, ack?: Ack) => {
    const parsed = z.object({ name: z.string().trim().min(GUILD_NAME_MIN).max(GUILD_NAME_MAX) }).safeParse(data)
    const c = await charOf(socket)
    if (!c) return ack?.({ error: 'Chưa có nhân vật' })
    if (!parsed.success) return ack?.({ error: 'Tên bang không hợp lệ' })
    const me = await prisma.character.findUniqueOrThrow({ where: { id: c.id } })
    if (me.guildId) return ack?.({ error: 'Đã ở trong bang' })
    if (await prisma.guild.findUnique({ where: { name: parsed.data.name } })) return ack?.({ error: 'Tên bang đã tồn tại' })
    const g = await prisma.guild.create({ data: { name: parsed.data.name, leaderId: c.id, members: { connect: { id: c.id } } } })
    socket.join(guildRoom(g.id))
    ack?.({ guild: await guildInfo(io, g.id) })
  })

  // chỉ bang chủ mời; người được mời phải đang online
  socket.on('guild:invite', async (data: unknown, ack?: Ack) => {
    const parsed = z.object({ name: z.string() }).safeParse(data)
    const c = await charOf(socket)
    if (!c || !parsed.success) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const me = await prisma.character.findUniqueOrThrow({ where: { id: c.id }, include: { guild: true } })
    if (!me.guild || me.guild.leaderId !== me.id) return ack?.({ error: 'Chỉ bang chủ được mời' })
    const target = await prisma.character.findUnique({ where: { name: parsed.data.name } })
    if (!target) return ack?.({ error: 'Không tìm thấy người chơi' })
    if (target.guildId) return ack?.({ error: 'Người này đã có bang' })
    const ts = [...io.sockets.sockets.values()].find((s) => s.data.char?.id === target.id)
    if (!ts) return ack?.({ error: 'Người này đang offline' })
    invites.set(target.id, { guildId: me.guild.id, guildName: me.guild.name, from: me.name, expiresAt: Date.now() + GUILD_INVITE_TTL_MS })
    ts.emit('guild:invited', { guildName: me.guild.name, from: me.name })
    ack?.({ ok: true })
  })

  socket.on('guild:accept', async (ack?: Ack) => {
    const c = await charOf(socket)
    if (!c) return ack?.({ error: 'Chưa có nhân vật' })
    const inv = invites.get(c.id)
    invites.delete(c.id)
    if (!inv || inv.expiresAt < Date.now()) return ack?.({ error: 'Không có lời mời hợp lệ' })
    const me = await prisma.character.findUniqueOrThrow({ where: { id: c.id } })
    if (me.guildId) return ack?.({ error: 'Đã ở trong bang' })
    if (!(await prisma.guild.findUnique({ where: { id: inv.guildId } }))) return ack?.({ error: 'Bang không còn tồn tại' })
    await prisma.character.update({ where: { id: c.id }, data: { guildId: inv.guildId } })
    socket.join(guildRoom(inv.guildId))
    io.to(guildRoom(inv.guildId)).emit('guild:member_joined', { name: c.name })
    ack?.({ guild: await guildInfo(io, inv.guildId) })
  })

  // bang chủ rời: nhường cho thành viên có id nhỏ nhất, hết người thì giải tán
  socket.on('guild:leave', async (ack?: Ack) => {
    const c = await charOf(socket)
    if (!c) return ack?.({ error: 'Chưa có nhân vật' })
    const me = await prisma.character.findUniqueOrThrow({ where: { id: c.id }, include: { guild: true } })
    if (!me.guild) return ack?.({ error: 'Chưa ở trong bang' })
    const g = me.guild
    await prisma.character.update({ where: { id: c.id }, data: { guildId: null } })
    socket.leave(guildRoom(g.id))
    if (g.leaderId === c.id) {
      const next = await prisma.character.findFirst({ where: { guildId: g.id }, orderBy: { id: 'asc' } })
      if (next) await prisma.guild.update({ where: { id: g.id }, data: { leaderId: next.id } })
      else await prisma.guild.delete({ where: { id: g.id } })
    }
    io.to(guildRoom(g.id)).emit('guild:member_left', { name: c.name })
    ack?.({ ok: true })
  })
}
