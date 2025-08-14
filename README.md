# VF 物流分析仪表板

这是一个基于 React、TypeScript 和 Tailwind CSS 构建的物流分析仪表板，专为 VF Corporation 的物流运营而设计。

## 功能特性

- 📊 **订单总览**: 实时显示订单状态、KPI指标和品牌分析
- 🚚 **物流监控**: 全程跟踪快递公司表现和异常监控
- 🗺️ **地域分析**: 基于中国地图的可视化地域数据分析
- ⚠️ **异常监控**: 实时监控和分析物流异常情况
- 📈 **趋势分析**: 历史数据趋势和未来预测分析
- ⚖️ **重量分析**: 包裹重量分布和影响分析

## 技术栈

- **前端框架**: React 18 + TypeScript
- **样式系统**: Tailwind CSS v4.0 + Maersk Design System
- **UI组件**: shadcn/ui 组件库
- **图表库**: Recharts
- **图标**: Lucide React
- **构建工具**: Vite
- **数据**: 模拟数据（Mock Data）

## 项目结构

```
├── App.tsx                 # 主应用组件
├── components/             # UI组件
│   ├── pages/             # 页面组件
│   ├── ui/                # shadcn/ui 基础组件
│   └── ...                # 业务组件
├── data/                  # 数据层
├── utils/                 # 工具函数
├── styles/                # 样式文件
└── docs/                  # 文档
```

## 快速开始

1. 安装依赖
```bash
npm install
```

2. 启动开发服务器
```bash
npm run dev
```

3. 构建生产版本
```bash
npm run build
```

## 特色功能

### 马士基品牌设计系统
项目采用完整的马士基设计系统，包括：
- 品牌色彩规范
- 统一的组件样式
- 响应式布局设计

### 数据筛选与联动
- 支持品牌和平台多维度筛选
- 页面间数据联动
- 异常监控与物流跟踪联动

### 可视化分析
- 交互式图表和地图
- 实时数据更新
- 多种图表类型支持

## 浏览器支持

- Chrome (推荐)
- Firefox
- Safari
- Edge

## 许可证

© 2025 Maersk. All rights reserved.