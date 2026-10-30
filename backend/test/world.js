// Kiểm thử: tiền tệ, vùng gần, lưu vị trí, chống gian lận di chuyển. Cần server đang chạy.
const { io, parser, T, emit, sleep, connect, check, walkX } = require('./util')

;(async () => {
  const a = await connect('wa'); const b = await connect('wb')
  const me = (await emit(a.s, 'character:create', { name: `A ${T}` })).character
  await emit(b.s, 'character:create', { name: `B ${T}` })
  check('3 loại tiền, số dư 0', me.currencies.length === 3 && me.currencies.every(c => c.amount === 0))
  check('chưa có map', me.map === null)
  check('vào lại không map -> lỗi', (await emit(a.s, 'map:join')).error === 'Chưa chọn map')

  const mapId = (await emit(a.s, 'data:static')).maps[0].id
  const ev = { a: [], b: [] }
  for (const k of ['a', 'b']) for (const e of ['player:joined', 'player:left', 'player:moved', 'move:rejected'])
    (k === 'a' ? a : b).s.on(e, d => ev[k].push([e, d]))
  const count = (k, e) => ev[k].filter(x => x[0] === e).length
  const ja = await emit(a.s, 'map:join', { mapId })
  const jb = await emit(b.s, 'map:join', { mapId })
  check('gần nhau thấy nhau', ja.players.length === 0 && jb.players.length === 1)

  b.s.emit('move', { x: 1500, y: 1500 }); await sleep(150)
  check('dịch chuyển tức thời bị từ chối', count('b', 'move:rejected') === 1 && ev.b.find(x => x[0] === 'move:rejected')[1].x === 0)
  b.s.emit('move', { x: -5, y: 0 }); await sleep(150)
  check('ra ngoài map bị từ chối', count('b', 'move:rejected') === 2)

  await sleep(1000)
  await walkX(b.s, 0, 700)
  check('đi xa thì player:left', count('a', 'player:left') === 1 && count('b', 'player:left') === 1)
  const before = count('a', 'player:moved')
  b.s.emit('move', { x: 710, y: 10 }); await sleep(150)
  check('xa thì không nhận moved', count('a', 'player:moved') === before)
  await sleep(1000)
  await walkX(b.s, 710, 10)
  check('quay lại thì player:joined', count('a', 'player:joined') >= 2)

  a.s.emit('move', { x: 123, y: 200 }); await sleep(150)
  a.s.close(); await sleep(500)
  const a2 = io('http://localhost:3000', { parser, forceNew: true, auth: { token: a.token } })
  await new Promise(r => a2.on('connect', r))
  const me2 = (await emit(a2, 'player:me')).character
  check('lưu map + vị trí', me2.map && me2.map.id === mapId && me2.map.x === 123 && me2.map.y === 200)
  const back = await emit(a2, 'map:join')
  check('vào lại đúng chỗ cũ', back.x === 123 && back.y === 200)
  process.exit(process.exitCode || 0)
})()
