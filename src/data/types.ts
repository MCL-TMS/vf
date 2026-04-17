// 数据类型定义文件
// 在这里定义项目中使用的数据类型

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DateRange {
  from: string;
  to: string;
}

// 在这里添加更多数据类型定义