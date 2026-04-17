/**
 * 认证调试工具
 * 用于测试后端登录API连接
 */

import React, { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface TestResult {
  timestamp: string;
  userId: string;
  success: boolean;
  message: string;
  details?: any;
}

export const AuthDebugger: React.FC = () => {
  const [userId, setUserId] = useState('testuser');
  const [password, setPassword] = useState('testpass');
  const [results, setResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);
  
  // 使用绝对URL（当前站点）便于排查部署/反代问题
  const [useDirectUrl, setUseDirectUrl] = useState(true);

  const testBackendConnection = async () => {
    const timestamp = new Date().toLocaleTimeString();
    setTesting(true);

    // 根据选项决定URL
    const baseUrl = useDirectUrl ? window.location.origin : '';
    const loginUrl = `${baseUrl}/api/auth/login`;

    console.log('🔍 [AuthDebugger] 使用URL:', loginUrl);

    try {
      // 测试1: GET请求（端点说明）
      console.log('🔍 [AuthDebugger] 开始测试GET', loginUrl);
      const getResponse = await fetch(loginUrl, {
        method: 'GET',
      });

      console.log('📨 [AuthDebugger] GET响应状态:', getResponse.status);
      console.log('📨 [AuthDebugger] Content-Type:', getResponse.headers.get('content-type'));

      // 检查是否返回HTML（说明后端未启动或路由错误）
      const contentType = getResponse.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        setResults(prev => [...prev, {
          timestamp,
          userId: 'N/A',
          success: false,
          message: '❌ 后端未启动或路由不存在',
          details: {
            error: '收到HTML响应而非JSON',
            tip: '请在终端运行: cd backend && npm start',
            status: getResponse.status
          }
        }]);
        setTesting(false);
        return;
      }

      const getData = await getResponse.json();

      setResults(prev => [...prev, {
        timestamp,
        userId: 'N/A',
        success: true,
        message: '✅ GET /api/auth/login 端点可访问',
        details: getData
      }]);

      // 测试2: POST请求（实际登录）
      const postResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, password }),
      });

      const postData = await postResponse.json();

      setResults(prev => [...prev, {
        timestamp,
        userId,
        success: postResponse.ok,
        message: postResponse.ok 
          ? `✅ POST /api/auth/login 成功 (${postResponse.status})` 
          : `❌ POST /api/auth/login 失败 (${postResponse.status})`,
        details: postData
      }]);

    } catch (error: any) {
      setResults(prev => [...prev, {
        timestamp,
        userId,
        success: false,
        message: `❌ 连接失败: ${error.message}`,
        details: { error: error.toString() }
      }]);
    } finally {
      setTesting(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="p-6 space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">🔧 认证API调试工具</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">用户名</label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="输入测试用户名"
              disabled={testing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">密码</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入测试密码"
              disabled={testing}
            />
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={testBackendConnection}
              disabled={testing}
              className="flex-1"
            >
              {testing ? '测试中...' : '🚀 测试后端连接'}
            </Button>
            
            <Button 
              onClick={clearResults}
              variant="outline"
              disabled={testing}
            >
              清空结果
            </Button>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">测试选项</label>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={useDirectUrl}
                onChange={(e) => setUseDirectUrl(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">使用绝对URL（当前站点）</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">测试结果</h3>
        
        {results.length === 0 ? (
          <p className="text-gray-500">暂无测试结果，点击上方按钮开始测试</p>
        ) : (
          <div className="space-y-4">
            {results.map((result, index) => (
              <div 
                key={index}
                className={`p-4 rounded-lg border ${
                  result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-sm text-gray-600">
                    {result.timestamp}
                  </span>
                  {result.userId !== 'N/A' && (
                    <span className="text-sm text-gray-600">
                      用户: {result.userId}
                    </span>
                  )}
                </div>
                
                <p className="font-medium mb-2">{result.message}</p>
                
                {result.details && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                      查看详细信息
                    </summary>
                    <pre className="mt-2 p-3 bg-white rounded border text-xs overflow-auto max-h-60">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6 bg-blue-50">
        <h3 className="text-lg font-bold mb-3">💡 使用说明</h3>
        <ul className="space-y-2 text-sm">
          <li>• 所有账号都会调用后端 /api/auth/login 接口</li>
          <li>• 请使用测试库或受控环境中的真实测试账号</li>
          <li>• <strong>默认已启用绝对URL</strong>：更容易定位反代/路由问题</li>
          <li>• 后端必须可通过当前站点的 <strong>/api</strong> 访问到</li>
          <li>• 如需测试相对路径请求，取消勾选“使用绝对URL（当前站点）”</li>
        </ul>
      </Card>
    </div>
  );
};