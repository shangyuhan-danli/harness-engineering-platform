import express from 'express';
import ExtensionRelease from '../models/ExtensionRelease.js';

const router = express.Router();

// POST /release 发布 Extension（版本号自增 1.0.x）
router.post('/release', async (req, res) => {
  try {
    const { scenarioId, extName, organization, betaProduct, description, counts, publisher } = req.body;
    if (!scenarioId) {
      return res.status(400).json({ error: '缺少 scenarioId' });
    }
    const prior = await ExtensionRelease.countDocuments({ scenarioId });
    const version = `1.0.${prior + 1}`;
    const rec = new ExtensionRelease({
      scenarioId,
      extName: extName || '未命名',
      version,
      organization: organization || '',
      betaProduct: betaProduct || '',
      description: description || '',
      counts: counts || '',
      publisher: publisher || '系统',
      status: '已发布'
    });
    await rec.save();
    res.status(201).json(rec);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /:scenarioId/releases 发布历史
router.get('/:scenarioId/releases', async (req, res) => {
  try {
    const releases = await ExtensionRelease.find({ scenarioId: req.params.scenarioId })
      .sort({ date: -1 })
      .lean();
    res.json(releases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
