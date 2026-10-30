import type { Server, Socket } from 'socket.io'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { GUILD_NAME_MIN, GUILD_NAME_MAX, GUILD_INVITE_TTL_MS } from '../data'
import { Ack, charOf, guildRoom, socketOf } from './common'

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
    members: g.members.map((m) => ({
      name: m.name,
      online: online.has(m.id),
      role: m.id === g.leaderId ? 'LEADER' : m.guildRole,
    })),
  }
}

export function registerGuild(io: Server, socket: Socket) {
  // người gọi + bang + vai trò; trả về lỗi nếu chưa có bang
  const context = async () => {
    const c = await charOf(socket)
    if (!c) return { error: 'Chưa có nhân vật' as const }
    const me = await prisma.character.findUniqueOrThrow({ where: { id: c.id }, include: { guild: true } })
    if (!me.guild) return { error: 'Chưa ở trong bang' as const }
    const role = me.guild.leaderId === me.id ? 'LEADER' : me.guildRole
    return { me, guild: me.guild, role }
  }

  // tìm thành viên cùng bang theo tên
  const memberByName = (guildId: number, name: string) =>
    prisma.character.findFirst({ where: { guildId, name } })

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
    await prisma.character.update({ where: { id: c.id }, data: { guildRole: 'MEMBER' } })
    socket.join(guildRoom(g.id))
    ack?.({ guild: await guildInfo(io, g.id) })
  })

  // bang chủ và phó bang được mời; người được mời phải đang online
  socket.on('guild:invite', async (data: unknown, ack?: Ack) => {
    const parsed = z.object({ name: z.string() }).safeParse(data)
    if (!parsed.success) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const ctx = await context()
    if ('error' in ctx) return ack?.(ctx)
    if (ctx.role === 'MEMBER') return ack?.({ error: 'Chỉ bang chủ hoặc phó bang được mời' })
    const target = await prisma.character.findUnique({ where: { name: parsed.data.name } })
    if (!target) return ack?.({ error: 'Không tìm thấy người chơi' })
    if (target.guildId) return ack?.({ error: 'Người này đã có bang' })
    const ts = socketOf(io, target.id)
    if (!ts) return ack?.({ error: 'Người này đang offline' })
    invites.set(target.id, { guildId: ctx.guild.id, guildName: ctx.guild.name, from: ctx.me.name, expiresAt: Date.now() + GUILD_INVITE_TTL_MS })
    ts.emit('guild:invited', { guildName: ctx.guild.name, from: ctx.me.name })
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
    await prisma.character.update({ where: { id: c.id }, data: { guildId: inv.guildId, guildRole: 'MEMBER' } })
    socket.join(guildRoom(inv.guildId))
    io.to(guildRoom(inv.guildId)).emit('guild:member_joined', { name: c.name })
    ack?.({ guild: await guildInfo(io, inv.guildId) })
  })

  // bang chủ rời: nhường cho thành viên có id nhỏ nhất, hết người thì giải tán
  socket.on('guild:leave', async (ack?: Ack) => {
    const ctx = await context()
    if ('error' in ctx) return ack?.(ctx)
    const { me, guild: g } = ctx
    await prisma.character.update({ where: { id: me.id }, data: { guildId: null, guildRole: 'MEMBER' } })
    socket.leave(guildRoom(g.id))
    if (g.leaderId === me.id) {
      const next = await prisma.character.findFirst({ where: { guildId: g.id }, orderBy: { id: 'asc' } })
      if (next) {
        await prisma.guild.update({ where: { id: g.id }, data: { leaderId: next.id } })
        await prisma.character.update({ where: { id: next.id }, data: { guildRole: 'MEMBER' } })
      } else await prisma.guild.delete({ where: { id: g.id } })
    }
    io.to(guildRoom(g.id)).emit('guild:member_left', { name: me.name })
    ack?.({ ok: true })
  })

  // bang chủ đá được mọi người, phó bang chỉ đá được thành viên thường
  socket.on('guild:kick', async (data: unknown, ack?: Ack) => {
    const parsed = z.object({ name: z.string() }).safeParse(data)
    if (!parsed.success) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const ctx = await context()
    if ('error' in ctx) return ack?.(ctx)
    if (ctx.role === 'MEMBER') return ack?.({ error: 'Không đủ quyền' })
    const target = await memberByName(ctx.guild.id, parsed.data.name)
    if (!target) return ack?.({ error: 'Không có thành viên này' })
    if (target.id === ctx.me.id) return ack?.({ error: 'Không thể tự đá mình, hãy rời bang' })
    if (ctx.role === 'DEPUTY' && (target.id === ctx.guild.leaderId || target.guildRole === 'DEPUTY')) {
      return ack?.({ error: 'Không đủ quyền' })
    }
    await prisma.character.update({ where: { id: target.id }, data: { guildId: null, guildRole: 'MEMBER' } })
    const ts = socketOf(io, target.id)
    if (ts) {
      ts.leave(guildRoom(ctx.guild.id))
      ts.emit('guild:kicked', { guildName: ctx.guild.name })
    }
    io.to(guildRoom(ctx.guild.id)).emit('guild:member_left', { name: target.name })
    ack?.({ ok: true })
  })

  // bang chủ nhường chức; bang chủ cũ thành thành viên thường
  socket.on('guild:transfer', async (data: unknown, ack?: Ack) => {
    const parsed = z.object({ name: z.string() }).safeParse(data)
    if (!parsed.success) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const ctx = await context()
    if ('error' in ctx) return ack?.(ctx)
    if (ctx.role !== 'LEADER') return ack?.({ error: 'Chỉ bang chủ được nhường chức' })
    const target = await memberByName(ctx.guild.id, parsed.data.name)
    if (!target || target.id === ctx.me.id) return ack?.({ error: 'Không có thành viên này' })
    await prisma.guild.update({ where: { id: ctx.guild.id }, data: { leaderId: target.id } })
    await prisma.character.update({ where: { id: target.id }, data: { guildRole: 'MEMBER' } })
    io.to(guildRoom(ctx.guild.id)).emit('guild:leader_changed', { name: target.name })
    ack?.({ guild: await guildInfo(io, ctx.guild.id) })
  })

  // bang chủ bổ nhiệm / bãi nhiệm phó bang
  for (const [event, role] of [['guild:promote', 'DEPUTY'], ['guild:demote', 'MEMBER']] as const) {
    socket.on(event, async (data: unknown, ack?: Ack) => {
      const parsed = z.object({ name: z.string() }).safeParse(data)
      if (!parsed.success) return ack?.({ error: 'Dữ liệu không hợp lệ' })
      const ctx = await context()
      if ('error' in ctx) return ack?.(ctx)
      if (ctx.role !== 'LEADER') return ack?.({ error: 'Chỉ bang chủ được bổ nhiệm' })
      const target = await memberByName(ctx.guild.id, parsed.data.name)
      if (!target || target.id === ctx.me.id) return ack?.({ error: 'Không có thành viên này' })
      await prisma.character.update({ where: { id: target.id }, data: { guildRole: role } })
      io.to(guildRoom(ctx.guild.id)).emit('guild:role_changed', { name: target.name, role })
      ack?.({ guild: await guildInfo(io, ctx.guild.id) })
    })
  }
}
