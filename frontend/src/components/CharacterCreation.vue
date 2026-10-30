<script setup lang="ts">
import { computed, ref } from "vue";
import { elements, sects, validateCharacterName } from "../data/sects";
import type { CharacterProfile, ElementId } from "../data/sects";
import { art } from "../data/art";
import ElementIcon from "./ElementIcon.vue";
const emit = defineEmits<{ create: [profile: CharacterProfile]; back: [] }>();
const name = ref("Thanh Vân"),
  element = ref<ElementId>("thuy"),
  sect = ref("Hàn Nguyệt Cung"),
  avatar = ref(1),
  error = ref("");
const compatible = computed(() =>
  sects.filter((s) => s.element === element.value),
);
function choose(value: ElementId) {
  element.value = value;
  sect.value = sects.find((s) => s.element === value)!.name;
}
function submit() {
  if (!validateCharacterName(name.value)) {
    error.value = "Tên nhân vật cần từ 2 đến 20 ký tự.";
    return;
  }
  emit("create", {
    name: name.value.trim(),
    element: element.value,
    sect: sect.value,
    avatar: avatar.value,
  });
}
</script>
<template>
  <section class="creation-page">
    <button class="back-link" @click="emit('back')">← Trở về đăng nhập</button>
    <div class="creation-heading">
      <p class="section-eyebrow">ĐẶT MỘT ĐẠO DANH · KẾT MỘT TIÊN DUYÊN</p>
      <h1>Khởi một tiên duyên</h1>
      <p>Mỗi người một đạo, mỗi bước một câu chuyện.</p>
    </div>
    <form class="creation-layout" @submit.prevent="submit">
      <aside class="character-preview">
        <img
          v-if="art(`char-${((avatar - 1) % 3) + 1}.png`)"
          :src="art(`char-${((avatar - 1) % 3) + 1}.png`)"
          alt="Tranh nhân vật đã chọn"
        /><template v-else
          ><span
            :style="{ color: elements.find((e) => e.id === element)?.color }"
            class="creation-glyph"
            >{{ elements.find((e) => e.id === element)?.glyph }}</span
          >
          <div class="ink-avatar">
            {{ ["清", "月", "云", "岚", "竹", "霜"][avatar - 1] }}
          </div></template
        >
        <h2>{{ name || "Đạo hữu vô danh" }}</h2>
        <p>{{ sect }}</p>
        <small>Hình đại diện và lựa chọn dùng dữ liệu mẫu.</small>
      </aside>
      <div class="creation-fields">
        <label for="character-name">Tên nhân vật</label
        ><input
          id="character-name"
          v-model="name"
          minlength="2"
          maxlength="20"
          required
          placeholder="2–20 ký tự"
          autocomplete="off"
        />
        <fieldset>
          <legend>Chọn ngũ hành</legend>
          <div class="creation-elements">
            <button
              v-for="e in elements"
              :key="e.id"
              type="button"
              :aria-pressed="element === e.id"
              :class="{ selected: element === e.id }"
              @click="choose(e.id)"
            >
              <ElementIcon :element="e.id" />{{ e.name }}
            </button>
          </div>
        </fieldset>
        <fieldset>
          <legend>Tông môn theo ngũ hành</legend>
          <label v-for="s in compatible" :key="s.name" class="sect-option"
            ><input
              v-model="sect"
              type="radio"
              :value="s.name"
              name="sect"
            /><span
              ><strong>{{ s.name }}</strong
              ><small>{{ s.description }}</small></span
            ></label
          >
        </fieldset>
        <fieldset>
          <legend>Chọn avatar</legend>
          <div class="avatar-options">
            <button
              v-for="i in 6"
              :key="i"
              type="button"
              :aria-label="`Avatar ${i}`"
              :aria-pressed="avatar === i"
              :class="{ selected: avatar === i }"
              @click="avatar = i"
            >
              <img
                v-if="art(`avatar-${i}.webp`)"
                :src="art(`avatar-${i}.webp`)"
                :alt="`Avatar ${i}`"
              /><span v-else>{{
                ["清", "月", "云", "岚", "竹", "霜"][i - 1]
              }}</span>
            </button>
          </div>
        </fieldset>
        <p v-if="error" role="alert" class="form-error">{{ error }}</p>
        <button class="enter-world" type="submit">
          Tạo nhân vật · Vào tiên giới →
        </button>
        <p class="creation-note">
          Chưa kết nối backend. Nhân vật chỉ tồn tại trong phiên hiện tại.
        </p>
      </div>
    </form>
  </section>
</template>
