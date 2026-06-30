<template>
  <div id="app" class="app-container">
    <Header fixed theme="light" />
    <main class="content">
      <Hero height="200px" />
      <CardList columns="3" gap="12px">
        <Card title="功能一" icon="📦" shadow="hover" />
        <Card title="功能二" icon="⚡" shadow="hover" />
        <Card title="功能三" icon="🎯" shadow="hover" />
      </CardList>
      <AntdTest />
    </main>
    <Footer copyright="2024" />
  </div>
</template>

<script setup>
import "./style.css";
import Header from "./components/Header.vue";
import Hero from "./components/Hero.vue";
import CardList from "./components/CardList.vue";
import Card from "./components/Card.vue";
import Footer from "./components/Footer.vue";
import AntdTest from "./components/AntdTest.vue";
import "./inspector-demo.ts";
</script>
