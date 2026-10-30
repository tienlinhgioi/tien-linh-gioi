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
export const BASE_DAMAGE = 10 // sát thương = BASE_DAMAGE * thứ tự cảnh giới
export const MONSTER_RESPAWN_MS = 5000

// Dữ liệu mẫu (tạm): loại quái, vật phẩm, tỉ lệ rơi, số quái mỗi map
export const ITEMS: { code: string; name: string; healHp: number; expGain: number; slot: string | null; atkBonus: number; hpBonus: number }[] = [
  { code: 'linh_duoc', name: 'Linh Dược', healHp: 50, expGain: 0, slot: null, atkBonus: 0, hpBonus: 0 },
  { code: 'dan_tu_vi', name: 'Đan Tu Vi', healHp: 0, expGain: 50, slot: null, atkBonus: 0, hpBonus: 0 },
  { code: 'thiet_kiem', name: 'Thiết Kiếm', healHp: 0, expGain: 0, slot: 'WEAPON', atkBonus: 5, hpBonus: 0 },
  { code: 'ao_vai', name: 'Áo Vải', healHp: 0, expGain: 0, slot: 'ARMOR', atkBonus: 0, hpBonus: 30 },
]
export const MONSTER_TYPES = [
  { code: 'yeu_thu', name: 'Yêu Thú', hp: 50, atk: 5, speed: 40, exp: 20, currency: 'linh_thach', dropMin: 1, dropMax: 3,
    drops: [{ item: 'linh_duoc', chance: 0.3 }, { item: 'thiet_kiem', chance: 0.05 }] },
  { code: 'son_quai', name: 'Sơn Quái', hp: 120, atk: 12, speed: 40, exp: 50, currency: 'linh_thach', dropMin: 3, dropMax: 8,
    drops: [{ item: 'linh_duoc', chance: 0.4 }, { item: 'dan_tu_vi', chance: 0.2 }, { item: 'thiet_kiem', chance: 0.08 }, { item: 'ao_vai', chance: 0.1 }] },
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

// Trang bị: các ô được phép; bonus nằm trong bảng Item
export const SLOTS = ['WEAPON', 'ARMOR']

// Kỹ năng (mở khóa theo cảnh giới). Sát thương = damageMult * (BASE_DAMAGE * cảnh giới + atk trang bị)
export const BASIC_SKILL = 'co_ban'
export const SKILLS = [
  { code: 'co_ban', name: 'Đòn Cơ Bản', damageMult: 1, range: 150, cooldownMs: 1000, minRealm: 1 },
  { code: 'kiem_khi', name: 'Kiếm Khí', damageMult: 3, range: 250, cooldownMs: 5000, minRealm: 2 },
]

// NPC cửa hàng (mỗi map một NPC cùng vị trí); giá tính bằng Linh Thạch, bán lại nửa giá
export const SHOP_NPC = { name: 'Chưởng Quầy', x: 50, y: 50 }
export const SHOP_RANGE = 100
export const SHOP_CURRENCY = 'linh_thach'
export const SHOP_GOODS = [
  { item: 'linh_duoc', price: 10 },
  { item: 'dan_tu_vi', price: 30 },
  { item: 'thiet_kiem', price: 100 },
  { item: 'ao_vai', price: 80 },
]
