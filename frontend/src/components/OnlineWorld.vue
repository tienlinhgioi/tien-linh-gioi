<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { Container, Graphics, Text } from "pixi.js";
import type { Application } from "pixi.js";
import { gameClient } from "../network/client";
import type { ChatMessage } from "../network/types";
import {
  createGameApplication,
  destroyGameApplication,
} from "../game/renderer";
import { createHero } from "../game/character";
import { createEffects } from "../game/effects";
import { facingDirection } from "../data/game";
import OnlinePanels from "./OnlinePanels.vue";
import type { CharacterProfile } from "../data/sects";
import { art } from "../data/art";
import "../online-world.css";
const props = defineProps<{ profile: CharacterProfile }>();
const emit = defineEmits<{ logout: [] }>();
const state = gameClient.state;
const host = ref<HTMLDivElement>();
const ready = ref(false),
  failure = ref(""),
  notice = ref(""),
  panel = ref(""),
  mode = ref("");
const skillCode = ref("kiem_khi");
const casting = ref(false);
const basicReady = ref(0),
  skillReady = ref<Record<string, number>>({}),
  clock = ref(Date.now());
const chatText = ref(""),
  chatChannel = ref<"map" | "world" | "guild" | "whisper">("map"),
  whisperTo = ref("");
const joystick = ref({ x: 0, y: 0 });
const keys = new Set<string>();
const mapName = computed(
  () =>
    state.staticData.maps.find((m) => m.id === state.world.mapId)?.name ||
    "Chưa chọn bản đồ",
);
const skills = computed(() =>
  state.skills.skills.filter((s) => s.learned && s.code !== "co_ban"),
);
const selectedReady = computed(() => skillReady.value[skillCode.value] || 0);
const selectedSkill = computed(() =>
  state.skills.skills.find((s) => s.code === skillCode.value),
);
const target = computed(
  () =>
    state.world.monsters
      .filter((m) => m.hp > 0)
      .sort(
        (a, b) =>
          Math.hypot(a.x - state.world.x, a.y - state.world.y) -
          Math.hypot(b.x - state.world.x, b.y - state.world.y),
      )[0],
);
const activeInvites = computed(
  () => state.invitations.filter((i) => i.expiresAt > clock.value).length,
);
let app: Application | undefined,
  world: Container | undefined,
  hero: ReturnType<typeof createHero> | undefined,
  fx: ReturnType<typeof createEffects> | undefined;
let disposed = false,
  lastSend = 0,
  direction = 2,
  animationTime = 0,
  notificationTimer: ReturnType<typeof setTimeout> | undefined;
const entities = new Map<
  string,
  { node: Container; graphic: Graphics; label: Text; bar: Graphics }
>();
const flashes: { node: Text; life: number }[] = [];
const unsubscribers = [
  gameClient.on("monster:hit", (hit) => {
    if (hit.by === state.character?.id) return;
    const mob = state.world.monsters.find((m) => m.id === hit.id);
    const player = state.world.players.find((p) => p.characterId === hit.by);
    if (mob) {
      fx?.cast(player || mob, mob, hit.skill !== "co_ban");
      textFloat(`−${hit.damage}`, mob.x, mob.y);
    }
  }),
  gameClient.on("monster:attack", (hit) => {
    const pos =
      hit.targetCharacterId === state.character?.id
        ? state.world
        : state.world.players.find(
            (p) => p.characterId === hit.targetCharacterId,
          );
    if (pos) textFloat(`−${hit.damage}`, pos.x, pos.y);
  }),
  gameClient.on("player:loot", (loot) => {
    notify(
      `Nhận ${loot.exp} tu vi · ${loot.items.map((i) => i.name).join(", ") || "linh thạch"}`,
    );
  }),
];
const timer = setInterval(() => (clock.value = Date.now()), 100);
function notify(text: string) {
  notice.value = text;
  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(() => (notice.value = ""), 4500);
}
function reset() {
  keys.clear();
  joystick.value = { x: 0, y: 0 };
}
function open(tab: string) {
  reset();
  panel.value = tab;
}
function textFloat(text: string, x: number, y: number) {
  if (!world) return;
  const node = new Text({
    text,
    style: {
      fontFamily: "serif",
      fontSize: 20,
      fill: "#fff0c9",
      stroke: { color: "#315441", width: 3 },
    },
  });
  node.anchor.set(0.5);
  node.zIndex = 10001;
  node.position.set(x, y - 55);
  world.addChild(node);
  flashes.push({ node, life: 1 });
}
async function cast(code: string) {
  if (casting.value || !gameClient.canPlay || panel.value || !target.value)
    return;
  if (
    code === "co_ban"
      ? basicReady.value > clock.value
      : (skillReady.value[code] || 0) > clock.value
  )
    return;
  const mob = target.value;
  const skill = state.skills.skills.find((s) => s.code === code);
  if (!skill?.learned) {
    notify("Chưa học kỹ năng này. Mở Công pháp để xem điều kiện.");
    return;
  }
  casting.value = true;
  try {
    const from = { x: state.world.x, y: state.world.y };
    const to = { x: mob.x, y: mob.y };
    const result = await gameClient.cast(mob.id, code);
    direction = facingDirection(to.x - from.x, to.y - from.y);
    fx?.cast(from, to, code !== "co_ban");
    textFloat(`−${result.damage}`, to.x, to.y);
    const until = Date.now() + skill.cooldownMs;
    if (code === "co_ban") basicReady.value = until;
    else skillReady.value[code] = until;
  } catch (e) {
    notify(e instanceof Error ? e.message : "Không thể xuất chiêu.");
  } finally {
    casting.value = false;
  }
}
async function heal() {
  const potion = state.inventory.find((i) => i.healHp > 0 && i.count > 0);
  if (!potion) {
    notify("Chưa có linh dược trong túi.");
    return;
  }
  try {
    await gameClient.command("inventory:use", { code: potion.code });
    notify(`Đã dùng ${potion.name}.`);
  } catch (e) {
    notify(String(e instanceof Error ? e.message : e));
  }
}
async function sendChat() {
  const text = chatText.value.trim();
  if (!text) return;
  try {
    if (chatChannel.value === "whisper")
      await gameClient.command("chat:whisper", {
        to: whisperTo.value.trim(),
        text,
      });
    else
      await gameClient.command("chat:send", {
        channel: chatChannel.value,
        text,
      });
    chatText.value = "";
  } catch (e) {
    notify(String(e instanceof Error ? e.message : e));
  }
}
function keydown(e: KeyboardEvent) {
  if (
    (e.target as HTMLElement)?.closest(
      "input,textarea,select,[contenteditable]",
    ) ||
    panel.value
  )
    return;
  const key = e.key.toLowerCase();
  if (key === " " && (e.target as HTMLElement)?.closest("button")) return;
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
    ].includes(key)
  )
    e.preventDefault();
  keys.add(key);
  if (e.repeat) return;
  if (key === "j" || key === " ") void cast("co_ban");
  if (key === "q") void cast(skillCode.value);
  if (key === "1") void heal();
  if (key === "i") open("inventory");
}
function keyup(e: KeyboardEvent) {
  keys.delete(e.key.toLowerCase());
}
function stick(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);
  const r = el.getBoundingClientRect(),
    x = (e.clientX - r.left - r.width / 2) / 35,
    y = (e.clientY - r.top - r.height / 2) / 35;
  const n = Math.max(1, Math.hypot(x, y));
  joystick.value = { x: x / n, y: y / n };
}
function stickMove(e: PointerEvent) {
  if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) stick(e);
}
watch(
  () => state.status,
  () => {
    reset();
  },
);
watch(
  () => state.world.mapId,
  () => {
    reset();
    basicReady.value = 0;
    skillReady.value = {};
  },
);
watch(
  () => state.notifications.at(-1)?.id,
  () => {
    const last = state.notifications.at(-1);
    if (last) notify(last.text);
  },
);
watch(
  () => state.skills.skills,
  () => {
    if (!selectedSkill.value?.learned && skills.value[0])
      skillCode.value = skills.value[0].code;
  },
);
function drawEntity(
  id: string,
  name: string,
  x: number,
  y: number,
  hp: number,
  maxHp: number,
  kind: "player" | "monster" | "npc",
  type = "",
) {
  if (!world) return;
  let entry = entities.get(id);
  if (!entry) {
    const node = new Container(),
      graphic = new Graphics(),
      label = new Text({
        text: name,
        style: {
          fontFamily: "system-ui",
          fontSize: 12,
          fill: "#fff5d8",
          stroke: { color: "#3c614d", width: 3 },
        },
      }),
      bar = new Graphics();
    label.anchor.set(0.5);
    label.y = -52;
    node.addChild(graphic, label, bar);
    world.addChild(node);
    entry = { node, graphic, label, bar };
    entities.set(id, entry);
    const g = graphic;
    g.ellipse(0, 13, 20, 7).fill({ color: 0x365b3e, alpha: 0.2 });
    if (kind === "player") {
      const other = createHero();
      other.pose(2, false, 0, false);
      node.addChildAt(other.root, 0);
    } else if (kind === "npc") {
      g.rect(-13, -30, 26, 42)
        .fill(0xb7ad85)
        .circle(0, -38, 10)
        .fill(0xe8d5b3)
        .moveTo(-18, -42)
        .lineTo(0, -56)
        .lineTo(18, -42)
        .closePath()
        .fill(0x557958);
    } else {
      g.ellipse(
        0,
        -5,
        type === "son_quai" ? 27 : 21,
        type === "son_quai" ? 25 : 19,
      )
        .fill(type === "son_quai" ? 0x8b9983 : 0x88b390)
        .stroke({ color: 0x5c8464, width: 2 });
      g.circle(-7, -9, 2).circle(7, -9, 2).fill(0x355447);
      g.moveTo(-13, -20)
        .lineTo(-18, -37)
        .lineTo(-3, -23)
        .moveTo(5, -23)
        .lineTo(18, -36)
        .lineTo(14, -19)
        .fill(0x75987c);
    }
  }
  entry.node.position.set(x, y);
  entry.node.zIndex = y;
  entry.label.text = name;
  entry.bar.clear();
  if (maxHp > 0)
    entry.bar
      .rect(-22, -43, 44, 4)
      .fill(0x46634a)
      .rect(-22, -43, (44 * Math.max(0, hp)) / maxHp, 4)
      .fill(0xc8bb87);
}
function render(dt: number) {
  if (!app || !world || !hero) return;
  animationTime += dt;
  const inputFocused = !!document.activeElement?.matches(
    "input,textarea,select",
  );
  const dx =
    (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
    (keys.has("a") || keys.has("arrowleft") ? 1 : 0) +
    joystick.value.x;
  const dy =
    (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
    (keys.has("w") || keys.has("arrowup") ? 1 : 0) +
    joystick.value.y;
  const walking =
    !!(dx || dy) && gameClient.canPlay && !panel.value && !inputFocused;
  if (walking && Date.now() - lastSend >= 100) {
    const seconds = Math.min(0.15, (Date.now() - lastSend) / 1000);
    const length = Math.hypot(dx, dy);
    gameClient.move(
      Math.max(
        0,
        Math.min(2000, state.world.x + (dx / length) * 230 * seconds),
      ),
      Math.max(
        0,
        Math.min(2000, state.world.y + (dy / length) * 230 * seconds),
      ),
    );
    direction = facingDirection(dx, dy);
    lastSend = Date.now();
  } else if (!walking) lastSend = Date.now();
  hero.root.position.set(state.world.x, state.world.y);
  hero.root.zIndex = state.world.y;
  hero.root.alpha = state.world.dead ? 0.35 : 1;
  hero.pose(
    direction,
    walking,
    animationTime,
    Date.now() < basicReady.value - 650,
  );
  const active = new Set<string>();
  for (const m of state.world.monsters) {
    if (m.hp <= 0) continue;
    const key = `m${m.id}`;
    active.add(key);
    drawEntity(key, m.name, m.x, m.y, m.hp, m.maxHp, "monster", m.type);
  }
  for (const p of state.world.players) {
    const key = `p${p.characterId}`;
    active.add(key);
    drawEntity(key, p.name, p.x, p.y, 0, 0, "player");
  }
  for (const [i, npc] of state.world.npcs.entries()) {
    const key = `n${i}`;
    active.add(key);
    drawEntity(key, npc.name, npc.x, npc.y, 0, 0, "npc");
  }
  for (const [key, entry] of entities) {
    if (!active.has(key)) {
      entry.node.destroy({ children: true });
      entities.delete(key);
    }
  }
  fx?.update(dt);
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i]!;
    f.life -= dt;
    f.node.y -= dt * 35;
    f.node.alpha = f.life;
    if (f.life <= 0) {
      f.node.destroy();
      flashes.splice(i, 1);
    }
  }
  const scale = innerWidth < 700 ? 0.95 : 1.1;
  world.scale.set(scale);
  world.position.set(
    app.screen.width / 2 - state.world.x * scale,
    app.screen.height / 2 - state.world.y * scale,
  );
}
onMounted(async () => {
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", reset);
  try {
    if (!host.value) return;
    const result = await createGameApplication({
      resizeTo: host.value,
      background: 0xc6d4ab,
    });
    app = result.app;
    mode.value = result.mode;
    if (disposed) {
      destroyGameApplication(app);
      return;
    }
    host.value.appendChild(app.canvas);
    world = new Container();
    world.sortableChildren = true;
    app.stage.addChild(world);
    const ground = new Graphics().rect(-100, -100, 2200, 2200).fill(0xc8d7b2);
    for (let i = 0; i < 600; i++) {
      const x = (i * 137.5) % 2000,
        y = (i * 93.2) % 2000;
      ground
        .ellipse(x, y, 3, 1.5)
        .fill({ color: i % 3 ? 0x779b75 : 0xe8e6b9, alpha: 0.35 });
    }
    ground
      .moveTo(0, 50)
      .lineTo(2000, 50)
      .moveTo(50, 0)
      .lineTo(50, 2000)
      .stroke({ color: 0xdfdfb8, width: 85 });
    ground.rect(-20, -20, 2040, 2040).stroke({ color: 0x8ca987, width: 3 });
    world.addChild(ground);
    for (let i = 0; i < 20; i++) {
      const g = new Graphics(),
        x = 230 + ((i * 317) % 1680),
        y = 220 + ((i * 173) % 1660);
      g.ellipse(x, y + 14, 35, 12)
        .fill({ color: 0x658865, alpha: 0.2 })
        .rect(x - 4, y - 45, 8, 45)
        .fill(0x7c8565)
        .ellipse(x - 17, y - 55, 30, 20)
        .ellipse(x + 18, y - 64, 32, 24)
        .ellipse(x, y - 85, 30, 20)
        .fill(i % 4 ? 0x88a782 : 0xcebbac);
      g.zIndex = y;
      world.addChild(g);
    }
    hero = createHero();
    world.addChild(hero.root);
    const name = new Text({
      text: state.character?.name || props.profile.name,
      style: {
        fontFamily: "system-ui",
        fontSize: 13,
        fill: "#fff0cc",
        stroke: { color: "#3e624b", width: 3 },
      },
    });
    name.anchor.set(0.5);
    name.y = -63;
    hero.root.addChild(name);
    const effectsLayer = new Container();
    effectsLayer.zIndex = 10000;
    world.addChild(effectsLayer);
    fx = createEffects(effectsLayer);
    ready.value = true;
    app.ticker.add((t) => render(Math.min(t.deltaMS / 1000, 0.05)));
    if (!state.world.joined) open("maps");
  } catch (e) {
    failure.value =
      e instanceof Error ? e.message : "Không khởi tạo được màn chơi.";
    if (app) destroyGameApplication(app);
    app = undefined;
  }
});
onBeforeUnmount(() => {
  disposed = true;
  reset();
  unsubscribers.forEach((off) => off());
  clearInterval(timer);
  clearTimeout(notificationTimer);
  window.removeEventListener("keydown", keydown);
  window.removeEventListener("keyup", keyup);
  window.removeEventListener("blur", reset);
  if (app) destroyGameApplication(app);
});
const labelChat = (m: ChatMessage) =>
  `[${m.channel === "map" ? "Map" : m.channel === "world" ? "Thế giới" : m.channel === "guild" ? "Bang" : "Riêng"}] ${m.from}: ${m.text}`;
</script>
<template>
  <main class="game-shell online-world">
    <div
      ref="host"
      class="game-canvas"
      data-testid="online-map"
      :data-player-x="Math.round(state.world.x)"
      :data-player-y="Math.round(state.world.y)"
    ></div>
    <div v-if="failure" class="game-loading">
      <h1>Chưa mở được màn chơi</h1>
      <p>{{ failure }}</p>
      <button class="primary-button" @click="emit('logout')">
        Trở về đăng nhập
      </button>
    </div>
    <div v-else-if="!ready" class="game-loading">Đang mở tiên cảnh…</div>
    <header class="player-hud">
      <button
        class="portrait"
        aria-label="Mở túi nhân vật"
        @click="open('inventory')"
      >
        <img
          v-if="art(`avatar-${profile.avatar}.webp`)"
          :src="art(`avatar-${profile.avatar}.webp`)"
          class="game-avatar-image"
          alt="Avatar"
        /><span v-else>清</span><b>{{ state.character?.realm.order }}</b>
      </button>
      <div class="player-bars">
        <div class="player-name">
          {{ state.character?.name
          }}<button aria-label="Xem cảnh giới" @click="open('realms')">
            {{ state.character?.realm.name }} ·
            {{ state.character?.subRealm }} ▾
          </button>
        </div>
        <div
          class="health-bar"
          role="progressbar"
          aria-label="Sinh lực"
          :aria-valuenow="state.world.hp"
          :aria-valuemin="0"
          :aria-valuemax="state.world.maxHp"
        >
          <i
            :style="{
              width:
                (state.world.hp / Math.max(1, state.world.maxHp)) * 100 + '%',
            }"
          ></i
          ><span>{{ state.world.hp }}/{{ state.world.maxHp }}</span>
        </div>
        <div class="mana-bar"><i></i></div>
      </div>
    </header>
    <button
      class="game-currencies"
      aria-label="Xem toàn bộ tiền tệ"
      @click="open('currencies')"
    >
      <span v-for="c in state.character?.currencies" :key="c.code"
        ><small>{{ c.name }}</small
        >{{ c.amount.toLocaleString("vi-VN") }}</span
      >
    </button>
    <aside class="map-hud">
      <div class="map-name">
        <h1>{{ mapName }}</h1>
        <button aria-label="Chọn bản đồ" @click="open('maps')">⌘</button>
      </div>
      <div class="minimap">
        <span
          class="mini-player"
          :style="{
            left: state.world.x / 20 + '%',
            top: state.world.y / 20 + '%',
          }"
        ></span
        ><span
          v-for="m in state.world.monsters"
          :key="m.id"
          class="mini-mob"
          :style="{ left: m.x / 20 + '%', top: m.y / 20 + '%' }"
        ></span>
      </div>
      <p>{{ Math.round(state.world.x) }}, {{ Math.round(state.world.y) }}</p>
    </aside>
    <section v-if="target" class="target-hud">
      <div>{{ target.name }}<span>Yêu thú</span></div>
      <div class="target-bar">
        <i :style="{ width: (target.hp / target.maxHp) * 100 + '%' }"></i>
      </div>
      <small>{{ target.hp }}/{{ target.maxHp }}</small>
    </section>
    <nav class="online-menu" aria-label="Chức năng máy chủ">
      <button
        v-for="[tab, label] in [
          ['inventory', 'Túi đồ'],
          ['equipment', 'Trang bị'],
          ['skills', 'Công pháp'],
          ['shop', 'Cửa hàng'],
          ['guild', 'Bang hội'],
          ['social', 'Đạo hữu'],
          ['trade', 'Giao dịch'],
          ['maps', 'Thiên hạ'],
          ['journal', 'Nhật ký'],
        ]"
        :key="tab"
        @click="open(tab!)"
      >
        {{ label
        }}<b
          v-if="['social', 'guild', 'trade'].includes(tab!) && activeInvites"
          >{{ activeInvites }}</b
        ></button
      ><button aria-label="Đăng xuất" @click="emit('logout')">Rời giới</button>
    </nav>
    <section class="game-chat online-chat">
      <div class="chat-tabs">
        <select v-model="chatChannel" aria-label="Kênh chat">
          <option value="map">Map</option>
          <option value="world">Thế giới</option>
          <option value="guild">Bang</option>
          <option value="whisper">Riêng</option></select
        ><span>{{
          state.status === "connected" ? "Đã kết nối" : "Đang nối lại…"
        }}</span>
      </div>
      <p v-for="(m, i) in state.messages.slice(-3)" :key="i">
        {{ labelChat(m) }}
      </p>
      <form @submit.prevent="sendChat">
        <input
          v-if="chatChannel === 'whisper'"
          v-model="whisperTo"
          aria-label="Người nhận chat riêng"
          placeholder="Tên người nhận"
          maxlength="20"
        /><input
          v-model="chatText"
          aria-label="Nội dung chat"
          maxlength="200"
          placeholder="Gửi lời đến đạo hữu…"
        /><button :disabled="!gameClient.connected">Gửi</button>
      </form>
    </section>
    <div class="desktop-controls">
      WASD / ↑↓←→ · J Đánh · Q Kỹ năng · 1 Linh dược · I Túi đồ
    </div>
    <div
      class="joystick"
      aria-label="Joystick di chuyển"
      role="group"
      @pointerdown.prevent="stick"
      @pointermove.prevent="stickMove"
      @pointerup="reset"
      @pointercancel="reset"
      @lostpointercapture="reset"
    >
      <div
        class="stick-knob"
        :style="{
          transform: `translate(${joystick.x * 24}px,${joystick.y * 24}px)`,
        }"
      ></div>
    </div>
    <div class="combat-controls">
      <button
        class="potion-action"
        aria-label="Dùng linh dược"
        :disabled="!gameClient.canPlay"
        @click="heal"
      >
        <span>♜</span><small>Linh dược</small></button
      ><button
        class="skill-action"
        aria-label="Thi triển kỹ năng"
        :disabled="
          !gameClient.canPlay ||
          !selectedSkill?.learned ||
          casting ||
          selectedReady > clock
        "
        @click="cast(skillCode)"
      >
        <span>✧</span
        ><b v-if="selectedReady > clock">{{
          Math.ceil((selectedReady - clock) / 1000)
        }}</b
        ><small>{{ selectedSkill?.name || "Chưa học" }}</small></button
      ><button
        class="attack-action"
        aria-label="Đánh thường"
        :disabled="!gameClient.canPlay || casting || basicReady > clock"
        @click="cast('co_ban')"
      >
        <span>⚔︎</span><small>Tấn công</small>
      </button>
    </div>
    <div
      class="experience-hud"
      role="progressbar"
      aria-label="Tu vi chiến đấu"
      :aria-valuenow="state.character?.exp || 0"
      :aria-valuemax="state.character?.expNeeded || 1"
      :aria-valuemin="0"
    >
      <i
        :style="{
          width:
            Math.min(
              100,
              ((state.character?.exp || 0) /
                (state.character?.expNeeded || 1)) *
                100,
            ) + '%',
        }"
      ></i
      ><span
        >Tu vi {{ state.character?.exp }}/{{ state.character?.expNeeded }} ·
        {{ mode === "canvas" ? "Đồ họa Canvas" : "Trực tuyến" }}</span
      >
    </div>
    <div v-if="notice" class="game-notice" role="status">{{ notice }}</div>
    <div
      v-if="state.status !== 'connected'"
      class="online-disconnected"
      role="alert"
    >
      <strong>Mất kết nối máy chủ</strong>
      <p>{{ state.error || "Đang kết nối lại, các thao tác đã tạm dừng." }}</p>
      <button @click="emit('logout')">Trở về đăng nhập</button>
    </div>
    <div v-if="state.world.dead" class="death-overlay">
      <h2>Đang chờ hồi sinh</h2>
      <p>
        {{
          Math.max(
            0,
            Math.ceil(((state.world.respawnAt || clock) - clock) / 1000),
          )
        }}
        giây · trạng thái do máy chủ xác nhận
      </p>
    </div>
    <OnlinePanels
      v-if="panel"
      :initial-tab="panel"
      @close="panel = ''"
      @skill="
        skillCode = $event;
        panel = '';
      "
    />
  </main>
</template>
