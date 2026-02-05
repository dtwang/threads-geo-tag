// 獲取 DOM 元素
const accountInput = document.getElementById('accountInput');
const keepTabCheckbox = document.getElementById('keepTabCheckbox');
const keepTabFilterContainer = document.getElementById('keepTabFilterContainer');
const keepTabFilterInput = document.getElementById('keepTabFilterInput');
const autoQueryModeCheckbox = document.getElementById('autoQueryModeCheckbox');
const maxConcurrentContainer = document.getElementById('maxConcurrentContainer');
const maxConcurrentInput = document.getElementById('maxConcurrentInput');
const llmProfileAnalysisCheckbox = document.getElementById('llmProfileAnalysisCheckbox');
const manualDetectBtn = document.getElementById('manualDetectBtn');
const contentOutput = document.getElementById('contentOutput');
const statusBar = document.getElementById('statusBar');
const userCountElement = document.getElementById('userCount');
const progressLabel = document.getElementById('progressLabel');
const queryProgress = document.getElementById('queryProgress');
const cacheCountElement = document.getElementById('cacheCount');
const profileCacheCountElement = document.getElementById('profileCacheCount');
const trustListCountElement = document.getElementById('trustListCount');
const clearAllCacheBtn = document.getElementById('clearAllCacheBtn');
const exportCacheBtn = document.getElementById('exportCacheBtn');
const openaiApiKeyInput = document.getElementById('openaiApiKeyInput');
const apiKeyStatus = document.getElementById('apiKeyStatus');
const apiKeySetIndicator = document.getElementById('apiKeySetIndicator');
const apiKeyInputContainer = document.getElementById('apiKeyInputContainer');
const editApiKeyBtn = document.getElementById('editApiKeyBtn');
const clearApiKeyBtn = document.getElementById('clearApiKeyBtn');
const claudeApiKeyInput = document.getElementById('claudeApiKeyInput');
const claudeApiKeyStatus = document.getElementById('claudeApiKeyStatus');
const claudeApiKeySetIndicator = document.getElementById('claudeApiKeySetIndicator');
const claudeApiKeyInputContainer = document.getElementById('claudeApiKeyInputContainer');
const editClaudeApiKeyBtn = document.getElementById('editClaudeApiKeyBtn');
const clearClaudeApiKeyBtn = document.getElementById('clearClaudeApiKeyBtn');
const llmProviderSection = document.getElementById('llmProviderSection');
const llmProviderSelect = document.getElementById('llmProviderSelect');
const openaiConfigPanel = document.getElementById('openaiConfigPanel');
const claudeConfigPanel = document.getElementById('claudeConfigPanel');
const openrouterConfigPanel = document.getElementById('openrouterConfigPanel');
const localLLMConfigPanel = document.getElementById('localLLMConfigPanel');
const localLLMStatus = document.getElementById('localLLMStatus');
const openrouterApiKeyInput = document.getElementById('openrouterApiKeyInput');
const openrouterApiKeyStatus = document.getElementById('openrouterApiKeyStatus');
const openrouterApiKeySetIndicator = document.getElementById('openrouterApiKeySetIndicator');
const openrouterApiKeyInputContainer = document.getElementById('openrouterApiKeyInputContainer');
const editOpenrouterApiKeyBtn = document.getElementById('editOpenrouterApiKeyBtn');
const clearOpenrouterApiKeyBtn = document.getElementById('clearOpenrouterApiKeyBtn');
const openrouterModelInput = document.getElementById('openrouterModelInput');
const openrouterModelStatus = document.getElementById('openrouterModelStatus');

// ==================== 全局變數說明 ====================
/**
 * currentGetUserListArray: 保存用戶列表及其查詢結果
 *
 * 【資料結構】
 * [
 *   {
 *     account: "@username",  // 用戶帳號（帶 @ 符號）
 *     region: null,          // 所在地區（null = 尚未查詢，字串 = 已查詢結果）
 *     profile: null          // 用戶側寫標籤（null = 尚未分析，字串 = 已分析結果）
 *   },
 *   ...
 * ]
 *
 * 【作用】
 * 1. 保存所有偵測到的用戶帳號列表
 * 2. 記錄每個用戶的查詢狀態（region 為 null 表示未查詢）
 * 3. 儲存查詢結果（Taiwan、China、未揭露等）
 * 4. 用於在 sidepanel UI 上顯示查詢結果
 * 5. 用於生成傳遞給 content.js 的 regionData（用於更新頁面標籤顏色）
 *
 * 【更新時機與方式】
 *
 * ■ 方式 1: 從 content.js 接收用戶列表更新（updateLinkList 函數）
 *   觸發時機：
 *   - 頁面滾動（每 2 秒一次）
 *   - Sidepanel 開啟時
 *   - 頁面載入後 5 秒
 *
 *   流程：
 *   1. sidepanel 發送 'listAllUsers' action 到 content.js
 *   2. content.js 返回頁面上所有用戶帳號（只傳 account 名稱，不傳 DOM 元素）
 *   3. sidepanel 收到後更新 currentGetUserListArray：
 *      - 保留已經查詢過的用戶 region 資料（使用 existingDataMap）
 *      - 新用戶的 region 設為 null
 *      - 舊用戶的 region 保留原值
 *
 * ■ 方式 2: 手動查詢按鈕更新（從 content.js 的查詢按鈕觸發）
 *   觸發時機：
 *   - 用戶點擊頁面上標籤中的 [查詢] 按鈕
 *
 *   流程：
 *   1. content.js 的查詢按鈕被點擊
 *   2. content.js 發送 'manualQueryRegion' action 到 background.js
 *   3. background.js 開啟新分頁並執行自動查詢
 *   4. 查詢完成後，content.js 發送 'updateUserRegion' action 到 sidepanel
 *   5. sidepanel 接收後更新對應用戶的 region：
 *      currentGetUserListArray[userIndex].region = region
 *
 * ■ 方式 3: 自動查詢更新（從 content.js 的自動查詢觸發）
 *   觸發時機：
 *   - 啟用「自動查詢頁面中用戶所在地點」選項
 *   - 頁面滾動停止 1 秒後
 *   - 自動點擊可見範圍內待查詢用戶的 [查詢] 按鈕
 *
 *   流程：與方式 2 相同（最終都是透過查詢按鈕觸發）
 *
 * 【與 content.js 的關係】
 * - content.js 的 currentUserElementsData 包含 DOM 元素引用
 * - sidepanel.js 的 currentGetUserListArray 不包含 DOM 元素（無法通過 message passing 傳遞）
 * - 兩者透過 account 名稱進行對應
 * - content.js → sidepanel: 傳遞 account 列表
 * - content.js → sidepanel: 傳遞查詢結果（account + region）
 * - sidepanel → content.js: 傳遞 regionData（用於更新標籤顏色）
 *
 * 【資料流向圖】
 * 頁面滾動 → content.js 偵測用戶 → 傳送 account 列表 → sidepanel 更新陣列
 *                                                              ↓
 * 用戶點擊 [查詢] → background 執行查詢 → 返回 region → sidepanel 更新 region
 *                                                              ↓
 * sidepanel 呼叫 showRegionLabels() → 傳送 regionData → content.js 更新標籤顏色
 */
let currentGetUserListArray = [];
let isAutoQuerying = false;
let shouldStopAutoQuery = false;

// 更新狀態欄的輔助函數
function updateStatus(message, type = 'info') {
  if (!statusBar) return; // 防止 DOM 未載入時報錯
  statusBar.textContent = message;
  statusBar.className = 'status-bar';
  if (type === 'error') {
    statusBar.classList.add('error');
  } else if (type === 'success') {
    statusBar.classList.add('success');
  }
}


// 更新用戶數量顯示的輔助函數
function updateUserCount() {
  if (!userCountElement) return;
  const count = currentGetUserListArray.length;
  userCountElement.textContent = count;
}

// 更新快取統計顯示的輔助函數
async function updateCacheStats() {
  if (!cacheCountElement) return;
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCacheStats'
    });

    if (response && response.success && response.stats) {
      const validCount = response.stats.validCount || 0;
      const totalCount = response.stats.totalCount || 0;
      const expiredCount = response.stats.expiredCount || 0;

      cacheCountElement.textContent = validCount;

      /*
      console.log(`[Sidepanel] 快取統計更新:`, {
        validCount: validCount,
        totalCount: totalCount,
        expiredCount: expiredCount,
        expiryDays: response.stats.expiryDays
      });
      */
      // 如果有過期的快取，在控制台提示
      if (expiredCount > 0) {
        console.warn(`[Sidepanel] 發現 ${expiredCount} 個已過期的快取記錄`);
      }
    } else {
      cacheCountElement.textContent = '0';
      console.warn('[Sidepanel] 獲取快取統計失敗，響應:', response);
    }
  } catch (error) {
    console.error('[Sidepanel] 獲取快取統計失敗:', error);
    cacheCountElement.textContent = '0';
  }
}

// 更新查詢進度顯示
function updateQueryProgress(current, total) {
  if (!progressLabel || !queryProgress) return;
  if (total > 0) {
    progressLabel.style.display = 'inline';
    queryProgress.textContent = `${current}/${total}`;
  } else {
    progressLabel.style.display = 'none';
  }
}

// 更新側寫快取統計顯示的輔助函數
async function updateProfileCacheStats() {
  if (!profileCacheCountElement) return;
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getProfileCacheStats'
    });

    if (response && response.success && response.stats) {
      const validCount = response.stats.validCount || 0;
      const totalCount = response.stats.totalCount || 0;
      const expiredCount = response.stats.expiredCount || 0;

      profileCacheCountElement.textContent = validCount;

      /*
      console.log(`[Sidepanel] 側寫快取統計更新:`, {
        validCount: validCount,
        totalCount: totalCount,
        expiredCount: expiredCount,
        expiryDays: response.stats.expiryDays
      });
      */
      if (expiredCount > 0) {
        console.warn(`[Sidepanel] 發現 ${expiredCount} 個已過期的側寫快取記錄`);
      }    } else {
      profileCacheCountElement.textContent = '0';
      console.warn('[Sidepanel] 獲取側寫快取統計失敗，響應:', response);
    }
  } catch (error) {
    console.error('[Sidepanel] 獲取側寫快取統計失敗:', error);
    profileCacheCountElement.textContent = '0';
  }
}

// 更新手動信任清單統計顯示的輔助函數
async function updateTrustListStats() {
  if (!trustListCountElement) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes('threads.com')) {
      trustListCountElement.textContent = '0';
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getTrustListStats'
    });

    if (response && response.success) {
      trustListCountElement.textContent = response.count || 0;
    } else {
      trustListCountElement.textContent = '0';
    }
  } catch (error) {
    console.error('[Sidepanel] 獲取手動信任清單統計失敗:', error);
    trustListCountElement.textContent = '0';
  }
}


// ==================== 查詢函數 ====================

/**
 * 查詢單一帳號的所在區域
 * 通過消息傳遞調用 background.js 的查詢管理器
 * @param {string} username - 用戶帳號
 * @param {boolean} shouldKeepTab - 是否保留查詢分頁
 * @returns {Promise<{success: boolean, region?: string, error?: string}>}
 */
async function queryUserRegion(username, shouldKeepTab = null) {
  try {
    // 移除 @ 符號（如果有的話）
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

    updateStatus(`正在查詢 @${cleanUsername} 的所在區域...`, 'info');

    // 如果未指定 shouldKeepTab，從 checkbox 讀取
    if (shouldKeepTab === null) {
      shouldKeepTab = keepTabCheckbox.checked;
    }

    // 發送消息到 background.js 執行查詢
    const result = await chrome.runtime.sendMessage({
      action: 'queryUserRegion',
      username: cleanUsername,
      shouldKeepTab: shouldKeepTab
    });

    // 查詢完成後（無論成功或失敗），更新快取統計
    if (result && result.success) {
      console.log(`[Sidepanel] 查詢成功，更新快取統計 (fromCache: ${result.fromCache})`);
      // 等待一小段時間確保快取已保存
      setTimeout(() => {
        updateCacheStats();
      }, 100);
    }

    return result;
  } catch (error) {
    console.error('[Sidepanel] 查詢錯誤:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 防抖計時器，避免 showRegionLabels 被頻繁調用
let showRegionLabelsDebounceTimer = null;
let showRegionLabelsPromiseResolve = null;

/**
 * 顯示地區標籤（帶防抖機制）
 * 避免短時間內重複發送大量 getCachedRegion/getCachedProfile 訊息
 */
async function showRegionLabels() {
  // 如果已有計時器在等待，取消它並使用新的調用
  if (showRegionLabelsDebounceTimer) {
    clearTimeout(showRegionLabelsDebounceTimer);
  }

  // 返回一個 Promise，在防抖延遲後執行實際邏輯
  return new Promise((resolve) => {
    showRegionLabelsPromiseResolve = resolve;
    showRegionLabelsDebounceTimer = setTimeout(async () => {
      showRegionLabelsDebounceTimer = null;
      const result = await showRegionLabelsInternal();
      if (showRegionLabelsPromiseResolve) {
        showRegionLabelsPromiseResolve(result);
        showRegionLabelsPromiseResolve = null;
      }
    }, 200); // 200ms 防抖延遲
  });
}

async function showRegionLabelsInternal() {

  if (currentGetUserListArray.length === 0) {
    updateStatus('等待頁面載入中...', 'info');
    return;
  }

  try {
    updateStatus('正在頁面上顯示用戶資訊標籤...', 'info');

    // 獲取當前活動標籤頁
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      updateStatus('錯誤: 無法找到活動標籤頁', 'error');
      return;
    }

    // 準備地區資料，格式: { "@username": { region: "Taiwan", profile: "標籤1,標籤2" }, ... }
    // 優先使用 user.region/profile，若無則查詢快取
    // 重要：只有在拿到完整資料（地點+側寫）後才加入 regionData，否則保持黃色待查詢狀態
    const regionData = {};
    for (const user of currentGetUserListArray) {
      let region = null;
      let profile = null;

      // 處理 region
      if (user.region) {
        region = user.region;
      } else {
        // 從快取中查詢（去掉 @ 符號）
        const username = user.account.replace(/^@/, '');
        try {
          const regionResponse = await chrome.runtime.sendMessage({
            action: 'getCachedRegion',
            username: username
          });
          if (regionResponse && regionResponse.success) {
            region = regionResponse.region;
            user.region = regionResponse.region; // 同步更新 user 物件
            user.regionQueryStatus = regionResponse.status; // 同步更新查詢狀態
          }
        } catch (error) {
          console.log(`[Sidepanel] 讀取地區快取失敗 ${username}:`, error);
        }
      }

      // 處理 profile
      if (user.profile !== undefined && user.profile !== null) {
        profile = user.profile;
      } else {
        // 從快取中查詢（去掉 @ 符號）
        const username = user.account.replace(/^@/, '');
        try {
          const response = await chrome.runtime.sendMessage({
            action: 'getCachedProfile',
            username: username
          });
          if (response && response.success && response.profile) {
            profile = response.profile;
            user.profile = response.profile; // 同步更新 user 物件
          }
        } catch (error) {
          console.log(`[Sidepanel] 讀取側寫快取失敗 ${username}:`, error);
        }
      }

      // 只要有地點或側寫其中之一，就加入 regionData
      // 這樣可以正確顯示已查詢到的地點（即使側寫尚未取得或使用者停用側寫功能）
      if (region !== null || profile !== null || user.regionQueryStatus) {
        regionData[user.account] = {
          region: region,
          profile: profile,
          regionQueryStatus: user.regionQueryStatus || null
        };
      }
    }

    // 更新快取統計（因為可能從快取讀取了資料）
    updateCacheStats();
    updateProfileCacheStats();

    // 向 content script 發送顯示標籤請求
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'showRegionLabels',
      regionData: regionData
    });

    if (response && response.success) {
      //updateStatus(`成功顯示標籤 ${response.addedCount}/${response.totalCount}`, 'success');
      contentOutput.value = `已在頁面上顯示用戶資訊標籤\n成功: ${response.addedCount}/${response.totalCount}\n\n提示：\n- 黃色標籤 = 待查詢\n- 綠色標籤 = 已查詢`;
    } else {
      updateStatus(`顯示標籤失敗: ${response?.error || '未知錯誤'}`, 'error');
    }
  } catch (error) {
    updateStatus(`錯誤: ${error.message}`, 'error');
    contentOutput.value = `錯誤: ${error.message}`;
  }
}

/*
// 隱藏用戶資訊標籤按鈕
hideLabelsBtn.addEventListener('click', async () => {
  try {
    updateStatus('正在隱藏用戶資訊標籤...', 'info');

    // 獲取當前活動標籤頁
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      updateStatus('錯誤: 無法找到活動標籤頁', 'error');
      return;
    }

    // 向 content script 發送隱藏標籤請求
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'hideRegionLabels'
    });

    if (response && response.success) {
      updateStatus(`已隱藏 ${response.hiddenCount} 個標籤`, 'success');
      contentOutput.value = `已隱藏頁面上的用戶資訊標籤\n隱藏數量: ${response.hiddenCount}`;
    } else {
      updateStatus(`隱藏標籤失敗: ${response?.error || '未知錯誤'}`, 'error');
    }
  } catch (error) {
    updateStatus(`錯誤: ${error.message}`, 'error');
    contentOutput.value = `錯誤: ${error.message}`;
  }
});

*/
async function updateLinkList()
{
  // 防止 DOM 未載入時報錯
  if (!contentOutput) return;
  
  try {
    //updateStatus('正在取得頁面上所有用戶帳號...', 'info');

    // 獲取當前活動標籤頁
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      updateStatus('錯誤: 無法找到活動標籤頁', 'error');
      return;
    }

    // 向 content script 發送請求
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'listAllUsers'
    });

    if (response && response.success) {
      const users = response.users || [];
      const newCount = response.newCount || 0;
      const totalCount = response.count || users.length;

      if (users.length === 0) {
        contentOutput.value = '未找到任何用戶帳號';
        currentGetUserListArray = [];
        updateUserCount();
        updateStatus('未找到用戶', 'info');
      } else {
        // 保留已經查詢過的用戶資料（內存中的數據，包含 region 和 profile）
        const existingDataMap = new Map();
        currentGetUserListArray.forEach(user => {
          existingDataMap.set(user.account, { region: user.region, profile: user.profile });
        });

        // 從快取中讀取地區和側寫數據
        const cachePromises = users.map(async account => {
          // 先檢查內存中是否有數據
          const existingData = existingDataMap.get(account);
          if (existingData && (existingData.region !== null || existingData.profile !== null)) {
            return { account, region: existingData.region, profile: existingData.profile };
          }

          // 內存中沒有，從快取中讀取
          let region = null;
          let profile = null;

          try {
            const regionResponse = await chrome.runtime.sendMessage({
              action: 'getCachedRegion',
              username: account
            });

            if (regionResponse && regionResponse.success && regionResponse.region) {
              console.log(`[Sidepanel] 從快取載入地區 ${account}: ${regionResponse.region}`);
              region = regionResponse.region;
            }
          } catch (error) {
            console.error(`[Sidepanel] 讀取地區快取失敗 ${account}:`, error);
          }

          try {
            const profileResponse = await chrome.runtime.sendMessage({
              action: 'getCachedProfile',
              username: account
            });

            if (profileResponse && profileResponse.success && profileResponse.profile) {
              console.log(`[Sidepanel] 從快取載入側寫 ${account}: ${profileResponse.profile}`);
              profile = profileResponse.profile;
            }
          } catch (error) {
            console.error(`[Sidepanel] 讀取側寫快取失敗 ${account}:`, error);
          }

          return { account, region, profile };
        });

        // 等待所有快取讀取完成
        const usersWithRegion = await Promise.all(cachePromises);

        // 將用戶列表轉換為物件結構 { account, region }
        currentGetUserListArray = usersWithRegion;

        const summary = newCount > 0
          ? `總共 ${totalCount} 個用戶帳號 (新增 ${newCount} 個):\n\n`
          : `總共 ${totalCount} 個用戶帳號:\n\n`;

        contentOutput.value = summary + usersWithRegion.map((user, index) => {
          return user.region ? `[${index}] ${user.account} - ${user.region}` : `[${index}] ${user.account}`;
        }).join('\n');

        updateUserCount();
        updateQueryProgress(0, 0); // 重置進度
        updateCacheStats(); // 更新快取統計
        updateProfileCacheStats(); // 更新側寫快取統計

        if (newCount > 0) {
          //updateStatus(`找到 ${totalCount} 個用戶 (新增 ${newCount} 個)`, 'success');
        } else {
          //updateStatus(`找到 ${totalCount} 個用戶 (無新增)`, 'info');
        }
      }
    } else {
      contentOutput.value = `查詢失敗: ${response?.error || '未知錯誤'}`;
      updateStatus('查詢失敗', 'error');
    }
  } catch (error) {
    updateStatus(`錯誤: ${error.message}`, 'error');
    contentOutput.value = `錯誤: ${error.message}`;
  }
}
// 監聽來自 content script 的滾動事件和查詢結果更新
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 處理頁面滾動事件
  if (request.action === 'pageScrolled') {
    console.log('[Sidepanel] 收到頁面滾動通知，更新用戶列表');
    // 使用 async IIFE 確保 updateLinkList 完成後再執行 showRegionLabels
    (async () => {
      await updateLinkList();
      await showRegionLabels();
      sendResponse({ success: true });
    })();
    return true; // 保持消息通道開啟以進行異步響應
  }

  // 處理 sidepanel 狀態欄更新
  if (request.action === 'updateSidepanelStatus') {
    const { message, type } = request;
    console.log(`[Sidepanel] 收到狀態更新: ${message}`);
    updateStatus(message, type || 'info');
    sendResponse({ success: true });
    return true;
  }

  // 處理用戶地區查詢結果更新
  if (request.action === 'updateUserRegion') {
    const { account, region } = request;
    console.log(`[Sidepanel] 收到查詢結果更新: ${account} - ${region}`);

    // 在 currentGetUserListArray 中找到所有對應的用戶並更新 region
    let updatedCount = 0;
    currentGetUserListArray.forEach((user, index) => {
      if (user.account === account) {
        currentGetUserListArray[index].region = region;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      console.log(`[Sidepanel] 已更新 ${updatedCount} 個 ${account} 的地區為: ${region}`);

      // 更新顯示
      const completedUsers = currentGetUserListArray.filter(u => u.region !== null);
      const resultText = completedUsers.map(u => `${u.account} - ${u.region || '未找到'}`).join('\n');
      contentOutput.value = `已查詢的用戶 (${completedUsers.length}/${currentGetUserListArray.length}):\n\n${resultText}`;

      // 更新快取統計
      updateCacheStats();

      // 自動刷新標籤顯示（地區更新後，需要更新頁面上的標籤）
      showRegionLabels();

      sendResponse({ success: true, updated: true, count: updatedCount });
    } else {
      console.log(`[Sidepanel] 找不到用戶 ${account}，無法更新`);
      sendResponse({ success: false, error: '找不到用戶' });
    }
    return true;
  }

  // 處理刷新標籤請求（從 queryManager 關閉查詢分頁後觸發）
  if (request.action === 'refreshRegionLabels') {
    console.log(`[Sidepanel] 收到刷新標籤請求`);
    showRegionLabels();
    sendResponse({ success: true });
    return true;
  }

  // 處理獲取用戶側寫請求（從 content.js 查詢）
  if (request.action === 'getUserProfile') {
    const { account } = request;
    console.log(`[Sidepanel] 收到獲取側寫請求: ${account}`);

    // 在 currentGetUserListArray 中找到對應的用戶
    const user = currentGetUserListArray.find(u => u.account === account);
    
    if (user && user.profile) {
      console.log(`[Sidepanel] 找到用戶 ${account} 的側寫: ${user.profile}`);
      sendResponse({ success: true, profile: user.profile });
    } else {
      console.log(`[Sidepanel] 用戶 ${account} 沒有側寫資料`);
      sendResponse({ success: false, profile: null });
    }
    return true;
  }

  // 處理用戶側寫分析結果更新
  if (request.action === 'updateUserProfile') {
    const { account, profile } = request;
    console.log(`[Sidepanel] 收到側寫分析結果更新: ${account} - ${profile}`);

    // 在 currentGetUserListArray 中找到所有對應的用戶並更新 profile
    let updatedCount = 0;
    currentGetUserListArray.forEach((user, index) => {
      if (user.account === account) {
        currentGetUserListArray[index].profile = profile;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      console.log(`[Sidepanel] 已更新 ${updatedCount} 個 ${account} 的側寫為: ${profile}`);
      sendResponse({ success: true, updated: true, count: updatedCount });
    } else {
      console.log(`[Sidepanel] 找不到用戶 ${account}，無法更新側寫`);
      sendResponse({ success: false, error: '找不到用戶' });
    }
  }

  // 處理手動標注清單變更通知
  if (request.action === 'trustListChanged') {
    console.log('[Sidepanel] 收到手動標注清單變更通知，更新統計');
    updateTrustListStats();
    sendResponse({ success: true });
    return true;
  }

  // 處理側寫分析（從 background.js 的整合查詢觸發）
  if (request.action === 'processProfileAnalysis') {
    const { account, profileData } = request;
    
    console.log(`[Sidepanel] 收到側寫分析請求: ${account}`);

    // 異步執行 LLM 分析（不阻塞地點查詢）
    (async () => {
      try {
        const cleanUsername = account.startsWith('@') ? account.slice(1) : account;

        // 如果是快取結果，直接使用
        if (profileData.fromCache && profileData.profile) {
          console.log(`[Sidepanel] 使用側寫快取 ${account}: ${profileData.profile}`);
          
          // 更新 currentGetUserListArray
          currentGetUserListArray.forEach((user, index) => {
            if (user.account === account) {
              currentGetUserListArray[index].profile = profileData.profile;
            }
          });

          // 刷新標籤顯示
          await showRegionLabels();
          updateStatus(`側寫分析完成: ${account}`, 'success');
          return;
        }

        // 需要進行 LLM 分析
        if (profileData.needAnalysis) {
          console.log(`[Sidepanel] 開始 LLM 分析 ${account}`);
          updateStatus(`正在分析 ${account} 的用戶側寫...`, 'info');
          
          if (typeof window.analyzeUserProfile !== 'function') {
            console.error('[Sidepanel] analyzeUserProfile 函數未載入');
            updateStatus('側寫分析失敗: LLM 函數未載入', 'error');
            return;
          }

          const analysisResult = await window.analyzeUserProfile(
            profileData.userPostContent,
            profileData.userReplyContent,
            account,
            (progress) => {
              updateStatus(`LLM 模型下載中: ${progress}%`, 'info');
            }
          );

          if (analysisResult && analysisResult.success) {
            const profile = analysisResult.tags;
            //console.log(`[Sidepanel] LLM 分析成功 ${account}: ${profile}`);

            // 保存到快取
            await chrome.runtime.sendMessage({
              action: 'saveCachedProfile',
              username: cleanUsername,
              profile: profile
            });

            // 更新側寫快取統計顯示
            await updateProfileCacheStats();

            // 更新 currentGetUserListArray
            currentGetUserListArray.forEach((user, index) => {
              if (user.account === account) {
                currentGetUserListArray[index].profile = profile;
              }
            });

            // 刷新標籤顯示
            await showRegionLabels();
            updateStatus(`側寫分析完成: ${account}`, 'success');
          } else {
            console.log(`[Sidepanel] LLM 分析失敗: ${analysisResult?.error}`);
            updateStatus(`側寫分析失敗: ${analysisResult?.error || '未知錯誤'}`, 'error');
          }
        }
      } catch (error) {
        console.error('[Sidepanel] 側寫分析錯誤:', error);
        updateStatus(`側寫分析錯誤: ${error.message}`, 'error');
      }
    })();

    // 立即回應，不等待 LLM 分析完成
    sendResponse({ success: true, processing: true });
    return false;
  }

  // 處理 HTTP 429 錯誤
  if (request.action === 'handle429Error') {
    const { errorMessage } = request;
    console.log(`[Sidepanel] 收到 HTTP 429 錯誤: ${errorMessage}`);
    
    // 延遲顯示錯誤訊息，確保不會被 showRegionLabels 的訊息蓋過
    // 等待 500ms 讓其他更新完成
    setTimeout(() => {
      updateStatus(errorMessage, 'error');
    }, 500);
    
    // 如果「自動查詢」選項不是關閉狀態，自動關閉它
    if (autoQueryModeCheckbox && autoQueryModeCheckbox.checked) {
      console.log('[Sidepanel] 自動關閉「自動查詢」選項');
      autoQueryModeCheckbox.checked = false;
      
      // 保存到 chrome.storage
      chrome.storage.local.set({ autoQueryMode: 'off' }, () => {
        console.log('[Sidepanel] 已關閉自動查詢設定');
      });
      
      // 隱藏最大並行查詢數輸入框
      if (maxConcurrentContainer) {
        maxConcurrentContainer.style.display = 'none';
      }
    }
    
    sendResponse({ success: true });
    return true;
  }

  return true;
});

// ==================== Checkbox 狀態管理 ====================

// 初始化：從 chrome.storage 讀取 checkbox 狀態
chrome.storage.local.get(['keepTabAfterQuery', 'keepTabFilter', 'autoQueryMode', 'autoQueryVisible', 'maxConcurrentQueries', 'llmProfileAnalysis'], (result) => {
  if (result.keepTabAfterQuery !== undefined) {
    keepTabCheckbox.checked = result.keepTabAfterQuery;
    // 根據 checkbox 狀態顯示/隱藏過濾條件輸入框
    keepTabFilterContainer.style.display = result.keepTabAfterQuery ? 'block' : 'none';
    console.log('[Sidepanel] 載入保留分頁設定:', result.keepTabAfterQuery);
  }
  if (result.keepTabFilter !== undefined) {
    keepTabFilterInput.value = result.keepTabFilter;
    console.log('[Sidepanel] 載入保留分頁過濾條件:', result.keepTabFilter);
  } else {
    // 如果 storage 中沒有設定，使用預設值並儲存
    const defaultFilter = keepTabFilterInput.value || 'Taiwan';
    chrome.storage.local.set({ keepTabFilter: defaultFilter }, () => {
      console.log('[Sidepanel] 初始化保留分頁過濾條件預設值:', defaultFilter);
    });
  }
  
  // 處理自動查詢模式設定（支援從舊版 autoQueryVisible 遷移）
  if (result.autoQueryMode !== undefined) {
    autoQueryModeCheckbox.checked = (result.autoQueryMode === 'smart');
    console.log('[Sidepanel] 載入自動查詢模式設定:', result.autoQueryMode);
  } else if (result.autoQueryVisible !== undefined) {
    // 從舊版設定遷移：autoQueryVisible: true 對應到 'smart' 模式
    autoQueryModeCheckbox.checked = result.autoQueryVisible;
    const migratedMode = result.autoQueryVisible ? 'smart' : 'off';
    // 保存新格式並移除舊設定
    chrome.storage.local.set({ autoQueryMode: migratedMode }, () => {
      console.log('[Sidepanel] 從舊版遷移自動查詢設定:', migratedMode);
    });
    chrome.storage.local.remove('autoQueryVisible');
  } else {
    // 預設為 smart 模式
    autoQueryModeCheckbox.checked = true;
    // 保存預設值到 storage
    chrome.storage.local.set({ autoQueryMode: 'smart' }, () => {
      console.log('[Sidepanel] 初始化自動查詢模式預設值: smart');
    });
  }
  
  // 根據自動查詢模式顯示/隱藏最大並行查詢數輸入框
  maxConcurrentContainer.style.display = autoQueryModeCheckbox.checked ? 'block' : 'none';
  
  if (result.maxConcurrentQueries !== undefined) {
    maxConcurrentInput.value = result.maxConcurrentQueries;
    console.log('[Sidepanel] 載入最大並行查詢數設定:', result.maxConcurrentQueries);
  }
  if (result.llmProfileAnalysis !== undefined) {
    llmProfileAnalysisCheckbox.checked = result.llmProfileAnalysis;
    console.log('[Sidepanel] 載入用戶側寫分析設定:', result.llmProfileAnalysis);
  }
});


// 監聽 keepTabCheckbox 變化，保存到 chrome.storage
keepTabCheckbox.addEventListener('change', () => {
  const isChecked = keepTabCheckbox.checked;
  chrome.storage.local.set({ keepTabAfterQuery: isChecked }, () => {
    console.log('[Sidepanel] 保存保留分頁設定:', isChecked);
  });
  // 顯示/隱藏過濾條件輸入框
  keepTabFilterContainer.style.display = isChecked ? 'block' : 'none';
});

// 監聽 keepTabFilterInput 變化，保存到 chrome.storage
keepTabFilterInput.addEventListener('change', () => {
  const filterValue = keepTabFilterInput.value;
  chrome.storage.local.set({ keepTabFilter: filterValue }, () => {
    console.log('[Sidepanel] 保存保留分頁過濾條件:', filterValue);
  });
});

// 監聽 autoQueryModeCheckbox 變化，保存到 chrome.storage
autoQueryModeCheckbox.addEventListener('change', () => {
  const mode = autoQueryModeCheckbox.checked ? 'smart' : 'off';
  chrome.storage.local.set({ autoQueryMode: mode }, () => {
    console.log('[Sidepanel] 保存自動查詢模式設定:', mode);
  });
  // 顯示/隱藏最大並行查詢數輸入框（只有在啟用時顯示）
  maxConcurrentContainer.style.display = autoQueryModeCheckbox.checked ? 'block' : 'none';
});

// 監聽 maxConcurrentInput 變化，保存到 chrome.storage 並通知 background 更新 queryManager
maxConcurrentInput.addEventListener('change', async () => {
  let value = parseInt(maxConcurrentInput.value, 10);
  
  // 限制範圍 1-10
  if (isNaN(value) || value < 1) value = 1;
  if (value > 10) value = 10;
  maxConcurrentInput.value = value;
  
  // 保存到 storage
  chrome.storage.local.set({ maxConcurrentQueries: value }, () => {
    console.log('[Sidepanel] 保存最大並行查詢數設定:', value);
  });
  
  // 通知 background.js 更新 queryManager 的設定
  try {
    await chrome.runtime.sendMessage({
      action: 'updateMaxConcurrent',
      value: value
    });
    console.log('[Sidepanel] 已通知 background 更新最大並行查詢數:', value);
  } catch (error) {
    console.error('[Sidepanel] 通知 background 失敗:', error);
  }
});

// 更新 LLM Provider UI 顯示狀態
function updateLLMProviderUI() {
  const isChecked = llmProfileAnalysisCheckbox.checked;
  
  if (!isChecked) {
    // 未啟用分析功能：隱藏整個 provider 選擇區域
    llmProviderSection.style.display = 'none';
    return;
  }
  
  // 啟用分析功能：顯示 provider 選擇區域
  llmProviderSection.style.display = 'block';
  
  // 根據選擇的 provider 顯示對應的配置面板
  const provider = llmProviderSelect.value;
  
  if (provider === 'local') {
    openaiConfigPanel.style.display = 'none';
    claudeConfigPanel.style.display = 'none';
    openrouterConfigPanel.style.display = 'none';
    localLLMConfigPanel.style.display = 'block';
    // 檢查本地 LLM 可用性
    checkLocalLLMAvailability();
  } else if (provider === 'claude') {
    openaiConfigPanel.style.display = 'none';
    claudeConfigPanel.style.display = 'block';
    openrouterConfigPanel.style.display = 'none';
    localLLMConfigPanel.style.display = 'none';
  } else if (provider === 'openrouter') {
    openaiConfigPanel.style.display = 'none';
    claudeConfigPanel.style.display = 'none';
    openrouterConfigPanel.style.display = 'block';
    localLLMConfigPanel.style.display = 'none';
  } else {
    openaiConfigPanel.style.display = 'block';
    claudeConfigPanel.style.display = 'none';
    openrouterConfigPanel.style.display = 'none';
    localLLMConfigPanel.style.display = 'none';
  }
}

// 檢查本地 LLM 可用性
async function checkLocalLLMAvailability() {
  localLLMStatus.className = 'local-llm-status checking';
  localLLMStatus.textContent = '檢查中...';
  
  try {
    if (typeof window.checkLLMAvailability !== 'function') {
      throw new Error('LLM 檢查函數未載入');
    }
    
    const result = await window.checkLLMAvailability();
    
    if (result.available) {
      localLLMStatus.className = 'local-llm-status available';
      if (result.status === 'downloading') {
        localLLMStatus.textContent = '✓ 可用（模型下載中）';
      } else if (result.status === 'downloadable') {
        localLLMStatus.textContent = '✓ 可用（首次使用需下載模型）';
      } else {
        localLLMStatus.textContent = '✓ 可用';
      }
    } else {
      localLLMStatus.className = 'local-llm-status unavailable';
      let errorMsg = '✗ 不可用';
      if (result.error) {
        if (result.error.includes('Chrome 127')) {
          errorMsg = '✗ 需要 Chrome 127 以上版本';
        } else if (result.error.includes('hardware')) {
          errorMsg = '✗ 硬體不支援，需要較新的 GPU';
        } else {
          errorMsg = `✗ ${result.error}`;
        }
      }
      localLLMStatus.textContent = errorMsg;
    }
  } catch (error) {
    localLLMStatus.className = 'local-llm-status unavailable';
    localLLMStatus.textContent = `✗ 檢查失敗: ${error.message}`;
  }
}

// 監聽 llmProfileAnalysisCheckbox 變化，保存到 chrome.storage
llmProfileAnalysisCheckbox.addEventListener('change', () => {
  const isChecked = llmProfileAnalysisCheckbox.checked;
  chrome.storage.local.set({ llmProfileAnalysis: isChecked }, () => {
    console.log('[Sidepanel] 保存用戶側寫分析設定:', isChecked);
  });
  updateLLMProviderUI();
});

// 監聽 LLM Provider 選擇變化
llmProviderSelect.addEventListener('change', () => {
  const provider = llmProviderSelect.value;
  const useLocalLLM = provider === 'local';
  
  chrome.storage.local.set({ 
    useLocalLLM: useLocalLLM,
    llmProvider: provider 
  }, () => {
    const providerName = provider === 'local' ? '本地 LLM' : 
                         provider === 'claude' ? 'Claude API' : 
                         provider === 'openrouter' ? 'OpenRouter API' : 
                         'OpenAI API';
    console.log('[Sidepanel] 切換到', providerName);
  });
  updateLLMProviderUI();
});

// 更新 API Key 顯示狀態（已設定時隱藏輸入框，顯示 edit 按鈕）
function updateApiKeyDisplayState(hasApiKey) {
  if (hasApiKey) {
    apiKeySetIndicator.style.display = 'inline';
    apiKeyInputContainer.style.display = 'none';
  } else {
    apiKeySetIndicator.style.display = 'none';
    apiKeyInputContainer.style.display = 'inline';
  }
}

// 更新 Claude API Key 顯示狀態（已設定時隱藏輸入框，顯示 edit 按鈕）
function updateClaudeApiKeyDisplayState(hasApiKey) {
  if (hasApiKey) {
    claudeApiKeySetIndicator.style.display = 'inline';
    claudeApiKeyInputContainer.style.display = 'none';
  } else {
    claudeApiKeySetIndicator.style.display = 'none';
    claudeApiKeyInputContainer.style.display = 'inline';
  }
}

// 更新 OpenRouter API Key 顯示狀態（已設定時隱藏輸入框，顯示 edit 按鈕）
function updateOpenrouterApiKeyDisplayState(hasApiKey) {
  if (hasApiKey) {
    openrouterApiKeySetIndicator.style.display = 'inline';
    openrouterApiKeyInputContainer.style.display = 'none';
  } else {
    openrouterApiKeySetIndicator.style.display = 'none';
    openrouterApiKeyInputContainer.style.display = 'inline';
  }
}

// 監聽 edit API key 按鈕點擊
editApiKeyBtn.addEventListener('click', () => {
  apiKeySetIndicator.style.display = 'none';
  apiKeyInputContainer.style.display = 'inline';
  openaiApiKeyInput.focus();
});

// 監聽 clear API key 按鈕點擊
clearApiKeyBtn.addEventListener('click', () => {
  openaiApiKeyInput.value = '';
  chrome.storage.local.remove('openaiApiKey', () => {
    console.log('[Sidepanel] 已清除 OpenAI API Key');
    apiKeyStatus.textContent = '已清除';
    apiKeyStatus.className = 'api-key-status';
    setTimeout(() => {
      apiKeyStatus.textContent = '';
    }, 2000);
  });
  updateApiKeyDisplayState(false);
});

// 監聽 edit Claude API key 按鈕點擊
editClaudeApiKeyBtn.addEventListener('click', () => {
  claudeApiKeySetIndicator.style.display = 'none';
  claudeApiKeyInputContainer.style.display = 'inline';
  claudeApiKeyInput.focus();
});

// 監聽 clear Claude API key 按鈕點擊
clearClaudeApiKeyBtn.addEventListener('click', () => {
  claudeApiKeyInput.value = '';
  chrome.storage.local.remove('claudeApiKey', () => {
    console.log('[Sidepanel] 已清除 Claude API Key');
    claudeApiKeyStatus.textContent = '已清除';
    claudeApiKeyStatus.className = 'api-key-status';
    setTimeout(() => {
      claudeApiKeyStatus.textContent = '';
    }, 2000);
  });
  updateClaudeApiKeyDisplayState(false);
});

// 監聽 edit OpenRouter API key 按鈕點擊
editOpenrouterApiKeyBtn.addEventListener('click', () => {
  openrouterApiKeySetIndicator.style.display = 'none';
  openrouterApiKeyInputContainer.style.display = 'inline';
  openrouterApiKeyInput.focus();
});

// 監聽 clear OpenRouter API key 按鈕點擊
clearOpenrouterApiKeyBtn.addEventListener('click', () => {
  openrouterApiKeyInput.value = '';
  chrome.storage.local.remove('openrouterApiKey', () => {
    console.log('[Sidepanel] 已清除 OpenRouter API Key');
    openrouterApiKeyStatus.textContent = '已清除';
    openrouterApiKeyStatus.className = 'api-key-status';
    setTimeout(() => {
      openrouterApiKeyStatus.textContent = '';
    }, 2000);
  });
  updateOpenrouterApiKeyDisplayState(false);
});

// 初始化：從 chrome.storage 讀取 OpenAI API Key、Claude API Key、OpenRouter API Key 和 LLM Provider 設定
chrome.storage.local.get(['openaiApiKey', 'claudeApiKey', 'openrouterApiKey', 'openrouterModelName', 'useLocalLLM', 'llmProvider'], (result) => {
  // OpenAI API Key
  if (result.openaiApiKey) {
    openaiApiKeyInput.value = result.openaiApiKey;
    console.log('[Sidepanel] 載入 OpenAI API Key');
    updateApiKeyDisplayState(true);
  } else {
    updateApiKeyDisplayState(false);
  }
  
  // Claude API Key
  if (result.claudeApiKey) {
    claudeApiKeyInput.value = result.claudeApiKey;
    console.log('[Sidepanel] 載入 Claude API Key');
    updateClaudeApiKeyDisplayState(true);
  } else {
    updateClaudeApiKeyDisplayState(false);
  }
  
  // OpenRouter API Key
  if (result.openrouterApiKey) {
    openrouterApiKeyInput.value = result.openrouterApiKey;
    console.log('[Sidepanel] 載入 OpenRouter API Key');
    updateOpenrouterApiKeyDisplayState(true);
  } else {
    updateOpenrouterApiKeyDisplayState(false);
  }
  
  // OpenRouter Model Name
  if (result.openrouterModelName) {
    openrouterModelInput.value = result.openrouterModelName;
    console.log('[Sidepanel] 載入 OpenRouter Model Name:', result.openrouterModelName);
  }
  
  // 設定 LLM Provider 選擇
  if (result.llmProvider) {
    llmProviderSelect.value = result.llmProvider;
    console.log('[Sidepanel] 載入 LLM Provider 設定:', result.llmProvider);
  } else if (result.useLocalLLM === true) {
    llmProviderSelect.value = 'local';
    console.log('[Sidepanel] 載入 LLM Provider 設定: 本地 LLM');
  } else {
    llmProviderSelect.value = 'openai';
    console.log('[Sidepanel] 載入 LLM Provider 設定: OpenAI API');
  }
  
  // 初始化後更新顯示狀態
  updateLLMProviderUI();
  
  // 第一次安裝檢測：如果 llmProvider 從未設定過，且本機 LLM 可用，自動啟用
  if (!result.llmProvider && result.llmProvider !== '') {
    console.log('[Sidepanel] 偵測到第一次安裝，檢查本機 LLM 可用性...');
    
    (async () => {
      try {
        if (typeof window.checkLLMAvailability !== 'function') {
          console.log('[Sidepanel] LLM 檢查函數尚未載入，跳過自動設定');
          return;
        }
        
        const availabilityResult = await window.checkLLMAvailability();
        
        if (availabilityResult.available) {
          console.log('[Sidepanel] 本機 LLM 可用，自動啟用帳號行為分析功能');
          
          chrome.storage.local.set({
            llmProvider: 'local',
            useLocalLLM: true,
            llmProfileAnalysis: true
          }, () => {
            llmProviderSelect.value = 'local';
            llmProfileAnalysisCheckbox.checked = true;
            updateLLMProviderUI();
            console.log('[Sidepanel] 已自動設定：llmProvider=local, llmProfileAnalysis=true');
          });
        } else {
          console.log('[Sidepanel] 本機 LLM 不可用，狀態:', availabilityResult.status);
        }
      } catch (error) {
        console.error('[Sidepanel] 第一次安裝自動設定失敗:', error);
      }
    })();
  }
});

// 當 API Key 輸入框內容變化時，自動儲存
let apiKeySaveTimeout = null;
openaiApiKeyInput.addEventListener('input', () => {
  const apiKey = openaiApiKeyInput.value.trim();
  
  // 清除之前的延遲儲存
  if (apiKeySaveTimeout) {
    clearTimeout(apiKeySaveTimeout);
  }
  
  // 延遲 500ms 後自動儲存
  apiKeySaveTimeout = setTimeout(() => {
    if (!apiKey) {
      apiKeyStatus.textContent = '';
      apiKeyStatus.className = 'api-key-status';
      return;
    }
    
    // 簡單驗證 API Key 格式
    if (!apiKey.startsWith('sk-')) {
      apiKeyStatus.textContent = '格式不正確';
      apiKeyStatus.className = 'api-key-status error';
      return;
    }
    
    chrome.storage.local.set({ openaiApiKey: apiKey }, () => {
      console.log('[Sidepanel] 自動儲存 OpenAI API Key');
      apiKeyStatus.textContent = '✓ 已儲存';
      apiKeyStatus.className = 'api-key-status saved';
      
      // 2 秒後清除狀態訊息並切換到已設定狀態
      setTimeout(() => {
        apiKeyStatus.textContent = '';
        updateApiKeyDisplayState(true);
      }, 2000);
    });
  }, 500);
});

// 當 Claude API Key 輸入框內容變化時，自動儲存
let claudeApiKeySaveTimeout = null;
claudeApiKeyInput.addEventListener('input', () => {
  const apiKey = claudeApiKeyInput.value.trim();
  
  // 清除之前的延遲儲存
  if (claudeApiKeySaveTimeout) {
    clearTimeout(claudeApiKeySaveTimeout);
  }
  
  // 延遲 500ms 後自動儲存
  claudeApiKeySaveTimeout = setTimeout(() => {
    if (!apiKey) {
      claudeApiKeyStatus.textContent = '';
      claudeApiKeyStatus.className = 'api-key-status';
      return;
    }
    
    // 簡單驗證 Claude API Key 格式
    if (!apiKey.startsWith('sk-ant-')) {
      claudeApiKeyStatus.textContent = '格式不正確';
      claudeApiKeyStatus.className = 'api-key-status error';
      return;
    }
    
    chrome.storage.local.set({ claudeApiKey: apiKey }, () => {
      console.log('[Sidepanel] 自動儲存 Claude API Key');
      claudeApiKeyStatus.textContent = '✓ 已儲存';
      claudeApiKeyStatus.className = 'api-key-status saved';
      
      // 2 秒後清除狀態訊息並切換到已設定狀態
      setTimeout(() => {
        claudeApiKeyStatus.textContent = '';
        updateClaudeApiKeyDisplayState(true);
      }, 2000);
    });
  }, 500);
});

// 當 OpenRouter API Key 輸入框內容變化時，自動儲存
let openrouterApiKeySaveTimeout = null;
openrouterApiKeyInput.addEventListener('input', () => {
  const apiKey = openrouterApiKeyInput.value.trim();
  
  // 清除之前的延遲儲存
  if (openrouterApiKeySaveTimeout) {
    clearTimeout(openrouterApiKeySaveTimeout);
  }
  
  // 延遲 500ms 後自動儲存
  openrouterApiKeySaveTimeout = setTimeout(() => {
    if (!apiKey) {
      openrouterApiKeyStatus.textContent = '';
      openrouterApiKeyStatus.className = 'api-key-status';
      return;
    }
    
    // 簡單驗證 OpenRouter API Key 格式
    if (!apiKey.startsWith('sk-or-')) {
      openrouterApiKeyStatus.textContent = '格式不正確';
      openrouterApiKeyStatus.className = 'api-key-status error';
      return;
    }
    
    chrome.storage.local.set({ openrouterApiKey: apiKey }, () => {
      console.log('[Sidepanel] 自動儲存 OpenRouter API Key');
      openrouterApiKeyStatus.textContent = '✓ 已儲存';
      openrouterApiKeyStatus.className = 'api-key-status saved';
      
      // 2 秒後清除狀態訊息並切換到已設定狀態
      setTimeout(() => {
        openrouterApiKeyStatus.textContent = '';
        updateOpenrouterApiKeyDisplayState(true);
      }, 2000);
    });
  }, 500);
});

// 當 OpenRouter Model Name 輸入框內容變化時，自動儲存
let openrouterModelSaveTimeout = null;
const DEFAULT_OPENROUTER_MODEL = 'google/gemma-3-27b-it:free';

openrouterModelInput.addEventListener('input', () => {
  const modelName = openrouterModelInput.value.trim();
  
  // 清除之前的延遲儲存
  if (openrouterModelSaveTimeout) {
    clearTimeout(openrouterModelSaveTimeout);
  }
  
  // 延遲 500ms 後自動儲存
  openrouterModelSaveTimeout = setTimeout(() => {
    // 如果為空白，儲存空字串（實際使用時會使用預設模型）
    if (!modelName) {
      chrome.storage.local.set({ openrouterModelName: '' }, () => {
        console.log('[Sidepanel] OpenRouter Model Name 已清空（實際使用時將使用預設模型）');
        openrouterModelStatus.textContent = '✓ 已儲存';
        openrouterModelStatus.className = 'api-key-status saved';
        
        // 2 秒後清除狀態訊息
        setTimeout(() => {
          openrouterModelStatus.textContent = '';
        }, 2000);
      });
      return;
    }
    
    chrome.storage.local.set({ openrouterModelName: modelName }, () => {
      console.log('[Sidepanel] 自動儲存 OpenRouter Model Name:', modelName);
      openrouterModelStatus.textContent = '✓ 已儲存';
      openrouterModelStatus.className = 'api-key-status saved';
      
      // 2 秒後清除狀態訊息
      setTimeout(() => {
        openrouterModelStatus.textContent = '';
      }, 2000);
    });
  }, 500);
});

// ==================== 統一快取管理按鈕 ====================

// 監聽清除所有快取按鈕點擊
clearAllCacheBtn.addEventListener('click', async () => {
  try {
    // 顯示確認對話框
    const confirmed = confirm('確定要清除所有本機保存的快取資料嗎？\n\n包含：\n- 用戶所在地資料\n- 用戶側寫資料\n- 手動信任清單\n\n此操作無法復原。');

    if (!confirmed) {
      console.log('[Sidepanel] 用戶取消清除快取');
      return;
    }

    console.log('[Sidepanel] 清除所有快取按鈕被點擊');
    updateStatus('正在清除所有快取資料...', 'info');

    // 禁用按鈕防止重複點擊
    clearAllCacheBtn.disabled = true;
    clearAllCacheBtn.textContent = '清除中...';

    // 清除用戶所在地快取
    const regionResponse = await chrome.runtime.sendMessage({
      action: 'clearCache'
    });

    // 清除用戶側寫快取
    const profileResponse = await chrome.runtime.sendMessage({
      action: 'clearProfileCache'
    });

    // 清除手動信任清單
    let trustListCleared = false;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && tab.url.includes('threads.com')) {
        const trustResponse = await chrome.tabs.sendMessage(tab.id, {
          action: 'clearTrustList'
        });
        trustListCleared = trustResponse && trustResponse.success;
      }
    } catch (error) {
      console.log('[Sidepanel] 清除手動信任清單失敗（可能未開啟 Threads 頁面）:', error);
    }

    if (regionResponse && regionResponse.success && profileResponse && profileResponse.success) {
      updateStatus('所有快取資料已清除', 'success');

      // 更新快取統計顯示
      await updateCacheStats();
      await updateProfileCacheStats();
      await updateTrustListStats();

      // 清除當前用戶列表中的資料（保留用戶名）
      currentGetUserListArray = currentGetUserListArray.map(user => ({
        account: user.account,
        region: null,
        profile: null
      }));

      // 更新顯示
      const summary = `總共 ${currentGetUserListArray.length} 個用戶帳號:\n\n`;
      contentOutput.value = summary + currentGetUserListArray.map((user, index) => {
        return `[${index}] ${user.account}`;
      }).join('\n');

      console.log('[Sidepanel] 所有快取已清除，用戶列表已重置');
    } else {
      updateStatus(`清除失敗: 部分資料清除失敗`, 'error');
    }

    // 恢復按鈕狀態
    clearAllCacheBtn.disabled = false;
    clearAllCacheBtn.textContent = '清除';

  } catch (error) {
    console.error('[Sidepanel] 清除快取錯誤:', error);
    updateStatus(`清除快取錯誤: ${error.message}`, 'error');

    // 恢復按鈕狀態
    clearAllCacheBtn.disabled = false;
    clearAllCacheBtn.textContent = '清除';
  }
});

/**
 * 計算資料的 SHA-256 雜湊值
 * @param {string} data - 要計算雜湊的字串
 * @returns {Promise<string>} 十六進位格式的雜湊值
 */
async function calculateHash(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * 匯出快取資料為 JSON 檔案
 * 包含所在地資料、用戶側寫資料、手動標注清單，以及用於驗證的雜湊值
 */
async function exportCacheData() {
  console.log('[Sidepanel] 開始匯出快取資料...');
  updateStatus('正在收集快取資料...', 'info');

  // 1. 獲取所在地快取資料
  let locationData = [];
  try {
    const regionResponse = await chrome.runtime.sendMessage({
      action: 'getAllCachedRegions'
    });
    if (regionResponse && regionResponse.success && regionResponse.cache) {
      locationData = Object.entries(regionResponse.cache).map(([username, data]) => ({
        username: username,
        region: data.region,
        timestamp: data.timestamp || null
      }));
    }
    console.log(`[Sidepanel] 獲取所在地資料: ${locationData.length} 筆`);
  } catch (error) {
    console.error('[Sidepanel] 獲取所在地快取失敗:', error);
  }

  // 2. 獲取用戶側寫快取資料
  let userProfileData = [];
  try {
    const profileResponse = await chrome.runtime.sendMessage({
      action: 'getAllCachedProfiles'
    });
    if (profileResponse && profileResponse.success && profileResponse.cache) {
      userProfileData = Object.entries(profileResponse.cache).map(([username, data]) => ({
        username: username,
        profile: data.profile,
        timestamp: data.timestamp || null
      }));
    }
    console.log(`[Sidepanel] 獲取用戶側寫資料: ${userProfileData.length} 筆`);
  } catch (error) {
    console.error('[Sidepanel] 獲取用戶側寫快取失敗:', error);
  }

  // 3. 獲取手動標注清單
  let userMarkAllow = [];
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes('threads.com')) {
      const trustResponse = await chrome.tabs.sendMessage(tab.id, {
        action: 'getAllTrustList'
      });
      if (trustResponse && trustResponse.success && trustResponse.trustList) {
        userMarkAllow = trustResponse.trustList;
      }
    }
    console.log(`[Sidepanel] 獲取手動標注清單: ${userMarkAllow.length} 筆`);
  } catch (error) {
    console.log('[Sidepanel] 獲取手動標注清單失敗（可能未開啟 Threads 頁面）:', error);
  }

  // 4. 產生時間戳記
  const timestamp = new Date().toISOString();

  // 5. 計算雜湊值（用於驗證資料完整性）
  // 將資料排序後序列化，確保相同資料產生相同雜湊
  const dataForHash = {
    LocationData: locationData.sort((a, b) => a.username.localeCompare(b.username)),
    UserProfileData: userProfileData.sort((a, b) => a.username.localeCompare(b.username)),
    UserMarkAllow: userMarkAllow.sort()
  };
  const dataString = JSON.stringify(dataForHash);
  const hash = await calculateHash(dataString);
  console.log(`[Sidepanel] 計算雜湊值: ${hash}`);

  // 6. 組合匯出資料
  const exportData = {
    LocationData: locationData,
    UserProfileData: userProfileData,
    UserMarkAllow: userMarkAllow,
    Hash: hash,
    Timestamp: timestamp
  };

  return exportData;
}

/**
 * 下載 JSON 檔案
 * @param {Object} data - 要下載的資料物件
 * @param {string} filename - 檔案名稱
 */
function downloadJSON(data, filename) {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 監聽匯出快取按鈕點擊
exportCacheBtn.addEventListener('click', async () => {
  try {
    console.log('[Sidepanel] 匯出快取按鈕被點擊');
    updateStatus('準備匯出快取資料...', 'info');

    // 禁用按鈕防止重複點擊
    exportCacheBtn.disabled = true;
    exportCacheBtn.textContent = '匯出中...';

    // 執行匯出
    const exportData = await exportCacheData();

    // 產生檔案名稱（包含時間戳記）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `user-profile-export-${timestamp}.json`;

    // 下載檔案
    downloadJSON(exportData, filename);

    // 更新狀態
    const totalCount = exportData.LocationData.length + 
                       exportData.UserProfileData.length + 
                       exportData.UserMarkAllow.length;
    updateStatus(`匯出成功: ${filename}`, 'success');
    contentOutput.value = `匯出完成！\n\n` +
      `檔案名稱: ${filename}\n\n` +
      `匯出內容:\n` +
      `- 所在地資料: ${exportData.LocationData.length} 筆\n` +
      `- 用戶側寫資料: ${exportData.UserProfileData.length} 筆\n` +
      `- 手動標注清單: ${exportData.UserMarkAllow.length} 筆\n\n` +
      `雜湊值 (SHA-256):\n${exportData.Hash}\n\n` +
      `匯入者可使用此雜湊值驗證資料完整性`;

    console.log(`[Sidepanel] 匯出成功: ${filename}, 共 ${totalCount} 筆資料`);

    // 恢復按鈕狀態
    exportCacheBtn.disabled = false;
    exportCacheBtn.textContent = '匯出';

  } catch (error) {
    console.error('[Sidepanel] 匯出快取錯誤:', error);
    updateStatus(`匯出錯誤: ${error.message}`, 'error');

    // 恢復按鈕狀態
    exportCacheBtn.disabled = false;
    exportCacheBtn.textContent = '匯出';
  }
});

// ==================== 手動偵測按鈕 ====================

// 監聯手動偵測按鈕點擊，觸發 content.js 的 handlePageScroll
if (manualDetectBtn) {
manualDetectBtn.addEventListener('click', async () => {
  try {
    console.log('[Sidepanel] 手動偵測按鈕被點擊');
    updateStatus('手動偵測中...', 'info');

    // 禁用按鈕防止重複點擊
    manualDetectBtn.disabled = true;
    manualDetectBtn.textContent = '偵測中...';

    // 獲取當前活動標籤頁
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      updateStatus('錯誤: 無法找到活動標籤頁', 'error');
      manualDetectBtn.disabled = false;
      manualDetectBtn.textContent = '手動加入標籤';
      return;
    }

    // 檢查當前頁面是否為 threads.com
    if (!tab.url || !tab.url.includes('threads.com')) {
      updateStatus('錯誤: 請先開啟 Threads 頁面', 'error');
      contentOutput.value = '此工具僅適用於 threads.com 網站\n\n請先開啟 Threads 頁面，然後再點擊手動偵測按鈕。';
      manualDetectBtn.disabled = false;
      manualDetectBtn.textContent = '手動加入標籤';
      return;
    }

    // 先用 ping 確認 content script 已經載入
    let contentScriptReady = false;
    try {
      const pingResponse = await chrome.tabs.sendMessage(tab.id, {
        action: 'ping'
      });

      if (pingResponse && pingResponse.success) {
        contentScriptReady = true;
        console.log('[Sidepanel] Content script 已準備就緒');
      }
    } catch (pingError) {
      console.log('[Sidepanel] Ping content script 失敗:', pingError.message);
    }

    if (!contentScriptReady) {
      updateStatus('錯誤: Content script 未載入', 'error');
      contentOutput.value = 'Content script 尚未載入或未準備就緒\n\n可能的解決方法：\n1. 重新整理 Threads 頁面\n2. 關閉並重新開啟此側邊欄\n3. 重新載入擴充功能';
      manualDetectBtn.disabled = false;
      manualDetectBtn.textContent = '手動加入標籤';
      return;
    }

    // 發送消息給 content.js，觸發 handlePageScroll
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'sidepanelOpened'
    });

    if (response && response.success) {
      console.log('[Sidepanel] Content script 已收到手動偵測通知');
      updateStatus('手動偵測完成', 'success');
    } else {
      updateStatus('手動偵測完成', 'info');
    }

    // 恢復按鈕狀態
    manualDetectBtn.disabled = false;
    manualDetectBtn.textContent = '手動加入標籤';

  } catch (error) {
    console.error('[Sidepanel] 手動偵測錯誤:', error);

    // 根據錯誤類型提供更友好的提示
    if (error.message.includes('Could not establish connection')) {
      updateStatus('錯誤: 無法連接到頁面', 'error');
      contentOutput.value = '無法連接到當前頁面\n\n可能的原因：\n1. 當前頁面不是 threads.com\n2. Content script 尚未載入\n3. 頁面需要重新整理\n\n請嘗試：\n- 確認已開啟 Threads 頁面\n- 重新整理頁面\n- 重新開啟此側邊欄';
    } else {
      updateStatus(`手動偵測錯誤: ${error.message}`, 'error');
    }

    // 恢復按鈕狀態
    manualDetectBtn.disabled = false;
    manualDetectBtn.textContent = '手動加入標籤';
  }
});
}

// ==================== Sidepanel 初始化 ====================

// 建立與 background.js 的持久連接，用於偵測 sidepanel 關閉
// 當 sidepanel 關閉時，連接會自動斷開，background.js 可以偵測到
const sidepanelPort = chrome.runtime.connect({ name: 'sidepanel' });
console.log('[Sidepanel] 已建立與 background 的持久連接');

// 當 sidepanel 開啟時，通知 content.js 執行 handlePageScroll
(async () => {
  try {
    console.log('[Sidepanel] Sidepanel 已開啟，通知 content.js 執行更新');

    // 初始化快取統計顯示
    await updateCacheStats();
    await updateProfileCacheStats();
    await updateTrustListStats();

    // 自動執行手動偵測按鈕的動作
    // 延遲一小段時間確保 DOM 完全載入
    setTimeout(() => {
      console.log('[Sidepanel] 自動觸發手動偵測');
      manualDetectBtn.click();
    }, 100);

  } catch (error) {
    console.error('[Sidepanel] 初始化時發生錯誤:', error);
  }
})();

// ==================== 監聽頁面可見性變化 ====================

// 當用戶切換回 sidepanel 時，自動刷新快取統計
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log('[Sidepanel] 頁面重新可見，刷新快取統計');
    updateCacheStats();
    updateProfileCacheStats();
    updateTrustListStats();
  }
});

// 監聽 window focus 事件（當用戶切換回此視窗時）
window.addEventListener('focus', () => {
  console.log('[Sidepanel] Window 獲得焦點，刷新快取統計');
  updateCacheStats();
  updateProfileCacheStats();
  updateTrustListStats();
});

// ==================== 手動刷新快取統計 ====================

// 點擊快取統計數字可手動刷新
cacheCountElement.addEventListener('click', async () => {
  console.log('[Sidepanel] 用戶點擊快取統計，手動刷新');

  // 顯示刷新動畫
  const originalText = cacheCountElement.textContent;
  cacheCountElement.textContent = '...';

  await updateCacheStats();

  // 如果刷新後數字沒變，顯示一個提示
  if (cacheCountElement.textContent === originalText) {
    console.log('[Sidepanel] 快取統計已是最新');
  }
});

// 點擊側寫快取統計數字可手動刷新
profileCacheCountElement.addEventListener('click', async () => {
  console.log('[Sidepanel] 用戶點擊側寫快取統計，手動刷新');

  // 顯示刷新動畫
  const originalText = profileCacheCountElement.textContent;
  profileCacheCountElement.textContent = '...';

  await updateProfileCacheStats();

  // 如果刷新後數字沒變，顯示一個提示
  if (profileCacheCountElement.textContent === originalText) {
    console.log('[Sidepanel] 側寫快取統計已是最新');
  }
});

// 點擊手動標注統計數字可手動刷新
trustListCountElement.addEventListener('click', async () => {
  console.log('[Sidepanel] 用戶點擊手動標注統計，手動刷新');

  // 顯示刷新動畫
  const originalText = trustListCountElement.textContent;
  trustListCountElement.textContent = '...';

  await updateTrustListStats();

  // 如果刷新後數字沒變，顯示一個提示
  if (trustListCountElement.textContent === originalText) {
    console.log('[Sidepanel] 手動標注統計已是最新');
  }
});


// ==================== Sidepanel 關閉時清理 ====================

/**
 * 當 Sidepanel 關閉時，通過 background.js 通知所有 Threads 頁面移除標籤
 */
function cleanupOnClose() {
  try {
    console.log('[Sidepanel] Sidepanel 即將關閉，通知 background 移除所有標籤');

    // 使用同步方式發送消息給 background.js
    // background.js 會負責通知所有 threads.com 頁面移除標籤
    chrome.runtime.sendMessage({
      action: 'sidepanelClosed'
    }).catch(error => {
      console.log('[Sidepanel] 通知 background 失敗:', error.message);
    });
  } catch (error) {
    console.error('[Sidepanel] 清理時發生錯誤:', error);
  }
}

// 監聽頁面卸載事件（當 sidepanel 關閉時）
window.addEventListener('beforeunload', (event) => {
  console.log('[Sidepanel] 檢測到 beforeunload 事件');
  cleanupOnClose();
});

// 監聽頁面隱藏事件（作為備用）
window.addEventListener('pagehide', (event) => {
  console.log('[Sidepanel] 檢測到 pagehide 事件');
  cleanupOnClose();
});

// 監聽 visibilitychange 事件（當用戶關閉 sidepanel 時）
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('[Sidepanel] Sidepanel 已隱藏');
    cleanupOnClose();
  }
});

// ==================== 輪播圖功能 ====================

let currentCarouselIndex = 0;
const carouselImages = document.querySelectorAll('.carousel-image');
const carouselIndicators = document.querySelectorAll('.carousel-indicator');
const carouselPrevBtn = document.getElementById('carouselPrev');
const carouselNextBtn = document.getElementById('carouselNext');

function showCarouselImage(index) {
  const carouselTrack = document.querySelector('.carousel-track');
  const offset = -index * 100;
  carouselTrack.style.transform = `translateX(${offset}%)`;

  carouselIndicators.forEach((indicator, i) => {
    if (i === index) {
      indicator.classList.add('active');
    } else {
      indicator.classList.remove('active');
    }
  });

  currentCarouselIndex = index;
}

function nextCarouselImage() {
  const nextIndex = (currentCarouselIndex + 1) % carouselImages.length;
  showCarouselImage(nextIndex);
}

function prevCarouselImage() {
  const prevIndex = (currentCarouselIndex - 1 + carouselImages.length) % carouselImages.length;
  showCarouselImage(prevIndex);
}

carouselPrevBtn.addEventListener('click', prevCarouselImage);
carouselNextBtn.addEventListener('click', nextCarouselImage);

carouselIndicators.forEach((indicator, index) => {
  indicator.addEventListener('click', () => {
    showCarouselImage(index);
  });
});

// 鍵盤左右鍵支援
document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') {
    prevCarouselImage();
  } else if (event.key === 'ArrowRight') {
    nextCarouselImage();
  }
});
