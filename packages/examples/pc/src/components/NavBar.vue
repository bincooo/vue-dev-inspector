<template>
  <nav class="navbar" :class="mode">
    <a
      v-for="(item, idx) in items"
      :key="idx"
      :href="item.href"
      class="nav-link"
    >
      {{ item.label }}</a
    >
  </nav>
</template>

<script setup>
defineProps({
  mode: { type: String, default: "horizontal" },
  items: { type: Array, default: () => [] },
});
</script>
