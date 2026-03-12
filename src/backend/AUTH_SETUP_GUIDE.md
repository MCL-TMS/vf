# 🔐 VF物流系统 - 认证功能设置指南

## 📋 快速开始

### 1️⃣ 创建测试账号（数据库）

```bash
# 在Oracle SQL*Plus或SQL Developer中运行
sqlplus your_username/your_password@your_database
@setup-test-users.sql
```

或者手动执行SQL：
```sql
INSERT INTO APP_CMS.RWSYS_USER 
(USERID, PASSWORD, USER_NAME_C, CUSTOMERNO, ACTIVE_FLAG, CREATE_TIME)
VALUES 
('testuser', 'testpass', '测试账号', '18405', 'Y', SYSDATE);
COMMIT;
```

### 2️⃣ 验证认证功能

```bash
cd backend
npm run verify:auth
```

**预期输出：**
```
✅ 数据库连接成功
✅ RWSYS_USER 表存在
✅ 表中共有 6 个用户

📝 现有用户列表:
✅ admin           | 系统管理员          | 全部品牌（管理员）
✅ dickies         | DICKIES品牌经理     | 18405
✅ testuser        | 测试账号           | 18405
...
```

### 3️⃣ 启动后端服务器

```bash
npm start
```

**看到以下日志表示成功：**
```
✅ 数据库连接池初始化成功
🔧 注册API路由...
✅ 已注册: /api/auth
🚀 VF物流数据分析平台API服务器启动成功
📡 服务运行在: http://localhost:3001
```

### 4️⃣ 测试登录API

**方法1：使用命令行**
```bash
npm run test:login testuser testpass
```

**方法2：使用浏览器**
1. 访问前端：`http://localhost:3000`
2. 点击侧边栏 **"🔧 Dev Tools"** → **"认证调试"**
3. 输入测试账号并测试

**方法3：使用curl**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"testuser","password":"testpass"}'
```

---

## 🎯 数据库表结构

### APP_CMS.RWSYS_USER

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| **USERID** | VARCHAR2(50) | 登录账号（主键） | `admin`, `dickies` |
| **PASSWORD** | VARCHAR2(100) | 密码（明文）⚠️ | `admin123`, `123456` |
| **USER_NAME_C** | VARCHAR2(100) | 用户说明/姓名 | `系统管理员`, `测试账号` |
| **CUSTOMERNO** | VARCHAR2(500) | 品牌权限（逗号分隔） | `18405`, `18405,18405-1` |
| **ACTIVE_FLAG** | CHAR(1) | 账号状态 | `Y`=启用, `N`=停用 |
| **CREATE_TIME** | DATE | 创建时间 | `SYSDATE` |

### 品牌代码映射

| 代码 | 品牌名称 |
|------|----------|
| `18405` | DICKIES |
| `18405-1` | TNF |
| `18405-2` | VANS |
| `18405-3` | TIMBERLAND |
| `18405-4` | ICEBREAKER |
| `18405-5` | SMARTWOOL |

### 权限说明

- **管理员**: `CUSTOMERNO` 为空或 `'all'` → 可查看所有品牌
- **单品牌**: `CUSTOMERNO = '18405'` → 只能查看DICKIES
- **多品牌**: `CUSTOMERNO = '18405,18405-1'` → 可查看DICKIES和TNF

---

## 🧪 测试账号列表

| 用户名 | 密码 | 权限 | 说明 |
|--------|------|------|------|
| `admin` | `admin123` | 管理员（全部品牌） | 系统管理员 |
| `dickies` | `123456` | DICKIES | DICKIES品牌经理 |
| `tnf` | `123456` | TNF | TNF品牌经理 |
| `vans` | `123456` | VANS | VANS品牌经理 |
| `demo` | `demo` | DICKIES + TNF | 演示账号 |
| `testuser` | `testpass` | DICKIES | 测试账号 |

---

## 🔄 混合认证模式

系统支持两种认证方式：

### 1️⃣ Mock认证（无需后端）
- **账号**: `admin` / `admin123`
- **特点**: 前端直接验证，无需数据库
- **用途**: 演示、前端开发、快速测试

### 2️⃣ 数据库认证（需要后端）
- **账号**: 所有其他账号
- **特点**: 查询Oracle数据库验证
- **用途**: 生产环境、真实权限控制

**实现位置**: `/contexts/AuthContext.tsx` 第56行

```typescript
if (userId.toLowerCase() === 'admin' && password === 'admin123') {
  // Mock认证
} else {
  // 调用后端API: /api/auth/login
}
```

---

## 🛠️ 常用命令

### 后端命令（在 `/backend` 目录）

```bash
# 完整认证功能测试
npm run verify:auth

# 启动API服务器
npm start

# 测试单个账号登录
npm run test:login <username> <password>
# 例如: npm run test:login testuser testpass

# 检查数据库连接
npm run db:test

# 查看所有用户
npm run test:auth
```

### SQL维护命令

```sql
-- 查看所有用户
SELECT USERID, USER_NAME_C, CUSTOMERNO, ACTIVE_FLAG 
FROM APP_CMS.RWSYS_USER;

-- 停用账号
UPDATE APP_CMS.RWSYS_USER 
SET ACTIVE_FLAG = 'N' 
WHERE USERID = 'demo';
COMMIT;

-- 修改密码
UPDATE APP_CMS.RWSYS_USER 
SET PASSWORD = 'newpass' 
WHERE USERID = 'demo';
COMMIT;

-- 修改品牌权限
UPDATE APP_CMS.RWSYS_USER 
SET CUSTOMERNO = '18405,18405-1,18405-2' 
WHERE USERID = 'demo';
COMMIT;
```

---

## 🐛 常见问题

### ❌ 问题：后端返回404
**原因**: 后端未启动或路由未注册  
**解决**: 
```bash
cd backend
npm start
# 检查是否看到: ✅ 已注册: /api/auth
```

### ❌ 问题：用户名或密码错误
**原因**: 
1. 数据库中没有该用户
2. 密码不匹配
3. 账号被停用（ACTIVE_FLAG='N'）

**解决**:
```bash
# 检查用户是否存在
npm run verify:auth

# 或手动查询
sqlplus user/pass@db
SELECT * FROM APP_CMS.RWSYS_USER WHERE USERID = 'testuser';
```

### ❌ 问题：数据库连接失败
**原因**: `.env` 配置错误或数据库未启动  
**解决**:
```bash
# 检查环境变量
cat backend/.env

# 测试连接
npm run db:test
```

### ❌ 问题：前端一直用Mock认证
**原因**: 使用了 `admin/admin123`  
**解决**: 使用其他测试账号，如 `testuser/testpass`

---

## 🔒 安全提示

⚠️ **当前实现使用明文密码，仅适用于开发/测试环境**

**生产环境建议**:
1. 使用 **bcrypt** 加密密码
2. 实施 **JWT Token** 机制
3. 添加 **会话超时** 管理
4. 启用 **HTTPS** 加密传输
5. 实施 **防暴力破解** 机制

---

## 📚 相关文件

- `/backend/setup-test-users.sql` - 创建测试账号SQL
- `/backend/verify-auth.js` - 认证功能验证脚本
- `/backend/test-login.js` - 单个账号登录测试
- `/backend/src/routes/auth.js` - 认证API实现
- `/contexts/AuthContext.tsx` - 前端认证上下文
- `/components/AuthDebugger.tsx` - 认证调试工具

---

## ✅ 验证清单

- [ ] 数据库连接正常（`npm run db:test`）
- [ ] RWSYS_USER表存在且有测试数据（`npm run verify:auth`）
- [ ] 后端API服务器启动成功（`npm start`）
- [ ] GET /api/auth/login 返回使用说明
- [ ] POST /api/auth/login 可以成功登录
- [ ] 前端Mock认证工作（admin/admin123）
- [ ] 前端数据库认证工作（testuser/testpass）
- [ ] 调试工具可以正常使用（🔧 Dev Tools）

全部打勾？恭喜！认证功能已完全配置好！🎉
