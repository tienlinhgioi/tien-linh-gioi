<script setup lang="ts">
import { ref } from "vue";
const emit = defineEmits<{ enter: [name: string] }>();
const mode = ref<"login" | "register">("login");
const account = ref(""),
  email = ref(""),
  username = ref(""),
  password = ref(""),
  confirmation = ref(""),
  error = ref("");
function submit() {
  error.value = "";
  if (mode.value === "register") {
    if (!/^[^\s@]+@gmail\.com$/i.test(email.value.trim())) {
      error.value = "Nhập địa chỉ Gmail hợp lệ.";
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.value)) {
      error.value =
        "Tên tài khoản gồm 3–20 chữ cái không dấu, số hoặc gạch dưới.";
      return;
    }
    if (password.value !== confirmation.value) {
      error.value = "Hai mật khẩu chưa trùng khớp.";
      return;
    }
  }
  if (password.value.length < 6 || password.value.length > 64) {
    error.value = "Mật khẩu cần từ 6 đến 64 ký tự.";
    return;
  }
  if (mode.value === "login" && !account.value.trim()) {
    error.value = "Nhập Gmail hoặc tên tài khoản.";
    return;
  }
  emit(
    "enter",
    mode.value === "register" ? username.value : account.value.trim(),
  );
}
</script>
<template>
  <section class="auth-card" aria-labelledby="auth-title">
    <p class="section-eyebrow">GÁC LẠI BỤI TRẦN · BƯỚC VÀO TIÊN CẢNH</p>
    <div class="auth-seal">仙</div>
    <h1 id="auth-title">
      {{ mode === "login" ? "Trở về tiên cảnh" : "Kết một tiên duyên" }}
    </h1>
    <p class="auth-intro">Đăng nhập mẫu, chưa xác thực tài khoản thật.</p>
    <div class="auth-tabs">
      <button
        :class="{ selected: mode === 'login' }"
        @click="
          mode = 'login';
          error = '';
        "
      >
        Đăng nhập</button
      ><button
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
      <template v-if="mode === 'register'"
        ><label for="email">Gmail</label
        ><input
          id="email"
          v-model="email"
          type="email"
          autocomplete="email"
          required
          placeholder="daohuu@gmail.com" /><label for="username"
          >Tên tài khoản</label
        ><input
          id="username"
          v-model="username"
          autocomplete="username"
          required
          minlength="3"
          maxlength="20"
          placeholder="Chữ không dấu, số, gạch dưới" /></template
      ><template v-else
        ><label for="account">Gmail hoặc tên tài khoản</label
        ><input
          id="account"
          v-model="account"
          autocomplete="username"
          required
          placeholder="Nhập Gmail hoặc tên tài khoản" /></template
      ><label for="password">Mật khẩu</label
      ><input
        id="password"
        v-model="password"
        type="password"
        :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
        required
        minlength="6"
        maxlength="64"
        placeholder="6–64 ký tự"
      /><template v-if="mode === 'register'"
        ><label for="confirmation">Nhập lại mật khẩu</label
        ><input
          id="confirmation"
          v-model="confirmation"
          type="password"
          autocomplete="new-password"
          required
      /></template>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button type="submit" class="primary-button auth-submit">
        {{ mode === "login" ? "Tiếp tục hành trình" : "Tạo tài khoản mẫu" }} →
      </button>
    </form>
    <div class="auth-divider"><span>khám phá không cần tài khoản</span></div>
    <button class="guest-button" @click="emit('enter', 'Đạo hữu')">
      Trải nghiệm với nhân vật mẫu ↗
    </button>
    <p class="demo-note">
      Không xác minh Gmail, không lưu hay gửi mật khẩu.<br />Tạo nhân vật ở bước
      tiếp theo.
    </p>
  </section>
</template>
