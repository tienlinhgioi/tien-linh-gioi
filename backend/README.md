# Backend Tiên Linh Giới

## Chạy
```bash
cp .env.example .env   # sửa DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev
npm run seed           # nạp cảnh giới, map, tiền tệ, vật phẩm, loại quái
npm run dev            # cổng 3000
```
Kiểm thử (cần server đang chạy): `node test/smoke.js`, `node test/world.js`, `node test/rules.js`, `node test/combat.js`, `node test/guild.js`

## API (HTTP)
- `POST /api/register` `{ email, username, password }` -> `{ token, username }`
- `POST /api/login` `{ account, password }` (account = gmail hoặc tên tài khoản) -> `{ token, username }`

## Socket.io (parser msgpack, `auth: { token }`)
| Sự kiện client gửi | Dữ liệu | Trả về / phát ra |
|---|---|---|
| `data:static` | - | ack `{ realms, subRealmsPerRealm, maps }` |
| `player:me` | - | ack `{ character }` (null nếu chưa tạo) |
| `character:create` | `{ name }` | ack `{ character }` hoặc `{ error }` |
| `map:join` | `{ mapId }` hoặc không gửi gì (vào lại map đã lưu) | ack `{ x, y, players, monsters }` (chỉ người/quái trong bán kính) |
| `map:leave` | - | - |
| `move` | `{ x, y }` | server từ chối (ngoài map hoặc quá tốc độ) thì gửi lại `move:rejected` `{ x, y }` là vị trí đúng |
| `chat:send` | `{ channel: 'map' \| 'world' \| 'guild', text }` | ack `{ ok }` hoặc `{ error }`; mọi người nhận `chat:message` `{ channel, from, text, at }` |
| `cast` | `{ targetId }` (id quái) | ack `{ damage, hp, killed }` hoặc `{ error }`; người trong tầm nhận `monster:hit` `{ id, hp, damage, by }`; người hạ quái nhận `player:loot` `{ exp, currencies, items }` và `player:exp` `{ exp, expNeeded }` |
| `inventory:get` | - | ack `{ items: [{ code, name, count, healHp, expGain }] }` |
| `inventory:use` | `{ code }` | ack `{ ok }` hoặc `{ error }`; hồi máu cần đang sống trong map |
| `inventory:drop` | `{ code, count }` | ack `{ ok }` hoặc `{ error }` |
| `guild:info` | - | ack `{ guild: { id, name, leader, members: [{ name, online }] } \| null }` |
| `guild:create` | `{ name }` | ack `{ guild }` hoặc `{ error }` |
| `guild:invite` | `{ name }` (chỉ bang chủ) | ack `{ ok }`; người được mời nhận `guild:invited` `{ guildName, from }` (hiệu lực 60 giây) |
| `guild:accept` | - | ack `{ guild }` hoặc `{ error }`; bang nhận `guild:member_joined` `{ name }` |
| `guild:leave` | - | ack `{ ok }`; bang nhận `guild:member_left` `{ name }` |
| `cultivate:breakthrough` | - | ack `{ character }` hoặc `{ error }` |

Server phát xuống client (chỉ khi trong tầm nhìn `VIEW_RADIUS`):
`player:joined` `{ characterId, name, mapId, x, y }`, `player:left` `{ characterId }`, `player:moved` `{ characterId, x, y }`,
`monster:appeared` `[{ id, type, name, x, y, hp, maxHp }]`, `monster:attack` `{ id, targetCharacterId, damage }`,
`player:hp` `{ hp, maxHp }`, `player:died` `{ respawnIn }`, `player:respawned` `{ x, y, hp, maxHp }`, `monster:disappeared` `[id]`, `monster:update` `[{ id, x, y }]` (nhịp 200ms).

`character` = `{ id, name, realm: { order, name }, subRealm, exp, expNeeded, currencies: [{ code, name, amount }], map: { id, x, y } | null }`

Vị trí được ghi vào MySQL mỗi 30 giây, khi rời map/ngắt kết nối và khi tắt server.
Thông số tạm trong `src/data.ts` (bán kính nhìn, kích thước map, số quái, tên quái, tên 3 loại tiền) cần chỉnh theo thiết kế thật.
Tu vi (`exp`) tăng khi hạ quái hoặc dùng vật phẩm. Đột phá tốn `expNeeded` = 100 × cảnh giới × tiểu cảnh; hết 10 tiểu cảnh thì sang cảnh giới kế.
Chiến đấu: đòn cơ bản sát thương 10 × cảnh giới, tầm 150, hồi 1 giây. Quái hồi sinh sau 5 giây. Quái đuổi đánh người trong tầm 200.
Người chơi có máu = 100 × cảnh giới (chỉ giữ trong RAM), chết thì sau 3 giây hồi sinh đầy máu ở (0, 0) cùng map.
Bang: bang chủ rời thì nhường cho thành viên có id nhỏ nhất, hết người thì giải tán. Lời mời chỉ gửi được cho người đang online.
Loại quái, vật phẩm, tỉ lệ rơi và số quái mỗi map là dữ liệu mẫu trong `src/data.ts`; sửa rồi chạy lại `npm run seed` và khởi động lại server.
Chưa có: kỹ năng riêng, mua bán, trang bị, đá thành viên bang.
