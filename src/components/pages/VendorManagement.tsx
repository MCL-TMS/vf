import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  MapPin,
  Building,
  FileText,
  Star,
  TrendingUp,
  Clock,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Shield,
  Award,
  Target,
  Calendar,
  GitBranch,
  Package
} from 'lucide-react';

interface Vendor {
  id: string;
  code: string;
  name: string;
  fullName: string;
  tier: 'strategic' | 'core' | 'tactical'; // 4PL供应商分级
  contact: {
    person: string;
    phone: string;
    email: string;
    address: string;
  };
  contract: {
    startDate: string;
    endDate: string;
    status: 'active' | 'expiring' | 'expired';
    type: 'long-term' | 'annual' | 'spot'; // 合同类型
    volumeCommitment: number;
    actualVolume: number;
    achievementRate: number;
  };
  compliance: {
    certifications: string[];
    insurance: string;
    taxStatus: 'compliant' | 'warning';
    auditScore: number;
    lastAudit: string;
  };
  performance: {
    rating: number;
    onTimeRate: number;
    complaintRate: number;
    responseTime: number;
    systemIntegration: number; // 系统对接程度
  };
  business: {
    monthlyVolume: number;
    coverage: string[];
    avgCost: number;
    marketShare: number; // 在我们业务中的占比
  };
  services: string[];
  riskLevel: 'low' | 'medium' | 'high';
  strategicValue: number; // 战略价值评分
}

export function VendorManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');

  const vendors: Vendor[] = [
    {
      id: 'SF',
      code: 'SF',
      name: '顺丰速运',
      fullName: '顺丰速运有限公司',
      tier: 'strategic',
      contact: {
        person: '张经理（KA部门）',
        phone: '400-111-1111',
        email: 'vf-ka@sf-express.com',
        address: '深圳市福田区顺丰大厦'
      },
      contract: {
        startDate: '2024-01-01',
        endDate: '2026-12-31',
        status: 'active',
        type: 'long-term',
        volumeCommitment: 50000,
        actualVolume: 45000,
        achievementRate: 90
      },
      compliance: {
        certifications: ['ISO9001', 'ISO27001', '5A级物流企业'],
        insurance: '货运险额度: 1000万',
        taxStatus: 'compliant',
        auditScore: 98,
        lastAudit: '2024-11-15'
      },
      performance: {
        rating: 4.8,
        onTimeRate: 98.5,
        complaintRate: 0.1,
        responseTime: 2.5,
        systemIntegration: 98
      },
      business: {
        monthlyVolume: 45000,
        coverage: ['全国', '港澳台', '国际'],
        avgCost: 10.18,
        marketShare: 31.5
      },
      services: ['标准快递', '次日达', '即日达', '冷链运输', '特殊物品'],
      riskLevel: 'low',
      strategicValue: 95
    },
    {
      id: 'ZTO',
      code: 'ZTO',
      name: '中通快递',
      fullName: '中通快递股份有限公司',
      tier: 'core',
      contact: {
        person: '李经理（大客户部）',
        phone: '400-827-0270',
        email: 'vf-biz@zto.com',
        address: '上海市青浦区中通总部'
      },
      contract: {
        startDate: '2024-01-01',
        endDate: '2025-06-30',
        status: 'expiring',
        type: 'annual',
        volumeCommitment: 40000,
        actualVolume: 38000,
        achievementRate: 95
      },
      compliance: {
        certifications: ['ISO9001', '4A级物流企业'],
        insurance: '货运险额度: 500万',
        taxStatus: 'compliant',
        auditScore: 92,
        lastAudit: '2024-10-20'
      },
      performance: {
        rating: 4.3,
        onTimeRate: 92.3,
        complaintRate: 0.3,
        responseTime: 4.2,
        systemIntegration: 85
      },
      business: {
        monthlyVolume: 38000,
        coverage: ['全国'],
        avgCost: 9.0,
        marketShare: 26.6
      },
      services: ['标准快递', '经济快递', '电商专配'],
      riskLevel: 'medium',
      strategicValue: 88
    },
    {
      id: 'YTO',
      code: 'YTO',
      name: '圆通速递',
      fullName: '圆通速递有限公司',
      tier: 'core',
      contact: {
        person: '王经理',
        phone: '95554',
        email: 'vf@yto.net.cn',
        address: '上海市青浦区圆通总部'
      },
      contract: {
        startDate: '2024-01-01',
        endDate: '2025-12-31',
        status: 'active',
        type: 'annual',
        volumeCommitment: 35000,
        actualVolume: 32000,
        achievementRate: 91
      },
      compliance: {
        certifications: ['ISO9001', '4A级物流企业'],
        insurance: '货运险额度: 500万',
        taxStatus: 'compliant',
        auditScore: 88,
        lastAudit: '2024-09-10'
      },
      performance: {
        rating: 4.1,
        onTimeRate: 90.1,
        complaintRate: 0.4,
        responseTime: 5.1,
        systemIntegration: 80
      },
      business: {
        monthlyVolume: 32000,
        coverage: ['全国'],
        avgCost: 8.0,
        marketShare: 22.4
      },
      services: ['标准快递', '经济快递'],
      riskLevel: 'medium',
      strategicValue: 82
    },
    {
      id: 'STO',
      code: 'STO',
      name: '申通快递',
      fullName: '申通快递股份有限公司',
      tier: 'tactical',
      contact: {
        person: '赵经理',
        phone: '95543',
        email: 'vf@sto.cn',
        address: '上海市青浦区申通总部'
      },
      contract: {
        startDate: '2024-01-01',
        endDate: '2025-12-31',
        status: 'active',
        type: 'annual',
        volumeCommitment: 30000,
        actualVolume: 28000,
        achievementRate: 93
      },
      compliance: {
        certifications: ['ISO9001', '3A级物流企业'],
        insurance: '货运险额度: 300万',
        taxStatus: 'compliant',
        auditScore: 85,
        lastAudit: '2024-08-25'
      },
      performance: {
        rating: 4.0,
        onTimeRate: 88.7,
        complaintRate: 0.5,
        responseTime: 5.8,
        systemIntegration: 75
      },
      business: {
        monthlyVolume: 28000,
        coverage: ['全国'],
        avgCost: 7.0,
        marketShare: 19.6
      },
      services: ['标准快递', '经济快递'],
      riskLevel: 'medium',
      strategicValue: 75
    }
  ];

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = filterTier === 'all' || vendor.tier === filterTier;
    return matchesSearch && matchesTier;
  });

  // 合规风险提醒
  const complianceAlerts = [
    { vendor: 'ZTO', issue: '合同将于2025年6月到期', severity: 'warning', action: '启动续约谈判' },
    { vendor: 'STO', issue: '系统对接完成度75%', severity: 'info', action: '完成API全对接' }
  ];

  const getContractStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-600">执行中</Badge>;
      case 'expiring':
        return <Badge variant="secondary" className="bg-orange-600 text-white">即将到期</Badge>;
      case 'expired':
        return <Badge variant="destructive">已过期</Badge>;
      default:
        return <Badge variant="outline">未知</Badge>;
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'strategic':
        return <Badge variant="default" className="bg-purple-600">战略级</Badge>;
      case 'core':
        return <Badge variant="default" className="bg-blue-600">核心级</Badge>;
      case 'tactical':
        return <Badge variant="secondary">战术级</Badge>;
      default:
        return <Badge variant="outline">未分级</Badge>;
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'low':
        return <Badge variant="default" className="bg-green-600">低风险</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-orange-600 text-white">中风险</Badge>;
      case 'high':
        return <Badge variant="destructive">高风险</Badge>;
      default:
        return <Badge variant="outline">未评估</Badge>;
    }
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 - Control Tower视角 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-maersk-black">4PL Control Tower - 3PL供应商管理</h1>
            <Badge variant="outline" className="bg-maersk-blue text-white">管理视角</Badge>
          </div>
          <p className="text-functional-mid-grey">
            承运商资质管理、合规审核、合同执行和战略伙伴关系维护
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            导出供应商档案
          </Button>
          <Button>
            <Users className="h-4 w-4 mr-2" />
            新增供应商
          </Button>
        </div>
      </div>

      {/* 合规风险提醒 */}
      {complianceAlerts.length > 0 && (
        <Alert className="border-orange-300 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription>
            <div className="space-y-1">
              <span className="text-orange-700">检测到 {complianceAlerts.length} 个供应商管理事项</span>
              {complianceAlerts.map((alert, index) => (
                <div key={index} className="text-sm flex items-center justify-between">
                  <span>• <Badge variant="outline" className="mr-1">{alert.vendor}</Badge> {alert.issue}</span>
                  <Button variant="outline" size="sm">{alert.action}</Button>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* 搜索和筛选 */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-functional-mid-grey" />
            <Input
              placeholder="搜索供应商名称或代码..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tabs value={filterTier} onValueChange={setFilterTier}>
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="strategic">战略级</TabsTrigger>
              <TabsTrigger value="core">核心级</TabsTrigger>
              <TabsTrigger value="tactical">战术级</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Card>

      {/* 统计概览 - Control Tower KPI */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-50">
              <Building className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">3PL供应商网络</h3>
          <p className="text-maersk-black">{vendors.length} 家</p>
          <p className="text-xs text-functional-mid-grey mt-1">
            战略{vendors.filter(v => v.tier === 'strategic').length} + 
            核心{vendors.filter(v => v.tier === 'core').length} + 
            战术{vendors.filter(v => v.tier === 'tactical').length}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-green-50">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">合同执行率</h3>
          <p className="text-maersk-black">
            {(vendors.reduce((sum, v) => sum + v.contract.achievementRate, 0) / vendors.length).toFixed(1)}%
          </p>
          <p className="text-xs text-green-600 mt-1">健康水平</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-orange-50">
              <Calendar className="h-5 w-5 text-orange-600" />
            </div>
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">合同到期预警</h3>
          <p className="text-maersk-black">
            {vendors.filter(v => v.contract.status === 'expiring').length} 个
          </p>
          <p className="text-xs text-orange-600 mt-1">需要关注</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-purple-50">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">合规达标率</h3>
          <p className="text-maersk-black">100%</p>
          <p className="text-xs text-green-600 mt-1">全部合规</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-50">
              <Award className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">平均绩效评分</h3>
          <p className="text-maersk-black">
            {(vendors.reduce((sum, v) => sum + v.performance.rating, 0) / vendors.length).toFixed(1)}
          </p>
          <p className="text-xs text-functional-mid-grey mt-1">满分5.0</p>
        </Card>
      </div>

      {/* 供应商列表 */}
      <div className="grid grid-cols-1 gap-6">
        {filteredVendors.map((vendor) => (
          <Card key={vendor.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-lg bg-maersk-blue text-maersk-white flex items-center justify-center">
                  <Building className="h-8 w-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-maersk-black">{vendor.name}</h3>
                    <Badge variant="outline">{vendor.code}</Badge>
                    {getTierBadge(vendor.tier)}
                    {getContractStatusBadge(vendor.contract.status)}
                    {getRiskBadge(vendor.riskLevel)}
                  </div>
                  <p className="text-sm text-functional-mid-grey mb-1">{vendor.fullName}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {getRatingStars(vendor.performance.rating)}
                      <span className="text-sm text-functional-mid-grey ml-1">
                        {vendor.performance.rating.toFixed(1)}
                      </span>
                    </div>
                    <Badge variant="outline">
                      <Target className="h-3 w-3 mr-1" />
                      战略价值: {vendor.strategicValue}
                    </Badge>
                    <Badge variant="outline">
                      市场占有: {vendor.business.marketShare}%
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <Tabs defaultValue="contract" className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="contract" className="flex-1">合同管理</TabsTrigger>
                <TabsTrigger value="compliance" className="flex-1">合规审核</TabsTrigger>
                <TabsTrigger value="performance" className="flex-1">绩效评估</TabsTrigger>
                <TabsTrigger value="contact" className="flex-1">联系方式</TabsTrigger>
              </TabsList>

              <TabsContent value="contract" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-functional-mid-grey" />
                      <span className="text-functional-mid-grey">合同类型:</span>
                      <Badge variant="outline">
                        {vendor.contract.type === 'long-term' ? '长期合作' : 
                         vendor.contract.type === 'annual' ? '年度合同' : '现货'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-functional-mid-grey" />
                      <span className="text-functional-mid-grey">合同期限:</span>
                      <span className="text-maersk-black">
                        {vendor.contract.startDate} ~ {vendor.contract.endDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-functional-mid-grey" />
                      <span className="text-functional-mid-grey">合同量承诺:</span>
                      <span className="text-maersk-black">
                        {vendor.contract.volumeCommitment.toLocaleString()}/月
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-functional-mid-grey" />
                      <span className="text-functional-mid-grey">实际执行量:</span>
                      <span className="text-maersk-black">
                        {vendor.contract.actualVolume.toLocaleString()}/月
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-functional-mid-grey" />
                      <span className="text-functional-mid-grey">达成率:</span>
                      <span className={vendor.contract.achievementRate >= 90 ? 'text-green-600' : 'text-orange-600'}>
                        {vendor.contract.achievementRate}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <GitBranch className="h-4 w-4 text-functional-mid-grey" />
                      <span className="text-functional-mid-grey">覆盖范围:</span>
                      <span className="text-maersk-black">{vendor.business.coverage.join(', ')}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="compliance" className="space-y-3 mt-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm">
                    <Shield className="h-4 w-4 text-functional-mid-grey mt-0.5" />
                    <span className="text-functional-mid-grey">资质认证:</span>
                    <div className="flex flex-wrap gap-1">
                      {vendor.compliance.certifications.map((cert, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-functional-mid-grey" />
                    <span className="text-functional-mid-grey">保险信息:</span>
                    <span className="text-maersk-black">{vendor.compliance.insurance}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-functional-mid-grey" />
                    <span className="text-functional-mid-grey">税务状态:</span>
                    <Badge variant={vendor.compliance.taxStatus === 'compliant' ? 'default' : 'destructive'}>
                      {vendor.compliance.taxStatus === 'compliant' ? '合规' : '异常'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-functional-bright-grey rounded-lg">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-maersk-blue" />
                      <span className="text-sm">审计评分:</span>
                      <span className="text-maersk-black">{vendor.compliance.auditScore}/100</span>
                    </div>
                    <span className="text-xs text-functional-mid-grey">
                      上次审计: {vendor.compliance.lastAudit}
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="performance" className="space-y-3 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-functional-bright-grey rounded-lg">
                    <p className="text-xs text-functional-mid-grey mb-1">时效达成率</p>
                    <p className="text-lg text-green-600">{vendor.performance.onTimeRate}%</p>
                  </div>
                  <div className="p-3 bg-functional-bright-grey rounded-lg">
                    <p className="text-xs text-functional-mid-grey mb-1">投诉率</p>
                    <p className="text-lg text-maersk-black">{vendor.performance.complaintRate}%</p>
                  </div>
                  <div className="p-3 bg-functional-bright-grey rounded-lg">
                    <p className="text-xs text-functional-mid-grey mb-1">响应时间</p>
                    <p className="text-lg text-maersk-black">{vendor.performance.responseTime}h</p>
                  </div>
                  <div className="p-3 bg-functional-bright-grey rounded-lg">
                    <p className="text-xs text-functional-mid-grey mb-1">系统对接度</p>
                    <p className="text-lg text-maersk-black">{vendor.performance.systemIntegration}%</p>
                  </div>
                  <div className="p-3 bg-functional-bright-grey rounded-lg">
                    <p className="text-xs text-functional-mid-grey mb-1">单均成本</p>
                    <p className="text-lg text-maersk-black">¥{vendor.business.avgCost.toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-functional-bright-grey rounded-lg">
                    <p className="text-xs text-functional-mid-grey mb-1">月订单量</p>
                    <p className="text-lg text-maersk-black">{(vendor.business.monthlyVolume/1000).toFixed(0)}K</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-functional-mid-grey" />
                    <span className="text-functional-mid-grey">对接人:</span>
                    <span className="text-maersk-black">{vendor.contact.person}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-functional-mid-grey" />
                    <span className="text-functional-mid-grey">电话:</span>
                    <span className="text-maersk-black">{vendor.contact.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-functional-mid-grey" />
                    <span className="text-functional-mid-grey">邮箱:</span>
                    <span className="text-maersk-black">{vendor.contact.email}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-functional-mid-grey mt-0.5" />
                    <span className="text-functional-mid-grey">地址:</span>
                    <span className="text-maersk-black flex-1">{vendor.contact.address}</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-4 pt-4 border-t flex gap-2">
              <Button variant="outline" className="flex-1" size="sm">
                <FileText className="h-4 w-4 mr-1" />
                查看详细档案
              </Button>
              <Button variant="outline" className="flex-1" size="sm">
                <Calendar className="h-4 w-4 mr-1" />
                业务评审会
              </Button>
              <Button variant="outline" className="flex-1" size="sm">
                <Mail className="h-4 w-4 mr-1" />
                发起沟通
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}