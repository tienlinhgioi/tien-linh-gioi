<script setup lang="ts">
import type { ElementId } from "../data/sects";
defineProps<{ element: ElementId }>();
const paths: Record<ElementId, string> = {
  kim: "M12 3 17 11 12 21 7 11Z M12 3V21 M7 11H17",
  moc: "M12 21V10 M12 14C2 14 3 5 3 5S12 4 12 14 M12 10C12 2 21 3 21 3S22 12 12 12",
  thuy: "M12 3C10 8 5 11 5 15A7 7 0 0 0 19 15C19 11 14 7 12 3Z M8 15Q8 19 12 19",
  hoa: "M12 2C15 8 8 9 13 13C16 13 17 9 17 9C24 20 12 25 6 19C2 15 6 10 8 8C7 13 11 14 10 9Z",
  tho: "M2 19 9 6 14 14 17 10 22 19Z M4 22H20 M9 6 11 14 7 14",
};
</script>
<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[element]" />
  </svg>
</template>
