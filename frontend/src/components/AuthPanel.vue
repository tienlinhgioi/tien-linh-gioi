<script setup lang="ts">
import { ref } from "vue";
import { validateIdentity } from "../data/world";
const emit = defineEmits<{ enter: [name: string] }>();
const mode = ref<"login" | "register">("login");
const name = ref("");
const password = ref("");
const confirmation = ref("");
const error = ref("");
function submit() {
  error.value = validateIdentity(
    name.value,
    password.value,
    mode.value === "register" ? confirmation.value : undefined,
  );
  if (!error.value) emit("enter", name.value.trim());
}
function switchMode() {
  mode.value = mode.value === "login" ? "register" : "login";
  error.value = "";
}
</script>

<template>
  <section class="auth-card" aria-labelledby="auth-title">
    <div class="section-eyebrow">MỘT NIỆM KHỞI · VẠN DUYÊN SINH</div>
    <div class="auth-seal">仙</div>
    <h1 id="auth-title">
      {{ mode === "login" ? "Trở về tiên cảnh" : "Kết một tiên duyên" }}
    </h1>
    <p class="auth-intro">
      {{
        mode === "login"
          ? "Gác lại bụi trần, tiếp bước hành trình của riêng bạn."
          : "Đặt đạo danh, mở ra một hành trình tu tiên mới."
      }}
    </p>
    <div class="auth-tabs" role="group" aria-label="Chọn hình thức truy cập">
      <button
        :class="{ selected: mode === 'login' }"
        @click="
          mode = 'login';
          error = '';
        "
      >
        Đăng nhập
      </button>
      <button
        :class="{ selected: mode === 'register' }"
        @click="
          mode = 'register';
          error = '';
        "
      >
        Đăng ký
      </button>
    </div>
    <form @submit.prevent="submit">
      <label for="name">Đạo danh</label>
      <input
        id="name"
        v-model="name"
        name="username"
        autocomplete="username"
        placeholder="Nhập đạo danh của bạn"
        required
        minlength="2"
        maxlength="30"
      />
      <label for="password">Mật khẩu</label>
      <input
        id="password"
        v-model="password"
        name="password"
        type="password"
        :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
        placeholder="Ít nhất 6 ký tự"
        required
        minlength="6"
      />
      <template v-if="mode === 'register'">
        <label for="confirmation">Nhập lại mật khẩu</label>
        <input
          id="confirmation"
          v-model="confirmation"
          type="password"
          autocomplete="new-password"
          placeholder="Xác nhận mật khẩu"
          required
          minlength="6"
        />
      </template>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button class="primary-button auth-submit" type="submit">
        {{ mode === "login" ? "Bước vào Tiên Giới" : "Khai mở tiên duyên" }}
        <span>→</span>
      </button>
    </form>
    <div class="auth-divider"><span>hoặc thong thả khám phá</span></div>
    <button class="guest-button" @click="emit('enter', 'Thanh Vân')">
      Trải nghiệm với nhân vật mẫu <span>↗</span>
    </button>
    <p class="demo-note">
      Bản trải nghiệm · Dữ liệu mẫu<br />Không gửi hay lưu mật khẩu. Chưa kết
      nối tài khoản thật.
    </p>
    <p class="auth-switch">
      {{ mode === "login" ? "Chưa có tiên duyên?" : "Đã có đạo danh?" }}
      <button @click="switchMode">
        {{ mode === "login" ? "Đăng ký" : "Đăng nhập" }}
      </button>
    </p>
  </section>
</template>
