<template>
  <a :href="href" class="logo">
    <span class="logo-icon">🚀</span>
    <span class="logo-text">MyApp</span>
  </a>
</template>

<script setup>
defineProps({
  size: { type: String, default: 'medium' },
  href: { type: String, default: '/' },
})
</script>
