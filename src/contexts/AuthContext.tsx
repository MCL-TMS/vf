import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createApiClientError, shouldLogoutForErrorCode } from '../services/apiError';
import { ApiService } from '../services/apiService';

// 用户信息接口
export interface User {
  userId: string;          // 登录账号
  userName: string;        // 用户说明
  roleId?: string;         // 角色ID（来自RWSYS_USER.ROLE_ID）
  customerNos: string[];   // 可查看的品牌列表（从CUSTOMERNO字段解析）
  isAdmin: boolean;        // 是否管理员（如果customerNos为空或包含'all'）
  token?: string;          // 🔥 Access Token
  refreshToken?: string;   // 🔥 新增：Refresh Token
}

// 认证上下文接口
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (userId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>; // 🔥 改为异步
  hasAccessToBrand: (brandCode: string) => boolean;
  getAccessibleBrands: () => string[];
  isLoading: boolean;
  getToken: () => string | null;
  getRefreshToken: () => string | null; // 🔥 新增
  refreshToken: () => Promise<boolean>; // 🔥 新增
  updateToken: (newToken: string) => void; // 🔥 新增
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
        if (!parsedUser?.token || !parsedUser?.refreshToken) {
          console.warn('⚠️ [AuthContext] 发现旧会话中缺少token或refreshToken，已清理并要求重新登录');
          sessionStorage.removeItem(AUTH_STORAGE_KEY);
          localStorage.removeItem(AUTH_STORAGE_KEY);
          ApiService.setAccessToken(null);
          setIsLoading(false);
          return;
        }
        setUser(parsedUser);
        ApiService.setAccessToken(parsedUser.token || null);
        console.log('✅ [AuthContext] 从sessionStorage恢复用户会话:', parsedUser.userId);
      } catch (error) {
        console.error('❌ [AuthContext] 解析会话失败:', error);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        ApiService.setAccessToken(null);
      }
    } else {
      ApiService.setAccessToken(null);
      console.log('ℹ️ [AuthContext] 无会话数据，需要登录');
    }
    setIsLoading(false);
  }, []);

  // 登录函数
  const login = async (userId: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // 所有账号统一走后端认证
      // 开发环境下使用完整URL（绕过可能存在的Vite代理问题）
      const isDevelopment = import.meta.env.DEV;
      const apiBaseUrl = isDevelopment ? 'http://localhost:3001' : '';
      
      console.log('🔍 [AuthContext] 认证模式:', { isDevelopment, apiBaseUrl });
      
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, password }),
      });

      // 检查响应是否成功
      if (!response.ok) {
        const errorPayload = await response.clone().json().catch(() => null);
        const apiError = createApiClientError({
          status: response.status,
          payload: errorPayload,
          fallbackError: '登录失败，请检查用户名和密码'
        });

        return {
          success: false,
          error: apiError.message,
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
          roleId: data.user.roleId || '',
          customerNos: isAdmin ? [] : customerNos, // 管理员 customerNos 为空表示可查看全部
          isAdmin,
          token: data.token, // 🔥 新增：保存token
          refreshToken: data.refreshToken, // 🔥 新增：保存refreshToken
        };

        setUser(userInfo);
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userInfo));
        ApiService.setAccessToken(userInfo.token || null);
        ApiService.clearHealthCheckCache();

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
  const logout = async (): Promise<void> => {
    try {
      const token = user?.token;
      const refreshToken = user?.refreshToken;
      const isDevelopment = import.meta.env.DEV;
      const apiBaseUrl = isDevelopment ? 'http://localhost:3001' : '';

      if (token) {
        await fetch(`${apiBaseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      console.warn('⚠️ [AuthContext] 后端登出失败，继续清理本地会话:', error);
    } finally {
      ApiService.setAccessToken(null);
      setUser(null);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      // 同时清理可能存在的localStorage旧数据
      localStorage.removeItem(AUTH_STORAGE_KEY);
      console.log('✅ [AuthContext] 用户已登出，会话已清除');
    }
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

  // 🔥 新增：获取token的方法
  const getToken = (): string | null => {
    return user?.token || null;
  };

  // 🔥 新增：获取refreshToken的方法
  const getRefreshToken = (): string | null => {
    return user?.refreshToken || null;
  };

  // 🔥 新增：刷新token的方法
  const refreshToken = async (): Promise<boolean> => {
    const currentRefreshToken = getRefreshToken();
    
    if (!currentRefreshToken || !user) {
      console.error('❌ [AuthContext] 无refreshToken或用户信息，无法刷新token');
      await logout();
      return false;
    }

    try {
      console.log('🔄 [AuthContext] 开始刷新token...');
      
      // 开发环境下使用完整URL
      const isDevelopment = import.meta.env.DEV;
      const apiBaseUrl = isDevelopment ? 'http://localhost:3001' : '';
      
      const response = await fetch(`${apiBaseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });

      if (!response.ok) {
        const errorPayload = await response.clone().json().catch(() => null);
        const apiError = createApiClientError({
          status: response.status,
          payload: errorPayload,
          fallbackError: 'Token刷新失败'
        });

        console.error('❌ [AuthContext] Token刷新失败:', apiError.code, apiError.message);

        if (shouldLogoutForErrorCode(apiError.code) || response.status === 401) {
          await logout();
        }
        
        return false;
      }

      const data = await response.json();

      if (data.success && data.token) {
        // 更新token，保持其他用户信息不变
        const updatedUser: User = {
          ...user,
          token: data.token,
          // 如果后端返回了新的refresh token（轮换策略），也更新
          refreshToken: data.refreshToken || user.refreshToken,
        };

        setUser(updatedUser);
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
        ApiService.setAccessToken(updatedUser.token || null);
        ApiService.clearHealthCheckCache();

        console.log('✅ [AuthContext] Token刷新成功');
        return true;
      }

      console.error('❌ [AuthContext] Token刷新失败，服务器返回数据异常');
      return false;
    } catch (error) {
      console.error('❌ [AuthContext] Token刷新异常:', error);
      return false;
    }
  };

  // 🔥 新增：更新token的方法
  const updateToken = (newToken: string): void => {
    if (!user) return;
    const updatedUser: User = {
      ...user,
      token: newToken,
    };
    setUser(updatedUser);
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
    ApiService.setAccessToken(newToken);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    hasAccessToBrand,
    getAccessibleBrands,
    isLoading,
    getToken,
    getRefreshToken,
    refreshToken,
    updateToken,
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