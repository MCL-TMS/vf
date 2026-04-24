/**
 * 测试平台API的脚本
 * 运行: node test-platform-api.js
 */

const http = require('http');

const testAPI = (path, params) => {
  return new Promise((resolve, reject) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `${path}?${queryString}`;
    
    console.log(`\n🧪 测试API: ${url}`);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: url,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ 状态码: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log('📊 返回数据:', JSON.stringify(json, null, 2));
          resolve(json);
        } catch (e) {
          console.error('❌ JSON解析失败:', data);
          reject(e);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ 请求失败:', error.message);
      reject(error);
    });
    
    req.end();
  });
};

async function runTests() {
  console.log('========================================');
  console.log('🧪 平台API测试');
  console.log('========================================');
  
  try {
    // 测试1: /api/platform/available（带日期范围和自管标识）
    await testAPI('/api/platform/available', {
      startDate: '2026-04-01',
      endDate: '2026-04-10',
      selfFlag: 'Y'
    });
    
    // 测试2: /api/platform/mappings（带日期范围和自管标识）
    await testAPI('/api/platform/mappings', {
      startDate: '2026-04-01',
      endDate: '2026-04-10',
      selfFlag: 'Y'
    });
    
    // 测试3: /api/platform/available（无参数）
    await testAPI('/api/platform/available', {});
    
    console.log('\n✅ 所有测试完成');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  }
}

runTests();
