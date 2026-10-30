// Kiểm thử: nhiều ô trang bị và phẩm chất. Cần server đang chạy.
const { PrismaClient } = require('@prisma/client')
const { T, emit, connect, check } = require('./util')
const prisma = new PrismaClient()

;(async () => {
  const a = await connect('ga')
  const ch = (await emit(a.s, 'character:create', { name: `GA ${T}` })).character
  const maps = (await emit(a.s, 'data:static')).maps
  for (const code of ['thiet_kiem', 'ao_vai', 'non_sat', 'giay_vai', 'nhan_linh', 'bao_kiem']) {
    const item = await prisma.item.findUniqueOrThrow({ where: { code } })
    await prisma.inventoryItem.create({ data: { characterId: ch.id, itemId: item.id, count: 1 } })
  }
  const inv = (await emit(a.s, 'inventory:get')).items
  check('túi đồ có phẩm chất', inv.find(i => i.code === 'bao_kiem').quality === 'RARE' && inv.find(i => i.code === 'thiet_kiem').quality === 'COMMON')
  await emit(a.s, 'map:join', { mapId: maps[0].id })
  const hp = []; a.s.on('player:hp', h => hp.push(h))
  let eq
  for (const code of ['thiet_kiem', 'ao_vai', 'non_sat', 'giay_vai', 'nhan_linh']) eq = await emit(a.s, 'equipment:equip', { code })
  check('5 ô trang bị đều đã mặc', Object.keys(eq.slots).length === 5 && Object.values(eq.slots).every(Boolean))
  check('ô nhẫn là đồ hiếm', eq.slots.RING.code === 'nhan_linh' && eq.slots.RING.quality === 'RARE')
  check('máu tối đa = 100 + 30 + 20 + 10', hp[hp.length - 1].maxHp === 160)
  eq = await emit(a.s, 'equipment:equip', { code: 'bao_kiem' })
  const inv2 = (await emit(a.s, 'inventory:get')).items
  check('mặc Bảo Kiếm, Thiết Kiếm về túi', eq.slots.WEAPON.code === 'bao_kiem' && inv2.find(i => i.code === 'thiet_kiem').count === 1)
  const j = await emit(a.s, 'map:join', { mapId: maps[0].id })
  check('vào lại map nạp đủ trang bị', j.maxHp === 160)

  await prisma.$disconnect()
  process.exit(process.exitCode || 0)
})()
