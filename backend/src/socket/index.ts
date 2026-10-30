import { Server, Socket } from 'socket.io'
import parser from 'socket.io-msgpack-parser'
import type { Server as HttpServer } from 'http'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { verifyToken } from '../lib/auth'
import { SUB_REALMS_PER_REALM, SAVE_INTERVAL_MS } from '../data'
import { Player, players, mapRoom, enterMap, leaveMap, movePlayer, savePlayer, startLoops, spawnMonsters } from './world'

type Ack = (res: unknown) => void

async function loadMe(accountId: number) {
  const c = await prisma.character.findUnique({
    where: { accountId },
    include: { realm: true, currencies: true },
  })
  if (!c) return null
  const all = await prisma.currency.findMany({ orderBy: { id: 'asc' } })
  return {
    id: c.id,
    name: c.name,
    realm: { order: c.realm.order, name: c.realm.name },
    subRealm: c.subRealm,
    currencies: all.map((cur) => ({
      code: cur.code,
      name: cur.name,
      amount: c.currencies.find((x) => x.currencyId === cur.id)?.amount ?? 0,
    })),
    map: c.mapId === null ? null : { id: c.mapId, x: c.posX, y: c.posY },
  }
}

export async function initSocket(http: HttpServer, origin: string) {
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

    // client có thể gửi { mapId } hoặc chỉ ack để vào lại map đã lưu
    socket.on('map:join', async (data: unknown, ack?: Ack) => {
      if (typeof data === 'function') {
        ack = data as Ack
        data = {}
      }
      const parsed = z.object({ mapId: z.number().int().optional() }).safeParse(data)
      if (!parsed.success) return ack?.({ error: 'Dữ liệu không hợp lệ' })
      const char = await prisma.character.findUnique({ where: { accountId } })
      if (!char) return ack?.({ error: 'Chưa có nhân vật' })
      const mapId = parsed.data.mapId ?? char.mapId
      if (mapId === null) return ack?.({ error: 'Chưa chọn map' })
      const map = await prisma.gameMap.findUnique({ where: { id: mapId } })
      if (!map) return ack?.({ error: 'Map không tồn tại' })
      const old = players.get(socket.id)
      if (old) leaveMap(io, old)
      socket.join(mapRoom(map.id))
      const same = char.mapId === map.id
      const me: Player = {
        socketId: socket.id,
        characterId: char.id,
        name: char.name,
        mapId: map.id,
        x: same ? char.posX : 0,
        y: same ? char.posY : 0,
        dirty: false,
        visiblePlayers: new Set(),
        visibleMonsters: new Set(),
      }
      const view = enterMap(io, me)
      void savePlayer(me)
      ack?.({ x: me.x, y: me.y, ...view })
    })

    const leave = () => {
      const p = players.get(socket.id)
      if (p) {
        socket.leave(mapRoom(p.mapId))
        leaveMap(io, p)
      }
    }
    socket.on('map:leave', leave)

    // client chỉ gửi vị trí muốn tới, server giữ trạng thái
    socket.on('move', (data: unknown) => {
      const p = players.get(socket.id)
      const parsed = z.object({ x: z.number().finite(), y: z.number().finite() }).safeParse(data)
      if (!p || !parsed.success) return
      movePlayer(io, p, parsed.data.x, parsed.data.y)
    })

    socket.on('disconnect', leave)
  })

  await spawnMonsters()
  startLoops(io, SAVE_INTERVAL_MS)

  return io
}
