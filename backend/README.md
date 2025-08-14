# VF物流数据分析平台 - 后端服务

这是VF物流数据分析平台的后端服务，基于Node.js和Oracle数据库构建。

## 🚀 一键快速配置

### 第一次使用

```bash
# 1. 进入后端目录
cd backend

# 2. 安装依赖
npm install

# 3. 一键配置Oracle数据库
npm run setup

# 4. 快速测试连接
npm run quick-test

# 5. 启动服务
npm run dev
```

### 配置完成后

```bash
# 快速测试连接
npm run quick-test

# 启动开发服务器
npm run dev

# 详细诊断 (出问题时使用)
npm run diagnose
```

## 📋 支持的Oracle环境

1. **本地Oracle XE** (推荐新手)
2. **本地Oracle标准版**
3. **远程Oracle数据库**
4. **Oracle云数据库**
5. **自定义配置**

## 🔧 故障排除

### 如果 `npm run setup` 失败

1. **检查Node.js版本**
   ```bash
   node --version  # 需要 >= 18.0.0
   ```

2. **重新安装依赖**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run setup
   ```

3. **Oracle Client问题**
   - Windows: 下载Oracle Instant Client并添加到PATH
   - Linux: `sudo apt-get install libaio1`
   - macOS: 下载Oracle Instant Client for macOS

### 如果连接测试失败

1. **检查数据库服务**
   - 确保Oracle数据库服务正在运行
   - 验证端口1521是否开放

2. **检查连接参数**
   - 用户名和密码是否正确
   - 连接字符串格式是否正确

3. **重新配置**
   ```bash
   npm run setup  # 重新运行配置向导
   ```

## 🎯 快速命令参考

| 命令 | 功能 |
|------|------|
| `npm run setup` | 一键配置Oracle数据库 |
| `npm run quick-test` | 快速测试连接 |
| `npm run dev` | 启动开发服务器 |
| `npm run diagnose` | 详细环境诊断 |

## 📚 更多信息

- 详细配置选项请查看 `TROUBLESHOOTING.md`
- Oracle Instant Client安装指南
- API文档和接口说明

---

**💡 提示**: 首次使用建议直接运行 `npm run setup`，向导会自动引导您完成所有配置。

### 环境变量配置

创建 `.env` 文件并配置以下变量：

```env
# 服务器配置
NODE_ENV=development
PORT=3001
HOST=localhost

# Oracle数据库配置
ORACLE_USER=your_username
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=localhost:1521/XE
ORACLE_POOL_MIN=2
ORACLE_POOL_MAX=10
ORACLE_POOL_INCREMENT=2
ORACLE_POOL_TIMEOUT=60

# CORS配置
CORS_ORIGIN=http://localhost:3000
```

## 🧪 测试

### 基本连接测试
```bash
npm run test
```

### 综合测试套件
```bash
npm run test-db
```

### 手动测试API端点

1. **服务健康检查**
   ```bash
   curl http://localhost:3001/health
   ```

2. **数据库连接测试**
   ```bash
   curl http://localhost:3001/api/db/test
   ```

3. **数据库统计信息**
   ```bash
   curl http://localhost:3001/api/db/stats
   ```

## 📁 项目结构

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # 数据库连接配置
│   ├── scripts/
│   │   ├── testConnection.js    # 基本连接测试
│   │   └── testDatabase.js      # 综合测试套件
│   └── server.js               # Express服务器主文件
├── .env.example               # 环境变量模板
├── package.json              # 项目配置
└── README.md                 # 说明文档
```

## 🔧 数据库配置

### Oracle数据库连接字符串格式

支持以下几种连接格式：

1. **简单连接字符串**
   ```
   ORACLE_CONNECT_STRING=localhost:1521/XE
   ```

2. **完整连接描述符**
   ```
   ORACLE_CONNECT_STRING=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=XE)))
   ```

3. **使用SID**
   ```
   ORACLE_CONNECT_STRING=localhost:1521:XE
   ```

### 连接池配置

- `ORACLE_POOL_MIN`: 最小连接数 (默认: 2)
- `ORACLE_POOL_MAX`: 最大连接数 (默认: 10)
- `ORACLE_POOL_INCREMENT`: 连接增量 (默认: 2)
- `ORACLE_POOL_TIMEOUT`: 连接超时 (默认: 60秒)

## 🛠️ 开发指南

### 数据库操作

#### 执行简单查询
```javascript
import { executeQuery } from './config/database.js';

const result = await executeQuery(`
  SELECT * FROM your_table 
  WHERE condition = :1
`, [paramValue]);
```

#### 执行事务
```javascript
import { executeTransaction } from './config/database.js';

const results = await executeTransaction([
  {
    sql: 'INSERT INTO table1 VALUES (:1, :2)',
    params: [value1, value2]
  },
  {
    sql: 'UPDATE table2 SET column = :1 WHERE id = :2',
    params: [newValue, id]
  }
]);
```

#### 手动管理连接
```javascript
import { getConnection, releaseConnection } from './config/database.js';

const connection = await getConnection();
try {
  const result = await connection.execute(sql, params);
  // 处理结果...
} finally {
  await releaseConnection(connection);
}
```

## 📋 API端点

### 基础端点

- `GET /` - 服务信息
- `GET /health` - 健康检查
- `GET /api/test` - API测试端点

### 数据库端点

- `GET /api/db/test` - 数据库连接测试
- `GET /api/db/stats` - 数据库统计信息

## 🚨 故障排除

### 常见问题

1. **Oracle Client未安装**
   ```
   错误: DPI-1047: Cannot locate a 64-bit Oracle Client library
   解决方案: 安装Oracle Instant Client
   ```

2. **连接字符串错误**
   ```
   错误: ORA-12154: TNS:could not resolve the connect identifier
   解决方案: 检查ORACLE_CONNECT_STRING格式
   ```

3. **用户权限不足**
   ```
   错误: ORA-00942: table or view does not exist
   解决方案: 确认数据库用户有相应的表访问权限
   ```

4. **连接池耗尽**
   ```
   错误: NJS-040: connection request timeout
   解决方案: 调整连接池配置或检查连接泄漏
   ```

### 调试模式

启用详细日志：
```bash
NODE_ENV=development npm run dev
```

## 📈 性能监控

### 连接池状态监控

```javascript
// 获取连接池状态
const pool = await initializeDatabase();
console.log('连接池状态:', {
  connectionsOpen: pool.connectionsOpen,
  connectionsInUse: pool.connectionsInUse
});
```

### 查询性能监控

所有数据库操作都会记录执行时间和结果统计。

## 🔐 安全配置

- 使用环境变量存储敏感信息
- 启用Helmet安全中间件
- 配置CORS策略
- 参数化查询防止SQL注入

## 📝 日志记录

服务器使用Morgan中间件记录HTTP请求日志，数据库操作日志记录在控制台中。

## 🚀 部署

### 生产环境启动
```bash
NODE_ENV=production npm start
```

### 环境变量检查清单
- [ ] ORACLE_USER - 数据库用户名
- [ ] ORACLE_PASSWORD - 数据库密码
- [ ] ORACLE_CONNECT_STRING - 连接字符串
- [ ] PORT - 服务端口 (默认3001)
- [ ] CORS_ORIGIN - 前端域名
- [ ] NODE_ENV - 环境 (development/production)

## 🤝 贡献

1. 遵循现有的代码风格
2. 添加适当的错误处理
3. 编写测试用例
4. 更新文档

## 📄 许可证

MIT License