# Backend Tiên Linh Giới

## Chạy
```bash
cp .env.example .env   # sửa DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev
npm run seed           # nạp 11 cảnh giới + 4 map
npm run dev            # cổng 3000
```
Kiểm thử luồng chính (cần server đang chạy): `node test/smoke.js`

## API (HTTP)
- `POST /api/register` `{ email, username, password }` -> `{ token, username }`
- `POST /api/login` `{ account, password }` (account = gmail hoặc tên tài khoản) -> `{ token, username }`

## Socket.io (parser msgpack, `auth: { token }`)
| Sự kiện client gửi | Dữ liệu | Trả về / phát ra |
|---|---|---|
| `data:static` | - | ack `{ realms, subRealmsPerRealm, maps }` |
| `player:me` | - | ack `{ character }` (null nếu chưa tạo) |
| `character:create` | `{ name }` | ack `{ character }` hoặc `{ error }` |
| `map:join` | `{ mapId }` | ack `{ players }`; room nhận `player:joined` |
| `map:leave` | - | room nhận `player:left` |
| `move` | `{ x, y }` | room nhận `player:moved` |

`character` = `{ id, name, realm: { order, name }, subRealm, currencies: [{ code, name, amount }] }`

Chưa có: danh sách tiền tệ (bảng `Currency` đang trống), quái, sát thương, lọc người chơi theo vùng gần.
