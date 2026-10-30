// Kiểm thử: tiền tệ, vùng gần, quái, lưu vị trí. Cần server đang chạy.
const { io } = require('socket.io-client')
const parser = require('socket.io-msgpack-parser')
const T = Date.now().toString(36)
const post = (p, b) => fetch('http://localhost:3000/api/' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json())
const emit = (s, ev, d) => new Promise(r => (d === undefined ? s.emit(ev, r) : s.emit(ev, d, r)))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const connect = async (name) => {
  const { token } = await post('register', { email: `${name}${T}@x.com`, username: `${name}${T}`, password: '123456' })
  const s = io('http://localhost:3000', { parser, forceNew: true, auth: { token } })
  await new Promise(r => s.on('connect', r))
  return { s, token }
}
const check = (label, ok) => { console.log(ok ? 'OK  ' : 'FAIL', label); if (!ok) process.exitCode = 1 }

;(async () => {
  const a = await connect('wa'); const b = await connect('wb')
  const me = (await emit(a.s, 'character:create', { name: `A ${T}` })).character
  await emit(b.s, 'character:create', { name: `B ${T}` })
  check('3 loại tiền, số dư 0', me.currencies.length === 3 && me.currencies.every(c => c.amount === 0))
  check('chưa có map', me.map === null)
  check('vào lại không map -> lỗi', (await emit(a.s, 'map:join')).error === 'Chưa chọn map')

  const mapId = (await emit(a.s, 'data:static')).maps[0].id
  const ev = { a: [], b: [] }
  for (const k of ['a', 'b']) for (const e of ['player:joined', 'player:left', 'player:moved', 'monster:appeared', 'monster:update', 'monster:disappeared'])
    (k === 'a' ? a : b).s.on(e, d => ev[k].push(e))
  const ja = await emit(a.s, 'map:join', { mapId })
  const jb = await emit(b.s, 'map:join', { mapId })
  check('gần nhau thấy nhau', ja.players.length === 0 && jb.players.length === 1)
  b.s.emit('move', { x: 5000, y: 5000 })
  await sleep(100)
  check('đi xa thì player:left', ev.a.includes('player:left') && ev.b.includes('player:left'))
  const before = ev.a.filter(e => e === 'player:moved').length
  b.s.emit('move', { x: 5010, y: 5010 }); await sleep(100)
  check('xa thì không nhận moved', ev.a.filter(e => e === 'player:moved').length === before)
  b.s.emit('move', { x: 10, y: 10 }); await sleep(100)
  check('quay lại thì player:joined', ev.a.filter(e => e === 'player:joined').length >= 2)

  await sleep(1200)
  check('quái xuất hiện/di chuyển trong tầm', ev.a.includes('monster:appeared') || ja.monsters.length > 0)

  a.s.emit('move', { x: 123, y: 456 }); await sleep(100)
  a.s.close(); await sleep(500)
  const a2 = io('http://localhost:3000', { parser, forceNew: true, auth: { token: a.token } })
  await new Promise(r => a2.on('connect', r))
  const me2 = (await emit(a2, 'player:me')).character
  check('lưu map + vị trí', me2.map && me2.map.id === mapId && me2.map.x === 123 && me2.map.y === 456)
  const back = await emit(a2, 'map:join')
  check('vào lại đúng chỗ cũ', back.x === 123 && back.y === 456)
  process.exit(process.exitCode || 0)
})()
