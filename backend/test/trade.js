// Kiểm thử: giao dịch giữa người chơi. Cần server đang chạy.
const { PrismaClient } = require('@prisma/client')
const { T, emit, sleep, connect, check } = require('./util')
const prisma = new PrismaClient()

;(async () => {
  const [a, b, c] = [await connect('ta'), await connect('tb'), await connect('tc')]
  const chars = []
  for (const [i, x] of [a, b, c].entries()) {
    chars.push((await emit(x.s, 'character:create', { name: `T${i + 1} ${T}` })).character)
    x.ev = []
    for (const e of ['trade:requested', 'trade:started', 'trade:update', 'trade:completed', 'trade:cancelled']) x.s.on(e, d => x.ev.push([e, d]))
  }
  const name = i => `T${i} ${T}`
  const item = code => prisma.item.findUniqueOrThrow({ where: { code } })
  const cur = code => prisma.currency.findUniqueOrThrow({ where: { code } })
  const give = async (id, code, count) => prisma.inventoryItem.upsert({ where: { characterId_itemId: { characterId: id, itemId: (await item(code)).id } }, update: { count }, create: { characterId: id, itemId: (await item(code)).id, count } })
  const money = async (s) => (await emit(s, 'player:me')).character.currencies.find(x => x.code === 'linh_thach').amount
  const count = async (s, code) => ((await emit(s, 'inventory:get')).items.find(i => i.code === code) || { count: 0 }).count
  const setMoney = async (id, amount) => { const cu = await cur('linh_thach'); await prisma.characterCurrency.upsert({ where: { characterId_currencyId: { characterId: id, currencyId: cu.id } }, update: { amount }, create: { characterId: id, currencyId: cu.id, amount } }) }
  await give(chars[0].id, 'linh_duoc', 5); await setMoney(chars[1].id, 100)
  const last = (x, e) => x.ev.filter(v => v[0] === e).pop()

  check('chưa trong giao dịch không đặt đồ được', (await emit(a.s, 'trade:offer', { items: [], currencies: [] })).error === 'Không trong giao dịch')
  check('mời chính mình', (await emit(a.s, 'trade:request', { name: name(1) })).error === 'Không tìm thấy người chơi')
  check('mời giao dịch', (await emit(a.s, 'trade:request', { name: name(2) })).ok === true)
  await sleep(150)
  check('người kia nhận lời mời', !!last(b, 'trade:requested'))
  check('người khác không nhận thay được', (await emit(c.s, 'trade:accept')).error === 'Không có lời mời hợp lệ')
  check('chấp nhận giao dịch', (await emit(b.s, 'trade:accept')).ok === true)
  await sleep(150)
  check('hai bên nhận trade:started', !!last(a, 'trade:started') && !!last(b, 'trade:started'))
  check('đang giao dịch không mời thêm', (await emit(c.s, 'trade:request', { name: name(1) })).error === 'Đang trong một giao dịch')

  check('đặt quá số đồ đang có', (await emit(a.s, 'trade:offer', { items: [{ code: 'linh_duoc', count: 9 }], currencies: [] })).error === 'Không đủ vật phẩm')
  check('đặt quá số tiền đang có', (await emit(b.s, 'trade:offer', { items: [], currencies: [{ code: 'linh_thach', amount: 999 }] })).error === 'Không đủ tiền tệ')
  check('A đặt 3 Linh Dược', (await emit(a.s, 'trade:offer', { items: [{ code: 'linh_duoc', count: 3 }], currencies: [] })).ok === true)
  check('B đặt 60 Linh Thạch', (await emit(b.s, 'trade:offer', { items: [], currencies: [{ code: 'linh_thach', amount: 60 }] })).ok === true)
  await sleep(150)
  const ua = last(a, 'trade:update')[1]
  check('A thấy phần của B', ua.me.items.linh_duoc === 3 && ua.other.currencies.linh_thach === 60)

  await emit(a.s, 'trade:confirm'); await sleep(150)
  check('một bên xác nhận chưa đổi', (await count(a.s, 'linh_duoc')) === 5 && last(b, 'trade:update')[1].other.confirmed === true)
  await emit(b.s, 'trade:offer', { items: [], currencies: [{ code: 'linh_thach', amount: 50 }] }); await sleep(150)
  check('đổi đề nghị thì hủy xác nhận', last(a, 'trade:update')[1].me.confirmed === false)
  await emit(a.s, 'trade:confirm'); await emit(b.s, 'trade:confirm'); await sleep(300)
  check('hoàn tất, nhận trade:completed', !!last(a, 'trade:completed') && !!last(b, 'trade:completed'))
  check('A: -3 Linh Dược, +50 tiền', (await count(a.s, 'linh_duoc')) === 2 && (await money(a.s)) === 50)
  check('B: +3 Linh Dược, -50 tiền', (await count(b.s, 'linh_duoc')) === 3 && (await money(b.s)) === 50)

  // hủy
  await emit(a.s, 'trade:request', { name: name(2) }); await emit(b.s, 'trade:accept')
  check('hủy giao dịch', (await emit(a.s, 'trade:cancel')).ok === true); await sleep(150)
  check('cả hai nhận trade:cancelled', !!last(b, 'trade:cancelled') && !!last(a, 'trade:cancelled'))
  check('hủy rồi không xác nhận được', (await emit(a.s, 'trade:confirm')).error === 'Không trong giao dịch')

  // thiếu đồ khi chốt: A đặt rồi bán/vứt bớt trước khi xác nhận
  await emit(a.s, 'trade:request', { name: name(2) }); await emit(b.s, 'trade:accept')
  await emit(a.s, 'trade:offer', { items: [{ code: 'linh_duoc', count: 2 }], currencies: [] })
  await emit(a.s, 'inventory:drop', { code: 'linh_duoc', count: 2 })
  await emit(a.s, 'trade:confirm'); await emit(b.s, 'trade:confirm'); await sleep(300)
  const bad = last(a, 'trade:cancelled')
  check('thiếu đồ lúc chốt thì hủy, không ai mất gì', bad && bad[1].reason === 'Không đủ vật phẩm' && (await count(b.s, 'linh_duoc')) === 3)

  // ngắt kết nối giữa chừng
  await emit(a.s, 'trade:request', { name: name(2) }); await emit(b.s, 'trade:accept')
  const before = b.ev.length
  a.s.close(); await sleep(400)
  check('đối phương ngắt kết nối thì hủy', b.ev.slice(before).some(v => v[0] === 'trade:cancelled' && v[1].reason === 'Đối phương đã ngắt kết nối'))
  const blockedReq = await emit(c.s, 'block:add', { name: name(2) })
  check('người đã chặn không giao dịch được', (await emit(b.s, 'trade:request', { name: name(3) })).error === 'Không thể giao dịch với người này')

  await prisma.$disconnect()
  process.exit(process.exitCode || 0)
})()
