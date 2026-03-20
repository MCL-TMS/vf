// 日期工具函数，用于计算财务月和自然月

/**
 * 获取当前财务月的开始和结束日期
 * 财务月通常是从上个月的21日到本月的20日
 */
export function getCurrentFiscalMonth(): { from: string; to: string } {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const currentDay = today.getDate();

  let fromDate: Date;
  let toDate: Date;

  if (currentDay >= 21) {
    // 如果今天是21日及以后，财务月是本月21日到下月20日
    fromDate = new Date(currentYear, currentMonth, 21);
    toDate = new Date(currentYear, currentMonth + 1, 20);
  } else {
    // 如果今天是20日及以前，财务月是上月21日到本月20日
    fromDate = new Date(currentYear, currentMonth - 1, 21);
    toDate = new Date(currentYear, currentMonth, 20);
  }

  return {
    from: formatDate(fromDate),
    to: formatDate(toDate)
  };
}

/**
 * 获取当前自然月的开始和结束日期
 */
export function getCurrentNaturalMonth(): { from: string; to: string } {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // 自然月：本月1日到本月最后一天
  const fromDate = new Date(currentYear, currentMonth, 1);
  const toDate = new Date(currentYear, currentMonth + 1, 0); // 0表示上个月的最后一天

  return {
    from: formatDate(fromDate),
    to: formatDate(toDate)
  };
}

/**
 * 获取指定财务月的开始和结束日期
 */
export function getFiscalMonth(year: number, month: number): { from: string; to: string } {
  // month: 0-11 (0表示1月)
  const fromDate = new Date(year, month, 21);
  const toDate = new Date(year, month + 1, 20);

  return {
    from: formatDate(fromDate),
    to: formatDate(toDate)
  };
}

/**
 * 获取指定自然月的开始和结束日期
 */
export function getNaturalMonth(year: number, month: number): { from: string; to: string } {
  // month: 0-11 (0表示1月)
  const fromDate = new Date(year, month, 1);
  const toDate = new Date(year, month + 1, 0);

  return {
    from: formatDate(fromDate),
    to: formatDate(toDate)
  };
}

/**
 * 格式化日期为 YYYY-MM-DD 格式
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 解析 YYYY-MM-DD 格式的日期字符串
 */
export function parseDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 获取财务月的显示名称
 */
export function getFiscalMonthDisplayName(from: string, to: string): string {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  
  const fromMonth = fromDate.getMonth() + 1;
  const fromYear = fromDate.getFullYear();
  const toMonth = toDate.getMonth() + 1;
  const toYear = toDate.getFullYear();

  if (fromYear === toYear) {
    return `${fromYear}年${fromMonth}月-${toMonth}月财务月`;
  } else {
    return `${fromYear}年${fromMonth}月-${toYear}年${toMonth}月财务月`;
  }
}

/**
 * 获取自然月的显示名称
 */
export function getNaturalMonthDisplayName(from: string, to: string): string {
  const fromDate = parseDate(from);
  const month = fromDate.getMonth() + 1;
  const year = fromDate.getFullYear();
  
  return `${year}年${month}月`;
}

/**
 * 检查是否为财务月（21日到20日）
 */
export function isFiscalMonth(from: string, to: string): boolean {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  
  return fromDate.getDate() === 21 && toDate.getDate() === 20;
}

/**
 * 检查是否为自然月（1日到月末）
 */
export function isNaturalMonth(from: string, to: string): boolean {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  
  const nextMonth = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0);
  
  return fromDate.getDate() === 1 && toDate.getDate() === nextMonth.getDate();
}

/**
 * 获取今天的日期范围（用于默认筛选当天数据）
 */
export function getTodayDateRange(): { from: string; to: string } {
  const today = new Date();
  const todayString = formatDate(today);
  
  return {
    from: todayString,
    to: todayString
  };
}

/**
 * 获取当月第一天到今天的日期范围（用于总览界面默认时间范围）
 */
export function getCurrentMonthToDateRange(): { from: string; to: string } {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  
  // 当月第一天
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  
  return {
    from: formatDate(firstDayOfMonth),
    to: formatDate(today)
  };
}

/**
 * 获取最近N天的日期范围
 */
export function getRecentDaysRange(days: number): { from: string; to: string } {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - days + 1);
  
  return {
    from: formatDate(fromDate),
    to: formatDate(today)
  };
}

/**
 * 获取本周的日期范围（周一到周日）
 */
export function getCurrentWeekRange(): { from: string; to: string } {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
  const monday = new Date(today);
  
  // 计算周一的日期
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  monday.setDate(today.getDate() - daysFromMonday);
  
  // 计算周日的日期
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    from: formatDate(monday),
    to: formatDate(sunday)
  };
}

/**
 * 生成月份选项（用于下拉菜单）
 */
export function generateMonthOptions(type: 'fiscal' | 'natural', count: 12): Array<{
  value: string;
  label: string;
  from: string;
  to: string;
}> {
  const options = [];
  const today = new Date();
  
  for (let i = 0; i < count; i++) {
    const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    
    let dateRange: { from: string; to: string };
    let label: string;
    
    if (type === 'fiscal') {
      dateRange = getFiscalMonth(year, month);
      label = getFiscalMonthDisplayName(dateRange.from, dateRange.to);
    } else {
      dateRange = getNaturalMonth(year, month);
      label = getNaturalMonthDisplayName(dateRange.from, dateRange.to);
    }
    
    options.push({
      value: `${year}-${month + 1}`,
      label,
      from: dateRange.from,
      to: dateRange.to
    });
  }
  
  return options;
}