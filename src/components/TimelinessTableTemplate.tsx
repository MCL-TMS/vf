/**
 * VF物流分析平台 - 时效表格模板展示和下载组件
 * 
 * 提供详细的时效表格模板格式说明和示例下载
 */

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { AlertCircle, Download, Eye, FileSpreadsheet, Info, CheckCircle } from 'lucide-react';

export function TimelinessTableTemplate() {
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);

  // 模板数据示例
  const templateData = [
    {
      carrier: 'SF',
      city: '北京市',
      dickies: '48',
      icebreaker: '48',
      tbl: '72',
      tnf: '48',
      vans: '48'
    },
    {
      carrier: 'SF', 
      city: '上海市',
      dickies: '48',
      icebreaker: '48',
      tbl: '72',
      tnf: '48',
      vans: '48'
    },
    {
      carrier: 'YTO',
      city: '深圳市',
      dickies: '72',
      icebreaker: '72+',
      tbl: '72+',
      tnf: '72',
      vans: '72'
    },
    {
      carrier: 'ZTO',
      city: '阿坝藏族羌族自治州',
      dickies: '72',
      icebreaker: '72',
      tbl: '72',
      tnf: '72+',
      vans: '72'
    },
    {
      carrier: 'EMS',
      city: '阿克苏地区',
      dickies: '-',
      icebreaker: '72+',
      tbl: '72+',
      tnf: '72+',
      vans: '72+'
    }
  ];

  const downloadTemplate = () => {
    // 创建CSV格式的模板数据
    const headers = ['Carrier', 'City', 'DICKIES', 'Icebreaker', 'TBL', 'TNF', 'VANS'];
    const csvContent = [
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
    ].join('\n');

    // 创建下载链接
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'VF物流时效表格模板.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 标题和描述 */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <FileSpreadsheet className="h-6 w-6 text-maersk-blue" />
          <h3 className="text-xl font-medium text-maersk-black">时效表格模板</h3>
        </div>
        
        <div className="maersk-alert-info p-4">
          <div className="flex items-start space-x-2">
            <Info className="h-5 w-5 text-functional-dark-blue mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="text-functional-dark-blue font-medium">
                请按照以下格式准备您的时效Excel表格，确保数据能够正确导入和分析。
              </p>
              <div className="text-sm text-functional-dark-blue">
                系统将自动识别快递商、城市和各品牌的时效数据，并与数据库中的城市信息进行匹配。
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 必需列结构 */}
      <Card className="p-6">
        <h4 className="text-lg font-medium text-maersk-black mb-4">📋 必需列结构</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-accent-mid-green" />
              <span className="font-medium">A列: Carrier</span>
              <Badge variant="outline" className="text-xs">必需</Badge>
            </div>
            <p className="text-sm text-functional-mid-grey ml-6">
              快递商名称（如：SF、YTO、ZTO、EMS等）
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-accent-mid-green" />
              <span className="font-medium">B列: City</span>
              <Badge variant="outline" className="text-xs">必需</Badge>
            </div>
            <p className="text-sm text-functional-mid-grey ml-6">
              目标城市名称（需与系统城市库匹配）
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-accent-mid-green" />
            <span className="font-medium">C-G列: 品牌时效数据</span>
            <Badge variant="outline" className="text-xs">必需</Badge>
          </div>
          <div className="ml-6 grid grid-cols-2 md:grid-cols-5 gap-2">
            {['DICKIES', 'Icebreaker', 'TBL', 'TNF', 'VANS'].map(brand => (
              <Badge key={brand} variant="secondary" className="justify-center">
                {brand}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* 数据格式说明 */}
      <Card className="p-6">
        <h4 className="text-lg font-medium text-maersk-black mb-4">📝 数据格式说明</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-accent-mid-green rounded-full"></div>
              <span className="font-medium">标准时效</span>
            </div>
            <div className="bg-functional-bright-grey p-3 rounded">
              <code className="text-sm">48, 72, 96</code>
            </div>
            <p className="text-xs text-functional-mid-grey">
              直接的时效小时数
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-accent-mid-orange rounded-full"></div>
              <span className="font-medium">超时标记</span>
            </div>
            <div className="bg-functional-bright-grey p-3 rounded">
              <code className="text-sm">72+, 96+</code>
            </div>
            <p className="text-xs text-functional-mid-grey">
              带+号表示可能超时
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-functional-mid-grey rounded-full"></div>
              <span className="font-medium">无数据</span>
            </div>
            <div className="bg-functional-bright-grey p-3 rounded">
              <code className="text-sm">-, 空白</code>
            </div>
            <p className="text-xs text-functional-mid-grey">
              表示该组合无时效数据
            </p>
          </div>
        </div>
      </Card>

      {/* 模板预览 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium text-maersk-black">🔍 模板预览</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplatePreview(!showTemplatePreview)}
            className="flex items-center space-x-2"
          >
            <Eye className="h-4 w-4" />
            <span>{showTemplatePreview ? '隐藏' : '显示'}预览</span>
          </Button>
        </div>

        {showTemplatePreview && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-functional-light-grey">
              <thead>
                <tr className="bg-functional-bright-grey">
                  <th className="border border-functional-light-grey p-2 text-left font-medium">Carrier</th>
                  <th className="border border-functional-light-grey p-2 text-left font-medium">City</th>
                  <th className="border border-functional-light-grey p-2 text-left font-medium">DICKIES</th>
                  <th className="border border-functional-light-grey p-2 text-left font-medium">Icebreaker</th>
                  <th className="border border-functional-light-grey p-2 text-left font-medium">TBL</th>
                  <th className="border border-functional-light-grey p-2 text-left font-medium">TNF</th>
                  <th className="border border-functional-light-grey p-2 text-left font-medium">VANS</th>
                </tr>
              </thead>
              <tbody>
                {templateData.map((row, index) => (
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
        )}
      </Card>

      {/* 重要提醒 */}
      <Card className="p-6 border-accent-light-orange bg-accent-bright-orange">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-accent-dark-orange mt-0.5 flex-shrink-0" />
          <div className="space-y-3">
            <h4 className="text-lg font-medium text-accent-dark-orange">重要提醒</h4>
            
            <div className="space-y-2 text-accent-dark-orange">
              <div className="flex items-start space-x-2">
                <span className="text-sm">•</span>
                <span className="text-sm">
                  <strong>城市名称</strong>必须与系统BAS_AREA表中的数据完全匹配，否则无法正确映射
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-sm">•</span>
                <span className="text-sm">
                  <strong>快递商代码</strong>应使用标准缩写（SF、YTO、ZTO、EMS等）
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-sm">•</span>
                <span className="text-sm">
                  <strong>时效数据</strong>只能使用数字和+/-符号，不支持其他特殊字符
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-sm">•</span>
                <span className="text-sm">
                  文件大小不能超过<strong>10MB</strong>，支持.xlsx和.xls格式
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 下载按钮 */}
      <div className="flex justify-center">
        <Button
          onClick={downloadTemplate}
          className="maersk-button-primary flex items-center space-x-2"
          size="lg"
        >
          <Download className="h-5 w-5" />
          <span>下载CSV模板</span>
        </Button>
      </div>

      <Separator className="my-6" />

      {/* 使用步骤 */}
      <Card className="p-6">
        <h4 className="text-lg font-medium text-maersk-black mb-4">📚 使用步骤</h4>
        
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-maersk-blue text-white rounded-full flex items-center justify-center text-sm font-medium">
              1
            </div>
            <div>
              <h5 className="font-medium">下载并填写模板</h5>
              <p className="text-sm text-functional-mid-grey">
                点击"下载CSV模板"按钮，下载标准格式的模板文件，然后按照格式要求填写您的时效数据。
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-maersk-blue text-white rounded-full flex items-center justify-center text-sm font-medium">
              2
            </div>
            <div>
              <h5 className="font-medium">转换为Excel格式</h5>
              <p className="text-sm text-functional-mid-grey">
                将填写好的CSV文件保存为Excel格式（.xlsx或.xls），确保所有数据格式正确。
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-maersk-blue text-white rounded-full flex items-center justify-center text-sm font-medium">
              3
            </div>
            <div>
              <h5 className="font-medium">上传和验证</h5>
              <p className="text-sm text-functional-mid-grey">
                在时效分析页面上传Excel文件，系统将自动验证格式、解析数据并显示处理结果。
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-maersk-blue text-white rounded-full flex items-center justify-center text-sm font-medium">
              4
            </div>
            <div>
              <h5 className="font-medium">查看分析结果</h5>
              <p className="text-sm text-functional-mid-grey">
                确认上传成功后，即可使用时效分析功能进行Plan vs Actual时效对比分析。
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}