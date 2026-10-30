# Backend Tiên Linh Giới

## Chạy
```bash
cp .env.example .env   # sửa DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev
npm run seed           # nạp 11 cảnh giới, 4 map, 3 loại tiền
npm run dev            # cổng 3000
```
Kiểm thử (cần server đang chạy): `node test/smoke.js` và `node test/world.js`

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
| `move` | `{ x, y }` | - |

Server phát xuống client (chỉ khi trong tầm nhìn `VIEW_RADIUS`):
`player:joined` `{ characterId, name, mapId, x, y }`, `player:left` `{ characterId }`, `player:moved` `{ characterId, x, y }`,
`monster:appeared` `[{ id, name, x, y }]`, `monster:disappeared` `[id]`, `monster:update` `[{ id, x, y }]` (nhịp 200ms).

`character` = `{ id, name, realm: { order, name }, subRealm, currencies: [{ code, name, amount }], map: { id, x, y } | null }`

Vị trí được ghi vào MySQL mỗi 30 giây, khi rời map/ngắt kết nối và khi tắt server.
Thông số tạm trong `src/data.ts` (bán kính nhìn, kích thước map, số quái, tên quái, tên 3 loại tiền) cần chỉnh theo thiết kế thật.
Chưa có: sát thương, kỹ năng, quái theo loại, kiểm tra tốc độ di chuyển.
