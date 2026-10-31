# Tích hợp frontend với backend

Frontend không thay đổi giao thức backend. HTTP: `/api/register`, `/api/login`; Socket.io dùng `socket.io-msgpack-parser`, token trong handshake.

| Nhóm | Yêu cầu / phản hồi đã nối |
| --- | --- |
| Khởi tạo | data:static, player:me, character:create |
| Bản đồ | map:join, map:leave, move; sửa vị trí theo move:rejected |
| Realtime | player:joined/left/moved, monster:appeared/update/disappeared |
| Chiến đấu | cast, monster:hit/attack, player:hp/died/respawned/exp/loot |
| Hành trang | inventory:get/use/drop |
| Trang bị | equipment:get/equip/unequip, 5 ô theo server |
| Công pháp | skill:list/learn, chọn kỹ năng đã học để thi triển |
| Tu luyện | cultivate:breakthrough, refresh nhân vật và điểm kỹ năng |
| NPC | shop:list/buy/sell; lỗi khoảng cách/điều kiện hiển thị từ server |
| Bang hội | guild:info/create/invite/accept/leave/kick/transfer/promote/demote; cập nhật thành viên/chức vị/lời mời |
| Quan hệ | friend:list/request/accept/remove, block:add/remove; lời mời và trạng thái từ server |
| Chat | chat:send map/world/guild, chat:whisper, chat:message |
| Giao dịch | trade:request/accept/offer/confirm/cancel, requested/started/update/completed/cancelled; xác nhận lại khi đề nghị thay đổi |

Không tự retry lệnh thay đổi dữ liệu khi timeout. Thao tác đã được server xác nhận vẫn được coi là hoàn tất nếu lần tải lại dữ liệu lỗi, tránh khuyến khích mua/giao dịch lặp. Khi đổi phiên hoặc disconnect, phản hồi cũ không được áp vào phiên mới. Khi reconnect tải lại trạng thái và vào lại map.

## Triển khai

Cần URL HTTPS của backend đã triển khai và `CLIENT_ORIGIN` đúng origin Pages. Đặt repository variable `VITE_BACKEND_URL` hoặc nhập URL trên màn đăng nhập. Không thể dùng database Supabase trực tiếp thay cho server Node/Socket.io. Không có URL production mặc định được tự đoán.

Backend có cấu hình Render trong `render.yaml`; việc tạo web service, cung cấp DATABASE_URL và kiểm tra /health là bước hạ tầng riêng. Khóa server không được đưa vào bundle frontend.

## Giới hạn

Backend chưa lưu ngũ hành/tông môn/avatar và chưa có nhiệm vụ. Các lựa chọn mỹ thuật giữ cục bộ, nhiệm vụ demo không phát thưởng vào tài khoản thật. Contract fixture trong test kiểm tra client/transport/UI; kết quả đó không chứng minh server production hay database đã sẵn sàng.
