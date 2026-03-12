#!/bin/bash

# VF物流时效数据快速配置脚本
# 用法：./quick-setup-timeliness.sh [Excel文件路径]

echo "🚀 VF物流时效数据快速配置"
echo "================================"
echo ""

TIMELINESS_DIR="backend/uploads/timeliness"
EXCEL_FILE=$1

# 创建目录
if [ ! -d "$TIMELINESS_DIR" ]; then
  echo "📂 创建时效数据目录..."
  mkdir -p "$TIMELINESS_DIR"
  echo "✅ 目录已创建"
  echo ""
fi

# 复制Excel文件（如果提供了路径）
if [ -n "$EXCEL_FILE" ]; then
  if [ -f "$EXCEL_FILE" ]; then
    echo "📄 复制Excel文件..."
    cp "$EXCEL_FILE" "$TIMELINESS_DIR/"
    FILENAME=$(basename "$EXCEL_FILE")
    echo "✅ 文件已复制: $FILENAME"
    echo ""
  else
    echo "❌ 文件不存在: $EXCEL_FILE"
    exit 1
  fi
fi

# 运行自动配置
echo "🔧 运行自动配置..."
node setup-existing-timeliness-data.js
echo ""

# 询问是否生成JSON缓存
read -p "是否立即生成JSON缓存？(y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "📊 生成JSON缓存..."
  
  # 检查是否安装了xlsx
  if ! node -e "require('xlsx')" 2>/dev/null; then
    echo "⚠️  xlsx包未安装，正在安装..."
    cd backend && npm install xlsx && cd ..
  fi
  
  node parse-timeliness-excel-to-json.js
  echo ""
  
  echo "✅ 配置完成！"
  echo ""
  echo "🧪 运行验证测试："
  echo "   node test-file-based-timeliness.js"
  echo ""
  echo "🚀 启动服务："
  echo "   cd backend && npm start"
  echo ""
else
  echo ""
  echo "📝 请稍后手动生成JSON缓存："
  echo "   node parse-timeliness-excel-to-json.js"
  echo ""
fi
