import express from 'express';
import Product from '../models/Product.js';

const router = express.Router();

// GET / 列出产品，可按部门筛选 ?departmentId=
router.get('/', async (req, res) => {
  try {
    const query = req.query.departmentId ? { departmentId: req.query.departmentId } : {};
    const products = await Product.find(query).sort({ name: 1 }).lean();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
