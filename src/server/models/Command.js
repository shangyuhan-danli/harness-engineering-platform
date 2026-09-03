import mongoose from 'mongoose';

// Command 清单库（全局可用命令注册表）
// 设计原则：Agent / Skill / Command 的内容由流水线自动发布，平台不直接编写内容。
// - 有 version 的 Command 已由流水线回填 parameters / bodyOverride（可预览）
// - 无 version 的 Command 仅有一个名字（占位），待责任人完成后由流水线回填
// 平台只做“从清单选择 + 新定义占位（name + 责任人 + 完成时间）”的编排，不写参数/正文。
const commandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: String,
  parameters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  bodyOverride: String,
  version: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
  },
  owner: String,
  dueDate: Date,
  source: {
    type: String,
    enum: ['manual', 'pipeline'],
    default: 'manual'
  },
  releaseNotes: [
    {
      version: String,
      date: Date,
      organization: String,
      notes: String
    }
  ],
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Command', commandSchema);
