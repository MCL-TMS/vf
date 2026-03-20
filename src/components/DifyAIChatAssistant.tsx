import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User,
  X,
  Minimize2,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface DifyAIChatAssistantProps {
  analysisData: any;
  selectedBrand?: string;
  dateRange?: { from: string; to: string };
  metricType?: 'S2D' | 'C2D';
}

/**
 * Dify AI 聊天助手组件
 * 
 * 使用Dify API连接GPT大模型，提供专业的物流时效分析
 * 
 * 配置步骤：
 * 1. 在Dify创建聊天助手应用
 * 2. 复制 /DIFY_CHATBOT_PROMPT.md 中的提示词到Dify系统提示词
 * 3. 获取Dify API密钥，替换下面的 DIFY_API_KEY
 * 4. 配置DIFY_API_URL（如使用自建Dify服务器）
 */

// 🔧 配置项 - 请替换为你的实际值
const DIFY_CONFIG = {
  API_KEY: 'YOUR_DIFY_API_KEY_HERE', // ⚠️ 请替换为你的Dify API Key
  API_URL: 'https://api.dify.ai/v1', // Dify API地址（云服务）
  // API_URL: 'http://your-dify-server.com/v1', // 自建Dify服务器
};

export function DifyAIChatAssistant({ 
  analysisData, 
  selectedBrand, 
  dateRange,
  metricType = 'S2D'
}: DifyAIChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 检查API配置
  const isConfigured = DIFY_CONFIG.API_KEY !== 'YOUR_DIFY_API_KEY_HERE';

  // 初始欢迎消息
  useEffect(() => {
    if (messages.length === 0 && isOpen) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: isConfigured 
          ? `你好！我是VF物流时效分析助手 🤖\n\n我由**GPT大模型**驱动，可以帮你：\n\n📊 **深度数据分析**\n• 分析${metricType}时效数据\n• 计算多维度指标\n• 对比快递商表现\n\n🎯 **专业建议**\n• 生成优化改进方案\n• 评估快递商绩效\n• ROI成本效益分析\n\n💡 **快速开始**\n试着问我：\n"哪个快递商表现最好？"\n"如何提升时效达成率？"\n"给我一份完整的优化建议报告"`
          : `⚠️ AI助手尚未配置\n\n请按以下步骤配置Dify：\n\n1️⃣ 在Dify创建聊天助手应用\n2️⃣ 复制 /DIFY_CHATBOT_PROMPT.md 中的提示词\n3️⃣ 获取API密钥\n4️⃣ 在 DifyAIChatAssistant.tsx 中配置密钥\n\n配置完成后即可使用GPT分析数据！`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length, metricType, isConfigured]);

  // 自动滚动到最新消息
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // 🔥 调用Dify API
  const callDifyAPI = async (question: string): Promise<string> => {
    if (!isConfigured) {
      return '⚠️ 请先配置Dify API密钥。查看组件源码中的配置说明。';
    }

    try {
      setError(null);

      // 准备发送给Dify的数据
      const payload = {
        inputs: {
          analysis_data: JSON.stringify(analysisData, null, 2),
          metric_type: metricType,
          date_range: dateRange ? `${dateRange.from} 至 ${dateRange.to}` : '未设置',
          selected_brand: selectedBrand || '全部品牌'
        },
        query: question,
        response_mode: 'blocking', // 'blocking' 同步返回，'streaming' 流式返回
        conversation_id: conversationId,
        user: 'vf-logistics-user-' + Date.now()
      };

      console.log('📤 发送到Dify:', payload);

      const response = await fetch(`${DIFY_CONFIG.API_URL}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `API请求失败: ${response.status}`);
      }

      const data = await response.json();
      console.log('📥 Dify响应:', data);

      // 保存会话ID，用于上下文连续对话
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      return data.answer || '抱歉，AI暂时无法回答这个问题';

    } catch (error: any) {
      console.error('❌ Dify API调用失败:', error);
      setError(error.message);
      
      // 返回友好的错误提示
      if (error.message.includes('401')) {
        return '⚠️ API密钥无效，请检查配置';
      } else if (error.message.includes('429')) {
        return '⚠️ 请求过于频繁，请稍后再试';
      } else if (error.message.includes('Failed to fetch')) {
        return '⚠️ 网络连接失败，请检查网络或API地址配置';
      } else {
        return `⚠️ AI服务暂时不可用：${error.message}`;
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // 调用Dify API
    const aiResponse = await callDifyAPI(userMessage.content);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsTyping(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 快捷问题按钮
  const quickQuestions = [
    '哪个快递商表现最好？',
    '给我完整的绩效排名',
    '如何提升时效达成率？',
    '生成优化建议报告'
  ];

  const handleQuickQuestion = (question: string) => {
    setInputValue(question);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
        <div className="absolute -top-2 -right-2">
          <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 h-6 w-6 rounded-full flex items-center justify-center p-0 animate-pulse">
            <Sparkles className="h-3 w-3" />
          </Badge>
        </div>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Card 
          className="w-80 border-2 border-purple-500/30 bg-gradient-to-r from-purple-50 to-pink-50 cursor-pointer shadow-lg"
          onClick={() => setIsMinimized(false)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-sm">GPT AI 助手</CardTitle>
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                  {messages.length} 条消息
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Card className="w-[400px] max-h-[calc(100vh-3rem)] h-[580px] border-2 border-purple-500/30 bg-white shadow-2xl flex flex-col">
        <CardHeader className="pb-3 border-b bg-gradient-to-r from-purple-50 to-pink-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm flex items-center space-x-1">
                  <span>GPT时效分析助手</span>
                  <Sparkles className="h-3 w-3 text-yellow-500" />
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {metricType} · Powered by Dify
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
          {/* 错误提示 */}
          {error && (
            <Alert variant="destructive" className="m-3 mb-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {/* 消息区域 */}
          <div className="flex-1 overflow-y-auto p-3" ref={scrollAreaRef}>
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-2.5 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      {message.role === 'assistant' ? (
                        <Bot className="h-3 w-3" />
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                      <span className="text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-xs whitespace-pre-line leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-2.5 max-w-[80%]">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                      <span className="text-xs text-gray-600">GPT正在分析数据...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 快捷问题（仅在没有消息或只有欢迎消息时显示） */}
          {messages.length <= 1 && isConfigured && !analysisData?.error && (
            <div className="px-3 pb-2 space-y-2">
              <p className="text-xs text-muted-foreground">💡 快速开始：</p>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((q, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleQuickQuestion(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 输入区域 */}
          <div className="border-t p-3 bg-gray-50 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isConfigured ? "问我任何问题..." : "请先配置API密钥"}
                disabled={!isConfigured || isTyping}
                className="flex-1 text-xs h-8"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping || !isConfigured}
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 h-8 w-8 p-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
              <div className="flex items-center">
                <Sparkles className="h-3 w-3 mr-1 text-yellow-500" />
                <span>GPT-4 · Dify驱动</span>
              </div>
              {conversationId && (
                <Badge variant="secondary" className="text-xs h-4">
                  会话中
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
