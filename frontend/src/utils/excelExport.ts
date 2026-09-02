/**
 * Excel导出工具类
 * 提供通用的数据导出功能，支持总览、物流监控、订单明细等多种场景
 */

interface ExcelExportOptions {
  filename: string;
  sheetName?: string;
  headers: string[];
  data: any[][];
}

/**
 * 导出数据到Excel文件（CSV格式）
 */
export function exportToExcel(options: ExcelExportOptions) {
  const { filename, sheetName = 'Sheet1', headers, data } = options;

  // 构建CSV内容
  const csvContent = [
    headers.join(','), // 表头
    ...data.map(row => 
      row.map(cell => {
        // 处理包含逗号、换行符或引号的单元格
        const cellStr = String(cell ?? '');
        if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    )
  ].join('\n');

  // 添加BOM标记以支持Excel正确识别UTF-8编码
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // 创建下载链接
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 释放URL对象
  URL.revokeObjectURL(url);
}

/**
 * 🔥 导出订单明细Raw Data（从view_TSK_LIST_TASK视图）
 * 将API返回的订单数据导出为Excel格式
 */
export interface OrderDetail {
  carrierId: string;
  companyName: string;
  tskMergeNo: string;
  paymentDate?: string;
  dataSource: string;
  wmsOutboundTime: string;
  disStatusName: string;
  deliveryDays?: number;
  orderTime?: string;
  outboundTime?: string;
  deliveryTime?: string;
  trackingTime?: string;
  dispTime?: string;
  eta?: string;
  addTime?: string;
  deliveryTimesH?: number;
  delayDays?: number;
  delayClassName?: string;
  destProvince: string;
  destCityName: string;
  destSectionName?: string;
  destCustomer: string;
  destCustomerPhone?: string;
  destCustomerAddress?: string;
  sourceProvince?: string;
  sourceCityName?: string;
  tGrossweight?: number;
  calTonAr?: number;
  tCubic?: number;
  blOrderNo?: string;
  operateOrgId?: string;
  ifDelay?: string;
  trDescr?: string;
  selfFlag: string;
  is24h?: string;
  is48hFlag?: string;
  orderTypeName?: string;
  disTypeName?: string;
  trserviceTypeName?: string;
  billingType?: string;
  patchReason1?: string;
  patchReason2?: string;
}

export function exportOrderDetails(
  orderDetails: OrderDetail[],
  filterInfo: {
    brand?: string;
    platform?: string;
    selfFlag?: string;
    dateRange?: { from: string; to: string };
  }
) {
  // 🔥 调试：查看实际数据结构
  console.log('📦 订单明细数据总数:', orderDetails.length);
  if (orderDetails.length > 0) {
    console.log('📦 第一条订单数据示例:', orderDetails[0]);
    console.log('📦 字段列表:', Object.keys(orderDetails[0]));
  }

  // 生成文件名（包含筛选条件和时间戳）
  const timestamp = new Date().toISOString().split('T')[0];
  const brandText = filterInfo.brand && filterInfo.brand !== 'all' ? `_${filterInfo.brand}` : '';
  const platformText = filterInfo.platform && filterInfo.platform !== 'all' ? `_${filterInfo.platform}` : '';
  const dateRangeText = filterInfo.dateRange 
    ? `_${filterInfo.dateRange.from}_to_${filterInfo.dateRange.to}`
    : '';
  
  const filename = `VF物流订单明细${brandText}${platformText}${dateRangeText}_${timestamp}`;

  // 定义表头（中文）- 按图片中的顺序
  const headers = [
    '快递商',
    '项目名称',
    '快递单号',
    '消费者付款时间',
    '平台',
    '出库时间',
    '快递单状态',
    '签收天数',
    'WMS进单时间',
    '揽收时间',
    '发货时长H',
    '目的地省份',
    '目的地城市',
    '重量',
    '应收计费重量',
    '体积',
    '收件人',
    '收件人电话',
    '目的地区县',
    '目的地地址',
    '始发省份',
    '始发城市',
    'WMS订单号',
    '是否超时',
    '预计送达时间',
    '签收时间',
    '超时天数',
    '最后跟踪时间',
    '是否是改地址',
    '是否自管',
    '订单类型',
    '快递单类型',
    '快递产品',
    '进单时间',
    '快递站点',
    '付款方式',
    '配送时长H',
    '一级警告原因',
    '二级警告原因',
    '超时时长H',
    '付款超24H未揽收',
    '超48H未更新',
    '首派时间'
  ];

  // 转换数据为二维数组（按表头顺序）
  const data = orderDetails.map(order => [
    order.carrierId || '',
    order.companyName || '',
    order.tskMergeNo || '',
    order.paymentDate || '',
    order.dataSource || '',
    order.wmsOutboundTime || '',
    order.disStatusName || '',
    order.deliveryDays !== undefined ? order.deliveryDays : '',
    order.orderTime || '',
    order.outboundTime || '',
    order.deliveryTimesH !== undefined ? order.deliveryTimesH : '',
    order.destProvince || '',
    order.destCityName || '',
    order.tGrossweight !== undefined ? order.tGrossweight : '',
    order.calTonAr !== undefined ? order.calTonAr : '',
    order.tCubic !== undefined ? order.tCubic : '',
    order.destCustomer || '',
    order.destCustomerPhone || '',
    order.destSectionName || '',
    order.destCustomerAddress || '',
    order.sourceProvince || '',
    order.sourceCityName || '',
    order.blOrderNo || '',
    order.ifDelay || '',
    order.eta || '',
    order.deliveryTime || '',
    order.delayDays !== undefined ? order.delayDays : '',
    order.trackingTime || '',
    order.trDescr || '',
    order.selfFlag || '',
    order.orderTypeName || '',
    order.disTypeName || '',
    order.trserviceTypeName || '',
    order.addTime || '',
    order.operateOrgId || '',
    order.billingType || '',
    order.deliveryTimesH !== undefined ? order.deliveryTimesH : '',
    order.patchReason1 || '',
    order.patchReason2 || '',
    order.delayClassName || '',
    order.is24h || '',
    order.is48hFlag || '',
    order.dispTime || ''
  ]);

  // 调用通用导出函数
  exportToExcel({
    filename,
    sheetName: '订单明细',
    headers,
    data
  });

  console.log(`✅ 订单明细导出成功: ${filename}.csv，共 ${orderDetails.length} 条记录`);
}

/**
 * 导出物流监控数据（快递商维度）
 */
export interface LogisticsExportData {
  courierData: {
    courierName: string;
    orderCount: number;
    pickedCount: number;
    shippedCount: number;
    deliveredCount: number;
    forwardedCount: number;
    returnedCount: number;
    cancelledCount: number;
    exceptionCount: number;
    pickupTimeout: number;
    shippingTimeout: number;
    deliveryTimeout: number;
    noUpdate48h: number;
    pickupRate: number;
    shippingRate: number;
    deliveryRate: number;
    exceptionRate: number;
    avgDeliveryTime: number;
  }[];
  selectedBrand?: string;
  selectedPlatform?: string;
  selectedSelfFlag?: string;
  dateRange?: { from: string; to: string };
}

export function exportLogisticsData(data: LogisticsExportData) {
  // 生成文件名
  const timestamp = new Date().toISOString().split('T')[0];
  const brandText = data.selectedBrand && data.selectedBrand !== 'all' ? `_${data.selectedBrand}` : '';
  const platformText = data.selectedPlatform && data.selectedPlatform !== 'all' ? `_${data.selectedPlatform}` : '';
  const dateRangeText = data.dateRange 
    ? `_${data.dateRange.from}_to_${data.dateRange.to}`
    : '';
  
  const filename = `VF物流监控_快递商数据${brandText}${platformText}${dateRangeText}_${timestamp}`;

  // 定义表头
  const headers = [
    '快递商',
    '订单总数',
    '已收',
    '已发运',
    '已签收',
    '已转寄',
    '已退货',
    '已取消',
    '异常总数',
    '超时未揽收',
    '超时未发运',
    '超时未签收',
    '超48h未更新',
    '揽收率(%)',
    '发运率(%)',
    '签收率(%)',
    '异常率(%)',
    '平均配送时长(小时)'
  ];

  // 转换数据
  const exportRows = data.courierData.map(courier => [
    courier.courierName || '',
    courier.orderCount || 0,
    courier.pickedCount || 0,
    courier.shippedCount || 0,
    courier.deliveredCount || 0,
    courier.forwardedCount || 0,
    courier.returnedCount || 0,
    courier.cancelledCount || 0,
    courier.exceptionCount || 0,
    courier.pickupTimeout || 0,
    courier.shippingTimeout || 0,
    courier.deliveryTimeout || 0,
    courier.noUpdate48h || 0,
    courier.pickupRate ? courier.pickupRate.toFixed(2) : '0.00',
    courier.shippingRate ? courier.shippingRate.toFixed(2) : '0.00',
    courier.deliveryRate ? courier.deliveryRate.toFixed(2) : '0.00',
    courier.exceptionRate ? courier.exceptionRate.toFixed(2) : '0.00',
    courier.avgDeliveryTime ? courier.avgDeliveryTime.toFixed(2) : '0.00'
  ]);

  // 调用通用导出函数
  exportToExcel({
    filename,
    sheetName: '快递商数据',
    headers,
    data: exportRows
  });

  console.log(`✅ 物流监控数据导出成功: ${filename}.csv，共 ${data.courierData.length} 条记录`);
}

export interface BrandLogisticsExportData {
  brandData: {
    brandName: string;
    orderCount: number;
    pickupTimeout: number;
    shippingTimeout: number;
    deliveryTimeout: number;
    noUpdate48h: number;
    pickupRate: number;
    shippingRate: number;
    deliveryRate: number;
    exceptionRate: number;
  }[];
  selectedBrand?: string;
  selectedPlatform?: string;
  selectedSelfFlag?: string;
  dateRange?: { from: string; to: string };
}

/**
 * 导出物流监控数据（品牌维度）
 */
export function exportBrandLogisticsData(data: BrandLogisticsExportData) {
  const timestamp = new Date().toISOString().split('T')[0];
  const brandText = data.selectedBrand && data.selectedBrand !== 'all' ? `_${data.selectedBrand}` : '';
  const platformText = data.selectedPlatform && data.selectedPlatform !== 'all' ? `_${data.selectedPlatform}` : '';
  const dateRangeText = data.dateRange
    ? `_${data.dateRange.from}_to_${data.dateRange.to}`
    : '';
  const filename = `VF物流监控_品牌数据${brandText}${platformText}${dateRangeText}_${timestamp}`;

  const headers = [
    '品牌',
    '订单总数',
    '超时未揽收',
    '超时未发运',
    '超时未签收',
    '超48h未更新',
    '揽收率(%)',
    '发运率(%)',
    '签收率(%)',
    '异常率(%)'
  ];

  const exportRows = data.brandData.map(brand => [
    brand.brandName || '',
    brand.orderCount || 0,
    brand.pickupTimeout || 0,
    brand.shippingTimeout || 0,
    brand.deliveryTimeout || 0,
    brand.noUpdate48h || 0,
    brand.pickupRate ? brand.pickupRate.toFixed(2) : '0.00',
    brand.shippingRate ? brand.shippingRate.toFixed(2) : '0.00',
    brand.deliveryRate ? brand.deliveryRate.toFixed(2) : '0.00',
    brand.exceptionRate ? brand.exceptionRate.toFixed(2) : '0.00'
  ]);

  exportToExcel({
    filename,
    sheetName: '品牌数据',
    headers,
    data: exportRows
  });

  console.log(`✅ 品牌维度物流监控数据导出成功: ${filename}.csv，共 ${data.brandData.length} 条记录`);
}

/**
 * 导出时效分析RawData到Excel
 */
export function exportTimelinessRawData(
  rawData: any[],
  filterInfo: {
    selectedBrand?: string;
    analysisType?: string;
    dateRange?: { from: string; to: string };
  }
) {
  console.log('📦 时效分析RawData数据总数:', rawData.length);
  
  if (!Array.isArray(rawData) || rawData.length === 0) {
    console.warn('⚠️ 没有数据可导出');
    alert('没有数据可导出');
    return;
  }

  // 生成文件名
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const brandText = filterInfo.selectedBrand && filterInfo.selectedBrand !== 'all' 
    ? `_${filterInfo.selectedBrand}` 
    : '';
  const analysisText = filterInfo.analysisType || 'S2D';
  const dateRangeText = filterInfo.dateRange 
    ? `_${filterInfo.dateRange.from}_to_${filterInfo.dateRange.to}`
    : '';
  
  const filename = `VF时效分析RawData_${analysisText}${brandText}${dateRangeText}_${timestamp}`;

  // Excel表头（根据后端返回的字段顺序）
  const headers = [
    '快递商', '项目名称', '快递单号', '消费者付款时间', '销售平台分类',
    '出库时间', '快递单状态', 'WMS进单时间', '揽收时间', '揽收时长H',
    '目的地省份', '目的地城市', '收件人', '收件人电话', '目的地区县',
    '目的地地址', '始发省份', '始发城市', '是否超时', '预计送达时间',
    '签收时间', '超时天数', '最后跟踪时间', '最后描述', '是否自管',
    '订单类型', '快递单类型', '配送时长H', '一级警告原因', '二级警告原因',
    '超时级别', '超24H未揽收', '超48H未更新', '首派时间',
    '时效分析类型', '实际时效区间', '计划时效区间', '实际时效小时', '计划时效小时'
  ];

  // 转换数据为二维数组
  let isFirstRow = true;  // ✅ 使用标志变量代替 exportRows.length
  const exportRows = rawData.map(order => {
    // 🔍 调试：打印第一条数据查看字段
    if (isFirstRow) {
      console.log('🔍 第一条订单数据字段:', Object.keys(order));
      console.log('🔍 实际时效区间值:', order['实际时效区间']);
      console.log('🔍 计划时效区间值:', order['计划时效区间']);
      isFirstRow = false;  // ✅ 只打印一次
    }
    
    return [
      order['快递商'] || '',
      order['项目名称'] || '',
      order['快递单号'] || '',
      order['消费者付款时间'] || '',
      order['销售平台分类'] || '',
      order['出库时间'] || '',
      order['快递单状态'] || '',
      order['WMS进单时间'] || '',
      order['揽收时间'] || '',
      order['揽收时长H'] || '',
      order['目的地省份'] || '',
      order['目的地城市'] || '',
      order['收件人'] || '',
      order['收件人电话'] || '',
      order['目的地区县'] || '',
      order['目的地地址'] || '',
      order['始发省份'] || '',
      order['始发城市'] || '',
      order['是否超时'] || '',
      order['预计送达时间'] || '',
      order['签收时间'] || '',
      order['超时天数'] || '',
      order['最后跟踪时间'] || '',
      order['最后描述'] || '',
      order['是否自管'] || '',
      order['订单类型'] || '',
      order['快递单类型'] || '',
      order['配送时长H'] || '',
      order['一级警告原因'] || '',
      order['二级警告原因'] || '',
      order['超时级别'] || '',
      order['超24H未揽收'] || '',
      order['超48H未更新'] || '',
      order['首派时间'] || '',
      order['时效分析类型'] || '',
      order['实际时效区间'] || '',
      order['计划时效区间'] || '',
      order['实际时效小时'] || '',
      order['计划时效小时'] || ''
    ];
  });

  console.log('📊 开始导出时效分析RawData到CSV...');

  // 调用通用导出函数
  exportToExcel({
    filename,
    sheetName: `时效分析RawData_${analysisText}`,
    headers,
    data: exportRows
  });

  console.log(`✅ 时效分析RawData导出成功: ${filename}.csv，共 ${rawData.length} 条记录`);
}