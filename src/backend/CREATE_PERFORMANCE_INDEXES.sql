-- ⚡ VF物流数据分析平台 - 性能优化索引
-- 创建日期：2025-02-10
-- 用途：为TRUNC(WMS_OUTBOUND_TIME)优化创建索引

-- ============================================
-- 📌 关键索引（强烈推荐，优先创建）
-- ============================================

-- 🔥 索引1：WMS_OUTBOUND_TIME函数索引（最重要）
-- 用途：加速所有基于WMS_OUTBOUND_TIME的日期范围查询
-- 影响：KPI查询、品牌分析、平台分析、快递商分析、交叉分析
-- 预期提升：50-80%
CREATE INDEX idx_tsk_list_task_wms_outbound_trunc 
ON APP_CMS.TSK_LIST_TASK(TRUNC(WMS_OUTBOUND_TIME));

-- 验证索引创建成功
SELECT index_name, status, tablespace_name 
FROM user_indexes 
WHERE index_name = 'IDX_TSK_LIST_TASK_WMS_OUTBOUND_TRUNC';

-- ============================================
-- 📌 组合索引（推荐，进一步提升性能）
-- ============================================

-- 🔥 索引2：品牌+快递+状态+日期组合索引
-- 用途：加速多维度筛选查询
-- 影响：所有带品牌、快递商、状态筛选的查询
-- 预期提升：30-50%
CREATE INDEX idx_tsk_list_task_composite 
ON APP_CMS.TSK_LIST_TASK(
  CUSTOMERNO,           -- 品牌筛选
  CARRIERID,            -- 快递商筛选
  DIS_STATUS,           -- 订单状态筛选
  TRUNC(WMS_OUTBOUND_TIME)  -- 日期筛选
);

-- 验证索引创建成功
SELECT index_name, status, tablespace_name 
FROM user_indexes 
WHERE index_name = 'IDX_TSK_LIST_TASK_COMPOSITE';

-- ============================================
-- 📌 可选索引（根据实际需求创建）
-- ============================================

-- 🔧 索引3：TSK_MERGE_NO索引（如果不存在）
-- 用途：加速订单号查询和去重
-- 影响：所有使用COUNT(DISTINCT TSK_MERGE_NO)的查询
CREATE INDEX idx_tsk_list_task_merge_no 
ON APP_CMS.TSK_LIST_TASK(TSK_MERGE_NO);

-- 🔧 索引4：CUSTOMERNO索引（如果不存在）
-- 用途：加速品牌筛选
-- 影响：品牌分析、交叉分析
CREATE INDEX idx_tsk_list_task_customerno 
ON APP_CMS.TSK_LIST_TASK(CUSTOMERNO);

-- 🔧 索引5：CARRIERID索引（如果不存在）
-- 用途：加速快递商筛选
-- 影响：快递商分析、交叉分析
CREATE INDEX idx_tsk_list_task_carrierid 
ON APP_CMS.TSK_LIST_TASK(CARRIERID);

-- 🔧 索引6：DIS_STATUS索引（如果不存在）
-- 用途：加速订单状态筛选
-- 影响：所有按状态统计的查询
CREATE INDEX idx_tsk_list_task_dis_status 
ON APP_CMS.TSK_LIST_TASK(DIS_STATUS);

-- ============================================
-- 📊 索引分析和统计
-- ============================================

-- 查看所有TSK_LIST_TASK表的索引
SELECT 
  index_name,
  index_type,
  uniqueness,
  status,
  num_rows,
  last_analyzed
FROM user_indexes 
WHERE table_name = 'TSK_LIST_TASK'
ORDER BY index_name;

-- 查看索引列详情
SELECT 
  ic.index_name,
  ic.column_name,
  ic.column_position,
  ic.descend
FROM user_ind_columns ic
WHERE ic.table_name = 'TSK_LIST_TASK'
ORDER BY ic.index_name, ic.column_position;

-- 收集表统计信息（建议索引创建后执行）
BEGIN
  DBMS_STATS.GATHER_TABLE_STATS(
    ownname => 'APP_CMS',
    tabname => 'TSK_LIST_TASK',
    estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
    method_opt => 'FOR ALL COLUMNS SIZE AUTO',
    cascade => TRUE  -- 同时收集索引统计
  );
END;
/

-- ============================================
-- 🔍 性能测试查询
-- ============================================

-- 测试1：查看执行计划（优化前 vs 优化后）
EXPLAIN PLAN FOR
SELECT COUNT(DISTINCT t.TSK_MERGE_NO)
FROM APP_CMS.TSK_LIST_TASK t
WHERE TRUNC(t.WMS_OUTBOUND_TIME) >= TO_DATE('2025-02-01', 'YYYY-MM-DD')
  AND TRUNC(t.WMS_OUTBOUND_TIME) <= TO_DATE('2025-02-10', 'YYYY-MM-DD')
  AND t.CUSTOMERNO = '18405';

-- 显示执行计划
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- 测试2：比较查询性能
SET TIMING ON

-- 使用索引的查询
SELECT COUNT(DISTINCT t.TSK_MERGE_NO)
FROM APP_CMS.TSK_LIST_TASK t
WHERE TRUNC(t.WMS_OUTBOUND_TIME) >= TO_DATE('2025-02-01', 'YYYY-MM-DD')
  AND TRUNC(t.WMS_OUTBOUND_TIME) <= TO_DATE('2025-02-10', 'YYYY-MM-DD')
  AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2');

SET TIMING OFF

-- ============================================
-- 🗑️ 清理索引（如果需要重建）
-- ============================================

-- ⚠️ 注意：只在需要时执行，删除索引会降低查询性能

/*
-- 删除函数索引
DROP INDEX idx_tsk_list_task_wms_outbound_trunc;

-- 删除组合索引
DROP INDEX idx_tsk_list_task_composite;

-- 删除其他索引
DROP INDEX idx_tsk_list_task_merge_no;
DROP INDEX idx_tsk_list_task_customerno;
DROP INDEX idx_tsk_list_task_carrierid;
DROP INDEX idx_tsk_list_task_dis_status;
*/

-- ============================================
-- 📋 索引维护（定期执行）
-- ============================================

-- 重建索引（碎片整理）
-- ALTER INDEX idx_tsk_list_task_wms_outbound_trunc REBUILD;
-- ALTER INDEX idx_tsk_list_task_composite REBUILD;

-- 收集索引统计信息
-- EXEC DBMS_STATS.GATHER_INDEX_STATS('APP_CMS', 'IDX_TSK_LIST_TASK_WMS_OUTBOUND_TRUNC');
-- EXEC DBMS_STATS.GATHER_INDEX_STATS('APP_CMS', 'IDX_TSK_LIST_TASK_COMPOSITE');

-- ============================================
-- 📌 使用说明
-- ============================================

/*
执行步骤：

1. 【必须】创建函数索引（索引1）
   - 这是最重要的优化
   - 所有查询都会受益

2. 【推荐】创建组合索引（索引2）
   - 进一步提升多条件查询性能

3. 【可选】根据实际需求创建其他索引（索引3-6）
   - 检查是否已存在这些索引
   - 避免重复创建

4. 【验证】执行性能测试查询
   - 查看执行计划
   - 对比优化前后性能

5. 【统计】收集表统计信息
   - 让优化器做出更好的决策

注意事项：

- 索引会占用存储空间
- 索引会略微降低INSERT/UPDATE性能（通常可忽略）
- 对于SELECT为主的系统，索引利大于弊
- 定期维护索引，保持最佳性能

预期效果：

- 查询速度提升 50-80%
- KPI查询：6-8秒 → 1-2秒
- 交叉分析：4-6秒 → 1-1.5秒
- 总查询时间：18-25秒 → 3-5秒
*/

-- ============================================
-- ✅ 执行完成检查清单
-- ============================================

/*
□ 索引1创建成功（必须）
□ 索引2创建成功（推荐）
□ 索引验证通过
□ 统计信息已收集
□ 执行计划显示使用索引
□ 性能测试通过
□ 应用服务器重启
□ 实际查询速度提升确认
*/
