const { io } = require('socket.io-client')
const parser = require('socket.io-msgpack-parser')
const T = Date.now().toString(36)
const post = (p, b) => fetch('http://localhost:3000/api/' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json())
const emit = (s, ev, d) => new Promise(r => (d === undefined ? s.emit(ev, r) : s.emit(ev, d, r)))
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function connect(name) {
  const { token } = await post('register', { email: `${name}${T}@x.com`, username: `${name}${T}`, password: '123456' })
  const s = io('http://localhost:3000', { parser, forceNew: true, auth: { token } })
  await new Promise(r => s.on('connect', r))
  return { s, token }
}
const check = (label, ok) => { console.log(ok ? 'OK  ' : 'FAIL', label); if (!ok) process.exitCode = 1 }
// đi từng bước ≤ 280 đơn vị (server cho tối đa 300/giây)
async function walkX(s, from, to) {
  const dir = Math.sign(to - from)
  let x = from
  while (x !== to) {
    x = dir > 0 ? Math.min(x + 280, to) : Math.max(x - 280, to)
    s.emit('move', { x, y: 10 })
    await sleep(1050)
  }
}
// Đặt vị trí lưu ở giữa map rồi vào map để tìm một con quái loại `type` trong tầm nhìn
async function findMonster(prisma, s, charId, maps, type) {
  for (let tries = 0; tries < 20; tries++) {
    for (const m of maps) {
      await prisma.character.update({ where: { id: charId }, data: { mapId: m.id, posX: 1000, posY: 1000 } })
      const j = await emit(s, 'map:join', { mapId: m.id })
      const mon = j.monsters.find(x => x.type === type)
      if (mon) return { monster: mon, mapId: m.id }
    }
    await sleep(300)
  }
  return null
}
module.exports = { findMonster, io, parser, T, post, emit, sleep, connect, check, walkX }
