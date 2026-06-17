import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { transferProgress } from "../data/mockData";

export function TransferProgress() {
  const { completed, total, value } = transferProgress;
  const percentage = (completed / total) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center">
          <div className="relative w-32 h-32">
            {/* 外圆环 */}
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="50"
                stroke="#e5e7eb"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="60"
                cy="60"
                r="50"
                stroke="#3b82f6"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 50 * (percentage / 100)} ${2 * Math.PI * 50}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-2xl font-semibold text-blue-600">{percentage}%</span>
              <span className="text-xs text-muted-foreground">Complete</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Completed</span>
            <span>{completed.toLocaleString()}</span>
          </div>
          <Progress value={percentage} className="h-2" />
          <div className="text-center">
            <span className="text-lg font-semibold">{value}</span>
            <p className="text-sm text-muted-foreground">Total Transfers</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}