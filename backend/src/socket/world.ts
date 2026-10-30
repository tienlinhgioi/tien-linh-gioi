// Trạng thái thế giới trong RAM: người chơi và quái, mỗi map là một room
import type { Server } from 'socket.io'
import { prisma } from '../lib/prisma'
import {
  VIEW_RADIUS, MAP_SIZE, TICK_MS, MONSTERS_PER_MAP, MONSTER_NAME, MONSTER_SPEED,
  PLAYER_SPEED, CAST_RANGE, CAST_COOLDOWN_MS, BASE_DAMAGE, MONSTER_HP, MONSTER_RESPAWN_MS,
} from '../data'

export interface Player {
  socketId: string
  characterId: number
  name: string
  realmOrder: number
  subRealm: number
  mapId: number
  x: number
  y: number
  lastMoveAt: number
  lastCastAt: number
  dirty: boolean
  visiblePlayers: Set<string> // socketId
  visibleMonsters: Set<number>
}

interface Monster {
  id: number
  mapId: number
  name: string
  x: number
  y: number
  tx: number
  ty: number
  hp: number
  maxHp: number
  respawnAt: number // 0 = đang sống
}

export const players = new Map<string, Player>() // key: socket.id
const monsters: Monster[] = []

export const mapRoom = (mapId: number) => `map:${mapId}`

const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= VIEW_RADIUS ** 2

const pub = (p: Player) => ({ characterId: p.characterId, name: p.name, mapId: p.mapId, x: p.x, y: p.y })
const pubMonster = (m: Monster) => ({ id: m.id, name: m.name, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp })

function link(io: Server, a: Player, b: Player) {
  a.visiblePlayers.add(b.socketId)
  b.visiblePlayers.add(a.socketId)
  io.to(a.socketId).emit('player:joined', pub(b))
  io.to(b.socketId).emit('player:joined', pub(a))
}

function unlink(io: Server, a: Player, b: Player) {
  a.visiblePlayers.delete(b.socketId)
  b.visiblePlayers.delete(a.socketId)
  io.to(a.socketId).emit('player:left', { characterId: b.characterId })
  io.to(b.socketId).emit('player:left', { characterId: a.characterId })
}

// Vào map: trả về người và quái ở gần
export function enterMap(io: Server, p: Player) {
  players.set(p.socketId, p)
  for (const o of players.values()) {
    if (o !== p && o.mapId === p.mapId && near(p, o)) {
      p.visiblePlayers.add(o.socketId)
      o.visiblePlayers.add(p.socketId)
      io.to(o.socketId).emit('player:joined', pub(p))
    }
  }
  const nearMonsters = monsters.filter((m) => !m.respawnAt && m.mapId === p.mapId && near(p, m))
  nearMonsters.forEach((m) => p.visibleMonsters.add(m.id))
  return {
    players: [...p.visiblePlayers].map((id) => pub(players.get(id)!)),
    monsters: nearMonsters.map(pubMonster),
  }
}

export function leaveMap(io: Server, p: Player) {
  for (const id of p.visiblePlayers) {
    const o = players.get(id)
    if (o) {
      o.visiblePlayers.delete(p.socketId)
      io.to(id).emit('player:left', { characterId: p.characterId })
    }
  }
  players.delete(p.socketId)
  void savePlayer(p)
}

// Trả về false nếu bị từ chối (ngoài map hoặc quá tốc độ); client sẽ nhận vị trí đúng của server
export function movePlayer(io: Server, p: Player, x: number, y: number) {
  const now = Date.now()
  const dt = Math.min(now - p.lastMoveAt, 1000) / 1000
  const allowed = PLAYER_SPEED * Math.max(dt, TICK_MS / 1000)
  const outside = x < 0 || y < 0 || x > MAP_SIZE || y > MAP_SIZE
  if (outside || Math.hypot(x - p.x, y - p.y) > allowed) return false
  p.lastMoveAt = now
  p.x = x
  p.y = y
  p.dirty = true
  for (const o of players.values()) {
    if (o === p || o.mapId !== p.mapId) continue
    const was = p.visiblePlayers.has(o.socketId)
    const near_ = near(p, o)
    if (near_ && !was) link(io, p, o)
    else if (!near_ && was) unlink(io, p, o)
    else if (near_) io.to(o.socketId).emit('player:moved', { characterId: p.characterId, x, y })
  }
  return true
}

// Tấn công cơ bản vào quái; trả về kết quả hoặc lỗi
export function castAt(io: Server, p: Player, targetId: number) {
  const now = Date.now()
  if (now - p.lastCastAt < CAST_COOLDOWN_MS) return { error: 'Kỹ năng đang hồi' }
  const m = monsters.find((x) => x.id === targetId)
  if (!m || m.respawnAt || m.mapId !== p.mapId) return { error: 'Mục tiêu không hợp lệ' }
  if (Math.hypot(m.x - p.x, m.y - p.y) > CAST_RANGE) return { error: 'Quá xa' }
  p.lastCastAt = now
  const damage = BASE_DAMAGE * p.realmOrder
  m.hp = Math.max(0, m.hp - damage)
  const killed = m.hp === 0
  if (killed) m.respawnAt = now + MONSTER_RESPAWN_MS
  for (const o of players.values()) {
    if (o.visibleMonsters.has(m.id)) {
      io.to(o.socketId).emit('monster:hit', { id: m.id, hp: m.hp, damage, by: p.characterId })
    }
  }
  return { damage, hp: m.hp, killed }
}

export async function savePlayer(p: Player) {
  p.dirty = false
  await prisma.character
    .update({ where: { id: p.characterId }, data: { mapId: p.mapId, posX: p.x, posY: p.y } })
    .catch((e) => console.error('Lỗi ghi vị trí', e))
}

export async function saveDirty() {
  await Promise.all([...players.values()].filter((p) => p.dirty).map(savePlayer))
}

export async function saveAll() {
  await Promise.all([...players.values()].map(savePlayer))
}

// ---- Quái + game loop ----
const rand = () => Math.random() * MAP_SIZE

export async function spawnMonsters() {
  const maps = await prisma.gameMap.findMany()
  let id = 1
  for (const map of maps) {
    for (let i = 0; i < MONSTERS_PER_MAP; i++) {
      const x = rand()
      const y = rand()
      monsters.push({ id: id++, mapId: map.id, name: MONSTER_NAME, x, y, tx: x, ty: y, hp: MONSTER_HP, maxHp: MONSTER_HP, respawnAt: 0 })
    }
  }
}

function moveMonsters(dt: number) {
  for (const m of monsters) {
    if (m.respawnAt) continue
    const dx = m.tx - m.x
    const dy = m.ty - m.y
    const d = Math.hypot(dx, dy)
    const step = MONSTER_SPEED * dt
    if (d <= step) {
      m.x = m.tx
      m.y = m.ty
      m.tx = rand()
      m.ty = rand()
    } else {
      m.x += (dx / d) * step
      m.y += (dy / d) * step
    }
  }
}

function respawnMonsters() {
  const now = Date.now()
  for (const m of monsters) {
    if (m.respawnAt && now >= m.respawnAt) {
      m.respawnAt = 0
      m.hp = m.maxHp
      m.x = m.tx = rand()
      m.y = m.ty = rand()
    }
  }
}

function tick(io: Server) {
  respawnMonsters()
  moveMonsters(TICK_MS / 1000)
  for (const p of players.values()) {
    const appeared: ReturnType<typeof pubMonster>[] = []
    const update: { id: number; x: number; y: number }[] = []
    const seen = new Set<number>()
    for (const m of monsters) {
      if (m.respawnAt || m.mapId !== p.mapId || !near(p, m)) continue
      seen.add(m.id)
      if (p.visibleMonsters.has(m.id)) update.push({ id: m.id, x: m.x, y: m.y })
      else appeared.push(pubMonster(m))
    }
    const gone = [...p.visibleMonsters].filter((id) => !seen.has(id))
    p.visibleMonsters = seen
    if (appeared.length) io.to(p.socketId).emit('monster:appeared', appeared)
    if (gone.length) io.to(p.socketId).emit('monster:disappeared', gone)
    if (update.length) io.to(p.socketId).emit('monster:update', update)
  }
}

export function startLoops(io: Server, saveIntervalMs: number) {
  setInterval(() => tick(io), TICK_MS)
  setInterval(() => void saveDirty(), saveIntervalMs)
}
