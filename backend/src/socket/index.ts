import { Server } from 'socket.io'
import parser from 'socket.io-msgpack-parser'
import type { Server as HttpServer } from 'http'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { verifyToken } from '../lib/auth'
import { SUB_REALMS_PER_REALM, SAVE_INTERVAL_MS, CHAT_MAX_LENGTH, CHAT_COOLDOWN_MS, expNeeded, SKILLS, BASIC_SKILL, SHOP_NPC } from '../data'
import { breakthrough } from '../cultivation'
import { giveLoot } from '../loot'
import {
  Player, players, mapRoom, enterMap, leaveMap, movePlayer, castAt, savePlayer, startLoops, spawnMonsters,
  maxHpOf, refreshRealm,
} from './world'
import { Ack, loadMe, charOf, guildRoom } from './common'
import { registerInventory } from './inventory'
import { registerGuild } from './guild'
import { registerEquipment, loadBonuses } from './equipment'
import { registerShop } from './shop'

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
      await charOf(socket)
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
      socket.data.char = undefined
      await charOf(socket)
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
      const char = await prisma.character.findUnique({ where: { accountId }, include: { realm: true } })
      if (!char) return ack?.({ error: 'Chưa có nhân vật' })
      const mapId = parsed.data.mapId ?? char.mapId
      if (mapId === null) return ack?.({ error: 'Chưa chọn map' })
      const map = await prisma.gameMap.findUnique({ where: { id: mapId } })
      if (!map) return ack?.({ error: 'Map không tồn tại' })
      await charOf(socket)
      const old = players.get(socket.id)
      if (old) leaveMap(io, old)
      socket.join(mapRoom(map.id))
      const same = char.mapId === map.id
      const bonus = await loadBonuses(char.id)
      const me: Player = {
        socketId: socket.id,
        characterId: char.id,
        name: char.name,
        realmOrder: char.realm.order,
        subRealm: char.subRealm,
        hp: maxHpOf(char.realm.order, bonus.hp),
        maxHp: maxHpOf(char.realm.order, bonus.hp),
        bonusAtk: bonus.atk,
        bonusHp: bonus.hp,
        dead: false,
        mapId: map.id,
        x: same ? char.posX : 0,
        y: same ? char.posY : 0,
        lastMoveAt: Date.now(),
        skillReadyAt: {},
        dirty: false,
        visiblePlayers: new Set(),
        visibleMonsters: new Set(),
      }
      const view = enterMap(io, me)
      void savePlayer(me)
      ack?.({ x: me.x, y: me.y, hp: me.hp, maxHp: me.maxHp, npcs: [SHOP_NPC], ...view })
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
      if (!movePlayer(io, p, parsed.data.x, parsed.data.y)) socket.emit('move:rejected', { x: p.x, y: p.y })
    })

    // chat theo map hoặc thế giới, có giới hạn tần suất
    socket.on('chat:send', async (data: unknown, ack?: Ack) => {
      const parsed = z
        .object({ channel: z.enum(['map', 'world', 'guild']), text: z.string().trim().min(1).max(CHAT_MAX_LENGTH) })
        .safeParse(data)
      if (!parsed.success) return ack?.({ error: 'Tin nhắn không hợp lệ' })
      const { channel, text } = parsed.data
      const last: Record<string, number> = (socket.data.lastChat ??= {})
      const now = Date.now()
      if (now - (last[channel] ?? 0) < CHAT_COOLDOWN_MS[channel]) return ack?.({ error: 'Gửi quá nhanh' })
      const p = players.get(socket.id)
      if (channel === 'map' && !p) return ack?.({ error: 'Chưa vào map' })
      const me = await charOf(socket)
      if (!me) return ack?.({ error: 'Chưa có nhân vật' })
      const msg = { channel, from: me.name, text, at: now }
      if (channel === 'guild') {
        const { guildId } = await prisma.character.findUniqueOrThrow({ where: { id: me.id } })
        if (!guildId) return ack?.({ error: 'Chưa ở trong bang' })
        last[channel] = now
        io.to(guildRoom(guildId)).emit('chat:message', msg)
        return ack?.({ ok: true })
      }
      last[channel] = now
      if (channel === 'map') io.to(mapRoom(p!.mapId)).emit('chat:message', msg)
      else io.emit('chat:message', msg)
      ack?.({ ok: true })
    })

    // danh sách kỹ năng và kỹ năng đã mở khóa theo cảnh giới hiện tại
    socket.on('skill:list', async (ack?: Ack) => {
      const c = await prisma.character.findUnique({ where: { accountId }, include: { realm: true } })
      if (!c) return ack?.({ error: 'Chưa có nhân vật' })
      ack?.({ skills: SKILLS.map((k) => ({ ...k, unlocked: c.realm.order >= k.minRealm })) })
    })

    // tấn công quái: { targetId, skill? } (mặc định đòn cơ bản)
    socket.on('cast', async (data: unknown, ack?: Ack) => {
      const p = players.get(socket.id)
      const parsed = z.object({ targetId: z.number().int(), skill: z.string().optional() }).safeParse(data)
      if (!p || !parsed.success) return ack?.({ error: 'Dữ liệu không hợp lệ' })
      const res = castAt(io, p, parsed.data.targetId, parsed.data.skill ?? BASIC_SKILL)
      if ('killed' in res && res.killed) {
        const loot = await giveLoot(p.characterId, res.typeId)
        const { exp } = await prisma.character.findUniqueOrThrow({ where: { id: p.characterId } })
        socket.emit('player:loot', loot)
        socket.emit('player:exp', { exp, expNeeded: expNeeded(p.realmOrder, p.subRealm) })
      }
      ack?.(res)
    })

    // đột phá tiểu cảnh / cảnh giới
    socket.on('cultivate:breakthrough', async (ack?: Ack) => {
      const res = await breakthrough(accountId)
      if ('error' in res) return ack?.(res)
      const p = players.get(socket.id)
      if (p) refreshRealm(io, p, res.realmOrder, res.subRealm)
      ack?.({ character: await loadMe(accountId) })
    })

    registerInventory(io, socket)
    registerGuild(io, socket)
    registerEquipment(io, socket)
    registerShop(io, socket)

    socket.on('disconnect', leave)
  })

  await spawnMonsters()
  startLoops(io, SAVE_INTERVAL_MS)

  return io
}
