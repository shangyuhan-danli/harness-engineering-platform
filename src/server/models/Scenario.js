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
  // 场景自定义的作业阶段类型调色板：该场景下的 Workflow 阶段从这里选择类型
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
