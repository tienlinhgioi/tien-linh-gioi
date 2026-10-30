# Tiên Linh Giới · Frontend

Vue 3 + TypeScript + Vite + TailwindCSS v4 + PixiJS v8. Phong cách 2D tiên cảnh xanh ngọc/trắng ngà. Tọa Vực là **màn chơi góc nhìn thứ ba từ trên xuống**, camera đi theo nhân vật, có di chuyển và đánh quái. Cần Node **22.12+** hoặc **24 LTS** và npm.

## Chạy

```bash
cd frontend
npm ci --no-audit --no-fund
npm run dev
```

Vite dùng cổng 5173. Bản chơi mẫu không cần database, biến môi trường hay backend.

```bash
npm run build       # kiểm tra TypeScript và tạo dist/
npm run preview     # phục vụ bản production ở cổng 4173
npm test            # test logic đăng nhập mẫu, di chuyển và va chạm
```

## Điều khiển

| Thao tác    | PC                          | Mobile / thiết bị cảm ứng |
| ----------- | --------------------------- | ------------------------- |
| Di chuyển   | WASD hoặc phím mũi tên      | Joystick bên trái         |
| Đánh thường | J / Space hoặc nút tấn công | Nút kiếm bên phải         |
| Kiếm Khí    | Q                           | Nút Kiếm Khí              |
| Hồi máu     | 1                           | Nút đan dược              |
| Túi đồ      | I                           | Nút Túi đồ                |
| Hướng dẫn   | H                           | Nút dấu hỏi               |

Đến gần quái để đánh. Mộc Linh và Thanh Lang tự truy đuổi/tấn công; hạ quái nhận tu vi, linh thạch và linh thảo. Quái hồi sinh sau 8 giây, nhân vật hồi sinh tại đình sau 4 giây khi hết máu. Qua cầu để đến phần phía nam bản đồ; không thể đi xuyên cây hay suối. Hạ 3 yêu thú rồi bấm nhận thưởng tiên vụ. Có minimap, thanh máu, kỹ năng hồi chiêu, túi đồ, nhật ký và chat mô phỏng cục bộ.

PC dùng HUD rộng và hướng dẫn phím. Mobile dùng HUD gọn, joystick và cụm nút chiến đấu, hỗ trợ cả xoay ngang và thiết bị cảm ứng màn hình lớn. Minh họa nhân vật, cây, đình, suối, cầu và quái được vẽ bằng PixiJS Graphics, không phụ thuộc ảnh/CDN ngoài. Cần WebGL; trang đăng nhập có nền dự phòng nếu không có WebGL, màn chơi hiển thị hướng dẫn lỗi đồ họa.

## Kiểm thử trình duyệt

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

Nếu máy đã có Chromium:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Playwright tự chạy production preview. Kiểm tra đăng ký/xác nhận mật khẩu, đăng nhập/đăng xuất, di chuyển, joystick, đánh quái, cooldown, vật phẩm rơi, túi đồ, nhật ký và bố cục. Một worker để giảm tải máy.

## Dữ liệu mẫu và backend

Đăng nhập/đăng ký là **mô phỏng**, không xác thực tài khoản thật. Không lưu/gửi mật khẩu, không gọi API hay Socket.io. Nút trải nghiệm mở nhân vật Thanh Vân. Mọi tiến trình và chat nằm trong bộ nhớ, đặt lại khi tải trang/đăng xuất; chưa có multiplayer.

Backend hiện có tại `../backend`: Express, Socket.io với msgpack, Prisma/MySQL. Giữ nguyên toàn bộ backend. Xem `../backend/README.md` cho API đăng ký `{ email, username, password }`, đăng nhập `{ account, password }`, các sự kiện map/move/cast/loot/inventory/shop/guild.

Khi tích hợp thật cần tách đạo danh hiển thị khỏi `username` (3–20 ký tự ASCII/chữ số/gạch dưới), thêm email khi đăng ký, dùng token Socket.io, nhận vị trí/quái/sát thương/túi đồ từ server và xử lý `move:rejected`. Gameplay mẫu hiện có hằng số và nhiệm vụ cục bộ, chưa dùng logic hay dữ liệu server. Chưa có giao dịch, bang hội, cửa hàng hay lưu tiến trình thật trong frontend này.
