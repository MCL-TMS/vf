/**
 * 检测所有后端路由文件中的数据库参数绑定问题
 * 查找位置参数绑定（:1, :2, :n）并统计使用情况
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始检测数据库参数绑定问题...\n');

const routesDir = path.join(__dirname, 'src', 'routes');
const routeFiles = fs.readdirSync(routesDir).filter(file => file.endsWith('.js'));

let totalIssues = 0;
let filesWithIssues = 0;

routeFiles.forEach(file => {
  const filePath = path.join(routesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  console.log(`📄 检查文件: ${file}`);
  console.log('='.repeat(50));
  
  // 检查位置参数绑定 (:1, :2, :3, etc.)
  const positionalParams = content.match(/:(\d+)/g);
  
  if (positionalParams) {
    filesWithIssues++;
    console.log(`❌ 发现 ${positionalParams.length} 个位置参数绑定:`);
    
    // 统计参数使用情况
    const paramCounts = {};
    positionalParams.forEach(param => {
      paramCounts[param] = (paramCounts[param] || 0) + 1;
    });
    
    Object.entries(paramCounts).forEach(([param, count]) => {
      console.log(`   ${param} 使用了 ${count} 次`);
      if (count > 1) {
        console.log(`   ⚠️  参数 ${param} 重复使用了 ${count} 次`);
      }
    });
    
    totalIssues += positionalParams.length;
  } else {
    console.log('✅ 未发现位置参数绑定问题');
  }
  
  // 检查命名参数绑定的使用情况
  const namedParams = content.match(/:(\w+)/g);
  const namedParamsFiltered = namedParams ? namedParams.filter(param => !/:\d+/.test(param)) : [];
  
  if (namedParamsFiltered.length > 0) {
    console.log(`✅ 发现 ${namedParamsFiltered.length} 个命名参数绑定:`);
    const uniqueNamedParams = [...new Set(namedParamsFiltered)];
    uniqueNamedParams.forEach(param => {
      const count = namedParamsFiltered.filter(p => p === param).length;
      console.log(`   ${param} 使用了 ${count} 次`);
    });
  }
  
  console.log('');
});

console.log('📊 检测结果汇总');
console.log('='.repeat(50));
console.log(`检查文件数: ${routeFiles.length}`);
console.log(`有问题的文件数: ${filesWithIssues}`);
console.log(`位置参数绑定总数: ${totalIssues}`);

if (totalIssues > 0) {
  console.log('\n🚨 发现数据库参数绑定风险！');
  console.log('建议修复措施:');
  console.log('1. 将所有 :1, :2, :n 位置参数替换为命名参数 :dateFrom, :brand');
  console.log('2. 确保参数对象使用键值对形式 { dateFrom: "2024-01-01", brand: "TNF" }');
  console.log('3. 避免参数重复使用和索引计算错误');
  console.log('4. 使用DateHelper工具类处理日期计算');
} else {
  console.log('\n✅ 未发现参数绑定问题，所有查询都已使用命名参数！');
}

process.exit(totalIssues > 0 ? 1 : 0);