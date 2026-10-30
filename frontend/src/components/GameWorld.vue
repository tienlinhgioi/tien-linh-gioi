<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Application, Container, Graphics, Text } from "pixi.js";
import { createHero } from "../game/character";
import { createEffects } from "../game/effects";
import {
  regions,
  levelFromExp,
  canEnterRegion,
  facingDirection,
} from "../data/game";
import ModalDialog from "./ModalDialog.vue";
import {
  ATTACK_RANGE,
  WORLD,
  canWalk,
  distance,
  monsterSeeds,
  movePlayer,
  obstacles,
} from "../data/game";
import type { MonsterSeed, Point } from "../data/game";

import { realms } from "../data/sects";
import type { CharacterProfile } from "../data/sects";
import { art } from "../data/art";
const props = defineProps<{ name: string; profile?: CharacterProfile }>();
const emit = defineEmits<{ logout: [] }>();
const host = ref<HTMLDivElement>();
const ready = ref(false);
const failure = ref(false);
const regionIndex = ref(0);
const region = computed(() => regions[regionIndex.value]!);
const level = computed(() => levelFromExp(exp.value));
const nearPortal = computed(
  () => distance(position.value, { x: 1200, y: 450 }) < 115,
);
let hero: ReturnType<typeof createHero> | undefined;
let combatEffects: ReturnType<typeof createEffects> | undefined;
let portal: Container | undefined;
let terrain: Container | undefined;
let biome: Graphics | undefined;
let regionLabel: Text | undefined;
let direction = 2;
const hp = ref(360);
const exp = ref(0);
const coins = ref(1280);
const kills = ref(0);
const potions = ref(5);
const herbs = ref(0);
const skillCooldown = ref(0);
const attackCooldown = ref(0);
const deadFor = ref(0);
const target = ref<{
  id: number;
  name: string;
  hp: number;
  maxHp: number;
} | null>(null);
const panel = ref<
  "inventory" | "help" | "journal" | "currencies" | "realms" | null
>(null);
const journal = ref([
  "Đã đến Thanh Vân Cốc. Hãy tìm Mộc Linh gần lối đi để luyện kiếm.",
]);
const notice = ref("");
const joystick = ref({ x: 0, y: 0 });
const position = ref<Point>({ x: 1200, y: 650 });
const chatInput = ref("");
const chat = ref([
  "[Dẫn đường] Thanh Vân Cốc có Mộc Linh và Thanh Lang. Cẩn thận khi đến gần!",
]);
const chatOpen = ref(false);
const questClaimed = ref(false);
const fullScreen = ref(false);
const panelTitle = computed(() =>
  panel.value === "currencies"
    ? "Tiền Tệ"
    : panel.value === "realms"
      ? "Cảnh Giới Tiên Đạo"
      : panel.value === "inventory"
        ? "Túi Càn Khôn"
        : panel.value === "journal"
          ? "Nhật Ký Hành Trình"
          : "Cách Chơi",
);
let app: Application | undefined;
let resizeObserver: ResizeObserver | undefined;
let disposed = false;
let actor: Container | undefined;
let world: Container | undefined;
let entityLayer: Container | undefined;
let effects: Container | undefined;
let playerHp: Graphics | undefined;
let sword: Graphics | undefined;
let selection: Graphics | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let elapsed = 0;
let lastMapUpdate = 0;
const minimapMobs = ref(
  monsterSeeds.map((m) => ({ id: m.id, x: m.x, y: m.y })),
);
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
let facing = 1;
const keys = new Set<string>();
const floating: { node: Text; life: number }[] = [];
type Mob = MonsterSeed & {
  hp: number;
  spawn: Point;
  view: Container;
  bar: Graphics;
  body: Container;
  respawn: number;
  hitCooldown: number;
};
let mobs: Mob[] = [];
const held = computed(
  () =>
    `${Math.round(joystick.value.x * 24)}px, ${Math.round(joystick.value.y * 24)}px`,
);
function notify(text: string) {
  notice.value = text;
  clearTimeout(timer);
  timer = setTimeout(() => (notice.value = ""), 3500);
}
function addJournal(text: string) {
  journal.value.unshift(text);
  journal.value = journal.value.slice(0, 15);
}
function chooseTarget() {
  return mobs
    .filter((m) => m.hp > 0)
    .sort(
      (a, b) => distance(position.value, a) - distance(position.value, b),
    )[0];
}
function float(text: string, x: number, y: number, color = "#fff4c8") {
  if (!effects) return;
  const node = new Text({
    text,
    style: {
      fontFamily: "Georgia, serif",
      fontSize: 21,
      fontWeight: "bold",
      fill: color,
      stroke: { color: "#254b3d", width: 3 },
    },
  });
  node.anchor.set(0.5);
  node.position.set(x, y - 45);
  effects.addChild(node);
  floating.push({ node, life: 1 });
}
function attack(skill = false) {
  if (!ready.value || deadFor.value || panel.value || chatOpen.value) return;
  if (skill ? skillCooldown.value > 0 : attackCooldown.value > 0) return;
  const mob = chooseTarget();
  if (!mob || distance(position.value, mob) > (skill ? 260 : ATTACK_RANGE)) {
    notify("Hãy đến gần quái hơn để xuất chiêu.");
    return;
  }
  target.value = { id: mob.id, name: mob.name, hp: mob.hp, maxHp: mob.maxHp };
  facing = mob.x >= position.value.x ? 1 : -1;
  if (skill) skillCooldown.value = 5;
  attackCooldown.value = 0.6;
  if (sword) {
    sword.alpha = 1;
    sword.scale.x = facing;
  }
  direction = facingDirection(
    mob.x - position.value.x,
    mob.y - position.value.y,
  );
  combatEffects?.cast(position.value, mob, skill);
  const damage = (skill ? 60 : 24) + (level.value - 1) * 6;
  mob.hp = Math.max(0, mob.hp - damage);
  mob.body.tint = 0xffe9b8;
  float(`−${damage}`, mob.x, mob.y, skill ? "#ffdc84" : "#fff5cd");
  target.value.hp = mob.hp;
  if (mob.hp === 0) {
    kills.value++;
    exp.value += mob.exp;
    coins.value += 18;
    herbs.value++;
    mob.respawn = 8;
    mob.view.visible = false;
    addJournal(
      `Hạ ${mob.name}: +${mob.exp} tu vi, +18 linh thạch, +1 linh thảo.`,
    );
    notify(`Hạ ${mob.name} · +${mob.exp} tu vi · +18 linh thạch`);
    target.value = null;
  }
}
function heal() {
  if (deadFor.value) return;
  if (!potions.value) {
    notify("Đã dùng hết Hồi Linh Đan.");
    return;
  }
  if (hp.value === 360) {
    notify("Sinh lực đang đầy.");
    return;
  }
  potions.value--;
  hp.value = Math.min(360, hp.value + 140);
  float("+140", position.value.x, position.value.y, "#c7f5ac");
  notify("Hồi Linh Đan · hồi 140 sinh lực");
}
function claimQuest() {
  if (kills.value < 3 || questClaimed.value) return;
  questClaimed.value = true;
  coins.value += 150;
  potions.value += 2;
  notify("Hoàn thành tiên vụ · +150 linh thạch · +2 Hồi Linh Đan");
  addJournal("Hoàn thành tiên vụ Thanh trừ yêu khí.");
}
function sendChat() {
  const text = chatInput.value.trim().slice(0, 120);
  if (text) chat.value.push(`[${props.name}] ${text}`);
  chat.value = chat.value.slice(-5);
  chatInput.value = "";
  chatOpen.value = false;
}
function openPanel(next: typeof panel.value) {
  keys.clear();
  joystick.value = { x: 0, y: 0 };
  panel.value = next;
}
function keydown(event: KeyboardEvent) {
  if (
    (event.target as HTMLElement)?.matches(
      "input,textarea,[contenteditable]",
    ) ||
    panel.value ||
    chatOpen.value
  )
    return;
  const key = event.key.toLowerCase();
  if (key === " " && (event.target as HTMLElement)?.closest("button,a")) return;
  if (
    [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
      " ",
      "j",
      "q",
      "1",
      "i",
      "h",
    ].includes(key)
  )
    event.preventDefault();
  keys.add(key);
  if (event.repeat) return;
  if (key === " " || key === "j") attack();
  if (key === "q") attack(true);
  if (key === "1") heal();
  if (key === "e" && nearPortal.value) travel(1);
  if (key === "i") openPanel("inventory");
  if (key === "h") openPanel("help");
}
function resetInput() {
  keys.clear();
  joystick.value = { x: 0, y: 0 };
}
function stick(event: PointerEvent) {
  const el = event.currentTarget as HTMLElement;
  el.setPointerCapture(event.pointerId);
  const rect = el.getBoundingClientRect();
  const dx = (event.clientX - rect.left - rect.width / 2) / 35;
  const dy = (event.clientY - rect.top - rect.height / 2) / 35;
  const length = Math.max(1, Math.hypot(dx, dy));
  joystick.value = { x: dx / length, y: dy / length };
}
function stickMove(event: PointerEvent) {
  if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId))
    stick(event);
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await host.value?.parentElement?.requestFullscreen();
    fullScreen.value = !!document.fullscreenElement;
  } catch {
    notify("Trình duyệt không hỗ trợ chế độ toàn màn hình.");
  }
}
function buildMob(kind: "slime" | "wolf") {
  const body = new Container();
  const g = new Graphics();
  g.ellipse(0, 12, 22, 8).fill({ color: 0x294b3a, alpha: 0.18 });
  if (kind === "slime") {
    g.moveTo(-22, 8)
      .bezierCurveTo(-28, -32, 26, -32, 23, 8)
      .quadraticCurveTo(0, 25, -22, 8)
      .fill(0x91bd8d)
      .stroke({ color: 0x658b67, width: 2 });
    g.ellipse(-7, -10, 7, 4).fill({ color: 0xdeefd2, alpha: 0.7 });
    g.circle(-7, 1, 2).circle(7, 1, 2).fill(0x314b3b);
    g.moveTo(-2, 6)
      .quadraticCurveTo(0, 8, 3, 6)
      .stroke({ color: 0x476b4b, width: 1.5 });
    g.moveTo(0, -21)
      .quadraticCurveTo(-14, -38, -4, -39)
      .quadraticCurveTo(7, -31, 0, -21)
      .fill(0x4f8962);
    g.moveTo(0, -21)
      .quadraticCurveTo(4, -42, 14, -35)
      .quadraticCurveTo(16, -25, 0, -21)
      .fill(0xb6d69a);
  } else {
    g.ellipse(0, 0, 23, 17).fill(0x718c84);
    g.moveTo(17, 7)
      .quadraticCurveTo(42, 5, 31, -18)
      .quadraticCurveTo(24, -7, 15, -7)
      .fill(0xc0d2bc);
    g.moveTo(-20, -5)
      .lineTo(-22, -31)
      .lineTo(-8, -23)
      .lineTo(2, -27)
      .lineTo(13, -32)
      .lineTo(14, -8)
      .quadraticCurveTo(0, 13, -20, -5)
      .fill(0x91ada0)
      .stroke({ color: 0x5c7c70, width: 1.5 });
    g.moveTo(-13, -7).lineTo(-5, 1).lineTo(3, -8).fill(0xe4e9d5);
    g.circle(-12, -13, 2).circle(3, -14, 2).fill(0xe3c480);
    g.circle(-5, -2, 2).fill(0x354c42);
    g.moveTo(-13, 11)
      .lineTo(-15, 18)
      .moveTo(8, 11)
      .lineTo(10, 18)
      .stroke({ color: 0x4a695c, width: 5 });
  }
  body.addChild(g);
  return body;
}
function renderMap(root: Container) {
  const ground = new Graphics()
    .rect(0, 0, WORLD.width, WORLD.height)
    .fill(0xc6d4ab);
  root.addChild(ground);
  // Deterministic meadow texture and soft paths.
  for (let i = 0; i < 600; i++) {
    const x = (i * 137.51) % WORLD.width,
      y = (i * 89.31) % WORLD.height;
    ground
      .ellipse(x, y, 2 + (i % 4), 1 + (i % 3))
      .fill({ color: i % 3 ? 0x91ad80 : 0xe4e8ba, alpha: 0.4 });
  }
  ground
    .moveTo(1200, 100)
    .bezierCurveTo(1100, 400, 1320, 610, 1200, 880)
    .lineTo(1200, 1000)
    .bezierCurveTo(1170, 1200, 900, 1300, 900, 1800)
    .stroke({ color: 0xdce0b9, width: 150 });
  ground
    .moveTo(80, 650)
    .bezierCurveTo(700, 560, 1500, 800, 2350, 500)
    .stroke({ color: 0xdce0b9, width: 105 });
  ground
    .moveTo(0, 925)
    .bezierCurveTo(600, 810, 1800, 1050, 2400, 900)
    .stroke({ color: 0x7daea1, width: 130 });
  ground
    .moveTo(0, 915)
    .bezierCurveTo(600, 800, 1800, 1040, 2400, 890)
    .stroke({ color: 0xadd4bf, width: 100 });
  for (let i = 0; i < 55; i++)
    ground
      .ellipse(i * 47, 900 + Math.sin(i / 9) * 45, 11 + (i % 4) * 5, 1.5)
      .fill({ color: 0xeaf5d3, alpha: 0.5 });
  // Bridge is the only river crossing.
  ground.rect(1080, 850, 260, 160).fill(0x8d9b79);
  for (let y = 850; y < 1010; y += 16)
    ground.rect(1083, y, 254, 12).fill(0xc1bd97);
  ground
    .moveTo(1080, 850)
    .lineTo(1080, 1010)
    .moveTo(1340, 850)
    .lineTo(1340, 1010)
    .stroke({ color: 0x66816a, width: 7 });
  for (let y = 850; y <= 1010; y += 40)
    ground.circle(1080, y, 6).circle(1340, y, 6).fill(0xe4dcb1);
  const trees = [
    ...obstacles.map((o) => ({ x: o.x, y: o.y, s: o.radius / 45 })),
    ...Array.from({ length: 25 }, (_, i) => ({
      x: i < 13 ? 100 + (i % 6) * 410 : 80 + (i % 7) * 370,
      y: i < 13 ? 120 + (i % 3) * 95 : 1580 + (i % 3) * 60,
      s: 1 + (i % 3) * 0.2,
    })),
  ];
  trees.forEach((t, i) => {
    const c = new Container();
    c.position.set(t.x, t.y);
    c.zIndex = t.y;
    const g = new Graphics();
    g.ellipse(14, 19, 55 * t.s, 19 * t.s).fill({ color: 0x6c8e66, alpha: 0.2 });
    g.moveTo(-6, 0)
      .lineTo(-9, -65 * t.s)
      .lineTo(7, -65 * t.s)
      .lineTo(8, 0)
      .fill(0x7a8061);
    g.moveTo(0, -35 * t.s)
      .lineTo(-31 * t.s, -62 * t.s)
      .moveTo(1, -48 * t.s)
      .lineTo(34 * t.s, -80 * t.s)
      .stroke({ color: 0x7a8061, width: 7 });
    const pink = i % 4 === 0;
    const base = pink ? 0xd6b7ac : 0x658f75,
      light = pink ? 0xe8cec1 : 0x88a783;
    g.ellipse(-28 * t.s, -68 * t.s, 42 * t.s, 28 * t.s)
      .ellipse(29 * t.s, -79 * t.s, 46 * t.s, 30 * t.s)
      .ellipse(0, -105 * t.s, 42 * t.s, 30 * t.s)
      .fill(base);
    g.ellipse(-23 * t.s, -76 * t.s, 35 * t.s, 19 * t.s)
      .ellipse(27 * t.s, -87 * t.s, 37 * t.s, 21 * t.s)
      .ellipse(-5 * t.s, -112 * t.s, 33 * t.s, 22 * t.s)
      .fill(light);
    for (let j = 0; j < 10; j++)
      g.ellipse(
        (((j * 19) % 80) - 40) * t.s,
        (-65 - ((j * 11) % 50)) * t.s,
        5 * t.s,
        2 * t.s,
      ).fill({ color: 0xf0e6c6, alpha: 0.25 });
    c.addChild(g);
    entityLayer?.addChild(c);
  });
  // A quiet shrine at the northern end of the path.
  const shrine = new Graphics();
  shrine.ellipse(1200, 330, 120, 28).fill({ color: 0x84986f, alpha: 0.3 });
  shrine
    .rect(1115, 270, 170, 45)
    .fill(0xc0bea1)
    .rect(1125, 260, 150, 45)
    .fill(0xe5dfbf);
  shrine.rect(1140, 155, 10, 110).rect(1250, 155, 10, 110).fill(0x68816a);
  shrine
    .rect(1160, 175, 80, 90)
    .fill(0xeae2c4)
    .rect(1185, 200, 30, 65)
    .fill(0x6a8972);
  shrine
    .moveTo(1090, 158)
    .quadraticCurveTo(1150, 145, 1200, 104)
    .quadraticCurveTo(1250, 145, 1310, 158)
    .quadraticCurveTo(1255, 169, 1200, 155)
    .quadraticCurveTo(1145, 169, 1090, 158)
    .fill(0x496b59);
  shrine
    .moveTo(1125, 112)
    .quadraticCurveTo(1170, 100, 1200, 76)
    .quadraticCurveTo(1230, 100, 1275, 112)
    .quadraticCurveTo(1235, 122, 1200, 113)
    .quadraticCurveTo(1160, 122, 1125, 112)
    .fill(0x719177);
  shrine
    .moveTo(1200, 76)
    .lineTo(1200, 63)
    .stroke({ color: 0xd2c48d, width: 4 });
  root.addChild(shrine);
  const title = new Text({
    text: region.value.name,
    style: {
      fontFamily: "Georgia, serif",
      fontSize: 26,
      fill: "#6f8d67",
      letterSpacing: 5,
    },
  });
  regionLabel = title;
  title.anchor.set(0.5);
  title.position.set(1200, 395);
  root.addChild(title);
  const bridgeTitle = new Text({
    text: "Vân Khê Kiều",
    style: {
      fontFamily: "Georgia, serif",
      fontSize: 14,
      fill: "#607f6a",
      letterSpacing: 2,
    },
  });
  bridgeTitle.anchor.set(0.5);
  bridgeTitle.position.set(1210, 1040);
  root.addChild(bridgeTitle);
  // Lotus, lanterns and scattered stones.
  for (let i = 0; i < 18; i++) {
    const x = 200 + i * 115,
      y = 920 + Math.sin(i) * 25;
    if (x > 1040 && x < 1380) continue;
    ground
      .ellipse(x, y, 12, 6)
      .fill(0x7ca77b)
      .circle(x, y - 3, 4)
      .fill(i % 3 ? 0xd6c3ae : 0xf0e1c2);
  }
  for (const x of [1060, 1340]) {
    const lantern = new Graphics()
      .rect(x, 380, 5, 65)
      .fill(0x7e8e6b)
      .roundRect(x - 9, 370, 23, 27, 4)
      .fill(0xf1d9a0)
      .rect(x - 11, 367, 27, 5)
      .fill(0x5c7d62);
    root.addChild(lantern);
  }
}

onMounted(async () => {
  document.addEventListener("fullscreenchange", syncFullscreen);
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", resetInput);
  if (!host.value) return;
  const instance = new Application();
  app = instance;
  try {
    await instance.init({
      resizeTo: host.value,
      background: 0xc6d4ab,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(devicePixelRatio, 2),
      preference: "webgl",
    });
    if (disposed) {
      instance.destroy(true, { children: true });
      return;
    }
    host.value.appendChild(instance.canvas);
    instance.canvas.setAttribute(
      "aria-label",
      "Bản đồ Thanh Vân Cốc: nhân vật, quái và đường đi",
    );
    world = new Container();
    instance.stage.addChild(world);
    entityLayer = new Container();
    entityLayer.sortableChildren = true;
    renderMap(world);
    terrain = world.children[0];
    biome = new Graphics();
    world.addChild(biome);
    world.addChild(entityLayer);
    selection = new Graphics()
      .ellipse(0, 10, 32, 16)
      .stroke({ color: 0xe9c77e, width: 2 });
    entityLayer.addChild(selection);
    mobs = monsterSeeds.map((seed) => {
      const view = new Container();
      view.position.set(seed.x, seed.y);
      const body = buildMob(seed.kind);
      view.addChild(body);
      const label = new Text({
        text: seed.name,
        style: {
          fontFamily: "system-ui",
          fontSize: 12,
          fill: "#f8f5da",
          stroke: { color: "#4b6a4f", width: 3 },
        },
      });
      label.anchor.set(0.5);
      label.position.set(0, -54);
      view.addChild(label);
      const bar = new Graphics();
      bar.y = -45;
      view.addChild(bar);
      entityLayer!.addChild(view);
      return {
        ...seed,
        hp: seed.maxHp,
        spawn: { x: seed.x, y: seed.y },
        view,
        bar,
        body,
        respawn: 0,
        hitCooldown: 0,
      };
    });
    hero = createHero();
    hero.pose(2, false, 0, false);
    actor = hero.root;
    actor.position.set(position.value.x, position.value.y);
    entityLayer.addChild(actor);
    const name = new Text({
      text: props.name,
      style: {
        fontFamily: "system-ui",
        fontSize: 13,
        fill: "#fff9d4",
        stroke: { color: "#426447", width: 3 },
      },
    });
    name.anchor.set(0.5);
    name.y = -63;
    actor.addChild(name);
    playerHp = new Graphics();
    playerHp.y = -53;
    actor.addChild(playerHp);
    sword = new Graphics()
      .moveTo(20, -45)
      .quadraticCurveTo(110, -10, 80, 40)
      .quadraticCurveTo(68, -2, 20, -45)
      .fill({ color: 0xfaf3cf, alpha: 0.85 });
    sword.alpha = 0;
    actor.addChild(sword);
    portal = new Container();
    portal.position.set(1200, 450);
    portal.addChild(
      new Graphics()
        .ellipse(0, 8, 52, 20)
        .stroke({ color: 0xf5d994, width: 3 })
        .ellipse(0, -20, 28, 53)
        .stroke({ color: 0xb9f2d8, width: 5 })
        .ellipse(0, -20, 22, 46)
        .fill({ color: 0x539c88, alpha: 0.28 }),
    );
    const portalText = new Text({
      text: "TRUYỀN TỐNG · E",
      style: {
        fontFamily: "system-ui",
        fontSize: 11,
        fill: "#fff4cb",
        stroke: { color: "#375d47", width: 3 },
      },
    });
    portalText.anchor.set(0.5);
    portalText.y = -85;
    portal.addChild(portalText);
    entityLayer.addChild(portal);
    portal.zIndex = 450;
    effects = new Container();
    world.addChild(effects);
    combatEffects = createEffects(effects);
    const resize = () => {
      if (!host.value || !world) return;
      const { width, height } = host.value.getBoundingClientRect();
      instance.renderer.resize(width, height);
      world.scale.set(width < 700 ? 0.93 : 1.05);
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host.value);
    resize();
    ready.value = true;
    instance.ticker.add((ticker) =>
      update(Math.min(ticker.deltaMS / 1000, 0.05)),
    );
  } catch (error) {
    failure.value = true;
    console.error("Không thể khởi tạo bản đồ PixiJS:", error);
    if (instance.renderer) instance.destroy(true, { children: true });
    app = undefined;
  }
});
function travel(offset: number) {
  if (!nearPortal.value || deadFor.value || panel.value || chatOpen.value)
    return;
  const next = regionIndex.value + offset;
  if (!canEnterRegion(next, exp.value)) {
    notify(
      next >= regions.length
        ? "Đã đến vùng cuối bản trải nghiệm."
        : `Cần cấp ${regions[next]?.minimumLevel} để vào ${regions[next]?.name}.`,
    );
    return;
  }
  resetInput();
  regionIndex.value = next;
  target.value = null;
  position.value = { x: 1200, y: 600 };
  combatEffects?.clear();
  if (terrain) terrain.tint = region.value.tint;
  if (regionLabel) regionLabel.text = region.value.name;
  biome?.clear();
  if (biome && next > 0)
    for (let i = 0; i < 32; i++) {
      const x = 240 + ((i * 317) % 1930),
        y = 250 + ((i * 193) % 1280);
      if (!canWalk({ x, y }) || Math.abs(x - 1200) < 160) continue;
      if (next === 1) {
        biome
          .moveTo(x, y)
          .lineTo(x - 4, y - 90)
          .moveTo(x + 13, y)
          .lineTo(x + 17, y - 110)
          .stroke({ color: 0x4e8267, width: 5 });
        for (let j = 0; j < 4; j++)
          biome
            .moveTo(x, y - j * 20)
            .quadraticCurveTo(x - 25, y - j * 20 - 25, x - 40, y - j * 20 - 12)
            .moveTo(x + 15, y - j * 22)
            .quadraticCurveTo(x + 42, y - j * 22 - 20, x + 48, y - j * 22 - 8)
            .stroke({ color: 0x759c77, width: 3 });
      } else {
        biome
          .moveTo(x - 14, y)
          .lineTo(x - 5, y - 45)
          .lineTo(x + 8, y - 66)
          .lineTo(x + 20, y - 8)
          .lineTo(x + 8, y + 7)
          .closePath()
          .fill({ color: 0x899aba, alpha: 0.75 })
          .stroke({ color: 0xd6e5ee, width: 2 });
        biome.circle(x + 30, y - 30, 3).fill({ color: 0xffefd1, alpha: 0.7 });
      }
    }
  mobs.forEach((mob, i) => {
    const seed = monsterSeeds[i]!;
    mob.name = region.value.monsterPrefix + seed.name;
    mob.maxHp = Math.round(seed.maxHp * region.value.multiplier);
    mob.hp = mob.maxHp;
    mob.exp = Math.round(seed.exp * region.value.multiplier);
    mob.x = seed.x;
    mob.y = seed.y;
    mob.respawn = 0;
    mob.hitCooldown = 0;
    mob.view.visible = true;
    (mob.view.children[1] as Text).text = mob.name;
    mob.body.tint = region.value.tint;
  });
  notify(
    `Đã đến ${region.value.name} · Yêu thú cấp ${region.value.minimumLevel}`,
  );
  addJournal(`Qua cổng đến ${region.value.name}.`);
}
function keyup(event: KeyboardEvent) {
  keys.delete(event.key.toLowerCase());
}
function moveMob(mob: Mob, toward: Point, speed: number, dt: number) {
  const d = distance(mob, toward);
  if (!d) return;
  const x = mob.x + ((toward.x - mob.x) / d) * speed * dt;
  const y = mob.y + ((toward.y - mob.y) / d) * speed * dt;
  if (canWalk({ x, y: mob.y })) mob.x = x;
  if (canWalk({ x: mob.x, y })) mob.y = y;
}
function syncFullscreen() {
  fullScreen.value = !!document.fullscreenElement;
}

function update(dt: number) {
  if (!app || !world || !actor || !playerHp) return;
  elapsed += dt;
  combatEffects?.update(dt);
  if (portal)
    portal.alpha = reducedMotion ? 1 : 0.8 + Math.sin(elapsed * 2) * 0.2;
  if (elapsed - lastMapUpdate > 0.25) {
    minimapMobs.value = mobs
      .filter((m) => m.hp > 0)
      .map((m) => ({ id: m.id, x: m.x, y: m.y }));
    lastMapUpdate = elapsed;
  }
  skillCooldown.value = Math.max(0, skillCooldown.value - dt);
  attackCooldown.value = Math.max(0, attackCooldown.value - dt);
  if (sword) sword.alpha = Math.max(0, sword.alpha - dt * 4);
  if (deadFor.value > 0) {
    deadFor.value = Math.max(0, deadFor.value - dt);
    if (deadFor.value === 0) {
      hp.value = 360;
      position.value = { x: 1200, y: 440 };
      notify("Đã hồi sinh tại Thanh Vân Đình.");
    }
  }
  const dx =
    (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
    (keys.has("a") || keys.has("arrowleft") ? 1 : 0) +
    joystick.value.x;
  const dy =
    (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
    (keys.has("w") || keys.has("arrowup") ? 1 : 0) +
    joystick.value.y;
  const moving =
    (Math.abs(dx) > 0.08 || Math.abs(dy) > 0.08) &&
    !deadFor.value &&
    !panel.value &&
    !chatOpen.value;
  if (moving) {
    position.value = movePlayer(position.value, { x: dx, y: dy }, dt);
    if (dx) facing = dx > 0 ? 1 : -1;
    direction = facingDirection(dx, dy);
  }
  actor.position.set(
    position.value.x,
    position.value.y +
      (reducedMotion
        ? 0
        : moving
          ? Math.sin(elapsed * 15) * 1.5
          : Math.sin(elapsed * 2) * 0.5),
  );
  hero?.pose(direction, !!moving, elapsed, attackCooldown.value > 0.35);
  actor.zIndex = position.value.y;
  actor.alpha = deadFor.value ? 0.35 : 1;
  playerHp
    .clear()
    .roundRect(-22, 0, 44, 4, 2)
    .fill(0x49664d)
    .roundRect(-22, 0, (44 * hp.value) / 360, 4, 2)
    .fill(0xc2db9d);
  for (const mob of mobs) {
    if (mob.hp <= 0) {
      mob.respawn -= dt;
      if (mob.respawn <= 0) {
        mob.hp = mob.maxHp;
        mob.x = mob.spawn.x;
        mob.y = mob.spawn.y;
        mob.view.visible = true;
      }
      continue;
    }
    mob.hitCooldown = Math.max(0, mob.hitCooldown - dt);
    mob.body.tint = region.value.tint;
    const d = distance(position.value, mob);
    if (!deadFor.value && !panel.value && !chatOpen.value) {
      const aggro = mob.kind === "wolf" ? 260 : 170;
      if (d < aggro && d > 46) {
        const speed = mob.kind === "wolf" ? 95 : 65;
        moveMob(mob, position.value, speed, dt);
      } else if (d > 400 && distance(mob, mob.spawn) > 10) {
        moveMob(mob, mob.spawn, 50, dt);
      }
      if (d < 60 && mob.hitCooldown === 0) {
        const damage = Math.round(
          (mob.kind === "wolf" ? 22 : 12) * region.value.multiplier,
        );
        hp.value = Math.max(0, hp.value - damage);
        mob.hitCooldown = 1.3;
        float(`−${damage}`, position.value.x, position.value.y, "#f5b2a0");
        if (hp.value === 0) {
          deadFor.value = 4;
          resetInput();
          target.value = null;
          addJournal("Kiệt sức. Hồi sinh tại Thanh Vân Đình sau 4 giây.");
        }
      }
    }
    mob.view.position.set(
      mob.x,
      mob.y + (reducedMotion ? 0 : Math.sin(elapsed * 3 + mob.id) * 2),
    );
    mob.view.zIndex = mob.y;
    mob.bar
      .clear()
      .roundRect(-22, 0, 44, 4, 2)
      .fill(0x54705a)
      .roundRect(-22, 0, (44 * mob.hp) / mob.maxHp, 4, 2)
      .fill(0xd9bd85);
    if (target.value?.id === mob.id) target.value.hp = mob.hp;
  }
  const nearest = chooseTarget();
  if (selection) {
    selection.visible = !!nearest && distance(position.value, nearest) < 260;
    if (nearest) selection.position.set(nearest.x, nearest.y);
    selection.zIndex = 0;
  }
  for (let i = floating.length - 1; i >= 0; i--) {
    const f = floating[i]!;
    f.life -= dt;
    f.node.y -= dt * 38;
    f.node.alpha = f.life;
    if (f.life <= 0) {
      f.node.destroy();
      floating.splice(i, 1);
    }
  }
  const scale = world.scale.x;
  const cameraX = Math.min(
    0,
    Math.max(
      app.screen.width - WORLD.width * scale,
      app.screen.width / 2 - position.value.x * scale,
    ),
  );
  const cameraY = Math.min(
    0,
    Math.max(
      app.screen.height - WORLD.height * scale,
      app.screen.height / 2 - position.value.y * scale,
    ),
  );
  world.position.set(cameraX, cameraY);
}
onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(timer);
  resizeObserver?.disconnect();
  document.removeEventListener("fullscreenchange", syncFullscreen);
  window.removeEventListener("keydown", keydown);
  window.removeEventListener("keyup", keyup);
  window.removeEventListener("blur", resetInput);
  if (app?.renderer) app.destroy(true, { children: true });
});
</script>

<template>
  <main class="game-shell">
    <div
      ref="host"
      class="game-canvas"
      data-testid="game-map"
      :data-player-x="Math.round(position.x)"
      :data-player-y="Math.round(position.y)"
    ></div>
    <div v-if="!ready && !failure" class="game-loading">
      <span>仙</span>Đang mở lối vào Thanh Vân Cốc…
    </div>
    <div v-if="failure" class="game-loading">
      <span>☁︎</span>
      <h1>Chưa thể mở tiên cảnh</h1>
      <p>
        Trình duyệt cần hỗ trợ WebGL để chơi. Hãy thử tải lại hoặc bật tăng tốc
        đồ họa.
      </p>
      <button class="primary-button" @click="emit('logout')">
        Trở về đăng nhập
      </button>
    </div>

    <header class="player-hud">
      <button
        class="portrait"
        aria-label="Mở túi nhân vật"
        @click="openPanel('inventory')"
      >
        <img
          v-if="profile && art(`avatar-${profile.avatar}.webp`)"
          :src="art(`avatar-${profile.avatar}.webp`)"
          alt="Avatar nhân vật"
          class="game-avatar-image"
        /><span v-else>{{
          ["清", "月", "云", "岚", "竹", "霜"][(profile?.avatar || 1) - 1]
        }}</span
        ><b>{{ level }}</b>
      </button>
      <div class="player-bars">
        <div class="player-name">
          {{ name }}
          <button aria-label="Xem cảnh giới" @click="openPanel('realms')">
            Luyện Khí · Tầng {{ Math.min(10, level) }} ▾
          </button>
        </div>
        <div
          class="health-bar"
          role="progressbar"
          aria-label="Sinh lực"
          :aria-valuenow="hp"
          :aria-valuemin="0"
          :aria-valuemax="360"
        >
          <i :style="{ width: (hp / 360) * 100 + '%' }"></i
          ><span>{{ hp }} / 360</span>
        </div>
        <div class="mana-bar"><i></i><span>Linh lực dồi dào</span></div>
      </div>
    </header>
    <section v-if="target" class="target-hud" aria-label="Quái đang chọn">
      <div>
        {{ target.name }} <span>Yêu thú · Lv. {{ region.minimumLevel }}</span>
      </div>
      <div class="target-bar">
        <i :style="{ width: (target.hp / target.maxHp) * 100 + '%' }"></i>
      </div>
      <small>{{ target.hp }} / {{ target.maxHp }}</small>
    </section>

    <button
      class="game-currencies"
      aria-label="Xem toàn bộ tiền tệ"
      @click="openPanel('currencies')"
    >
      <span><small>Linh Thạch</small>◈ {{ coins.toLocaleString("vi-VN") }}</span
      ><span><small>Tiên Ngọc</small>◇ 60</span
      ><span><small>Công Đức</small>✧ 100</span>
    </button>
    <aside class="map-hud">
      <div class="map-name">
        <span>⌖</span>
        <h1>{{ region.name }}</h1>
        <button aria-label="Bật toàn màn hình" @click="fullscreen">
          {{ fullScreen ? "⊡" : "⛶" }}
        </button>
      </div>
      <div class="minimap" aria-label="Bản đồ nhỏ">
        <div class="mini-river"></div>
        <div class="mini-path"></div>
        <span
          v-for="mob in minimapMobs"
          :key="mob.id"
          class="mini-mob"
          :style="{
            left: (mob.x / WORLD.width) * 100 + '%',
            top: (mob.y / WORLD.height) * 100 + '%',
          }"
        ></span
        ><span
          class="mini-player"
          :style="{
            left: (position.x / WORLD.width) * 100 + '%',
            top: (position.y / WORLD.height) * 100 + '%',
          }"
        ></span
        ><span class="mini-shrine">⌂</span>
      </div>
      <p>
        {{ Math.round(position.x) }}, {{ Math.round(position.y) }}
        <span>{{ region.mapName }}</span>
      </p>
    </aside>

    <aside class="quest-hud">
      <div class="quest-heading">
        <span>▤</span> Tiên vụ <small>ĐANG THEO DÕI</small>
      </div>
      <h2>Thanh trừ yêu khí</h2>
      <p>
        Hạ yêu thú trong {{ region.name }} <b>{{ Math.min(kills, 3) }}/3</b>
      </p>
      <div class="quest-reward">
        ◈ 150 linh thạch <span>·</span> 2 Hồi Linh Đan
      </div>
      <button v-if="kills >= 3" :disabled="questClaimed" @click="claimQuest">
        {{ questClaimed ? "Đã nhận thưởng ✓" : "Nhận thưởng →" }}
      </button>
      <div v-else class="quest-hint">Theo lối mòn, tìm Mộc Linh gần đình.</div>
    </aside>

    <section
      v-if="nearPortal"
      class="portal-panel"
      aria-label="Cổng chuyển map"
    >
      <strong>Truyền Tống Trận</strong>
      <p>Cấp hiện tại: {{ level }} · Mở vùng bằng tu vi chiến đấu</p>
      <button v-if="regionIndex > 0" @click="travel(-1)">
        ← {{ regions[regionIndex - 1]?.name }}</button
      ><button v-if="regionIndex < regions.length - 1" @click="travel(1)">
        {{ regions[regionIndex + 1]?.name }} · Cấp
        {{ regions[regionIndex + 1]?.minimumLevel }} →</button
      ><small v-else>Đã khám phá vùng cuối bản mẫu.</small>
    </section>
    <div class="region-route">
      <span
        v-for="(r, index) in regions"
        :key="r.name"
        :class="{
          current: index === regionIndex,
          locked: !canEnterRegion(index, exp),
        }"
        >{{
          index === regionIndex ? "◈" : canEnterRegion(index, exp) ? "◇" : "♙"
        }}
        {{ r.mapName }} <small>Lv.{{ r.minimumLevel }}</small></span
      >
    </div>
    <div class="world-label"><span>✦</span> TỌA VỰC <i>·</i> BẢN CHƠI MẪU</div>
    <nav class="game-menu" aria-label="Tiện ích trò chơi">
      <button aria-label="Mở túi đồ" @click="openPanel('inventory')">
        <span>▣</span><small>Túi đồ <kbd>I</kbd></small></button
      ><button aria-label="Mở nhật ký" @click="openPanel('journal')">
        <span>▤</span><small>Nhật ký</small></button
      ><button aria-label="Hướng dẫn điều khiển" @click="openPanel('help')">
        <span>?</span><small>Hướng dẫn</small></button
      ><button aria-label="Đăng xuất" @click="emit('logout')">
        <span>⤴</span><small>Rời giới</small>
      </button>
    </nav>

    <section class="game-chat" aria-label="Tin nhắn mẫu">
      <div class="chat-tabs">
        <b>Lân cận</b><span>Dữ liệu mẫu · Không gửi lên server</span
        ><button
          aria-label="Mở chat mẫu"
          @click="
            chatOpen = !chatOpen;
            resetInput();
          "
        >
          ✎
        </button>
      </div>
      <p v-for="(line, index) in chat.slice(-2)" :key="index">{{ line }}</p>
      <form v-if="chatOpen" @submit.prevent="sendChat">
        <input
          v-model="chatInput"
          aria-label="Nội dung chat mẫu"
          placeholder="Nói gì đó với tiên cảnh…"
          maxlength="120"
        /><button type="submit">Gửi</button>
      </form>
    </section>

    <div class="desktop-controls">
      Di chuyển <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd
      ><span>·</span> Đánh <kbd>J</kbd> / <kbd>Space</kbd><span>·</span> Kiếm
      khí <kbd>Q</kbd>
    </div>
    <div
      class="joystick"
      aria-label="Joystick di chuyển"
      role="group"
      @pointerdown.prevent="stick"
      @pointermove.prevent="stickMove"
      @pointerup="resetInput"
      @pointercancel="resetInput"
      @lostpointercapture="resetInput"
    >
      <span class="stick-arrow north">⌃</span
      ><span class="stick-arrow south">⌄</span
      ><span class="stick-arrow west">‹</span
      ><span class="stick-arrow east">›</span>
      <div
        class="stick-knob"
        :style="{ transform: `translate(${held})` }"
      ></div>
    </div>
    <div class="combat-controls">
      <button
        class="potion-action"
        :disabled="!potions || !!deadFor"
        aria-label="Dùng Hồi Linh Đan"
        @click="heal"
      >
        <span>♜</span><b>{{ potions }}</b
        ><small>Hồi máu <kbd>1</kbd></small></button
      ><button
        class="skill-action"
        :disabled="skillCooldown > 0 || !!deadFor"
        aria-label="Thi triển Kiếm Khí"
        @click="attack(true)"
      >
        <span>✧</span
        ><b v-if="skillCooldown > 0">{{ Math.ceil(skillCooldown) }}</b
        ><small>Kiếm khí <kbd>Q</kbd></small></button
      ><button
        class="attack-action"
        :disabled="attackCooldown > 0 || !!deadFor"
        aria-label="Đánh thường"
        @click="attack()"
      >
        <span>⚔︎</span><small>Tấn công <kbd>J</kbd></small>
      </button>
    </div>
    <div
      class="experience-hud"
      role="progressbar"
      aria-label="Tu vi chiến đấu"
      :aria-valuenow="exp"
      :aria-valuemin="0"
      :aria-valuemax="level * 120"
    >
      <i
        :style="{ width: Math.min(100, (exp / (level * 120)) * 100) + '%' }"
      ></i
      ><span
        >Tu vi {{ exp }} / {{ level * 120 }}
        <b>◈ {{ coins.toLocaleString("vi-VN") }}</b></span
      >
    </div>
    <Transition name="toast"
      ><div v-if="notice" class="game-notice" role="status">
        ✧ {{ notice }}
      </div></Transition
    >
    <div v-if="deadFor > 0" class="death-overlay">
      <span>魂</span>
      <h2>Thắng bại là chuyện thường tình</h2>
      <p>Hồi sinh tại Thanh Vân Đình sau {{ Math.ceil(deadFor) }} giây…</p>
    </div>
    <ModalDialog v-if="panel" :title="panelTitle" @close="panel = null"
      ><template v-if="panel === 'currencies'"
        ><div class="currency-list">
          <div>
            <span>Linh Thạch</span><b>{{ coins.toLocaleString("vi-VN") }}</b>
          </div>
          <div><span>Tiên Ngọc</span><b>60</b></div>
          <div><span>Công Đức</span><b>100</b></div>
        </div>
        <p>Tiền tệ mẫu trong phiên hiện tại.</p></template
      ><template v-else-if="panel === 'realms'"
        ><div class="realm-list">
          <span
            v-for="(r, i) in realms"
            :key="r"
            :class="{ current: i === 0 }"
            >{{ r }}</span
          >
        </div>
        <p>
          Luyện Khí · Tầng {{ Math.min(10, level) }}. Mỗi cảnh giới có 10 tiểu
          cảnh. Đột phá cảnh giới thật chưa được tích hợp.
        </p></template
      ><template v-else-if="panel === 'inventory'"
        ><div class="inventory-summary">
          <span>◈ {{ coins.toLocaleString("vi-VN") }} linh thạch</span
          ><span>Tu vi: {{ exp }}</span>
        </div>
        <div class="inventory-item">
          <span>⚔︎</span>
          <div>
            <strong>Thanh Vân Kiếm</strong
            ><small>Đang trang bị · Sát thương 24</small>
          </div>
          <b>Phàm phẩm</b>
        </div>
        <div class="inventory-item">
          <span>♜</span>
          <div>
            <strong>Hồi Linh Đan × {{ potions }}</strong
            ><small>Hồi 140 sinh lực</small>
          </div>
          <button :disabled="!potions || hp === 360" @click="heal">Dùng</button>
        </div>
        <div class="inventory-item">
          <span>♧</span>
          <div>
            <strong>Linh thảo × {{ herbs }}</strong
            ><small>Thu được khi đánh bại yêu thú</small>
          </div>
        </div>
        <p class="inventory-note">
          Tiến trình mẫu trong phiên hiện tại. Đăng xuất hoặc tải lại sẽ đặt
          lại.
        </p></template
      >
      <ul v-else-if="panel === 'journal'">
        <li v-for="(line, index) in journal" :key="index">{{ line }}</li>
      </ul>
      <template v-else
        ><p>
          <strong>PC:</strong> WASD hoặc phím mũi tên để di chuyển. J/Space đánh
          thường, Q thi triển Kiếm Khí, phím 1 hồi máu, I mở túi đồ.
        </p>
        <p>
          <strong>Mobile:</strong> kéo joystick trái để di chuyển, dùng các nút
          chiến đấu bên phải. Camera tự theo nhân vật.
        </p>
        <p>
          Đến gần quái để tấn công. Mộc Linh hiền hơn Thanh Lang. Qua cầu để
          khám phá phía nam; cây và dòng suối chắn đường.
        </p>
        <p>
          Hạ 3 yêu thú để nhận tiên vụ. Quái hồi sinh sau 8 giây; nhân vật hồi
          sinh sau 4 giây nếu hết máu.
        </p>
        <p>
          Gameplay và chat dùng dữ liệu mẫu, chưa kết nối backend. Không mất vật
          phẩm khi bị hạ trong bản mẫu.
        </p></template
      ></ModalDialog
    >
  </main>
</template>
