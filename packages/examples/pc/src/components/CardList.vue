<template>
  <div
    class="card-list"
    :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)`, gap }"
  >
    <slot />
  </div>
</template>

<script setup>
defineProps({
  columns: { type: [String, Number], default: 3 },
  gap: { type: String, default: "16px" },
});
</script>
