import mongoose from 'mongoose';

const scenarioSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    trim: true
  },
  description: String,
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scenario',
    default: null
  },
  level: {
    type: Number,
    min: 1,
    default: 1
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft'
  },
  // 一级场景的业务标签（如：编解码、相机、性能），用于分类与筛选
  tags: {
    type: [String],
    default: []
  },
  // 已废弃：环节类型调色板（环节不再区分类型）。字段保留仅为兼容历史数据。
  stageTypes: {
    type: [String],
    default: ['Command 入口', '场景理解', '方案设计', '任务执行', '结果验证', 'Extension 构建']
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Scenario', scenarioSchema);
