<script setup lang="ts">
import { onMounted, ref } from "vue";
defineProps<{ title: string }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
onMounted(() => dialog.value?.showModal());
function backdrop(event: MouseEvent) {
  if (event.target !== dialog.value) return;
  const rect = dialog.value.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    emit("close");
}
</script>
<template>
  <dialog
    ref="dialog"
    class="modal panel"
    :aria-label="title"
    @cancel.prevent="emit('close')"
    @click="backdrop"
  >
    <button
      class="modal-close"
      aria-label="Đóng"
      autofocus
      @click="emit('close')"
    >
      ×
    </button>
    <span class="section-eyebrow">TIÊN LINH GIỚI</span>
    <h2>{{ title }}</h2>
    <slot />
  </dialog>
</template>
