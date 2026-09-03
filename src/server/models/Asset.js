import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  assetType: {
    type: String,
    enum: ['Agent', 'Skill', 'MCP', 'Extension'],
    required: true
  },
  category: String,
  tags: [String],
  version: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'deprecated'],
    default: 'draft'
  },
  owner: String,
  dueDate: Date,
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  content: {
    code: String,
    config: mongoose.Schema.Types.Mixed,
    documentation: String,
    dependencies: [String]
  },
  specifications: {
    inputSchema: mongoose.Schema.Types.Mixed,
    outputSchema: mongoose.Schema.Types.Mixed,
    capabilities: [String],
    constraints: [String]
  },
  quality: {
    testCoverage: Number,
    performanceScore: Number,
    securityScore: Number,
    maintenanceScore: Number,
    overallScore: Number
  },
  marketplace: {
    downloads: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviews: Number,
    featured: Boolean,
    freeType: {
      type: String,
      enum: ['free', 'premium', 'enterprise'],
      default: 'free'
    }
  },
  releaseNotes: [
    {
      version: String,
      date: Date,
      notes: String,
      breaking: Boolean,
      organization: String
    }
  ],
  creator: {
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    email: String
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

export default mongoose.model('Asset', assetSchema);
