<template>
  <view class="page">
    <view class="form-container">
      <view class="form-content">
        <u-form ref="form" :model="formData" :rules="rules">
          <u-form-item label="申请人" label-position="top" prop="applicant" required>
            <u-input v-model="formData.applicant" placeholder="请输入申请人姓名" />
          </u-form-item>
          <u-form-item label="部门" label-position="top" prop="department" required>
            <u-input v-model="formData.department" placeholder="请输入所属部门" />
          </u-form-item>
          <u-form-item label="申请日期" label-position="top" prop="applyDate" required>
            <view class="picker-input" @click="showDatePicker = true">
              <text :class="{'placeholder': !formData.applyDate}">{{ formData.applyDate || '请选择申请日期' }}</text>
              <u-icon name="arrow-right" color="#999" />
            </view>
            <u-picker v-model="showDatePicker" mode="time" :params="dateParams" @confirm="onDateConfirm" />
          </u-form-item>
          <u-form-item label="预算类别" label-position="top" prop="category" required>
            <view class="picker-input" @click="showCategoryPicker = true">
              <text :class="{'placeholder': !formData.category}">{{ formData.category || '请选择预算类别' }}</text>
              <u-icon name="arrow-right" color="#999" />
            </view>
            <u-select v-model="showCategoryPicker" :list="categoryList" @confirm="onCategoryConfirm" />
          </u-form-item>
          <u-form-item label="预算金额" label-position="top" prop="amount">
            <u-input v-model="formData.amount" type="number" placeholder="请输入预算金额" />
          </u-form-item>
          <u-form-item label="预算用途" label-position="top" prop="purpose">
            <u-textarea v-model="formData.purpose" placeholder="请详细说明预算用途" :border="false" />
          </u-form-item>
        </u-form>
      </view>
      <view class="form-footer">
        <u-button type="primary" @click="handleSubmit">提交申请</u-button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      showDatePicker: false,
      showCategoryPicker: false,
      dateParams: {
        year: true,
        month: true,
        day: true,
        hour: false,
        minute: false,
        second: false
      },
      categoryList: [
        { value: '1', label: '办公用品' },
        { value: '2', label: '设备采购' },
        { value: '3', label: '差旅费用' },
        { value: '4', label: '培训费用' },
        { value: '5', label: '其他' }
      ],
      rules: {
        applicant: [{ required: true, message: '请输入申请人姓名', trigger: 'blur' }],
        department: [{ required: true, message: '请输入所属部门', trigger: 'blur' }],
        applyDate: [{ required: true, message: '请选择申请日期', trigger: 'change' }],
        category: [{ required: true, message: '请选择预算类别', trigger: 'change' }]
      },
      formData: {
        applicant: '',
        department: '',
        applyDate: '',
        category: '',
        amount: '',
        purpose: ''
      }
    }
  },
  methods: {
    onDateConfirm(e) {
      this.formData.applyDate = `${e.year}-${e.month}-${e.day}`
    },
    onCategoryConfirm(e) {
      this.formData.category = e[0].label
    },
    handleSubmit() {
      this.$refs.form.validate().then(res => {
        if (res) {
          uni.showToast({
            title: '提交成功',
            icon: 'success'
          })
        }
      })
    }
  }
}
</script>

<style scoped>
.page {
  background: #f5f5f5;
  padding-bottom: 180rpx;
}
.form-container {
  background: #fff;
}
.form-header {
  padding: 40rpx 32rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.form-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  text-align: center;
}
.form-content {
  padding: 32rpx;
}
:deep(.u-form-item) {
  margin-bottom: 32rpx;
}
:deep(.u-form-item__body__left__label) {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  margin-bottom: 12rpx;
}
.picker-input {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 70rpx;
  width: 100%;
  font-size: 28rpx;
  color: #333;
}
.placeholder {
  color: #c0c4cc;
}
.form-footer {
  position: fixed;
  z-index: 99;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 32rpx;
  background: #fff;
  border-top: 1rpx solid #eee;
}
</style>
