# Flow Risk Level Calculation

## Overview
This document outlines the methodology for calculating risk levels in logistics flow monitoring.

## Risk Level Categories
1. **Low Risk** (Green): Normal operations
2. **Medium Risk** (Yellow): Potential delays or issues
3. **High Risk** (Red): Critical issues requiring immediate attention

## Calculation Factors

### Time-based Factors
- **Pickup Timeout**: Orders not picked up within SLA timeframe
- **Transit Delays**: Extended transit times beyond normal range
- **Delivery Delays**: Failed delivery attempts or extended delivery windows

### Volume-based Factors
- **Capacity Utilization**: Courier capacity vs order volume
- **Geographic Concentration**: High order density in specific regions
- **Seasonal Patterns**: Expected vs actual order volumes

### Quality Factors
- **Exception Rate**: Percentage of orders with exceptions
- **Customer Complaints**: Negative feedback or issues reported
- **Return Rate**: Orders returned or refused by customers

## Risk Score Formula
```
Risk Score = (Time Factor × 0.4) + (Volume Factor × 0.3) + (Quality Factor × 0.3)
```

## Thresholds
- **Low Risk**: Score 0-30
- **Medium Risk**: Score 31-70  
- **High Risk**: Score 71-100

## Implementation
Risk levels are calculated continuously and trigger alerts when thresholds are exceeded.

## Dashboard Integration
- Real-time risk indicators on logistics monitoring page
- Historical risk trend analysis
- Automated alert system for high-risk situations