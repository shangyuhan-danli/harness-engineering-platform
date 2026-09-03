import mongoose from 'mongoose';

const workflowSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  businessScenario: String,
  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scenario',
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft'
  },
  // 环节（逻辑分组，方便用户理解）→ 节点（原子执行单元，绑定 Agent/Skill）两层结构
  stages: [{
    id: String,
    name: String,
    // 环节类型为场景内自定义的字符串（见 Scenario.stageTypes），不做枚举限制。
    // 注意必须写成 { type: String }：裸写 type: String 会被 Mongoose 当成类型声明
    type: { type: String },
    description: String,
    order: {
      type: Number,
      default: 0
    },
    steps: [{
      id: String,
      name: String,
      description: String,
      order: {
        type: Number,
        default: 0
      },
      assets: [{
        assetId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Asset'
        },
        type: {
          type: String,
          enum: ['Agent', 'Skill']
        },
        role: String
      }]
    }]
  }],
  assets: [{
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset'
    },
    type: {
      type: String,
      enum: ['Agent', 'Skill']
    },
    version: String,
    role: String
  }],
  commands: [{
    id: String,
    commandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Command'
    },
    name: {
      type: String,
      required: true
    },
    description: String,
    parameters: mongoose.Schema.Types.Mixed,
    bodyOverride: String,
    version: {
      type: String,
      default: null
    },
    owner: String,
    dueDate: Date
  }],
  executionRecords: [{
    executionId: String,
    startTime: Date,
    endTime: Date,
    status: String,
    result: mongoose.Schema.Types.Mixed,
    qualityScore: Number
  }],
  version: {
    type: Number,
    default: 1
  },
  createdBy: mongoose.Schema.Types.ObjectId,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Workflow', workflowSchema);
