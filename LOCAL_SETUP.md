# VF 物流分析仪表板 - 本地运行指南

## 🚀 快速开始

这是一个基于 React + TypeScript + Tailwind CSS 构建的现代化物流分析仪表板，专为 VF Corporation 的物流运营而设计。

### 📋 前置要求

确保您的开发环境已安装以下工具：

- **Node.js** >= 18.0.0 (推荐使用 LTS 版本)
- **npm** >= 9.0.0 或 **yarn** >= 1.22.0
- **Git** (用于版本控制)
- 现代浏览器 (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### 📦 安装步骤

1. **克隆或下载项目**
   ```bash
   # 如果有Git仓库
   git clone <repository-url>
   cd vf-logistics-dashboard
   
   # 或者直接下载解压到项目目录
   ```

2. **安装依赖**
   ```bash
   # 使用 npm (推荐)
   npm install
   
   # 或使用 yarn
   yarn install
   
   # 如果遇到依赖冲突，可以使用
   npm install --legacy-peer-deps
   ```

3. **环境配置**
   ```bash
   # 复制环境变量模板
   cp .env.example .env
   
   # 根据需要编辑 .env 文件
   ```

4. **启动开发服务器**
   ```bash
   # 使用 npm
   npm run dev
   
   # 或使用 yarn
   yarn dev
   ```

5. **访问应用**
   ```
   打开浏览器访问: http://localhost:3000
   ```

## 🛠️ 可用脚本

- `npm run dev` - 启动开发服务器 (热重载)
- `npm run build` - 构建生产版本
- `npm run preview` - 预览生产构建
- `npm run lint` - 运行代码检查
- `npm run type-check` - TypeScript 类型检查

## 📁 项目结构

```
vf-logistics-dashboard/
├── 📄 App.tsx                 # 主应用组件
├── 📁 components/             # UI组件库
│   ├── 📁 pages/             # 页面组件
│   ├── 📁 ui/                # shadcn/ui 基础组件
│   └── ...                   # 业务组件
├── 📁 data/                  # 数据层 (Mock数据)
├── 📁 utils/                 # 工具函数
├── 📁 styles/                # 样式文件
├── 📁 docs/                  # 项目文档
└── 📄 package.json           # 项目配置
```

## 🎨 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | 前端框架 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 3.x | 样式框架 |
| shadcn/ui | Latest | UI组件库 |
| Recharts | 2.x | 图表可视化 |
| Lucide React | Latest | 图标库 |
| Vite | 5.x | 构建工具 |
| Framer Motion | 10.x | 动画库 |

## 🔧 开发配置

### 代码风格
项目使用 ESLint + TypeScript 进行代码质量控制：
```bash
npm run lint  # 检查代码风格
```

### 热重载
开发服务器支持热重载，修改代码后浏览器会自动刷新。

### 路径别名
项目配置了路径别名，可以使用简化的导入路径：
```typescript
// ✅ 推荐
import { Button } from "@/components/ui/button"
import { filterData } from "@/utils/dataFilter"

// ❌ 避免
import { Button } from "../../components/ui/button"
```

## 🎯 功能特性

### 📊 数据分析模块
- **订单总览** - KPI指标和趋势分析
- **物流监控** - 全程跟踪和异常监控
- **地域分析** - 基于中国地图的地域数据可视化
- **异常监控** - 实时异常检测和报警
- **趋势分析** - 历史数据趋势和预测
- **重量分析** - 包裹重量分布分析

### 🎨 UI/UX 特性
- **响应式设计** - 支持桌面和移动设备
- **深色/浅色主题** - 自动适配系统主题
- **Maersk 设计系统** - 完整的品牌设计规范
- **无障碍支持** - 符合 WCAG 2.1 标准
- **国际化支持** - 中英文界面切换

### 🔄 数据处理
- **实时数据** - 模拟实时数据更新
- **智能筛选** - 多维度数据筛选
- **数据导出** - 支持 Excel/PDF 导出
- **缓存优化** - 智能数据缓存策略

## 🐛 常见问题

### 依赖冲突错误
如果遇到 `ERESOLVE unable to resolve dependency tree` 错误：
```bash
# 方法1: 使用legacy-peer-deps
npm install --legacy-peer-deps

# 方法2: 清除缓存重新安装
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# 方法3: 使用yarn
yarn install
```

### 端口占用
如果 3000 端口被占用，Vite 会自动使用下一个可用端口，或者手动指定：
```bash
npm run dev -- --port 3001
```

### TypeScript 错误
确保安装了所有类型依赖：
```bash
npm run type-check
```

### 样式不生效
检查 Tailwind CSS 配置，确保 globals.css 正确导入：
```typescript
// src/main.tsx
import '../styles/globals.css'
```

### 图片导入错误
如果遇到图片导入问题，请检查：
```bash
# 确保Vite配置正确
# 检查静态资源是否在public目录
# 验证导入路径是否正确
```

## 🔒 数据安全

- 当前版本使用 **Mock 数据**，无真实数据传输
- 所有数据处理在客户端完成
- 不涉及用户隐私信息收集
- 符合 GDPR 和相关数据保护法规

## 📱 浏览器支持

| 浏览器 | 最低版本 | 推荐版本 |
|--------|----------|----------|
| Chrome | 90+ | Latest |
| Firefox | 88+ | Latest |
| Safari | 14+ | Latest |
| Edge | 90+ | Latest |

## 🤝 开发建议

### 代码规范
- 使用 TypeScript 严格模式
- 遵循 React Hooks 最佳实践
- 组件保持单一职责原则
- 使用语义化的命名规范

### 性能优化
- 使用 React.memo 优化重渲染
- 合理使用 useMemo 和 useCallback
- 组件懒加载 (React.lazy)
- 图片懒加载优化

### 测试建议
- 关键业务逻辑添加单元测试
- UI组件集成测试
- 端到端测试覆盖主要流程

## 📞 技术支持

如果遇到技术问题，请：

1. 检查 [常见问题](#-常见问题) 部分
2. 查看项目 [文档目录](./docs/) 
3. 检查浏览器控制台错误信息
4. 确认 Node.js 和 npm 版本符合要求

## 🔄 更新日志

### v1.0.0 (2025-01-07)
- ✅ 修复依赖冲突问题
- ✅ 升级到 Vite 5.x + Tailwind CSS 3.x
- ✅ 优化项目配置和构建性能
- ✅ 完善错误处理和用户体验

## 📄 许可证

本项目为 VF Corporation 内部项目，遵循公司内部许可证协议。

---

**🎉 祝您使用愉快！**

*Powered by Maersk Technology Solutions*