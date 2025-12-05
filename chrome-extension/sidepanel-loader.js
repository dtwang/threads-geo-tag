import { getCachedRegion, getAllCachedRegions, clearCache, getCacheStats } from './queryManager.js';

// 將需要的函數掛載到 window 供 sidepanel.js 使用
window.getCachedRegion = getCachedRegion;
window.getAllCachedRegions = getAllCachedRegions;
window.clearCache = clearCache;
window.getCacheStats = getCacheStats;

// 動態載入 sidepanel.js，確保 queryManager 已載入
const script = document.createElement('script');
script.src = 'sidepanel.js';
document.body.appendChild(script);
