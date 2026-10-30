// Kiểm thử: bạn bè, chặn, chat riêng. Cần server đang chạy.
const { T, emit, sleep, connect, check } = require('./util')

;(async () => {
  const [a, b, c] = [await connect('sa'), await connect('sb'), await connect('sc')]
  const name = i => `S${i} ${T}`
  for (const [i, x] of [a, b, c].entries()) {
    await emit(x.s, 'character:create', { name: name(i + 1) })
    x.msgs = []; x.ev = []
    x.s.on('chat:message', m => x.msgs.push(m))
    for (const e of ['friend:requested', 'friend:added']) x.s.on(e, d => x.ev.push([e, d]))
  }

  // ---- bạn bè ----
  check('không kết bạn với chính mình', (await emit(a.s, 'friend:request', { name: name(1) })).error === 'Không thể kết bạn với chính mình')
  check('người không tồn tại', (await emit(a.s, 'friend:request', { name: 'khong-co' })).error === 'Không tìm thấy người chơi')
  check('gửi lời mời kết bạn', (await emit(a.s, 'friend:request', { name: name(2) })).ok === true)
  await sleep(150)
  check('người kia nhận lời mời', b.ev.some(e => e[0] === 'friend:requested' && e[1].from === name(1)))
  check('chấp nhận sai người', (await emit(b.s, 'friend:accept', { name: name(3) })).error === 'Không có lời mời hợp lệ')
  check('chấp nhận lời mời', (await emit(b.s, 'friend:accept', { name: name(1) })).ok === true)
  await sleep(150)
  check('người mời nhận thông báo', a.ev.some(e => e[0] === 'friend:added' && e[1].name === name(2)))
  const la = await emit(a.s, 'friend:list'); const lb = await emit(b.s, 'friend:list')
  check('danh sách bạn hai chiều, online', la.friends[0].name === name(2) && la.friends[0].online && lb.friends[0].name === name(1))
  check('đã là bạn thì không mời lại', (await emit(a.s, 'friend:request', { name: name(2) })).error === 'Đã là bạn bè')

  // ---- chat riêng ----
  check('chat riêng', (await emit(a.s, 'chat:whisper', { to: name(2), text: 'chào bạn' })).ok === true)
  await sleep(150)
  check('người nhận và người gửi đều thấy', b.msgs.length === 1 && b.msgs[0].channel === 'whisper' && b.msgs[0].from === name(1) && a.msgs.length === 1)
  check('người thứ ba không thấy', c.msgs.length === 0)
  check('chat riêng spam bị chặn', (await emit(a.s, 'chat:whisper', { to: name(2), text: 'lại' })).error === 'Gửi quá nhanh')
  await sleep(1100)
  check('chat riêng người không tồn tại', (await emit(a.s, 'chat:whisper', { to: 'khong-co', text: 'a' })).error === 'Không tìm thấy người chơi')
  check('chat riêng tin quá dài', !!(await emit(a.s, 'chat:whisper', { to: name(2), text: 'x'.repeat(201) })).error)

  // ---- chặn ----
  check('chặn người chơi', (await emit(b.s, 'block:add', { name: name(1) })).ok === true)
  const lb2 = await emit(b.s, 'friend:list')
  check('chặn thì xóa quan hệ bạn bè', lb2.friends.length === 0 && lb2.blocked[0] === name(1) && (await emit(a.s, 'friend:list')).friends.length === 0)
  await sleep(1100)
  check('người bị chặn không whisper được', (await emit(a.s, 'chat:whisper', { to: name(2), text: 'a' })).error === 'Không thể gửi tin cho người này')
  check('người chặn cũng không whisper được', (await emit(b.s, 'chat:whisper', { to: name(1), text: 'a' })).error === 'Không thể gửi tin cho người này')
  check('không kết bạn với người đã chặn', (await emit(a.s, 'friend:request', { name: name(2) })).error === 'Không thể kết bạn với người này')
  b.msgs.length = 0; c.msgs.length = 0
  check('chat thế giới', (await emit(a.s, 'chat:send', { channel: 'world', text: 'hello thế giới' })).ok === true)
  await sleep(150)
  check('người chặn không nhận chat thế giới của người bị chặn', b.msgs.length === 0 && c.msgs.length === 1)
  check('bỏ chặn', (await emit(b.s, 'block:remove', { name: name(1) })).ok === true)
  check('bỏ chặn khi chưa chặn', (await emit(b.s, 'block:remove', { name: name(1) })).error === 'Chưa chặn người này')
  await sleep(5100)
  await emit(a.s, 'chat:send', { channel: 'world', text: 'lại hello' }); await sleep(150)
  check('bỏ chặn thì nhận lại chat', b.msgs.length === 1)
  check('hủy kết bạn khi không phải bạn', (await emit(a.s, 'friend:remove', { name: name(2) })).error === 'Không phải bạn bè')
  await emit(a.s, 'friend:request', { name: name(3) }); await emit(c.s, 'friend:accept', { name: name(1) })
  check('hủy kết bạn', (await emit(a.s, 'friend:remove', { name: name(3) })).ok === true && (await emit(c.s, 'friend:list')).friends.length === 0)
  process.exit(process.exitCode || 0)
})()
