/**
 * VF物流数据分析平台 - 文件上传API路由 (修正城市映射逻辑)
 * 
 * 处理时效Excel表格上传和解析
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const router = express.Router();

/**
 * DEST_CITY代码到真实城市名称的映射查询
 * 实现映射逻辑: TSK_LIST_TASK.DEST_CITY -> BAS_AREA.area_id -> BAS_AREA.area_name
 */
async function getCityAreaMapping() {
  try {
    const { executeQuery } = require('../config/database-api');
    
    // 从BAS_AREA表获取DEST_CITY代码到城市名称的映射
    try {
      console.log('🗺️ 正在从BAS_AREA表查询DEST_CITY代码到城市名称的映射...');
      
      // 查询BAS_AREA表: area_id作为DEST_CITY的匹配键，area_name作为真实城市名称
      const query = `
        SELECT 
          AREA_ID,    -- 对应TSK_LIST_TASK.DEST_CITY字段的代码值
          AREA_NAME   -- 真实城市名称，用于与时效表匹配
        FROM APP_CMS.BAS_AREA 
        WHERE AREA_ID IS NOT NULL 
          AND AREA_NAME IS NOT NULL
          AND TRIM(AREA_NAME) != ''
        ORDER BY AREA_ID
      `;
      
      const result = await executeQuery(query);
      
      // 构建DEST_CITY代码到城市名称的映射对象
      const destCityToNameMapping = {};
      
      if (result.rows && result.rows.length > 0) {
        result.rows.forEach(row => {
          const areaId = row[0]?.toString().trim();    // DEST_CITY代码
          const areaName = row[1]?.toString().trim();  // 真实城市名称
          
          if (areaId && areaName) {
            destCityToNameMapping[areaId] = areaName;
          }
        });
        
        console.log(`✅ 从BAS_AREA表获取到${result.rows.length}条记录`);
        console.log(`📍 DEST_CITY->城市名称映射: ${Object.keys(destCityToNameMapping).length}个代码`);
        console.log('🔍 映射示例:', Object.entries(destCityToNameMapping).slice(0, 5).map(([code, name]) => `${code}->${name}`));
        
        return destCityToNameMapping;
      } else {
        console.warn('⚠️ BAS_AREA表查询结果为空');
        throw new Error('BAS_AREA表无数据');
      }
      
    } catch (dbError) {
      console.warn('💾 数据库查询失败，使用备用城市映射:', dbError.message);
      
      // 备用：返回包含常见DEST_CITY代码到城市名称的映射
      const fallbackDestCityMapping = {
        // 基于图片示例和常见城市代码
        '29129': '阿坝藏族羌族自治州',
        '110000': '北京市',
        '310000': '上海市', 
        '120000': '天津市',
        '500000': '重庆市',
        '440100': '广州市',
        '440300': '深圳市',
        '330100': '杭州市',
        '320100': '南京市',
        '510100': '成都市',
        '610100': '西安市',
        '420100': '武汉市',
        '410100': '郑州市',
        '430100': '长沙市',
        '370100': '济南市',
        '210100': '沈阳市'
      };
      
      console.log(`⚡ 使用备用DEST_CITY映射，包含${Object.keys(fallbackDestCityMapping).length}个代码`);
      return fallbackDestCityMapping;
    }
    
  } catch (error) {
    console.error('❌ 获取城市映射失败:', error);
    return {};
  }
}

/**
 * 根据品牌+城市+快递公司获取Plan时效
 * 实现三元组匹配逻辑
 */
function getPlanTimeliness(brand, carrier, destCityCode, cityMapping, timelinessTable) {
  try {
    // 1. 将DEST_CITY代码转换为真实城市名称
    const cityName = cityMapping[destCityCode];
    
    if (!cityName) {
      console.warn(`⚠️ 未找到DEST_CITY代码${destCityCode}对应的城市名称`);
      return null;
    }
    
    // 2. 在时效表中查找匹配的记录
    // TODO: 这里需要实现真实的时效表匹配逻辑
    // 当前返回模拟数据作为示例
    const mockPlanTime = {
      'TNF': { 'SF': 48, 'YTO': 72, 'default': 72 },
      'DICKIES': { 'SF': 48, 'YTO': 72, 'default': 72 },
      'VANS': { 'SF': 48, 'YTO': 72, 'default': 72 },
      'TIMBERLAND': { 'SF': 48, 'YTO': 72, 'default': 72 },
      'ICEBREAKER': { 'SF': 48, 'YTO': 72, 'default': 72 }
    };
    
    const brandPlan = mockPlanTime[brand] || mockPlanTime['default'] || {};
    const planHours = brandPlan[carrier] || brandPlan['default'] || 72;
    
    console.log(`📋 Plan时效匹配: ${brand}+${cityName}+${carrier} -> ${planHours}小时`);
    
    return {
      planS2DHours: planHours,
      planC2DHours: Math.round(planHours / 24) || 3,
      cityName: cityName
    };
  } catch (error) {
    console.error('❌ Plan时效获取失败:', error);
    return null;
  }
}

module.exports = router;