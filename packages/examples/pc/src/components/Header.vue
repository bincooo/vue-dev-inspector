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

const navItems = [
  { label: "首页", href: "https://github.com/bincooo/vue-dev-inspector" },
  { label: "文档", href: "https://bincooo.github.io/vue-dev-inspector" },
  { label: "关于", href: "#" },
  { label: "博客", href: "#" },
];
</script>
