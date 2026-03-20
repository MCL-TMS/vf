#!/usr/bin/env node

/**
 * 快速测试brands接口是否可用
 */

const testBrandsAPI = async () => {
  try {
    const url = 'http://127.0.0.1:3001/api/logistics/brands?dateFrom=2025-01-01&dateTo=2025-01-18';
    console.log('🧪 测试brands接口:', url);
    
    const response = await fetch(url);
    console.log('📊 状态码:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ 接口响应成功!');
      console.log('📋 数据概览:', {
        success: data.success,
        brandCount: data.data?.brandExceptions?.length || 0,
        totalOrders: data.data?.summary?.totalOrders || 0,
        totalExceptions: data.data?.summary?.totalExceptions || 0
      });
    } else {
      const errorText = await response.text();
      console.log('❌ 接口失败:', errorText);
    }
  } catch (error) {
    console.log('💥 请求异常:', error.message);
  }
};

testBrandsAPI();