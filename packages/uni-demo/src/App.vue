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