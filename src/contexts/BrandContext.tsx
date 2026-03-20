/**
 * 品牌上下文 - 管理品牌代码和品牌名称的动态映射
 * 从后端API获取品牌映射关系，避免前端硬编码
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 品牌映射数据类型
export interface BrandMapping {
  brandCode: string;    // CUSTOMERNO (如 '18405', '18405-1')
  brandName: string;    // 品牌名称 (如 'Dickies', 'TNF')
  fullName: string;     // 品牌全称 (如 'Dickies Clothing')
}

// 上下文数据类型
interface BrandContextType {
  // 品牌映射数据
  brandMappings: BrandMapping[];
  
  // 加载状态
  isLoading: boolean;
  error: string | null;
  
  // 辅助方法
  getBrandNameByCode: (brandCode: string) => string;
  getBrandCodeByName: (brandName: string) => string | null;
  getBrandFullName: (brandCode: string) => string;
  
  // 映射表（优化查询性能）
  codeToNameMap: Record<string, string>;
  nameToCodeMap: Record<string, string>;
  
  // 刷新品牌映射
  refreshBrandMappings: () => Promise<void>;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

interface BrandProviderProps {
  children: ReactNode;
}

export const BrandProvider: React.FC<BrandProviderProps> = ({ children }) => {
  const [brandMappings, setBrandMappings] = useState<BrandMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 映射表（提升查询性能）
  const [codeToNameMap, setCodeToNameMap] = useState<Record<string, string>>({});
  const [nameToCodeMap, setNameToCodeMap] = useState<Record<string, string>>({});

  // 从后端API获取品牌映射
  const fetchBrandMappings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🏷️  正在获取品牌映射...');
      
<<<<<<< HEAD
      // 🔥 修复：安全访问 import.meta.env
      const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
      const apiUrl = isDev 
        ? 'http://localhost:3001/api/brands/mapping'
        : '/api/brands/mapping';
=======
      const apiUrl = '/api/brands/mapping';
>>>>>>> main
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`品牌映射API请求失败: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.data) {
        throw new Error('品牌映射数据格式错误');
      }
      
      const mappings = data.data as BrandMapping[];
      console.log('✅ 品牌映射获取成功:', mappings);
      
      setBrandMappings(mappings);
      
      // 构建映射表
      const codeToName: Record<string, string> = {};
      const nameToCode: Record<string, string> = {};
      
      mappings.forEach(mapping => {
        codeToName[mapping.brandCode] = mapping.brandName;
        nameToCode[mapping.brandName] = mapping.brandCode;
        // 🔥 同时创建大写版本的映射，处理大小写不一致问题
        nameToCode[mapping.brandName.toUpperCase()] = mapping.brandCode;
      });
      
      setCodeToNameMap(codeToName);
      setNameToCodeMap(nameToCode);
      
      console.log('🗺️  品牌映射表:', { codeToName, nameToCode });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取品牌映射失败';
      console.error('❌ 品牌映射获取失败:', errorMessage);
      setError(errorMessage);
      
      // 使用fallback硬编码数据（兼容后端未启动的情况）
      console.warn('⚠️  使用fallback品牌映射数据');
      const fallbackMappings: BrandMapping[] = [
        { brandCode: '18405', brandName: 'DICKIES', fullName: 'Dickies Clothing' },
        { brandCode: '18405-1', brandName: 'TNF', fullName: 'The North Face' },
        { brandCode: '18405-2', brandName: 'ICEBREAKER', fullName: 'Icebreaker' },
        { brandCode: '18405-3', brandName: 'VANS', fullName: 'Vans' },
        { brandCode: '18405-4', brandName: 'TBL', fullName: 'Timberland' }, // 🔥 修改为TBL，与数据库一致
        { brandCode: '18405-5', brandName: 'SMARTWOOL', fullName: 'Smartwool' }
      ];
      
      setBrandMappings(fallbackMappings);
      
      const codeToName: Record<string, string> = {};
      const nameToCode: Record<string, string> = {};
      fallbackMappings.forEach(mapping => {
        codeToName[mapping.brandCode] = mapping.brandName;
        nameToCode[mapping.brandName] = mapping.brandCode;
        // 🔥 同时创建大写版本的映射，处理大小写不一致问题
        nameToCode[mapping.brandName.toUpperCase()] = mapping.brandCode;
      });
      setCodeToNameMap(codeToName);
      setNameToCodeMap(nameToCode);
      
    } finally {
      setIsLoading(false);
    }
  };

  // 组件挂载时获取品牌映射
  useEffect(() => {
    fetchBrandMappings();
  }, []);

  // 根据品牌代码获取品牌名称
  const getBrandNameByCode = (brandCode: string): string => {
    return codeToNameMap[brandCode] || brandCode;
  };

  // 根据品牌名称获取品牌代码
  const getBrandCodeByName = (brandName: string): string | null => {
    return nameToCodeMap[brandName] || null;
  };

  // 获取品牌全称
  const getBrandFullName = (brandCode: string): string => {
    const mapping = brandMappings.find(m => m.brandCode === brandCode);
    return mapping?.fullName || brandCode;
  };

  const value: BrandContextType = {
    brandMappings,
    isLoading,
    error,
    getBrandNameByCode,
    getBrandCodeByName,
    getBrandFullName,
    codeToNameMap,
    nameToCodeMap,
    refreshBrandMappings: fetchBrandMappings
  };

  return (
    <BrandContext.Provider value={value}>
      {children}
    </BrandContext.Provider>
  );
};

// Hook: 使用品牌上下文
export const useBrand = (): BrandContextType => {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
};

// 辅助函数：将品牌代码数组转换为品牌名称数组
export const convertCodesToNames = (
  brandCodes: string[],
  codeToNameMap: Record<string, string>
): string[] => {
  return brandCodes.map(code => codeToNameMap[code] || code);
};

// 辅助函数：将品牌名称数组转换为品牌代码数组
export const convertNamesToCodes = (
  brandNames: string[],
  nameToCodeMap: Record<string, string>
): string[] => {
  return brandNames.map(name => nameToCodeMap[name] || name);
};