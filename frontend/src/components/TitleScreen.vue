<script setup lang="ts">
import { ref } from "vue";
import { art } from "../data/art";
import { elements } from "../data/sects";
import ElementIcon from "./ElementIcon.vue";
import ModalDialog from "./ModalDialog.vue";
const emit = defineEmits<{ start: []; login: [] }>();
const selected = ref(2);
const dialog = ref<"server" | "notice" | null>(null);
const landscape = art("bg-title.webp"),
  portrait = art("bg-title-portrait.webp");
</script>
<template>
  <section class="title-screen" aria-label="Khởi động Tiên Linh Giới">
    <picture v-if="landscape || portrait" class="title-art"
      ><source v-if="portrait" media="(max-width:700px)" :srcset="portrait" />
      <img :src="landscape || portrait" alt="Tranh tiên cảnh Tiên Linh Giới"
    /></picture>
    <div class="ink-mountain distant"></div>
    <div class="ink-mountain near"></div>
    <div class="ink-moon"></div>
    <div class="mist mist-one"></div>
    <div class="mist mist-two"></div>
    <div class="title-tools">
      <button disabled title="Chưa có bản tải xuống">
        Tải trò chơi <small>Sắp có</small></button
      ><select aria-label="Ngôn ngữ">
        <option>Tiếng Việt</option>
      </select>
    </div>
    <div class="title-content">
      <p class="section-eyebrow">MÂY QUA NGÀN NÚI · ĐẠO Ở TRONG TÂM</p>
      <img
        v-if="art('logo.png')"
        :src="art('logo.png')"
        class="title-logo"
        alt="Tiên Linh Giới"
      />
      <h1 v-else>Tiên Linh Giới</h1>
      <p class="title-verse">
        Một nét mực mở ngàn tiên cảnh.<br />Một bước chân khởi vạn trùng duyên.
      </p>
      <div class="server-choice">
        <span class="server-light"></span>
        <div>
          <strong>Thanh Vân · S01</strong
          ><small>Thông thoáng · Máy chủ mẫu</small>
        </div>
        <button @click="dialog = 'server'">Đổi máy chủ ↗</button>
      </div>
      <button class="enter-world" @click="emit('start')">
        Vào trò chơi <span>→</span>
      </button>
      <button class="old-account" @click="emit('login')">
        Đăng nhập tài khoản cũ
      </button>
      <div class="element-row" aria-label="Ngũ hành">
        <button
          v-for="(element, i) in elements"
          :key="element.id"
          :aria-pressed="selected === i"
          :class="{ selected: selected === i }"
          :style="{ color: element.color }"
          @click="selected = i"
        >
          <ElementIcon :element="element.id" /><span>{{ element.name }}</span>
        </button>
      </div>
      <p class="element-description" role="status">
        {{ elements[selected]?.description }}
      </p>
    </div>
    <div class="title-character">
      <img
        v-if="art('char-1.png')"
        :src="art('char-1.png')"
        alt="Nhân vật Tiên Linh Giới"
      /><template v-else
        ><div class="brush-orbit"></div>
        <span class="ink-seal">仙</span>
        <p>Vân thủy hữu tình<br />Tiên đạo vô cùng</p></template
      >
    </div>
    <footer class="title-footer">
      <button @click="dialog = 'notice'">Thông báo ↗</button
      ><span>Bản trải nghiệm · Dữ liệu mẫu</span><span>v0.2.0</span>
    </footer>
    <ModalDialog
      v-if="dialog"
      :title="dialog === 'server' ? 'Chọn Máy Chủ' : 'Thông Báo Tiên Giới'"
      @close="dialog = null"
      ><template v-if="dialog === 'server'"
        ><button class="server-option" @click="dialog = null">
          <span class="server-light"></span> Thanh Vân · S01
          <small>Đang chọn · Thông thoáng</small>
        </button>
        <p>Hiện có một máy chủ mẫu. Chưa kết nối máy chủ thật.</p></template
      ><template v-else
        ><p>Chào mừng đạo hữu đến với bản trải nghiệm Tiên Linh Giới.</p>
        <p>
          Tạo nhân vật, chọn ngũ hành và tông môn, khám phá Thanh Vân Cốc. Đăng
          nhập và tiến trình đều dùng dữ liệu mẫu trong phiên này.
        </p></template
      ></ModalDialog
    >
  </section>
</template>
