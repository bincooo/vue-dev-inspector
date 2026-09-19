<template>
  <section class="antd-test">
    <div class="antd-test-title">Ant Design Vue (antdv-next) 组件测试</div>

    <!-- 按钮组合 -->
    <a-space wrap>
      <a-button
        v-access:code="test"
        v-bind="gridOptions"
        type="primary"
        v-on="gridEvents"
        @click="onClick('primary')"
      >
        Primary
      </a-button>
      <a-button @click="onClick('default')">Default</a-button>
      <a-button type="dashed" @click="onClick('dashed')">Dashed</a-button>
      <a-button type="text" @click="onClick('text')">Text</a-button>
      <a-button type="link" disabled @click="onClick('link')">Link</a-button>
      <a-button danger @click="onClick('danger')">Danger</a-button>
      <a-button @click="showModal">Open Modal</a-button>
      <a-button @click="showDrawer">Open Drawer</a-button>
    </a-space>

    <a-modal v-model:open="openM" @cancel="openM = false">
      <template #title>
        <p>Loading Modal</p>
      </template>
      <p>Some contents...</p>
      <p>Some contents...</p>
      <p>Some contents...</p>
    </a-modal>

    <a-drawer v-model:open="openD" title="销售订单" :width="width" :resizable="{ onResize }">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="订单编号">
              <a-input v-model:value="order.orderNo" placeholder="请输入订单编号"/>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="客户名称">
              <a-input
                v-model:value="order.customerName"
                placeholder="请输入客户名称"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="下单日期">
              <a-date-picker
                v-model:value="order.orderDate"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="订单状态">
              <a-select
                v-model:value="order.status"
                :options="orderStatusOptions"
                placeholder="请选择状态"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注">
              <a-textarea placeholder="请输入备注" :rows="4"/>
</a-form-item>
          </a-col>
        </a-row>

        <a-divider style="margin: 12px 0" plain>订单明细</a-divider>

        <a-table
          :columns="detailColumns"
          :data-source="order.items"
          :pagination="false"
          size="small"
          row-key="key"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <a-input v-model:value="record.name" placeholder="商品名称" />
            </template>
            <template v-else-if="column.key === 'price'">
              <a-input-number
                v-model:value="record.price"
                :min="0"
                :precision="2"
                style="width: 100%"
              />
            </template>
            <template v-else-if="column.key === 'qty'">
              <a-input-number
                v-model:value="record.qty"
                :min="0"
                :precision="0"
                style="width: 100%"
              />
            </template>
            <template v-else-if="column.key === 'amount'">
              {{ (Number(record.price) * Number(record.qty)).toFixed(2) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button
                type="link"
                size="small"
                @click="removeItem(record.key)"
              >
                删除
              </a-button>
            </template>
          </template>
        </a-table>

        <a-button type="dashed" block style="margin-top: 8px;" @click="addItem">
          + 添加明细行
        </a-button>
      </a-form>

      <div class="order-drawer-footer">
        <a-space>
          <a-button @click="onCloseDrawer">取消</a-button>
          <a-button type="primary" @click="onSubmitOrder">保存订单</a-button>
        </a-space>
      </div>
    </a-drawer>

    <!-- 标签 / 分割线 -->
    <a-divider style="margin: 16px 0" plain title-placement="start">
      事件同步
    </a-divider>
    <a-typography-text type="secondary">
      最后点击事件：{{ lastClick || '（无）' }}
    </a-typography-text>
    <a-divider style="margin: 16px 0" plain title-placement="start">
      标签组件
    </a-divider>
    <a-space wrap>
      <a-tag v-if="visible" color="success">success</a-tag>
      <a-tag color="processing">processing</a-tag>
      <a-tag color="error">error</a-tag>
      <a-tag color="warning">warning</a-tag>
      <a-tag color="default">default</a-tag>
    </a-space>

    <!-- 输入与选择 -->
    <a-divider plain title-placement="start">表单控件</a-divider>
    <a-space direction="vertical" style="width: 320px">
      <a-input v-model:value="text" placeholder="请输入文本" />
      <a-input-password v-model:value="pwd" placeholder="密码输入框" />
      <a-select
        v-model="selected"
        style="width: 100%"
        :options="options"
        placeholder="请选择选项"
      />
      <a-date-picker style="width: 100%" placeholder="请输入日期" />
      <a-carousel autoplay></a-carousel>
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
    <a-divider style="margin: 16px 0" plain title-placement="start">
      卡片面板
    </a-divider>
    <a-card title="Antd 卡片" style="width: 320px">
      <template #extra>
        <a href="#">More</a>
      </template>
      <p>
        这是一个 antdv-next 的卡片组件，用于验证组件库与 vue-dev-inspector
        的兼容性。
      </p>
      <a-space :style="{ width: '100%', justifyContent: 'flex-end' }">
        <a-button>取消</a-button>
        <a-button type="primary">确认</a-button>
      </a-space>
    </a-card>

    <a-carousel autoplay style="margin-top: 5px">
      <div>
        <h3
          style="
            color: #fff;
            text-align: center;
            background: #364d79;
            height: 160px;
            margin: 0;
            line-height: 160px;
          "
        >
          1
        </h3>
      </div>
      <div>
        <h3
          style="
            color: #fff;
            text-align: center;
            background: #364d79;
            height: 160px;
            margin: 0;
            line-height: 160px;
          "
        >
          2
        </h3>
      </div>
      <div>
        <h3
          style="
            color: #fff;
            text-align: center;
            background: #364d79;
            height: 160px;
            margin: 0;
            line-height: 160px;
          "
        >
          3
        </h3>
      </div>
      <div>
        <h3
          style="
            color: #fff;
            text-align: center;
            background: #364d79;
            height: 160px;
            margin: 0;
            line-height: 160px;
          "
        >
          4
        </h3>
      </div>
    </a-carousel>

    <!-- Alert 提示 -->
    <a-divider style="margin: 16px 0" plain title-placement="start">
      提示组件
    </a-divider>
    <a-space direction="vertical" style="width: 100%">
      <a-alert message="Success 提示" type="success" show-icon />
      <a-alert message="Info 提示" type="info" show-icon />
      <a-alert message="Warning 提示" type="warning" show-icon />
      <a-alert message="Error 提示" type="error" show-icon />
    </a-space>
  </section>
</template>

<script setup>
import { ref, shallowRef, reactive } from 'vue';

const text = ref('');
const pwd = ref('');
const selected = ref();
const checked = ref(true);
const radio = ref('a');
const lastClick = ref('');
const visible = ref(true);

const options = [
  { value: 'vue', label: 'Vue' },
  { value: 'antd', label: 'Ant Design Vue' },
  { value: 'inspector', label: 'Dev Inspector' },
];

function onClick(name) {
  lastClick.value = name;
}

const openD = shallowRef(false);
function showDrawer() {
  openD.value = true;
}
const openM = shallowRef(false);
function showModal() {
  openM.value = true;
}

const width = ref(600);
function onResize(w) {
  width.value = w > 600 ? w : 600;
}

// ---- 销售订单表单 ----
const orderStatusOptions = [
  { value: 'pending', label: '待处理' },
  { value: 'confirmed', label: '已确认' },
  { value: 'shipped', label: '已发货' },
  { value: 'done', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

const detailColumns = [
  { title: '商品名称', dataIndex: 'name', key: 'name' },
  { title: '单价', dataIndex: 'price', key: 'price' },
  { title: '数量', dataIndex: 'qty', key: 'qty' },
  { title: '金额', dataIndex: 'amount', key: 'amount' },
  { title: '操作', dataIndex: 'action', key: 'action' },
];

const order = reactive({
  orderNo: '',
  customerName: '',
  orderDate: undefined,
  status: 'pending',
  remark: '',
  items: [{ key: 1, name: '示例商品', price: 0, qty: 1 }],
});

function addItem() {
  order.items.push({ key: Date.now(), name: '', price: 0, qty: 1 });
}

function removeItem(key) {
  const idx = order.items.findIndex((it) => it.key === key);
  if (idx > -1) order.items.splice(idx, 1);
}

function onSubmitOrder() {
  openD.value = false;
}

function onCloseDrawer() {
  openD.value = false;
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
.order-drawer-footer {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 10px 16px;
  border-top: 1px solid #e2e8f0;
  background: white;
  text-align: right;
  z-index: 10;
}
</style>
