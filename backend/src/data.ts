export const REALMS = [
  'Luyện Khí', 'Trúc Cơ', 'Nguyên Anh', 'Hóa Thần', 'Luyện Hư', 'Hợp Thể',
  'Động Hư', 'Độ Kiếp', 'Đại Thừa', 'Bán Tiên', 'Chân Tiên',
]
export const SUB_REALMS_PER_REALM = 10

export const MAPS: { name: string; kind: 'SMALL' | 'LARGE' }[] = [
  { name: 'Tọa Vực', kind: 'SMALL' },
  { name: 'Vong Vực', kind: 'SMALL' },
  { name: 'Sơn Vực', kind: 'SMALL' },
  { name: 'Hắc Thiên Giới', kind: 'LARGE' },
]

export const CURRENCIES = [
  { code: 'linh_thach', name: 'Linh Thạch' },
  { code: 'tien_ngoc', name: 'Tiên Ngọc' },
  { code: 'cong_duc', name: 'Công Đức' },
]

// Thông số thế giới (giá trị tạm, chỉnh theo thiết kế map thật)
export const VIEW_RADIUS = 600 // chỉ gửi người/quái trong bán kính này
export const MAP_SIZE = 2000
export const TICK_MS = 200 // nhịp game loop
export const SAVE_INTERVAL_MS = 30000 // ghi vị trí vào MySQL
export const MONSTERS_PER_MAP = 5
export const MONSTER_NAME = 'Yêu Thú' // tên tạm
export const MONSTER_SPEED = 40 // đơn vị/giây

// Chống gian lận di chuyển, chat, tu luyện, chiến đấu (giá trị tạm)
export const PLAYER_SPEED = 300 // đơn vị/giây, tối đa server chấp nhận
export const CHAT_MAX_LENGTH = 200
export const CHAT_COOLDOWN_MS = { map: 1000, world: 5000 }
export const expNeeded = (realmOrder: number, subRealm: number) => 100 * realmOrder * subRealm
export const CAST_RANGE = 150
export const CAST_COOLDOWN_MS = 1000
export const BASE_DAMAGE = 10 // sát thương = BASE_DAMAGE * thứ tự cảnh giới
export const MONSTER_HP = 50
export const MONSTER_EXP = 20
export const MONSTER_RESPAWN_MS = 5000
