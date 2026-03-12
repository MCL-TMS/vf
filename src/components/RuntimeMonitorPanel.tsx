import React, { useState, useEffect } from 'react';
import { runtimeMonitor, type CallRecord, type FileAccessRecord } from '../utils/runtimeMonitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Activity, 
  FileText, 
  Clock, 
  TrendingUp, 
  Download, 
  Trash2, 
  Play, 
  Pause,
  BarChart3,
  Zap
} from 'lucide-react';

export const RuntimeMonitorPanel: React.FC = () => {
  const [enabled, setEnabled] = useState(runtimeMonitor.isEnabled());
  const [statistics, setStatistics] = useState(runtimeMonitor.getStatistics());
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [fileAccess, setFileAccess] = useState<FileAccessRecord[]>([]);
  const [selectedType, setSelectedType] = useState<CallRecord['type'] | 'all'>('all');

  // 自动刷新
  useEffect(() => {
    const interval = setInterval(() => {
      if (runtimeMonitor.isEnabled()) {
        setStatistics(runtimeMonitor.getStatistics());
        setRecords(runtimeMonitor.getRecords().slice(-100)); // 只显示最近100条
        setFileAccess(runtimeMonitor.getFileAccess());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    if (enabled) {
      runtimeMonitor.disable();
      setEnabled(false);
    } else {
      runtimeMonitor.enable();
      setEnabled(true);
    }
  };

  const handleClear = () => {
    runtimeMonitor.clear();
    setStatistics(runtimeMonitor.getStatistics());
    setRecords([]);
    setFileAccess([]);
  };

  const handleExport = () => {
    runtimeMonitor.exportReport();
  };

  const filteredRecords = selectedType === 'all' 
    ? records 
    : records.filter(r => r.type === selectedType);

  const getTypeColor = (type: CallRecord['type']) => {
    switch (type) {
      case 'component': return 'bg-blue-500';
      case 'hook': return 'bg-green-500';
      case 'api': return 'bg-purple-500';
      case 'function': return 'bg-orange-500';
      case 'route': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  const getFileTypeColor = (type: FileAccessRecord['type']) => {
    switch (type) {
      case 'component': return 'bg-blue-100 text-blue-800';
      case 'hook': return 'bg-green-100 text-green-800';
      case 'util': return 'bg-yellow-100 text-yellow-800';
      case 'service': return 'bg-purple-100 text-purple-800';
      case 'data': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed top-0 right-0 w-[600px] h-screen bg-white shadow-2xl z-50 overflow-hidden flex flex-col border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-maersk-blue to-blue-600 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Activity className="h-6 w-6" />
            <h2 className="text-xl font-bold">运行时监测工具</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant={enabled ? 'destructive' : 'default'}
              onClick={handleToggle}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              {enabled ? (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  停止
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  启动
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              className="bg-white/20 hover:bg-white/30 text-white"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              清空
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExport}
              className="bg-white/20 hover:bg-white/30 text-white"
            >
              <Download className="h-4 w-4 mr-1" />
              导出
            </Button>
          </div>
        </div>
        
        {/* 运行状态 */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <div className={`h-2 w-2 rounded-full ${enabled ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span>{enabled ? '监测中' : '已停止'}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>{Math.round(statistics.runningTime / 1000)}秒</span>
          </div>
          <div className="flex items-center space-x-1">
            <FileText className="h-3 w-3" />
            <span>{statistics.totalRecords} 条记录</span>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="p-4 grid grid-cols-3 gap-2 border-b bg-gray-50">
        <div className="bg-white rounded-lg p-3 border shadow-sm">
          <div className="text-xs text-gray-500 mb-1">组件渲染</div>
          <div className="text-2xl font-bold text-blue-600">{statistics.componentRenders}</div>
        </div>
        <div className="bg-white rounded-lg p-3 border shadow-sm">
          <div className="text-xs text-gray-500 mb-1">API调用</div>
          <div className="text-2xl font-bold text-purple-600">{statistics.apiCalls}</div>
        </div>
        <div className="bg-white rounded-lg p-3 border shadow-sm">
          <div className="text-xs text-gray-500 mb-1">Hook调用</div>
          <div className="text-2xl font-bold text-green-600">{statistics.hookCalls}</div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="records" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="records" className="flex items-center space-x-1">
            <Activity className="h-3 w-3" />
            <span>调用记录</span>
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center space-x-1">
            <FileText className="h-3 w-3" />
            <span>文件访问</span>
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center space-x-1">
            <BarChart3 className="h-3 w-3" />
            <span>统计分析</span>
          </TabsTrigger>
        </TabsList>

        {/* Records Tab */}
        <TabsContent value="records" className="flex-1 overflow-hidden flex flex-col mx-4 mb-4">
          {/* Type Filter */}
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-sm text-gray-600">筛选:</span>
            {['all', 'component', 'hook', 'api', 'function', 'route'].map((type) => (
              <Button
                key={type}
                size="sm"
                variant={selectedType === type ? 'default' : 'outline'}
                onClick={() => setSelectedType(type as any)}
                className="h-7 text-xs"
              >
                {type === 'all' ? '全部' : type}
              </Button>
            ))}
          </div>

          {/* Records List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                暂无记录
              </div>
            ) : (
              filteredRecords.map((record, index) => (
                <div
                  key={index}
                  className="bg-white border rounded-lg p-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2 flex-1">
                      <div className={`w-2 h-2 rounded-full ${getTypeColor(record.type)}`} />
                      <span className="font-mono text-sm font-semibold truncate">
                        {record.name}
                      </span>
                    </div>
                    {record.duration && (
                      <Badge variant="secondary" className="text-xs">
                        <Zap className="h-3 w-3 mr-1" />
                        {record.duration.toFixed(2)}ms
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-mono truncate">{record.file || 'Unknown'}</span>
                    <span>{new Date(record.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="flex-1 overflow-hidden flex flex-col mx-4 mb-4">
          <div className="flex-1 overflow-y-auto space-y-2">
            {fileAccess.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                暂无文件访问记录
              </div>
            ) : (
              fileAccess
                .sort((a, b) => b.accessCount - a.accessCount)
                .map((file, index) => (
                  <div
                    key={index}
                    className="bg-white border rounded-lg p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-mono text-sm font-semibold truncate mb-1">
                          {file.file}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={`text-xs ${getFileTypeColor(file.type)}`}>
                            {file.type}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            访问 {file.accessCount} 次
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>首次: {new Date(file.firstAccess).toLocaleTimeString()}</span>
                      <span>最近: {new Date(file.lastAccess).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="flex-1 overflow-hidden mx-4 mb-4">
          <div className="space-y-4 overflow-y-auto h-full">
            {/* Top Files */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">🔥 最常调用的文件</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {statistics.topFiles.slice(0, 5).map((file, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="font-mono truncate flex-1">{file.file}</span>
                    <Badge variant="secondary">{file.accessCount}次</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Slowest Calls */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">🐢 最慢的调用</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {statistics.slowestCalls.slice(0, 5).map((call, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="font-mono truncate flex-1">{call.name}</span>
                    <Badge variant="destructive">{call.duration?.toFixed(2)}ms</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Average Performance */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">⚡ 性能指标</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">平均耗时:</span>
                  <span className="font-semibold">{statistics.avgDuration.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">唯一文件数:</span>
                  <span className="font-semibold">{statistics.uniqueFiles}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">路由变化:</span>
                  <span className="font-semibold">{statistics.routeChanges}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
