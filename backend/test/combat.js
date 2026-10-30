// Kiểm thử: quái tấn công, người chơi chết/hồi sinh, túi đồ. Cần server đang chạy.
const { PrismaClient } = require('@prisma/client')
const { T, emit, sleep, connect, check, findMonster } = require('./util')
const prisma = new PrismaClient()

;(async () => {
  const a = await connect('ca'); const c = await connect('cc')
  const ch = (await emit(a.s, 'character:create', { name: `CA ${T}` })).character
  const chC = (await emit(c.s, 'character:create', { name: `CC ${T}` })).character
  const maps = (await emit(a.s, 'data:static')).maps
  const item = code => prisma.item.findUniqueOrThrow({ where: { code } })
  const give = async (id, code, count) => prisma.inventoryItem.upsert({
    where: { characterId_itemId: { characterId: id, itemId: (await item(code)).id } }, update: { count }, create: { characterId: id, itemId: (await item(code)).id, count },
  })

  // ---- túi đồ khi chưa vào map ----
  await give(chC.id, 'linh_duoc', 1)
  check('hồi máu khi chưa vào map -> lỗi', (await emit(c.s, 'inventory:use', { code: 'linh_duoc' })).error === 'Cần ở trong map và còn sống')
  check('vật phẩm không bị mất khi lỗi', (await emit(c.s, 'inventory:get')).items[0].count === 1)

  // ---- quái tấn công, chết, hồi sinh ----
  const found = await findMonster(prisma, a.s, ch.id, maps, 'son_quai')
  check('tìm thấy Sơn Quái', !!found)
  if (!found) process.exit(1)
  // đứng ngay cạnh quái để bị đánh
  const mon = found.monster
  await prisma.character.update({ where: { id: ch.id }, data: { mapId: found.mapId, posX: mon.x, posY: mon.y } })
  const hpLog = []; let died = null, respawned = null, attacks = 0
  a.s.on('player:hp', h => hpLog.push(h.hp))
  a.s.on('player:died', d => (died = d))
  a.s.on('player:respawned', r => (respawned = r))
  a.s.on('monster:attack', () => attacks++)
  const j = await emit(a.s, 'map:join', { mapId: found.mapId })
  check('vào map có máu đầy', j.hp === 100 && j.maxHp === 100)

  for (let i = 0; i < 40 && !died; i++) await sleep(500)
  check('quái đánh làm mất máu', hpLog.length >= 2 && hpLog[0] < 100 && attacks >= 1)
  check('hết máu thì chết', !!died && hpLog[hpLog.length - 1] === 0)
  const rej = []; a.s.on('move:rejected', r => rej.push(r))
  a.s.emit('move', { x: 1, y: 1 }); await sleep(150)
  check('người chết không đi được', rej.length === 1)
  check('người chết không đánh được', (await emit(a.s, 'cast', { targetId: mon.id })).error === 'Đã chết')
  check('người chết không dùng thuốc', (await emit(a.s, 'inventory:use', { code: 'linh_duoc' })).error === 'Cần ở trong map và còn sống')
  for (let i = 0; i < 20 && !respawned; i++) await sleep(250)
  check('hồi sinh ở điểm hồi sinh, đầy máu', !!respawned && respawned.x === 0 && respawned.y === 0 && respawned.hp === 100)

  // ---- dùng vật phẩm khi đang sống trong map ----
  await give(ch.id, 'linh_duoc', 2); await give(ch.id, 'dan_tu_vi', 1)
  const inv = (await emit(a.s, 'inventory:get')).items
  check('túi đồ liệt kê đúng', inv.find(x => x.code === 'linh_duoc').count === 2 && inv.find(x => x.code === 'dan_tu_vi').count === 1)
  const hpBefore = hpLog.length
  check('dùng Linh Dược', (await emit(a.s, 'inventory:use', { code: 'linh_duoc' })).ok === true)
  await sleep(150)
  check('hồi máu gửi player:hp', hpLog.length > hpBefore)
  const exps = []; a.s.on('player:exp', e => exps.push(e))
  check('dùng Đan Tu Vi', (await emit(a.s, 'inventory:use', { code: 'dan_tu_vi' })).ok === true)
  await sleep(150)
  check('cộng 50 tu vi', exps.length === 1 && exps[0].exp === 50)
  check('hết vật phẩm -> lỗi', (await emit(a.s, 'inventory:use', { code: 'dan_tu_vi' })).error === 'Không có vật phẩm')
  check('vứt quá số lượng -> lỗi', (await emit(a.s, 'inventory:drop', { code: 'linh_duoc', count: 5 })).error === 'Không đủ số lượng')
  check('vứt vật phẩm', (await emit(a.s, 'inventory:drop', { code: 'linh_duoc', count: 1 })).ok === true)
  check('túi đồ trống', (await emit(a.s, 'inventory:get')).items.length === 0)

  await prisma.$disconnect()
  process.exit(process.exitCode || 0)
})()
