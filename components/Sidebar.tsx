import { useState } from "react";
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
  Scale
} from "lucide-react";
// Maersk Logo as SVG component
const MaerskLogo = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="4" fill="#42b0d5"/>
    <path d="M8 12h16v8H8z" fill="white"/>
    <circle cx="12" cy="16" r="2" fill="#42b0d5"/>
    <circle cx="20" cy="16" r="2" fill="#42b0d5"/>
    <path d="M6 16h20M16 6v20" stroke="white" strokeWidth="2"/>
  </svg>
);

interface SidebarProps {
  onMenuSelect: (menu: string) => void;
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
      { id: "overview-regional", label: "地域分析", icon: Map },
      { id: "overview-exceptions", label: "异常监控", icon: AlertTriangle },
      { id: "overview-trends", label: "趋势分析", icon: TrendingUp },
      { id: "overview-weight", label: "重量分析", icon: Scale }
    ]
  },
  {
    id: "kpi",
    label: "KPI Dashboard",
    icon: BarChart3,
    hasSubmenu: false
  },
  {
    id: "schedules",
    label: "Schedules",
    icon: Calendar,
    hasSubmenu: false
  },
  {
    id: "fulfillment",
    label: "myFulfillment",
    icon: Truck,
    hasSubmenu: false
  }
];

export function Sidebar({ onMenuSelect }: SidebarProps) {
  const [activeMenu, setActiveMenu] = useState("overview-dashboard");
  const [expandedMenus, setExpandedMenus] = useState(new Set(["overview"]));

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
      setActiveMenu(menuId);
      onMenuSelect(menuId);
    }
  };

  const handleSubMenuClick = (menuId: string) => {
    setActiveMenu(menuId);
    onMenuSelect(menuId);
  };

  return (
    <div className="w-64 bg-maersk-white border-r border-functional-light-grey h-full flex flex-col shadow-sm">
      {/* Maersk Logo */}
      <div className="p-6 border-b border-functional-light-grey bg-gradient-to-br from-functional-bright-blue via-maersk-white to-functional-bright-blue">
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-maersk-white rounded-lg shadow-sm border border-functional-light-blue">
            <MaerskLogo />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-maersk-black truncate">Maersk</h2>
            <p className="text-sm text-maersk-blue font-medium truncate">VF物流数据中心</p>
          </div>
        </div>
      </div>

      {/* 用户信息 */}
      <div className="p-6 border-b border-functional-light-grey bg-functional-bright-grey">
        <div className="flex items-center space-x-3">
          <Avatar className="ring-2 ring-functional-light-blue">
            <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face" />
            <AvatarFallback className="bg-functional-bright-blue text-functional-dark-blue font-medium">VF</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-maersk-black">VF物流经理</p>
            <p className="text-sm text-functional-mid-grey truncate">系统管理员</p>
          </div>
          <Badge variant="secondary" className="text-xs bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue">Pro</Badge>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
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
                  {item.subItems?.map((subItem) => (
                    <Button
                      key={subItem.id}
                      variant="ghost"
                      className={`w-full justify-start h-10 px-6 ml-2 rounded-lg transition-all ${
                        activeMenu === subItem.id 
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
                  activeMenu === item.id 
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

      {/* 底部信息 */}
      <div className="p-4 border-t border-functional-light-grey bg-functional-bright-grey">
        <div className="text-xs text-functional-mid-grey space-y-1 text-center">
          <p className="font-medium text-maersk-black">Version 2.1.0</p>
          <p className="text-maersk-blue">© 2025 Maersk</p>
        </div>
      </div>
    </div>
  );
}