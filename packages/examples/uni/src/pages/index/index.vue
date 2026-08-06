<template>
  <view class="page">
    <u-navbar title="采购申请" back-text="返回" />
    <view class="steps-bar"
      ><view class="step-item" :class="{ active: currentStep >= 0 }"
        ><view class="step-num">1</view
        ><text class="step-label">填写申请</text></view
      ><view class="step-line" :class="{ active: currentStep >= 1 }" /><view
        class="step-item"
        :class="{ active: currentStep >= 1 }"
        ><view class="step-num">2</view
        ><text class="step-label">部门审批</text></view
      ><view class="step-line" :class="{ active: currentStep >= 2 }" /><view
        class="step-item"
        :class="{ active: currentStep >= 2 }"
        ><view class="step-num">3</view
        ><text class="step-label">财务审核</text></view
      ><view class="step-line" :class="{ active: currentStep >= 3 }" /><view
        class="step-item"
        :class="{ active: currentStep >= 3 }"
        ><view class="step-num">4</view
        ><text class="step-label">完成</text></view
      ></view
    >
    <u-form
      ref="purchaseForm"
      :model="form"
      :rules="rules"
      label-position="top"
      label-width="160"
      ><u-form-item label="申请人" prop="applicant" required
        ><u-input
          v-model="form.applicant"
          placeholder="请输入申请人姓名" /></u-form-item
      ><u-form-item label="所在部门" prop="department" required
        ><u-input
          v-model="form.department"
          placeholder="请输入部门名称" /></u-form-item
      ><u-form-item
        label="采购类型"
        prop="purchaseType"
        required
        right-icon="arrow-right"
        ><u-input
          v-model="purchaseTypeLabel"
          placeholder="请选择采购类型"
          readonly
          @click="showPurchaseTypeSelect = true" /><u-select
          v-model="showPurchaseTypeSelect"
          :list="purchaseTypeList"
          @confirm="onPurchaseTypeConfirm" /></u-form-item
      ><u-form-item label="物品名称" prop="itemName" required
        ><u-input
          v-model="form.itemName"
          placeholder="请输入采购物品名称" /></u-form-item
      ><u-form-item label="数量"
        ><view class="qty-box"
          ><view
            class="qty-btn"
            :class="{ disabled: form.quantity <= 1 }"
            @click="changeQty(-1)"
            >-</view
          ><input
            v-model="form.quantity"
            class="qty-input"
            type="number"
          /><view class="qty-btn" @click="changeQty(1)">+</view></view
        ></u-form-item
      ><u-form-item label="预计单价(元)" prop="unitPrice" required
        ><u-input
          v-model="form.unitPrice"
          type="number"
          placeholder="请输入预计单价"
      /></u-form-item>
      <u-form-item label="预计总金额(元)"
        ><u-input v-model="totalAmount" disabled /></u-form-item
      ><u-form-item
        label="期望采购日期"
        prop="expectedDate"
        required
        right-icon="arrow-right"
        ><u-input
          v-model="form.expectedDate"
          placeholder="请选择日期"
          readonly
          @click="showCalendar = true" /><u-calendar
          v-model="showCalendar"
          mode="date"
          :max-date="maxDate"
          @change="onDateChange" /></u-form-item
      ><u-form-item label="供应商" prop="supplier"
        ><u-input
          v-model="form.supplier"
          placeholder="请输入供应商名称（选填）" /></u-form-item
      ><u-form-item label="采购事由及备注" prop="remark"
        ><u-textarea
          v-model="form.remark"
          placeholder="请输入采购事由及备注说明"
          maxlength="200" /></u-form-item
      ><u-form-item label="附件"
        ><u-upload :action="uploadAction" max-count="3" /></u-form-item
    ></u-form>
    <view class="action-bar"
      ><u-button type="default" :hair-line="false" @click="onSaveDraft"
        >暂存草稿</u-button
      ><u-button type="primary" :loading="submitting" @click="onSubmit"
        >提交申请</u-button
      ></view
    >
    <u-toast ref="uToast" />
  </view>
</template>

<script>
export default {
  data() {
    return {
      currentStep: 0,
      submitting: false,
      showCalendar: false,
      showPurchaseTypeSelect: false,
      uploadAction: "",
      form: {
        applicant: "",
        department: "",
        purchaseType: "",
        itemName: "",
        quantity: 1,
        unitPrice: "",
        expectedDate: "",
        supplier: "",
        remark: "",
      },
      purchaseTypeList: [
        { value: "office", label: "办公用品" },
        { value: "equipment", label: "设备资产" },
        { value: "service", label: "技术服务" },
        { value: "other", label: "其他" },
      ],
      rules: {
        applicant: [
          { required: true, message: "请输入申请人姓名", trigger: "blur" },
        ],
        department: [
          { required: true, message: "请输入部门名称", trigger: "blur" },
        ],
        purchaseType: [
          { required: true, message: "请选择采购类型", trigger: "change" },
        ],
        itemName: [
          { required: true, message: "请输入采购物品名称", trigger: "blur" },
        ],
        unitPrice: [
          { required: true, message: "请输入预计单价", trigger: "blur" },
        ],
        expectedDate: [
          { required: true, message: "请选择期望采购日期", trigger: "change" },
        ],
      },
    };
  },
  computed: {
    totalAmount() {
      const qty = Number(this.form.quantity) || 0;
      const price = Number(this.form.unitPrice) || 0;
      return (qty * price).toFixed(2);
    },
    maxDate() {
      const d = new Date();
      d.setDate(d.getDate() + 90);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    },
    purchaseTypeLabel() {
      const item = this.purchaseTypeList.find(
        (i) => i.value === this.form.purchaseType,
      );
      return item ? item.label : "";
    },
  },
  methods: {
    changeQty(delta) {
      const val = Number(this.form.quantity) + delta;
      if (val < 1) return;
      this.form.quantity = val;
    },
    onPurchaseTypeConfirm(e) {
      if (e[0]) {
        this.form.purchaseType = e[0].value;
      }
    },
    onDateChange(e) {
      this.form.expectedDate = e.result;
      this.showCalendar = false;
    },
    onSaveDraft() {
      this.$refs.uToast.show({ title: "草稿已保存", type: "success" });
    },
    onSubmit() {
      this.$refs.purchaseForm.validate((valid) => {
        if (!valid) return;
        this.submitting = true;
        // eslint-disable-next-line no-undef
        setTimeout(() => {
          this.submitting = false;
          this.currentStep = 1;
          this.$refs.uToast.show({ title: "申请提交成功", type: "success" });
        }, 1500);
      });
    },
  },
};
</script>

<style scoped>
.page {
  background: #f5f6f8;
  padding-bottom: 180rpx;
}
.steps-bar {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 32rpx 24rpx;
  margin-bottom: 16rpx;
  position: sticky;
  top: 156rpx;
  z-index: 100;
}
.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}
.step-num {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #dcdfe6;
  color: #fff;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.step-item.active .step-num {
  background: #2979ff;
}
.step-label {
  font-size: 22rpx;
  color: #909399;
  margin-top: 8rpx;
}
.step-item.active .step-label {
  color: #2979ff;
}
.step-line {
  flex: 1;
  height: 4rpx;
  background: #dcdfe6;
  margin: 0 8rpx;
  position: relative;
  top: -16rpx;
}
.step-line.active {
  background: #2979ff;
}
::v-deep .u-form {
  background: #fff;
  padding: 24rpx 32rpx;
  border-radius: 16rpx;
  margin: 0 24rpx 24rpx;
}
.qty-box {
  display: flex;
  align-items: center;
}
.qty-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f2f3f5;
  border-radius: 8rpx;
  font-size: 32rpx;
  color: #323233;
  cursor: pointer;
}
.qty-btn.disabled {
  color: #c8c9cc;
  cursor: not-allowed;
}
.qty-input {
  width: 80rpx;
  height: 60rpx;
  text-align: center;
  margin: 0 12rpx;
  background: #f2f3f5;
  border-radius: 8rpx;
  font-size: 28rpx;
}
.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  padding: 16rpx 32rpx;
  background: #fff;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
  gap: 24rpx;
}
.action-bar .u-button {
  flex: 1;
}
</style>
