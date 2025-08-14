# Oracle数据库连接故障排除指南

## 🚨 无输出问题诊断

如果运行 `npm run test` 没有任何输出，请按以下步骤排查：

### 1. 快速诊断

```bash
# 首先运行环境诊断
npm run diagnose

# 如果诊断通过，运行简化测试
npm run test-simple
```

### 2. 常见问题及解决方案

#### 问题1: 没有任何输出或静默失败

**可能原因:**
- 缺少 `.env` 配置文件
- Oracle客户端未安装或配置错误
- Node.js版本过低

**解决步骤:**
```bash
# 1. 检查.env文件
ls -la .env

# 2. 如果不存在，复制示例文件
cp .env.example .env

# 3. 编辑.env文件，配置数据库连接信息
# ORACLE_USER=your_username
# ORACLE_PASSWORD=your_password  
# ORACLE_CONNECT_STRING=localhost:1521/XE

# 4. 运行环境诊断
npm run diagnose
```

#### 问题2: oracledb模块加载失败

**错误信息:** `DPI-1047: Cannot locate a 64-bit Oracle Client library`

**解决方案:**

**Windows:**
1. 下载Oracle Instant Client: https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html
2. 解压到 `C:\oracle\instantclient_21_8`
3. 添加到系统PATH环境变量
4. 重启命令行

**Linux (Ubuntu/Debian):**
```bash
# 安装依赖
sudo apt-get update
sudo apt-get install libaio1

# 下载并安装Oracle Instant Client
wget https://download.oracle.com/otn_software/linux/instantclient/218000/instantclient-basic-linux.x64-21.8.0.0.0dbru.zip
unzip instantclient-basic-linux.x64-21.8.0.0.0dbru.zip
sudo mv instantclient_21_8 /opt/oracle/
echo 'export LD_LIBRARY_PATH=/opt/oracle/instantclient_21_8:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc
```

**macOS:**
```bash
# 使用Homebrew安装
brew tap InstantClientTap/instantclient
brew install instantclient-basic

# 或手动下载安装
# 1. 下载Oracle Instant Client for macOS
# 2. 解压到 /usr/local/lib/instantclient_21_8
# 3. 添加到环境变量
echo 'export DYLD_LIBRARY_PATH=/usr/local/lib/instantclient_21_8:$DYLD_LIBRARY_PATH' >> ~/.zshrc
source ~/.zshrc
```

#### 问题3: 数据库连接错误

**ORA-12154: TNS:could not resolve the connect identifier**
- 检查 `ORACLE_CONNECT_STRING` 格式
- 尝试: `localhost:1521/XE`, `localhost:1521/ORCL`, `localhost:1521:XE`

**ORA-01017: invalid username/password**
- 检查用户名和密码
- 确认数据库用户存在且未锁定

**ORA-12541: TNS:no listener**
- 确认Oracle数据库服务正在运行
- 检查端口1521是否正确
- 确认防火墙没有阻止连接

### 3. 测试脚本说明

#### `npm run diagnose`
- 环境检查工具
- 检查Node.js版本、依赖、配置文件
- 不连接数据库，纯环境诊断

#### `npm run test-simple`
- 简化的数据库连接测试
- 详细的调试输出
- 逐步测试每个环节

#### `npm run test`
- 标准数据库连接测试
- 全面的功能测试

#### `npm run test-db`
- 综合测试套件
- 包含连接池、性能、事务测试

### 4. 配置示例

#### .env文件配置示例

```env
# 基本配置
NODE_ENV=development
PORT=3001

# Oracle数据库配置 - 本地Oracle XE
ORACLE_USER=hr
ORACLE_PASSWORD=hr123
ORACLE_CONNECT_STRING=localhost:1521/XE

# Oracle数据库配置 - 本地Oracle标准版
ORACLE_USER=scott
ORACLE_PASSWORD=tiger
ORACLE_CONNECT_STRING=localhost:1521/ORCL

# Oracle数据库配置 - 远程数据库
ORACLE_USER=myuser
ORACLE_PASSWORD=mypassword
ORACLE_CONNECT_STRING=192.168.1.100:1521/PROD

# 完整连接描述符格式
ORACLE_CONNECT_STRING=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=XE)))

# 连接池配置
ORACLE_POOL_MIN=2
ORACLE_POOL_MAX=10
ORACLE_POOL_INCREMENT=2
ORACLE_POOL_TIMEOUT=60
```

### 5. 调试模式

启用详细日志输出：

```bash
# 设置调试模式
export DEBUG=*
npm run test-simple

# 或者直接运行
DEBUG=* npm run test-simple
```

### 6. 网络连接测试

如果怀疑是网络问题，可以先测试基本连接：

```bash
# 测试端口连通性（Windows）
telnet localhost 1521

# 测试端口连通性（Linux/macOS）
nc -zv localhost 1521

# 或使用PowerShell（Windows）
Test-NetConnection localhost -Port 1521
```

### 7. Oracle数据库状态检查

确保Oracle数据库服务正在运行：

**Windows:**
```cmd
# 检查Oracle服务
net start | findstr Oracle

# 启动Oracle服务（以管理员身份运行）
net start OracleServiceXE
net start OracleXETNSListener
```

**Linux:**
```bash
# 检查Oracle进程
ps aux | grep oracle

# 检查监听器状态
lsnrctl status

# 启动数据库
sqlplus / as sysdba
SQL> startup;
```

### 8. 获得帮助

如果以上步骤都无法解决问题，请收集以下信息：

1. 运行 `npm run diagnose` 的完整输出
2. 运行 `npm run test-simple` 的完整输出
3. 操作系统版本
4. Oracle数据库版本
5. Node.js版本
6. .env文件配置（隐藏敏感信息）

## 成功连接的标志

如果数据库连接成功，您应该看到类似以下的输出：

```
✅ Oracle数据库连接池创建成功
🔗 获取数据库连接成功
✅ 数据库基本信息获取成功:
   📅 当前时间: 2025-01-XX XX:XX:XX
   👤 当前用户: HR
   🏢 数据库名: XE
🎉 所有数据库连接测试通过！
```

一旦看到这些成功信息，就可以继续使用 `npm run dev` 启动开发服务器了。