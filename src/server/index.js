import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Routes
import authRoutes from './routes/auth.js';
import workflowRoutes from './routes/workflow.js';
import assetRoutes from './routes/asset.js';
import specRoutes from './routes/spec.js';
import testingRoutes from './routes/testing.js';
import dashboardRoutes from './routes/dashboard.js';
import scenarioRoutes from './routes/scenario.js';
import commandRoutes from './routes/command.js';
import departmentRoutes from './routes/department.js';
import productRoutes from './routes/product.js';
import extensionRoutes from './routes/extension.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/harness-platform')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Connection Error:', err));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/asset', assetRoutes);
app.use('/api/spec', specRoutes);
app.use('/api/testing', testingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/scenario', scenarioRoutes);
app.use('/api/command', commandRoutes);
app.use('/api/department', departmentRoutes);
app.use('/api/product', productRoutes);
app.use('/api/extension', extensionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
