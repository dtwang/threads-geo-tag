// 導入查詢管理器
import {
  queryUserRegion,
  getQueueStatus,
  getCachedRegion,
  getAllCachedRegions,
  clearCache,
  removeUserCache,
  getCacheStats,
  updateMaxConcurrent,
  addToIntegratedQueryQueue,
  getCachedProfile,
  saveCachedProfile,
  getAllCachedProfiles,
  clearProfileCache,
  getProfileCacheStats,
  removeUserProfileCache
} from './queryManager.js';

// 當擴展安裝時設置 Side Panel
chrome.runtime.onInstalled.addListener(() => {
  console.log('Web Content Grab Extension 已安裝');
});

// 初始化時從 storage 讀取最大並行查詢數設定
(async () => {
  try {
    const result = await chrome.storage.local.get(['maxConcurrentQueries']);
    if (result.maxConcurrentQueries !== undefined) {
      updateMaxConcurrent(result.maxConcurrentQueries);
      console.log('[Background] 從 storage 載入最大並行查詢數:', result.maxConcurrentQueries);
    }
  } catch (error) {
    console.error('[Background] 讀取最大並行查詢數設定失敗:', error);
  }
})();

// 点击扩展图标时打开 Side Panel
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// 監聽 sidepanel 的持久連接，用於偵測 sidepanel 關閉
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    console.log('[Background] Sidepanel 已連接');

    // 當連接斷開時（sidepanel 關閉），移除所有標籤
    port.onDisconnect.addListener(async () => {
      console.log('[Background] Sidepanel 連接已斷開，準備移除所有標籤');

      try {
        // 獲取所有標籤頁
        const tabs = await chrome.tabs.query({});
        let removedCount = 0;

        // 向所有 threads.com 頁面發送移除標籤的請求
        for (const tab of tabs) {
          if (tab.url && tab.url.includes('threads.com')) {
            try {
              const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'removeRegionLabels'
              });

              if (response && response.success) {
                removedCount += response.removedCount || 0;
                console.log(`[Background] Tab ${tab.id} 已移除 ${response.removedCount} 個標籤`);
              }
            } catch (error) {
              console.log(`[Background] 無法連接到 tab ${tab.id}:`, error.message);
            }
          }
        }

        console.log(`[Background] Sidepanel 關閉，共移除 ${removedCount} 個標籤`);
      } catch (error) {
        console.error('[Background] 移除標籤時發生錯誤:', error);
      }
    });
  }
});

// 监听来自 content script 或 sidepanel 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  //console.log(`[Background] 收到消息:`, request.action, sender.tab ? `from tab ${sender.tab.id}` : 'from extension');

  if (request.action === 'openSidePanel') {
    chrome.sidePanel.open({ windowId: sender.tab.windowId });
    sendResponse({ success: true });
  }

  // 處理手動查詢地區（從標籤上的 [查詢] 按鈕觸發）
  if (request.action === 'manualQueryRegion') {
    const { account, isPriority } = request;

    (async () => {
      try {
        const priorityText = isPriority ? '（優先）' : '';
        console.log(`[Background] 開始手動查詢${priorityText}: ${account}`);

        // 讀取設定
        const storageResult = await chrome.storage.local.get([
          'keepTabAfterQuery', 
          'keepTabFilter', 
          'llmProfileAnalysis'
        ]);
        const shouldKeepTab = storageResult.keepTabAfterQuery || false;
        const keepTabFilter = storageResult.keepTabFilter || '';
        const enableProfileAnalysis = storageResult.llmProfileAnalysis || false;

        console.log(`[Background] 查詢設定: keepTab=${shouldKeepTab}, filter="${keepTabFilter}", profile=${enableProfileAnalysis}, isPriority=${isPriority || false}`);

        // 使用隊列機制執行整合查詢
        const queueResult = addToIntegratedQueryQueue(
          account,
          enableProfileAnalysis,
          shouldKeepTab,
          keepTabFilter,
          // 當側寫內容準備好時的回調
          (profileData) => {
            console.log(`[Background] 側寫內容準備好，通知 sidepanel 進行 LLM 分析`);
            // 通知 sidepanel 進行 LLM 分析
            chrome.runtime.sendMessage({
              action: 'processProfileAnalysis',
              account: account,
              profileData: profileData
            }).catch(err => {
              console.log('[Background] 通知 sidepanel 進行 LLM 分析失敗:', err.message);
            });
          },
          isPriority || false  // 傳遞優先級參數，預設為 false（自動查詢）
        );

        // 如果無法加入隊列（隊列已滿或已存在），返回失敗
        if (queueResult === null) {
          sendResponse({
            success: false,
            error: '隊列已滿或該用戶已在查詢中'
          });
          return;
        }

        // 等待查詢完成並返回結果
        const result = await queueResult;
        console.log(`[Background] 手動查詢完成，返回結果:`, result);
        sendResponse(result);
      } catch (error) {
        console.error('[Background] 手動查詢錯誤:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();

    return true; // 保持消息通道打開
  }

  // 處理來自 sidepanel 的查詢請求
  if (request.action === 'queryUserRegion') {
    const { username, shouldKeepTab } = request;

    (async () => {
      try {
        console.log(`[Background] 收到查詢請求: ${username}`);

        // 使用查詢管理器執行查詢
        const result = await queryUserRegion(username, shouldKeepTab);

        // 返回結果
        sendResponse(result);
      } catch (error) {
        console.error('[Background] 查詢錯誤:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();

    return true; // 保持消息通道打開
  }

  // 獲取隊列狀態（用於調試）
  if (request.action === 'getQueueStatus') {
    const status = getQueueStatus();
    sendResponse(status);
    return true;
  }

  // 獲取緩存中的用戶地區
  if (request.action === 'getCachedRegion') {
    const { username } = request;

    (async () => {
      try {
        const region = await getCachedRegion(username);
        sendResponse({ success: true, region });
      } catch (error) {
        console.error('[Background] 獲取緩存失敗:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  // 清除所有緩存
  if (request.action === 'clearCache') {
    (async () => {
      try {
        await clearCache();
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Background] 清除緩存失敗:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  // 移除單一用戶的緩存（地區和側寫）
  if (request.action === 'removeUserCache') {
    const { account } = request;
    (async () => {
      try {
        const removedRegion = await removeUserCache(account);
        const removedProfile = await removeUserProfileCache(account);
        console.log(`[Background] 移除用戶緩存: @${account}, 地區: ${removedRegion}, 側寫: ${removedProfile}`);
        sendResponse({ success: true, removedRegion, removedProfile });
      } catch (error) {
        console.error('[Background] 移除用戶緩存失敗:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  // 獲取緩存統計信息
  if (request.action === 'getCacheStats') {
    (async () => {
      try {
        const stats = await getCacheStats();
        sendResponse({ success: true, stats });
      } catch (error) {
        console.error('[Background] 獲取緩存統計失敗:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  // 更新最大並行查詢數
  if (request.action === 'updateMaxConcurrent') {
    const { value } = request;
    updateMaxConcurrent(value);
    console.log('[Background] 已更新最大並行查詢數:', value);
    sendResponse({ success: true });
    return true;
  }

  // 處理 Sidepanel 關閉事件
  if (request.action === 'sidepanelClosed') {
    console.log('[Background] 收到 Sidepanel 關閉通知，準備移除所有標籤');

    (async () => {
      try {
        // 獲取所有標籤頁
        const tabs = await chrome.tabs.query({});
        let removedCount = 0;
        let failedCount = 0;

        // 向所有 threads.com 頁面發送移除標籤的請求
        for (const tab of tabs) {
          if (tab.url && tab.url.includes('threads.com')) {
            try {
              const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'removeRegionLabels'
              });

              if (response && response.success) {
                removedCount += response.removedCount || 0;
                console.log(`[Background] Tab ${tab.id} 已移除 ${response.removedCount} 個標籤`);
              }
            } catch (error) {
              // 忽略無法連接的標籤頁
              failedCount++;
              console.log(`[Background] 無法連接到 tab ${tab.id}:`, error.message);
            }
          }
        }

        console.log(`[Background] 標籤移除完成，成功: ${removedCount} 個，失敗: ${failedCount} 個`);

        sendResponse({
          success: true,
          removedCount: removedCount,
          failedCount: failedCount
        });
      } catch (error) {
        console.error('[Background] 移除標籤時發生錯誤:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();

    return true;
  }

  // 獲取所有緩存的用戶地區資料
  if (request.action === 'getAllCachedRegions') {
    (async () => {
      try {
        const cache = await getAllCachedRegions();
        sendResponse({ success: true, cache });
      } catch (error) {
        console.error('[Background] 獲取所有緩存失敗:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  // 獲取緩存中的用戶側寫
  if (request.action === 'getCachedProfile') {
    const { username } = request;

    (async () => {
      try {
        const cachedData = await getCachedProfile(username);
        if (cachedData) {
          sendResponse({ 
            success: true, 
            profile: cachedData.profile
          });
        } else {
          sendResponse({ success: true, profile: null });
        }
      } catch (error) {
        console.error('[Background] 獲取側寫緩存失敗:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  // 保存用戶側寫到緩存
  if (request.action === 'saveCachedProfile') {
    const { username, profile } = request;

    (async () => {
      try {
        await saveCachedProfile(username, profile);
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Background] 保存側寫緩存失敗:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  // 獲取所有緩存的用戶側寫資料
  if (request.action === 'getAllCachedProfiles') {
    (async () => {
      try {
        const cache = await getAllCachedProfiles();
        sendResponse({ success: true, cache });
      } catch (error) {
        console.error('[Background] 獲取所有側寫緩存失敗:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  // 清除所有側寫緩存
  if (request.action === 'clearProfileCache') {
    (async () => {
      try {
        await clearProfileCache();
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Background] 清除側寫緩存失敗:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  // 獲取側寫緩存統計信息
  if (request.action === 'getProfileCacheStats') {
    (async () => {
      try {
        const stats = await getProfileCacheStats();
        sendResponse({ success: true, stats });
      } catch (error) {
        console.error('[Background] 獲取側寫緩存統計失敗:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  return true;
});
