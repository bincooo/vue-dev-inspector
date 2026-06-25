<template>
  <div class="card" :class="[shadow && `shadow-${shadow}`]">
    <div class="card-icon" title="测试">{{ icon }}</div>
    <h3 class="card-title">{{ title }}</h3>
      </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  icon: { type: String, default: '📦' },
  shadow: { type: String, default: 'none' },
  desc: { type: String, default: '' },
})
</script>
