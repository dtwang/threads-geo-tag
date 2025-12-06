// 獲取 DOM 元素
const accountInput = document.getElementById('accountInput');
const keepTabCheckbox = document.getElementById('keepTabCheckbox');
const keepTabFilterContainer = document.getElementById('keepTabFilterContainer');
const keepTabFilterInput = document.getElementById('keepTabFilterInput');
const autoQueryVisibleCheckbox = document.getElementById('autoQueryVisibleCheckbox');
const maxConcurrentInput = document.getElementById('maxConcurrentInput');
const manualDetectBtn = document.getElementById('manualDetectBtn');
const contentOutput = document.getElementById('contentOutput');
const statusBar = document.getElementById('statusBar');
const userCountElement = document.getElementById('userCount');
const progressLabel = document.getElementById('progressLabel');
const queryProgress = document.getElementById('queryProgress');
const cacheCountElement = document.getElementById('cacheCount');
const showCacheBtn = document.getElementById('showCacheBtn');
const clearCacheBtn = document.getElementById('clearCacheBtn');

// ==================== 全局變數說明 ====================
/**
 * currentGetUserListArray: 保存用戶列表及其查詢結果
 *
 * 【資料結構】
 * [
 *   {
 *     account: "@username",  // 用戶帳號（帶 @ 符號）
 *     region: null           // 所在地區（null = 尚未查詢，字串 = 已查詢結果）
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
  const count = currentGetUserListArray.length;
  userCountElement.textContent = count;
}

// 更新快取統計顯示的輔助函數
async function updateCacheStats() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCacheStats'
    });

    if (response && response.success && response.stats) {
      const validCount = response.stats.validCount || 0;
      const totalCount = response.stats.totalCount || 0;
      const expiredCount = response.stats.expiredCount || 0;

      cacheCountElement.textContent = validCount;

      console.log(`[Sidepanel] 快取統計更新:`, {
        validCount: validCount,
        totalCount: totalCount,
        expiredCount: expiredCount,
        expiryDays: response.stats.expiryDays
      });

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
  if (total > 0) {
    progressLabel.style.display = 'inline';
    queryProgress.textContent = `${current}/${total}`;
  } else {
    progressLabel.style.display = 'none';
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

async function showRegionLabels()
{

  if (currentGetUserListArray.length === 0) {
    updateStatus('請先列出用戶帳號', 'error');
    return;
  }

  try {
    updateStatus('正在頁面上顯示地區標籤...', 'info');

    // 獲取當前活動標籤頁
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      updateStatus('錯誤: 無法找到活動標籤頁', 'error');
      return;
    }

    // 準備地區資料，格式: { "@username": "Taiwan", ... }
    // 優先使用 user.region，若無則查詢快取
    const regionData = {};
    for (const user of currentGetUserListArray) {
      if (user.region) {
        regionData[user.account] = user.region;
      } else {
        // 從快取中查詢（去掉 @ 符號）
        const username = user.account.replace(/^@/, '');
        const cachedRegion = await getCachedRegion(username);
        if (cachedRegion) {
          regionData[user.account] = cachedRegion;
          user.region = cachedRegion; // 同步更新 user 物件
        }
      }
    }

    // 向 content script 發送顯示標籤請求
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'showRegionLabels',
      regionData: regionData
    });

    if (response && response.success) {
      //updateStatus(`成功顯示標籤 ${response.addedCount}/${response.totalCount}`, 'success');
      contentOutput.value = `已在頁面上顯示地區標籤\n成功: ${response.addedCount}/${response.totalCount}\n\n提示：\n- 黃色標籤 = 待查詢\n- 綠色標籤 = 已查詢`;
    } else {
      updateStatus(`顯示標籤失敗: ${response?.error || '未知錯誤'}`, 'error');
    }
  } catch (error) {
    updateStatus(`錯誤: ${error.message}`, 'error');
    contentOutput.value = `錯誤: ${error.message}`;
  }
}

/*
// 隱藏地區標籤按鈕
hideLabelsBtn.addEventListener('click', async () => {
  try {
    updateStatus('正在隱藏地區標籤...', 'info');

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
      contentOutput.value = `已隱藏頁面上的地區標籤\n隱藏數量: ${response.hiddenCount}`;
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
        // 保留已經查詢過的用戶資料（內存中的數據）
        const existingDataMap = new Map();
        currentGetUserListArray.forEach(user => {
          existingDataMap.set(user.account, user.region);
        });

        // 從快取中讀取地區數據
        const cachePromises = users.map(async account => {
          // 先檢查內存中是否有數據
          if (existingDataMap.has(account) && existingDataMap.get(account) !== null) {
            return { account, region: existingDataMap.get(account) };
          }

          // 內存中沒有，從快取中讀取
          try {
            const response = await chrome.runtime.sendMessage({
              action: 'getCachedRegion',
              username: account
            });

            if (response && response.success && response.region) {
              console.log(`[Sidepanel] 從快取載入 ${account}: ${response.region}`);
              return { account, region: response.region };
            }
          } catch (error) {
            console.error(`[Sidepanel] 讀取快取失敗 ${account}:`, error);
          }

          return { account, region: null };
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

      sendResponse({ success: true, updated: true, count: updatedCount });
    } else {
      console.log(`[Sidepanel] 找不到用戶 ${account}，無法更新`);
      sendResponse({ success: false, error: '找不到用戶' });
    }
  }

  return true;
});

// ==================== Checkbox 狀態管理 ====================

// 初始化：從 chrome.storage 讀取 checkbox 狀態
chrome.storage.local.get(['keepTabAfterQuery', 'keepTabFilter', 'autoQueryVisible', 'maxConcurrentQueries'], (result) => {
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
  if (result.autoQueryVisible !== undefined) {
    autoQueryVisibleCheckbox.checked = result.autoQueryVisible;
    console.log('[Sidepanel] 載入自動查詢可見用戶設定:', result.autoQueryVisible);
  }
  if (result.maxConcurrentQueries !== undefined) {
    maxConcurrentInput.value = result.maxConcurrentQueries;
    console.log('[Sidepanel] 載入最大並行查詢數設定:', result.maxConcurrentQueries);
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

// 監聽 autoQueryVisibleCheckbox 變化，保存到 chrome.storage
autoQueryVisibleCheckbox.addEventListener('change', () => {
  const isChecked = autoQueryVisibleCheckbox.checked;
  chrome.storage.local.set({ autoQueryVisible: isChecked }, () => {
    console.log('[Sidepanel] 保存自動查詢可見用戶設定:', isChecked);
  });
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

// ==================== 顯示/清除快取按鈕 ====================

// 監聽顯示快取按鈕點擊
showCacheBtn.addEventListener('click', async () => {
  try {
    console.log('[Sidepanel] 顯示快取按鈕被點擊');
    updateStatus('正在讀取本機資料...', 'info');

    // 禁用按鈕防止重複點擊
    showCacheBtn.disabled = true;
    showCacheBtn.textContent = '讀取中...';

    // 發送獲取快取請求
    const response = await chrome.runtime.sendMessage({
      action: 'getAllCachedRegions'
    });

    if (response && response.success) {
      const cache = response.cache || {};
      const entries = Object.entries(cache);
      
      if (entries.length === 0) {
        contentOutput.value = '本機沒有儲存任何用戶所在地資料';
        updateStatus('本機資料為空', 'info');
      } else {
        // 格式化輸出
        const output = entries.map(([account, data]) => {
          const region = data.region || '未知';
          return `${account}: ${region}`;
        }).join('\n');
        
        contentOutput.value = `本機儲存的用戶所在地資料 (共 ${entries.length} 筆):\n\n${output}`;
        updateStatus(`已載入 ${entries.length} 筆本機資料`, 'success');
      }
    } else {
      contentOutput.value = `讀取失敗: ${response?.error || '未知錯誤'}`;
      updateStatus(`讀取失敗: ${response?.error || '未知錯誤'}`, 'error');
    }

    // 恢復按鈕狀態
    showCacheBtn.disabled = false;
    showCacheBtn.textContent = '顯示';

  } catch (error) {
    console.error('[Sidepanel] 讀取快取錯誤:', error);
    updateStatus(`讀取快取錯誤: ${error.message}`, 'error');
    contentOutput.value = `讀取錯誤: ${error.message}`;

    // 恢復按鈕狀態
    showCacheBtn.disabled = false;
    showCacheBtn.textContent = '顯示';
  }
});

// 監聽清除快取按鈕點擊
clearCacheBtn.addEventListener('click', async () => {
  try {
    // 顯示確認對話框
    const confirmed = confirm('確定要清除所有本機保存的用戶所在地資料嗎？\n\n此操作無法復原。');

    if (!confirmed) {
      console.log('[Sidepanel] 用戶取消清除快取');
      return;
    }

    console.log('[Sidepanel] 清除快取按鈕被點擊');
    updateStatus('正在清除本機資料...', 'info');

    // 禁用按鈕防止重複點擊
    clearCacheBtn.disabled = true;
    clearCacheBtn.textContent = '清除中...';

    // 發送清除快取請求
    const response = await chrome.runtime.sendMessage({
      action: 'clearCache'
    });

    if (response && response.success) {
      updateStatus('本機資料已清除', 'success');

      // 更新快取統計顯示
      await updateCacheStats();

      // 清除當前用戶列表中的 region 資料（保留用戶名）
      currentGetUserListArray = currentGetUserListArray.map(user => ({
        account: user.account,
        region: null
      }));

      // 更新顯示
      const summary = `總共 ${currentGetUserListArray.length} 個用戶帳號:\n\n`;
      contentOutput.value = summary + currentGetUserListArray.map((user, index) => {
        return `[${index}] ${user.account}`;
      }).join('\n');

      console.log('[Sidepanel] 快取已清除，用戶列表已重置');
    } else {
      updateStatus(`清除失敗: ${response?.error || '未知錯誤'}`, 'error');
    }

    // 恢復按鈕狀態
    clearCacheBtn.disabled = false;
    clearCacheBtn.textContent = '清除';

  } catch (error) {
    console.error('[Sidepanel] 清除快取錯誤:', error);
    updateStatus(`清除快取錯誤: ${error.message}`, 'error');

    // 恢復按鈕狀態
    clearCacheBtn.disabled = false;
    clearCacheBtn.textContent = '清除';
  }
});

// ==================== 手動偵測按鈕 ====================

// 監聽手動偵測按鈕點擊，觸發 content.js 的 handlePageScroll
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
  }
});

// 監聽 window focus 事件（當用戶切換回此視窗時）
window.addEventListener('focus', () => {
  console.log('[Sidepanel] Window 獲得焦點，刷新快取統計');
  updateCacheStats();
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
