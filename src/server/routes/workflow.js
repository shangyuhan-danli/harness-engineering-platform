import express from 'express';
import Workflow from '../models/Workflow.js';
import Scenario from '../models/Scenario.js';
import Asset from '../models/Asset.js';
import Command from '../models/Command.js';
import Department from '../models/Department.js';
import Product from '../models/Product.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// 节点（原子执行单元）绑定的资产必须来自 Workflow 资产池
const nodeAssetsBelongToWorkflow = (workflow, assets = []) => {
  const workflowAssetIds = new Set(
    workflow.assets
      .map(asset => asset.assetId?.toString())
      .filter(Boolean)
  );
  return assets.every(asset =>
    asset.assetId && workflowAssetIds.has(asset.assetId.toString())
  );
};

// Command 约束：对应 Claude Code TUI 中的 slash command（/xxx），
// 参数为扁平的位置参数契约，key 顺序即 TUI 调用时的参数顺序。
const COMMAND_NAME_PATTERN = /^\/[a-z0-9][a-z0-9-]*$/;
const PARAM_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

const validateCommandPayload = (body) => {
  if (!body.name || !COMMAND_NAME_PATTERN.test(body.name)) {
    return 'Command 名称必须形如 /xxx，仅含小写字母、数字和连字符';
  }
  const parameters = body.parameters || {};
  if (
    typeof parameters !== 'object' || Array.isArray(parameters) ||
    Object.entries(parameters).some(([key, value]) =>
      !PARAM_KEY_PATTERN.test(key) || typeof value !== 'string'
    )
  ) {
    return '参数定义必须是扁平 JSON 对象，key 为参数名、value 为类型说明字符串';
  }
  return null;
};

const populateWorkflow = (query) => query
  .populate({
    path: 'scenarioId',
    select: 'name code level productId parentId',
    populate: { path: 'parentId', model: 'Scenario', select: 'name' }
  })
  .populate('assets.assetId', 'name assetType status version description')
  .populate('stages.steps.assets.assetId', 'name assetType status version');

// Get all workflows
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.query.scenarioId) query.scenarioId = req.query.scenarioId;
    if (req.query.productId) {
      const scenarios = await Scenario.find({ productId: req.query.productId }).select('_id').lean();
      query.scenarioId = { $in: scenarios.map(s => s._id) };
    } else if (req.query.departmentId) {
      // 递归收集该部门及所有子孙部门，再找其下产品 → 场景 → 工作流
      const deptIds = [req.query.departmentId];
      let stack = [req.query.departmentId];
      while (stack.length) {
        const children = await Department.find({ parentId: { $in: stack } }).select('_id').lean();
        const childIds = children.map(c => c._id);
        if (childIds.length) {
          deptIds.push(...childIds);
          stack = childIds;
        } else {
          stack = [];
        }
      }
      const products = await Product.find({ departmentId: { $in: deptIds } }).select('_id').lean();
      const productIds = products.map(p => p._id);
      const scenarios = await Scenario.find({ productId: { $in: productIds } }).select('_id').lean();
      query.scenarioId = { $in: scenarios.map(s => s._id) };
    }
    const workflows = await populateWorkflow(Workflow.find(query)).sort({ createdAt: -1 });
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get workflow by ID
router.get('/:id', async (req, res) => {
  try {
    const workflow = await populateWorkflow(Workflow.findById(req.params.id));
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new workflow（一个业务场景只允许关联一个 Workflow，对应一个 Extension）
router.post('/', async (req, res) => {
  try {
    if (req.body.scenarioId) {
      const scenario = await Scenario.findById(req.body.scenarioId);
      if (!scenario) {
        return res.status(400).json({ error: '所属业务场景不存在' });
      }
      if (scenario.level < 2) {
        return res.status(400).json({ error: '一级场景为业务分组节点，不支持定义 Workflow，请在二级场景下设计' });
      }
      const existing = await Workflow.findOne({ scenarioId: req.body.scenarioId });
      if (existing) {
        return res.status(409).json({
          error: '该业务场景已关联 Workflow，一个场景对应一个 Harness Workflow'
        });
      }
    }
    const workflow = new Workflow({
      ...req.body,
      stages: req.body.stages || []
    });
    await workflow.save();
    res.status(201).json(workflow);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update workflow
router.put('/:id', async (req, res) => {
  try {
    const workflow = await Workflow.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(workflow);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Replace the Agent/Skill pool available to this workflow
router.put('/:id/assets', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const assetIds = [...new Set(req.body.assetIds || [])];
    const assets = await Asset.find({
      _id: { $in: assetIds },
      assetType: { $in: ['Agent', 'Skill'] }
    });
    if (assets.length !== assetIds.length) {
      return res.status(400).json({ error: 'One or more Agent/Skill assets were not found' });
    }

    const selectedIds = new Set(assets.map(asset => asset._id.toString()));
    workflow.assets = assets.map(asset => ({
      assetId: asset._id,
      type: asset.assetType,
      version: asset.version,
      role: 'workflow-resource'
    }));
    // 被移出资产池的资产，级联解除所有环节下节点的绑定
    workflow.stages.forEach(stage => {
      (stage.steps || []).forEach(step => {
        step.assets = step.assets.filter(item =>
          item.assetId && selectedIds.has(item.assetId.toString())
        );
      });
    });
    workflow.updatedAt = new Date();
    await workflow.save();
    await workflow.populate('assets.assetId', 'name assetType status version description');

    res.json(workflow.assets);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add a command entry to the workflow
// Command 入口只能从清单选择（引用），不在系统直接写参数/正文（同源原则）
router.post('/:id/commands', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    const { commandId } = req.body;
    if (!commandId) {
      return res.status(400).json({ error: '请从 Command 清单中选择一个命令' });
    }
    const registry = await Command.findById(commandId).lean();
    if (!registry) {
      return res.status(400).json({ error: '所选 Command 不存在于清单' });
    }
    if (workflow.commands.some(item => item.commandId && item.commandId.toString() === commandId)) {
      return res.status(409).json({ error: '该 Command 已添加到本 Workflow' });
    }

    const command = {
      id: uuidv4(),
      commandId: registry._id,
      name: registry.name,
      description: registry.description || '',
      parameters: registry.parameters || {},
      bodyOverride: registry.bodyOverride || '',
      version: registry.version || null,
      owner: registry.owner || '',
      dueDate: registry.dueDate || null
    };
    workflow.commands.push(command);
    workflow.updatedAt = new Date();
    await workflow.save();

    res.status(201).json(workflow.commands[workflow.commands.length - 1]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id/commands/:commandId', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const command = workflow.commands.find(item => item.id === req.params.commandId);
    if (!command) {
      return res.status(404).json({ error: 'Command not found' });
    }
    // 同步清单：从 Command 清单重新读取（流水线发布后回填的 parameters / bodyOverride）
    if (command.commandId) {
      const registry = await Command.findById(command.commandId).lean();
      if (registry) {
        command.name = registry.name;
        command.description = registry.description || '';
        command.parameters = registry.parameters || {};
        command.bodyOverride = registry.bodyOverride || '';
        command.version = registry.version || null;
        command.owner = registry.owner || '';
        command.dueDate = registry.dueDate || null;
      }
    }
    workflow.updatedAt = new Date();
    await workflow.save();
    res.json(command);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id/commands/:commandId', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const commandExists = workflow.commands.some(item => item.id === req.params.commandId);
    if (!commandExists) {
      return res.status(404).json({ error: 'Command not found' });
    }
    workflow.commands = workflow.commands.filter(item => item.id !== req.params.commandId);
    workflow.updatedAt = new Date();
    await workflow.save();
    res.json({ message: 'Command deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- 环节（Stage，逻辑分组） ----

// Add stage to workflow
router.post('/:id/stages', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const stage = {
      id: uuidv4(),
      order: workflow.stages.length,
      name: req.body.name,
      type: req.body.type,
      description: req.body.description,
      steps: []
    };

    workflow.stages.push(stage);
    await workflow.save();

    res.status(201).json(stage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update stage（仅环节本身的名称/类型/说明/排序，节点走 steps 子路由）
router.put('/:id/stages/:stageId', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const stage = workflow.stages.find(s => s.id === req.params.stageId);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    ['name', 'type', 'description', 'order'].forEach(field => {
      if (req.body[field] !== undefined) stage[field] = req.body[field];
    });
    await workflow.save();

    res.json(stage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete stage（级联删除环节内的节点，前端需先确认）
router.delete('/:id/stages/:stageId', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    workflow.stages = workflow.stages.filter(s => s.id !== req.params.stageId);
    await workflow.save();

    res.json({ message: 'Stage deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- 节点（Step，原子执行单元，绑定 Agent/Skill） ----

// Add step to stage
router.post('/:id/stages/:stageId/steps', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    const stage = workflow.stages.find(s => s.id === req.params.stageId);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    if (!nodeAssetsBelongToWorkflow(workflow, req.body.assets)) {
      return res.status(400).json({
        error: 'Step assets must be selected from the workflow asset pool'
      });
    }

    const step = {
      id: uuidv4(),
      order: stage.steps.length,
      name: req.body.name,
      description: req.body.description,
      assets: req.body.assets || []
    };
    stage.steps.push(step);
    await workflow.save();

    res.status(201).json(step);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update step
router.put('/:id/stages/:stageId/steps/:stepId', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    const stage = workflow.stages.find(s => s.id === req.params.stageId);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    const step = stage.steps.find(s => s.id === req.params.stepId);
    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }
    if (req.body.assets && !nodeAssetsBelongToWorkflow(workflow, req.body.assets)) {
      return res.status(400).json({
        error: 'Step assets must be selected from the workflow asset pool'
      });
    }

    ['name', 'description', 'order', 'assets'].forEach(field => {
      if (req.body[field] !== undefined) step[field] = req.body[field];
    });
    await workflow.save();

    res.json(step);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete step
router.delete('/:id/stages/:stageId/steps/:stepId', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    const stage = workflow.stages.find(s => s.id === req.params.stageId);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    stage.steps = stage.steps.filter(s => s.id !== req.params.stepId);
    await workflow.save();

    res.json({ message: 'Step deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
