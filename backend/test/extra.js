// Kiểm thử: cửa hàng NPC, trang bị, kỹ năng. Cần server đang chạy.
const { PrismaClient } = require('@prisma/client')
const { T, emit, sleep, connect, check, findMonster } = require('./util')
const prisma = new PrismaClient()

;(async () => {
  const a = await connect('ea'); const c = await connect('ec')
  const ch = (await emit(a.s, 'character:create', { name: `EA ${T}` })).character
  await emit(c.s, 'character:create', { name: `EC ${T}` })
  const maps = (await emit(a.s, 'data:static')).maps
  const count = async code => ((await emit(a.s, 'inventory:get')).items.find(i => i.code === code) || { count: 0 }).count
  const money = async () => (await emit(a.s, 'player:me')).character.currencies.find(x => x.code === 'linh_thach').amount
  const hpLog = []; a.s.on('player:hp', h => hpLog.push(h))

  // ---- cửa hàng ----
  const list = await emit(a.s, 'shop:list')
  check('NPC bán 4 món, giá bán lại bằng nửa', list.goods.length === 4 && list.goods.find(g => g.code === 'thiet_kiem').sellPrice === 50 && list.npc.x === 50)
  check('chưa vào map không mua được', (await emit(c.s, 'shop:buy', { code: 'linh_duoc', count: 1 })).error === 'Cần ở trong map và còn sống')
  const j = await emit(a.s, 'map:join', { mapId: maps[0].id })
  check('vào map thấy NPC', j.npcs.length === 1 && j.npcs[0].name === 'Chưởng Quầy')
  check('không đủ tiền', (await emit(a.s, 'shop:buy', { code: 'linh_duoc', count: 1 })).error === 'Không đủ Linh Thạch')
  await prisma.characterCurrency.upsert({
    where: { characterId_currencyId: { characterId: ch.id, currencyId: (await prisma.currency.findUniqueOrThrow({ where: { code: 'linh_thach' } })).id } },
    update: { amount: 500 }, create: { characterId: ch.id, currencyId: (await prisma.currency.findUniqueOrThrow({ where: { code: 'linh_thach' } })).id, amount: 500 },
  })
  check('mua món không có trong tiệm', (await emit(a.s, 'shop:buy', { code: 'khong-co', count: 1 })).error === 'NPC không bán món này')
  check('số lượng không hợp lệ', (await emit(a.s, 'shop:buy', { code: 'linh_duoc', count: 0 })).error === 'Dữ liệu không hợp lệ')
  check('mua Thiết Kiếm', (await emit(a.s, 'shop:buy', { code: 'thiet_kiem', count: 1 })).spent === 100)
  check('mua Áo Vải', (await emit(a.s, 'shop:buy', { code: 'ao_vai', count: 1 })).spent === 80)
  check('trừ tiền đúng', (await money()) === 320 && (await count('thiet_kiem')) === 1)
  await sleep(1000); a.s.emit('move', { x: 280, y: 10 }); await sleep(150)
  check('đứng xa NPC không mua được', (await emit(a.s, 'shop:buy', { code: 'linh_duoc', count: 1 })).error === 'Quá xa NPC')
  await sleep(1000); a.s.emit('move', { x: 50, y: 50 }); await sleep(150)

  // ---- trang bị ----
  check('mặc món không phải trang bị', (await emit(a.s, 'equipment:equip', { code: 'linh_duoc' })).error === 'Không phải trang bị')
  check('mặc Áo Vải từ túi', (await emit(a.s, 'equipment:equip', { code: 'ao_vai' })).slots.ARMOR.code === 'ao_vai')
  check('dùng trang bị như thuốc bị chặn', (await emit(a.s, 'inventory:use', { code: 'thiet_kiem' })).error === 'Hãy dùng chức năng mặc trang bị')
  const eq = await emit(a.s, 'equipment:equip', { code: 'thiet_kiem' })
  check('mặc Thiết Kiếm', eq.slots.WEAPON.code === 'thiet_kiem' && eq.slots.ARMOR.code === 'ao_vai' && (await count('thiet_kiem')) === 0)
  check('mặc Áo Vải tăng máu tối đa', hpLog.some(h => h.maxHp === 130))
  check('không còn đồ để mặc', (await emit(a.s, 'equipment:equip', { code: 'thiet_kiem' })).error === 'Không có vật phẩm')
  await prisma.inventoryItem.upsert({ where: { characterId_itemId: { characterId: ch.id, itemId: (await prisma.item.findUniqueOrThrow({ where: { code: 'thiet_kiem' } })).id } }, update: { count: 1 }, create: { characterId: ch.id, itemId: (await prisma.item.findUniqueOrThrow({ where: { code: 'thiet_kiem' } })).id, count: 1 } })
  await emit(a.s, 'equipment:equip', { code: 'thiet_kiem' })
  check('mặc đè thì đồ cũ về túi', (await count('thiet_kiem')) === 1)
  check('tháo trang bị', (await emit(a.s, 'equipment:unequip', { code: 'x' })).error === 'Dữ liệu không hợp lệ')
  const un = await emit(a.s, 'equipment:unequip', { slot: 'ARMOR' })
  check('tháo Áo Vải về túi, máu tối đa về 100', un.slots.ARMOR === null && (await count('ao_vai')) === 1 && hpLog[hpLog.length - 1].maxHp === 100)
  check('ô trống không tháo được', (await emit(a.s, 'equipment:unequip', { slot: 'ARMOR' })).error === 'Ô trống')
  await emit(a.s, 'equipment:equip', { code: 'ao_vai' })
  check('equipment:get', (await emit(a.s, 'equipment:get')).slots.WEAPON.atkBonus === 5)

  // ---- bán lại ----
  check('bán món không thu', (await emit(a.s, 'shop:sell', { code: 'khong-co', count: 1 })).error === 'NPC không thu món này')
  check('bán quá số lượng', (await emit(a.s, 'shop:sell', { code: 'thiet_kiem', count: 5 })).error === 'Không đủ số lượng')
  const before = await money()
  check('bán Thiết Kiếm được 50', (await emit(a.s, 'shop:sell', { code: 'thiet_kiem', count: 1 })).earned === 50 && (await money()) === before + 50)

  // ---- kỹ năng ----
  const sk = (await emit(a.s, 'skill:list')).skills
  check('kỹ năng: cơ bản mở, Kiếm Khí khóa', sk.find(k => k.code === 'co_ban').unlocked && !sk.find(k => k.code === 'kiem_khi').unlocked)
  await prisma.inventoryItem.updateMany({ where: { characterId: ch.id, item: { code: 'thiet_kiem' } }, data: { count: 1 } })
  await emit(a.s, 'equipment:equip', { code: 'thiet_kiem' })
  const found = await findMonster(prisma, a.s, ch.id, maps, 'yeu_thu')
  check('tìm thấy quái', !!found)
  if (!found) process.exit(1)
  const goNear = async () => {
    await prisma.character.update({ where: { id: ch.id }, data: { mapId: found.mapId, posX: found.monster.x, posY: found.monster.y } })
    return emit(a.s, 'map:join', { mapId: found.mapId })
  }
  let jj = await goNear()
  check('vào lại map nạp trang bị: máu 130', jj.maxHp === 130)
  const hits = []; a.s.on('monster:hit', h => hits.push(h))
  check('chưa mở khóa Kiếm Khí', (await emit(a.s, 'cast', { targetId: found.monster.id, skill: 'kiem_khi' })).error === 'Chưa mở khóa kỹ năng')
  check('kỹ năng không tồn tại', (await emit(a.s, 'cast', { targetId: found.monster.id, skill: 'xxx' })).error === 'Kỹ năng không tồn tại')
  const r1 = await emit(a.s, 'cast', { targetId: found.monster.id })
  check('đòn cơ bản cộng sát thương trang bị (15)', r1.damage === 15)
  const realm2 = await prisma.realm.findUniqueOrThrow({ where: { order: 2 } })
  await prisma.character.update({ where: { id: ch.id }, data: { realmId: realm2.id } })
  jj = await goNear()
  check('lên cảnh giới 2: máu 230', jj.maxHp === 230)
  check('mở khóa Kiếm Khí', (await emit(a.s, 'skill:list')).skills.find(k => k.code === 'kiem_khi').unlocked)
  const r2 = await emit(a.s, 'cast', { targetId: found.monster.id, skill: 'kiem_khi' })
  check('Kiếm Khí sát thương 3 × (20 + 5) = 75', r2.damage === 75 && r2.killed === true)
  check('hit kèm tên kỹ năng', hits.some(h => h.skill === 'kiem_khi'))
  check('Kiếm Khí hồi chiêu riêng', (await emit(a.s, 'cast', { targetId: found.monster.id, skill: 'kiem_khi' })).error === 'Kỹ năng đang hồi')

  await prisma.$disconnect()
  process.exit(process.exitCode || 0)
})()
