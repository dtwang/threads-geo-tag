/**
 * 查詢管理器 - 統一管理所有地區查詢
 * 提供隊列機制，限制並發查詢數量
 * 提供快取機制，避免重複查詢
 */

// ==================== 隊列配置 ====================
let queueJobMax = 3; // 最多同時處理的任務數（可動態更新）
const queryQueueMax = 30; // 隊列最大長度
let queryQueue = []; // 待處理的查詢隊列
let activeQueryCount = 0; // 當前正在執行的查詢數量

// ==================== 快取配置 ====================
const CACHE_KEY = 'regionCache'; // chrome.storage 中的鍵名
const CACHE_EXPIRY_DAYS = 30; // 快取過期天數（30 天）

// ==================== 快取管理 ====================

/**
 * 從快取中讀取用戶地區
 * @param {string} username - 用戶帳號（不含 @ 符號）
 * @returns {Promise<string|null>} 返回地區或 null（未找到或已過期）
 */
async function getCachedRegion(username) {
  try {
    const result = await chrome.storage.local.get([CACHE_KEY]);
    const cache = result[CACHE_KEY] || {};

    if (cache[username]) {
      const cached = cache[username];
      const now = Date.now();
      const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // 轉換為毫秒

      // 檢查是否過期
      if (now - cached.timestamp < expiryTime) {
        //console.log(`[Cache] 命中快取 @${username}: ${cached.region} (保存於 ${new Date(cached.timestamp).toLocaleString()})`);
        return cached.region;
      } else {
        //console.log(`[Cache] 快取已過期 @${username} (保存於 ${new Date(cached.timestamp).toLocaleString()})`);
        // 刪除過期的快取
        delete cache[username];
        await chrome.storage.local.set({ [CACHE_KEY]: cache });
        return null;
      }
    }

    //console.log(`[Cache] 未找到快取 @${username}`);
    return null;
  } catch (error) {
    console.error('[Cache] 讀取快取失敗:', error);
    return null;
  }
}

/**
 * 將用戶地區保存到快取
 * @param {string} username - 用戶帳號（不含 @ 符號）
 * @param {string} region - 地區
 * @returns {Promise<void>}
 */
async function saveCachedRegion(username, region) {
  try {
    const result = await chrome.storage.local.get([CACHE_KEY]);
    const cache = result[CACHE_KEY] || {};

    cache[username] = {
      region: region,
      timestamp: Date.now()
    };

    await chrome.storage.local.set({ [CACHE_KEY]: cache });
    console.log(`[Cache] 已保存快取 @${username}: ${region}`);
  } catch (error) {
    console.error('[Cache] 保存快取失敗:', error);
  }
}

/**
 * 清除所有快取
 * @returns {Promise<void>}
 */
async function clearCache() {
  try {
    await chrome.storage.local.remove([CACHE_KEY]);
    console.log('[Cache] 已清除所有快取');
  } catch (error) {
    console.error('[Cache] 清除快取失敗:', error);
  }
}

/**
 * 獲取快取統計信息
 * @returns {Promise<Object>} 快取統計信息
 */
async function getCacheStats() {
  try {
    const result = await chrome.storage.local.get([CACHE_KEY]);
    const cache = result[CACHE_KEY] || {};
    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    let totalCount = 0;
    let validCount = 0;
    let expiredCount = 0;

    for (const username in cache) {
      totalCount++;
      if (now - cache[username].timestamp < expiryTime) {
        validCount++;
      } else {
        expiredCount++;
      }
    }

    return {
      totalCount,
      validCount,
      expiredCount,
      expiryDays: CACHE_EXPIRY_DAYS
    };
  } catch (error) {
    console.error('[Cache] 獲取快取統計失敗:', error);
    return {
      totalCount: 0,
      validCount: 0,
      expiredCount: 0,
      expiryDays: CACHE_EXPIRY_DAYS
    };
  }
}

/**
 * 獲取所有快取的用戶地區資料
 * @returns {Promise<Object>} 所有快取資料
 */
async function getAllCachedRegions() {
  try {
    const result = await chrome.storage.local.get([CACHE_KEY]);
    const cache = result[CACHE_KEY] || {};
    console.log(`[Cache] 獲取所有快取資料，共 ${Object.keys(cache).length} 筆`);
    return cache;
  } catch (error) {
    console.error('[Cache] 獲取所有快取失敗:', error);
    return {};
  }
}

// ==================== 查詢實現 ====================

/**
 * 執行實際的地區查詢（內部實現）
 * @param {string} username - 用戶帳號（不含 @ 符號）
 * @param {boolean} shouldKeepTab - 是否保留查詢分頁
 * @param {string} keepTabFilter - 保留分頁的過濾條件（當結果不包含此字串時才保留）
 * @returns {Promise<{success: boolean, region?: string, error?: string}>}
 */
async function executeQuery(username, shouldKeepTab = false, keepTabFilter = '') {
  // 移除 @ 符號（如果有的話）
  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

  let newTab = null;

  try {
    console.log(`[QueryManager] 正在查詢 @${cleanUsername}...`);

    // 隨機延遲 2-5 秒，避免同時發起太多查詢，更像真實用戶行為
    const randomDelay = Math.random() * 2000 + 3000; // 1000-3000ms
    console.log(`[Threads] 等待 ${Math.round(randomDelay / 1000)} 秒後查詢下一個用戶`);
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    
    // 開啟新分頁到用戶的 Threads 個人資料頁面
    const profileUrl = `https://www.threads.com/@${cleanUsername}?hl=en`;

    // 尋找有開啟 threads.com 的視窗
    let targetWindowId = null;
    try {
      const allWindows = await chrome.windows.getAll({ populate: true });
      if (allWindows.length > 1) {
        // 有多個視窗時，尋找有 threads.com 分頁的視窗
        for (const win of allWindows) {
          const hasThreadsTab = win.tabs?.some(tab => 
            tab.url && tab.url.includes('threads.com')
          );
          if (hasThreadsTab) {
            targetWindowId = win.id;
            console.log(`[QueryManager] 找到有 threads.com 的視窗: ${targetWindowId}`);
            break;
          }
        }
      }
    } catch (error) {
      console.error('[QueryManager] 尋找視窗時發生錯誤:', error);
    }

    // 建立新分頁的選項
    const createOptions = {
      url: profileUrl,
      active: false // 在背景開啟，不切換過去
    };
    
    // 如果找到目標視窗，指定在該視窗開啟
    if (targetWindowId !== null) {
      createOptions.windowId = targetWindowId;
    }

    newTab = await chrome.tabs.create(createOptions);

    // 等待新分頁載入完成
    await new Promise((resolve) => {
      const listener = (tabId, changeInfo) => {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);

      // 設定超時時間（10 秒）
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 10000);
    });

    // 等待頁面完全渲染和 content script 載入
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 先用 ping 確認 content script 已經載入（最多重試 10 次）
    let contentScriptReady = false;
    let pingRetries = 10;

    for (let i = 0; i < pingRetries; i++) {
      try {
        const pingResponse = await chrome.tabs.sendMessage(newTab.id, {
          action: 'ping'
        });

        if (pingResponse && pingResponse.success) {
          contentScriptReady = true;
          console.log(`[QueryManager] Content script 已準備就緒 @${cleanUsername}`);
          break;
        }
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (!contentScriptReady) {
      throw new Error('Content script 未能載入');
    }

    // Content script 已準備好，發送查詢請求
    const response = await chrome.tabs.sendMessage(newTab.id, {
      action: 'autoQueryRegion',
      account: cleanUsername
    });

    // 返回結果
    if (response && response.success) {
      const region = response.region;
      
      // 根據設定決定是否關閉新分頁
      // 如果 shouldKeepTab 為 true，且有過濾條件，則只有當結果不包含過濾條件時才保留
      let shouldCloseTab = !shouldKeepTab;
      
      if (shouldKeepTab && keepTabFilter && keepTabFilter.trim() !== '') {
        // 檢查結果是否包含過濾條件（不區分大小寫）
        const regionLower = region.toLowerCase();
        const filterLower = keepTabFilter.trim().toLowerCase();
        
        if (regionLower.includes(filterLower)) {
          // 結果包含過濾條件，關閉分頁
          shouldCloseTab = true;
          console.log(`[QueryManager] 結果 "${region}" 包含 "${keepTabFilter}"，關閉分頁`);
        } else {
          // 結果不包含過濾條件，保留分頁
          shouldCloseTab = false;
          console.log(`[QueryManager] 結果 "${region}" 不包含 "${keepTabFilter}"，保留分頁`);
        }
      }
      
      if (shouldCloseTab && newTab) {
        try {
          await chrome.tabs.remove(newTab.id);
          console.log(`[QueryManager] 已關閉查詢分頁: ${newTab.id}`);
        } catch (closeError) {
          console.error('[QueryManager] 關閉分頁時發生錯誤:', closeError);
        }
      }
      console.log(`[QueryManager] 查詢成功 @${cleanUsername}: ${region}`);

      // 保存到快取
      await saveCachedRegion(cleanUsername, region);

      return {
        success: true,
        region: region,
        fromCache: false
      };
    } else {
      // 查詢失敗，根據過濾條件決定是否關閉分頁
      // 失敗視為「結果不符合過濾條件」，如果有設定過濾條件則保留分頁
      let shouldCloseTab = !shouldKeepTab;
      
      if (shouldKeepTab && keepTabFilter && keepTabFilter.trim() !== '') {
        // 有過濾條件時，失敗視為不符合，保留分頁
        shouldCloseTab = false;
        console.log(`[QueryManager] 查詢失敗，視為不符合 "${keepTabFilter}"，保留分頁`);
      }
      
      if (shouldCloseTab && newTab) {
        try {
          await chrome.tabs.remove(newTab.id);
          console.log(`[QueryManager] 查詢失敗，已關閉分頁: ${newTab.id}`);
        } catch (closeError) {
          console.error('[QueryManager] 關閉分頁時發生錯誤:', closeError);
        }
      }
      return {
        success: false,
        error: response?.error || '未知錯誤'
      };
    }
  } catch (error) {
    // 如果發生錯誤，根據過濾條件決定是否關閉分頁
    let shouldCloseTab = !shouldKeepTab;
    
    if (shouldKeepTab && keepTabFilter && keepTabFilter.trim() !== '') {
      // 有過濾條件時，錯誤視為不符合，保留分頁
      shouldCloseTab = false;
      console.log(`[QueryManager] 查詢錯誤，視為不符合 "${keepTabFilter}"，保留分頁`);
    }
    
    if (shouldCloseTab && newTab) {
      try {
        await chrome.tabs.remove(newTab.id);
      } catch (closeError) {
        console.error('[QueryManager] 關閉分頁時發生錯誤:', closeError);
      }
    }

    console.error(`[QueryManager] 查詢失敗 @${cleanUsername}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==================== 隊列處理 ====================

/**
 * 處理查詢隊列
 * 從隊列中取出任務並執行，直到達到並發上限或隊列為空
 */
async function processQueryQueue() {
  // 如果當前執行的任務數已達上限，或隊列為空，則不處理
  if (activeQueryCount >= queueJobMax || queryQueue.length === 0) {
    return;
  }

  // 從隊列中取出一個任務
  const task = queryQueue.shift();
  activeQueryCount++;

  console.log(`[QueryManager] 開始處理任務 @${task.username} (進行中: ${activeQueryCount}/${queueJobMax}, 隊列剩餘: ${queryQueue.length})`);

  try {
    const result = await executeQuery(task.username, task.shouldKeepTab, task.keepTabFilter);
    task.resolve(result);
  } catch (error) {
    task.reject(error);
  } finally {
    activeQueryCount--;
    console.log(`[QueryManager] 任務完成 @${task.username} (進行中: ${activeQueryCount}/${queueJobMax}, 隊列剩餘: ${queryQueue.length})`);

    // 任務完成後，繼續處理隊列中的下一個任務
    processQueryQueue();
  }
}

/**
 * 添加查詢任務到隊列
 * @param {string} username - 用戶帳號
 * @param {boolean} shouldKeepTab - 是否保留查詢分頁
 * @param {string} keepTabFilter - 保留分頁的過濾條件
 * @returns {Promise<{success: boolean, region?: string, error?: string}>|null} 返回 null 表示無法加入隊列
 */
function addToQueryQueue(username, shouldKeepTab = false, keepTabFilter = '') {
  // 檢查隊列是否已滿
  if (queryQueue.length >= queryQueueMax) {
    console.log(`[QueryManager] 隊列已滿 (${queryQueue.length}/${queryQueueMax})，拒絕加入 @${username}`);
    return null;
  }

  // 檢查是否已在隊列中（避免重複）
  const isAlreadyInQueue = queryQueue.some(task => task.username === username);
  if (isAlreadyInQueue) {
    console.log(`[QueryManager] @${username} 已在隊列中，跳過重複加入`);
    return null;
  }

  return new Promise((resolve, reject) => {
    queryQueue.push({
      username,
      shouldKeepTab,
      keepTabFilter,
      resolve,
      reject
    });

    console.log(`[QueryManager] 任務已加入隊列 @${username} (隊列長度: ${queryQueue.length}/${queryQueueMax})`);

    // 嘗試立即開始處理隊列
    processQueryQueue();
  });
}

// ==================== 對外接口 ====================

/**
 * 查詢用戶地區（對外接口）
 * @param {string} username - 用戶帳號
 * @param {boolean} shouldKeepTab - 是否保留查詢分頁（可選，默認從 storage 讀取）
 * @param {boolean} forceRefresh - 是否強制重新查詢（忽略快取，可選，默認 false）
 * @returns {Promise<{success: boolean, region?: string, error?: string, fromCache?: boolean}>}
 */
async function queryUserRegion(username, shouldKeepTab = null, forceRefresh = false) {
  // 移除 @ 符號（如果有的話）
  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

  // 如果不是強制刷新，先檢查快取
  if (!forceRefresh) {
    const cachedRegion = await getCachedRegion(cleanUsername);
    if (cachedRegion !== null) {
      console.log(`[QueryManager] 使用快取數據 @${cleanUsername}: ${cachedRegion}`);
      return {
        success: true,
        region: cachedRegion,
        fromCache: true
      };
    }
  } else {
    console.log(`[QueryManager] 強制刷新，忽略快取 @${cleanUsername}`);
  }

  // 如果未指定 shouldKeepTab，從 chrome.storage 讀取
  let keepTabFilter = '';
  if (shouldKeepTab === null) {
    try {
      const storageResult = await chrome.storage.local.get(['keepTabAfterQuery', 'keepTabFilter']);
      shouldKeepTab = storageResult.keepTabAfterQuery || false;
      keepTabFilter = storageResult.keepTabFilter || '';
    } catch (error) {
      console.error('[QueryManager] 讀取 storage 失敗:', error);
      shouldKeepTab = false;
      keepTabFilter = '';
    }
  } else {
    // 如果指定了 shouldKeepTab，也要讀取 keepTabFilter
    try {
      const storageResult = await chrome.storage.local.get(['keepTabFilter']);
      keepTabFilter = storageResult.keepTabFilter || '';
    } catch (error) {
      console.error('[QueryManager] 讀取 keepTabFilter 失敗:', error);
      keepTabFilter = '';
    }
  }

  // 沒有快取或強制刷新，加入隊列執行查詢
  console.log(`[QueryManager] 查詢參數: shouldKeepTab=${shouldKeepTab}, keepTabFilter="${keepTabFilter}"`);
  const queueResult = addToQueryQueue(cleanUsername, shouldKeepTab, keepTabFilter);
  
  // 如果無法加入隊列（隊列已滿或已存在），返回失敗
  if (queueResult === null) {
    return {
      success: false,
      region: null,
      fromCache: null
    };
  }
  
  return queueResult;
}

/**
 * 獲取當前隊列狀態（用於調試）
 * @returns {Object} 隊列狀態信息
 */
function getQueueStatus() {
  return {
    queueLength: queryQueue.length,
    queueMax: queryQueueMax,
    activeQueryCount: activeQueryCount,
    maxConcurrent: queueJobMax
  };
}

/**
 * 更新最大並行查詢數量
 * @param {number} value - 新的最大並行數量（1-10）
 */
function updateMaxConcurrent(value) {
  const newValue = Math.max(1, Math.min(10, parseInt(value, 10) || 3));
  console.log(`[QueryManager] 更新最大並行查詢數: ${queueJobMax} -> ${newValue}`);
  queueJobMax = newValue;
  
  // 如果有待處理的任務，嘗試立即處理更多任務
  if (queryQueue.length > 0 && activeQueryCount < queueJobMax) {
    processQueryQueue();
  }
}

// ==================== 導出 ====================
export {
  queryUserRegion,
  getQueueStatus,
  getCachedRegion,
  getAllCachedRegions,
  saveCachedRegion,
  clearCache,
  getCacheStats,
  updateMaxConcurrent
};
