-- 测试四种异常条件的数据分布
-- 目的：诊断为什么只有"超48h未更新"有数据，其他三种异常都是0

-- 测试日期范围：2025-02-01 至 2025-02-11
-- 品牌：DICKIES (18405)

-- ============================================
-- 1. 超时未揽收 (PICKUP_TIMEOUT)
-- ============================================
-- 条件：出库时间后2小时，订单状态仍为'00'(已出库)
SELECT 
  '超时未揽收' as exception_type,
  COUNT(DISTINCT t.TSK_MERGE_NO) as exception_count,
  COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '00' THEN t.TSK_MERGE_NO END) as status_00_count,
  COUNT(DISTINCT CASE WHEN (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2 THEN t.TSK_MERGE_NO END) as timeout_2h_count,
  MIN(t.WMS_OUTBOUND_TIME) as earliest_outbound,
  MAX(t.WMS_OUTBOUND_TIME) as latest_outbound,
  ROUND((SYSDATE - MAX(t.WMS_OUTBOUND_TIME)) * 24, 2) as hours_since_latest
FROM APP_CMS.TSK_LIST_TASK t
WHERE to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= '2025-02-01'
  AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') < '2025-02-12'
  AND t.WMS_OUTBOUND_TIME IS NOT NULL
  AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4')
  AND t.TSK_MERGE_NO IS NOT NULL
  -- 超时未揽收条件
  AND t.WMS_OUTBOUND_TIME IS NOT NULL 
  AND t.DIS_STATUS = '00' 
  AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2;

-- ============================================
-- 2. 超时未发运 (SHIPPING_TIMEOUT)
-- ============================================
-- 条件：出库时间后12小时，订单状态仍为'55'(已揽收)
SELECT 
  '超时未发运' as exception_type,
  COUNT(DISTINCT t.TSK_MERGE_NO) as exception_count,
  COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as status_55_count,
  COUNT(DISTINCT CASE WHEN (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12 THEN t.TSK_MERGE_NO END) as timeout_12h_count,
  MIN(t.WMS_OUTBOUND_TIME) as earliest_outbound,
  MAX(t.WMS_OUTBOUND_TIME) as latest_outbound,
  ROUND((SYSDATE - MAX(t.WMS_OUTBOUND_TIME)) * 24, 2) as hours_since_latest
FROM APP_CMS.TSK_LIST_TASK t
WHERE to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= '2025-02-01'
  AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') < '2025-02-12'
  AND t.WMS_OUTBOUND_TIME IS NOT NULL
  AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4')
  AND t.TSK_MERGE_NO IS NOT NULL
  -- 超时未发运条件
  AND t.WMS_OUTBOUND_TIME IS NOT NULL 
  AND t.DIS_STATUS = '55' 
  AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12;

-- ============================================
-- 3. 超时未签收 (DELIVERY_TIMEOUT)
-- ============================================
-- 条件：IF_DELAY = 'Y' (从VIEW视图获取)
SELECT 
  '超时未签收' as exception_type,
  COUNT(DISTINCT t.TSK_MERGE_NO) as exception_count,
  COUNT(DISTINCT CASE WHEN v.IF_DELAY = 'Y' THEN t.TSK_MERGE_NO END) as if_delay_y_count,
  COUNT(DISTINCT CASE WHEN v.IF_DELAY IS NOT NULL THEN t.TSK_MERGE_NO END) as if_delay_not_null_count,
  MIN(t.WMS_OUTBOUND_TIME) as earliest_outbound,
  MAX(t.WMS_OUTBOUND_TIME) as latest_outbound
FROM APP_CMS.TSK_LIST_TASK t
LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
WHERE to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= '2025-02-01'
  AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') < '2025-02-12'
  AND t.WMS_OUTBOUND_TIME IS NOT NULL
  AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4')
  AND t.TSK_MERGE_NO IS NOT NULL
  -- 超时未签收条件
  AND v.IF_DELAY = 'Y';

-- ============================================
-- 4. 超48h未更新 (NO_UPDATE_48H)
-- ============================================
-- 条件：IS48H_FLAG = 'Y'
SELECT 
  '超48h未更新' as exception_type,
  COUNT(DISTINCT t.TSK_MERGE_NO) as exception_count,
  COUNT(DISTINCT CASE WHEN t.IS48H_FLAG = 'Y' THEN t.TSK_MERGE_NO END) as is48h_flag_y_count,
  COUNT(DISTINCT CASE WHEN t.IS48H_FLAG IS NOT NULL THEN t.TSK_MERGE_NO END) as is48h_flag_not_null_count,
  MIN(t.WMS_OUTBOUND_TIME) as earliest_outbound,
  MAX(t.WMS_OUTBOUND_TIME) as latest_outbound
FROM APP_CMS.TSK_LIST_TASK t
WHERE to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= '2025-02-01'
  AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') < '2025-02-12'
  AND t.WMS_OUTBOUND_TIME IS NOT NULL
  AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4')
  AND t.TSK_MERGE_NO IS NOT NULL
  -- 超48h未更新条件
  AND t.IS48H_FLAG = 'Y';

-- ============================================
-- 5. 订单状态分布分析
-- ============================================
-- 查看在日期范围内的订单状态分布
SELECT 
  t.DIS_STATUS,
  COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
  ROUND(COUNT(DISTINCT t.TSK_MERGE_NO) * 100.0 / SUM(COUNT(DISTINCT t.TSK_MERGE_NO)) OVER(), 2) as percentage,
  MIN(t.WMS_OUTBOUND_TIME) as earliest_outbound,
  MAX(t.WMS_OUTBOUND_TIME) as latest_outbound,
  ROUND(AVG((SYSDATE - t.WMS_OUTBOUND_TIME) * 24), 2) as avg_hours_since_outbound
FROM APP_CMS.TSK_LIST_TASK t
WHERE to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= '2025-02-01'
  AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') < '2025-02-12'
  AND t.WMS_OUTBOUND_TIME IS NOT NULL
  AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4')
  AND t.TSK_MERGE_NO IS NOT NULL
GROUP BY t.DIS_STATUS
ORDER BY order_count DESC;

-- ============================================
-- 6. 关键问题诊断
-- ============================================
-- 查看为什么超时未揽收和超时未发运可能为0

SELECT 
  'PICKUP_TIMEOUT诊断' as diagnostic_type,
  COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
  COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '00' THEN t.TSK_MERGE_NO END) as status_00_orders,
  COUNT(DISTINCT CASE 
    WHEN t.DIS_STATUS = '00' 
    AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2 
    THEN t.TSK_MERGE_NO 
  END) as pickup_timeout_orders,
  ROUND(AVG(CASE 
    WHEN t.DIS_STATUS = '00' 
    THEN (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 
  END), 2) as avg_hours_in_status_00,
  '如果avg_hours_in_status_00 < 2，说明状态00的订单都在2小时内被揽收' as interpretation
FROM APP_CMS.TSK_LIST_TASK t
WHERE to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= '2025-02-01'
  AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') < '2025-02-12'
  AND t.WMS_OUTBOUND_TIME IS NOT NULL
  AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4')
  AND t.TSK_MERGE_NO IS NOT NULL;

SELECT 
  'SHIPPING_TIMEOUT诊断' as diagnostic_type,
  COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
  COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as status_55_orders,
  COUNT(DISTINCT CASE 
    WHEN t.DIS_STATUS = '55' 
    AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12 
    THEN t.TSK_MERGE_NO 
  END) as shipping_timeout_orders,
  ROUND(AVG(CASE 
    WHEN t.DIS_STATUS = '55' 
    THEN (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 
  END), 2) as avg_hours_in_status_55,
  '如果avg_hours_in_status_55 < 12，说明状态55的订单都在12小时内发运' as interpretation
FROM APP_CMS.TSK_LIST_TASK t
WHERE to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= '2025-02-01'
  AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') < '2025-02-12'
  AND t.WMS_OUTBOUND_TIME IS NOT NULL
  AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4')
  AND t.TSK_MERGE_NO IS NOT NULL;

-- ============================================
-- 7. 历史超时订单分析（可能已经状态变化）
-- ============================================
-- 查看在日期范围内出库，但现在已经不在超时状态的订单
SELECT 
  '历史超时分析' as analysis_type,
  COUNT(DISTINCT CASE 
    WHEN t.DIS_STATUS IN ('55', '70', '95', '100', '105') 
    THEN t.TSK_MERGE_NO 
  END) as orders_moved_past_status_00,
  COUNT(DISTINCT CASE 
    WHEN t.DIS_STATUS IN ('70', '95', '100', '105') 
    THEN t.TSK_MERGE_NO 
  END) as orders_moved_past_status_55,
  '这些订单在出库时可能是超时的，但现在已经进入后续状态' as note
FROM APP_CMS.TSK_LIST_TASK t
WHERE to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= '2025-02-01'
  AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') < '2025-02-12'
  AND t.WMS_OUTBOUND_TIME IS NOT NULL
  AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4')
  AND t.TSK_MERGE_NO IS NOT NULL;

-- ============================================
-- 建议的解决方案
-- ============================================
/*
问题分析：
1. 超时未揽收和超时未发运使用SYSDATE动态计算，只能捕获"当前仍处于超时状态"的订单
2. 如果查询的是历史数据（如2周前），那些订单早已完成，不会满足超时条件
3. 只有"超48h未更新"和"超时未签收"使用了固定标志位（IS48H_FLAG, IF_DELAY），所以有历史数据

建议的修复方案：
方案A：使用历史快照数据
  - 在订单状态变化时，记录超时标志位（如：IS_PICKUP_TIMEOUT, IS_SHIPPING_TIMEOUT）
  - 查询时使用这些固定标志位，而不是动态计算

方案B：修改异常条件逻辑（针对历史数据分析）
  - 超时未揽收：检查SEND_TIME（揽收时间）- WMS_OUTBOUND_TIME（出库时间）> 2小时
  - 超时未发运：检查发运时间 - SEND_TIME（揽收时间）> 12小时
  
方案C：添加WHERE条件限制（快速修复，但不完美）
  - 只查询最近24-48小时的订单，确保有"当前超时"的订单
  - 适用于实时监控，不适用于历史分析
*/
