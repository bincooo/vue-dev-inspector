<template>
  <nav class="navbar" :class="mode">
    <a v-for="item in items" :key="item" href="#" class="nav-link">
      {{ item }}
    </a>
  </nav>
</template>

<script setup>
defineProps({
  mode: { type: String, default: 'horizontal' },
  items: { type: Array, default: () => [] },
})
</script>
