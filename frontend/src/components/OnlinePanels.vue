<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import ModalDialog from "./ModalDialog.vue";
import { gameClient } from "../network/client";
import "../online-panels.css";
const props = withDefaults(defineProps<{ initialTab?: string }>(), {
  initialTab: "inventory",
});
const emit = defineEmits<{ close: []; skill: [code: string] }>();
const state = gameClient.state;
const tabs = [
  ["inventory", "Túi đồ", "▧"],
  ["equipment", "Trang bị", "♜"],
  ["skills", "Công pháp", "✧"],
  ["shop", "Thương nhân", "◈"],
  ["guild", "Bang hội", "⚑"],
  ["social", "Đạo hữu", "♧"],
  ["trade", "Giao dịch", "⇄"],
  ["maps", "Thiên hạ", "⌘"],
  ["realms", "Cảnh giới", "☯"],
  ["currencies", "Tài sản", "◇"],
  ["journal", "Nhật ký", "☷"],
];
const tab = ref(props.initialTab);
const title = computed(
  () => tabs.find((t) => t[0] === tab.value)?.[1] || "Hành trang",
);
const busy = reactive<Record<string, boolean>>({});
const error = ref("");
const success = ref("");
const name = ref("");
const guildName = ref("");
const whisper = ref("");
const quantities = reactive<Record<string, number>>({});
const offerItems = reactive<Record<string, number>>({});
const offerCurrencies = reactive<Record<string, number>>({});
const clock = ref(Date.now());
const timer = setInterval(() => {
  clock.value = Date.now();
}, 1000);
onUnmounted(() => clearInterval(timer));
const invitations = computed(() =>
  state.invitations.filter((i) => i.expiresAt > clock.value),
);
const myRole = computed(
  () =>
    state.guild?.members.find((m) => m.name === state.character?.name)?.role,
);
const gear = computed(() => state.inventory.filter((i) => i.slot));
const slots = [
  { code: "WEAPON", name: "Vũ khí", icon: "⚔" },
  { code: "ARMOR", name: "Giáp", icon: "♜" },
  { code: "HELMET", name: "Mũ", icon: "♛" },
  { code: "BOOTS", name: "Giày", icon: "♟" },
  { code: "RING", name: "Nhẫn", icon: "◉" },
] as const;
const quality: Record<string, string> = {
  COMMON: "Thường",
  RARE: "Hiếm",
  EPIC: "Sử thi",
};
const roles: Record<string, string> = {
  LEADER: "Bang chủ",
  DEPUTY: "Phó bang",
  MEMBER: "Thành viên",
};
const offerDirty = computed(() => {
  const normalized = (value: Record<string, number>) =>
    JSON.stringify(
      Object.entries(value)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => [k, Math.floor(n)])
        .sort(),
    );
  return (
    normalized(offerItems) !== normalized(state.trade?.me.items || {}) ||
    normalized(offerCurrencies) !== normalized(state.trade?.me.currencies || {})
  );
});
const confirm = ref<{ text: string; action: () => Promise<unknown> } | null>(
  null,
);
const number = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
const count = (code: string, max = 999999) =>
  Math.max(1, Math.min(max, Math.floor(quantities[code] || 1)));
async function run(
  key: string,
  action: () => Promise<unknown>,
  message = "Đã thực hiện thành công.",
) {
  if (busy[key]) return;
  busy[key] = true;
  error.value = "";
  success.value = "";
  try {
    await action();
    success.value = message;
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : "Không thể thực hiện. Vui lòng thử lại.";
  } finally {
    busy[key] = false;
  }
}
function ask(text: string, action: () => Promise<unknown>) {
  confirm.value = { text, action };
}
async function confirmed() {
  const action = confirm.value?.action;
  if (!action) return;
  await run("confirm", action);
  confirm.value = null;
}
async function load() {
  await run(
    "load",
    async () => {
      switch (tab.value) {
        case "inventory":
          await gameClient.request("inventory:get");
          break;
        case "equipment":
          await Promise.all([
            gameClient.request("equipment:get"),
            gameClient.request("inventory:get"),
          ]);
          break;
        case "skills":
          await gameClient.request("skill:list");
          break;
        case "shop":
          await Promise.all([
            gameClient.request("shop:list"),
            gameClient.request("inventory:get"),
          ]);
          break;
        case "guild":
          await gameClient.request("guild:info");
          break;
        case "social":
          await gameClient.request("friend:list");
          break;
        case "trade":
          await Promise.all([
            gameClient.request("inventory:get"),
            gameClient.refreshCharacter(),
          ]);
          break;
        case "maps":
        case "realms":
          await Promise.all([
            gameClient.request("data:static"),
            gameClient.refreshCharacter(),
          ]);
          break;
        case "currencies":
          await gameClient.refreshCharacter();
          break;
      }
    },
    "",
  );
}
watch(
  () => props.initialTab,
  (value) => {
    tab.value = value;
  },
);
watch(
  tab,
  () => {
    confirm.value = null;
    void load();
  },
  { immediate: true },
);
// Synchronize acknowledged offer contents, preserving unsent edits on confirmation updates.
watch(
  () =>
    JSON.stringify([
      state.trade?.with,
      state.trade?.me.items,
      state.trade?.me.currencies,
    ]),
  () => {
    const me = state.trade?.me;
    for (const key of Object.keys(offerItems)) delete offerItems[key];
    for (const key of Object.keys(offerCurrencies)) delete offerCurrencies[key];
    Object.assign(offerItems, me?.items || {});
    Object.assign(offerCurrencies, me?.currencies || {});
  },
  { immediate: true },
);
function accept(kind: string, from: string) {
  void run(`accept:${kind}:${from}`, () =>
    kind === "friend"
      ? gameClient.command("friend:accept", { name: from })
      : kind === "guild"
        ? gameClient.command("guild:accept")
        : gameClient.command("trade:accept"),
  );
}
function confirmTrade() {
  const snapshot = JSON.stringify(state.trade);
  ask(
    "Xác nhận đề nghị đang hiển thị? Khi cả hai đồng ý, vật phẩm và tiền sẽ được chuyển.",
    async () => {
      if (JSON.stringify(state.trade) !== snapshot || offerDirty.value)
        throw new Error(
          "Đề nghị đã thay đổi. Vui lòng kiểm tra và xác nhận lại.",
        );
      return gameClient.command("trade:confirm");
    },
  );
}
function offer() {
  void run(
    "offer",
    () =>
      gameClient.command("trade:offer", {
        items: Object.entries(offerItems)
          .filter(([, n]) => n > 0)
          .map(([code, n]) => ({ code, count: Math.floor(n) })),
        currencies: Object.entries(offerCurrencies)
          .filter(([, n]) => n > 0)
          .map(([code, n]) => ({ code, amount: Math.floor(n) })),
      }),
    "Đã cập nhật đề nghị. Cả hai bên cần xác nhận lại.",
  );
}
function itemName(code: string) {
  return (
    state.inventory.find((i) => i.code === code)?.name ||
    state.shop?.goods.find((i) => i.code === code)?.name ||
    code
  );
}
function currencyName(code: string) {
  return state.character?.currencies.find((i) => i.code === code)?.name || code;
}
</script>
<template>
  <ModalDialog :title="title || 'Hành trang'" @close="emit('close')">
    <div class="online-panels">
      <nav class="online-tabs" aria-label="Chức năng nhân vật">
        <button
          v-for="t in tabs"
          :key="t[0]"
          :class="{ active: tab === t[0] }"
          :aria-current="tab === t[0] ? 'page' : undefined"
          @click="tab = t[0] || 'inventory'"
        >
          <span aria-hidden="true">{{ t[2] }}</span
          >{{ t[1]
          }}<b
            v-if="
              invitations.some(
                (i) =>
                  (t[0] === 'social' && i.kind === 'friend') || t[0] === i.kind,
              )
            "
            >•</b
          >
        </button>
      </nav>
      <div class="online-content">
        <div class="online-toolbar">
          <span
            >{{ state.character?.name }}
            <small
              >· {{ state.character?.realm.name }}
              {{ state.character?.subRealm }}</small
            ></span
          ><button :disabled="busy.load" @click="load">
            {{ busy.load ? "Đang tải…" : "↻ Làm mới" }}
          </button>
        </div>
        <p v-if="error" class="online-message error" role="alert">
          {{ error }}
        </p>
        <p v-if="success" class="online-message success" role="status">
          {{ success }}
        </p>
        <div v-if="confirm" class="online-confirm" role="alert">
          <p>{{ confirm.text }}</p>
          <div class="online-actions">
            <button class="danger" :disabled="busy.confirm" @click="confirmed">
              {{ busy.confirm ? "Đang xử lý…" : "Xác nhận" }}</button
            ><button :disabled="busy.confirm" @click="confirm = null">
              Quay lại
            </button>
          </div>
        </div>
        <div v-if="invitations.length" class="online-invitations">
          <div
            v-for="inv in invitations"
            :key="inv.id"
            class="online-invitation"
          >
            <span
              ><strong>{{ inv.from }}</strong>
              {{
                inv.kind === "friend"
                  ? "muốn kết bạn"
                  : inv.kind === "guild"
                    ? `mời vào bang ${inv.guildName}`
                    : "mời giao dịch"
              }}<small
                >Còn {{ Math.ceil((inv.expiresAt - clock) / 1000) }} giây</small
              ></span
            ><button
              :disabled="busy[`accept:${inv.kind}:${inv.from}`]"
              @click="accept(inv.kind, inv.from)"
            >
              Chấp nhận
            </button>
          </div>
        </div>
        <template v-if="tab === 'inventory'">
          <p class="online-intro">
            Hành trang trên đường tu đạo
            <span>{{ state.inventory.length }} loại vật phẩm</span>
          </p>
          <div v-if="!state.inventory.length" class="online-empty">
            <span>▧</span>Túi đồ còn trống.<small
              >Hạ yêu thú hoặc ghé thương nhân để thu thập vật phẩm.</small
            >
          </div>
          <article
            v-for="item in state.inventory"
            :key="item.code"
            class="online-card"
          >
            <span
              class="online-item-icon"
              :class="item.quality?.toLowerCase()"
              >{{ item.slot ? "⚔" : "◈" }}</span
            >
            <div class="online-item-info">
              <h3>
                {{ item.name }} <small>×{{ number(item.count) }}</small>
              </h3>
              <p v-if="item.slot">
                {{ quality[item.quality || "COMMON"] }} · Công +{{
                  item.atkBonus
                }}
                · Máu +{{ item.hpBonus }}
              </p>
              <p v-else>
                Hồi {{ item.healHp }} máu · Tu vi +{{ item.expGain }}
              </p>
            </div>
            <div class="online-actions">
              <button
                v-if="item.slot"
                :disabled="busy[item.code]"
                @click="
                  run(item.code, () =>
                    gameClient.command('equipment:equip', { code: item.code }),
                  )
                "
              >
                Trang bị</button
              ><button
                v-else
                :disabled="busy[item.code]"
                @click="
                  run(item.code, () =>
                    gameClient.command('inventory:use', { code: item.code }),
                  )
                "
              >
                Dùng 1</button
              ><input
                v-model.number="quantities[item.code]"
                type="number"
                min="1"
                :max="item.count"
                placeholder="1"
                :aria-label="`Số lượng ${item.name}`"
              /><button
                class="muted"
                :disabled="busy[item.code]"
                @click="
                  ask(
                    `Bỏ ${count(item.code, item.count)} ${item.name}? Vật phẩm sẽ mất vĩnh viễn.`,
                    () =>
                      gameClient.command('inventory:drop', {
                        code: item.code,
                        count: count(item.code, item.count),
                      }),
                  )
                "
              >
                Bỏ
              </button>
            </div>
          </article>
        </template>
        <template v-else-if="tab === 'equipment'">
          <p class="online-intro">
            Ngũ bộ pháp bảo <span>Chỉ số được cộng trực tiếp vào nhân vật</span>
          </p>
          <div class="online-gear-grid">
            <article v-for="slot in slots" :key="slot.code" class="online-gear">
              <span class="online-item-icon">{{ slot.icon }}</span
              ><small>{{ slot.name }}</small>
              <h3>{{ state.equipment[slot.code]?.name || "Chưa trang bị" }}</h3>
              <p v-if="state.equipment[slot.code]">
                Công +{{ state.equipment[slot.code]?.atkBonus }} · Máu +{{
                  state.equipment[slot.code]?.hpBonus
                }}
              </p>
              <button
                v-if="state.equipment[slot.code]"
                :disabled="busy[slot.code]"
                @click="
                  run(slot.code, () =>
                    gameClient.command('equipment:unequip', {
                      slot: slot.code,
                    }),
                  )
                "
              >
                Tháo xuống
              </button>
            </article>
          </div>
          <h3 class="online-subtitle">Trang bị trong túi</h3>
          <p v-if="!gear.length" class="online-empty">
            Chưa có trang bị dự phòng.
          </p>
          <article v-for="item in gear" :key="item.code" class="online-card">
            <div class="online-item-info">
              <h3>{{ item.name }}</h3>
              <p>
                {{ quality[item.quality || "COMMON"] }} · Công +{{
                  item.atkBonus
                }}
                · Máu +{{ item.hpBonus }}
              </p>
            </div>
            <button
              :disabled="busy[item.code]"
              @click="
                run(item.code, () =>
                  gameClient.command('equipment:equip', { code: item.code }),
                )
              "
            >
              Trang bị
            </button>
          </article>
        </template>
        <template v-else-if="tab === 'skills'">
          <p class="online-intro">
            Công pháp tu luyện
            <span>{{ state.skills.points }} điểm kỹ năng</span>
          </p>
          <article
            v-for="skill in state.skills.skills"
            :key="skill.code"
            class="online-card"
          >
            <span class="online-item-icon">✧</span>
            <div class="online-item-info">
              <h3>{{ skill.name }}</h3>
              <p>
                Sát thương ×{{ skill.damageMult }} · Tầm {{ skill.range }} · Hồi
                {{ skill.cooldownMs / 1000 }}s
              </p>
              <small
                >Cảnh giới {{ skill.minRealm }} · {{ skill.cost }} điểm
                {{ skill.learned ? "· Đã học" : "" }}</small
              >
            </div>
            <button
              v-if="skill.learned"
              @click="
                emit('skill', skill.code);
                emit('close');
              "
            >
              Chọn chiến đấu</button
            ><button
              v-else
              :disabled="!skill.canLearn || busy[skill.code]"
              @click="
                run(skill.code, () =>
                  gameClient.command('skill:learn', { code: skill.code }),
                )
              "
            >
              Học công pháp
            </button>
          </article>
        </template>
        <template v-else-if="tab === 'shop'">
          <p class="online-intro">
            {{ state.shop?.npc.name || "Thương nhân" }}
            <span>{{ state.shop?.currency?.name }}</span>
          </p>
          <p class="online-note">
            Cần còn sống và đứng cách thương nhân ({{ state.shop?.npc.x }},
            {{ state.shop?.npc.y }}) không quá 100 bước để mua hoặc bán.
          </p>
          <article
            v-for="good in state.shop?.goods || []"
            :key="good.code"
            class="online-card"
          >
            <span class="online-item-icon">◈</span>
            <div class="online-item-info">
              <h3>{{ good.name }}</h3>
              <p>
                Mua {{ number(good.price) }} · Bán {{ number(good.sellPrice) }}
              </p>
              <small
                >Trong túi:
                {{
                  state.inventory.find((i) => i.code === good.code)?.count || 0
                }}</small
              >
            </div>
            <div class="online-actions">
              <input
                v-model.number="quantities[good.code]"
                type="number"
                min="1"
                max="99"
                placeholder="1"
                :aria-label="`Số lượng ${good.name}`"
              /><button
                :disabled="busy[good.code]"
                @click="
                  run(good.code, () =>
                    gameClient.command('shop:buy', {
                      code: good.code,
                      count: count(good.code, 99),
                    }),
                  )
                "
              >
                Mua</button
              ><button
                class="muted"
                :disabled="
                  busy[good.code] ||
                  !state.inventory.some((i) => i.code === good.code)
                "
                @click="
                  run(good.code, () =>
                    gameClient.command('shop:sell', {
                      code: good.code,
                      count: count(good.code, 99),
                    }),
                  )
                "
              >
                Bán
              </button>
            </div>
          </article>
        </template>
        <template v-else-if="tab === 'guild'">
          <template v-if="!state.guild"
            ><div class="online-empty">
              <span>⚑</span>Cùng đạo hữu dựng nên cơ nghiệp.<small
                >Tạo bang hội hoặc chấp nhận lời mời từ bang chủ.</small
              >
            </div>
            <form
              class="online-form"
              @submit.prevent="
                run('guild:create', () =>
                  gameClient.command('guild:create', {
                    name: guildName.trim(),
                  }),
                )
              "
            >
              <label
                >Tên bang hội<input
                  v-model="guildName"
                  required
                  minlength="2"
                  maxlength="16"
                  placeholder="Nhập tên bang hội" /></label
              ><button :disabled="busy['guild:create']">Lập bang</button>
            </form></template
          >
          <template v-else
            ><p class="online-intro">
              {{ state.guild.name }}
              <span
                >{{ state.guild.members.length }} thành viên ·
                {{ roles[myRole || "MEMBER"] }}</span
              >
            </p>
            <form
              v-if="myRole !== 'MEMBER'"
              class="online-form"
              @submit.prevent="
                run('guild:invite', () =>
                  gameClient.command('guild:invite', { name: name.trim() }),
                )
              "
            >
              <label
                >Mời đạo hữu<input
                  v-model="name"
                  required
                  placeholder="Tên nhân vật đang trực tuyến" /></label
              ><button :disabled="busy['guild:invite']">Gửi lời mời</button>
            </form>
            <article
              v-for="member in state.guild.members"
              :key="member.name"
              class="online-card"
            >
              <span
                class="online-presence"
                :class="{ on: member.online }"
              ></span>
              <div class="online-item-info">
                <h3>{{ member.name }}</h3>
                <p>
                  {{ roles[member.role] }} ·
                  {{ member.online ? "Trực tuyến" : "Ngoại tuyến" }}
                </p>
              </div>
              <div
                v-if="member.name !== state.character?.name"
                class="online-actions"
              >
                <button
                  v-if="myRole === 'LEADER' && member.role === 'MEMBER'"
                  :disabled="busy[member.name]"
                  @click="
                    run(member.name, () =>
                      gameClient.command('guild:promote', {
                        name: member.name,
                      }),
                    )
                  "
                >
                  Bổ nhiệm phó</button
                ><button
                  v-if="myRole === 'LEADER' && member.role === 'DEPUTY'"
                  :disabled="busy[member.name]"
                  @click="
                    ask(`Bãi nhiệm phó bang ${member.name}?`, () =>
                      gameClient.command('guild:demote', { name: member.name }),
                    )
                  "
                >
                  Bãi nhiệm</button
                ><button
                  v-if="myRole === 'LEADER'"
                  @click="
                    ask(
                      `Nhường chức bang chủ cho ${member.name}? Bạn sẽ trở thành thành viên thường.`,
                      () =>
                        gameClient.command('guild:transfer', {
                          name: member.name,
                        }),
                    )
                  "
                >
                  Nhường chức</button
                ><button
                  v-if="
                    myRole === 'LEADER' ||
                    (myRole === 'DEPUTY' && member.role === 'MEMBER')
                  "
                  class="danger"
                  @click="
                    ask(`Mời ${member.name} rời bang?`, () =>
                      gameClient.command('guild:kick', { name: member.name }),
                    )
                  "
                >
                  Trục xuất
                </button>
              </div>
            </article>
            <button
              class="online-leave danger"
              @click="
                ask(
                  'Rời bang hội? Nếu là bang chủ, chức vị sẽ được chuyển cho thành viên kế tiếp; bang trống sẽ giải tán.',
                  () => gameClient.command('guild:leave'),
                )
              "
            >
              Rời bang hội
            </button></template
          >
        </template>
        <template v-else-if="tab === 'social'">
          <p class="online-intro">
            Tri kỷ nơi tiên giới
            <span>{{ state.friends.friends.length }} đạo hữu</span>
          </p>
          <form
            class="online-form"
            @submit.prevent="
              run('friend:request', () =>
                gameClient.command('friend:request', { name: name.trim() }),
              )
            "
          >
            <label
              >Tên nhân vật<input
                v-model="name"
                required
                placeholder="Tên đạo hữu" /></label
            ><button :disabled="busy['friend:request']">Kết bạn</button
            ><button
              type="button"
              class="muted"
              :disabled="!name.trim() || busy['block:add']"
              @click="
                ask(`Chặn ${name.trim()}? Quan hệ bạn bè cũng sẽ bị xóa.`, () =>
                  gameClient.command('block:add', { name: name.trim() }),
                )
              "
            >
              Chặn
            </button>
          </form>
          <article
            v-for="friend in state.friends.friends"
            :key="friend.name"
            class="online-card"
          >
            <span class="online-presence" :class="{ on: friend.online }"></span>
            <div class="online-item-info">
              <h3>{{ friend.name }}</h3>
              <p>{{ friend.online ? "Trực tuyến" : "Ngoại tuyến" }}</p>
            </div>
            <div class="online-actions">
              <button @click="name = friend.name">Nhắn riêng</button
              ><button
                :disabled="!friend.online || busy['trade:request']"
                @click="
                  run('trade:request', () =>
                    gameClient.command('trade:request', { name: friend.name }),
                  )
                "
              >
                Giao dịch</button
              ><button
                class="muted"
                @click="
                  ask(`Xóa ${friend.name} khỏi danh sách bạn?`, () =>
                    gameClient.command('friend:remove', { name: friend.name }),
                  )
                "
              >
                Xóa bạn
              </button>
            </div>
          </article>
          <h3 class="online-subtitle">Truyền âm riêng</h3>
          <form
            class="online-form whisper-form"
            @submit.prevent="
              run(
                'whisper',
                async () => {
                  await gameClient.command('chat:whisper', {
                    to: name.trim(),
                    text: whisper.trim(),
                  });
                  whisper = '';
                },
                'Đã gửi truyền âm.',
              )
            "
          >
            <label
              >Người nhận<input
                v-model="name"
                required
                placeholder="Tên nhân vật" /></label
            ><label
              >Nội dung<input
                v-model="whisper"
                required
                maxlength="200"
                placeholder="Gửi một lời hỏi thăm…" /></label
            ><button :disabled="busy.whisper">Gửi</button>
          </form>
          <div class="online-whispers">
            <p
              v-for="(message, index) in state.messages
                .filter((m) => m.channel === 'whisper')
                .slice(-12)"
              :key="index"
            >
              <strong>{{ message.from }} → {{ message.to }}:</strong>
              {{ message.text }}
            </p>
          </div>
          <h3 class="online-subtitle">Danh sách chặn</h3>
          <p v-if="!state.friends.blocked.length" class="online-note">
            Chưa chặn người chơi nào.
          </p>
          <article
            v-for="blocked in state.friends.blocked"
            :key="blocked"
            class="online-card"
          >
            <span class="online-item-info">{{ blocked }}</span
            ><button
              :disabled="busy[blocked]"
              @click="
                run(blocked, () =>
                  gameClient.command('block:remove', { name: blocked }),
                )
              "
            >
              Bỏ chặn
            </button>
          </article>
        </template>
        <template v-else-if="tab === 'trade'">
          <template v-if="!state.trade"
            ><div class="online-empty">
              <span>⇄</span>Trao đổi vật phẩm cùng đạo hữu.<small
                >Cả hai bên phải xác nhận đề nghị để hoàn tất.</small
              >
            </div>
            <form
              class="online-form"
              @submit.prevent="
                run('trade:request', () =>
                  gameClient.command('trade:request', { name: name.trim() }),
                )
              "
            >
              <label
                >Đạo hữu muốn giao dịch<input
                  v-model="name"
                  required
                  placeholder="Tên nhân vật đang trực tuyến" /></label
              ><button :disabled="busy['trade:request']">Mời giao dịch</button>
            </form></template
          >
          <template v-else
            ><p class="online-intro">
              Giao dịch với {{ state.trade.with }}
              <span>Kiểm tra kỹ trước khi xác nhận</span>
            </p>
            <div class="online-trade-sides">
              <article
                v-for="(side, index) in [state.trade.me, state.trade.other]"
                :key="index"
                class="online-trade-side"
              >
                <h3>
                  {{ index === 0 ? "Bạn" : side.name }}
                  <small :class="{ approved: side.confirmed }">{{
                    side.confirmed ? "Đã xác nhận" : "Chưa xác nhận"
                  }}</small>
                </h3>
                <p
                  v-if="
                    !Object.keys(side.items).length &&
                    !Object.keys(side.currencies).length
                  "
                  class="online-note"
                >
                  Chưa có đề nghị.
                </p>
                <p v-for="(amount, code) in side.items" :key="code">
                  {{ itemName(String(code)) }} <b>×{{ number(amount) }}</b>
                </p>
                <p v-for="(amount, code) in side.currencies" :key="code">
                  {{ currencyName(String(code)) }} <b>{{ number(amount) }}</b>
                </p>
              </article>
            </div>
            <h3 class="online-subtitle">Đề nghị của bạn</h3>
            <form @submit.prevent="offer">
              <div class="online-offer-grid">
                <label v-for="item in state.inventory" :key="item.code"
                  >{{ item.name }} <small>Có {{ item.count }}</small
                  ><input
                    v-model.number="offerItems[item.code]"
                    type="number"
                    min="0"
                    :max="Math.min(item.count, 999)"
                    placeholder="0" /></label
                ><label
                  v-for="currency in state.character?.currencies || []"
                  :key="currency.code"
                  >{{ currency.name }}
                  <small>Có {{ number(currency.amount) }}</small
                  ><input
                    v-model.number="offerCurrencies[currency.code]"
                    type="number"
                    min="0"
                    :max="currency.amount"
                    placeholder="0"
                /></label>
              </div>
              <p class="online-note">
                Mỗi lần sửa đề nghị sẽ hủy xác nhận của cả hai. Hãy cập nhật đề
                nghị trước khi xác nhận.
              </p>
              <div class="online-actions">
                <button :disabled="busy.offer || busy['trade:confirm']">
                  Cập nhật đề nghị</button
                ><button
                  type="button"
                  :disabled="
                    busy['trade:confirm'] ||
                    busy.offer ||
                    busy.confirm ||
                    offerDirty ||
                    state.trade.me.confirmed
                  "
                  @click="confirmTrade"
                >
                  {{
                    state.trade.me.confirmed
                      ? "Đang chờ đối phương…"
                      : "Xác nhận giao dịch"
                  }}</button
                ><button
                  type="button"
                  class="danger"
                  :disabled="busy['trade:cancel']"
                  @click="
                    run('trade:cancel', () =>
                      gameClient.command('trade:cancel'),
                    )
                  "
                >
                  Hủy giao dịch
                </button>
              </div>
            </form></template
          >
        </template>
        <template v-else-if="tab === 'maps'">
          <p class="online-intro">
            Vạn dặm tiên lộ
            <span>{{ state.staticData.maps.length }} khu vực</span>
          </p>
          <article
            v-for="map in state.staticData.maps"
            :key="map.id"
            class="online-card"
          >
            <span class="online-item-icon">⌘</span>
            <div class="online-item-info">
              <h3>{{ map.name }}</h3>
              <p>
                {{ map.kind === "LARGE" ? "Đại thế giới" : "Tiểu thế giới" }}
                <span v-if="state.world.mapId === map.id && state.world.joined"
                  >· Đang ở đây</span
                >
              </p>
            </div>
            <button
              :disabled="
                busy.map || (state.world.mapId === map.id && state.world.joined)
              "
              @click="
                run(
                  'map',
                  async () => {
                    await gameClient.joinMap(map.id);
                    emit('close');
                  },
                  '',
                )
              "
            >
              Tiến vào
            </button>
          </article>
          <button
            v-if="state.world.joined"
            class="online-leave muted"
            :disabled="busy.map"
            @click="
              run(
                'map',
                async () => {
                  gameClient.leaveMap();
                },
                'Đã rời bản đồ.',
              )
            "
          >
            Rời bản đồ
          </button>
        </template>
        <template v-else-if="tab === 'realms'">
          <div class="online-cultivation">
            <span>☯</span><small>CẢNH GIỚI HIỆN TẠI</small>
            <h3>{{ state.character?.realm.name }}</h3>
            <p>
              Tầng {{ state.character?.subRealm }} /
              {{ state.staticData.subRealmsPerRealm }}
            </p>
            <progress
              :value="state.character?.exp || 0"
              :max="state.character?.expNeeded || 1"
            ></progress>
            <p>
              {{ number(state.character?.exp || 0) }} /
              {{ number(state.character?.expNeeded || 0) }} tu vi
            </p>
            <button
              :disabled="
                busy.breakthrough ||
                (state.character?.exp || 0) < (state.character?.expNeeded || 1)
              "
              @click="
                run(
                  'breakthrough',
                  () => gameClient.command('cultivate:breakthrough'),
                  'Đột phá thành công! Đã nhận thêm điểm kỹ năng.',
                )
              "
            >
              {{ busy.breakthrough ? "Đang đột phá…" : "Đột phá cảnh giới" }}
            </button>
          </div>
          <div class="online-realm-path">
            <div
              v-for="realm in state.staticData.realms"
              :key="realm.id"
              :class="{
                reached: realm.order <= (state.character?.realm.order || 0),
                current: realm.order === state.character?.realm.order,
              }"
            >
              <b>{{ String(realm.order).padStart(2, "0") }}</b
              ><span>{{ realm.name }}</span
              ><small v-if="realm.order === state.character?.realm.order"
                >Hiện tại</small
              >
            </div>
          </div>
        </template>
        <template v-else-if="tab === 'currencies'">
          <p class="online-intro">
            Tài sản tích lũy <span>Số dư được lưu trên máy chủ</span>
          </p>
          <div class="online-currency-grid">
            <article
              v-for="currency in state.character?.currencies || []"
              :key="currency.code"
            >
              <span>◇</span>
              <h3>{{ currency.name }}</h3>
              <strong>{{ number(currency.amount) }}</strong>
            </article>
          </div>
          <p v-if="!state.character?.currencies.length" class="online-empty">
            Chưa có tiền tệ. Hạ yêu thú để nhận chiến lợi phẩm.
          </p>
        </template>
        <template v-else-if="tab === 'journal'">
          <p class="online-intro">
            Dấu chân tu hành <span>Các hoạt động gần đây</span>
          </p>
          <p v-if="!state.notifications.length" class="online-empty">
            Chưa có hoạt động nào được ghi lại.
          </p>
          <article
            v-for="entry in [...state.notifications].reverse()"
            :key="entry.id"
            class="online-journal"
          >
            <time>{{
              new Date(entry.at).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            }}</time>
            <p>{{ entry.text }}</p>
          </article>
        </template>
      </div>
    </div>
  </ModalDialog>
</template>
