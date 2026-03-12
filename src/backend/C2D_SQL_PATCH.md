# C2D时效计算SQL补丁

## 需要修改的文件
`/backend/src/utils/timelinessDataProcessor-cjs.js`

## 修改位置
在 `analyzeC2DPerformance` 函数中（约第862-927行）

## 需要替换的SQL查询部分

将以下字段从S2D改为C2D计算：

### 1. 字段名修改
```sql
-- 原字段名（S2D）→ 新字段名（C2D）
TOTAL_S2D_ORDERS → TOTAL_C2D_ORDERS
AVG_S2D_TIME → AVG_C2D_TIME
```

### 2. 时效计算逻辑修改

**原逻辑（S2D）：**
```sql
t.SUM_SEND_TIME2  -- 直接使用此字段（小时数）
```

**新逻辑（C2D）：**
```sql
(t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24  -- 计算付款到签收的时间差（小时）
```

### 3. 完整SQL替换

将第879-909行的SQL查询替换为：

```sql
        -- ✅ C2D Actual统计：只统计已签收订单（DIS_STATUS='95'）
        -- C2D时效 = (DELIVERY_TIME - PAYMENTDATE_D) * 24小时
        COUNT(CASE WHEN t.DIS_STATUS = '95' 
                   AND t.PAYMENTDATE_D IS NOT NULL 
                   AND t.DELIVERY_TIME IS NOT NULL 
                   AND t.DELIVERY_TIME >= t.PAYMENTDATE_D THEN 1 END) as TOTAL_C2D_ORDERS,
        
        COUNT(CASE WHEN t.DIS_STATUS = '95' 
                   AND t.PAYMENTDATE_D IS NOT NULL 
                   AND t.DELIVERY_TIME IS NOT NULL 
                   AND t.DELIVERY_TIME >= t.PAYMENTDATE_D
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 24 THEN 1 END) as ACTUAL_24H_COUNT,
        
        COUNT(CASE WHEN t.DIS_STATUS = '95' 
                   AND t.PAYMENTDATE_D IS NOT NULL 
                   AND t.DELIVERY_TIME IS NOT NULL 
                   AND t.DELIVERY_TIME >= t.PAYMENTDATE_D
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 > 24 
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 48 THEN 1 END) as ACTUAL_48H_COUNT,
        
        COUNT(CASE WHEN t.DIS_STATUS = '95' 
                   AND t.PAYMENTDATE_D IS NOT NULL 
                   AND t.DELIVERY_TIME IS NOT NULL 
                   AND t.DELIVERY_TIME >= t.PAYMENTDATE_D
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 > 48 
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 72 THEN 1 END) as ACTUAL_72H_COUNT,
        
        COUNT(CASE WHEN t.DIS_STATUS = '95' 
                   AND t.PAYMENTDATE_D IS NOT NULL 
                   AND t.DELIVERY_TIME IS NOT NULL 
                   AND t.DELIVERY_TIME >= t.PAYMENTDATE_D
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 > 72 THEN 1 END) as ACTUAL_OVER72H_COUNT,
        
        AVG(CASE WHEN t.DIS_STATUS = '95' 
                 AND t.PAYMENTDATE_D IS NOT NULL 
                 AND t.DELIVERY_TIME IS NOT NULL 
                 AND t.DELIVERY_TIME >= t.PAYMENTDATE_D
                 AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 1000 
                 THEN (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 END) as AVG_C2D_TIME
```

### 4. 数据读取部分修改

在第984行和989行，修改字段读取：

**修改前：**
```javascript
const totalOrders = parseInt(row.TOTAL_S2D_ORDERS) || 0;
const avgS2DTime = parseFloat(row.AVG_S2D_TIME) || 0;
```

**修改后：**
```javascript
const totalOrders = parseInt(row.TOTAL_C2D_ORDERS) || 0;
const avgC2DTime = parseFloat(row.AVG_C2D_TIME) || 0;
```

### 5. 变量名修改

在C2D函数中，将所有 `avgS2DTime` 变量改为 `avgC2DTime`：
- 第967行：`let totalS2DTime = 0;` → `let totalC2DTime = 0;`
- 第968行：`let totalS2DCount = 0;` → `let totalC2DCount = 0;`
- 相关的使用处也要修改

### 6. 返回数据结构修改

在返回对象中（约第1410行），将字段名修改为C2D：

```javascript
return {
  success: true,
  data: {
    totalC2DOrders: actualStats.total,  // 改为 totalC2DOrders
    planStats,
    actualStats,
    avgC2DTime: parseFloat(avgC2DTime),  // 改为 avgC2DTime
    achievementRate: parseFloat(achievementRate),
    byBrand,
    byCourier,
    byBrandCourier
  }
};
```

## 核心区别总结

| 指标 | S2D | C2D |
|------|-----|-----|
| **定义** | Ship to Delivery（WMS出库到签收） | Customer to Delivery（客户付款到签收） |
| **起始时间** | `WMS_OUTBOUND_TIME` | `PAYMENTDATE_D` |
| **结束时间** | `WMS_OUTBOUND_TIME + SUM_SEND_TIME2小时` | `DELIVERY_TIME` |
| **计算公式** | `SUM_SEND_TIME2`（已计算好） | `(DELIVERY_TIME - PAYMENTDATE_D) * 24` |
| **时效字段** | `SUM_SEND_TIME2` | `(DELIVERY_TIME - PAYMENTDATE_D) * 24` |

## 注意事项

1. **NULL值处理**：C2D需要同时检查 `PAYMENTDATE_D` 和 `DELIVERY_TIME` 都不为NULL
2. **时间顺序**：需要确保 `DELIVERY_TIME >= PAYMENTDATE_D`（避免负数）
3. **异常值过滤**：限制C2D时效 `<= 1000小时`（约42天）避免异常数据
4. **字段统一性**：所有S2D相关的字段名和变量名都要改为C2D

## 测试验证

修改完成后，测试以下场景：

1. ✅ C2D时效计算是否正确（DELIVERY_TIME - PAYMENTDATE_D）
2. ✅ 24h/48h/72h/72h+的分类是否准确
3. ✅ 平均C2D时效计算是否合理
4. ✅ Plan vs Actual对比是否正确
5. ✅ 前端C2DTimeChart是否能正常显示数据
