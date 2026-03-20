# VF物流数据分析平台 - 故障排除指南

## 🚨 常见问题快速解决

### 1. npm run check-tables 脚本不存在

**问题**: `npm ERR! Missing script: "check-tables"`

**解决方案**:
```bash
# 确保在backend目录下
cd backend

# 重新安装依赖
npm install

# 现在可以运行
npm run check-tables
# 或者使用别名
npm run check
npm run db:check
```

### 2. 数据库连接失败

**问题**: Oracle数据库连接错误

**解决步骤**:

1. **检查环境配置**:
```bash
npm run env:check
```

2. **检查Oracle客户端**:
```bash
npm run oracle:check
```

3. **检查.env文件**:
```env
DB_HOST=localhost
DB_PORT=1521
DB_SERVICE_NAME=XE
DB_USER=your_username
DB_PASSWORD=your_password
```

4. **测试数据库连接**:
```bash
npm run db:test
```

### 3. Oracle Instant Client 安装问题

**Windows系统**:
```bash
# 下载Oracle Instant Client Basic Package
# 从 https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html

# 解压到 C:\oracle\instantclient_19_8
# 添加到系统PATH环境变量
```

**macOS系统**:
```bash
# 使用Homebrew安装
brew tap InstantClientTap/instantclient
brew install instantclient-basic

# 或手动下载安装
# https://www.oracle.com/database/technologies/instant-client/macos-intel-x86-downloads.html
```

**Linux系统**:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install alien libaio1

# 下载RPM包并转换为DEB
# https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html
```

### 4. Node.js版本问题

**问题**: Node.js版本过低

**解决方案**:
```bash
# 检查当前版本
node --version

# 如果版本 < 16.0.0，请升级
# 使用nvm (推荐)
nvm install 18
nvm use 18

# 或直接从官网下载
# https://nodejs.org/
```

### 5. 依赖安装失败

**问题**: npm install 失败

**解决方案**:
```bash
# 清除缓存
npm cache clean --force

# 删除node_modules和package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install

# 如果还是失败，尝试使用yarn
npm install -g yarn
yarn install
```

### 6. 端口占用问题

**问题**: 端口3001已被占用

**解决方案**:
```bash
# 查找占用端口的进程
# Windows
netstat -ano | findstr :3001

# macOS/Linux
lsof -i :3001

# 杀死进程 (Windows)
taskkill /PID <PID号> /F

# 杀死进程 (macOS/Linux)
kill -9 <PID号>

# 或者修改端口
# 在.env文件中设置
API_PORT=3002
```

## 🔍 诊断工具

### 快速诊断
```bash
# 运行完整环境检查
npm run quick:check

# 检查数据库连接
npm run db:test

# 检查表结构
npm run check-tables

# 运行诊断脚本
npm run db:diagnose
```

### 详细诊断
```bash
# 检查Oracle客户端
npm run oracle:check

# 检查环境变量
npm run env:check

# 测试API服务器
npm run api:test
```

## 📊 数据库相关问题

### ORA-12154: TNS:could not resolve the connect identifier

**原因**: 数据库连接标识符配置错误

**解决方案**:
1. 检查DB_SERVICE_NAME是否正确
2. 确认数据库服务正在运行
3. 验证网络连接

```env
# 确保配置正确
DB_HOST=localhost
DB_PORT=1521
DB_SERVICE_NAME=XE  # 或者你的实际服务名
```

### ORA-01017: invalid username/password

**原因**: 用户名或密码错误

**解决方案**:
1. 验证用户名和密码
2. 检查用户权限
3. 确认用户未被锁定

```sql
-- 在SQL*Plus或SQL Developer中检查
SELECT username, account_status FROM dba_users WHERE username = 'YOUR_USERNAME';
```

### ORA-00942: table or view does not exist

**原因**: 表不存在或权限不足

**解决方案**:
1. 检查表名拼写
2. 验证schema名称
3. 确认用户有查询权限

```sql
-- 检查表是否存在
SELECT table_name FROM user_tables WHERE table_name LIKE 'TSK%';

-- 检查权限
SELECT * FROM user_tab_privs WHERE table_name = 'TSK_LIST_TASK';
```

## 🚀 性能优化

### API响应慢

**可能原因**:
- 数据库查询复杂
- 数据量过大
- 网络延迟

**优化方案**:
1. 缩小查询时间范围
2. 使用品牌筛选
3. 分页查询大数据量
4. 检查数据库索引

### 内存使用过高

**监控内存使用**:
```bash
# 启动服务器时监控
node --max-old-space-size=4096 src/api-server.js
```

## 📞 获取帮助

### 日志查看
```bash
# API服务器日志
npm start 2>&1 | tee api.log

# 数据库连接日志
npm run db:test > db.log 2>&1
```

### 环境信息收集
```bash
# 收集系统信息
node --version
npm --version
npm run quick:check > system-info.txt
```

### 联系支持

如果以上方法都无法解决问题，请提供以下信息：

1. **系统信息**:
   - 操作系统版本
   - Node.js版本
   - npm版本

2. **错误信息**:
   - 完整的错误堆栈
   - 执行的命令
   - 错误发生的时间

3. **环境配置**:
   - .env文件配置（隐藏敏感信息）
   - 数据库版本
   - Oracle客户端版本

4. **日志文件**:
   - API服务器日志
   - 数据库连接日志
   - 错误详细信息

---

## 🔗 相关文档

- [本地环境搭建指南](./LOCAL_SETUP.md)
- [API使用指南](./API_GUIDE.md)
- [数据库表结构规范](./VF_LOGISTICS_SCHEMA.md)
- [快速启动指南](./QUICK_START.md)

**💡 提示**: 大多数问题都可以通过重新运行 `npm run setup` 向导来解决。