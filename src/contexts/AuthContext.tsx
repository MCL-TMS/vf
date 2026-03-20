import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// 🔐 MD5哈希函数 - 用于密码加密
function md5(str: string): string {
  function rotateLeft(value: number, shift: number): number {
    return (value << shift) | (value >>> (32 - shift));
  }

  function addUnsigned(x: number, y: number): number {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  function f(x: number, y: number, z: number): number { return (x & y) | ((~x) & z); }
  function g(x: number, y: number, z: number): number { return (x & z) | (y & (~z)); }
  function h(x: number, y: number, z: number): number { return x ^ y ^ z; }
  function i(x: number, y: number, z: number): number { return y ^ (x | (~z)); }

  function ff(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function gg(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function hh(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function ii(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(str: string): number[] {
    const wordArray: number[] = [];
    for (let i = 0; i < str.length * 8; i += 8) {
      wordArray[i >> 5] |= (str.charCodeAt(i / 8) & 0xFF) << (i % 32);
    }
    return wordArray;
  }

  function wordToHex(value: number): string {
    let hex = '';
    for (let i = 0; i < 4; i++) {
      const byte = (value >>> (i * 8)) & 0xFF;
      hex += ('0' + byte.toString(16)).slice(-2);
    }
    return hex;
  }

  const x = convertToWordArray(str);
  let a = 0x67452301;
  let b = 0xEFCDAB89;
  let c = 0x98BADCFE;
  let d = 0x10325476;

  x[str.length * 8 >> 5] |= 0x80 << (str.length * 8 % 32);
  x[(((str.length * 8 + 64) >>> 9) << 4) + 14] = str.length * 8;

  for (let i = 0; i < x.length; i += 16) {
    const oldA = a, oldB = b, oldC = c, oldD = d;

    a = ff(a, b, c, d, x[i + 0], 7, 0xD76AA478);
    d = ff(d, a, b, c, x[i + 1], 12, 0xE8C7B756);
    c = ff(c, d, a, b, x[i + 2], 17, 0x242070DB);
    b = ff(b, c, d, a, x[i + 3], 22, 0xC1BDCEEE);
    a = ff(a, b, c, d, x[i + 4], 7, 0xF57C0FAF);
    d = ff(d, a, b, c, x[i + 5], 12, 0x4787C62A);
    c = ff(c, d, a, b, x[i + 6], 17, 0xA8304613);
    b = ff(b, c, d, a, x[i + 7], 22, 0xFD469501);
    a = ff(a, b, c, d, x[i + 8], 7, 0x698098D8);
    d = ff(d, a, b, c, x[i + 9], 12, 0x8B44F7AF);
    c = ff(c, d, a, b, x[i + 10], 17, 0xFFFF5BB1);
    b = ff(b, c, d, a, x[i + 11], 22, 0x895CD7BE);
    a = ff(a, b, c, d, x[i + 12], 7, 0x6B901122);
    d = ff(d, a, b, c, x[i + 13], 12, 0xFD987193);
    c = ff(c, d, a, b, x[i + 14], 17, 0xA679438E);
    b = ff(b, c, d, a, x[i + 15], 22, 0x49B40821);

    a = gg(a, b, c, d, x[i + 1], 5, 0xF61E2562);
    d = gg(d, a, b, c, x[i + 6], 9, 0xC040B340);
    c = gg(c, d, a, b, x[i + 11], 14, 0x265E5A51);
    b = gg(b, c, d, a, x[i + 0], 20, 0xE9B6C7AA);
    a = gg(a, b, c, d, x[i + 5], 5, 0xD62F105D);
    d = gg(d, a, b, c, x[i + 10], 9, 0x02441453);
    c = gg(c, d, a, b, x[i + 15], 14, 0xD8A1E681);
    b = gg(b, c, d, a, x[i + 4], 20, 0xE7D3FBC8);
    a = gg(a, b, c, d, x[i + 9], 5, 0x21E1CDE6);
    d = gg(d, a, b, c, x[i + 14], 9, 0xC33707D6);
    c = gg(c, d, a, b, x[i + 3], 14, 0xF4D50D87);
    b = gg(b, c, d, a, x[i + 8], 20, 0x455A14ED);
    a = gg(a, b, c, d, x[i + 13], 5, 0xA9E3E905);
    d = gg(d, a, b, c, x[i + 2], 9, 0xFCEFA3F8);
    c = gg(c, d, a, b, x[i + 7], 14, 0x676F02D9);
    b = gg(b, c, d, a, x[i + 12], 20, 0x8D2A4C8A);

    a = hh(a, b, c, d, x[i + 5], 4, 0xFFFA3942);
    d = hh(d, a, b, c, x[i + 8], 11, 0x8771F681);
    c = hh(c, d, a, b, x[i + 11], 16, 0x6D9D6122);
    b = hh(b, c, d, a, x[i + 14], 23, 0xFDE5380C);
    a = hh(a, b, c, d, x[i + 1], 4, 0xA4BEEA44);
    d = hh(d, a, b, c, x[i + 4], 11, 0x4BDECFA9);
    c = hh(c, d, a, b, x[i + 7], 16, 0xF6BB4B60);
    b = hh(b, c, d, a, x[i + 10], 23, 0xBEBFBC70);
    a = hh(a, b, c, d, x[i + 13], 4, 0x289B7EC6);
    d = hh(d, a, b, c, x[i + 0], 11, 0xEAA127FA);
    c = hh(c, d, a, b, x[i + 3], 16, 0xD4EF3085);
    b = hh(b, c, d, a, x[i + 6], 23, 0x04881D05);
    a = hh(a, b, c, d, x[i + 9], 4, 0xD9D4D039);
    d = hh(d, a, b, c, x[i + 12], 11, 0xE6DB99E5);
    c = hh(c, d, a, b, x[i + 15], 16, 0x1FA27CF8);
    b = hh(b, c, d, a, x[i + 2], 23, 0xC4AC5665);

    a = ii(a, b, c, d, x[i + 0], 6, 0xF4292244);
    d = ii(d, a, b, c, x[i + 7], 10, 0x432AFF97);
    c = ii(c, d, a, b, x[i + 14], 15, 0xAB9423A7);
    b = ii(b, c, d, a, x[i + 5], 21, 0xFC93A039);
    a = ii(a, b, c, d, x[i + 12], 6, 0x655B59C3);
    d = ii(d, a, b, c, x[i + 3], 10, 0x8F0CCC92);
    c = ii(c, d, a, b, x[i + 10], 15, 0xFFEFF47D);
    b = ii(b, c, d, a, x[i + 1], 21, 0x85845DD1);
    a = ii(a, b, c, d, x[i + 8], 6, 0x6FA87E4F);
    d = ii(d, a, b, c, x[i + 15], 10, 0xFE2CE6E0);
    c = ii(c, d, a, b, x[i + 6], 15, 0xA3014314);
    b = ii(b, c, d, a, x[i + 13], 21, 0x4E0811A1);
    a = ii(a, b, c, d, x[i + 4], 6, 0xF7537E82);
    d = ii(d, a, b, c, x[i + 11], 10, 0xBD3AF235);
    c = ii(c, d, a, b, x[i + 2], 15, 0x2AD7D2BB);
    b = ii(b, c, d, a, x[i + 9], 21, 0xEB86D391);

    a = addUnsigned(a, oldA);
    b = addUnsigned(b, oldB);
    c = addUnsigned(c, oldC);
    d = addUnsigned(d, oldD);
  }

  return wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
}

// 用户信息接口
export interface User {
  userId: string;          // 登录账号
  userName: string;        // 用户说明
  customerNos: string[];   // 可查看的品牌列表（从CUSTOMERNO字段解析）
  isAdmin: boolean;        // 是否管理员（如果customerNos为空或包含'all'）
}

// 认证上下文接口
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (userId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasAccessToBrand: (brandCode: string) => boolean;
  getAccessibleBrands: () => string[];
  isLoading: boolean;
}

// 创建认证上下文
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 本地存储键名 - 改用sessionStorage，浏览器关闭后自动清除
const AUTH_STORAGE_KEY = 'vf_logistics_auth';

// AuthProvider 组件
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 初始化：从 sessionStorage 恢复用户会话（仅限当前浏览器会话）
  // ⚠️ 如果需要完全不保持会话，可以删除此useEffect
  useEffect(() => {
    const storedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (storedAuth) {
      try {
        const parsedUser = JSON.parse(storedAuth);
        setUser(parsedUser);
        console.log('✅ [AuthContext] 从sessionStorage恢复用户会话:', parsedUser.userId);
      } catch (error) {
        console.error('❌ [AuthContext] 解析会话失败:', error);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } else {
      console.log('ℹ️ [AuthContext] 无会话数据，需要登录');
    }
    setIsLoading(false);
  }, []);

  // 登录函数
  const login = async (userId: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // 🔧 混合认证模式：
      // - admin/admin123 使用Mock认证（无需后端）
      // - 其他账号使用真实数据库认证
      
      // ===== 检查是否是Admin演示账号 =====
      if (userId.toLowerCase() === 'admin' && password === 'admin123') {
        // Admin使用Mock认证
        const userInfo: User = {
          userId: 'admin',
          userName: '系统管理员（演示）',
          customerNos: [], // 管理员可查看全部
          isAdmin: true,
        };

        setUser(userInfo);
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userInfo));

        return { success: true };
      }

      // ===== 其他账号使用真实API认证 =====
<<<<<<< HEAD
      // 开发环境下使用完整URL（绕过可能存在的Vite代理问题）
      const isDevelopment = import.meta.env.DEV;
      const apiBaseUrl = isDevelopment ? 'http://localhost:3001' : '';
      
      console.log('🔍 [AuthContext] 认证模式:', { isDevelopment, apiBaseUrl });
      
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
=======
      // 统一使用同域 /api；开发环境依赖 Vite 代理转发到本地后端
      const response = await fetch(`/api/auth/login`, {
>>>>>>> main
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, password: md5(password) }),
      });

      // 检查响应是否成功
      if (!response.ok) {
        // 尝试解析错误消息
        let errorMessage = '登录失败，请检查用户名和密码';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // 如果响应不是JSON，使用默认错误消息
          if (response.status === 404) {
            errorMessage = '后端API未启动或路由不存在';
          } else if (response.status === 500) {
            errorMessage = '服务器内部错误';
          }
        }
        return {
          success: false,
          error: errorMessage,
        };
      }

      // 解析成功响应
      const data = await response.json();

      if (data.success && data.user) {
        // 解析 CUSTOMERNO 字段（可能是逗号分隔的多个品牌）
        const customerNos = data.user.customerNo 
          ? data.user.customerNo.split(',').map((code: string) => code.trim()).filter(Boolean)
          : [];

        // 判断是否管理员（customerNos 为空或包含 'all'）
        const isAdmin = customerNos.length === 0 || customerNos.includes('all') || customerNos.includes('ALL');

        const userInfo: User = {
          userId: data.user.userId,
          userName: data.user.userName,
          customerNos: isAdmin ? [] : customerNos, // 管理员 customerNos 为空表示可查看全部
          isAdmin,
        };

        setUser(userInfo);
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userInfo));

        return { success: true };
      }

      return {
        success: false,
        error: '登录失败，服务器返回数据异常',
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: '登录失败，无法连接到服务器。请检查后端API是否启动。',
      };
    }
  };

  // 登出函数
  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    // 同时清理可能存在的localStorage旧数据
    localStorage.removeItem(AUTH_STORAGE_KEY);
    console.log('✅ [AuthContext] 用户已登出，会话已清除');
  };

  // 检查用户是否有权限查看某个品牌
  const hasAccessToBrand = (brandCode: string): boolean => {
    if (!user) return false;
    if (user.isAdmin) return true; // 管理员可查看全部
    return user.customerNos.includes(brandCode);
  };

  // 获取用户可访问的品牌列表
  const getAccessibleBrands = useCallback((): string[] => {
    if (!user) return [];
    if (user.isAdmin) {
      // 管理员返回所有品牌
      return ['18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5'];
    }
    return user.customerNos;
  }, [user]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    hasAccessToBrand,
    getAccessibleBrands,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 自定义 Hook 使用认证上下文
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};