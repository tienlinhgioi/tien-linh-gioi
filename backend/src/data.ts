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

// Chống gian lận di chuyển, chat, tu luyện, chiến đấu (giá trị tạm)
export const PLAYER_SPEED = 300 // đơn vị/giây, tối đa server chấp nhận
export const CHAT_MAX_LENGTH = 200
export const CHAT_COOLDOWN_MS = { map: 1000, world: 5000, guild: 1000 }
export const expNeeded = (realmOrder: number, subRealm: number) => 100 * realmOrder * subRealm
export const CAST_RANGE = 150
export const CAST_COOLDOWN_MS = 1000
export const BASE_DAMAGE = 10 // sát thương = BASE_DAMAGE * thứ tự cảnh giới
export const MONSTER_RESPAWN_MS = 5000

// Dữ liệu mẫu (tạm): loại quái, vật phẩm, tỉ lệ rơi, số quái mỗi map
export const ITEMS = [
  { code: 'linh_duoc', name: 'Linh Dược', healHp: 50, expGain: 0 },
  { code: 'dan_tu_vi', name: 'Đan Tu Vi', healHp: 0, expGain: 50 },
]
export const MONSTER_TYPES = [
  { code: 'yeu_thu', name: 'Yêu Thú', hp: 50, atk: 5, speed: 40, exp: 20, currency: 'linh_thach', dropMin: 1, dropMax: 3,
    drops: [{ item: 'linh_duoc', chance: 0.3 }] },
  { code: 'son_quai', name: 'Sơn Quái', hp: 120, atk: 12, speed: 40, exp: 50, currency: 'linh_thach', dropMin: 3, dropMax: 8,
    drops: [{ item: 'linh_duoc', chance: 0.4 }, { item: 'dan_tu_vi', chance: 0.2 }] },
]
export const MONSTER_SPAWNS = [
  { type: 'yeu_thu', count: 4 },
  { type: 'son_quai', count: 2 },
]

// Người chơi có máu, quái đuổi đánh (giá trị tạm)
export const PLAYER_BASE_HP = 100 // máu tối đa = PLAYER_BASE_HP * thứ tự cảnh giới
export const AGGRO_RANGE = 200
export const MONSTER_ATTACK_RANGE = 50
export const MONSTER_ATTACK_COOLDOWN_MS = 1500
export const MONSTER_CHASE_FACTOR = 2 // tốc độ đuổi = speed * hệ số
export const RESPAWN_DELAY_MS = 3000
export const RESPAWN_POINT = { x: 0, y: 0 } // hồi sinh ở góc map

// Bang hội
export const GUILD_NAME_MIN = 2
export const GUILD_NAME_MAX = 16
export const GUILD_INVITE_TTL_MS = 60000
