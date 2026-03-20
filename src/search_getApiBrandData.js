const fs = require('fs');

// 读取文件内容
const filePath = './components/CourierMonitoring.tsx';
const content = fs.readFileSync(filePath, 'utf8');

// 按行分割内容
const lines = content.split('\n');

// 搜索包含 getApiBrandData 的行
console.log('搜索 getApiBrandData 调用:');
lines.forEach((line, index) => {
  if (line.includes('getApiBrandData')) {
    console.log(`第${index + 1}行: ${line.trim()}`);
  }
});

// 也搜索可能相关的行范围（1130-1140）
console.log('\n第1130-1140行内容:');
for (let i = 1129; i <= 1139; i++) {
  if (lines[i]) {
    console.log(`第${i + 1}行: ${lines[i]}`);
  }
}