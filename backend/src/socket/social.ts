import type { Server, Socket } from 'socket.io'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { CHAT_COOLDOWN_MS, CHAT_MAX_LENGTH, REQUEST_TTL_MS } from '../data'
import { Ack, charOf, socketOf } from './common'

const requests = new Map<string, number>() // "từ:đến" -> hết hạn
const nameSchema = z.object({ name: z.string() })

export function registerSocial(io: Server, socket: Socket) {
  const byName = (name: string) => prisma.character.findUnique({ where: { name } })
  const isBlocked = async (a: number, b: number) =>
    (await prisma.block.count({ where: { OR: [{ characterId: a, blockedId: b }, { characterId: b, blockedId: a }] } })) > 0

  socket.on('friend:list', async (ack?: Ack) => {
    const c = await charOf(socket)
    if (!c) return ack?.({ error: 'Chưa có nhân vật' })
    const [friends, blocks] = await Promise.all([
      prisma.friend.findMany({ where: { characterId: c.id } }),
      prisma.block.findMany({ where: { characterId: c.id } }),
    ])
    const people = await prisma.character.findMany({ where: { id: { in: [...friends.map((f) => f.friendId), ...blocks.map((b) => b.blockedId)] } } })
    const nameOf = (id: number) => people.find((x) => x.id === id)?.name ?? '?'
    ack?.({
      friends: friends.map((f) => ({ name: nameOf(f.friendId), online: !!socketOf(io, f.friendId) })),
      blocked: blocks.map((b) => nameOf(b.blockedId)),
    })
  })

  // kết bạn cần người kia đồng ý; người được mời phải đang online
  socket.on('friend:request', async (data: unknown, ack?: Ack) => {
    const parsed = nameSchema.safeParse(data)
    const c = await charOf(socket)
    if (!parsed.success || !c) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const t = await byName(parsed.data.name)
    if (!t) return ack?.({ error: 'Không tìm thấy người chơi' })
    if (t.id === c.id) return ack?.({ error: 'Không thể kết bạn với chính mình' })
    if (await prisma.friend.findUnique({ where: { characterId_friendId: { characterId: c.id, friendId: t.id } } })) {
      return ack?.({ error: 'Đã là bạn bè' })
    }
    if (await isBlocked(c.id, t.id)) return ack?.({ error: 'Không thể kết bạn với người này' })
    const ts = socketOf(io, t.id)
    if (!ts) return ack?.({ error: 'Người này đang offline' })
    requests.set(`${c.id}:${t.id}`, Date.now() + REQUEST_TTL_MS)
    ts.emit('friend:requested', { from: c.name })
    ack?.({ ok: true })
  })

  socket.on('friend:accept', async (data: unknown, ack?: Ack) => {
    const parsed = nameSchema.safeParse(data)
    const c = await charOf(socket)
    if (!parsed.success || !c) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const from = await byName(parsed.data.name)
    const key = from && `${from.id}:${c.id}`
    if (!from || !key || (requests.get(key) ?? 0) < Date.now()) return ack?.({ error: 'Không có lời mời hợp lệ' })
    requests.delete(key)
    if (await isBlocked(c.id, from.id)) return ack?.({ error: 'Không thể kết bạn với người này' })
    await prisma.friend.createMany({
      data: [{ characterId: c.id, friendId: from.id }, { characterId: from.id, friendId: c.id }],
      skipDuplicates: true,
    })
    socketOf(io, from.id)?.emit('friend:added', { name: c.name })
    ack?.({ ok: true })
  })

  socket.on('friend:remove', async (data: unknown, ack?: Ack) => {
    const parsed = nameSchema.safeParse(data)
    const c = await charOf(socket)
    if (!parsed.success || !c) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const t = await byName(parsed.data.name)
    if (!t) return ack?.({ error: 'Không tìm thấy người chơi' })
    const r = await prisma.friend.deleteMany({
      where: { OR: [{ characterId: c.id, friendId: t.id }, { characterId: t.id, friendId: c.id }] },
    })
    ack?.(r.count === 0 ? { error: 'Không phải bạn bè' } : { ok: true })
  })

  // chặn: xóa quan hệ bạn bè, không nhận chat và không nhận lời mời của người bị chặn
  socket.on('block:add', async (data: unknown, ack?: Ack) => {
    const parsed = nameSchema.safeParse(data)
    const c = await charOf(socket)
    if (!parsed.success || !c) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const t = await byName(parsed.data.name)
    if (!t || t.id === c.id) return ack?.({ error: 'Không tìm thấy người chơi' })
    await prisma.block.createMany({ data: [{ characterId: c.id, blockedId: t.id }], skipDuplicates: true })
    await prisma.friend.deleteMany({
      where: { OR: [{ characterId: c.id, friendId: t.id }, { characterId: t.id, friendId: c.id }] },
    })
    socket.data.blocked.add(t.id)
    ack?.({ ok: true })
  })

  socket.on('block:remove', async (data: unknown, ack?: Ack) => {
    const parsed = nameSchema.safeParse(data)
    const c = await charOf(socket)
    if (!parsed.success || !c) return ack?.({ error: 'Dữ liệu không hợp lệ' })
    const t = await byName(parsed.data.name)
    if (!t) return ack?.({ error: 'Không tìm thấy người chơi' })
    const r = await prisma.block.deleteMany({ where: { characterId: c.id, blockedId: t.id } })
    socket.data.blocked.delete(t.id)
    ack?.(r.count === 0 ? { error: 'Chưa chặn người này' } : { ok: true })
  })

  // chat riêng theo tên nhân vật
  socket.on('chat:whisper', async (data: unknown, ack?: Ack) => {
    const parsed = z.object({ to: z.string(), text: z.string().trim().min(1).max(CHAT_MAX_LENGTH) }).safeParse(data)
    const c = await charOf(socket)
    if (!parsed.success || !c) return ack?.({ error: 'Tin nhắn không hợp lệ' })
    const now = Date.now()
    if (now - (socket.data.lastWhisper ?? 0) < CHAT_COOLDOWN_MS.whisper) return ack?.({ error: 'Gửi quá nhanh' })
    const t = await byName(parsed.data.to)
    if (!t || t.id === c.id) return ack?.({ error: 'Không tìm thấy người chơi' })
    const ts = socketOf(io, t.id)
    if (!ts) return ack?.({ error: 'Người này đang offline' })
    if (await isBlocked(c.id, t.id)) return ack?.({ error: 'Không thể gửi tin cho người này' })
    socket.data.lastWhisper = now
    const msg = { channel: 'whisper', from: c.name, to: t.name, text: parsed.data.text, at: now }
    ts.emit('chat:message', msg)
    socket.emit('chat:message', msg)
    ack?.({ ok: true })
  })
}
