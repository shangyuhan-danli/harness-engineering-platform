import express from 'express';
import Scenario from '../models/Scenario.js';
import Workflow from '../models/Workflow.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const query = req.query.productId ? { productId: req.query.productId } : {};
    const scenarios = await Scenario.find(query).sort({ level: 1, createdAt: 1 }).lean();
    const workflowCounts = await Workflow.aggregate([
      { $match: { scenarioId: { $ne: null } } },
      { $group: { _id: '$scenarioId', count: { $sum: 1 } } }
    ]);
    const countByScenario = new Map(
      workflowCounts.map(item => [item._id.toString(), item.count])
    );

    res.json(scenarios.map(scenario => ({
      ...scenario,
      workflowCount: countByScenario.get(scenario._id.toString()) || 0
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const scenario = await Scenario.findById(req.params.id).lean();
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const workflows = await Workflow.find({ scenarioId: scenario._id })
      .populate('assets.assetId', 'name assetType status version description')
      .populate('stages.steps.assets.assetId', 'name assetType status version')
      .sort({ createdAt: 1 });

    res.json({ ...scenario, workflows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    let level = 1;
    let parentId = null;

    if (req.body.parentId) {
      const parent = await Scenario.findById(req.body.parentId);
      if (!parent) {
        return res.status(400).json({ error: 'Parent scenario not found' });
      }
      if (parent.level >= 2) {
        return res.status(400).json({ error: '场景最多两级，不支持在二级场景下继续创建下级场景' });
      }
      parentId = parent._id;
      level = parent.level + 1;
    }

    const scenario = new Scenario({
      ...req.body,
      parentId,
      level
    });
    await scenario.save();
    res.status(201).json(scenario);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const update = {
      name: req.body.name,
      code: req.body.code,
      description: req.body.description,
      status: req.body.status,
      updatedAt: new Date()
    };
    if (Array.isArray(req.body.stageTypes)) {
      update.stageTypes = req.body.stageTypes;
    }
    // 场景标签：去空白、去空串、去重后落库
    if (Array.isArray(req.body.tags)) {
      update.tags = [...new Set(
        req.body.tags.map(tag => String(tag).trim()).filter(Boolean)
      )];
    }
    const scenario = await Scenario.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    res.json(scenario);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [childCount, workflowCount] = await Promise.all([
      Scenario.countDocuments({ parentId: req.params.id }),
      Workflow.countDocuments({ scenarioId: req.params.id })
    ]);
    if (childCount > 0 || workflowCount > 0) {
      return res.status(409).json({
        error: '请先删除该场景的下级场景和关联的 Workflow'
      });
    }

    const scenario = await Scenario.findByIdAndDelete(req.params.id);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    res.json({ message: 'Scenario deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
