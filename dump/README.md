# MongoDB 数据导出/导入说明

## 数据文件

`dump/` 目录下每个 `.json` 文件对应一个 MongoDB 集合：

| 文件 | 集合 | 内容 |
|------|------|------|
| scenarios.json | scenarios | 业务场景（一级/二级） |
| workflows.json | workflows | 工作流（环节/节点/Command/资产池） |
| assets.json | assets | Agent/Skill 资产（含版本/发布记录） |
| commands.json | commands | Command 清单（含版本/责任人） |
| specs.json | specs | SPEC 文档 |
| testingcases.json | testingcases | 测试集 |
| departments.json | departments | 部门树（云核心网产品线 → 3 个开发部） |
| products.json | products | 产品（UDM/USCDB/UPCF） |
| users.json | users | 用户（moli，密码 moli123） |
| extensionreleases.json | extensionreleases | Extension 发布记录 |

> ObjectId 字段（`_id`/`parentId`/`productId`/`scenarioId`/`assetId` 等）已转为 24 位 hex 字符串，导入脚本会自动转回 ObjectId。

## 导入方式

### 方式一：Node 脚本（推荐）

```bash
# 确保 MongoDB 已启动（mongod --port 27017 或 docker run -d -p 27017:27017 mongo:6）
node scripts/import-dump.js
```

脚本会清空目标集合后写入（覆盖），自动处理 ObjectId 转换。

### 方式二：mongoimport（需 MongoDB Database Tools）

```bash
for f in dump/*.json; do
  name=$(basename "$f" .json)
  mongoimport --db harness-platform --collection "$name" --file "$f"
done
```

## 完整部署步骤

```bash
# 1. 克隆代码
git clone -b feature/scenario-driven-redesign https://github.com/shangyuhan-danli/harness-engineering-platform.git
cd harness-engineering-platform

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env：PORT=5001, MONGODB_URI=mongodb://localhost:27017/harness-platform

# 4. 启动 MongoDB（任选一种）
#    本地：mongod --dbpath /path/to/data --port 27017
#    Docker：docker run -d -p 27017:27017 --name mongo mongo:6

# 5. 导入演示数据
node scripts/import-dump.js

# 6. 启动应用
npm run dev

# 7. 访问
#    http://localhost:3000
#    登录：moli / moli123
```

## 注意事项

- 导入会**清空并覆盖**目标集合的现有数据
- 用户 `moli` 密码 `moli123`（role: developer，只读权限演示）
- 如需重新生成示例数据，可运行 `npm run seed`（会覆盖导入的数据）
- MongoDB 数据文件本身（`*.wt`）是 WiredTiger 二进制格式，不可直接提交 git，所以用 JSON 导出
