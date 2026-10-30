# Cloud development

Mỗi tác vụ cloud có môi trường riêng; dùng checkout sẵn có `/workspace/tien-linh-gioi`. Không tạo Git worktree nếu người dùng không yêu cầu.

## Cài đặt

```bash
cd /workspace/tien-linh-gioi/frontend
npm ci --cache /tmp/tien-linh-npm --no-audit --no-fund
npm run build
npm test
```

Cần Node 22.12+ hoặc 24 LTS. Giữ nguyên TLS, proxy và kiểm tra integrity npm. Không ghi secret vào mã nguồn/script. Nếu sandbox chặn proxy hoặc mở port (ECONNREFUSED/EPERM), dùng cơ chế cấp quyền của môi trường; không tắt proxy hoặc TLS.

## Khởi động và xác minh

Trong `frontend`, chạy `npm run dev -- --port 5173 --strictPort`. Kiểm tra HTTP trả về ứng dụng. Trong trình duyệt hỗ trợ WebGL, bấm “Vào trò chơi”, chọn “Trải nghiệm với nhân vật mẫu”, chọn ngũ hành/tông môn/avatar và tạo nhân vật: phải thấy bản đồ Thanh Vân Cốc, nhân vật và quái. WASD/mũi tên di chuyển; J đánh, Q Kiếm Khí. Mobile dùng joystick và nút chiến đấu. Hạ quái phải tăng tu vi/linh thạch và có linh thảo trong túi đồ.

Kiểm thử trình duyệt: `npm run build`, rồi `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` nếu Chromium có sẵn. Nếu chưa có, cài browser bằng `npx playwright install chromium` qua chính sách mạng được cho phép. Bộ test tự chạy production preview trên 4173.

Không giả định tiến trình server còn sống sau khi khôi phục snapshot. Khởi động lại khi cần. Không tạo link preview localhost trong onboarding.

Backend hiện có được giữ nguyên. Quy trình frontend dữ liệu mẫu không cần backend/database/secret và không gửi API/Socket.io. Việc chạy MySQL và integration backend nằm ngoài quy trình frontend này.
