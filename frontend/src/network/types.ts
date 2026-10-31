export interface Realm {
  id: number;
  order: number;
  name: string;
}
export interface GameMap {
  id: number;
  name: string;
  kind: "SMALL" | "LARGE";
}
export interface Currency {
  code: string;
  name: string;
  amount: number;
}
export interface Character {
  id: number;
  name: string;
  realm: { order: number; name: string };
  subRealm: number;
  exp: number;
  expNeeded: number;
  skillPoints: number;
  currencies: Currency[];
  map: { id: number; x: number; y: number } | null;
  guild: { id: number; name: string } | null;
}
export interface StaticData {
  realms: Realm[];
  maps: GameMap[];
  subRealmsPerRealm: number;
}
export interface Position {
  x: number;
  y: number;
}
export interface WorldPlayer extends Position {
  characterId: number;
  name: string;
  mapId: number;
}
export interface Monster extends Position {
  id: number;
  type: string;
  name: string;
  hp: number;
  maxHp: number;
}
export interface Npc extends Position {
  name: string;
}
export interface MapView extends Position {
  hp: number;
  maxHp: number;
  players: WorldPlayer[];
  monsters: Monster[];
  npcs: Npc[];
}
export type Slot = "WEAPON" | "ARMOR" | "HELMET" | "BOOTS" | "RING";
export interface Equipment {
  code: string;
  name: string;
  quality: string;
  atkBonus: number;
  hpBonus: number;
}
export interface Item extends Equipment {
  count: number;
  healHp: number;
  expGain: number;
  slot: Slot | null;
}
export type Slots = Record<Slot, Equipment | null>;
export interface Skill {
  code: string;
  name: string;
  damageMult: number;
  range: number;
  cooldownMs: number;
  minRealm: number;
  cost: number;
  learned: boolean;
  canLearn: boolean;
}
export interface SkillList {
  points: number;
  skills: Skill[];
}
export type GuildRole = "LEADER" | "DEPUTY" | "MEMBER";
export interface Guild {
  id: number;
  name: string;
  leader: string | null;
  members: { name: string; online: boolean; role: GuildRole }[];
}
export interface FriendList {
  friends: { name: string; online: boolean }[];
  blocked: string[];
}
export interface Shop {
  npc: Npc;
  currency: { code: string; name: string } | null;
  goods: { code: string; name: string; price: number; sellPrice: number }[];
}
export interface ChatMessage {
  channel: "map" | "world" | "guild" | "whisper";
  from: string;
  to?: string;
  text: string;
  at: number;
}
export interface TradeSide {
  name: string;
  items: Record<string, number>;
  currencies: Record<string, number>;
  confirmed: boolean;
}
export interface TradeView {
  me: TradeSide;
  other: TradeSide;
}
export interface Loot {
  exp: number;
  currencies: Currency[];
  items: { code: string; name: string; quality: string; count: number }[];
}
export interface CombatEvents {
  "monster:hit": {
    id: number;
    hp: number;
    damage: number;
    by: number;
    skill: string;
  };
  "monster:attack": { id: number; targetCharacterId: number; damage: number };
  "player:loot": Loot;
}
export interface Invitation {
  id: number;
  kind: "friend" | "guild" | "trade";
  from: string;
  guildName?: string;
  expiresAt: number;
}
export interface Notification {
  id: number;
  event: string;
  text: string;
  at: number;
}
export type ConnectionStatus =
  | "idle"
  | "authenticating"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";
type Named = { name: string };
type Code = { code: string };
type Counted = Code & { count: number };
type Ok = { ok: boolean };
type CharResult = { character: Character | null };
type GuildResult = { guild: Guild | null };
type EquipmentResult = { slots: Slots };
export interface Requests {
  "data:static": [undefined, StaticData];
  "player:me": [undefined, CharResult];
  "character:create": [Named, CharResult];
  "map:join": [{ mapId?: number } | undefined, MapView];
  "chat:send": [{ channel: "map" | "world" | "guild"; text: string }, Ok];
  "chat:whisper": [{ to: string; text: string }, Ok];
  "skill:list": [undefined, SkillList];
  "skill:learn": [Code, Ok & { points: number }];
  cast: [
    { targetId: number; skill?: string },
    { damage: number; hp: number; killed: boolean; typeId: number },
  ];
  "inventory:get": [undefined, { items: Item[] }];
  "inventory:use": [Code, Ok];
  "inventory:drop": [Counted, Ok];
  "equipment:get": [undefined, EquipmentResult];
  "equipment:equip": [Code, EquipmentResult];
  "equipment:unequip": [{ slot: Slot }, EquipmentResult];
  "guild:info": [undefined, GuildResult];
  "guild:create": [Named, GuildResult];
  "guild:invite": [Named, Ok];
  "guild:accept": [undefined, GuildResult];
  "guild:leave": [undefined, Ok];
  "guild:kick": [Named, Ok];
  "guild:transfer": [Named, GuildResult];
  "guild:promote": [Named, GuildResult];
  "guild:demote": [Named, GuildResult];
  "friend:list": [undefined, FriendList];
  "friend:request": [Named, Ok];
  "friend:accept": [Named, Ok];
  "friend:remove": [Named, Ok];
  "block:add": [Named, Ok];
  "block:remove": [Named, Ok];
  "trade:request": [Named, Ok];
  "trade:accept": [undefined, Ok];
  "trade:offer": [
    { items: Counted[]; currencies: { code: string; amount: number }[] },
    Ok,
  ];
  "trade:confirm": [undefined, Ok];
  "trade:cancel": [undefined, Ok];
  "shop:list": [undefined, Shop];
  "shop:buy": [Counted, Ok & { spent: number }];
  "shop:sell": [Counted, Ok & { earned: number }];
  "cultivate:breakthrough": [undefined, CharResult];
}
export type RequestEvent = keyof Requests;
export type RequestArgs<E extends RequestEvent> =
  undefined extends Requests[E][0]
    ? [payload?: Requests[E][0]]
    : [payload: Requests[E][0]];
export interface GameState {
  status: ConnectionStatus;
  error: string | null;
  endpoint: string;
  username: string;
  character: Character | null;
  staticData: StaticData;
  world: MapView & {
    mapId: number | null;
    joined: boolean;
    dead: boolean;
    respawnAt: number | null;
  };
  messages: ChatMessage[];
  invitations: Invitation[];
  notifications: Notification[];
  trade: (TradeView & { with: string }) | null;
  inventory: Item[];
  equipment: Slots;
  skills: SkillList;
  guild: Guild | null;
  friends: FriendList;
  shop: Shop | null;
  lastLoot: Loot | null;
}
