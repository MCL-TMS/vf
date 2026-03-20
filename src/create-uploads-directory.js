#!/usr/bin/env node

/**
 * 创建 uploads 目录结构
 * 解决时效表上传后文件不存在的问题
 */

const fs = require('fs');
const path = require('path');

console.log('\n📁 创建 uploads 目录结构\n');
console.log('='.repeat(60));

const directories = [
  'backend/uploads',
  'backend/uploads/timeliness'
];

let created = 0;
let existed = 0;

directories.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  
  if (fs.existsSync(fullPath)) {
    console.log(`✅ 目录已存在: ${dir}`);
    existed++;
  } else {
    try {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`✅ 已创建目录: ${dir}`);
      created++;
    } catch (error) {
      console.error(`❌ 创建目录失败: ${dir}`);
      console.error(`   错误: ${error.message}`);
    }
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 总结:`);
console.log(`   已存在: ${existed} 个目录`);
console.log(`   新创建: ${created} 个目录`);

if (created > 0) {
  console.log('\n✅ 目录创建成功！现在可以上传时效表了。');
} else if (existed === directories.length) {
  console.log('\n✅ 所有目录都已存在，系统正常。');
}

console.log('\n💡 下一步:');
console.log('   1. 确保后端API服务器正在运行');
console.log('   2. 在前端上传时效表格');
console.log('   3. 运行 node view-timeliness-data.js 查看数据');
console.log('');
