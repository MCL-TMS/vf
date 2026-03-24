import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Checkbox } from './ui/checkbox';
import { Loader2, LogIn, Package, AlertCircle } from 'lucide-react';
// 导入背景图（路径匹配 src/components → src/assets）
import loginBg from '../assets/微信图片_20260323172528.png'; // 替换为你的实际图片名

const REMEMBERED_USERNAME_KEY = 'vf_logistics_remembered_username';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberUsername, setRememberUsername] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedUsername = localStorage.getItem(REMEMBERED_USERNAME_KEY);
    if (savedUsername) {
      setUserId(savedUsername);
      setRememberUsername(true);
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

  // 定义背景样式对象（避免JSX内联样式解析错误）
  const bgStyle = {
    backgroundImage: `url(${loginBg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    backgroundRepeat: 'no-repeat'
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={bgStyle}>
      {/* 渐变遮罩层 */}
      <div className="absolute inset-0 bg-gradient-to-br from-functional-bright-grey/90 via-white/85 to-functional-bright-grey/90 z-0"></div>
      
      {/* 登录内容容器 */}
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-maersk-blue p-4 rounded-lg shadow-lg">
              <Package className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-maersk-blue mb-2">MCL物流运营系统</h1>
          <p className="text-functional-mid-grey">MCL CMS Analytics Dashboard</p>
        </div>

        <Card className="shadow-xl border-functional-light-grey bg-white/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-center">用户登录</CardTitle>
            <CardDescription className="text-center">
              请输入您的账号和密码
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-accent-bright-red border-accent-mid-red focus:outline-none">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* 用户名 */}
              <div className="space-y-2">
                <Label htmlFor="userId" className="text-sm font-medium">用户名</Label>
                <Input
                  id="userId"
                  type="text"
                  placeholder="请输入用户名"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={isLoading}
                  className="h-11 border-functional-light-grey"
                  autoComplete="username"
                  autoFocus
                />
              </div>

              {/* 密码 */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-11 border-functional-light-grey"
                  autoComplete="current-password"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberUsername"
                  checked={rememberUsername}
                  onCheckedChange={(checked) => setRememberUsername(checked === true)}
                  disabled={isLoading}
                  className="data-[state=checked]:bg-maersk-blue data-[state=checked]:border-maersk-blue focus:ring-0 focus:outline-none focus:ring-offset-0"
                />
                <Label
                  htmlFor="rememberUsername"
                  className="text-sm text-functional-dark-grey cursor-pointer select-none"
                >
                  记住用户名
                </Label>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-maersk-blue hover:bg-maersk-blue/90 text-white focus:ring-0 focus:outline-none focus:border-transparent"
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

            <div className="mt-6 text-center text-xs text-functional-mid-grey space-y-1">
              <p className="text-functional-dark-grey">© 2026 Maersk China Logistics. All rights reserved.</p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-functional-mid-grey">
          <p>如有问题，请联系系统管理员</p>
        </div>
      </div>
    </div>
  );
};