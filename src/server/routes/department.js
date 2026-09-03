import express from 'express';
import Department from '../models/Department.js';

const router = express.Router();

// GET / 列出全部部门（前端按 parentId 构建树）
router.get('/', async (req, res) => {
  try {
    const departments = await Department.find().sort({ level: 1, name: 1 }).lean();
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
