import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 这些字段的值是 24 位 hex 字符串（ObjectId），导入时需转回 ObjectId
const ID_FIELDS = ['_id', 'parentId', 'productId', 'scenarioId', 'assetId', 'departmentId', 'commandId', 'userId'];
const isObjectIdStr = v => typeof v === 'string' && /^[0-9a-f]{24}$/.test(v);

const convert = (obj) => {
  if (Array.isArray(obj)) return obj.map(convert);
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const r = {};
    for (const [k, v] of Object.entries(obj)) {
      r[k] = (ID_FIELDS.includes(k) && isObjectIdStr(v)) ? new mongoose.Types.ObjectId(v) : convert(v);
    }
    return r;
  }
  return obj;
};

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/harness-platform';

await mongoose.connect(MONGODB_URI);
console.log('Connected to', MONGODB_URI);
const db = mongoose.connection.db;
const dir = path.join(__dirname, '..', 'dump');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

for (const f of files) {
  const name = f.replace('.json', '');
  const docs = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).map(convert);
  await db.collection(name).deleteMany({});
  if (docs.length) await db.collection(name).insertMany(docs);
  console.log(`${name}: ${docs.length} imported`);
}

await mongoose.disconnect();
console.log('Import done.');
