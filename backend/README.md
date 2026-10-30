# Backend Tiên Linh Giới

![Backend](../../actions/workflows/backend.yml/badge.svg)

## Chạy
```bash
cp .env.example .env   # sửa DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev
npm run seed           # nạp cảnh giới, map, tiền tệ, vật phẩm, loại quái
npm run dev            # cổng 3000
```
Kiểm thử (cần server đang chạy): `node test/smoke.js`, `node test/world.js`, `node test/rules.js`, `node test/combat.js`, `node test/guild.js`, `node test/extra.js`, `node test/social.js`, `node test/trade.js`, `node test/gear.js`

## API (HTTP)
- `POST /api/register` `{ email, username, password }` -> `{ token, username }`
- `POST /api/login` `{ account, password }` (account = gmail hoặc tên tài khoản) -> `{ token, username }`

## Socket.io (parser msgpack, `auth: { token }`)
| Sự kiện client gửi | Dữ liệu | Trả về / phát ra |
|---|---|---|
| `data:static` | - | ack `{ realms, subRealmsPerRealm, maps }` |
| `player:me` | - | ack `{ character }` (null nếu chưa tạo) |
| `character:create` | `{ name }` | ack `{ character }` hoặc `{ error }` |
| `map:join` | `{ mapId }` hoặc không gửi gì (vào lại map đã lưu) | ack `{ x, y, hp, maxHp, npcs, players, monsters }` (chỉ người/quái trong bán kính) |
| `map:leave` | - | - |
| `move` | `{ x, y }` | server từ chối (ngoài map hoặc quá tốc độ) thì gửi lại `move:rejected` `{ x, y }` là vị trí đúng |
| `chat:send` | `{ channel: 'map' \| 'world' \| 'guild', text }` | ack `{ ok }` hoặc `{ error }`; mọi người nhận `chat:message` `{ channel, from, text, at }` |
| `skill:list` | - | ack `{ points, skills: [{ code, name, damageMult, range, cooldownMs, minRealm, cost, learned, canLearn }] }` |
| `skill:learn` | `{ code }` | ack `{ ok, points }` hoặc `{ error }`; cần đủ cảnh giới và điểm kỹ năng (mỗi lần đột phá +1 điểm) |
| `cast` | `{ targetId, skill? }` (id quái; mặc định `co_ban`) | ack `{ damage, hp, killed }` hoặc `{ error }`; người trong tầm nhận `monster:hit` `{ id, hp, damage, by, skill }`; người hạ quái nhận `player:loot` `{ exp, currencies, items }` và `player:exp` `{ exp, expNeeded }` |
| `inventory:get` | - | ack `{ items: [{ code, name, count, healHp, expGain }] }` |
| `inventory:use` | `{ code }` | ack `{ ok }` hoặc `{ error }`; hồi máu cần đang sống trong map |
| `inventory:drop` | `{ code, count }` | ack `{ ok }` hoặc `{ error }` |
| `guild:info` | - | ack `{ guild: { id, name, leader, members: [{ name, online, role }] } \| null }` (role: LEADER, DEPUTY, MEMBER) |
| `guild:create` | `{ name }` | ack `{ guild }` hoặc `{ error }` |
| `guild:invite` | `{ name }` (bang chủ hoặc phó bang) | ack `{ ok }`; người được mời nhận `guild:invited` `{ guildName, from }` (hiệu lực 60 giây) |
| `guild:accept` | - | ack `{ guild }` hoặc `{ error }`; bang nhận `guild:member_joined` `{ name }` |
| `guild:leave` | - | ack `{ ok }`; bang nhận `guild:member_left` `{ name }` |
| `guild:kick` | `{ name }` | bang chủ đá mọi người, phó bang chỉ đá thành viên thường; người bị đá nhận `guild:kicked` |
| `guild:transfer` | `{ name }` (chỉ bang chủ) | ack `{ guild }`; bang nhận `guild:leader_changed` |
| `guild:promote` / `guild:demote` | `{ name }` (chỉ bang chủ) | ack `{ guild }`; bang nhận `guild:role_changed` `{ name, role }` |
| `equipment:get` | - | ack `{ slots: { WEAPON, ARMOR, HELMET, BOOTS, RING } }` mỗi ô là `{ code, name, quality, atkBonus, hpBonus }` hoặc null |
| `equipment:equip` | `{ code }` (từ túi đồ) | ack `{ slots }`; đồ cũ trong ô quay về túi |
| `equipment:unequip` | `{ slot }` | ack `{ slots }` |
| `friend:list` | - | ack `{ friends: [{ name, online }], blocked: [name] }` |
| `friend:request` | `{ name }` | ack `{ ok }`; người kia nhận `friend:requested` `{ from }` (hiệu lực 60 giây) |
| `friend:accept` | `{ name }` (tên người mời) | ack `{ ok }`; người mời nhận `friend:added` `{ name }` |
| `friend:remove` | `{ name }` | ack `{ ok }` |
| `block:add` / `block:remove` | `{ name }` | chặn thì xóa quan hệ bạn, không nhận chat và whisper của người bị chặn |
| `chat:whisper` | `{ to, text }` | cả hai nhận `chat:message` với `channel: 'whisper'`, `to` là tên người nhận |
| `trade:request` | `{ name }` | ack `{ ok }`; người kia nhận `trade:requested` `{ from }` |
| `trade:accept` | - | ack `{ ok }`; hai bên nhận `trade:started` `{ with }` rồi `trade:update` |
| `trade:offer` | `{ items: [{ code, count }], currencies: [{ code, amount }] }` | đặt lại phần của mình, hủy xác nhận của cả hai; hai bên nhận `trade:update` `{ me, other }` |
| `trade:confirm` / `trade:cancel` | - | cả hai xác nhận thì đổi trong một transaction, nhận `trade:completed`; lỗi hoặc hủy thì nhận `trade:cancelled` `{ reason }` |
| `shop:list` | - | ack `{ npc, currency, goods: [{ code, name, price, sellPrice }] }` |
| `shop:buy` / `shop:sell` | `{ code, count }` | ack `{ ok, spent \| earned }` hoặc `{ error }`; cần đang sống trong map và đứng gần NPC |
| `cultivate:breakthrough` | - | ack `{ character }` hoặc `{ error }` |

Server phát xuống client (chỉ khi trong tầm nhìn `VIEW_RADIUS`):
`player:joined` `{ characterId, name, mapId, x, y }`, `player:left` `{ characterId }`, `player:moved` `{ characterId, x, y }`,
`monster:appeared` `[{ id, type, name, x, y, hp, maxHp }]`, `monster:attack` `{ id, targetCharacterId, damage }`,
`player:hp` `{ hp, maxHp }`, `player:died` `{ respawnIn }`, `player:respawned` `{ x, y, hp, maxHp }`, `monster:disappeared` `[id]`, `monster:update` `[{ id, x, y }]` (nhịp 200ms).

`character` = `{ id, name, realm: { order, name }, subRealm, exp, expNeeded, currencies: [{ code, name, amount }], map: { id, x, y } | null }`

Vị trí được ghi vào MySQL mỗi 30 giây, khi rời map/ngắt kết nối và khi tắt server.
Thông số tạm trong `src/data.ts` (bán kính nhìn, kích thước map, số quái, tên quái, tên 3 loại tiền) cần chỉnh theo thiết kế thật.
Tu vi (`exp`) tăng khi hạ quái hoặc dùng vật phẩm. Đột phá tốn `expNeeded` = 100 × cảnh giới × tiểu cảnh; hết 10 tiểu cảnh thì sang cảnh giới kế.
Chiến đấu: sát thương = hệ số kỹ năng × (10 × cảnh giới + atk trang bị). Đòn cơ bản luôn có; Kiếm Khí (cảnh giới 2, 1 điểm) và Lôi Phạt (cảnh giới 3, 2 điểm) phải học; mỗi kỹ năng hồi chiêu riêng. Quái hồi sinh sau 5 giây, đuổi đánh người trong tầm 200.
Người chơi có máu = 100 × cảnh giới + máu trang bị (chỉ giữ trong RAM), chết thì sau 3 giây hồi sinh đầy máu ở (0, 0) cùng map.
Trang bị có 5 ô (WEAPON, ARMOR, HELMET, BOOTS, RING), phẩm chất COMMON/RARE/EPIC; mặc đè thì đồ cũ về túi. NPC cửa hàng ở (50, 50) mọi map, phải đứng trong 100 đơn vị; mua bằng Linh Thạch, bán lại nửa giá.
Bang: bang chủ rời thì nhường cho thành viên có id nhỏ nhất, hết người thì giải tán. Lời mời chỉ gửi được cho người đang online.
Loại quái, vật phẩm, kỹ năng, giá cửa hàng, tỉ lệ rơi là dữ liệu mẫu trong `src/data.ts`; sửa rồi chạy lại `npm run seed` và khởi động lại server.
Chưa có: cường hóa trang bị, đấu giá, nhóm đội, nhiệm vụ.

## CI (GitHub Actions)
`.github/workflows/backend.yml` chạy mỗi lần push main hoặc PR có đổi `backend/`: dựng MySQL 8, `prisma migrate deploy`, `npm run seed`, build rồi chạy server và toàn bộ test trong `test/`. GitHub Actions chỉ chạy test; database và server game thật cần host riêng (xem phần Chạy).
