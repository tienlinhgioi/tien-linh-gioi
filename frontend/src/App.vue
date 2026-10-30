<script setup lang="ts">
import { ref } from "vue";
import AuthPanel from "./components/AuthPanel.vue";
import ImmortalScene from "./components/ImmortalScene.vue";
import GameWorld from "./components/GameWorld.vue";
const player = ref("");
</script>

<template>
  <GameWorld v-if="player" :name="player" @logout="player = ''" />
  <div v-else class="auth-shell">
    <header class="auth-topbar">
      <a class="brand" href="#"
        ><span class="brand-mark">仙</span
        ><span>Tiên Linh Giới<small>MỘT CHỐN AN NHIÊN</small></span></a
      ><span class="topbar-motto">Nhất niệm thanh tịnh · Vạn sự an nhiên</span>
    </header>
    <main class="auth-page">
      <ImmortalScene />
      <div class="auth-landscape-copy">
        <div class="section-eyebrow">CHÀO MỪNG ĐẠO HỮU ĐẾN VỚI</div>
        <h2>Tiên Linh Giới</h2>
        <p>Một chốn an nhiên.<br />Một hành trình bất tận.</p>
        <div class="vertical-poem">Giữa mây ngàn, tìm một thoáng bình yên.</div>
      </div>
      <AuthPanel @enter="player = $event" />
      <div class="auth-footer">
        TIÊN LINH GIỚI <span>✦</span> PHIÊN BẢN TRẢI NGHIỆM
      </div>
    </main>
  </div>
</template>
