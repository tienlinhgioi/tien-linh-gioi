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
    for (const e of ['guild:invited', 'guild:member_joined', 'guild:member_left']) g.s.on(e, d => g.events.push([e, d]))
  }
  const name = `Bang ${T}`

  check('tạo bang', (await emit(g1.s, 'guild:create', { name })).guild.leader === `G1 ${T}`)
  check('đã có bang không tạo thêm', (await emit(g1.s, 'guild:create', { name: `X ${T}` })).error === 'Đã ở trong bang')
  check('trùng tên bang', (await emit(g2.s, 'guild:create', { name })).error === 'Tên bang đã tồn tại')
  check('tên bang quá ngắn', !!(await emit(g2.s, 'guild:create', { name: 'a' })).error)
  check('không phải bang chủ không mời được', (await emit(g2.s, 'guild:invite', { name: `G3 ${T}` })).error === 'Chỉ bang chủ được mời')
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

  await prisma.$disconnect()
  process.exit(process.exitCode || 0)
})()
