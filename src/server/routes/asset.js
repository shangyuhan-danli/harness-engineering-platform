import express from 'express';
import Asset from '../models/Asset.js';
import Department from '../models/Department.js';
import Product from '../models/Product.js';
import Workflow from '../models/Workflow.js';
import Scenario from '../models/Scenario.js';

const router = express.Router();

// Get all assets
// 支持按 productId / departmentId 筛选；Extension 不在库里手建，而是基于“有 workflow 的场景”
// 动态生成（name=场景编码，因 Extension name 不可为中文）
router.get('/', async (req, res) => {
  try {
    const { assetType, status, tag, productId, departmentId } = req.query;

    // 选部门时递归收集部门树及树下产品
    let deptIdStr = null;
    let productIds = null;
    if (departmentId) {
      const deptIds = [departmentId];
      let stack = [departmentId];
      while (stack.length) {
        const children = await Department.find({ parentId: { $in: stack } }).select('_id').lean();
        const childIds = children.map(c => c._id);
        if (childIds.length) { deptIds.push(...childIds); stack = childIds; } else stack = [];
      }
      const products = await Product.find({ departmentId: { $in: deptIds } }).select('_id').lean();
      productIds = products.map(p => p._id.toString());
      deptIdStr = deptIds.map(d => d.toString());
    }

    // 动态生成 Extension：每个有 workflow 的场景生成一个，name = 场景编码
    const onlyExt = assetType === 'Extension';
    let exts = [];
    if (!assetType || onlyExt) {
      const workflows = await Workflow.find({ scenarioId: { $ne: null } })
        .populate({ path: 'scenarioId', select: 'name code level productId' })
        .lean();
      const seen = new Set();
      exts = workflows
        .map(wf => wf.scenarioId)
        .filter(Boolean)
        .filter(sc => sc.code && !seen.has(sc.code) && seen.add(sc.code))
        .map(sc => ({
          _id: 'ext-' + sc._id,
          name: sc.code,
          description: `基于场景「${sc.name}」自动生成的 Extension`,
          assetType: 'Extension',
          status: 'published',
          version: '1.0.0',
          productId: sc.productId,
          scenarioId: sc._id,
          auto: true
        }));
      exts = exts.filter(e =>
        (!productId || (e.productId && e.productId.toString() === productId)) &&
        (!productIds || (e.productId && productIds.includes(e.productId.toString())))
      );
    }
    if (onlyExt) return res.json(exts);

    // 查库内资产（排除 Extension，Extension 走动态）
    const query = { assetType: { $ne: 'Extension' } };
    if (assetType) query.assetType = assetType;
    if (status) query.status = status;
    if (tag) query.tags = tag;
    if (productId) query.productId = productId;
    let assets = await Asset.find(query).sort({ createdAt: -1 }).lean();
    if (deptIdStr) {
      assets = assets.filter(a =>
        (a.departmentId && deptIdStr.includes(a.departmentId.toString())) ||
        (a.productId && productIds.includes(a.productId.toString()))
      );
    }
    res.json(assets.concat(exts));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get asset by ID
router.get('/:id', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new asset
router.post('/', async (req, res) => {
  try {
    const asset = new Asset(req.body);
    await asset.save();
    res.status(201).json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 批量创建资产（归属同一部门或产品，不可多维度）
router.post('/batch', async (req, res) => {
  try {
    const { items = [], departmentId, productId } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: '请提供至少一条资产' });
    }
    const docs = items.map(it => ({
      name: it.name,
      assetType: it.assetType || 'Agent',
      description: it.description || '',
      owner: it.owner || '',
      dueDate: it.dueDate || null,
      status: 'draft',
      departmentId: departmentId || null,
      productId: productId || null
    }));
    const created = await Asset.insertMany(docs);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update asset
router.put('/:id', async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Publish asset
router.post('/:id/publish', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    const organization = req.body.organization || '';
    asset.status = 'published';
    asset.releaseNotes.push({
      version: asset.version,
      date: new Date(),
      notes: req.body.notes || `发布到组织：${organization || '未指定'}`,
      breaking: false,
      organization
    });
    asset.updatedAt = new Date();
    await asset.save();
    res.json({ message: 'Asset published', asset });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Search assets
router.get('/search/query', async (req, res) => {
  try {
    const { q, type } = req.query;
    const query = {
      status: 'published',
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [q] } }
      ]
    };

    if (type) query.assetType = type;

    const assets = await Asset.find(query).limit(20);
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rate asset
router.post('/:id/rate', async (req, res) => {
  try {
    const { rating } = req.body;
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Simple rating calculation
    const totalReviews = asset.marketplace.reviews || 0;
    const currentRating = asset.marketplace.rating || 0;
    asset.marketplace.rating = (currentRating * totalReviews + rating) / (totalReviews + 1);
    asset.marketplace.reviews = totalReviews + 1;

    await asset.save();
    res.json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
