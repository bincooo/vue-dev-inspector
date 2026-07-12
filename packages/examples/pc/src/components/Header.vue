<template>
  <header class="header">
    <Logo size="large" href="/" />
    <NavBar mode="horizontal" :items="navItems" />
  </header>
</template>

<script setup>
import Logo from "./Logo.vue";
import NavBar from "./NavBar.vue";

defineProps({
  fixed: Boolean,
  theme: { type: String, default: "light" },
});

const navItems = ["首页", "关于", "文档", "博客"];
</script>
