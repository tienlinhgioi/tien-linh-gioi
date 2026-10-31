<script setup lang="ts">
import { ref, defineAsyncComponent } from "vue";
import TitleScreen from "./components/TitleScreen.vue";
import CharacterCreation from "./components/CharacterCreation.vue";
import AuthPanel from "./components/AuthPanel.vue";
import ImmortalScene from "./components/ImmortalScene.vue";
import GameWorld from "./components/GameWorld.vue";
const OnlineWorld = defineAsyncComponent(
  () => import("./components/OnlineWorld.vue"),
);
import { gameClient, DEFAULT_BACKEND_URL } from "./network/client";
import type { CharacterProfile } from "./data/sects";
const screen = ref<"title" | "auth" | "create" | "demo" | "online">("title");
const online = ref(false),
  busy = ref(false),
  error = ref("");
let configured = DEFAULT_BACKEND_URL;
try {
  configured = configured || localStorage.getItem("tlg-backend-url") || "";
} catch {
  /* Storage optional. */
}
const endpoint = ref(configured);
const character = ref<CharacterProfile>({
  name: "Thanh Vân",
  element: "thuy",
  sect: "Hàn Nguyệt Cung",
  avatar: 1,
});
async function authenticate(
  mode: "login" | "register",
  credentials: {
    account: string;
    email: string;
    username: string;
    password: string;
  },
  address: string,
) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await gameClient.authenticate(
      mode,
      mode === "login"
        ? { account: credentials.account, password: credentials.password }
        : {
            email: credentials.email,
            username: credentials.username,
            password: credentials.password,
          },
      address,
    );
    endpoint.value = address;
    try {
      localStorage.setItem("tlg-backend-url", address);
    } catch {
      /* optional */
    }
    online.value = true;
    if (gameClient.state.character) {
      const c = gameClient.state.character;
      try {
        const saved = JSON.parse(
          localStorage.getItem(`tlg-look-${c.id}`) || "null",
        );
        if (saved) character.value = saved;
      } catch {
        /* invalid saved cosmetics */
      }
      character.value = { ...character.value, name: c.name };
      screen.value = "online";
    } else screen.value = "create";
  } catch (e) {
    error.value =
      e instanceof TypeError
        ? "Không kết nối được máy chủ. Kiểm tra URL HTTPS và cấu hình CORS."
        : e instanceof Error
          ? e.message
          : "Không thể kết nối máy chủ.";
  } finally {
    busy.value = false;
  }
}
async function create(profile: CharacterProfile) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    if (online.value) {
      const c = await gameClient.createCharacter(profile.name);
      if (!c) throw Error("Chưa tạo được nhân vật.");
      try {
        localStorage.setItem(`tlg-look-${c.id}`, JSON.stringify(profile));
      } catch {
        /* optional */
      }
      screen.value = "online";
    } else screen.value = "demo";
    character.value = profile;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
function demo() {
  online.value = false;
  error.value = "";
  screen.value = "create";
}
function logout() {
  gameClient.logout();
  online.value = false;
  error.value = "";
  screen.value = "title";
}
</script>
<template>
  <TitleScreen
    v-if="screen === 'title'"
    @start="screen = 'auth'"
    @login="screen = 'auth'"
  />
  <div v-else-if="screen === 'auth'" class="auth-shell">
    <header class="auth-topbar">
      <button class="brand" :disabled="busy" @click="screen = 'title'">
        <span class="brand-mark">仙</span
        ><span
          >Tiên Linh Giới<small>← TRỞ VỀ MÀN KHỞI ĐỘNG</small></span
        ></button
      ><span class="topbar-motto">Nhất niệm thanh tịnh · Vạn sự an nhiên</span>
    </header>
    <main class="auth-page">
      <ImmortalScene />
      <div class="auth-landscape-copy">
        <h2>Tiên Linh Giới</h2>
        <p>Một chốn an nhiên.<br />Một hành trình bất tận.</p>
      </div>
      <AuthPanel
        :busy="busy"
        :server-error="error"
        :endpoint="endpoint"
        @authenticate="authenticate"
        @enter="demo"
      />
    </main>
  </div>
  <CharacterCreation
    v-else-if="screen === 'create'"
    :busy="busy"
    :server-error="error"
    :online="online"
    @back="
      screen = 'auth';
      error = '';
    "
    @create="create"
  /><OnlineWorld
    v-else-if="screen === 'online'"
    :profile="character"
    @logout="logout"
  /><GameWorld
    v-else
    :name="character.name"
    :profile="character"
    @logout="logout"
  />
</template>
