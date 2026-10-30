// Kiểm thử: chat, tấn công quái, tu vi, đột phá. Cần server đang chạy.
const { PrismaClient } = require('@prisma/client')
const { T, emit, sleep, connect, check } = require('./util')
const prisma = new PrismaClient()

;(async () => {
  const a = await connect('ra'); const b = await connect('rb')
  const ch = (await emit(a.s, 'character:create', { name: `RA ${T}` })).character
  await emit(b.s, 'character:create', { name: `RB ${T}` })
  const maps = (await emit(a.s, 'data:static')).maps

  // ---- chat ----
  const got = []
  b.s.on('chat:message', m => got.push(m))
  check('chat map khi chưa vào map -> lỗi', (await emit(a.s, 'chat:send', { channel: 'map', text: 'hi' })).error === 'Chưa vào map')
  await emit(a.s, 'map:join', { mapId: maps[0].id }); await emit(b.s, 'map:join', { mapId: maps[0].id })
  check('chat map gửi được', (await emit(a.s, 'chat:send', { channel: 'map', text: 'xin chào' })).ok === true)
  await sleep(150)
  check('người cùng map nhận chat', got.length === 1 && got[0].text === 'xin chào' && got[0].from === `RA ${T}`)
  check('spam bị chặn', (await emit(a.s, 'chat:send', { channel: 'map', text: 'lại' })).error === 'Gửi quá nhanh')
  check('chat thế giới gửi được', (await emit(a.s, 'chat:send', { channel: 'world', text: 'cả thế giới' })).ok === true)
  check('tin quá dài bị từ chối', !!(await emit(a.s, 'chat:send', { channel: 'map', text: 'x'.repeat(201) })).error)

  // ---- tìm một quái: đặt vị trí lưu ở giữa map rồi vào lại để xem quái trong tầm ----
  let target = null, mapId = null
  for (let tries = 0; tries < 10 && !target; tries++) {
    for (const m of maps) {
      await prisma.character.update({ where: { id: ch.id }, data: { mapId: m.id, posX: 1000, posY: 1000 } })
      const j = await emit(a.s, 'map:join', { mapId: m.id })
      if (j.monsters.length) { target = j.monsters[0]; mapId = m.id; break }
    }
    if (!target) await sleep(300)
  }
  check('tìm thấy quái trong tầm', !!target)
  if (!target) process.exit(1)
  console.log('     (hp quái:', target.hp + ')')

  // theo dõi vị trí quái
  let pos = { x: target.x, y: target.y }, hits = [], exps = []
  a.s.on('monster:update', arr => { const m = arr.find(x => x.id === target.id); if (m) pos = m })
  a.s.on('monster:hit', h => hits.push(h))
  a.s.on('player:exp', e => exps.push(e))

  let res, killed = false
  for (let i = 0; i < 12 && !killed; i++) {
    a.s.emit('move', { x: pos.x, y: pos.y }); await sleep(250)
    res = await emit(a.s, 'cast', { targetId: target.id })
    if (res.error === 'Kỹ năng đang hồi') { await sleep(1000); continue }
    if (res.error) { console.log('     lỗi cast:', res.error); await sleep(1000); continue }
    killed = res.killed
    await sleep(1050)
  }
  check('quái trúng đòn, mất máu', hits.length >= 1 && hits[0].damage === 10)
  check('hạ được quái', killed && hits.some(h => h.hp === 0))
  check('hồi chiêu chặn đánh liên tục', (await Promise.all([emit(a.s, 'cast', { targetId: target.id }), emit(a.s, 'cast', { targetId: target.id })])).some(r => r.error))
  await sleep(200)
  check('nhận tu vi khi hạ quái', exps.length === 1 && exps[0].exp === 20 && exps[0].expNeeded === 100)

  // ---- đột phá ----
  check('chưa đủ tu vi', (await emit(a.s, 'cultivate:breakthrough')).error === 'Chưa đủ tu vi')
  await prisma.character.update({ where: { id: ch.id }, data: { exp: 100 } })
  let r = await emit(a.s, 'cultivate:breakthrough')
  check('đột phá lên tiểu cảnh 2, trừ tu vi', r.character && r.character.subRealm === 2 && r.character.exp === 0 && r.character.expNeeded === 200)
  await prisma.character.update({ where: { id: ch.id }, data: { subRealm: 10, exp: 5000 } })
  r = await emit(a.s, 'cultivate:breakthrough')
  check('qua tiểu cảnh 10 -> cảnh giới mới', r.character && r.character.realm.order === 2 && r.character.subRealm === 1 && r.character.exp === 5000 - 1000)
  const realm11 = await prisma.realm.findUnique({ where: { order: 11 } })
  await prisma.character.update({ where: { id: ch.id }, data: { realmId: realm11.id, subRealm: 10, exp: 999999 } })
  check('cảnh giới tối đa', (await emit(a.s, 'cultivate:breakthrough')).error === 'Đã đạt cảnh giới tối đa')

  await prisma.$disconnect()
  process.exit(process.exitCode || 0)
})()
