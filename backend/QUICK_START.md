# VF物流后端 - 5分钟快速入门

## 🚀 超快速启动 (5分钟)

```bash
# Step 1: 进入目录并安装依赖 (2分钟)
cd backend
npm install

# Step 2: 一键配置数据库 (2分钟)
npm run setup

# Step 3: 测试连接 (30秒)
npm run quick-test

# Step 4: 启动服务 (30秒)
npm run dev
```

## 📋 配置选项

### 选项1: 本地Oracle XE (推荐新手)
```
数据库用户名: hr
数据库密码: hr
连接字符串: localhost:1521/XE
```

### 选项2: 自定义配置
按向导提示输入您的数据库信息

## ✅ 验证成功

当您看到以下信息表示配置成功：

```
🎉 全部测试通过! (4/4)
✅ 系统已准备就绪，可以启动服务:
   npm run dev
```

## 🆘 遇到问题？

| 问题 | 解决方案 |
|------|----------|
| Oracle Client错误 | 安装Oracle Instant Client |
| 连接失败 | 检查数据库服务是否运行 |
| 环境变量问题 | 重新运行 `npm run setup` |
| 其他问题 | 运行 `npm run diagnose` |

## 📞 快速帮助

- `npm run quick-test` - 检查配置状态
- `npm run diagnose` - 详细诊断问题
- `npm run setup` - 重新配置

**完成！您的VF物流后端已准备就绪 🎉**