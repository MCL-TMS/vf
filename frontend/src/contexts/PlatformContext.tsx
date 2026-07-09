/**
 * 平台上下文 - 管理平台代码和平台名称的动态映射
 * 从后端API获取平台映射关系，避免前端硬编码
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || '').trim() || (import.meta.env.DEV ? 'http://localhost:3001' : '');

function buildApiUrl(path: string): string {
  return `${API_ORIGIN}${path}`;
}

const DEFAULT_PLATFORM_MAPPINGS: PlatformMapping[] = [
  { platformCode: 'tmall', platformName: '天猫', displayName: '天猫' },
  { platformCode: 'douyin', platformName: '抖音', displayName: '抖音' },
  { platformCode: 'jd', platformName: '京东', displayName: '京东' },
  { platformCode: 'pdd', platformName: '拼多多', displayName: '拼多多' },
  { platformCode: 'official', platformName: '官网', displayName: '官网' },
  { platformCode: 'o2o', platformName: 'O2O', displayName: 'O2O' },
  { platformCode: 'xiaohongshu', platformName: '小红书', displayName: '小红书' },
  { platformCode: 'wechat', platformName: '微信', displayName: '微信' },
];

// 平台映射数据类型
export interface PlatformMapping {
  platformCode: string;    // 平台代码 (如 'tmall', 'douyin')
  platformName: string;    // 平台名称 (如 '天猫', '抖音')
  displayName: string;     // 显示名称（与platformName相同）
}

// 上下文数据类型
interface PlatformContextType {
  // 平台映射数据
  platformMappings: PlatformMapping[];
  
  // 🔥 平台选项列表（用于下拉选择器）
  platformOptions: Array<{ code: string; name: string }>;
  
  // 加载状态
  isLoading: boolean;
  error: string | null;
  
  // 辅助方法
  getPlatformNameByCode: (platformCode: string) => string;
  getPlatformCodeByName: (platformName: string) => string | null;
  
  // 映射表（优化查询性能）
  codeToNameMap: Record<string, string>;
  nameToCodeMap: Record<string, string>;
  
  // 刷新平台映射
  refreshPlatformMappings: () => Promise<void>;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

interface PlatformProviderProps {
  children: ReactNode;
}

export const PlatformProvider: React.FC<PlatformProviderProps> = ({ children }) => {
  const [platformMappings, setPlatformMappings] = useState<PlatformMapping[]>(DEFAULT_PLATFORM_MAPPINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 映射表（提升查询性能）
  const [codeToNameMap, setCodeToNameMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    DEFAULT_PLATFORM_MAPPINGS.forEach(m => {
      map[m.platformCode] = m.platformName;
    });
    return map;
  });
  const [nameToCodeMap, setNameToCodeMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    DEFAULT_PLATFORM_MAPPINGS.forEach(m => {
      map[m.platformName] = m.platformCode;
    });
    return map;
  });

  // 🔥 从API获取平台映射
  const fetchPlatformMappings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const apiUrl = buildApiUrl('/api/platform/mappings');
      
      console.log('🏪 [PlatformContext] 请求平台映射:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`平台映射API请求失败: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('平台映射数据格式错误');
      }

      const mappings: PlatformMapping[] = (data.data || []).map((item: any) => ({
        platformCode: item.platformCode || item.platform_code || item.PLATFORMCODE || item.platformName || item.platform_name || item.PLATFORMNAME,
        platformName: item.platformName || item.platform_name || item.PLATFORMNAME || item.platformCode || item.platform_code || item.PLATFORMCODE,
        displayName: item.displayName || item.display_name || item.DISPLAYNAME || item.platformName || item.platform_name || item.PLATFORMNAME || item.platformCode || item.platform_code || item.PLATFORMCODE,
      })).filter((item: PlatformMapping) => !!item.platformCode && !!item.platformName);

      // 接口“成功但空数据”时也需要兜底，避免筛选器只剩“全部平台”。
      if (mappings.length === 0) {
        console.warn('⚠️ [PlatformContext] 平台映射接口返回空数据，使用默认平台映射兜底');
        setPlatformMappings(DEFAULT_PLATFORM_MAPPINGS);

        const codeToName: Record<string, string> = {};
        const nameToCode: Record<string, string> = {};
        DEFAULT_PLATFORM_MAPPINGS.forEach(mapping => {
          codeToName[mapping.platformCode] = mapping.platformName;
          nameToCode[mapping.platformName] = mapping.platformCode;
        });

        setCodeToNameMap(codeToName);
        setNameToCodeMap(nameToCode);
        return;
      }
      
      console.log('✅ [PlatformContext] 平台映射加载成功:', mappings);
      
      setPlatformMappings(mappings);
      
      // 🔥 构建映射表（优化查询性能）
      const codeToName: Record<string, string> = {};
      const nameToCode: Record<string, string> = {};
      
      mappings.forEach(mapping => {
        codeToName[mapping.platformCode] = mapping.platformName;
        nameToCode[mapping.platformName] = mapping.platformCode;
      });
      
      setCodeToNameMap(codeToName);
      setNameToCodeMap(nameToCode);
      
      console.log('✅ [PlatformContext] 平台映射表构建完成:', {
        平台数量: mappings.length,
        codeToName示例: Object.keys(codeToName).slice(0, 3),
        nameToCode示例: Object.keys(nameToCode).slice(0, 3)
      });
      
    } catch (err: any) {
      console.error('❌ [PlatformContext] 平台映射加载失败:', err);
      setError(err.message || '加载平台映射失败');
      
      // 🔥 回退到默认平台映射（确保应用可用）
      console.warn('⚠️ [PlatformContext] 使用回退平台映射');
      setPlatformMappings(DEFAULT_PLATFORM_MAPPINGS);
      
      const codeToName: Record<string, string> = {};
      const nameToCode: Record<string, string> = {};
      
      DEFAULT_PLATFORM_MAPPINGS.forEach(mapping => {
        codeToName[mapping.platformCode] = mapping.platformName;
        nameToCode[mapping.platformName] = mapping.platformCode;
      });
      
      setCodeToNameMap(codeToName);
      setNameToCodeMap(nameToCode);
      
    } finally {
      setIsLoading(false);
    }
  };

  // 组件挂载时加载平台映射
  useEffect(() => {
    fetchPlatformMappings();
  }, []);

  // 辅助方法：根据平台代码获取平台名称
  const getPlatformNameByCode = (platformCode: string): string => {
    return codeToNameMap[platformCode] || platformCode;
  };

  // 辅助方法：根据平台名称获取平台代码
  const getPlatformCodeByName = (platformName: string): string | null => {
    return nameToCodeMap[platformName] || null;
  };

  // 刷新平台映射
  const refreshPlatformMappings = async () => {
    await fetchPlatformMappings();
  };

  const value: PlatformContextType = {
    platformMappings,
    // 🔥 构建平台选项列表
    platformOptions: platformMappings.map(mapping => ({
      code: mapping.platformCode,
      name: mapping.platformName
    })),
    isLoading,
    error,
    getPlatformNameByCode,
    getPlatformCodeByName,
    codeToNameMap,
    nameToCodeMap,
    refreshPlatformMappings,
  };

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  );
};

// 🔥 自定义Hook：使用平台上下文
export const usePlatform = (): PlatformContextType => {
  const context = useContext(PlatformContext);
  
  if (!context) {
    throw new Error('usePlatform must be used within a PlatformProvider');
  }
  
  return context;
};