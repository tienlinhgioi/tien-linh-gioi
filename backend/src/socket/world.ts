// Trạng thái thế giới trong RAM: người chơi và quái, mỗi map là một room
import type { Server } from 'socket.io'
import { prisma } from '../lib/prisma'
import {
  VIEW_RADIUS, MAP_SIZE, TICK_MS, MONSTER_SPAWNS, PLAYER_SPEED, SKILLS, BASE_DAMAGE,
  MONSTER_RESPAWN_MS, PLAYER_BASE_HP, AGGRO_RANGE, MONSTER_ATTACK_RANGE, MONSTER_ATTACK_COOLDOWN_MS,
  MONSTER_CHASE_FACTOR, RESPAWN_DELAY_MS, RESPAWN_POINT,
} from '../data'

export interface Player {
  socketId: string
  characterId: number
  name: string
  realmOrder: number
  subRealm: number
  hp: number
  maxHp: number
  bonusAtk: number
  bonusHp: number
  dead: boolean
  mapId: number
  x: number
  y: number
  lastMoveAt: number
  skills: Set<string> // kỹ năng đã học
  skillReadyAt: Record<string, number>
  dirty: boolean
  visiblePlayers: Set<string> // socketId
  visibleMonsters: Set<number>
  respawnTimer?: NodeJS.Timeout
}

interface Monster {
  id: number
  typeId: number
  code: string
  name: string
  atk: number
  speed: number
  mapId: number
  x: number
  y: number
  tx: number
  ty: number
  hp: number
  maxHp: number
  respawnAt: number // 0 = đang sống
  nextAttackAt: number
}

export const players = new Map<string, Player>() // key: socket.id
const monsters: Monster[] = []

export const mapRoom = (mapId: number) => `map:${mapId}`
export const maxHpOf = (realmOrder: number, bonusHp = 0) => PLAYER_BASE_HP * realmOrder + bonusHp

const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= VIEW_RADIUS ** 2

const pub = (p: Player) => ({ characterId: p.characterId, name: p.name, mapId: p.mapId, x: p.x, y: p.y })
const pubMonster = (m: Monster) => ({ id: m.id, type: m.code, name: m.name, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp })

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

// Cập nhật ai thấy ai sau khi p đổi vị trí; moved = có báo player:moved cho người đang thấy p
function syncVisibility(io: Server, p: Player, moved: boolean) {
  for (const o of players.values()) {
    if (o === p || o.mapId !== p.mapId) continue
    const was = p.visiblePlayers.has(o.socketId)
    const now = near(p, o)
    if (now && !was) link(io, p, o)
    else if (!now && was) unlink(io, p, o)
    else if (now && moved) io.to(o.socketId).emit('player:moved', { characterId: p.characterId, x: p.x, y: p.y })
  }
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
  clearTimeout(p.respawnTimer)
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

// Trả về false nếu bị từ chối (ngoài map, quá tốc độ hoặc đã chết); client sẽ nhận vị trí đúng của server
export function movePlayer(io: Server, p: Player, x: number, y: number) {
  if (p.dead) return false
  const now = Date.now()
  const dt = Math.min(now - p.lastMoveAt, 1000) / 1000
  const allowed = PLAYER_SPEED * Math.max(dt, TICK_MS / 1000)
  const outside = x < 0 || y < 0 || x > MAP_SIZE || y > MAP_SIZE
  if (outside || Math.hypot(x - p.x, y - p.y) > allowed) return false
  p.lastMoveAt = now
  p.x = x
  p.y = y
  p.dirty = true
  syncVisibility(io, p, true)
  return true
}

// ---- Máu người chơi ----
const sendHp = (io: Server, p: Player) => io.to(p.socketId).emit('player:hp', { hp: p.hp, maxHp: p.maxHp })

export function healPlayer(io: Server, p: Player, amount: number) {
  if (p.dead) return
  p.hp = Math.min(p.maxHp, p.hp + amount)
  sendHp(io, p)
}

// Đổi cảnh giới thì máu tối đa đổi theo, hồi đầy máu
export function refreshRealm(io: Server, p: Player, realmOrder: number, subRealm: number) {
  p.realmOrder = realmOrder
  p.subRealm = subRealm
  p.maxHp = maxHpOf(realmOrder, p.bonusHp)
  if (!p.dead) p.hp = p.maxHp
  sendHp(io, p)
}

// Mặc/tháo trang bị: đổi chỉ số, giữ nguyên máu hiện tại (không vượt tối đa)
export function setBonuses(io: Server, p: Player, atk: number, hp: number) {
  p.bonusAtk = atk
  p.bonusHp = hp
  p.maxHp = maxHpOf(p.realmOrder, hp)
  p.hp = Math.min(p.hp, p.maxHp)
  sendHp(io, p)
}

function hurtPlayer(io: Server, p: Player, damage: number) {
  p.hp = Math.max(0, p.hp - damage)
  sendHp(io, p)
  if (p.hp > 0) return
  p.dead = true
  io.to(p.socketId).emit('player:died', { respawnIn: RESPAWN_DELAY_MS })
  p.respawnTimer = setTimeout(() => respawn(io, p), RESPAWN_DELAY_MS)
}

function respawn(io: Server, p: Player) {
  p.dead = false
  p.hp = p.maxHp
  p.x = RESPAWN_POINT.x
  p.y = RESPAWN_POINT.y
  p.lastMoveAt = Date.now()
  p.dirty = true
  io.to(p.socketId).emit('player:respawned', { x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp })
  syncVisibility(io, p, true)
}

// Dùng kỹ năng lên quái; trả về kết quả hoặc lỗi
export function castAt(io: Server, p: Player, targetId: number, skillCode: string) {
  if (p.dead) return { error: 'Đã chết' }
  const skill = SKILLS.find((x) => x.code === skillCode)
  if (!skill) return { error: 'Kỹ năng không tồn tại' }
  if (!p.skills.has(skill.code)) return { error: 'Chưa học kỹ năng' }
  const now = Date.now()
  if (now < (p.skillReadyAt[skill.code] ?? 0)) return { error: 'Kỹ năng đang hồi' }
  const m = monsters.find((x) => x.id === targetId)
  if (!m || m.respawnAt || m.mapId !== p.mapId) return { error: 'Mục tiêu không hợp lệ' }
  if (Math.hypot(m.x - p.x, m.y - p.y) > skill.range) return { error: 'Quá xa' }
  p.skillReadyAt[skill.code] = now + skill.cooldownMs
  const damage = Math.round(skill.damageMult * (BASE_DAMAGE * p.realmOrder + p.bonusAtk))
  m.hp = Math.max(0, m.hp - damage)
  const killed = m.hp === 0
  if (killed) m.respawnAt = now + MONSTER_RESPAWN_MS
  for (const o of players.values()) {
    if (o.visibleMonsters.has(m.id)) {
      io.to(o.socketId).emit('monster:hit', { id: m.id, hp: m.hp, damage, by: p.characterId, skill: skill.code })
    }
  }
  return { damage, hp: m.hp, killed, typeId: m.typeId }
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
  const [maps, types] = await Promise.all([prisma.gameMap.findMany(), prisma.monsterType.findMany()])
  let id = 1
  for (const map of maps) {
    for (const spawn of MONSTER_SPAWNS) {
      const t = types.find((x) => x.code === spawn.type)
      if (!t) continue
      for (let i = 0; i < spawn.count; i++) {
        const x = rand()
        const y = rand()
        monsters.push({
          id: id++, typeId: t.id, code: t.code, name: t.name, atk: t.atk, speed: t.speed, mapId: map.id,
          x, y, tx: x, ty: y, hp: t.hp, maxHp: t.hp, respawnAt: 0, nextAttackAt: 0,
        })
      }
    }
  }
}

function stepToward(m: Monster, tx: number, ty: number, step: number) {
  const dx = tx - m.x
  const dy = ty - m.y
  const d = Math.hypot(dx, dy)
  if (d <= step) {
    m.x = tx
    m.y = ty
    return true
  }
  m.x += (dx / d) * step
  m.y += (dy / d) * step
  return false
}

function nearestTarget(m: Monster) {
  let best: Player | null = null
  let bestD = AGGRO_RANGE
  for (const p of players.values()) {
    if (p.dead || p.mapId !== m.mapId) continue
    const d = Math.hypot(p.x - m.x, p.y - m.y)
    if (d <= bestD) {
      best = p
      bestD = d
    }
  }
  return best
}

// Quái đuổi người chơi gần nhất trong tầm; không có thì đi lang thang
function updateMonsters(io: Server, dt: number) {
  const now = Date.now()
  for (const m of monsters) {
    if (m.respawnAt) continue
    const target = nearestTarget(m)
    if (target) {
      if (Math.hypot(target.x - m.x, target.y - m.y) > MONSTER_ATTACK_RANGE) {
        stepToward(m, target.x, target.y, m.speed * MONSTER_CHASE_FACTOR * dt)
      } else if (now >= m.nextAttackAt) {
        m.nextAttackAt = now + MONSTER_ATTACK_COOLDOWN_MS
        for (const o of players.values()) {
          if (o.visibleMonsters.has(m.id)) {
            io.to(o.socketId).emit('monster:attack', { id: m.id, targetCharacterId: target.characterId, damage: m.atk })
          }
        }
        hurtPlayer(io, target, m.atk)
      }
      continue
    }
    if (stepToward(m, m.tx, m.ty, m.speed * dt)) {
      m.tx = rand()
      m.ty = rand()
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
  updateMonsters(io, TICK_MS / 1000)
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
