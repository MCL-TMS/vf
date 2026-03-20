/**
 * 🔥 验证总单量同比环比计算修复的测试文件
 */

import { transformAPIDataToFilteredData, validateAPIData } from './apiDataTransformer-fix';

// 模拟API数据 - 包含同比环比计算所需的所有字段
const mockApiData = {
  success: true,
  data: {
    kpi: {
      totalOrders: 158076,
      pickedOrders: 142268,
      shippedOrders: 135642,
      deliveredOrders: 132845,
      forwardedOrders: 4728,
      returnedOrders: 6234,
      cancelledOrders: 3189,
      avgFirstDispatchHours: 18.5,
      avgDeliveryHours: 52.3,
      firstDispatchSuccessRate: 94.2
    },
    historicalData: {
      lastMonth: {
        totalOrders: 145320
      },
      lastYear: {
        totalOrders: 139840
      }
    },
    brandDistribution: [
      {
        brandName: 'TNF',
        orderCount: 45820,
        deliveredCount: 42156
      }
    ],
    platformDistribution: [
      {
        platformClass: '天猫',
        orderCount: 68542,
        deliveredCount: 63981
      }
    ]
  },
  timestamp: new Date().toISOString(),
  filters: {
    dateFrom: '2025-01-01',
    dateTo: '2025-01-31',
    brand: '',
    platform: ''
  }
};

/**
 * 测试函数：验证同比环比计算
 */
export function testGrowthCalculation() {
  console.log('🧪 [测试开始] 验证总单量同比环比计算修复');
  
  // 1. 验证API数据有效性
  const isValid = validateAPIData(mockApiData);
  console.log('✅ [API数据验证]', isValid ? '通过' : '失败');
  
  // 2. 转换API数据
  const transformedData = transformAPIDataToFilteredData(mockApiData);
  console.log('🔧 [数据转换] 完成');
  
  // 3. 检查总单量KPI
  const totalOrdersKPI = transformedData.kpiData.find(kpi => kpi.label === '总单量');
  
  if (totalOrdersKPI) {
    console.log('📊 [总单量KPI验证]');
    console.log('   数值:', totalOrdersKPI.value);
    console.log('   环比:', totalOrdersKPI.change.mom);
    console.log('   同比:', totalOrdersKPI.change.yoy);
    
    // 验证计算是否正确
    const expectedMom = ((158076 - 145320) / 145320 * 100).toFixed(2);
    const expectedYoy = ((158076 - 139840) / 139840 * 100).toFixed(2);
    
    console.log('🔢 [计算验证]');
    console.log('   期望环比:', expectedMom + '%');
    console.log('   期望同比:', expectedYoy + '%');
    console.log('   实际环比:', totalOrdersKPI.change.mom + '%');
    console.log('   实际同比:', totalOrdersKPI.change.yoy + '%');
    
    const momMatch = Math.abs(parseFloat(expectedMom) - (totalOrdersKPI.change.mom || 0)) < 0.01;
    const yoyMatch = Math.abs(parseFloat(expectedYoy) - (totalOrdersKPI.change.yoy || 0)) < 0.01;
    
    console.log('✅ [环比计算]', momMatch ? '正确' : '错误');
    console.log('✅ [同比计算]', yoyMatch ? '正确' : '错误');
    
    return {
      success: isValid && momMatch && yoyMatch,
      totalOrdersKPI,
      calculations: {
        expectedMom: parseFloat(expectedMom),
        expectedYoy: parseFloat(expectedYoy),
        actualMom: totalOrdersKPI.change.mom,
        actualYoy: totalOrdersKPI.change.yoy
      }
    };
  } else {
    console.log('❌ [错误] 找不到总单量KPI');
    return { success: false, error: '找不到总单量KPI' };
  }
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
  // Node.js 环境
  const result = testGrowthCalculation();
  console.log('🎯 [测试结果]', result.success ? '✅ 修复成功' : '❌ 仍有问题');
}