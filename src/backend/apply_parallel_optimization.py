#!/usr/bin/env python3
"""
⚡ KPI查询并行优化 - 自动应用脚本
使用方法：
  cd backend
  python apply_parallel_optimization.py
"""

import os
import shutil
from datetime import datetime

def backup_file(file_path):
    """备份原文件"""
    backup_path = file_path + '.backup'
    if not os.path.exists(backup_path):
        shutil.copy2(file_path, backup_path)
        print(f"✅ 已备份原文件到 {backup_path}")
    else:
        print(f"⚠️  备份文件已存在，跳过备份")
    return backup_path

def apply_optimization(file_path):
    """应用并行优化"""
    print("⚡ 开始应用KPI查询并行优化...")
    
    # 读取原文件
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # 转换为字符串以便查找替换
    content = ''.join(lines)
    
    # ====== 修改1: 参数准备部分 (第214-232行) ======
    old_params = """    // 基础参数
    const baseParams = {
      dateFrom: dateFrom,
      dateTo: dateTo,
      lastMonthFrom: momRange.lastMonthFrom,
      lastMonthTo: momRange.lastMonthTo,
      lastYearFrom: yoyRange.lastYearFrom,
      lastYearTo: yoyRange.lastYearTo
    };
    
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(baseParams, brand, platform, selfFlag, parsedUserBrands);

    // 🔍 调试：打印筛选条件
    console.log('🔍 [KPI查询] 筛选条件:', {
      brandFilter: brandFilter || '(无)',
      platformFilter: platformFilter || '(无)',
      selfFlagFilter: selfFlagFilter || '(无)',
      'baseParams.platform': baseParams.platform
    });"""
    
    new_params = """    // ⚡ 性能优化：使用并行查询代替单一CTE查询
    console.log('⚡ [KPI查询] 使用并行查询模式，提升性能...');
    
    // 准备3个时间段的参数
    const currentParams = { dateFrom, dateTo };
    const lastMonthParams = { dateFrom: momRange.lastMonthFrom, dateTo: momRange.lastMonthTo };
    const lastYearParams = { dateFrom: yoyRange.lastYearFrom, dateTo: yoyRange.lastYearTo };
    
    // 构建筛选条件（只用当前期间参数）
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(currentParams, brand, platform, selfFlag, parsedUserBrands);

    // 复制筛选参数到其他时间段
    Object.keys(currentParams).forEach(key => {
      if (key.startsWith('brand') || key.startsWith('userBrand') || key === 'platform' || key === 'selfFlag') {
        lastMonthParams[key] = currentParams[key];
        lastYearParams[key] = currentParams[key];
      }
    });
    
    // 🔍 调试：打印筛选条件
    console.log('🔍 [KPI查询] 筛选条件:', {
      brandFilter: brandFilter || '(无)',
      platformFilter: platformFilter || '(无)',
      selfFlagFilter: selfFlagFilter || '(无)',
      'currentParams.platform': currentParams.platform
    });"""
    
    if old_params in content:
        content = content.replace(old_params, new_params)
        print("✅ 修改1完成: 参数准备部分")
    else:
        print("⚠️  修改1失败: 未找到匹配的代码块（参数准备）")
        return False
    
    # ====== 修改2: 主查询逻辑 - 查找CTE查询的开始 ======
    # 由于这部分太长，我们需要找到标记点然后替换整个SQL块
    
    # 查找CTE查询的开始和结束标记
    cte_start_marker = "    // 核心KPI查询\n    const kpiQuery = `"
    cte_end_marker = "    const kpiResult = await connection.execute(kpiQuery, baseParams);\n    const kpiData = kpiResult.rows[0];"
    
    if cte_start_marker in content and cte_end_marker in content:
        # 找到CTE查询块的位置
        start_idx = content.find(cte_start_marker)
        end_idx = content.find(cte_end_marker)
        
        if start_idx != -1 and end_idx != -1:
            # 提取CTE之前和之后的内容
            before_cte = content[:start_idx]
            after_cte = content[end_idx + len(cte_end_marker):]
            
            # 新的并行查询代码
            new_query_block = """    // ⚡ 优化的查询SQL（单时间段，使用TRUNC提升性能）
    const buildPeriodQuery = () => `
      SELECT 
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        COUNT(DISTINCT CASE WHEN t.IS48H_FLAG = 'Y' THEN t.TSK_MERGE_NO END) as timeout_48h_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '95' THEN t.TSK_MERGE_NO END) as delivered_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '40' THEN t.TSK_MERGE_NO END) as forwarded_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('100', '105') THEN t.TSK_MERGE_NO END) as returned_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('90', '110') THEN t.TSK_MERGE_NO END) as cancelled_orders,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_hours,
        ROUND(AVG(CASE WHEN t.DIS_STATUS = '95' AND t.DISP_TIME IS NOT NULL AND t.DELIVERY_TIME IS NOT NULL 
                      THEN (t.DELIVERY_TIME - t.DISP_TIME) * 24 END), 2) as avg_first_dispatch_hours,
        ROUND(
          COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DISP_TIME IS NOT NULL AND t.DELIVERY_TIME IS NOT NULL 
                     AND (t.DELIVERY_TIME - t.DISP_TIME) * 24 <= 8 THEN 1 END) * 100.0 / 
          NULLIF(COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DISP_TIME IS NOT NULL AND t.DELIVERY_TIME IS NOT NULL THEN 1 END), 0),
          2
        ) as first_dispatch_success_rate,
        ROUND(COUNT(CASE WHEN t.DIS_STATUS = '55' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as picked_rate,
        ROUND(COUNT(CASE WHEN t.DIS_STATUS = '70' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as shipped_rate,
        ROUND(COUNT(CASE WHEN t.DIS_STATUS = '95' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as delivery_rate,
        ROUND((
          COUNT(CASE WHEN t.WMS_OUTBOUND_TIME IS NOT NULL AND t.DIS_STATUS = '00' AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2 THEN 1 END) +
          COUNT(CASE WHEN t.WMS_OUTBOUND_TIME IS NOT NULL AND t.DIS_STATUS = '55' AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12 THEN 1 END) +
          COUNT(CASE WHEN t.IF_DELAY = 'Y' THEN 1 END) +
          COUNT(CASE WHEN t.IS48H_FLAG = 'Y' THEN 1 END)
        ) * 100.0 / NULLIF(COUNT(*), 0), 2) as exception_rate,
        ROUND(COUNT(CASE WHEN t.IS48H_FLAG = 'Y' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as timeout_48h_rate
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND TRUNC(t.WMS_OUTBOUND_TIME) >= TO_DATE(:dateFrom, 'YYYY-MM-DD')
        AND TRUNC(t.WMS_OUTBOUND_TIME) <= TO_DATE(:dateTo, 'YYYY-MM-DD')
        AND t.TSK_MERGE_NO IS NOT NULL
        AND t.CARRIERID IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
    `;
    
    const queryStartTime = Date.now();
    
    // 🚀 并行执行3个查询
    const [currentResult, lastMonthResult, lastYearResult] = await Promise.all([
      connection.execute(buildPeriodQuery(), currentParams),
      connection.execute(buildPeriodQuery(), lastMonthParams),
      connection.execute(buildPeriodQuery(), lastYearParams)
    ]);
    
    const queryEndTime = Date.now();
    console.log(`✅ [KPI查询] 3个查询并行完成，耗时: ${queryEndTime - queryStartTime}ms`);
    
    // 提取查询结果
    const kpiData = currentResult.rows[0];
    const lastMonthData = lastMonthResult.rows[0];
    const lastYearData = lastYearResult.rows[0];"""
            
            # 组合新内容
            content = before_cte + new_query_block + after_cte
            print("✅ 修改2完成: 主查询逻辑（并行查询）")
        else:
            print("⚠️  修改2失败: 未找到CTE查询块的边界")
            return False
    else:
        print("⚠️  修改2失败: 未找到CTE查询的标记")
        return False
    
    # ====== 修改3: 历史数据提取 ======
    old_historical = """    // 🔥 新增：提取历史数据并计算同比环比
    const historicalData = {
      lastMonth: {
        totalOrders: kpiData[16] || 0, // last_month_total_orders
        forwardedOrders: kpiData[17] || 0, // last_month_forwarded_orders
        returnedOrders: kpiData[18] || 0, // last_month_returned_orders
        cancelledOrders: kpiData[19] || 0, // last_month_cancelled_orders
        avgDeliveryHours: kpiData[20] || 0, // last_month_avg_delivery_hours
        avgFirstDispatchHours: kpiData[21] || 0, // last_month_avg_first_dispatch_hours
        firstDispatchSuccessRate: kpiData[22] || 0, // last_month_first_dispatch_success_rate
        statusDistribution: [
          { statusCode: 40, orderCount: kpiData[17] || 0 }, // 已转寄
          { statusCode: 100, orderCount: kpiData[18] || 0 }, // 已退回（聚合100+105）
          { statusCode: 90, orderCount: kpiData[19] || 0 } // 已取消（聚合90+110）
        ],
        // 🔥 新增：支持效率指标的历史数据
        performanceMetrics: {
          avgDeliveryHours: kpiData[20] || 0,
          avgFirstDispatchHours: kpiData[21] || 0,
          firstDispatchSuccessRate: kpiData[22] || 0
        }
      },
      lastYear: {
        totalOrders: kpiData[23] || 0, // last_year_total_orders
        forwardedOrders: kpiData[24] || 0, // last_year_forwarded_orders
        returnedOrders: kpiData[25] || 0, // last_year_returned_orders
        cancelledOrders: kpiData[26] || 0, // last_year_cancelled_orders
        avgDeliveryHours: kpiData[27] || 0, // last_year_avg_delivery_hours
        avgFirstDispatchHours: kpiData[28] || 0, // last_year_avg_first_dispatch_hours
        firstDispatchSuccessRate: kpiData[29] || 0, // last_year_first_dispatch_success_rate
        statusDistribution: [
          { statusCode: 40, orderCount: kpiData[24] || 0 }, // 已转寄
          { statusCode: 100, orderCount: kpiData[25] || 0 }, // 已退回（聚合100+105）
          { statusCode: 90, orderCount: kpiData[26] || 0 } // 已取消（聚合90+110）
        ],
        // 🔥 新增：支持效率指标的历史数据
        performanceMetrics: {
          avgDeliveryHours: kpiData[27] || 0,
          avgFirstDispatchHours: kpiData[28] || 0,
          firstDispatchSuccessRate: kpiData[29] || 0
        }
      }
    };"""
    
    new_historical = """    // ⚡ 并行查询优化：直接从单独的查询结果中提取数据
    const historicalData = {
      lastMonth: {
        totalOrders: lastMonthData[0] || 0,
        forwardedOrders: lastMonthData[5] || 0,
        returnedOrders: lastMonthData[6] || 0,
        cancelledOrders: lastMonthData[7] || 0,
        avgDeliveryHours: lastMonthData[8] || 0,
        avgFirstDispatchHours: lastMonthData[9] || 0,
        firstDispatchSuccessRate: lastMonthData[10] || 0,
        statusDistribution: [
          { statusCode: 40, orderCount: lastMonthData[5] || 0 },
          { statusCode: 100, orderCount: lastMonthData[6] || 0 },
          { statusCode: 90, orderCount: lastMonthData[7] || 0 }
        ],
        performanceMetrics: {
          avgDeliveryHours: lastMonthData[8] || 0,
          avgFirstDispatchHours: lastMonthData[9] || 0,
          firstDispatchSuccessRate: lastMonthData[10] || 0
        }
      },
      lastYear: {
        totalOrders: lastYearData[0] || 0,
        forwardedOrders: lastYearData[5] || 0,
        returnedOrders: lastYearData[6] || 0,
        cancelledOrders: lastYearData[7] || 0,
        avgDeliveryHours: lastYearData[8] || 0,
        avgFirstDispatchHours: lastYearData[9] || 0,
        firstDispatchSuccessRate: lastYearData[10] || 0,
        statusDistribution: [
          { statusCode: 40, orderCount: lastYearData[5] || 0 },
          { statusCode: 100, orderCount: lastYearData[6] || 0 },
          { statusCode: 90, orderCount: lastYearData[7] || 0 }
        ],
        performanceMetrics: {
          avgDeliveryHours: lastYearData[8] || 0,
          avgFirstDispatchHours: lastYearData[9] || 0,
          firstDispatchSuccessRate: lastYearData[10] || 0
        }
      }
    };"""
    
    if old_historical in content:
        content = content.replace(old_historical, new_historical)
        print("✅ 修改3完成: 历史数据提取")
    else:
        print("⚠️  修改3失败: 未找到匹配的代码块（历史数据）")
        return False
    
    # ====== 修改4: 品牌参数传递 ======
    old_brand_params = """    // 🔥 修复：复制所有品牌参数（支持多品牌数组）
    const brandQueryParams = { dateFrom, dateTo };
    
    // 复制所有 brand 相关参数（支持 brand0, brand1, brand2, ... 或单个 brand）
    Object.keys(baseParams).forEach(key => {
      if (key.startsWith('brand')) {
        brandQueryParams[key] = baseParams[key];
      }
    });
    
    if (platform && platform !== 'all') {
      brandQueryParams.platform = baseParams.platform;
    }"""
    
    new_brand_params = """    // 🔥 修复：复制所有品牌参数（支持多品牌数组）
    const brandQueryParams = { dateFrom, dateTo };
    
    // 复制所有 brand 相关参数（支持 brand0, brand1, brand2, ... 或单个 brand）
    Object.keys(currentParams).forEach(key => {
      if (key.startsWith('brand')) {
        brandQueryParams[key] = currentParams[key];
      }
    });
    
    if (platform && platform !== 'all') {
      brandQueryParams.platform = currentParams.platform;
    }"""
    
    if old_brand_params in content:
        content = content.replace(old_brand_params, new_brand_params)
        print("✅ 修改4完成: 品牌参数传递")
    else:
        print("⚠️  修改4失败: 未找到匹配的代码块（品牌参数）")
        # 这个不是致命错误，可以继续
    
    # 写入修改后的文件
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n✅ 所有修改完成！")
    return True

def main():
    file_path = 'src/routes/overview.js'
    
    if not os.path.exists(file_path):
        print(f"❌ 错误: 找不到文件 {file_path}")
        print("   请确保在 backend 目录下运行此脚本")
        return
    
    # 备份
    backup_file(file_path)
    
    # 应用优化
    success = apply_optimization(file_path)
    
    if success:
        print("\n🎉 优化完成！")
        print("\n🔍 下一步:")
        print("1. 重启后端服务: npm start")
        print("2. 测试KPI查询速度")
        print("3. 观察日志中的查询耗时")
        print("\n如果出现问题，可以从备份恢复:")
        print(f"  cp {file_path}.backup {file_path}")
    else:
        print("\n❌ 优化失败，请手动修改或联系开发者")
        print(f"   原文件已备份到 {file_path}.backup")

if __name__ == '__main__':
    main()
