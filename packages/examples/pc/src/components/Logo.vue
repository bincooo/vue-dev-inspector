<template>
  <a :href="href" class="logo">
    <span class="logo-icon">🚀</span>
    <span class="logo-text">页面设计器</span>
  </a>
</template>

<script setup>
defineProps({
  size: { type: String, default: 'medium' },
  href: { type: String, default: '/' },
});
</script>
