/**
 * VF物流数据分析平台 - 趋势分析API路由（自管筛选修复版）
 * 
 * 提供时间序列数据、趋势预测、周期性分析等功能
 * ✅ 添加完整的自管筛选功能支持
 */

const express = require('express');
const router = express.Router();
const { getConnection, DateHelper } = require('../config/database-api');

/**
 * 获取订单趋势数据
 * GET /api/trends/orders
 */
router.get('/orders', async (req, res) => {
  let connection;
  
  try {
    const { dateFrom, dateTo, brand, granularity = 'day', selfFlag } = req.query;
    
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: '缺少必需的日期参数'
      });
    }

    // 参数验证
    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        error: '日期格式无效',
        message: '请提供有效的YYYY-MM-DD格式日期'
      });
    }

    // 验证granularity参数
    const validGranularities = ['day', 'week', 'month'];
    if (!validGranularities.includes(granularity)) {
      return res.status(400).json({
        error: '时间粒度参数无效',
        message: 'granularity参数必须是day、week或month之一'
      });
    }

    connection = await getConnection();
    
    // 构建筛选条件 - 添加自管筛选支持
    let brandFilter = '';
    let selfFlagFilter = '';
    const params = {
      dateFrom: dateFrom,
      dateTo: dateTo
    };
    
    if (brand && brand !== 'all') {
      const brandMapping = {
        'DICKIES': '18405',
        'TNF': '18405-1', 
        'ICEBREAKER': '18405-2',
        'VANS': '18405-3',
        'TIMBERLAND': '18405-4'
      };
      brandFilter = ` AND t.CUSTOMERNO = :brand`;
      params.brand = brandMapping[brand] || brand;
    }
    
    // 🔥 新增：自管筛选条件
    if (selfFlag && selfFlag !== 'all') {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = selfFlag;
    } else if (selfFlag === 'all') {
      selfFlagFilter = '';
    } else {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = 'Y';
    }

    // 根据粒度构建时间分组
    let timeGroupBy;
    switch (granularity) {
      case 'day':
        timeGroupBy = "to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD')";
        break;
      case 'week':
        timeGroupBy = "to_char(t.WMS_OUTBOUND_TIME, 'YYYY-\"W\"IW')";
        break;
      case 'month':
        timeGroupBy = "to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM')";
        break;
    }

    const trendsQuery = `
      SELECT 
        ${timeGroupBy} as time_period,
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '95' THEN t.TSK_MERGE_NO END) as delivered_orders,
        -- 四种核心异常的总数（基于具体业务条件）
        (COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '00' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                             AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 48 THEN t.TSK_MERGE_NO END) +
         COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                             AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 72 THEN t.TSK_MERGE_NO END) +
         COUNT(DISTINCT CASE WHEN t.IS48H_FLAG = 'Y' THEN t.TSK_MERGE_NO END) +
         COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' AND t.DISP_TIME IS NOT NULL 
                             AND (SYSDATE - t.DISP_TIME) * 24 > 72 THEN t.TSK_MERGE_NO END)) as exception_orders,
        COUNT(DISTINCT CASE WHEN t.IS48H_FLAG = 'Y' THEN t.TSK_MERGE_NO END) as timeout_48h_orders,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_hours,
        ROUND(COUNT(CASE WHEN t.DIS_STATUS = '95' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as delivery_rate,
        -- 异常率（基于四种核心异常条件）
        ROUND(
          (COUNT(CASE WHEN t.DIS_STATUS = '00' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 48 THEN 1 END) +
           COUNT(CASE WHEN t.DIS_STATUS = '55' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 72 THEN 1 END) +
           COUNT(CASE WHEN t.IS48H_FLAG = 'Y' THEN 1 END) +
           COUNT(CASE WHEN t.DIS_STATUS = '70' AND t.DISP_TIME IS NOT NULL 
                      AND (SYSDATE - t.DISP_TIME) * 24 > 72 THEN 1 END)) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) as exception_rate
      FROM APP_CMS.TSK_LIST_TASK t
      WHERE to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom
        AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo
        AND t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4')
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
        ${selfFlagFilter}
      GROUP BY ${timeGroupBy}
      ORDER BY ${timeGroupBy}
    `;

    const result = await connection.execute(trendsQuery, params);
    const trendsData = result.rows.map(row => ({
      timePeriod: row[0],
      totalOrders: row[1] || 0,
      deliveredOrders: row[2] || 0,
      exceptionOrders: row[3] || 0,
      timeout48hOrders: row[4] || 0,
      avgDeliveryHours: row[5] || 0,
      deliveryRate: row[6] || 0,
      exceptionRate: row[7] || 0
    }));

    res.json({
      success: true,
      data: trendsData,
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        granularity,
        selfFlag: selfFlag || 'Y'
      }
    });

  } catch (error) {
    console.error('订单趋势查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '获取订单趋势数据失败'
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('关闭数据库连接失败:', err);
      }
    }
  }
});

/**
 * 获取性能趋势数据
 * GET /api/trends/performance
 */
router.get('/performance', async (req, res) => {
  let connection;
  
  try {
    const { dateFrom, dateTo, brand, metric = 'delivery_rate', selfFlag } = req.query;
    
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: '缺少必需的日期参数'
      });
    }

    // 参数验证
    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        error: '日期格式无效',
        message: '请提供有效的YYYY-MM-DD格式日期'
      });
    }

    // 验证metric参数
    const validMetrics = ['delivery_rate', 'exception_rate', 'avg_delivery_time', 'first_dispatch_success_rate'];
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        error: '性能指标参数无效',
        message: 'metric参数必须是delivery_rate、exception_rate、avg_delivery_time或first_dispatch_success_rate之一'
      });
    }

    connection = await getConnection();
    
    // 构建筛选条件 - 添加自管筛选支持
    let brandFilter = '';
    let selfFlagFilter = '';
    const params = {
      dateFrom: dateFrom,
      dateTo: dateTo
    };
    
    if (brand && brand !== 'all') {
      const brandMapping = {
        'DICKIES': '18405',
        'TNF': '18405-1', 
        'ICEBREAKER': '18405-2',
        'VANS': '18405-3',
        'TIMBERLAND': '18405-4'
      };
      brandFilter = ` AND t.CUSTOMERNO = :brand`;
      params.brand = brandMapping[brand] || brand;
    }
    
    // 🔥 新增：自管筛选条件
    if (selfFlag && selfFlag !== 'all') {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = selfFlag;
    } else if (selfFlag === 'all') {
      selfFlagFilter = '';
    } else {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = 'Y';
    }

    const performanceQuery = `
      SELECT 
        to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD') as date_period,
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        ROUND(COUNT(CASE WHEN t.DIS_STATUS = '95' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as delivery_rate,
        -- 异常率（基于四种核心异常条件）
        ROUND(
          (COUNT(CASE WHEN t.DIS_STATUS = '00' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 48 THEN 1 END) +
           COUNT(CASE WHEN t.DIS_STATUS = '55' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 72 THEN 1 END) +
           COUNT(CASE WHEN t.IS48H_FLAG = 'Y' THEN 1 END) +
           COUNT(CASE WHEN t.DIS_STATUS = '70' AND t.DISP_TIME IS NOT NULL 
                      AND (SYSDATE - t.DISP_TIME) * 24 > 72 THEN 1 END)) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) as exception_rate,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_time,
        ROUND(
          COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DISP_TIME IS NOT NULL AND t.DELIVERY_TIME IS NOT NULL 
                     AND (t.DELIVERY_TIME - t.DISP_TIME) * 24 <= 8 THEN 1 END) * 100.0 / 
          NULLIF(COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DISP_TIME IS NOT NULL AND t.DELIVERY_TIME IS NOT NULL THEN 1 END), 0),
          2
        ) as first_dispatch_success_rate
      FROM APP_CMS.TSK_LIST_TASK t
      WHERE to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom
        AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo
        AND t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4')
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
        ${selfFlagFilter}
      GROUP BY to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD')
      ORDER BY to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD')
    `;

    const result = await connection.execute(performanceQuery, params);
    const performanceData = result.rows.map(row => ({
      datePeriod: row[0],
      totalOrders: row[1] || 0,
      deliveryRate: row[2] || 0,
      exceptionRate: row[3] || 0,
      avgDeliveryTime: row[4] || 0,
      firstDispatchSuccessRate: row[5] || 0
    }));

    res.json({
      success: true,
      data: performanceData,
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        metric,
        selfFlag: selfFlag || 'Y'
      }
    });

  } catch (error) {
    console.error('性能趋势查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '获取性能趋势数据失败'
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('关闭数据库连接失败:', err);
      }
    }
  }
});

module.exports = router;