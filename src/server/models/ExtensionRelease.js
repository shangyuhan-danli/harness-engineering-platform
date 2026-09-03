import mongoose from 'mongoose';

// Extension 发布记录（Extension 基于场景自动生成，每次发布记录版本/目标组织等）
const extensionReleaseSchema = new mongoose.Schema({
  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scenario'
  },
  extName: String,
  version: String,
  organization: String,
  betaProduct: String,
  description: String,
  publisher: String,
  status: {
    type: String,
    default: '已发布'
  },
  counts: String,
  date: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('ExtensionRelease', extensionReleaseSchema);
