// Maersk Color System
// This file contains the complete color palette for the VF Logistics Dashboard

export const MaerskColors = {
  // Primary Maersk Colors
  primary: {
    blue: '#0073E6',
    lightBlue: '#4A9EFF',
    darkBlue: '#005BB5',
    white: '#FFFFFF',
    black: '#000000',
  },

  // Functional Colors
  functional: {
    darkBlue: '#1E3A8A',
    midBlue: '#3B82F6',
    brightBlue: '#EBF4FF',
    lightBlue: '#DBEAFE',
    darkGrey: '#374151',
    midGrey: '#6B7280',
    lightGrey: '#E5E7EB',
    brightGrey: '#F9FAFB',
  },

  // Accent Colors
  accent: {
    // Green variants
    darkGreen: '#059669',
    midGreen: '#10B981',
    brightGreen: '#D1FAE5',
    
    // Red variants  
    darkRed: '#DC2626',
    midRed: '#EF4444',
    brightRed: '#FEE2E2',
    
    // Orange variants
    darkOrange: '#EA580C',
    midOrange: '#F97316',
    brightOrange: '#FED7AA',
    
    // Yellow variants
    darkYellow: '#D97706',
    midYellow: '#F59E0B',
    brightYellow: '#FEF3C7',
    
    // Teal variants
    darkTeal: '#0F766E',
    midTeal: '#14B8A6',
    brightTeal: '#CCFBF1',
  },

  // Brand Specific Colors
  brands: {
    TNF: {
      primary: '#FF6B35',
      secondary: '#FFE5D9',
      accent: '#FF8C69',
    },
    DICKIES: {
      primary: '#8B4513',
      secondary: '#F4E4BC',
      accent: '#DEB887',
    },
    VANS: {
      primary: '#FF0000',
      secondary: '#FFE6E6',
      accent: '#FF6B6B',
    },
    TIMBERLAND: {
      primary: '#8B4513',
      secondary: '#F5DEB3',
      accent: '#CD853F',
    },
    ICEBREAKER: {
      primary: '#4682B4',
      secondary: '#E6F3FF',
      accent: '#87CEEB',
    },
    KIPLING: {
      primary: '#9370DB',
      secondary: '#F0E6FF',
      accent: '#BA55D3',
    },
  },

  // Platform Colors
  platforms: {
    tmall: '#FF6A00',
    taobao: '#FF4400',
    jd: '#E3101E',
    pdd: '#E02E24',
    douyin: '#FE2C55',
    xiaohongshu: '#FF2442',
    wechat: '#07C160',
    dianping: '#FFC300',
  },

  // Status Colors
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    pending: '#6B7280',
  },

  // Chart Colors
  charts: {
    series1: '#0073E6',
    series2: '#10B981',
    series3: '#F59E0B',
    series4: '#EF4444',
    series5: '#8B5CF6',
    series6: '#06B6D4',
    series7: '#84CC16',
    series8: '#F97316',
  },
};

// CSS Custom Properties Export
export const cssVariables = {
  '--maersk-blue': MaerskColors.primary.blue,
  '--maersk-light-blue': MaerskColors.primary.lightBlue,
  '--maersk-dark-blue': MaerskColors.primary.darkBlue,
  '--maersk-white': MaerskColors.primary.white,
  '--maersk-black': MaerskColors.primary.black,
  
  '--functional-dark-blue': MaerskColors.functional.darkBlue,
  '--functional-mid-blue': MaerskColors.functional.midBlue,
  '--functional-bright-blue': MaerskColors.functional.brightBlue,
  '--functional-light-blue': MaerskColors.functional.lightBlue,
  '--functional-dark-grey': MaerskColors.functional.darkGrey,
  '--functional-mid-grey': MaerskColors.functional.midGrey,
  '--functional-light-grey': MaerskColors.functional.lightGrey,
  '--functional-bright-grey': MaerskColors.functional.brightGrey,
  
  '--accent-dark-green': MaerskColors.accent.darkGreen,
  '--accent-mid-green': MaerskColors.accent.midGreen,
  '--accent-bright-green': MaerskColors.accent.brightGreen,
  '--accent-dark-red': MaerskColors.accent.darkRed,
  '--accent-mid-red': MaerskColors.accent.midRed,
  '--accent-bright-red': MaerskColors.accent.brightRed,
  '--accent-dark-orange': MaerskColors.accent.darkOrange,
  '--accent-mid-orange': MaerskColors.accent.midOrange,
  '--accent-bright-orange': MaerskColors.accent.brightOrange,
  '--accent-dark-teal': MaerskColors.accent.darkTeal,
  '--accent-mid-teal': MaerskColors.accent.midTeal,
  '--accent-bright-teal': MaerskColors.accent.brightTeal,
};

// Utility Functions
export const getStatusColor = (status: string): string => {
  const statusMap: Record<string, string> = {
    '已签收': MaerskColors.accent.midGreen,
    '已发运': MaerskColors.primary.blue,
    '已揽收': MaerskColors.accent.midTeal,
    '已取消': MaerskColors.accent.midRed,
    '已退回': MaerskColors.accent.midOrange,
    '已转寄': MaerskColors.accent.midYellow,
  };
  return statusMap[status] || MaerskColors.functional.midGrey;
};

export const getBrandColor = (brand: string): string => {
  const brandMap: Record<string, string> = {
    'TNF': MaerskColors.brands.TNF.primary,
    'DICKIES': MaerskColors.brands.DICKIES.primary,
    'VANS': MaerskColors.brands.VANS.primary,
    'TIMBERLAND': MaerskColors.brands.TIMBERLAND.primary,
    'ICEBREAKER': MaerskColors.brands.ICEBREAKER.primary,
    'KIPLING': MaerskColors.brands.KIPLING.primary,
  };
  return brandMap[brand] || MaerskColors.primary.blue;
};

export const getPlatformColor = (platform: string): string => {
  const platformMap: Record<string, string> = {
    'tmall': MaerskColors.platforms.tmall,
    'taobao': MaerskColors.platforms.taobao,
    'jd': MaerskColors.platforms.jd,
    'pdd': MaerskColors.platforms.pdd,
    'douyin': MaerskColors.platforms.douyin,
    'xiaohongshu': MaerskColors.platforms.xiaohongshu,
    'wechat': MaerskColors.platforms.wechat,
    'dianping': MaerskColors.platforms.dianping,
  };
  return platformMap[platform] || MaerskColors.primary.blue;
};

export default MaerskColors;