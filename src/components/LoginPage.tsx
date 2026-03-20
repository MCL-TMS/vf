import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Checkbox } from './ui/checkbox';
import { Loader2, LogIn, Package, AlertCircle } from 'lucide-react';

// LocalStorage key for remembered username
const REMEMBERED_USERNAME_KEY = 'vf_logistics_remembered_username';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberUsername, setRememberUsername] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔥 新增：页面加载时，从localStorage读取保存的用户名
  useEffect(() => {
    const savedUsername = localStorage.getItem(REMEMBERED_USERNAME_KEY);
    if (savedUsername) {
      setUserId(savedUsername);
      setRememberUsername(true); // 自动勾选"记住用户名"
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(userId.trim(), password);
      
      if (!result.success) {
        setError(result.error || '登录失败');
      } else {
        // 🔥 新增：登录成功后，根据勾选状态保存或清除用户名
        if (rememberUsername) {
          localStorage.setItem(REMEMBERED_USERNAME_KEY, userId.trim());
        } else {
          localStorage.removeItem(REMEMBERED_USERNAME_KEY);
        }
      }
    } catch (err) {
      setError('登录过程中发生错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-functional-bright-grey via-white to-functional-bright-grey p-4">
      <div className="w-full max-w-md">
        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-maersk-blue p-4 rounded-lg shadow-lg">
              <Package className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-maersk-blue mb-2">MCL物流运营系统</h1>
          <p className="text-functional-mid-grey">MCL CMS Analytics Dashboard</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-functional-light-grey">
          <CardHeader>
            <CardTitle className="text-2xl text-center">用户登录</CardTitle>
            <CardDescription className="text-center">
              请输入您的账号和密码
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="bg-accent-bright-red border-accent-mid-red">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* User ID Input */}
              <div className="space-y-2">
                <Label htmlFor="userId" className="text-sm font-medium">
                  用户名
                </Label>
                <Input
                  id="userId"
                  type="text"
                  placeholder="请输入用户名"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={isLoading}
                  className="h-11"
                  autoComplete="username"
                  autoFocus
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  密码
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-11"
                  autoComplete="current-password"
                />
              </div>

              {/* Remember Username Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberUsername"
                  checked={rememberUsername}
                  onCheckedChange={(checked) => setRememberUsername(checked === true)}
                  disabled={isLoading}
                />
                <Label
                  htmlFor="rememberUsername"
                  className="text-sm text-functional-dark-grey cursor-pointer select-none"
                >
                  记住用户名
                </Label>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-maersk-blue hover:bg-maersk-blue/90 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    登录
                  </>
                )}
              </Button>
            </form>

            {/* Footer Info */}
            <div className="mt-6 text-center text-xs text-functional-mid-grey space-y-1">
              
              <p className="text-functional-dark-grey">© 2026 Maersk China Logistics. All rights reserved.</p>
            </div>

            {/* 🔧 演示账号说明 */}
            <div className="mt-4 p-4 bg-maersk-blue/5 rounded-md border border-maersk-blue/20">
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="h-5 w-5 rounded-full bg-maersk-blue/20 flex items-center justify-center">
                    <span className="text-maersk-blue text-xs">ℹ</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-maersk-blue mb-2">📝 演示登录账号</p>
                  <div className="bg-white rounded p-2 mb-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-functional-mid-grey">用户名：</span>
                      <span className="font-mono font-semibold text-maersk-blue">admin</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-functional-mid-grey">密码：</span>
                      <span className="font-mono font-semibold text-maersk-blue">admin123</span>
                    </div>
                  </div>
                  <p className="text-xs text-functional-mid-grey leading-relaxed">
                    • 演示账号无需后端服务器，可直接登录<br />
                    • 管理员权限，可查看所有品牌数据<br />
                    • 其他数据库账号需启动后端API服务器
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-functional-mid-grey">
          <p>如有问题，请联系系统管理员</p>
        </div>
      </div>
    </div>
  );
};