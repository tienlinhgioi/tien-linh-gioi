# Tiên Linh Giới · Frontend

Vue 3 + TypeScript + Vite + TailwindCSS v4 + PixiJS v8. Phong cách 2D thủy mặc tiên cảnh: xanh ngọc, mực đen, giấy dó ấm và điểm vàng đồng. Tọa Vực là **màn chơi góc nhìn thứ ba từ trên xuống**, camera đi theo nhân vật, có di chuyển và đánh quái. Cần Node **22.12+** hoặc **24 LTS** và npm.

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

Đăng nhập/đăng ký hiện gọi backend thật khi nhập địa chỉ máy chủ. Chỉ nút **Trải nghiệm với nhân vật mẫu** chạy offline, không gọi API/Socket.io hay lưu tài khoản. Nút trải nghiệm đi đến tạo nhân vật với tên gợi ý Thanh Vân. Trong chế độ mẫu, tiến trình/chat nằm trong bộ nhớ và đặt lại khi tải trang/đăng xuất. Chế độ trực tuyến có multiplayer và lưu dữ liệu trên server.

Backend hiện có tại `../backend`: Express, Socket.io với msgpack, Prisma/MySQL. Không thay đổi backend trong đợt tích hợp frontend này. Xem `../backend/README.md` cho API đăng ký `{ email, username, password }`, đăng nhập `{ account, password }`, các sự kiện map/move/cast/loot/inventory/shop/guild.

Chế độ trực tuyến đã tách tên tài khoản khỏi tên nhân vật, gửi email khi đăng ký, dùng token Socket.io và nhận vị trí/quái/sát thương/túi đồ từ server, bao gồm `move:rejected`. Giao dịch, bang hội và cửa hàng đã có giao diện riêng. Các hằng số/nhiệm vụ cục bộ chỉ còn dùng trong chế độ offline.

## Cày quái và chuyển vùng

Bản nâng cấp có bốn vùng: **Thanh Vân Cốc** (cấp 1), **Trúc Ảnh Lâm** (cấp 2) và **Huyền Nguyệt Sơn** (cấp 4) và **Hắc Thiên Giới** (cấp 7). Mỗi 120 tu vi chiến đấu tăng một cấp. Tự điều khiển đánh quái, sau đó đến vòng sáng Truyền Tống Trận phía bắc ở tọa độ (1200, 450); bấm tên vùng hoặc phím **E** để đi tiếp. Cổng kiểm tra cấp, có thể quay lại vùng trước khi đứng gần cổng. Các vùng dùng chung địa hình cơ sở, với sắc cảnh, tre/trúc hoặc tinh thạch và độ mạnh yêu thú khác nhau.

Nhân vật có tám hướng nhìn, tư thế chạy và ra đòn. Đánh thường có vệt kiếm; Kiếm Khí có luồng sáng bay đến mục tiêu, vòng pháp trận và hạt sáng trúng đòn. Hiệu ứng là phần hiển thị; sát thương của bản mẫu vẫn được tính tức thời. Khi bật giảm chuyển động, nhân vật ngừng nhịp lắc trang trí, giữ hoạt ảnh cần để nhận biết chiến đấu.

Giao diện tham khảo cách trình bày RPG của màn vào game Thiên Kiếp Lục (tklgame.com), dùng nét mảnh, khung ngọc và giấy dó, điểm vàng đồng nhẹ; nhân vật, cảnh và hiệu ứng được tự vẽ, không sử dụng tài nguyên của website tham khảo. Chưa tích hợp backend hay lưu tiến trình thật.

## Luồng mới theo frontend brief

Khởi động → Đăng nhập/đăng ký mẫu → Tạo nhân vật → Vào game. Đăng ký dùng Gmail, tên tài khoản (3–20 ký tự ASCII/số/gạch dưới), mật khẩu 6–64 ký tự; đăng nhập nhận Gmail hoặc tên tài khoản. Không xác minh Gmail hay thực hiện xác thực thật.

Tạo nhân vật có tên 2–20 ký tự, năm ngũ hành, tông môn tương ứng trong `src/data/sects.ts` và sáu avatar. Góc trái trong game hiển thị avatar/tên/cảnh giới-tiểu cảnh; bấm cảnh giới để xem 11 cảnh, mỗi cảnh 10 tiểu cảnh. Tiền tệ mẫu: Linh Thạch, Tiên Ngọc, Công Đức; bấm góc phải để xem đầy đủ.

Tọa Vực gồm điểm khởi đầu Thanh Vân Cốc; Vong Vực và Sơn Vực là các vùng tiếp theo. Hắc Thiên Giới được đánh dấu đại map. Cả bốn dùng chung địa hình cơ sở trong bản mẫu, khác bảng màu, cây/trúc/tinh thạch và độ mạnh quái; chưa phải hệ thống bản đồ server thật.

Ảnh tùy chọn và kích thước: xem `public/art/README.md`. Không có ảnh vẫn hiện nền CSS thủy mặc và SVG ngũ hành tự vẽ, không request file thiếu. Có ảnh thì Vite tự phát hiện khi build; dev tự restart khi thêm/xóa. Đường dẫn dùng BASE_URL. Font Dancing Script được đóng gói cục bộ, đủ dấu tiếng Việt; giấy phép OFL trong `src/assets/OFL.txt`.

Kiểm tra Pages: `npm run build -- --base=/tien-linh-gioi/`. Không phụ thuộc ảnh hoặc font CDN. Các ảnh hiện trong README là ảnh chụp ứng dụng, không lấy từ trang tham khảo. `lotrinh2.md` chưa có trong checkout; HUD được làm theo các yêu cầu cụ thể của `docs/frontend-brief.md`.

## Kết nối backend thật

Đăng nhập/đăng ký mặc định gọi API thật tới **Địa chỉ máy chủ** bạn nhập. Có thể đặt `VITE_BACKEND_URL` lúc build (xem `.env.example`). GitHub Pages đọc repository variable cùng tên trong Settings → Secrets and variables → Actions → Variables; đây là URL công khai, không phải secret. Không đưa DATABASE_URL, JWT_SECRET hay mật khẩu vào biến frontend.

Máy chủ cần HTTPS khi giao diện chạy trên HTTPS; CORS `CLIENT_ORIGIN` phải trỏ đúng origin giao diện (Pages: `https://tienlinhgioi.github.io`). Sau khi đăng nhập, frontend dùng Socket.io cùng MessagePack và JWT qua `auth.token`, nhận nhân vật đã có hoặc cho tạo nhân vật. JWT chỉ lưu sessionStorage của tab, không lưu mật khẩu. URL công khai được nhớ trên thiết bị. Ngũ hành/tông môn/avatar hiện lưu cục bộ vì backend chưa có trường tương ứng.

Màn trực tuyến sử dụng trạng thái server cho vị trí, người chơi trong tầm nhìn, quái, HP, hồi sinh, tu vi, tiền và chiến lợi phẩm. Di chuyển có dự đoán hiển thị và xử lý `move:rejected`; không tự tính sát thương hay tự cộng vật phẩm. Mất kết nối khóa thao tác và nối lại đồng bộ map. Các bảng chức năng hỗ trợ túi đồ/dùng/bỏ vật phẩm, 5 ô trang bị, học/thi triển kỹ năng, cửa hàng NPC, đột phá, bang hội và phân quyền, kết bạn/chặn/truyền âm, giao dịch hai chiều/xác nhận/hủy, các kênh chat và chuyển map theo ID server.

**Trải nghiệm với nhân vật mẫu** là chế độ offline riêng, không xác thực hay ghi dữ liệu thật. Các đoạn mô tả bản mẫu trước đây trong tài liệu chỉ áp dụng chế độ này. Nhiệm vụ tự sinh và cổng khóa cấp của bản mẫu không được giả làm chức năng server: backend hiện chưa có API nhiệm vụ; map trực tuyến và đột phá theo đúng luật server.

Đồ họa thử WebGL2 → WebGL1 → Canvas với canvas mới ở mỗi lần thử. Khi GPU không khởi tạo được, vẫn có thể chơi bằng Canvas; giảm resolution và tắt antialias trên thiết bị yếu. Lỗi mở màn không còn kết luận mọi trường hợp là thiếu WebGL.

### Kiểm thử kết nối

`npm test` bao gồm kiểm tra vòng đời HTTP/Socket, timeout, ngắt/nối lại và push từ server. `npm run test:e2e` khởi động production preview cùng **contract fixture** HTTP/Socket.io trong `e2e/fixtures/backend.mjs`: đây là server bộ nhớ dành cho test UI, không phải backend Prisma hay máy chủ production. Kiểm thử renderer giả lập GPU không cấp context/WebGL1-only/không có WebGL. Để xác minh database và toàn bộ quy tắc thực tế, chạy backend theo `../backend/README.md` và các integration suite backend.
