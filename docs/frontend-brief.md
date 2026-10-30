# Giao việc frontend: màn khởi động và giao diện mới (Thủy mặc tiên cảnh)

Người giao: chủ dự án, qua Claude Code. Người làm: Codex (frontend). Backend không đụng vào.

## Mục tiêu

Làm giao diện Tiên Linh Giới có bố cục và luồng chơi giống một game tu tiên thương mại tham khảo (Thiên Kiếp Lục, tklgame.com), nhưng **có chất riêng**: phong cách **thủy mặc tiên cảnh**.

### Cái được học và cái cấm sao chép
- Được học: bố cục màn khởi động (nền tranh toàn màn hình, logo lớn, chọn máy chủ, nút vào chơi nổi bật, đăng nhập tài khoản cũ, hàng ngũ hành, thông báo và số phiên bản ở góc), luồng chơi (khởi động, đăng nhập, tạo nhân vật chọn ngũ hành và tông môn, vào game).
- **Cấm** dùng lại tranh, logo, tên game, tên nhân vật, tên tông môn, câu chữ hoặc biểu tượng của họ. Mọi thứ hiển thị phải là của Tiên Linh Giới. Không hotlink bất cứ thứ gì từ tklgame.com.

## Chất riêng (art direction)
- Thủy mặc: tranh mực, núi non sương mù, mảng loang, nét cọ; màu chủ đạo xanh ngọc, mực đen, giấy dó ấm, điểm nhấn vàng đồng. Không dùng màu rực kiểu chibi.
- Chữ: có một font thư pháp cho logo và tiêu đề, font sans dễ đọc cho nội dung; dùng font tiếng Việt đủ dấu.
- Khung, nút, bảng: nét mảnh, góc vát hoặc ấn triện, bóng nhẹ, không viền vàng bóng.
- Giữ không khí "Thanh Vân Cốc" frontend hiện có; mở rộng chứ không đập bỏ.

## Các màn hình

1. **Khởi động**
   - Nền tranh toàn màn hình (lớp ảnh, có thêm lớp sương và mây chuyển động nhẹ bằng CSS).
   - Logo "Tiên Linh Giới".
   - Khung chọn máy chủ: tên máy chủ, đèn trạng thái, nút "Đổi máy chủ" (hiện chỉ một máy chủ, dữ liệu mẫu).
   - Nút lớn "Vào trò chơi".
   - Liên kết "Đăng nhập tài khoản cũ".
   - Hàng 5 biểu tượng ngũ hành Kim, Mộc, Thủy, Hỏa, Thổ tự vẽ bằng SVG (bấm để xem mô tả ngắn).
   - Góc trên phải: nút "Tải trò chơi" (để trống chỗ, chưa có link) và đổi ngôn ngữ (hiện chỉ có Tiếng Việt).
   - Góc dưới: nút "Thông báo" và số phiên bản.
   - Có phiên bản dọc cho điện thoại và ngang cho máy tính, đúng nguyên tắc giao diện riêng theo thiết bị.
2. **Đăng nhập, tạo tài khoản** (thay hoặc bọc `AuthPanel.vue` hiện có): gmail + tên tài khoản + mật khẩu, không xác minh gmail; đăng nhập được bằng gmail hoặc tên tài khoản; giao diện đơn giản, không đậm chất "AI".
3. **Tạo nhân vật:** nhập tên nhân vật (2-20 ký tự), chọn ngũ hành, chọn tông môn (danh sách bên dưới), chọn avatar.
4. **Giao diện trong game** (theo `lotrinh2.md`):
   - Góc trên trái: khung tròn avatar, bên phải trên là tên người chơi, bên dưới là cảnh giới (kèm tiểu cảnh).
   - Góc trên phải: danh sách tiền tệ đang có (bấm vào ra danh sách đầy đủ).
   - Bấm cảnh giới (bên cạnh) ra một hàng các cảnh giới.
   - Giữ nguyên phần di chuyển, chiến đấu, joystick và túi đồ đang có.

## Dữ liệu

### Tông môn (tên mình đề xuất, chủ dự án sửa được; để trong một file `src/data/sects.ts`)
| Ngũ hành | Tông môn | Mô tả ngắn |
| --- | --- | --- |
| Kim | Huyền Kim Điện | Luyện kiếm trong mây, lấy sắc bén làm đạo. |
| Mộc | Thanh Vân Môn | Tu cùng cây cỏ, lấy sinh khí nuôi thân. |
| Thủy | Hàn Nguyệt Cung | Tĩnh như mặt hồ, mượn sóng trăng dưỡng thần. |
| Hỏa | Xích Diễm Các | Luyện đan trong lửa, đốt kiếp mà thành. |
| Thổ | Hậu Thổ Sơn Trang | Vững như núi, lấy đất làm nền cho đạo tâm. |

### Cảnh giới (đã có trong lộ trình)
Luyện Khí, Trúc Cơ, Nguyên Anh, Hóa Thần, Luyện Hư, Hợp Thể, Động Hư, Độ Kiếp, Đại Thừa, Bán Tiên, Chân Tiên; mỗi cảnh 10 tiểu cảnh.

### Tiền tệ mẫu
Linh Thạch, Tiên Ngọc, Công Đức.

### Map
Tiểu map: Tọa Vực, Vong Vực, Sơn Vực. Đại map: Hắc Thiên Giới.

## Tranh chủ dự án sẽ cung cấp (đặt trong `frontend/public/art/`)

Chưa có file nào thì phải hiện nền thủy mặc tạm bằng CSS/SVG và **không được lỗi, không báo 404**. Có file thì tự hiện. Dùng `import.meta.env.BASE_URL` cho đường dẫn, vì Pages chạy ở `/tien-linh-gioi/`.

| File | Kích thước | Ghi chú |
| --- | --- | --- |
| `bg-title.webp` | 1920×1080 | Nền màn khởi động, bản ngang |
| `bg-title-portrait.webp` | 1080×1920 | Nền màn khởi động, bản dọc |
| `logo.png` | rộng ~1200 | Nền trong suốt |
| `char-1.png`, `char-2.png`, `char-3.png` | cao ~1400 | Tranh nhân vật cắt nền, trong suốt |
| `avatar-1.webp` ... `avatar-6.webp` | 512×512 | Avatar tròn |

Mỗi tệp nên dưới ~500 KB (WebP). Viết `frontend/public/art/README.md` ghi lại bảng này.

## Backend (chưa nối)

Frontend vẫn dùng dữ liệu mẫu, **không gọi API hay socket** lúc này. Khi nối sau: xem `backend/README.md` (danh sách sự kiện Socket.io, đăng nhập `POST /api/login` và `/api/register`, `socket.io-client` kèm `socket.io-msgpack-parser`). Server chưa deploy.

## Yêu cầu chất lượng

- `npm run build`, `npm test` và `npm run test:e2e` phải xanh trước khi push. Trong môi trường cloud: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm run test:e2e`.
- Thêm e2e cho luồng: khởi động, đăng nhập, tạo nhân vật, vào game, trên cả desktop và điện thoại dọc và ngang.
- Không sao chép tài nguyên từ tklgame.com. Không thêm thư viện lớn nếu chưa cần.
- **Test dễ rớt hiện có** (`e2e/sanctuary.spec.ts`, bước kiểm tra Sinh lực = 360 sau khi dùng Hồi Linh Đan): quái đánh 12 sát thương mỗi nhịp nên thỉnh thoảng hp tụt dưới 360 đúng lúc kiểm tra, rớt ở project `mobile` (1 trong 4 lần chạy). Nên đổi sang kiểm tra "hp sau khi dùng đan lớn hơn hp trước khi dùng" thay vì đúng 360.
