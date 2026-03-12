#!/bin/bash

# ⚡ KPI查询并行优化 - 自动应用脚本
# 
# 使用方法：
#   cd /path/to/backend
#   chmod +x APPLY_PARALLEL_OPTIMIZATION.sh
#   ./APPLY_PARALLEL_OPTIMIZATION.sh

echo "⚡ 开始应用KPI查询并行优化..."

# 备份原文件
if [ ! -f "src/routes/overview.js.backup" ]; then
  cp src/routes/overview.js src/routes/overview.js.backup
  echo "✅ 已备份原文件到 overview.js.backup"
else
  echo "⚠️  备份文件已存在，跳过备份"
fi

# 创建补丁文件
cat > /tmp/kpi_parallel.patch << 'EOF'
--- a/src/routes/overview.js
+++ b/src/routes/overview.js
@@ -211,18 +211,17 @@
     const momRange = DateHelper.calculateMoMDateRange(dateFrom, dateTo);
     const yoyRange = DateHelper.calculateYoYDateRange(dateFrom, dateTo);
     
-    // 基础参数
-    const baseParams = {
-      dateFrom: dateFrom,
-      dateTo: dateTo,
-      lastMonthFrom: momRange.lastMonthFrom,
-      lastMonthTo: momRange.lastMonthTo,
-      lastYearFrom: yoyRange.lastYearFrom,
-      lastYearTo: yoyRange.lastYearTo
-    };
+    // ⚡ 性能优化：使用并行查询代替单一CTE查询
+    console.log('⚡ [KPI查询] 使用并行查询模式，提升性能...');
     
-    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(baseParams, brand, platform, selfFlag, parsedUserBrands);
+    // 准备3个时间段的参数
+    const currentParams = { dateFrom, dateTo };
+    const lastMonthParams = { dateFrom: momRange.lastMonthFrom, dateTo: momRange.lastMonthTo };
+    const lastYearParams = { dateFrom: yoyRange.lastYearFrom, dateTo: yoyRange.lastYearTo };
+    
+    // 构建筛选条件（只用当前期间参数）
+    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(currentParams, brand, platform, selfFlag, parsedUserBrands);
 
+    // 复制筛选参数到其他时间段
+    Object.keys(currentParams).forEach(key => {
+      if (key.startsWith('brand') || key.startsWith('userBrand') || key === 'platform' || key === 'selfFlag') {
+        lastMonthParams[key] = currentParams[key];
+        lastYearParams[key] = currentParams[key];
+      }
+    });
+    
     // 🔍 调试：打印筛选条件
     console.log('🔍 [KPI查询] 筛选条件:', {
       brandFilter: brandFilter || '(无)',
       platformFilter: platformFilter || '(无)',
       selfFlagFilter: selfFlagFilter || '(无)',
-      'baseParams.platform': baseParams.platform
+      'currentParams.platform': currentParams.platform
     });
EOF

# 尝试应用补丁
if command -v patch &> /dev/null; then
  patch -p1 < /tmp/kpi_parallel.patch
  if [ $? -eq 0 ]; then
    echo "✅ 补丁应用成功！"
  else
    echo "❌ 补丁应用失败，请手动修改"
    echo "📖 请参考 /PARALLEL_QUERY_OPTIMIZATION.md 文档手动修改"
  fi
else
  echo "⚠️  未找到patch命令，请手动修改"
  echo "📖 请参考 /PARALLEL_QUERY_OPTIMIZATION.md 文档手动修改"
fi

echo ""
echo "🔍 下一步："
echo "1. 修改第234-400行的KPI查询逻辑（详见文档）"
echo "2. 修改第409-450行的历史数据提取逻辑（详见文档）"
echo "3. 重启后端服务：npm start"
echo "4. 测试KPI查询速度"
