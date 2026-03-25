/**
 * VF物流数据分析平台 - API服务器
 * 
 * 提供RESTful API服务，支持Oracle数据库连接
 * 为前端React应用提供数据接口
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { testConnection, initializeDatabase } = require('./config/database-api');

// 路由导入
const overviewRoutes = require('./routes/overview');
const regionalRoutes = require('./routes/regional');
const trendsRoutes = require('./routes/trends');
const logisticsRoutes = require('./routes/logistics');
const uploadRoutes = require('./routes/upload-commonjs');
const diagnosticRoutes = require('./routes/bas-area-diagnostic');
const authRoutes = require('./routes/auth'); // 新增认证路由
const orderDetailsRoutes = require('./routes/order-details'); // 🔥 订单明细导出路由
const exceptionAnalysisRoutes = require('./routes/exception-analysis'); // 🔥 异常监控分析路由

// 🔍 调试：检查 authRoutes 是否正确导入
console.log('🔍 调试信息:');
console.log('   authRoutes 类型:', typeof authRoutes);
console.log('   authRoutes 是否为 undefined:', authRoutes === undefined);
console.log('   authRoutes 是否为 null:', authRoutes === null);
if (authRoutes && authRoutes.stack) {
  console.log('   authRoutes 路由数量:', authRoutes.stack.length);
}

const app = express();
const PORT = process.env.API_PORT || 3001;

/**
 * 中间件配置
 */
const isProduction = process.env.NODE_ENV === 'production';
const helmetConfig = isProduction
  ? {
      // 在生产环境启用内容安全策略，尽量减少 XSS 等风险
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'"],
          "img-src": ["'self'", "data:"],
          "connect-src": ["'self'"],
          "frame-ancestors": ["'self'"]
        }
      },
      // 如需兼容跨源资源（如 WebAssembly、SharedArrayBuffer），可根据需要调整该配置
      crossOriginEmbedderPolicy: false
    }
  : {
      // 开发环境下放宽 CSP（如需完全禁用可将 contentSecurityPolicy 设为 false）
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'", "*"],
          "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "*"],
          "style-src": ["'self'", "'unsafe-inline'", "*"],
          "img-src": ["'self'", "data:", "*"],
          "connect-src": ["'self'", "*"],
          "frame-ancestors": ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false
    };

app.use(helmet(helmetConfig));

app.use(compression()); // 启用Gzip压缩

// CORS配置 - 允许前端域名访问
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 请求解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// API速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 每个IP最多1000次请求
  message: {
    error: '请求过于频繁',
    message: '请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

/**
 * API路由注册
 */
console.log('🔧 注册API路由...');
app.use('/api/overview', overviewRoutes);
console.log('✅ 已注册: /api/overview');
app.use('/api/regional', regionalRoutes);
console.log('✅ 已注册: /api/regional');
app.use('/api/trends', trendsRoutes);
console.log('✅ 已注册: /api/trends');
app.use('/api/logistics', logisticsRoutes);
console.log('✅ 已注册: /api/logistics');
app.use('/api/upload', uploadRoutes);
console.log('✅ 已注册: /api/upload');
app.use('/api/diagnostic', diagnosticRoutes);
console.log('✅ 已注册: /api/diagnostic');
app.use('/api/auth', authRoutes); // 注册认证路由
console.log('✅ 已注册: /api/auth');
app.use('/api/order-details', orderDetailsRoutes); // 注册订单明细导出路由
console.log('✅ 已注册: /api/order-details');
app.use('/api/exception-analysis', exceptionAnalysisRoutes); // 注册异常监控分析路由
console.log('✅ 已注册: /api/exception-analysis');
console.log('📋 所有路由注册完成\n');

/**
 * 健康检查端点
 */
app.get('/api/health', async (req, res) => {
  try {
    // 测试数据库连接
    const dbStatus = await testConnection();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: dbStatus ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      database: 'error'
    });
  }
});

/**
 * API信息端点
 */
app.get('/api/info', (req, res) => {
  res.json({
    name: 'VF物流数据分析平台API',
    version: '1.0.0',
    description: 'VF物流数据分析平台后端API服务',
    endpoints: {
      overview: {
        '/api/overview/kpi': '获取总览KPI指标',
        '/api/overview/status-distribution': '获取状态分布统计',
        '/api/overview/exceptions': '获取实时异常监控数据'
      },
      regional: {
        '/api/regional/provinces': '获取省份订单分布数据',
        '/api/regional/cities': '获取城市排名数据',
        '/api/regional/efficiency': '获取地域配送效率分析'
      },
      trends: {
        '/api/trends/orders': '获取订单量趋势数据',
        '/api/trends/brands': '获取品牌趋势对比数据',
        '/api/trends/efficiency': '获取配送效率趋势',
        '/api/trends/platforms': '获取平台趋势数据'
      },
      logistics: {
        '/api/logistics/couriers': '获取快递商性能统计',
        '/api/logistics/weight-distribution': '获取重量分布分析',
        '/api/logistics/nodes': '获取物流节点监控数据'
      },
      upload: {
        '/api/upload/timeliness-excel': '上传时效Excel表格 (POST)',
        '/api/upload/city-mapping': '获取城市映射信息 (GET)',
        '/api/upload/dest-city-lookup': '查询DEST_CITY代码对应城市 (GET)',
        '/api/upload/validate-format': '验证Excel文件格式 (POST)',
        '/api/upload/analyze-timeliness': '执行时效分析计算 (POST)',
        '/api/upload/sla-matching-status': '获取SLA匹配状态 (GET)',
        '/api/upload/history': '获取上传历史记录 (GET)'
      },
      exceptionAnalysis: {
        '/api/exception-analysis/overview': '获取异常监控分析总览 (GET)',
        '/api/exception-analysis/carrier/:name': '获取指定快递商的异常明细 (GET)'
      },
      system: {
        '/api/health': '健康检查',
        '/api/info': 'API信息'
      }
    },
    database: {
      type: 'Oracle',
      schema: 'APP_CMS',
      tables: ['TSK_LIST_TASK', 'BAS_CODES', 'DOC_COMPLAINT']
    },
    supportedBrands: ['DICKIES', 'TNF', 'ICEBREAKER', 'VANS', 'TIMBERLAND', 'SMARTWOOL'],
    supportedDateFormats: ['YYYY-MM-DD'],
    rateLimits: {
      requests: '1000 per 15 minutes per IP',
      window: '15 minutes'
    }
  });
});

/**
 * 404处理
 */
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API端点不存在',
    message: `路径 ${req.path} 未找到`,
    availableEndpoints: '/api/info'
  });
});

/**
 * 全局错误处理中间件
 */
app.use((error, req, res, next) => {
  console.error('API错误:', error);
  
  // Oracle数据库连接错误
  if (error.code && error.code.startsWith('ORA-')) {
    return res.status(503).json({
      error: '数据库连接错误',
      message: '暂时无法连接到数据库，请稍后重试',
      code: error.code
    });
  }
  
  // 请求超时错误
  if (error.code === 'TIMEOUT') {
    return res.status(408).json({
      error: '请求超时',
      message: '数据查询超时，请缩小查询范围后重试'
    });
  }
  
  // 默认服务器错误
  res.status(500).json({
    error: '服务器内部错误',
    message: '服务器遇到了一个意外的情况',
    requestId: req.headers['x-request-id'] || 'unknown',
    timestamp: new Date().toISOString()
  });
});

/**
 * 优雅关闭处理
 */
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，开始优雅关闭...');
  
  const server = app.listen(PORT);
  server.close(() => {
    console.log('HTTP服务器已关闭');
    process.exit(0);
  });
  
  // 强制关闭超时
  setTimeout(() => {
    console.error('强制关闭服务器');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，开始优雅关闭...');
  process.exit(0);
});

/**
 * 启动服务器
 */
async function startServer() {
  try {
    // ✅ 初始化数据库连接池
    console.log('================================================================================');
    console.log('🔧 正在初始化数据库连接池...');
    await initializeDatabase();
    
    // 测试数据库连接
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.warn('⚠️  数据库连接失败，API服务器将在有限功能模式下启动');
    } else {
      console.log('✅ 数据库连接成功');
    }
    console.log('================================================================================');
    
    const server = app.listen(PORT, () => {
      console.log('🚀 VF物流数据分析平台API服务器启动成功');
      console.log(`📡 服务器地址: http://localhost:${PORT}`);
      console.log(`📊 API文档: http://localhost:${PORT}/api/info`);
      console.log(`💓 健康检查: http://localhost:${PORT}/api/health`);
      console.log(`🔍 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📦 版本: 1.0.0`);
      console.log('================================================================================');
    });
    
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${PORT} 已被占用，请检查是否有其他服务正在运行`);
      } else {
        console.error('❌ 服务器启动失败:', error);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ 启动服务器时发生错误:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  startServer();
}

module.exports = app;