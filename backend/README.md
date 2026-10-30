# Backend Tiên Linh Giới

## Chạy
```bash
cp .env.example .env   # sửa DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev
npm run seed           # nạp 11 cảnh giới, 4 map, 3 loại tiền
npm run dev            # cổng 3000
```
Kiểm thử (cần server đang chạy): `node test/smoke.js`, `node test/world.js`, `node test/rules.js`

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
| `chat:send` | `{ channel: 'map' \| 'world', text }` | ack `{ ok }` hoặc `{ error }`; mọi người nhận `chat:message` `{ channel, from, text, at }` |
| `cast` | `{ targetId }` (id quái) | ack `{ damage, hp, killed }` hoặc `{ error }`; người trong tầm nhận `monster:hit` `{ id, hp, damage, by }`; người hạ quái nhận `player:exp` `{ exp, expNeeded }` |
| `cultivate:breakthrough` | - | ack `{ character }` hoặc `{ error }` |

Server phát xuống client (chỉ khi trong tầm nhìn `VIEW_RADIUS`):
`player:joined` `{ characterId, name, mapId, x, y }`, `player:left` `{ characterId }`, `player:moved` `{ characterId, x, y }`,
`monster:appeared` `[{ id, name, x, y, hp, maxHp }]`, `monster:disappeared` `[id]`, `monster:update` `[{ id, x, y }]` (nhịp 200ms).

`character` = `{ id, name, realm: { order, name }, subRealm, exp, expNeeded, currencies: [{ code, name, amount }], map: { id, x, y } | null }`

Vị trí được ghi vào MySQL mỗi 30 giây, khi rời map/ngắt kết nối và khi tắt server.
Thông số tạm trong `src/data.ts` (bán kính nhìn, kích thước map, số quái, tên quái, tên 3 loại tiền) cần chỉnh theo thiết kế thật.
Tu vi (`exp`) chỉ tăng khi hạ quái. Đột phá tốn `expNeeded` = 100 × cảnh giới × tiểu cảnh; hết 10 tiểu cảnh thì sang cảnh giới kế.
Chiến đấu hiện chỉ có đòn đánh cơ bản: sát thương = 10 × cảnh giới, tầm 150, hồi 1 giây. Quái hồi sinh sau 5 giây.
Chưa có: kỹ năng riêng, quái theo loại, quái tấn công lại, vật phẩm rơi.
