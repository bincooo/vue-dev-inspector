<template>
  <view class="hello">
    <text>{{ msg }}</text>
    <button @click="msg = 'clicked'">click me</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
const msg = ref("Hello uni-app + dev-inspector");
</script>

<style lang="scss">
/* uview-pro 基础样式（组件公共类、reset） */
@import "uview-pro/index.scss";
</style>
