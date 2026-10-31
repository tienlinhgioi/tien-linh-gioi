<script setup lang="ts">
import { ref } from "vue";
const props = defineProps<{
  busy?: boolean;
  serverError?: string;
  endpoint?: string;
}>();
const emit = defineEmits<{
  enter: [name: string];
  authenticate: [
    mode: "login" | "register",
    credentials: {
      account: string;
      email: string;
      username: string;
      password: string;
    },
    endpoint: string,
  ];
}>();
const backend = ref(props.endpoint || "");
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
    "authenticate",
    mode.value,
    {
      account: account.value.trim(),
      email: email.value.trim(),
      username: username.value,
      password: password.value,
    },
    backend.value.trim(),
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
    <p class="auth-intro">
      Đăng nhập máy chủ để lưu nhân vật và chơi cùng đạo hữu.
    </p>
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
      <label for="backend-url">Địa chỉ máy chủ</label
      ><input
        id="backend-url"
        v-model="backend"
        type="url"
        required
        placeholder="https://may-chu-cua-ban.example"
        :disabled="busy"
      /><small class="server-hint"
        >URL backend do chủ dự án cung cấp. Không nhập mật khẩu database.</small
      >
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
      <p v-if="error || serverError" class="form-error" role="alert">
        {{ error || serverError }}
      </p>
      <button type="submit" class="primary-button auth-submit" :disabled="busy">
        {{
          busy
            ? "Đang kết nối…"
            : mode === "login"
              ? "Tiếp tục hành trình"
              : "Tạo tài khoản"
        }}
        →
      </button>
    </form>
    <div class="auth-divider"><span>khám phá không cần tài khoản</span></div>
    <button
      class="guest-button"
      :disabled="busy"
      @click="emit('enter', 'Đạo hữu')"
    >
      Trải nghiệm với nhân vật mẫu ↗
    </button>
    <p class="demo-note">
      Đăng nhập thật gửi thông tin qua HTTPS đến máy chủ đã chọn.<br />Chế độ
      trải nghiệm phía trên dùng dữ liệu mẫu, không kết nối server.
    </p>
  </section>
</template>
