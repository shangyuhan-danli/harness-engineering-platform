import express from 'express';
import Command from '../models/Command.js';

const router = express.Router();

const COMMAND_NAME_PATTERN = /^\/[a-z0-9][a-z0-9-]*$/;

// 规范化命令名：补 / 前缀、转小写
const normalizeCommandName = (name) => {
  const trimmed = (name || '').trim().toLowerCase();
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

// GET / 列出全部 Command 清单（未开发的排前面，便于发现待开发项）
router.get('/', async (req, res) => {
  try {
    const commands = await Command.find().sort({ name: 1 }).lean();
    res.json(commands);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST / 新定义一个 Command（仅 name + 责任人 + 完成时间，不写参数/正文，无 version）
// 新定义的 Command 即加入清单作为"未开发占位"，待流水线发布后回填 parameters / bodyOverride
router.post('/', async (req, res) => {
  try {
    const name = normalizeCommandName(req.body.name);
    if (!COMMAND_NAME_PATTERN.test(name)) {
      return res.status(400).json({ error: 'Command 名称必须形如 /xxx，仅含小写字母、数字和连字符' });
    }
    const existing = await Command.findOne({ name });
    if (existing) {
      return res.status(409).json({ error: '该 Command 已存在于清单' });
    }
    const command = new Command({
      name,
      description: req.body.description || '',
      parameters: {},
      bodyOverride: '',
      owner: req.body.owner || '',
      dueDate: req.body.dueDate || null,
      source: 'manual'
    });
    await command.save();
    res.status(201).json(command);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /:id/publish 发布 Command（记录目标组织 + 发布历史）
router.post('/:id/publish', async (req, res) => {
  try {
    const command = await Command.findById(req.params.id);
    if (!command) {
      return res.status(404).json({ error: 'Command not found' });
    }
    const organization = req.body.organization || '';
    command.status = 'published';
    command.releaseNotes.push({
      version: command.version || '1.0.0',
      date: new Date(),
      organization,
      notes: `发布到组织：${organization || '未指定'}`
    });
    command.updatedAt = new Date();
    await command.save();
    res.json({ message: 'Command published', command });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
