# Completion Rate Calculation

## Overview
This document describes the calculation methodology for completion rates in the VF Logistics Dashboard.

## Calculation Formula
```
Completion Rate = (Completed Orders / Total Orders) × 100%
```

## Implementation Details
- **Completed Orders**: Orders that have reached final delivery status
- **Total Orders**: All orders within the specified time period
- **Exclusions**: Cancelled orders are excluded from completion rate calculation

## Status Definitions
- **Completed**: Orders with status "已签收" (Delivered)
- **In Progress**: Orders in transit or processing
- **Failed**: Orders that failed delivery after maximum attempts

## Usage in Dashboard
The completion rate is used in:
- KPI cards on overview dashboard
- Brand performance analysis
- Platform comparison metrics
- Regional performance evaluation

## Notes
- Calculation is performed in real-time based on current data
- Historical trends are maintained for comparison analysis
- Rate is calculated separately for each brand and platform combination