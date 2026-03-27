import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase } from './config/database.js';
import { forceHttps, securityHeaders } from './middleware/httpsMiddleware.mjs'; // 🔥 新增：HTTPS中间件

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

// 🔥 安全中间件配置（顺序很重要！）
// 1. HTTPS强制（生产环境）
app.use(forceHttps);

// 2. 安全响应头
app.use(securityHeaders);

// 3. Helmet安全头（保留原有）
app.use(helmet());

// 4. 压缩响应
app.use(compression());

// 5. 日志记录
app.use(morgan('combined'));

// CORS配置
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 根路由 - 健康检查
app.get('/', (req, res) => {
  res.json({
    message: 'VF物流数据分析平台后端服务',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 健康检查路由
app.get('/health', async (req, res) => {
  try {
    // 这里可以添加数据库连接检查
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'connected' // 后续可以添加实际的数据库检查
    };
    
    res.json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// 🔥 API路由注册
// 导入和注册各个路由模块
import overviewRouter from './routes/overview.js';
import overviewWithTrendsRouter from './routes/overview-with-trends.js';
import logisticsRouter from './routes/logistics-esm.js';  // 🔥 使用ES6模块版本
import uploadRouter from './routes/upload.js';  // 🔥 文件上传路由
import authRouter from './routes/auth-esm.js';  // 🔥 认证路由 (ES6版本)
import brandsRouter from './routes/brands-esm.js';  // 🔥 品牌映射路由 (ES6版本)
import platformsRouter from './routes/platforms-esm.js';  // 🔥 平台映射路由 (ES6版本)
import orderDetailsRouter from './routes/order-details.mjs';  // 🔥 订单明细导出路由 (MJS版本)
import exceptionAnalysisRouter from './routes/exception-analysis.js';  // 🔥 异常监控分析路由
// import regionalRouter from './routes/regional.js';
// import trendsRouter from './routes/trends.js';

// 🔥 新增：导入JWT认证中间件（需要先创建ES6版本）
import { verifyToken } from './middleware/authMiddleware.mjs';

// 注册API路由
app.use('/api/auth', authRouter);  // 🔥 注册认证路由（必须在其他路由之前，不需要认证）
app.use('/api/brands', brandsRouter);  // 🔥 品牌映射路由（不需要认证，用于登录前加载选项）
app.use('/api/platform', platformsRouter);  // 🔥 平台映射路由（不需要认证）

// 🔥 受保护的路由 - 需要JWT认证
app.use('/api/overview', verifyToken, overviewRouter);  // 总览数据（需要认证）
app.use('/api/overview', verifyToken, overviewWithTrendsRouter);  // 总览趋势数据（需要认证）
app.use('/api/logistics', verifyToken, logisticsRouter);  // 🔥 关键：注册物流路由（需要认证）
app.use('/api/upload', verifyToken, uploadRouter);  // 🔥 文件上传路由（需要认证）
app.use('/api/order-details', verifyToken, orderDetailsRouter);  // 🔥 订单明细导出路由（需要认证）
app.use('/api/exception-analysis', verifyToken, exceptionAnalysisRouter);  // 🔥 异常监控分析路由（需要认证）
// app.use('/api/regional', regionalRouter);    // 地域分析路由
// app.use('/api/trends', trendsRouter);        // 趋势分析路由

// 添加健康检查到API路由中
app.get('/api/health', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'connected'
    };
    
    res.json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API路由 - 测试端点
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API测试端点',
    timestamp: new Date().toISOString(),
    data: {
      status: 'ok',
      version: '1.0.0'
    }
  });
});

// 数据库连接测试路由
app.get('/api/db/test', async (req, res) => {
  try {
    const { executeQuery } = await import('./config/database.js');
    
    const result = await executeQuery(`
      SELECT 
        'Database Connection Test' as MESSAGE,
        SYSDATE as CURRENT_TIME,
        USER as DATABASE_USER,
        SYS_CONTEXT('USERENV', 'DB_NAME') as DATABASE_NAME
      FROM DUAL
    `);
    
    res.json({
      status: 'success',
      message: '数据库连接测试成功',
      data: result.rows[0],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('数据库测试失败:', error);
    res.status(500).json({
      status: 'error',
      message: '数据库连接测试失败',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 获取数据库统计信息路由
app.get('/api/db/stats', async (req, res) => {
  try {
    const { executeQuery } = await import('./config/database.js');
    
    // 获取基本的数据库统计信息
    const queries = [
      {
        name: 'basic_info',
        sql: `
          SELECT 
            SYSDATE as CURRENT_TIME,
            USER as CURRENT_USER,
            SYS_CONTEXT('USERENV', 'DB_NAME') as DATABASE_NAME,
            SYS_CONTEXT('USERENV', 'SERVER_HOST') as SERVER_HOST
          FROM DUAL
        `
      },
      {
        name: 'table_count',
        sql: `
          SELECT COUNT(*) as TABLE_COUNT
          FROM USER_TABLES
        `
      }
    ];
    
    const results = {};
    
    for (const query of queries) {
      try {
        const result = await executeQuery(query.sql);
        results[query.name] = result.rows[0] || {};
      } catch (queryError) {
        console.warn(`查询 ${query.name} 失败:`, queryError.message);
        results[query.name] = { error: queryError.message };
      }
    }
    
    res.json({
      status: 'success',
      message: '数据库统计信息获取成功',
      data: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('获取数据库统计信息失败:', error);
    res.status(500).json({
      status: 'error',
      message: '获取数据库统计信息失败',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: '请求的资源不存在',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// 全局错误处理
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  
  res.status(500).json({
    status: 'error',
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? error.message : '请联系管理员',
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库连接
    console.log('🔧 正在初始化数据库连接...');
    await initializeDatabase();
    console.log('✅ 数据库连接池初始化成功');
    
    // 启动HTTP服务器
    const server = app.listen(PORT, HOST, () => {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 VF物流数据分析平台后端服务已启动');
      console.log(`📍 服务地址: http://${HOST}:${PORT}`);
      console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📅 启动时间: ${new Date().toLocaleString()}`);
      console.log('\n📋 可用端点:');
      console.log(`   GET  /                    - 服务信息`);
      console.log(`   GET  /health              - 健康检查`);
      console.log(`   GET  /api/test            - API测试`);
      console.log(`   GET  /api/db/test         - 数据库连接测试`);
      console.log(`   GET  /api/db/stats        - 数据库统计信息`);
      console.log(`   POST /api/upload/timeliness-excel - 时效表格上传`);
      console.log(`   GET  /api/upload/history   - 上传历史记录`);
      console.log(`   GET  /api/upload/city-mapping - 城市区域映射`);
      console.log(`   POST /api/upload/validate-format - 文件格式验证`);
      console.log('='.repeat(60));
    });
    
    // 优雅关闭处理
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 接收到${signal}信号，开始优雅关闭...`);
      
      server.close(async () => {
        console.log('🔒 HTTP服务器已关闭');
        
        try {
          await closeDatabase();
          console.log('✅ 数据库连接已关闭');
        } catch (error) {
          console.error('❌ 关闭数据库连接时出错:', error);
        }
        
        console.log('👋 服务器已完全关闭');
        process.exit(0);
      });
      
      // 强制关闭超时
      setTimeout(() => {
        console.error('⏰ 优雅关闭超时，强制退出');
        process.exit(1);
      }, 10000);
    };
    
    // 注册信号处理器
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();

export { app };