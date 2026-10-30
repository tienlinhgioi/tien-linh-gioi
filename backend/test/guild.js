// Kiểm thử: bang hội. Cần server đang chạy.
const { PrismaClient } = require('@prisma/client')
const { T, emit, sleep, connect, check } = require('./util')
const prisma = new PrismaClient()

;(async () => {
  const [g1, g2, g3] = [await connect('ga'), await connect('gb'), await connect('gc')]
  for (const [i, g] of [g1, g2, g3].entries()) {
    await emit(g.s, 'character:create', { name: `G${i + 1} ${T}` })
    g.msgs = []; g.events = []
    g.s.on('chat:message', m => g.msgs.push(m))
    for (const e of ['guild:invited', 'guild:member_joined', 'guild:member_left', 'guild:kicked']) g.s.on(e, d => g.events.push([e, d]))
  }
  const name = `Bang ${T}`

  check('tạo bang', (await emit(g1.s, 'guild:create', { name })).guild.leader === `G1 ${T}`)
  check('đã có bang không tạo thêm', (await emit(g1.s, 'guild:create', { name: `X ${T}` })).error === 'Đã ở trong bang')
  check('trùng tên bang', (await emit(g2.s, 'guild:create', { name })).error === 'Tên bang đã tồn tại')
  check('tên bang quá ngắn', !!(await emit(g2.s, 'guild:create', { name: 'a' })).error)
  check('chưa có bang thì không mời được', (await emit(g2.s, 'guild:invite', { name: `G3 ${T}` })).error === 'Chưa ở trong bang')
  check('chưa có lời mời thì không vào được', (await emit(g2.s, 'guild:accept')).error === 'Không có lời mời hợp lệ')

  check('mời người không tồn tại', (await emit(g1.s, 'guild:invite', { name: 'khong-co' })).error === 'Không tìm thấy người chơi')
  check('mời thành công', (await emit(g1.s, 'guild:invite', { name: `G2 ${T}` })).ok === true)
  await sleep(150)
  check('người được mời nhận lời mời', g2.events.some(e => e[0] === 'guild:invited' && e[1].guildName === name))
  const joined = await emit(g2.s, 'guild:accept')
  check('chấp nhận vào bang', joined.guild && joined.guild.members.length === 2)
  await sleep(150)
  check('bang chủ nhận thông báo thành viên mới', g1.events.some(e => e[0] === 'guild:member_joined'))
  check('người đã có bang không bị mời', (await emit(g1.s, 'guild:invite', { name: `G2 ${T}` })).error === 'Người này đã có bang')

  // chat bang
  check('chat bang', (await emit(g1.s, 'chat:send', { channel: 'guild', text: 'chào bang' })).ok === true)
  await sleep(150)
  check('thành viên nhận chat bang', g2.msgs.length === 1 && g1.msgs.length === 1)
  check('người ngoài bang không nhận', g3.msgs.length === 0)
  check('người ngoài bang không chat bang được', (await emit(g3.s, 'chat:send', { channel: 'guild', text: 'a' })).error === 'Chưa ở trong bang')

  // thành viên rời
  check('thành viên rời bang', (await emit(g2.s, 'guild:leave')).ok === true)
  check('không còn bang', (await emit(g2.s, 'guild:info')).guild === null)
  await sleep(1100)
  await emit(g1.s, 'chat:send', { channel: 'guild', text: 'sau khi rời' }); await sleep(150)
  check('người đã rời không nhận chat bang', g2.msgs.length === 1)

  // bang chủ rời -> nhường cho thành viên còn lại
  await emit(g1.s, 'guild:invite', { name: `G2 ${T}` }); await emit(g2.s, 'guild:accept')
  check('bang chủ rời bang', (await emit(g1.s, 'guild:leave')).ok === true)
  check('nhường bang chủ cho thành viên còn lại', (await emit(g2.s, 'guild:info')).guild.leader === `G2 ${T}`)
  check('hết người thì giải tán', (await emit(g2.s, 'guild:leave')).ok === true && (await prisma.guild.findUnique({ where: { name } })) === null)

  // ---- quản lý nâng cao: phó bang, đá, nhường chức ----
  const g4 = await connect('gd'); await emit(g4.s, 'character:create', { name: `G4 ${T}` })
  g4.events = []; g4.s.on('guild:invited', d => g4.events.push(d))
  const name2 = `Bang2 ${T}`
  const info = async g => (await emit(g.s, 'guild:info')).guild
  await emit(g1.s, 'guild:create', { name: name2 })
  for (const g of [g2, g3]) { await emit(g1.s, 'guild:invite', { name: `G${g === g2 ? 2 : 3} ${T}` }); await emit(g.s, 'guild:accept') }
  check('thành viên thường không mời được', (await emit(g2.s, 'guild:invite', { name: `G4 ${T}` })).error === 'Chỉ bang chủ hoặc phó bang được mời')
  check('thành viên thường không bổ nhiệm được', (await emit(g2.s, 'guild:promote', { name: `G3 ${T}` })).error === 'Chỉ bang chủ được bổ nhiệm')
  const promoted = (await emit(g1.s, 'guild:promote', { name: `G2 ${T}` })).guild
  check('bổ nhiệm phó bang', promoted.members.find(m => m.name === `G2 ${T}`).role === 'DEPUTY')
  check('phó bang mời được người', (await emit(g2.s, 'guild:invite', { name: `G4 ${T}` })).ok === true)
  check('người được mời vào bang', (await emit(g4.s, 'guild:accept')).guild.members.length === 4)
  check('phó bang không đá được bang chủ', (await emit(g2.s, 'guild:kick', { name: `G1 ${T}` })).error === 'Không đủ quyền')
  check('thành viên không đá được ai', (await emit(g3.s, 'guild:kick', { name: `G4 ${T}` })).error === 'Không đủ quyền')
  check('không đá được người ngoài bang', (await emit(g2.s, 'guild:kick', { name: 'khong-co' })).error === 'Không có thành viên này')
  g3.events.length = 0; g3.msgs.length = 0
  check('phó bang đá thành viên thường', (await emit(g2.s, 'guild:kick', { name: `G3 ${T}` })).ok === true)
  await sleep(1100)
  await emit(g1.s, 'chat:send', { channel: 'guild', text: 'sau khi đá' }); await sleep(150)
  check('người bị đá nhận thông báo và hết bang', g3.events.some(e => e[0] === 'guild:kicked') && (await info(g3)) === null)
  check('người bị đá không nhận chat bang', g3.msgs.length === 0)
  check('chỉ bang chủ được nhường chức', (await emit(g2.s, 'guild:transfer', { name: `G4 ${T}` })).error === 'Chỉ bang chủ được nhường chức')
  const moved = (await emit(g1.s, 'guild:transfer', { name: `G2 ${T}` })).guild
  check('nhường bang chủ', moved.leader === `G2 ${T}` && moved.members.find(m => m.name === `G1 ${T}`).role === 'MEMBER')
  check('bang chủ cũ hết quyền', (await emit(g1.s, 'guild:kick', { name: `G4 ${T}` })).error === 'Không đủ quyền')
  check('bãi nhiệm phó bang', (await emit(g2.s, 'guild:promote', { name: `G1 ${T}` })).guild.members.find(m => m.name === `G1 ${T}`).role === 'DEPUTY'
    && (await emit(g2.s, 'guild:demote', { name: `G1 ${T}` })).guild.members.find(m => m.name === `G1 ${T}`).role === 'MEMBER')
  for (const g of [g1, g4, g2]) await emit(g.s, 'guild:leave')
  check('giải tán khi hết người', (await prisma.guild.findUnique({ where: { name: name2 } })) === null)

  await prisma.$disconnect()
  process.exit(process.exitCode || 0)
})()
