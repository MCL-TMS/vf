import express from 'express';
import { executeQuery } from '../config/database.js';

const router = express.Router();

// 🔧 共享工具函数 - 与logistics-esm.js保持一致
const QueryUtils = {
  // 🔥 移除硬编码的品牌范围限制
  BASE_WHERE_CONDITIONS: `
    AND t.WMS_OUTBOUND_TIME IS NOT NULL
  `,
  
  // 异常条件SQL片段
  EXCEPTION_SQL_FRAGMENTS: {
    // 超时未揽收（出库后24小时未揽收）
    PICKUP_TIMEOUT: `(
      t.DIS_STATUS < '55' 
      AND t.WMS_OUTBOUND_TIME IS NOT NULL 
      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 24
    )`,
    
    // 超时未发运（揽收后24小时未发运）
    SHIPPING_TIMEOUT: `(
      t.DIS_STATUS = '55' 
      AND t.CARRIER_PICKUP_TIME IS NOT NULL 
      AND (SYSDATE - t.CARRIER_PICKUP_TIME) * 24 > 24
    )`,
    
    // 超时未签收（发运后72小时未签收）
    DELIVERY_TIMEOUT: `(
      t.DIS_STATUS = '70' 
      AND t.SEND_TIME IS NOT NULL 
      AND (SYSDATE - t.SEND_TIME) * 24 > 72
    )`,
    
    // 超48小时未更新
    NO_UPDATE_48H: `(
      t.DIS_STATUS NOT IN ('95', '100', '105', '90', '110')
      AND t.TRACKTIME IS NOT NULL 
      AND (SYSDATE - t.TRACKTIME) * 24 > 48
    )`
  }
};

/**
 * 🔥 订单明细导出API
 * GET /api/order-details/export
 * 
 * 功能：根据筛选条件获取订单原始数据（Raw Data）
 * 用途：Excel导出、数据分析、报表生成
 * 
 * 查询参数：
 * - startDate: 开始日期 (YYYY-MM-DD)
 * - endDate: 结束日期 (YYYY-MM-DD)
 * - brand: 品牌代码 (18405, 18405-1, 等)
 * - platform: 平台名称 (天猫, 京东, 抖音, 等)
 * - selfFlag: 自管标识 (Y/N/all)
 * - userBrands: 用户权限品牌 (逗号分隔)
 * - limit: 导出数量限制 (默认10000，最大50000)
 */
router.get('/export', async (req, res) => {
  try {
    console.log('\n📦 ========================================');
    console.log('📋 订单明细导出请求');
    console.log('========================================');
    
    // 解析查询参数
    const { 
      startDate, 
      endDate, 
      brand, 
      platform, 
      selfFlag = 'Y',
      userBrands,
      limit = '10000'
    } = req.query;
    
    console.log('📅 查询参数:', {
      startDate,
      endDate,
      brand,
      platform,
      selfFlag,
      userBrands,
      limit
    });
    
    // 参数验证
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数：startDate 和 endDate'
      });
    }
    
    // 导出数量限制
    const exportLimit = Math.min(parseInt(limit, 10) || 10000, 50000);
    
    // 构建筛选条件
    const params = [];
    let paramIndex = 1;
    
    // 日期范围筛选
    let dateFilter = '';
    if (startDate && endDate) {
      params.push(startDate);
      params.push(endDate);
      dateFilter = `AND t.WMS_OUTBOUND_TIME >= TO_DATE(:${paramIndex}, 'YYYY-MM-DD') 
                    AND t.WMS_OUTBOUND_TIME < TO_DATE(:${paramIndex + 1}, 'YYYY-MM-DD') + 1`;
      paramIndex += 2;
    }
    
    // 品牌筛选
    let brandFilter = '';
    if (brand && brand !== 'all') {
      params.push(brand);
      brandFilter = `AND t.CUSTOMERNO = :${paramIndex}`;
      paramIndex++;
    } else if (userBrands && userBrands !== 'all') {
      // 用户权限品牌筛选
      const brandList = userBrands.split(',').map(b => b.trim()).filter(Boolean);
      if (brandList.length > 0) {
        const brandPlaceholders = brandList.map((_, index) => `:brand${index}`).join(', ');
        brandList.forEach((brandCode, index) => {
          params.push(brandCode);
        });
        brandFilter = `AND t.CUSTOMERNO IN (${brandPlaceholders})`;
      }
    }
    
    // 平台筛选
    let platformFilter = '';
    if (platform && platform !== 'all') {
      params.push(platform);
      platformFilter = `AND t.PLATFORM_CLASS = :${paramIndex}`;
      paramIndex++;
    }
    
    // 自管筛选
    let selfFlagFilter = '';
    if (selfFlag && selfFlag !== 'all') {
      params.push(selfFlag);
      selfFlagFilter = `AND t.SELF_FLAG = :${paramIndex}`;
      paramIndex++;
    }
    
    console.log('🔍 SQL参数:', params);
    
    // 🔥 订单明细查询SQL
    const orderDetailsQuery = `
      SELECT 
        -- 订单基本信息
        t.TSK_MERGE_NO as order_no,
        t.CUSTOMERNO as customer_no,
        COALESCE(bc.COMPANY_ABNAME, t.CUSTOMERNO) as brand_name,
        
        -- 平台信息
        t.PLATFORM_CLASS as platform,
        t.SELF_FLAG as self_flag,
        
        -- 快递信息
        t.CARRIERID as carrier_id,
        t.CARRIER as carrier_name,
        t.WAYBILL as tracking_no,
        
        -- 收货地址
        t.DEST_PROVINCE as dest_province,
        t.DEST_CITY as dest_city,
        t.DEST_AREA as dest_area,
        t.CONSIGNEE as consignee,
        t.CONSIGNEE_PHONE as phone,
        
        -- 订单状态
        t.DIS_STATUS as order_status,
        CASE 
          WHEN t.DIS_STATUS = '10' THEN '已下单'
          WHEN t.DIS_STATUS = '40' THEN '已出库'
          WHEN t.DIS_STATUS = '55' THEN '已揽收'
          WHEN t.DIS_STATUS = '70' THEN '已发运'
          WHEN t.DIS_STATUS = '95' THEN '已签收'
          ELSE '其他'
        END as order_status_name,
        
        -- 时间信息
        TO_CHAR(t.CREATE_TIME, 'YYYY-MM-DD HH24:MI:SS') as create_time,
        TO_CHAR(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD HH24:MI:SS') as outbound_time,
        TO_CHAR(t.DISP_TIME, 'YYYY-MM-DD HH24:MI:SS') as dispatch_time,
        TO_CHAR(t.CARRIER_PICKUP_TIME, 'YYYY-MM-DD HH24:MI:SS') as pickup_time,
        TO_CHAR(t.SEND_TIME, 'YYYY-MM-DD HH24:MI:SS') as send_time,
        TO_CHAR(t.DELIVERY_TIME, 'YYYY-MM-DD HH24:MI:SS') as delivery_time,
        TO_CHAR(t.TRACKTIME, 'YYYY-MM-DD HH24:MI:SS') as last_track_time,
        
        -- 时效数据
        t.SUM_SEND_TIME2 as actual_delivery_hours,
        t.PLAN_TIMELINESS as plan_timeliness,
        
        -- 转寄标识
        t.TR_FLAG as address_change_flag,
        t.TR_FLAG2 as out_of_range_flag,
        
        -- 异常标识
        CASE 
          WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN 'Y' 
          ELSE 'N' 
        END as pickup_timeout,
        CASE 
          WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN 'Y' 
          ELSE 'N' 
        END as shipping_timeout,
        CASE 
          WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN 'Y' 
          ELSE 'N' 
        END as delivery_timeout,
        CASE 
          WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN 'Y' 
          ELSE 'N' 
        END as no_update_48h,
        
        -- 商品信息
        t.ITEMNUMBER as item_number,
        t.QTY as quantity,
        t.LOGISTICS_REMARKS as remarks
        
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_COMPANY bc ON t.CUSTOMERNO = bc.COMPANY_SYSID
      WHERE 1=1
        ${QueryUtils.BASE_WHERE_CONDITIONS}
        ${dateFilter}
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
        AND ROWNUM <= :exportLimit
      ORDER BY t.WMS_OUTBOUND_TIME DESC
    `;
    
    // 添加导出数量限制参数
    params.push(exportLimit);
    
    console.log('🔍 执行查询...');
    const startTime = Date.now();
    
    const result = await executeQuery(orderDetailsQuery, params);
    
    const endTime = Date.now();
    console.log(`✅ 查询完成，耗时: ${endTime - startTime}ms`);
    console.log(`📊 返回记录数: ${result.rows.length}`);
    
    // 转换为对象数组
    const orderDetails = result.rows.map(row => ({
      orderNo: row[0],
      customerNo: row[1],
      brandName: row[2],
      platform: row[3],
      selfFlag: row[4],
      carrierId: row[5],
      carrierName: row[6],
      trackingNo: row[7],
      destProvince: row[8],
      destCity: row[9],
      destArea: row[10],
      consignee: row[11],
      phone: row[12],
      orderStatus: row[13],
      orderStatusName: row[14],
      createTime: row[15],
      outboundTime: row[16],
      dispatchTime: row[17],
      pickupTime: row[18],
      sendTime: row[19],
      deliveryTime: row[20],
      lastTrackTime: row[21],
      actualDeliveryHours: row[22],
      planTimeliness: row[23],
      addressChangeFlag: row[24],
      outOfRangeFlag: row[25],
      pickupTimeout: row[26],
      shippingTimeout: row[27],
      deliveryTimeout: row[28],
      noUpdate48h: row[29],
      itemNumber: row[30],
      quantity: row[31],
      remarks: row[32]
    }));
    
    console.log('✅ 订单明细导出成功');
    console.log('========================================\n');
    
    res.json({
      success: true,
      data: orderDetails,
      metadata: {
        totalRecords: orderDetails.length,
        exportLimit: exportLimit,
        filters: {
          startDate,
          endDate,
          brand: brand || 'all',
          platform: platform || 'all',
          selfFlag: selfFlag || 'Y'
        },
        exportTime: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ 订单明细导出失败:', error);
    console.error('详细错误:', error.stack);
    console.log('========================================\n');
    
    res.status(500).json({
      success: false,
      error: '订单明细导出失败',
      details: error.message
    });
  }
});

export default router;