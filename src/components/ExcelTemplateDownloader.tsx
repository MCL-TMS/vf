/**
 * VF物流分析平台 - Excel模板下载器
 * 
 * 生成标准格式的时效表格Excel模板供用户下载
 */

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Download, FileSpreadsheet, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function ExcelTemplateDownloader() {
  const [isGenerating, setIsGenerating] = useState(false);

  // 示例数据 - 更完整的模板数据
  const templateData = [
    // 顺丰 - 一线城市
    { carrier: 'SF', city: '北京市', dickies: 48, icebreaker: 48, tbl: 72, tnf: 48, vans: 48 },
    { carrier: 'SF', city: '上海市', dickies: 48, icebreaker: 48, tbl: 72, tnf: 48, vans: 48 },
    { carrier: 'SF', city: '广州市', dickies: 48, icebreaker: 48, tbl: 72, tnf: 48, vans: 48 },
    { carrier: 'SF', city: '深圳市', dickies: 48, icebreaker: 48, tbl: 72, tnf: 48, vans: 48 },
    
    // 圆通 - 二线城市
    { carrier: 'YTO', city: '成都市', dickies: 72, icebreaker: 72, tbl: 96, tnf: 72, vans: 72 },
    { carrier: 'YTO', city: '武汉市', dickies: 72, icebreaker: 72, tbl: 96, tnf: 72, vans: 72 },
    { carrier: 'YTO', city: '西安市', dickies: 72, icebreaker: 72, tbl: 96, tnf: 72, vans: 72 },
    
    // 中通 - 三线城市
    { carrier: 'ZTO', city: '南昌市', dickies: 72, icebreaker: '72+', tbl: '96+', tnf: 72, vans: 72 },
    { carrier: 'ZTO', city: '贵阳市', dickies: 72, icebreaker: '72+', tbl: '96+', tnf: 72, vans: 72 },
    
    // EMS - 偏远地区
    { carrier: 'EMS', city: '阿坝藏族羌族自治州', dickies: 72, icebreaker: 72, tbl: 72, tnf: '72+', vans: 72 },
    { carrier: 'EMS', city: '阿克苏地区', dickies: '-', icebreaker: '72+', tbl: '72+', tnf: '72+', vans: '72+' },
    { carrier: 'EMS', city: '阿拉善盟', dickies: 96, icebreaker: '96+', tbl: '96+', tnf: '96+', vans: 96 },
    
    // 更多快递商示例
    { carrier: 'STO', city: '杭州市', dickies: 72, icebreaker: 72, tbl: 96, tnf: 72, vans: 72 },
    { carrier: 'JD', city: '天津市', dickies: 48, icebreaker: 48, tbl: 72, tnf: 48, vans: 48 },
    { carrier: 'YD', city: '重庆市', dickies: 72, icebreaker: 72, tbl: 96, tnf: 72, vans: 72 }
  ];

  const generateExcelTemplate = async () => {
    setIsGenerating(true);
    
    try {
      // 构建CSV内容
      const headers = ['Carrier', 'City', 'DICKIES', 'Icebreaker', 'TBL', 'TNF', 'VANS'];
      
      // 创建带说明的表头注释
      const comments = [
        '# VF物流时效表格模板',
        '# 请严格按照此格式填写您的时效数据',
        '# Carrier: 快递商代码 (SF/YTO/ZTO/EMS/STO/JD/YD等)',
        '# City: 目标城市名称 (必须与系统城市库完全匹配)',
        '# 品牌列: 时效小时数 (数字/数字+/数字-/- 表示无数据)',
        '#',
        ''
      ];
      
      const csvRows = [
        ...comments,
        headers.join(','),
        ...templateData.map(row => [
          row.carrier,
          row.city,
          row.dickies,
          row.icebreaker,
          row.tbl,
          row.tnf,
          row.vans
        ].join(','))
      ];
      
      const csvContent = csvRows.join('\n');
      
      // 创建Blob并下载
      const blob = new Blob(['\ufeff' + csvContent], { 
        type: 'text/csv;charset=utf-8' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `VF物流时效表格模板_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      // 成功提示
      toast.success('模板下载成功', {
        description: '请将CSV文件转换为Excel格式后填写数据'
      });
      
    } catch (error) {
      console.error('生成模板失败:', error);
      toast.error('模板生成失败', {
        description: '请稍后重试或联系技术支持'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateExcelDirectly = async () => {
    setIsGenerating(true);
    
    try {
      // 这里可以集成xlsx库来生成真正的Excel文件
      // 为了演示，我们先使用CSV格式
      
      // 更高级的Excel生成（需要安装xlsx库）
      // const XLSX = await import('xlsx');
      // const worksheet = XLSX.utils.json_to_sheet(templateData);
      // const workbook = XLSX.utils.book_new();
      // XLSX.utils.book_append_sheet(workbook, worksheet, '时效数据');
      // XLSX.writeFile(workbook, 'VF物流时效表格模板.xlsx');
      
      // 当前使用CSV格式
      await generateExcelTemplate();
      
    } catch (error) {
      console.error('生成Excel失败:', error);
      toast.error('Excel生成失败', {
        description: '请使用CSV模板并手动转换为Excel格式'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* 标题 */}
        <div className="flex items-center space-x-3">
          <FileSpreadsheet className="h-6 w-6 text-maersk-blue" />
          <h3 className="text-xl font-medium text-maersk-black">下载Excel模板</h3>
        </div>

        {/* 说明信息 */}
        <div className="maersk-alert-info p-4">
          <div className="flex items-start space-x-2">
            <Info className="h-5 w-5 text-functional-dark-blue mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="text-functional-dark-blue font-medium">
                下载标准格式的时效表格模板，包含示例数据和格式说明。
              </p>
              <div className="text-sm text-functional-dark-blue">
                模板包含{templateData.length}条示例数据，覆盖主要快递商和城市组合。
              </div>
            </div>
          </div>
        </div>

        {/* 模板特性 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="font-medium text-maersk-black">✅ 包含内容</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-accent-mid-green" />
                <span>标准列结构和表头</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-accent-mid-green" />
                <span>15条真实示例数据</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-accent-mid-green" />
                <span>覆盖5大品牌时效数据</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-accent-mid-green" />
                <span>包含各类快递商代码</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-maersk-black">📋 快递商覆盖</h4>
            <div className="flex flex-wrap gap-2">
              {['SF', 'YTO', 'ZTO', 'STO', 'EMS', 'JD', 'YD'].map(carrier => (
                <Badge key={carrier} variant="secondary" className="text-xs">
                  {carrier}
                </Badge>
              ))}
            </div>
            
            <h4 className="font-medium text-maersk-black mt-4">🏙️ 城市类型</h4>
            <div className="space-y-2 text-sm">
              <div>一线城市: 北京、上海、广州、深圳</div>
              <div>二线城市: 成都、武汉、西安、杭州</div>
              <div>偏远地区: 阿坝州、阿克苏地区等</div>
            </div>
          </div>
        </div>

        {/* 使用提醒 */}
        <div className="maersk-alert-warning p-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-accent-dark-orange mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-medium text-accent-dark-orange">使用说明</h4>
              <div className="text-sm text-accent-dark-orange space-y-1">
                <div>1. 下载CSV模板后，请使用Excel打开并另存为.xlsx格式</div>
                <div>2. 清空示例数据，填写您的实际时效标准</div>
                <div>3. 严格按照格式要求，确保城市名称准确</div>
                <div>4. 上传时选择转换后的Excel文件</div>
              </div>
            </div>
          </div>
        </div>

        {/* 数据预览 */}
        <div className="space-y-3">
          <h4 className="font-medium text-maersk-black">📊 数据预览 (前5条)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-functional-light-grey">
              <thead>
                <tr className="bg-functional-bright-grey">
                  <th className="border border-functional-light-grey p-2 text-left">Carrier</th>
                  <th className="border border-functional-light-grey p-2 text-left">City</th>
                  <th className="border border-functional-light-grey p-2 text-left">DICKIES</th>
                  <th className="border border-functional-light-grey p-2 text-left">Icebreaker</th>
                  <th className="border border-functional-light-grey p-2 text-left">TBL</th>
                  <th className="border border-functional-light-grey p-2 text-left">TNF</th>
                  <th className="border border-functional-light-grey p-2 text-left">VANS</th>
                </tr>
              </thead>
              <tbody>
                {templateData.slice(0, 5).map((row, index) => (
                  <tr key={index} className="hover:bg-functional-bright-grey">
                    <td className="border border-functional-light-grey p-2">{row.carrier}</td>
                    <td className="border border-functional-light-grey p-2">{row.city}</td>
                    <td className="border border-functional-light-grey p-2">{row.dickies}</td>
                    <td className="border border-functional-light-grey p-2">{row.icebreaker}</td>
                    <td className="border border-functional-light-grey p-2">{row.tbl}</td>
                    <td className="border border-functional-light-grey p-2">{row.tnf}</td>
                    <td className="border border-functional-light-grey p-2">{row.vans}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-functional-mid-grey">
            完整模板包含{templateData.length}条示例数据，涵盖不同快递商和城市组合
          </p>
        </div>

        {/* 下载按钮 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={generateExcelTemplate}
            disabled={isGenerating}
            className="maersk-button-primary flex items-center space-x-2"
            size="lg"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>生成中...</span>
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                <span>下载CSV模板</span>
              </>
            )}
          </Button>
          
          <Button
            onClick={generateExcelDirectly}
            disabled={isGenerating}
            variant="outline"
            className="flex items-center space-x-2"
            size="lg"
          >
            <FileSpreadsheet className="h-5 w-5" />
            <span>生成Excel模板</span>
          </Button>
        </div>

        {/* 下载统计 */}
        <div className="text-center">
          <p className="text-sm text-functional-mid-grey">
            模板包含 <span className="font-medium text-maersk-blue">{templateData.length}</span> 条示例数据 •{' '}
            覆盖 <span className="font-medium text-maersk-blue">7</span> 个快递商 •{' '}
            <span className="font-medium text-maersk-blue">5</span> 个品牌时效标准
          </p>
        </div>
      </div>
    </Card>
  );
}