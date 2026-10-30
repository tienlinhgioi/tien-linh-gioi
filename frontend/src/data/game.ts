export type Point = { x: number; y: number };
export type Obstacle = Point & { radius: number };
export const WORLD = { width: 2400, height: 1800 };
export const PLAYER_SPEED = 235;
export const ATTACK_RANGE = 145;
export const obstacles: Obstacle[] = [
  { x: 480, y: 450, radius: 58 },
  { x: 750, y: 270, radius: 45 },
  { x: 1720, y: 400, radius: 55 },
  { x: 1850, y: 1130, radius: 65 },
  { x: 680, y: 1270, radius: 50 },
  { x: 1530, y: 1390, radius: 55 },
  { x: 350, y: 1150, radius: 60 },
  { x: 1980, y: 620, radius: 50 },
];
export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function canWalk(p: Point) {
  if (
    p.x < 70 ||
    p.y < 100 ||
    p.x > WORLD.width - 70 ||
    p.y > WORLD.height - 70
  )
    return false;
  if (p.y > 870 && p.y < 990 && (p.x < 1080 || p.x > 1340)) return false;
  return obstacles.every((o) => distance(p, o) > o.radius + 18);
}
export function movePlayer(
  position: Point,
  direction: Point,
  seconds: number,
): Point {
  const length = Math.hypot(direction.x, direction.y);
  if (!length) return { ...position };
  const step = PLAYER_SPEED * Math.min(Math.max(seconds, 0), 0.05);
  const x = position.x + (direction.x / length) * step;
  const y = position.y + (direction.y / length) * step;
  const next = { ...position };
  if (canWalk({ x, y: next.y })) next.x = x;
  if (canWalk({ x: next.x, y })) next.y = y;
  return next;
}
export type MonsterSeed = {
  id: number;
  name: string;
  kind: "slime" | "wolf";
  x: number;
  y: number;
  maxHp: number;
  exp: number;
};
export const monsterSeeds: MonsterSeed[] = [
  {
    id: 1,
    name: "Mộc Linh",
    kind: "slime",
    x: 1040,
    y: 740,
    maxHp: 72,
    exp: 30,
  },
  {
    id: 2,
    name: "Mộc Linh",
    kind: "slime",
    x: 1370,
    y: 620,
    maxHp: 72,
    exp: 30,
  },
  {
    id: 3,
    name: "Thanh Lang",
    kind: "wolf",
    x: 1660,
    y: 700,
    maxHp: 120,
    exp: 60,
  },
  {
    id: 4,
    name: "Mộc Linh",
    kind: "slime",
    x: 800,
    y: 720,
    maxHp: 72,
    exp: 30,
  },
  {
    id: 5,
    name: "Thanh Lang",
    kind: "wolf",
    x: 1500,
    y: 1160,
    maxHp: 120,
    exp: 60,
  },
  {
    id: 6,
    name: "Mộc Linh",
    kind: "slime",
    x: 1060,
    y: 1200,
    maxHp: 72,
    exp: 30,
  },
  {
    id: 7,
    name: "Thanh Lang",
    kind: "wolf",
    x: 1800,
    y: 1400,
    maxHp: 120,
    exp: 60,
  },
  {
    id: 8,
    name: "Mộc Linh",
    kind: "slime",
    x: 750,
    y: 1450,
    maxHp: 72,
    exp: 30,
  },
];
