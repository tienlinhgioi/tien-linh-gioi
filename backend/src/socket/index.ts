import { Server, Socket } from 'socket.io'
import parser from 'socket.io-msgpack-parser'
import type { Server as HttpServer } from 'http'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { verifyToken } from '../lib/auth'
import { SUB_REALMS_PER_REALM } from '../data'
import { players, mapRoom, playersInMap } from './world'

type Ack = (res: unknown) => void

async function loadMe(accountId: number) {
  const c = await prisma.character.findUnique({
    where: { accountId },
    include: { realm: true, currencies: { include: { currency: true } } },
  })
  if (!c) return null
  return {
    id: c.id,
    name: c.name,
    realm: { order: c.realm.order, name: c.realm.name },
    subRealm: c.subRealm,
    currencies: c.currencies.map((x) => ({ code: x.currency.code, name: x.currency.name, amount: x.amount })),
  }
}

function leaveMap(io: Server, socket: Socket) {
  const p = players.get(socket.id)
  if (!p) return
  players.delete(socket.id)
  socket.leave(mapRoom(p.mapId))
  io.to(mapRoom(p.mapId)).emit('player:left', { characterId: p.characterId })
}

export function initSocket(http: HttpServer, origin: string) {
  const io = new Server(http, { parser, cors: { origin } })

  io.use((socket, next) => {
    const id = verifyToken(String(socket.handshake.auth?.token ?? ''))
    if (!id) return next(new Error('unauthorized'))
    socket.data.accountId = id
    next()
  })

  io.on('connection', (socket) => {
    const accountId: number = socket.data.accountId

    socket.on('data:static', async (ack?: Ack) => {
      const [realms, maps] = await Promise.all([
        prisma.realm.findMany({ orderBy: { order: 'asc' } }),
        prisma.gameMap.findMany(),
      ])
      ack?.({ realms, subRealmsPerRealm: SUB_REALMS_PER_REALM, maps })
    })

    // Thông tin người chơi; character = null nếu chưa tạo nhân vật
    socket.on('player:me', async (ack?: Ack) => {
      ack?.({ character: await loadMe(accountId) })
    })

    socket.on('character:create', async (data: unknown, ack?: Ack) => {
      const parsed = z.object({ name: z.string().trim().min(2).max(20) }).safeParse(data)
      if (!parsed.success) return ack?.({ error: 'Tên nhân vật không hợp lệ' })
      if (await prisma.character.findUnique({ where: { accountId } })) {
        return ack?.({ error: 'Tài khoản đã có nhân vật' })
      }
      if (await prisma.character.findUnique({ where: { name: parsed.data.name } })) {
        return ack?.({ error: 'Tên nhân vật đã tồn tại' })
      }
      const first = await prisma.realm.findUnique({ where: { order: 1 } })
      if (!first) return ack?.({ error: 'Chưa có dữ liệu cảnh giới' })
      await prisma.character.create({ data: { accountId, name: parsed.data.name, realmId: first.id } })
      ack?.({ character: await loadMe(accountId) })
    })

    socket.on('map:join', async (data: unknown, ack?: Ack) => {
      const parsed = z.object({ mapId: z.number().int() }).safeParse(data)
      if (!parsed.success) return ack?.({ error: 'Dữ liệu không hợp lệ' })
      const [char, map] = await Promise.all([
        prisma.character.findUnique({ where: { accountId } }),
        prisma.gameMap.findUnique({ where: { id: parsed.data.mapId } }),
      ])
      if (!char) return ack?.({ error: 'Chưa có nhân vật' })
      if (!map) return ack?.({ error: 'Map không tồn tại' })
      leaveMap(io, socket)
      const me = { characterId: char.id, name: char.name, mapId: map.id, x: 0, y: 0 }
      players.set(socket.id, me)
      socket.join(mapRoom(map.id))
      socket.to(mapRoom(map.id)).emit('player:joined', me)
      ack?.({ players: playersInMap(map.id) })
    })

    socket.on('map:leave', () => leaveMap(io, socket))

    // client chỉ gửi vị trí muốn tới, server giữ trạng thái
    socket.on('move', (data: unknown) => {
      const p = players.get(socket.id)
      const parsed = z.object({ x: z.number().finite(), y: z.number().finite() }).safeParse(data)
      if (!p || !parsed.success) return
      p.x = parsed.data.x
      p.y = parsed.data.y
      socket.to(mapRoom(p.mapId)).emit('player:moved', { characterId: p.characterId, x: p.x, y: p.y })
    })

    socket.on('disconnect', () => leaveMap(io, socket))
  })

  return io
}
