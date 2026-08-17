<template>
  <section class="hero" :style="{ height }">
    <h1 class="hero-title">欢迎使用 - 页面设计器</h1>
    <p class="hero-desc">基于 Vue 3 的现代化应用框架</p>
    <p class="hero-desc">点击右下角齿轮按钮或使用快捷键 Shift + Alt + I开启编辑模式</p>
  </section>
</template>

<script setup>
defineProps({
  height: { type: String, default: '300px' },
});
</script>
