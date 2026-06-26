<template>
  <section class="antd-test">
    <div class="antd-test-title">Ant Design Vue (antdv-next) 组件测试</div>

    <!-- 按钮组合 -->
    <a-space wrap>
      <a-button type="primary" @click="onClick('primary')">Primary</a-button>
      <a-button>Default</a-button>
      <a-button type="dashed">Dashed</a-button>
      <a-button type="text">Text</a-button>
      <a-button type="link">Link</a-button>
      <a-button danger>Danger</a-button>
    </a-space>

    <!-- 标签 / 分割线 -->
    <a-divider style="margin: 16px 0" />
    <a-space wrap>
      <a-tag color="success" v-if="visible">success</a-tag>
      <a-tag color="processing">processing</a-tag>
      <a-tag color="error">error</a-tag>
      <a-tag color="warning">warning</a-tag>
      <a-tag color="default">default</a-tag>
    </a-space>

    <!-- 输入与选择 -->
    <a-divider style="margin: 16px 0" />
        <a-space direction="vertical" style="width: 320px">
      <a-input v-model:value="text" placeholder="请输入文本" />
      <a-input-password v-model:value="pwd" placeholder="密码输入框" />
      <a-select
        v-model:value="selected"
        style="width: 100%"
        :options="options"
        placeholder="请选择"
      />
      <a-date-picker style="width: 100%" />
    </a-space>

    <!-- 开关 / 单选 / 多选 -->
    <a-divider style="margin: 16px 0" />
    <a-space wrap>
      <a-switch v-model:checked="checked" />
      <a-checkbox v-model:checked="checked">同步勾选</a-checkbox>
      <a-radio-group v-model:value="radio">
        <a-radio value="a">A</a-radio>
        <a-radio value="b">B</a-radio>
        <a-radio value="c">C</a-radio>
      </a-radio-group>
    </a-space>

    <!-- 卡片 -->
    <a-divider style="margin: 16px 0" />
    <a-card title="Antd 卡片" style="width: 320px">
      <p>这是一个 antdv-next 的卡片组件，用于验证组件库与 vue-dev-inspector 的兼容性。</p>
      <template #extra>
        <a-button type="link" size="small">更多</a-button>
      </template>
    </a-card>

    <!-- Alert 提示 -->
    <a-divider style="margin: 16px 0" />
    <a-space direction="vertical" style="width: 100%">
      <a-alert message="Success 提示" type="success" show-icon />
      <a-alert message="Info 提示" type="info" show-icon />
      <a-alert message="Warning 提示" type="warning" show-icon />
      <a-alert message="Error 提示" type="error" show-icon />
    </a-space>

    <a-divider />
    <a-typography-text type="secondary">
      最后点击事件：{{ lastClick || '（无）' }}
    </a-typography-text>
  </section>
</template>

<script setup>
import { ref } from 'vue'

const text = ref('')
const pwd = ref('')
const selected = ref()
const checked = ref(true)
const radio = ref('a')
const lastClick = ref('')
const visible = ref(true);

const options = [
  { value: 'vue', label: 'Vue' },
  { value: 'antd', label: 'Ant Design Vue' },
  { value: 'inspector', label: 'Dev Inspector' },
]

function onClick(name) {
  lastClick.value = name
}
</script>

<style scoped>
.antd-test {
  margin-top: 24px;
  padding: 24px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}
.antd-test-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 16px;
}
</style>
