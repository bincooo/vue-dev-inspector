<template>
  <footer class="footer">
    <p class="footer-text">© {{ copyright }} MyApp. All rights reserved.</p>
    <div class="footer-links">
      <a href="#" class="footer-link">隐私政策</a>
      <a href="#" class="footer-link">服务条款</a>
    </div>
  </footer>
</template>

<script setup>
defineProps({
  copyright: { type: String, default: "2024" },
});
</script>
