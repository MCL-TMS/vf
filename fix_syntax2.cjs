const fs = require('fs');
const file = 'c:/Users/EZO010/Downloads/git测试/mcl-ct/src/backend/src/routes/platforms.js';
let content = fs.readFileSync(file, 'utf8');

// replace the console log around 217
content = content.replace(/console\.log\(`[\s\S]*?,\s*\n\s*platformList\.slice\(0, 5\)/g, "console.log('✅ 返回 ' + platformList.length + ' 个有订单的平台:', platformList.slice(0, 5)");

fs.writeFileSync(file, content);
console.log("Fixed platforms.js line 217");