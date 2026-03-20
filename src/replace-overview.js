/**
 * 替换overview.js文件的脚本
 * 将修复后的overview-fixed.js替换到正确位置
 */

const fs = require('fs');
const path = require('path');

try {
  // 读取修复后的文件内容
  const fixedContent = fs.readFileSync(path.join(__dirname, 'backend/src/routes/overview-fixed.js'), 'utf8');
  
  // 备份原文件
  const originalPath = path.join(__dirname, 'backend/src/routes/overview.js');
  const backupPath = path.join(__dirname, 'backend/src/routes/overview-backup.js');
  
  if (fs.existsSync(originalPath)) {
    fs.copyFileSync(originalPath, backupPath);
    console.log('✅ 原overview.js已备份到overview-backup.js');
  }
  
  // 替换为修复后的文件
  fs.writeFileSync(originalPath, fixedContent);
  console.log('✅ 已成功替换overview.js文件，新增快递公司统计查询');
  
  // 清理临时文件
  fs.unlinkSync(path.join(__dirname, 'backend/src/routes/overview-fixed.js'));
  console.log('✅ 清理临时文件完成');
  
  console.log('\n🎯 修复完成！总览界面快递公司统计功能已恢复：');
  console.log('   - 在KPI接口中新增了courierDistribution查询');
  console.log('   - 前端数据转换器已更新以正确映射courierData字段');
  console.log('   - 快递公司订单占比组件现在应该能正常显示数据');
  
} catch (error) {
  console.error('❌ 文件替换失败:', error.message);
  process.exit(1);
}