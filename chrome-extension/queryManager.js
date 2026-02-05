/**
 * 查詢管理器 - 統一管理所有地區查詢
 * 提供隊列機制，限制並發查詢數量
 * 提供快取機制，避免重複查詢
 */

// ==================== 隊列配置 ====================
let queueJobMax = 3; // 最多同時處理的任務數（可動態更新）
const queryQueueMax = 10; // 隊列最大長度
let queryQueue = []; // 待處理的查詢隊列
let activeQueryCount = 0; // 當前正在執行的查詢數量
let activeQueries = new Set(); // 當前正在執行的查詢用戶名稱（用於檢查重複）

// 查詢間隔延遲配置（毫秒）
const QUERY_DELAY_MIN = 2000; // 最小延遲 2 秒
const QUERY_DELAY_MAX = 5000; // 最大延遲 5 秒

// ==================== 快取配置 ====================
const CACHE_KEY = 'regionCache'; // chrome.storage 中的鍵名
const PROFILE_CACHE_KEY = 'profileCache'; // 用戶側寫快取的鍵名
const CACHE_EXPIRY_DAYS = 30; // 快取過期天數（30 天）

// 查詢狀態常數
const QUERY_STATUS = {
  NOT_QUERIED: null,                    // 從未查詢過
  IN_PROGRESS: 'in_progress',           // 查詢中
  FAIL_HTTP429: 'fail_http429',         // HTTP 429 錯誤
  FAIL_ME: 'fail_me',                   // 自己的帳號暫無法查詢
  FAIL_NOT_ROLLOUT: 'fail_not_rollout_yet', // 該帳號上無地點顯示功能
  SUCCESS: 'success'                    // 查詢成功
};

// ==================== 快取管理 ====================

/**
 * 從快取中讀取用戶地區
 * @param {string} username - 用戶帳號（不含 @ 符號）
 * @returns {Promise<{region: string|null, status: string|null}>} 返回地區和查詢狀態
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
        return {
          region: cached.region || null,
          status: cached.regionQueryStatus || null
        };
      } else {
        //console.log(`[Cache] 快取已過期 @${username} (保存於 ${new Date(cached.timestamp).toLocaleString()})`);
        // 刪除過期的快取
        delete cache[username];
        await chrome.storage.local.set({ [CACHE_KEY]: cache });
        return { region: null, status: null };
      }
    }

    //console.log(`[Cache] 未找到快取 @${username}`);
    return { region: null, status: null };
  } catch (error) {
    console.error('[Cache] 讀取快取失敗:', error);
    return { region: null, status: null };
  }
}

/**
 * 將用戶地區保存到快取
 * @param {string} username - 用戶帳號（不含 @ 符號）
 * @param {string|null} region - 地區（可為 null）
 * @param {string|null} status - 查詢狀態（使用 QUERY_STATUS 常數）
 * @returns {Promise<void>}
 */
async function saveCachedRegion(username, region, status = QUERY_STATUS.SUCCESS) {
  try {
    const result = await chrome.storage.local.get([CACHE_KEY]);
    const cache = result[CACHE_KEY] || {};

    cache[username] = {
      region: region,
      regionQueryStatus: status,
      timestamp: Date.now()
    };

    await chrome.storage.local.set({ [CACHE_KEY]: cache });
    console.log(`[Cache] 已保存 region 快取 @${username}, status: ${status}`);
  } catch (error) {
    console.error('[Cache] 保存 region 快取失敗:', error);
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
 * 移除單一用戶的快取
 * @param {string} username - 用戶帳號（不含 @ 符號）
 * @returns {Promise<boolean>} 是否成功移除
 */
async function removeUserCache(username) {
  try {
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    const result = await chrome.storage.local.get([CACHE_KEY]);
    const cache = result[CACHE_KEY] || {};

    if (cache[cleanUsername]) {
      delete cache[cleanUsername];
      await chrome.storage.local.set({ [CACHE_KEY]: cache });
      console.log(`[Cache] 已移除 @${cleanUsername} 的快取`);
      return true;
    } else {
      console.log(`[Cache] @${cleanUsername} 沒有快取資料`);
      return false;
    }
  } catch (error) {
    console.error('[Cache] 移除用戶快取失敗:', error);
    return false;
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

// ==================== 用戶側寫快取管理 ====================

/**
 * 從快取中讀取用戶側寫分析結果
 * @param {string} username - 用戶帳號（不含 @ 符號）
 * @returns {Promise<{profile: string}|null>} 返回側寫資料或 null（未找到或已過期）
 */
async function getCachedProfile(username) {
  try {
    const result = await chrome.storage.local.get([PROFILE_CACHE_KEY]);
    const cache = result[PROFILE_CACHE_KEY] || {};

    if (cache[username]) {
      const cached = cache[username];
      const now = Date.now();
      const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      if (now - cached.timestamp < expiryTime) {
        console.log(`[ProfileCache] 命中快取 @${username}: ${cached.profile}`);
        return {
          profile: cached.profile
        };
      } else {
        console.log(`[ProfileCache] 快取已過期 @${username}`);
        delete cache[username];
        await chrome.storage.local.set({ [PROFILE_CACHE_KEY]: cache });
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error('[ProfileCache] 讀取快取失敗:', error);
    return null;
  }
}

/**
 * 將用戶側寫分析結果保存到快取
 * @param {string} username - 用戶帳號（不含 @ 符號）
 * @param {string} profile - 側寫標籤
 * @returns {Promise<void>}
 */
async function saveCachedProfile(username, profile) {
  try {
    const result = await chrome.storage.local.get([PROFILE_CACHE_KEY]);
    const cache = result[PROFILE_CACHE_KEY] || {};

    cache[username] = {
      profile: profile,
      timestamp: Date.now()
    };

    await chrome.storage.local.set({ [PROFILE_CACHE_KEY]: cache });
    console.log(`[ProfileCache] 已保存profile快取 @${username}`);
  } catch (error) {
    console.error('[ProfileCache] 保存profile快取失敗:', error);
  }
}

/**
 * 獲取所有快取的用戶側寫資料
 * @returns {Promise<Object>} 所有快取資料
 */
async function getAllCachedProfiles() {
  try {
    const result = await chrome.storage.local.get([PROFILE_CACHE_KEY]);
    const cache = result[PROFILE_CACHE_KEY] || {};
    console.log(`[ProfileCache] 獲取所有快取資料，共 ${Object.keys(cache).length} 筆`);
    return cache;
  } catch (error) {
    console.error('[ProfileCache] 獲取所有快取失敗:', error);
    return {};
  }
}

/**
 * 清除所有側寫快取
 * @returns {Promise<void>}
 */
async function clearProfileCache() {
  try {
    await chrome.storage.local.remove([PROFILE_CACHE_KEY]);
    console.log('[ProfileCache] 已清除所有快取');
  } catch (error) {
    console.error('[ProfileCache] 清除快取失敗:', error);
  }
}

/**
 * 移除單一用戶的側寫快取
 * @param {string} username - 用戶帳號（不含 @ 符號）
 * @returns {Promise<boolean>} 是否成功移除
 */
async function removeUserProfileCache(username) {
  try {
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    const result = await chrome.storage.local.get([PROFILE_CACHE_KEY]);
    const cache = result[PROFILE_CACHE_KEY] || {};

    if (cache[cleanUsername]) {
      delete cache[cleanUsername];
      await chrome.storage.local.set({ [PROFILE_CACHE_KEY]: cache });
      console.log(`[ProfileCache] 已移除 @${cleanUsername} 的快取`);
      return true;
    } else {
      console.log(`[ProfileCache] @${cleanUsername} 沒有快取資料`);
      return false;
    }
  } catch (error) {
    console.error('[ProfileCache] 移除用戶快取失敗:', error);
    return false;
  }
}

/**
 * 獲取側寫快取統計信息
 * @returns {Promise<Object>} 快取統計信息
 */
async function getProfileCacheStats() {
  try {
    const result = await chrome.storage.local.get([PROFILE_CACHE_KEY]);
    const cache = result[PROFILE_CACHE_KEY] || {};
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
    console.error('[ProfileCache] 獲取快取統計失敗:', error);
    return {
      totalCount: 0,
      validCount: 0,
      expiredCount: 0,
      expiryDays: CACHE_EXPIRY_DAYS
    };
  }
}

// ==================== 分頁關閉輔助函數 ====================

/**
 * 安全地關閉查詢分頁
 * 如果使用者正在查看該分頁，會先切換回原本的 tab 再關閉
 * @param {number} tabId - 要關閉的分頁 ID
 * @param {number} originalTabId - 原本的 active tab ID（可選）
 * @returns {Promise<boolean>} 是否成功關閉
 */
async function safeCloseTab(tabId, originalTabId = null) {
  try {
    // 檢查分頁是否還存在
    let tabToClose;
    try {
      tabToClose = await chrome.tabs.get(tabId);
    } catch (error) {
      // 分頁已經不存在
      console.log(`[QueryManager] 分頁 ${tabId} 已不存在，無需關閉`);
      return true;
    }

    // 檢查該分頁是否為當前 active 分頁
    if (tabToClose.active) {
      console.log(`[QueryManager] 分頁 ${tabId} 是當前 active 分頁，需要先切換`);
      
      // 嘗試切換回原本的 tab
      if (originalTabId) {
        try {
          await chrome.tabs.update(originalTabId, { active: true });
          console.log(`[QueryManager] 已切換回原本的分頁 ${originalTabId}`);
        } catch (error) {
          console.log(`[QueryManager] 無法切換回原本分頁 ${originalTabId}:`, error.message);
          // 原本的分頁可能已關閉，嘗試切換到同視窗的其他分頁
          await switchToAnotherTab(tabToClose.windowId, tabId);
        }
      } else {
        // 沒有原本的 tab ID，切換到同視窗的其他分頁
        await switchToAnotherTab(tabToClose.windowId, tabId);
      }
      
      // 等待一小段時間讓切換完成
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 關閉分頁
    await chrome.tabs.remove(tabId);
    console.log(`[QueryManager] 已關閉查詢分頁: ${tabId}`);

    // 注意：不在這裡觸發 refreshRegionLabels，因為這會導致 DOM 元素被替換，
    // 使得 content.js 中的查詢按鈕 click handler 的 closure 引用失效。
    // 查詢結果會由 content.js 直接更新標籤。

    return true;
  } catch (error) {
    console.error('[QueryManager] 關閉分頁時發生錯誤:', error);
    return false;
  }
}

/**
 * 切換到同視窗的其他分頁
 * @param {number} windowId - 視窗 ID
 * @param {number} excludeTabId - 要排除的分頁 ID
 */
async function switchToAnotherTab(windowId, excludeTabId) {
  try {
    const tabs = await chrome.tabs.query({ windowId: windowId });
    const otherTab = tabs.find(t => t.id !== excludeTabId);
    if (otherTab) {
      await chrome.tabs.update(otherTab.id, { active: true });
      console.log(`[QueryManager] 已切換到其他分頁 ${otherTab.id}`);
    }
  } catch (error) {
    console.error('[QueryManager] 切換到其他分頁時發生錯誤:', error);
  }
}

/**
 * 獲取當前 active 分頁的 ID
 * @param {number} windowId - 視窗 ID（可選，如果不提供則使用當前視窗）
 * @returns {Promise<number|null>} active 分頁的 ID
 */
async function getActiveTabId(windowId = null) {
  try {
    const queryOptions = { active: true };
    if (windowId) {
      queryOptions.windowId = windowId;
    } else {
      queryOptions.currentWindow = true;
    }
    const tabs = await chrome.tabs.query(queryOptions);
    return tabs.length > 0 ? tabs[0].id : null;
  } catch (error) {
    console.error('[QueryManager] 獲取 active 分頁時發生錯誤:', error);
    return null;
  }
}

// ==================== 頁面捲動輔助函數 ====================

/**
 * 執行隨機頁面捲動，模擬真實用戶行為
 * 在頁面載入後執行 8-10 次向下捲動，每次捲動距離和等待時間都有隨機變化
 * @param {number} tabId - 要執行捲動的分頁 ID
 * @returns {Promise<void>}
 */
async function performRandomScrolls(tabId) {
  try {
    // 頁面載入後先等待一小段隨機時間 (500-1500ms)
    const initialWait = Math.floor(Math.random() * 1000) + 500;
    console.log(`[QueryManager] 頁面載入後等待 ${initialWait}ms`);
    await new Promise(resolve => setTimeout(resolve, initialWait));

    // 隨機決定捲動次數 (1-2 次)
    const scrollCount = Math.floor(Math.random() * 1) + 1;
    console.log(`[QueryManager] 開始執行 ${scrollCount} 次隨機捲動`);

    for (let i = 0; i < scrollCount; i++) {
      // 執行捲動
      await chrome.tabs.sendMessage(tabId, { action: 'performScroll' });

      console.log(`[QueryManager] 完成第 ${i + 1}/${scrollCount} 次捲動`);

      // 捲動後等待隨機時間 (1000-2000ms)，釋放執行緒讓網頁處理頁面資料
      const waitAfterScroll = Math.floor(Math.random() * 1000) + 1000;
      console.log(`[QueryManager] 等待 ${waitAfterScroll}ms 讓頁面載入資料...`);
      await new Promise(resolve => setTimeout(resolve, waitAfterScroll));
    }

    console.log(`[QueryManager] 隨機捲動完成`);
  } catch (error) {
    console.error('[QueryManager] 執行隨機捲動時發生錯誤:', error);
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
  let originalTabId = null;

  try {
    console.log(`[QueryManager] 正在查詢 @${cleanUsername}...`);

    // 記錄原本的 active tab ID，以便關閉查詢分頁時切換回去
    originalTabId = await getActiveTabId();

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

    // 在發送查詢請求前，先將狀態記錄為 IN_PROGRESS
    await saveCachedRegion(cleanUsername, null, QUERY_STATUS.IN_PROGRESS);
    console.log(`[QueryManager] 開始查詢 @${cleanUsername}，狀態: IN_PROGRESS`);

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
      
      if (shouldKeepTab && keepTabFilter && keepTabFilter.trim() !== '' && region) {
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
      
      console.log(`[QueryManager] 查詢成功 @${cleanUsername}: ${region}`);

      // 保存到快取（必須在關閉分頁之前，因為 safeCloseTab 會觸發 refreshRegionLabels）
      // 如果 region 為 null，表示該帳號尚未開放地點功能
      const status = region ? QUERY_STATUS.SUCCESS : QUERY_STATUS.FAIL_NOT_ROLLOUT;
      await saveCachedRegion(cleanUsername, region, status);

      if (shouldCloseTab && newTab) {
        await safeCloseTab(newTab.id, originalTabId);
      }

      return {
        success: true,
        region: region,
        status: status,
        fromCache: false
      };
    } else {
      // 檢查是否為 ME_UI_ISSUE 錯誤（自己的帳號）
      if (response && response.error === 'ME_UI_ISSUE') {
        console.log(`[QueryManager] ME_UI_ISSUE 錯誤: ${response.errorMessage}`);
        
        // 保存 FAIL_ME 狀態到快取
        await saveCachedRegion(cleanUsername, null, QUERY_STATUS.FAIL_ME);
        
        // 關閉查詢分頁
        if (newTab) {
          await safeCloseTab(newTab.id, originalTabId);
        }
        
        return {
          success: false,
          error: 'ME_UI_ISSUE',
          status: QUERY_STATUS.FAIL_ME,
          errorMessage: response.errorMessage
        };
      }
      
      // 檢查是否為 HTTP 429 錯誤
      if (response && response.error === 'HTTP_429') {
        console.error(`[QueryManager] HTTP 429 錯誤: ${response.errorMessage}`);
        
        // 保存 HTTP 429 狀態到快取
        await saveCachedRegion(cleanUsername, null, QUERY_STATUS.FAIL_HTTP429);
        
        // 根據設定決定是否關閉分頁
        // HTTP 429 錯誤視為查詢失敗，如果有開啟「查詢後保留結果分頁」則保留分頁
        let shouldCloseTab = !shouldKeepTab;
        
        if (shouldKeepTab) {
          console.log(`[QueryManager] HTTP 429 錯誤，但已開啟「查詢後保留結果分頁」，保留分頁`);
        }
        
        // 關閉查詢分頁
        if (shouldCloseTab && newTab) {
          await safeCloseTab(newTab.id, originalTabId);
        }
        
        // 通知 sidepanel 顯示錯誤訊息並關閉自動查詢
        try {
          await chrome.runtime.sendMessage({
            action: 'handle429Error',
            errorMessage: response.errorMessage
          });
        } catch (error) {
          console.error('[QueryManager] 無法通知 sidepanel 處理 429 錯誤:', error);
        }
        
        return {
          success: false,
          error: 'HTTP_429',
          status: QUERY_STATUS.FAIL_HTTP429,
          errorMessage: response.errorMessage
        };
      }
      
      // 查詢失敗，根據過濾條件決定是否關閉分頁
      // 失敗視為「結果不符合過濾條件」，如果有設定過濾條件則保留分頁
      let shouldCloseTab = !shouldKeepTab;
      
      if (shouldKeepTab && keepTabFilter && keepTabFilter.trim() !== '') {
        // 有過濾條件時，失敗視為不符合，保留分頁
        shouldCloseTab = false;
        console.log(`[QueryManager] 查詢失敗，視為不符合 "${keepTabFilter}"，保留分頁`);
      }
      
      if (shouldCloseTab && newTab) {
        await safeCloseTab(newTab.id, originalTabId);
      }
      return {
        success: false,
        error: response?.error || '未知錯誤'
      };
    }
  } catch (error) {
    // 檢查是否為 Content script 未能載入錯誤（可能是 HTTP 429）
    const isContentScriptError = error.message && error.message.includes('Content script 未能載入');
    
    if (isContentScriptError) {
      console.error(`[QueryManager] Content script 未能載入，可能是 HTTP 429 錯誤 @${cleanUsername}`);
      
      // 保存 HTTP 429 狀態到快取
      await saveCachedRegion(cleanUsername, null, QUERY_STATUS.FAIL_HTTP429);
      
      // 關閉查詢分頁
      if (newTab) {
        await safeCloseTab(newTab.id, originalTabId);
      }
      
      // 通知 sidepanel 顯示錯誤訊息並關閉自動查詢
      try {
        await chrome.runtime.sendMessage({
          action: 'handle429Error',
          errorMessage: '已經超過查詢用量上限'
        });
      } catch (msgError) {
        console.error('[QueryManager] 無法通知 sidepanel 處理 429 錯誤:', msgError);
      }
      
      return {
        success: false,
        error: 'HTTP_429',
        status: QUERY_STATUS.FAIL_HTTP429,
        errorMessage: '已經超過查詢用量上限'
      };
    }
    
    // 其他錯誤，根據過濾條件決定是否關閉分頁
    let shouldCloseTab = !shouldKeepTab;
    
    if (shouldKeepTab && keepTabFilter && keepTabFilter.trim() !== '') {
      // 有過濾條件時，錯誤視為不符合，保留分頁
      shouldCloseTab = false;
      console.log(`[QueryManager] 查詢錯誤，視為不符合 "${keepTabFilter}"，保留分頁`);
    }
    
    if (shouldCloseTab && newTab) {
      await safeCloseTab(newTab.id, originalTabId);
    }

    console.error(`[QueryManager] 查詢失敗 @${cleanUsername}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 整合查詢：同時進行側寫分析和地點查詢（共用同一個分頁）
 * 流程：回覆頁取內容 → 貼文頁取內容 → 開始LLM分析(非同步) → 地點查詢 → 關閉分頁
 * @param {string} username - 用戶帳號（不含 @ 符號）
 * @param {boolean} enableProfileAnalysis - 是否啟用側寫分析
 * @param {boolean} shouldKeepTab - 是否保留查詢分頁
 * @param {string} keepTabFilter - 保留分頁的過濾條件
 * @param {function} onProfileContentReady - 當側寫內容準備好時的回調（用於開始 LLM 分析）
 * @returns {Promise<{success: boolean, region?: string, error?: string}>}
 */
async function executeIntegratedQuery(username, enableProfileAnalysis = false, shouldKeepTab = false, keepTabFilter = '', onProfileContentReady = null) {
  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

  let queryTab = null;
  let userReplyContent = '';
  let userPostContent = '';
  let originalTabId = null;

  try {
    console.log(`[QueryManager] 開始整合查詢 @${cleanUsername}，側寫分析: ${enableProfileAnalysis}`);

    // 記錄原本的 active tab ID，以便關閉查詢分頁時切換回去
    originalTabId = await getActiveTabId();

    // 隨機延遲 2-5 秒，避免同時發起太多查詢
    const randomDelay = Math.random() * 2000 + 3000;
    console.log(`[QueryManager] 等待 ${Math.round(randomDelay / 1000)} 秒後開始查詢`);
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    // 尋找有開啟 threads.com 的視窗
    let targetWindowId = null;
    try {
      const allWindows = await chrome.windows.getAll({ populate: true });
      if (allWindows.length > 1) {
        for (const win of allWindows) {
          const hasThreadsTab = win.tabs?.some(tab => 
            tab.url && tab.url.includes('threads.com')
          );
          if (hasThreadsTab) {
            targetWindowId = win.id;
            break;
          }
        }
      }
    } catch (error) {
      console.error('[QueryManager] 尋找視窗時發生錯誤:', error);
    }

    const createOptions = {
      active: false
    };
    if (targetWindowId !== null) {
      createOptions.windowId = targetWindowId;
    }

    // ==================== 側寫分析部分（如果啟用）====================
    if (enableProfileAnalysis) {
      // 檢查側寫快取
      const cachedProfileData = await getCachedProfile(cleanUsername);
      if (cachedProfileData !== null) {
        console.log(`[QueryManager] 使用側寫快取 @${cleanUsername}: ${cachedProfileData.profile}`);
        // 通知快取結果
        if (onProfileContentReady) {
          onProfileContentReady({
            success: true,
            profile: cachedProfileData.profile,
            fromCache: true,
            needAnalysis: false
          });
        }
      } else {
        // 步驟 1: 前往回覆頁面取得內容（背景分頁，只能抓第一頁）
        console.log(`[QueryManager] 步驟 1: 前往 @${cleanUsername} 的回覆頁面`);
        const replyUrl = `https://www.threads.com/@${cleanUsername}/replies?hl=zh-tw`;
        queryTab = await chrome.tabs.create({ ...createOptions, url: replyUrl });

        // 等待頁面載入完成
        await new Promise((resolve) => {
          const listener = (tabId, changeInfo) => {
            if (tabId === queryTab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }, 15000);
        });

        // 等待頁面渲染
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 確認 content script 已載入並取得內容
        let contentScriptReady = false;
        for (let i = 0; i < 10; i++) {
          try {
            const pingResponse = await chrome.tabs.sendMessage(queryTab.id, { action: 'ping' });
            if (pingResponse && pingResponse.success) {
              contentScriptReady = true;
              break;
            }
          } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        if (contentScriptReady) {
          // 執行隨機捲動以載入更多內容
          await performRandomScrolls(queryTab.id);

          const replyResponse = await chrome.tabs.sendMessage(queryTab.id, { action: 'extractPageText' });
          if (replyResponse && replyResponse.success) {
            userReplyContent = replyResponse.text;
            console.log(`[QueryManager] 取得回覆內容，長度: ${userReplyContent.length}`);
          }
        }

        // 步驟 2: 導航到貼文頁面取得內容（使用同一個分頁）
        console.log(`[QueryManager] 步驟 2: 導航到 @${cleanUsername} 的貼文頁面`);
        const postUrl = `https://www.threads.com/@${cleanUsername}?hl=zh-tw`;
        await chrome.tabs.update(queryTab.id, { url: postUrl });

        // 等待頁面載入完成
        await new Promise((resolve) => {
          const listener = (tabId, changeInfo) => {
            if (tabId === queryTab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }, 15000);
        });

        // 等待頁面渲染
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 確認 content script 已載入並取得內容
        contentScriptReady = false;
        for (let i = 0; i < 10; i++) {
          try {
            const pingResponse = await chrome.tabs.sendMessage(queryTab.id, { action: 'ping' });
            if (pingResponse && pingResponse.success) {
              contentScriptReady = true;
              break;
            }
          } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        if (contentScriptReady) {
          // 執行隨機捲動以載入更多內容
          await performRandomScrolls(queryTab.id);

          const postResponse = await chrome.tabs.sendMessage(queryTab.id, { action: 'extractPageText' });
          if (postResponse && postResponse.success) {
            userPostContent = postResponse.text;
            console.log(`[QueryManager] 取得貼文內容，長度: ${userPostContent.length}`);
          }
        }

        // 步驟 3: 通知側寫內容已準備好，開始 LLM 分析（非同步，不等待）
        if (userPostContent || userReplyContent) {
          console.log(`[QueryManager] 步驟 3: 通知開始 LLM 分析（非同步）`);
          if (onProfileContentReady) {
            // 非同步呼叫，不等待 LLM 完成
            onProfileContentReady({
              success: true,
              userPostContent: userPostContent,
              userReplyContent: userReplyContent,
              needAnalysis: true
            });
          }
        }

      }
    }

    // ==================== 地點查詢部分 ====================
    // 步驟 4: 導航到英文版個人頁面進行地點查詢
    console.log(`[QueryManager] 步驟 4: 導航到 @${cleanUsername} 的英文版個人頁面查詢地點`);
    const profileUrl = `https://www.threads.com/@${cleanUsername}?hl=en`;

    if (queryTab) {
      // 使用現有分頁
      await chrome.tabs.update(queryTab.id, { url: profileUrl });
    } else {
      // 建立新分頁
      queryTab = await chrome.tabs.create({ ...createOptions, url: profileUrl });
    }

    // 等待頁面載入完成
    await new Promise((resolve) => {
      const listener = (tabId, changeInfo) => {
        if (tabId === queryTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 10000);
    });

    // 等待頁面渲染
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 確認 content script 已載入
    let contentScriptReady = false;
    for (let i = 0; i < 10; i++) {
      try {
        const pingResponse = await chrome.tabs.sendMessage(queryTab.id, { action: 'ping' });
        if (pingResponse && pingResponse.success) {
          contentScriptReady = true;
          break;
        }
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (!contentScriptReady) {
      throw new Error('Content script 未能載入');
    }

    // 在發送查詢請求前，先將狀態記錄為 IN_PROGRESS
    await saveCachedRegion(cleanUsername, null, QUERY_STATUS.IN_PROGRESS);
    console.log(`[QueryManager] 開始查詢 @${cleanUsername}，狀態: IN_PROGRESS`);

    // 發送地點查詢請求
    const response = await chrome.tabs.sendMessage(queryTab.id, {
      action: 'autoQueryRegion',
      account: cleanUsername
    });

    // 處理地點查詢結果
    if (response && response.success) {
      const region = response.region;

      // 根據設定決定是否關閉分頁
      let shouldCloseTab = !shouldKeepTab;
      
      if (shouldKeepTab && keepTabFilter && keepTabFilter.trim() !== '' && region) {
        const regionLower = region.toLowerCase();
        const filterLower = keepTabFilter.trim().toLowerCase();
        
        if (regionLower.includes(filterLower)) {
          shouldCloseTab = true;
          console.log(`[QueryManager] 結果 "${region}" 包含 "${keepTabFilter}"，關閉分頁`);
        } else {
          shouldCloseTab = false;
          console.log(`[QueryManager] 結果 "${region}" 不包含 "${keepTabFilter}"，保留分頁`);
        }
      }

      console.log(`[QueryManager] 查詢成功 @${cleanUsername}: ${region}`);

      // 保存到快取（必須在關閉分頁之前，因為 safeCloseTab 會觸發 refreshRegionLabels）
      // 如果 region 為 null，表示該帳號尚未開放地點功能
      const status = region ? QUERY_STATUS.SUCCESS : QUERY_STATUS.FAIL_NOT_ROLLOUT;
      await saveCachedRegion(cleanUsername, region, status);

      if (shouldCloseTab && queryTab) {
        await safeCloseTab(queryTab.id, originalTabId);
      }

      return {
        success: true,
        region: region,
        status: status,
        fromCache: false
      };
    } else {
      // 檢查是否為 ME_UI_ISSUE 錯誤（自己的帳號）
      if (response && response.error === 'ME_UI_ISSUE') {
        console.log(`[QueryManager] ME_UI_ISSUE 錯誤: ${response.errorMessage}`);
        
        // 保存 FAIL_ME 狀態到快取
        await saveCachedRegion(cleanUsername, null, QUERY_STATUS.FAIL_ME);
        
        // 關閉查詢分頁
        if (queryTab) {
          await safeCloseTab(queryTab.id, originalTabId);
        }
        
        return {
          success: false,
          error: 'ME_UI_ISSUE',
          status: QUERY_STATUS.FAIL_ME,
          errorMessage: response.errorMessage
        };
      }
      
      // 檢查是否為 HTTP 429 錯誤
      if (response && response.error === 'HTTP_429') {
        console.error(`[QueryManager] HTTP 429 錯誤: ${response.errorMessage}`);
        
        // 保存 HTTP 429 狀態到快取
        await saveCachedRegion(cleanUsername, null, QUERY_STATUS.FAIL_HTTP429);
        
        // 根據設定決定是否關閉分頁
        // HTTP 429 錯誤視為查詢失敗，如果有開啟「查詢後保留結果分頁」則保留分頁
        let shouldCloseTab = !shouldKeepTab;
        
        if (shouldKeepTab) {
          console.log(`[QueryManager] HTTP 429 錯誤，但已開啟「查詢後保留結果分頁」，保留分頁`);
        }
        
        // 關閉查詢分頁
        if (shouldCloseTab && queryTab) {
          await safeCloseTab(queryTab.id, originalTabId);
        }
        
        // 通知 sidepanel 顯示錯誤訊息並關閉自動查詢
        try {
          await chrome.runtime.sendMessage({
            action: 'handle429Error',
            errorMessage: response.errorMessage
          });
        } catch (error) {
          console.error('[QueryManager] 無法通知 sidepanel 處理 429 錯誤:', error);
        }
        
        return {
          success: false,
          error: 'HTTP_429',
          status: QUERY_STATUS.FAIL_HTTP429,
          errorMessage: response.errorMessage
        };
      }
      
      // 查詢失敗
      let shouldCloseTab = !shouldKeepTab;
      
      if (shouldKeepTab && keepTabFilter && keepTabFilter.trim() !== '') {
        shouldCloseTab = false;
        console.log(`[QueryManager] 查詢失敗，視為不符合 "${keepTabFilter}"，保留分頁`);
      }

      if (shouldCloseTab && queryTab) {
        await safeCloseTab(queryTab.id, originalTabId);
      }

      return {
        success: false,
        error: response?.error || '未知錯誤'
      };
    }

  } catch (error) {
    // 檢查是否為 Content script 未能載入錯誤（可能是 HTTP 429）
    const isContentScriptError = error.message && error.message.includes('Content script 未能載入');
    
    if (isContentScriptError) {
      console.error(`[QueryManager] Content script 未能載入，可能是 HTTP 429 錯誤 @${cleanUsername}`);
      
      // 保存 HTTP 429 狀態到快取
      await saveCachedRegion(cleanUsername, null, QUERY_STATUS.FAIL_HTTP429);
      
      // 關閉查詢分頁
      if (queryTab) {
        await safeCloseTab(queryTab.id, originalTabId);
      }
      
      // 通知 sidepanel 顯示錯誤訊息並關閉自動查詢
      try {
        await chrome.runtime.sendMessage({
          action: 'handle429Error',
          errorMessage: '已經超過查詢用量上限'
        });
      } catch (msgError) {
        console.error('[QueryManager] 無法通知 sidepanel 處理 429 錯誤:', msgError);
      }
      
      return {
        success: false,
        error: 'HTTP_429',
        status: QUERY_STATUS.FAIL_HTTP429,
        errorMessage: '已經超過查詢用量上限'
      };
    }
    
    // 其他錯誤，清理分頁
    let shouldCloseTab = !shouldKeepTab;
    
    if (shouldKeepTab && keepTabFilter && keepTabFilter.trim() !== '') {
      shouldCloseTab = false;
    }

    if (shouldCloseTab && queryTab) {
      await safeCloseTab(queryTab.id, originalTabId);
    }

    console.error(`[QueryManager] 整合查詢失敗 @${cleanUsername}:`, error.message);
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
  activeQueries.add(task.username); // 記錄正在執行的用戶

  console.log(`[QueryManager] 開始處理任務 @${task.username} (同時開啟 tab 數: ${activeQueryCount}/${queueJobMax}, Queue 剩餘: ${queryQueue.length})`);

  try {
    let result;
    if (task.isIntegrated) {
      // 整合查詢（側寫分析 + 地點查詢）
      result = await executeIntegratedQuery(
        task.username,
        task.enableProfileAnalysis,
        task.shouldKeepTab,
        task.keepTabFilter,
        task.onProfileContentReady
      );
    } else {
      // 一般查詢（只有地點查詢）
      result = await executeQuery(task.username, task.shouldKeepTab, task.keepTabFilter);
    }
    task.resolve(result);
  } catch (error) {
    task.reject(error);
  } finally {
    activeQueryCount--;
    activeQueries.delete(task.username); // 移除已完成的用戶
    console.log(`[QueryManager] 任務完成 @${task.username} (進行中: ${activeQueryCount}/${queueJobMax}, 隊列剩餘: ${queryQueue.length})`);

    // 任務完成後，等待隨機延遲再處理下一個任務（避免查詢過於頻繁）
    if (queryQueue.length > 0) {
      const delay = Math.floor(Math.random() * (QUERY_DELAY_MAX - QUERY_DELAY_MIN + 1)) + QUERY_DELAY_MIN;
      console.log(`[QueryManager] 等待 ${delay}ms 後處理下一個任務`);
      setTimeout(() => {
        processQueryQueue();
      }, delay);
    }
  }
}

/**
 * 添加查詢任務到隊列
 * @param {string} username - 用戶帳號
 * @param {boolean} shouldKeepTab - 是否保留查詢分頁
 * @param {string} keepTabFilter - 保留分頁的過濾條件
 * @param {boolean} isPriority - 是否為優先任務（手動查詢或重新查詢）
 * @returns {Promise<{success: boolean, region?: string, error?: string}>|null} 返回 null 表示無法加入隊列
 */
function addToQueryQueue(username, shouldKeepTab = false, keepTabFilter = '', isPriority = false) {
  // 檢查隊列是否已滿
  if (queryQueue.length >= queryQueueMax) {
    if (isPriority) {
      // 優先任務：移除隊列最後一個任務，插隊到下一個執行位置
      const removedTask = queryQueue.pop();
      console.log(`[QueryManager] 隊列已滿，優先任務 @${username} 插隊，移除最後任務 @${removedTask.username}`);
      
      // 通知被移除的任務失敗
      removedTask.reject(new Error('隊列已滿，被優先任務替換'));
    } else {
      console.log(`[QueryManager] 隊列已滿 (${queryQueue.length}/${queryQueueMax})，拒絕加入 @${username}`);
      return null;
    }
  }

  // 檢查是否已在隊列中（避免重複）
  const isAlreadyInQueue = queryQueue.some(task => task.username === username);
  if (isAlreadyInQueue) {
    console.log(`[QueryManager] @${username} 已在隊列中，跳過重複加入`);
    return null;
  }

  // 檢查是否正在執行中（避免重複）
  if (activeQueries.has(username)) {
    console.log(`[QueryManager] @${username} 正在查詢中，跳過重複加入`);
    return null;
  }

  return new Promise((resolve, reject) => {
    const task = {
      username,
      isIntegrated: false,
      shouldKeepTab,
      keepTabFilter,
      resolve,
      reject
    };

    if (isPriority) {
      // 優先任務插入到隊列開頭（下一個執行位置）
      queryQueue.unshift(task);
      console.log(`[QueryManager] 優先任務已插隊到隊列開頭 @${username} (隊列長度: ${queryQueue.length}/${queryQueueMax})`);
    } else {
      // 一般任務加入到隊列末尾
      queryQueue.push(task);
      console.log(`[QueryManager] 任務已加入隊列 @${username} (隊列長度: ${queryQueue.length}/${queryQueueMax})`);
    }

    // 嘗試立即開始處理隊列
    processQueryQueue();
  });
}

/**
 * 添加整合查詢任務到隊列（側寫分析 + 地點查詢）
 * @param {string} username - 用戶帳號
 * @param {boolean} enableProfileAnalysis - 是否啟用側寫分析
 * @param {boolean} shouldKeepTab - 是否保留查詢分頁
 * @param {string} keepTabFilter - 保留分頁的過濾條件
 * @param {function} onProfileContentReady - 當側寫內容準備好時的回調
 * @param {boolean} isPriority - 是否為優先任務（手動查詢或重新查詢）
 * @returns {Promise<{success: boolean, region?: string, error?: string}>|null} 返回 null 表示無法加入隊列
 */
function addToIntegratedQueryQueue(username, enableProfileAnalysis = false, shouldKeepTab = false, keepTabFilter = '', onProfileContentReady = null, isPriority = false) {
  // 檢查隊列是否已滿
  if (queryQueue.length >= queryQueueMax) {
    if (isPriority) {
      // 優先任務：移除隊列最後一個任務，插隊到下一個執行位置
      const removedTask = queryQueue.pop();
      console.log(`[QueryManager] 隊列已滿，優先任務 @${username} 插隊，移除最後任務 @${removedTask.username}`);
      
      // 通知被移除的任務失敗
      removedTask.reject(new Error('隊列已滿，被優先任務替換'));
    } else {
      console.log(`[QueryManager] 隊列已滿 (${queryQueue.length}/${queryQueueMax})，拒絕加入 @${username}`);
      return null;
    }
  }

  // 檢查是否已在隊列中（避免重複）
  const isAlreadyInQueue = queryQueue.some(task => task.username === username);
  if (isAlreadyInQueue) {
    console.log(`[QueryManager] @${username} 已在隊列中，跳過重複加入`);
    return null;
  }

  // 檢查是否正在執行中（避免重複）
  if (activeQueries.has(username)) {
    console.log(`[QueryManager] @${username} 正在查詢中，跳過重複加入`);
    return null;
  }

  return new Promise((resolve, reject) => {
    const task = {
      username,
      isIntegrated: true,
      enableProfileAnalysis,
      shouldKeepTab,
      keepTabFilter,
      onProfileContentReady,
      resolve,
      reject
    };

    if (isPriority) {
      // 優先任務插入到隊列開頭（下一個執行位置）
      queryQueue.unshift(task);
      console.log(`[QueryManager] 手動查詢任務已插隊到隊列開頭 @${username} (Queue 剩餘: ${queryQueue.length}/${queryQueueMax})`);
    } else {
      // 一般任務加入到隊列末尾
      queryQueue.push(task);
      console.log(`[QueryManager] 自動查詢任務已加入隊尾 @${username} (Queue 剩餘: ${queryQueue.length}/${queryQueueMax})`);
    }

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
 * @param {boolean} isPriority - 是否為優先任務（手動查詢或重新查詢，可選，默認 false）
 * @returns {Promise<{success: boolean, region?: string, error?: string, fromCache?: boolean}>}
 */
async function queryUserRegion(username, shouldKeepTab = null, forceRefresh = false, isPriority = false) {
  // 移除 @ 符號（如果有的話）
  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

  // 如果不是強制刷新，先檢查快取
  if (!forceRefresh) {
    const cachedData = await getCachedRegion(cleanUsername);
    if (cachedData.region !== null || cachedData.status !== null) {
      console.log(`[QueryManager] 使用快取數據 @${cleanUsername}: ${cachedData.region}, status: ${cachedData.status}`);
      return {
        success: cachedData.status === QUERY_STATUS.SUCCESS,
        region: cachedData.region,
        status: cachedData.status,
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
  // 強制刷新視為優先任務
  const finalIsPriority = isPriority || forceRefresh;
  console.log(`[QueryManager] 查詢參數: shouldKeepTab=${shouldKeepTab}, keepTabFilter="${keepTabFilter}", isPriority=${finalIsPriority}`);
  const queueResult = addToQueryQueue(cleanUsername, shouldKeepTab, keepTabFilter, finalIsPriority);
  
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

/**
 * 清空查詢隊列（當側邊欄關閉時調用）
 * @returns {Object} 清理結果 { clearedCount: number }
 */
function clearQueryQueue() {
  const clearedCount = queryQueue.length;
  
  // 通知所有待處理的任務被取消
  queryQueue.forEach(task => {
    task.reject(new Error('側邊欄已關閉，查詢已取消'));
  });
  
  // 清空隊列
  queryQueue = [];
  
  console.log(`[QueryManager] 已清空查詢隊列，取消 ${clearedCount} 個待處理任務`);
  
  return { clearedCount };
}

// ==================== 導出 ====================
export {
  QUERY_STATUS,
  queryUserRegion,
  getQueueStatus,
  clearQueryQueue,
  getCachedRegion,
  getAllCachedRegions,
  saveCachedRegion,
  clearCache,
  removeUserCache,
  getCacheStats,
  updateMaxConcurrent,
  executeIntegratedQuery,
  addToIntegratedQueryQueue,
  getCachedProfile,
  saveCachedProfile,
  getAllCachedProfiles,
  clearProfileCache,
  getProfileCacheStats,
  removeUserProfileCache
};
