// Trạng thái thế giới trong RAM: người chơi và quái, mỗi map là một room
import type { Server } from 'socket.io'
import { prisma } from '../lib/prisma'
import { VIEW_RADIUS, MAP_SIZE, TICK_MS, MONSTERS_PER_MAP, MONSTER_NAME, MONSTER_SPEED } from '../data'

export interface Player {
  socketId: string
  characterId: number
  name: string
  mapId: number
  x: number
  y: number
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
}

export const players = new Map<string, Player>() // key: socket.id
const monsters: Monster[] = []

export const mapRoom = (mapId: number) => `map:${mapId}`

const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= VIEW_RADIUS ** 2

const pub = (p: Player) => ({ characterId: p.characterId, name: p.name, mapId: p.mapId, x: p.x, y: p.y })
const pubMonster = (m: Monster) => ({ id: m.id, name: m.name, x: m.x, y: m.y })

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
  const nearMonsters = monsters.filter((m) => m.mapId === p.mapId && near(p, m))
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

export function movePlayer(io: Server, p: Player, x: number, y: number) {
  p.x = x
  p.y = y
  p.dirty = true
  for (const o of players.values()) {
    if (o === p || o.mapId !== p.mapId) continue
    const was = p.visiblePlayers.has(o.socketId)
    const now = near(p, o)
    if (now && !was) link(io, p, o)
    else if (!now && was) unlink(io, p, o)
    else if (now) io.to(o.socketId).emit('player:moved', { characterId: p.characterId, x, y })
  }
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
      monsters.push({ id: id++, mapId: map.id, name: MONSTER_NAME, x, y, tx: x, ty: y })
    }
  }
}

function moveMonsters(dt: number) {
  for (const m of monsters) {
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

function tick(io: Server) {
  moveMonsters(TICK_MS / 1000)
  for (const p of players.values()) {
    const appeared: ReturnType<typeof pubMonster>[] = []
    const update: { id: number; x: number; y: number }[] = []
    const seen = new Set<number>()
    for (const m of monsters) {
      if (m.mapId !== p.mapId || !near(p, m)) continue
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
