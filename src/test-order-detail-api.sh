#!/bin/bash

# 订单明细功能API测试脚本
# 使用方法: bash test-order-detail-api.sh

echo "=================================="
echo "订单明细功能API测试"
echo "=================================="
echo ""

# 检查后端服务是否运行
echo "1️⃣ 检查后端服务..."
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ 后端服务未启动！"
    echo "请先运行: cd backend && npm start"
    exit 1
fi
echo "✅ 后端服务正常运行"
echo ""

# 测试时效分析API
echo "2️⃣ 测试时效分析API（包含rawOrders）..."
echo "请求: POST /api/upload/analyze-timeliness"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:3001/api/upload/analyze-timeliness \
  -H "Content-Type: application/json" \
  -d '{
    "dateRange": {"from": "2025-01-01", "to": "2025-01-20"},
    "selectedBrand": "DICKIES",
    "analysisType": "S2D"
  }')

# 检查响应
if [ -z "$RESPONSE" ]; then
    echo "❌ API无响应"
    exit 1
fi

# 检查是否包含rawOrders字段
if echo "$RESPONSE" | grep -q "rawOrders"; then
    echo "✅ API返回包含rawOrders字段"
    
    # 提取rawOrders数量
    RAW_ORDERS_COUNT=$(echo "$RESPONSE" | grep -o '"ORDER_NO"' | wc -l)
    echo "📊 原始订单数量: $RAW_ORDERS_COUNT 条"
    
    if [ "$RAW_ORDERS_COUNT" -gt 0 ]; then
        echo "✅ rawOrders包含订单数据"
        
        # 显示第一条订单的字段
        echo ""
        echo "📋 第一条订单的字段:"
        echo "$RESPONSE" | grep -o '"ORDER_NO":"[^"]*"' | head -1
        echo "$RESPONSE" | grep -o '"TRACKING_NO":"[^"]*"' | head -1
        echo "$RESPONSE" | grep -o '"CARRIERID":"[^"]*"' | head -1
        echo "$RESPONSE" | grep -o '"SUM_SEND_TIME2":[0-9.]*' | head -1
    else
        echo "⚠️  rawOrders为空数组（可能没有符合条件的订单）"
    fi
else
    echo "❌ API返回不包含rawOrders字段"
    echo ""
    echo "响应内容（前500字符）:"
    echo "$RESPONSE" | head -c 500
    echo ""
    exit 1
fi

echo ""
echo "=================================="
echo "测试完成！"
echo "=================================="
echo ""
echo "📝 下一步："
echo "1. 打开浏览器访问前端应用"
echo "2. 进入时效分析页面"
echo "3. 查看订单数量是否显示为蓝色+下划线"
echo "4. 点击订单数量，查看订单明细弹窗"
echo ""
