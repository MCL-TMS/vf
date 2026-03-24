import React, { useState } from "react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { 
  BarChart3, 
  Package, 
  Calendar, 
  Truck, 
  ChevronDown, 
  ChevronRight,
  PieChart,
  Map,
  AlertTriangle,
  TrendingUp,
  Home,
  Scale,
  Store,
  Users,
  Clock,
  MapPin,
  DollarSign,
  Settings,
  Award,
  LogOut,  // 新增登出图标
  User      // 新增用户图标
} from "lucide-react";
import { ImageWithFallback } from './figma/ImageWithFallback';
import maerskLogo from 'figma:asset/2d2c90e40772f51c210c854fbb6595f227c33761.png';
import { useAuth } from '../contexts/AuthContext'; // 导入 useAuth

// Maersk Logo - 进一步缩小容器高度，保持大logo
const MaerskLogo = () => (
  <div className="pr-2 py-0.5 bg-maersk-white">
    <ImageWithFallback
      src={maerskLogo}
      alt="Maersk Brand Logo"
      className="w-full h-24 object-contain object-left"
    />
  </div>
);

interface SidebarProps {
  onMenuSelect: (menu: string) => void;
  activeMenu?: string; // 接收来自父组件的活跃菜单状态
}

const menuItems = [
  {
    id: "overview",
    label: "Order Overview",
    icon: Package,
    hasSubmenu: true,
    subItems: [
      { id: "overview-dashboard", label: "总览", icon: Home },
      { id: "overview-logistics", label: "物流监控", icon: Truck },
      { id: "overview-regional", label: "地域分析", icon: Map, hidden: true },  // 🔒 隐藏未完成功能
      { id: "overview-exceptions", label: "异常监控", icon: AlertTriangle, hidden: false },  // 🔒 隐藏未完成功能
      { id: "overview-trends", label: "趋势分析", icon: TrendingUp, hidden: true },  // 🔒 隐藏未完成功能
      { id: "overview-weight", label: "重量分析", icon: Scale, hidden: true }  // 🔒 隐藏未完成功能
    ]
  },
  {
    id: "4pl-management",
    label: "4PL Management",
    icon: Settings,
    hasSubmenu: true,
    hidden: true,
    subItems: [
      { id: "4pl-carrier-performance", label: "承运商绩效", icon: Award },
      { id: "4pl-time-efficiency", label: "时效分析", icon: Clock },
      { id: "4pl-flow-direction", label: "流向分析", icon: MapPin },
      { id: "4pl-cost-analysis", label: "成本分析", icon: DollarSign },
      { id: "4pl-capacity-planning", label: "运力规划", icon: TrendingUp },
      { id: "4pl-vendor-management", label: "供应商管理", icon: Users }
    ]
  },
  {
    id: "schedules",
    label: "Schedules",
    icon: Calendar,
    hasSubmenu: false,
    hidden: true  // 🔒 隐藏未完成功能
  },
  {
    id: "fulfillment",
    label: "myFulfillment",
    icon: Truck,
    hasSubmenu: false,
    hidden: true  // 🔒 隐藏未完成功能
  }
];

export function Sidebar({ onMenuSelect, activeMenu: externalActiveMenu }: SidebarProps) {
  const [localActiveMenu, setLocalActiveMenu] = useState("overview-dashboard");
  const [expandedMenus, setExpandedMenus] = useState(new Set(["overview"]));
  
  // 使用外部传入的 activeMenu，如果没有则使用本地状态
  const currentActiveMenu = externalActiveMenu || localActiveMenu;
  
  // 确保当活跃菜单是 overview 的子菜单时，overview 菜单保持展开
  const ensureOverviewExpanded = () => {
    if (currentActiveMenu && currentActiveMenu.startsWith("overview-")) {
      setExpandedMenus(prev => new Set(prev).add("overview"));
    }
  };
  
  // 当外部 activeMenu 变化时，确保相应的父菜单展开
  React.useEffect(() => {
    ensureOverviewExpanded();
    // 确保当活跃菜单是 4pl-management 的子菜单时，4pl-management 菜单保持展开
    if (currentActiveMenu && currentActiveMenu.startsWith("4pl-")) {
      setExpandedMenus(prev => new Set(prev).add("4pl-management"));
    }
  }, [currentActiveMenu]);

  const handleMenuClick = (menuId: string, hasSubmenu: boolean = false) => {
    if (hasSubmenu) {
      setExpandedMenus(prev => {
        const newSet = new Set(prev);
        if (newSet.has(menuId)) {
          newSet.delete(menuId);
        } else {
          newSet.add(menuId);
        }
        return newSet;
      });
    } else {
      // 只有当没有外部 activeMenu 时才更新本地状态
      if (!externalActiveMenu) {
        setLocalActiveMenu(menuId);
      }
      onMenuSelect(menuId);
    }
  };

  const handleSubMenuClick = (menuId: string) => {
    // 只有当没有外部 activeMenu 时才更新本地状态
    if (!externalActiveMenu) {
      setLocalActiveMenu(menuId);
    }
    onMenuSelect(menuId);
  };

  const { logout } = useAuth(); // 使用 useAuth 中的 logout 函数
  const { user } = useAuth(); // 获取用户信息

  return (
    <div className="w-64 bg-maersk-white border-r border-functional-light-grey h-full flex flex-col shadow-sm">
      {/* Maersk Brand Logo Section - 放大版 */}
      <div className="border-b border-functional-light-grey bg-maersk-white flex-shrink-0">
        <MaerskLogo />
      </div>

      {/* 用户信息 */}
      <div className="p-6 border-b border-functional-light-grey bg-functional-bright-grey flex-shrink-0">
        <div className="flex items-center space-x-3">
          <Avatar className="ring-2 ring-functional-light-blue">
            <AvatarFallback className="bg-functional-bright-blue text-functional-dark-blue font-medium">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-maersk-black">{user?.userName || '用户'}</p>
            <p className="text-sm text-functional-mid-grey truncate">{user?.userId || ''}</p>
          </div>
          <Badge variant="secondary" className={`text-xs ${user?.isAdmin ? 'bg-maersk-blue text-white border-maersk-blue' : 'bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue'}`}>
            {user?.isAdmin ? '管理员' : '用户'}
          </Badge>
        </div>
      </div>

      {/* 导航菜单 - 添加滚动支持 */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems
          .filter(item => !item.hidden)  // 🔒 过滤掉隐藏的菜单项
          .map((item) => (
          <div key={item.id}>
            {item.hasSubmenu ? (
              <Collapsible 
                open={expandedMenus.has(item.id)}
                onOpenChange={() => handleMenuClick(item.id, true)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`w-full justify-between h-11 px-3 rounded-lg transition-all ${
                      expandedMenus.has(item.id) ? 'bg-functional-bright-blue text-functional-dark-blue shadow-sm' : 'hover:bg-functional-bright-grey'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="h-4 w-4" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {expandedMenus.has(item.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-2">
                  {item.subItems
                    ?.filter(subItem => !subItem.hidden)  // 🔒 过滤掉隐藏的子菜单项
                    .map((subItem) => (
                    <Button
                      key={subItem.id}
                      variant="ghost"
                      className={`w-full justify-start h-10 px-6 ml-2 rounded-lg transition-all ${
                        currentActiveMenu === subItem.id 
                          ? 'bg-maersk-blue text-maersk-white shadow-sm' 
                          : 'hover:bg-functional-bright-blue hover:text-functional-dark-blue'
                      }`}
                      onClick={() => handleSubMenuClick(subItem.id)}
                    >
                      <subItem.icon className="h-3.5 w-3.5 mr-3" />
                      <span className="text-sm font-medium">{subItem.label}</span>
                    </Button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <Button
                variant="ghost"
                className={`w-full justify-start h-11 px-3 rounded-lg transition-all ${
                  currentActiveMenu === item.id 
                    ? 'bg-maersk-blue text-maersk-white shadow-sm' 
                    : 'hover:bg-functional-bright-grey'
                }`}
                onClick={() => handleMenuClick(item.id)}
              >
                <item.icon className="h-4 w-4 mr-3" />
                <span className="font-medium">{item.label}</span>
              </Button>
            )}
          </div>
        ))}
      </nav>

      {/* 底部信息 - 固定在底部 */}
      <div className="p-4 border-t border-functional-light-grey bg-functional-bright-grey flex-shrink-0">
        <div className="text-xs text-functional-mid-grey space-y-1 text-center">
          <p className="font-medium text-maersk-black">Version 1.1.0</p>
          <p className="text-maersk-blue">© 2026 Maersk</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start h-11 px-3 rounded-lg transition-all hover:bg-functional-bright-blue hover:text-functional-dark-blue"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 mr-3" />
          <span className="font-medium">登出</span>
        </Button>
      </div>
    </div>
  );
}