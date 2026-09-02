import { Card } from "./ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { KPIData } from "../data/mockData";

interface KPICardProps {
  data: KPIData;
}

function formatKPIValue(value: string | number): string {
  const text = String(value);
  if (text.includes(',') || /[%小时天]/.test(text)) return text;

  const numericValue = Number(text);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString() : text;
}

export function KPICard({ data }: KPICardProps) {
  const { label, value, change, trend } = data;
  const isPositive = trend === 'up';

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">{label}</p>
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold">{formatKPIValue(value)}</h3>
          <div className={`flex items-center space-x-1 text-sm ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>{Math.abs(change)}%</span>
          </div>
        </div>
      </div>
    </Card>
  );
}