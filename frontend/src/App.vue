<script setup lang="ts">
import { ref } from "vue";
import TitleScreen from "./components/TitleScreen.vue";
import CharacterCreation from "./components/CharacterCreation.vue";
import AuthPanel from "./components/AuthPanel.vue";
import ImmortalScene from "./components/ImmortalScene.vue";
import GameWorld from "./components/GameWorld.vue";
import type { CharacterProfile } from "./data/sects";
const screen = ref<"title" | "auth" | "create" | "game">("title");
const character = ref<CharacterProfile>({
  name: "Thanh Vân",
  element: "thuy",
  sect: "Hàn Nguyệt Cung",
  avatar: 1,
});
function create(profile: CharacterProfile) {
  character.value = profile;
  screen.value = "game";
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
      <button class="brand" @click="screen = 'title'">
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
      <AuthPanel @enter="screen = 'create'" />
    </main>
  </div>
  <CharacterCreation
    v-else-if="screen === 'create'"
    @back="screen = 'auth'"
    @create="create"
  /><GameWorld
    v-else
    :name="character.name"
    :profile="character"
    @logout="screen = 'title'"
  />
</template>
