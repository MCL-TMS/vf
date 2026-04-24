const fs = require('fs');
const file = 'c:/Users/EZO010/Downloads/git测试/mcl-ct/src/backend/src/routes/platforms.js';
let content = fs.readFileSync(file, 'utf8');

// The file might contain broken backticks/chinese chars around here:
content = content.replace(/platformList\.slice\(0, 5\).*?join\(', '\)\);/g, 'platformList.slice(0, 5).map(p => `${p.platformName}(${p.orderCount})`).join(", "));');

fs.writeFileSync(file, content);
console.log("Fixed platforms.js");