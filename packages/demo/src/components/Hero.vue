<template>
  <section class="hero" :style="{ height }">
    <h1 class="hero-title">欢迎使用 MyApp</h1>
    <p class="hero-desc">基于 Vue 3 的现代化应用框架</p>
  </section>
</template>

<script setup>
defineProps({
  height: { type: String, default: '300px' },
})

function onClick() {
  alert('click');
}
</script>
