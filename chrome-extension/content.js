// Content Script - 注入到网页中的脚本

// ==================== 全局變數說明 ====================
/**
 * currentUserElementsData: 保存頁面上所有用戶元素的資料
 *
 * 【資料結構】
 * [
 *   {
 *     account: "@username",  // 用戶帳號（帶 @ 符號）
 *     element: Element       // 對應的 DOM 元素（<a> 連結）
 *   },
 *   ...
 * ]
 *
 * 【作用】
 * 1. 保存頁面上所有用戶連結的 DOM 元素引用
 * 2. 用於在頁面上插入/更新用戶資訊標籤（標籤會插入到這些元素附近）
 * 3. 用於檢查哪些用戶在可見視窗範圍內（visibility detection）
 *
 * 【更新時機】
 * 1. 當 sidepanel 發送 'listAllUsers' action 時：
 *    - getAllUsersOnPage() 會掃描頁面上所有用戶連結
 *    - 合併新舊資料，避免重複（使用 Set 檢查現有元素）
 *    - 只有新發現的用戶會被加入陣列
 *
 * 2. 觸發更新的時機：
 *    - 頁面滾動（每 2 秒一次，有節流機制）
 *    - Sidepanel 開啟時
 *    - 頁面載入後 5 秒（初始載入）
 *
 * 【與 sidepanel.js 的關係】
 * - currentUserElementsData（content.js）→ 只儲存 account 名稱傳給 sidepanel
 * - sidepanel.js 的 currentGetUserListArray 會接收這些 account 名稱
 * - DOM 元素無法通過 chrome message passing 傳遞，所以只傳帳號名稱
 * - content.js 保留元素引用，用於後續在頁面上操作標籤
 *
 * 【注意事項】
 * - 此陣列會持續累積，不會清空（除非頁面重新載入）
 * - 可能包含已經不在頁面上的元素（DOM 已被移除）
 * - 在使用元素前應檢查 element.parentElement 是否存在
 */
let currentUserElementsData = [];

// 常見的國家/區域清單（可以根據需要擴充）
const REGIONS_DATA = [
  // 亞洲
  { "en": "Taiwan", "zh_tw": "台灣", "emoji": "🇹🇼" },
  { "en": "China", "zh_tw": "中國", "emoji": "🇨🇳" },
  { "en": "Japan", "zh_tw": "日本", "emoji": "🇯🇵" },
  { "en": "Korea", "zh_tw": "韓國", "emoji": "🇰🇷" },
  { "en": "Hong Kong", "zh_tw": "香港", "emoji": "🇭🇰" },
  { "en": "Singapore", "zh_tw": "新加坡", "emoji": "🇸🇬" },
  { "en": "Malaysia", "zh_tw": "馬來西亞", "emoji": "🇲🇾" },
  { "en": "Thailand", "zh_tw": "泰國", "emoji": "🇹🇭" },
  { "en": "Vietnam", "zh_tw": "越南", "emoji": "🇻🇳" },
  { "en": "Philippines", "zh_tw": "菲律賓", "emoji": "🇵🇭" },
  { "en": "Indonesia", "zh_tw": "印尼", "emoji": "🇮🇩" },
  { "en": "India", "zh_tw": "印度", "emoji": "🇮🇳" },
  { "en": "Pakistan", "zh_tw": "巴基斯坦", "emoji": "🇵🇰" },
  { "en": "Bangladesh", "zh_tw": "孟加拉", "emoji": "🇧🇩" },
  { "en": "Afghanistan", "zh_tw": "阿富汗", "emoji": "🇦🇫" },
  { "en": "Uzbekistan", "zh_tw": "烏茲別克", "emoji": "🇺🇿" },
  { "en": "Cambodia", "zh_tw": "柬埔寨", "emoji": "🇰🇭" },
  { "en": "Laos", "zh_tw": "寮國", "emoji": "🇱🇦" },
  { "en": "Saudi Arabia", "zh_tw": "沙烏地阿拉伯", "emoji": "🇸🇦" },
  // 北美
  { "en": "United States", "zh_tw": "美國", "emoji": "🇺🇸" },
  { "en": "USA", "zh_tw": "美國", "emoji": "🇺🇸" },
  { "en": "US", "zh_tw": "美國", "emoji": "🇺🇸" },
  { "en": "Canada", "zh_tw": "加拿大", "emoji": "🇨🇦" },
  // 歐洲
  { "en": "United Kingdom", "zh_tw": "英國", "emoji": "🇬🇧" },
  { "en": "UK", "zh_tw": "英國", "emoji": "🇬🇧" },
  { "en": "France", "zh_tw": "法國", "emoji": "🇫🇷" },
  { "en": "Germany", "zh_tw": "德國", "emoji": "🇩🇪" },
  { "en": "Italy", "zh_tw": "義大利", "emoji": "🇮🇹" },
  { "en": "Spain", "zh_tw": "西班牙", "emoji": "🇪🇸" },
  { "en": "Netherlands", "zh_tw": "荷蘭", "emoji": "🇳🇱" },
  { "en": "Bulgaria", "zh_tw": "保加利亞", "emoji": "🇧🇬" },
  { "en": "Czech Republic", "zh_tw": "捷克", "emoji": "🇨🇿" },
  // 非洲
  { "en": "Tunisia", "zh_tw": "突尼西亞", "emoji": "🇹🇳" },
  { "en": "Kenya", "zh_tw": "肯亞", "emoji": "🇰🇪" },
  { "en": "Libya", "zh_tw": "利比亞", "emoji": "🇱🇾" },
  { "en": "Nigeria", "zh_tw": "奈及利亞", "emoji": "🇳🇬" },
  // 南美
  { "en": "Colombia", "zh_tw": "哥倫比亞", "emoji": "🇨🇴" },
  { "en": "Chile", "zh_tw": "智利", "emoji": "🇨🇱" },
  // 大洋洲
  { "en": "Australia", "zh_tw": "澳洲", "emoji": "🇦🇺" },
  { "en": "New Zealand", "zh_tw": "紐西蘭", "emoji": "🇳🇿" },
  // 其他
  { "en": "Brazil", "zh_tw": "巴西", "emoji": "🇧🇷" },
  { "en": "Mexico", "zh_tw": "墨西哥", "emoji": "🇲🇽" },
  { "en": "Russia", "zh_tw": "俄羅斯", "emoji": "🇷🇺" }
];

/**
 * 檢測頁面是否處於深色模式
 * @returns {boolean} true 表示深色模式，false 表示淺色模式
 */
function isPageInDarkMode() {
  const htmlElement = document.documentElement;
  return htmlElement.classList.contains('__fb-dark-mode');
}

/**
 * 根據深色/淺色模式返回灰色標籤的背景顏色
 * @returns {string} 顏色代碼
 */
function getGrayLabelBgColor() {
  return isPageInDarkMode() ? GRAY_LABEL_BG_COLOR_IN_DARK_MODE : GRAY_LABEL_BG_COLOR;
}

/**
 * 根據深色/淺色模式返回灰色文字顏色
 * @returns {string} 顏色代碼
 */
function getGrayTextColor() {
  return isPageInDarkMode() ? GRAY_TEXT_COLOR_DARK_MODE : GRAY_TEXT_COLOR;
}

// 监听来自 sidepanel 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // 處理 ping（確認 content script 已載入）
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'pong' });
    return false;
  }

  // 處理查詢 Threads 用戶所在區域
  if (request.action === 'queryUserRegion') {
    try {
      const account = request.account;

      if (!account) {
        sendResponse({
          success: false,
          error: '未提供帳號名稱'
        });
        return false;
      }

      // 查詢用戶國家/區域
      const region = findUserRegion(account);

      sendResponse({
        success: true,
        account: account,
        region: region
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
    return false;
  }

  // 處理列出頁面上所有用戶帳號
  if (request.action === 'listAllUsers') {
    try {
      const newUsersData = getAllUsersOnPage();

      // 合併新舊資料，避免重複
      // 建立一個 Set 來記錄已存在的元素
      const existingElements = new Set(currentUserElementsData.map(u => u.element));

      // 過濾出新的用戶（元素不在現有列表中的）
      const newUniqueUsers = newUsersData.filter(user => !existingElements.has(user.element));

      // 將新用戶加入到現有列表
      currentUserElementsData = [...currentUserElementsData, ...newUniqueUsers];

      //console.log(`[Threads] 列出用戶: 原有 ${currentUserElementsData.length - newUniqueUsers.length} 個，新增 ${newUniqueUsers.length} 個，總共 ${currentUserElementsData.length} 個`);

      // 只傳帳號名稱給 sidepanel（DOM 元素無法通過 message passing 傳遞）
      const accountNames = currentUserElementsData.map(user => user.account);

      sendResponse({
        success: true,
        users: accountNames,
        count: currentUserElementsData.length,
        newCount: newUniqueUsers.length
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
    return false;
  }

  // 處理顯示用戶資訊標籤
  if (request.action === 'showRegionLabels') {
    try {
      const regionData = request.regionData || {}; // { "@username": "Taiwan", ... }

      const result = showRegionLabelsOnPage(regionData);

      sendResponse({
        success: true,
        addedCount: result.addedCount,
        totalCount: result.totalCount
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
    return false;
  }

  // 處理隱藏用戶資訊標籤
  if (request.action === 'hideRegionLabels') {
    try {
      const result = hideRegionLabelsOnPage();

      sendResponse({
        success: true,
        hiddenCount: result.hiddenCount
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
    return false;
  }

  // 處理移除用戶資訊標籤（完全刪除）
  if (request.action === 'removeRegionLabels') {
    try {
      console.log('[Threads] 收到移除標籤請求');
      const result = removeRegionLabelsOnPage();

      sendResponse({
        success: true,
        removedCount: result.removedCount
      });
    } catch (error) {
      console.error('[Threads] 移除標籤失敗:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
    return false;
  }

  // 處理自動化查詢區域（新分頁自動化流程）
  if (request.action === 'autoQueryRegion') {
    (async () => {
      try {
        const account = request.account;
        console.log(`[Threads] 開始自動化查詢 @${account} 的所在地區`);

        // 檢查是否遇到 HTTP 429 錯誤
        const is429Error = checkFor429Error(account);
        if (is429Error) {
          console.log(`[Threads] 偵測到 HTTP 429 錯誤`);
          sendResponse({
            success: false,
            error: 'HTTP_429',
            errorMessage: '已經超過查詢用量上限'
          });
          return;
        }

        // 步驟 1: 找到並點擊 "About this profile" 按鈕
        const region = await autoClickAboutProfileAndGetRegion();

        // 檢查是否為 ME_UI_ISSUE 錯誤（自己的帳號）
        if (region && typeof region === 'object' && region.error === 'ME_UI_ISSUE') {
          console.log(`[Threads] 偵測到 ME_UI_ISSUE 錯誤（這是自己的帳號）`);
          sendResponse({
            success: false,
            error: 'ME_UI_ISSUE',
            errorMessage: '這是自己的帳號'
          });
          return;
        }

        // 檢查是否為速率限制錯誤
        if (region && typeof region === 'object' && region.error === 'RATE_LIMIT') {
          console.log(`[Threads] 偵測到速率限制錯誤（找不到 About this profile 按鈕）`);
          sendResponse({
            success: false,
            error: 'HTTP_429',
            errorMessage: '已經超過查詢用量上限'
          });
          return;
        }

        if (region) {
          console.log(`[Threads] 成功取得地區: ${region}`);
          sendResponse({
            success: true,
            account: account,
            region: region
          });
        } else {
          console.log(`[Threads] 未找到地區資訊`);
          /*
          sendResponse({
            success: false,
            error: '未找到地區資訊'
          });*/
          sendResponse({
            success: true,
            account: account,
            region: null
          });
        }
      } catch (error) {
        console.log(`[Threads] 自動化查詢錯誤:`, error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    return true; // 保持消息通道打開以進行異步響應
  }

  // 處理 sidepanel 開啟事件
  if (request.action === 'sidepanelOpened') {
    try {
      console.log('[Threads] 收到 sidepanel 開啟通知，執行 handlePageScroll（跳過節流）');
      handlePageScroll(true);
      sendResponse({ success: true });
    } catch (error) {
      console.log('[Threads] 處理 sidepanel 開啟事件時發生錯誤:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  // 處理提取頁面文字請求（用於用戶側寫分析）
  if (request.action === 'extractPageText') {
    try {
      console.log('[Threads] 收到提取頁面文字請求');
      const pageText = extractTextFromDocument();
      sendResponse({ success: true, text: pageText });
    } catch (error) {
      console.log('[Threads] 提取頁面文字時發生錯誤:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  // 處理頁面捲動請求（用於側寫分析時載入更多內容）
  if (request.action === 'performScroll') {
    try {
      // 計算每頁的捲動距離（使用視窗高度）
      const pageHeight = window.innerHeight;
      // 加入上下 25% 的隨機距離 (0.75 ~ 1.25)
      const randomFactor = 0.75 + Math.random() * 0.5;
      const totalScrollDistance = pageHeight * randomFactor;

      // 向下捲動指定的距離
      window.scrollBy({
        top: totalScrollDistance,
        behavior: 'smooth'
      });

      console.log(`[Threads] 執行頁面捲動，距離: ${Math.round(totalScrollDistance)}px`);
      sendResponse({ success: true, scrollDistance: totalScrollDistance });
    } catch (error) {
      console.log('[Threads] 執行頁面捲動時發生錯誤:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  // 處理獲取手動信任清單統計
  if (request.action === 'getTrustListStats') {
    try {
      const trustList = getManualTrustList();
      sendResponse({ success: true, count: trustList.length });
    } catch (error) {
      console.error('[Threads] 獲取手動信任清單統計失敗:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  // 處理獲取所有手動信任清單
  if (request.action === 'getAllTrustList') {
    try {
      const trustList = getManualTrustList();
      sendResponse({ success: true, trustList: trustList });
    } catch (error) {
      console.error('[Threads] 獲取手動信任清單失敗:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  // 處理清除手動信任清單
  if (request.action === 'clearTrustList') {
    try {
      localStorage.removeItem(MANUAL_TRUST_LIST_KEY);
      console.log('[Threads] 手動信任清單已清除');
      
      // 刷新頁面上的所有標籤（移除信任按鈕，恢復灰色標籤）
      const labels = document.querySelectorAll('.threads-region-label');
      labels.forEach(label => {
        const trustBtn = label.querySelector('.threads-trust-btn');
        if (trustBtn) {
          trustBtn.remove();
        }
      });
      
      sendResponse({ success: true });
    } catch (error) {
      console.error('[Threads] 清除手動信任清單失敗:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }
});

// 頁面加載完成後的初始化
console.log('Threads Source Reveal - Content Script 已加載');

// 工具：等待 DOM ready（避免太早抓不到元素）
function waitForDomReady() {
  if (document.readyState === 'loading') {
    return new Promise((resolve) => {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }
  return Promise.resolve();
}


// ==================== Threads 用戶國家查詢功能 ====================

/**
 * 列出頁面上所有用戶帳號
 * @returns {Array<Object>} 用戶帳號列表，格式：[{account: "@username", element: Element}, ...]
 */
function getAllUsersOnPage() {


  try {
    const usersMap = new Map(); // 使用 Map 避免重複，key 為 element（同一帳號可能有多個元件）

    // 找出所有符合 <a href="/@xxx" role="link"> 的元素
    const userLinks = document.querySelectorAll('a[role="link"][href*="/@"]');

    userLinks.forEach(link => {
      const href = link.getAttribute('href');
      const match = href.match(/\/@([^/?]+)/);

      if (match && match[1]) {
        // 檢查此鏈接是否包含 <svg aria-label="Profile" 或 "個人檔案" role="img">
        // 支持多語言：英文 "Profile" 或 繁體中文 "個人檔案"
        const profileSvg = link.querySelector('svg[aria-label="Profile"][role="img"]') ||
                          link.querySelector('svg[aria-label="個人檔案"][role="img"]');

        // 如果包含 Profile SVG，則跳過此鏈接
        if (profileSvg) {
          const svgLabel = profileSvg.getAttribute('aria-label');
          //console.log(`[Threads] 跳過包含 Profile SVG 的鏈接 (${svgLabel}): ${href}`);
          return;
        }

        const username = match[1];

        // 檢查是否包含 <span translate="no">
        const usernameSpan = link.querySelector(`span[translate="no"]`);
        if (!usernameSpan) {
          //console.log(`[Threads] 跳過不包含 translate="no" span 的鏈接: ${href}`);
          return;
        }
        const account = `@${username}`;

        // 使用 element 作為 key，避免同一帳號多個元件被忽略
        if (!usersMap.has(link)) {
          usersMap.set(link, {
            account: account,
            element: link
          });
        }
      }
    });

    // 將 Map 轉換為 Array 並按帳號名稱排序
    const usersArray = Array.from(usersMap.values());
    usersArray.sort((a, b) => a.account.localeCompare(b.account));

    console.log(`[Threads] 找到 ${usersArray.length} 個用戶帳號`);
    return usersArray;

  } catch (error) {
    console.log('getAllUsersOnPage 錯誤:', error);
    return [];
  }
}

/**
 * 查詢指定帳號的國家/區域
 * @param {string} account - 帳號名稱（可包含或不包含 @ 符號）
 * @returns {string|null} 國家/區域名稱，若未找到則返回 null
 */
function findUserRegion(account) {
  const url = window.location.href;

  if (!url.includes('threads.com')) {
    return '此功能僅適用於 Threads 網站';
  }

  // 移除 @ 符號（如果有的話）
  const username = account.startsWith('@') ? account.slice(1) : account;

  try {
    //在用戶個人資料頁面上查找
    if (url.includes(`/@${username}`)) {
      // 在個人資料頁面
      const region = findRegionOnProfilePage();
      if (region) return region;
    }
    else
    {
      return null;
    }
  } catch (error) {
    console.log('findUserRegion 錯誤:', error);
    return `錯誤: ${error.message}`;
  }
}

/**
 * 從元素及其周圍查找國家/區域資訊
 * @param {Element} element - DOM 元素
 * @returns {string|null} 國家/區域名稱
 */
function findUserRegionFromElement(element) {
  if (!element) return null;

  try {
    // 向上尋找父層容器（通常用戶資訊會在同一個容器內）
    let container = element;
    for (let i = 0; i < 5; i++) {
      if (!container.parentElement) break;
      container = container.parentElement;

      // 在容器內搜尋國家資訊
      const text = container.innerText || container.textContent;
      const region = extractRegionFromText(text);
      if (region) return region;
    }

    // 檢查 siblings（兄弟節點）
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      for (const sibling of siblings) {
        const text = sibling.innerText || sibling.textContent;
        const region = extractRegionFromText(text);
        if (region) return region;
      }
    }

    return null;
  } catch (error) {
    console.log('findUserRegionFromElement 錯誤:', error);
    return null;
  }
}

/**
 * 在個人資料頁面上查找國家/區域
 * @returns {string|null} 國家/區域名稱
 */
function findRegionOnProfilePage() {
  try {
    // Threads 個人資料頁面的國家資訊通常在用戶名稱附近
    // 可能的選擇器（需要根據實際 DOM 結構調整）

    // 方法 1: 查找包含國家資訊的特定元素
    const bioElements = document.querySelectorAll('[class*="bio"], [class*="profile"], [class*="user-info"]');

    for (const el of bioElements) {
      const text = el.innerText || el.textContent;
      const region = extractRegionFromText(text);
      if (region) return region;
    }

    // 方法 2: 從頁面文字中提取
    const pageText = document.body.innerText;
    const lines = pageText.split('\n');

    // 在前 20 行中尋找國家資訊（個人資料通常在頁面上方）
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const region = extractRegionFromText(lines[i]);
      if (region) return region;
    }

    return null;
  } catch (error) {
    console.log('findRegionOnProfilePage 錯誤:', error);
    return null;
  }
}

/**
 * 解析互動數字（支援 K、M 等單位）
 * @param {string} text - 數字文字，如 "7.6K", "40.3K", "1.2M"
 * @returns {number} 解析後的數字
 */
function parseEngagementCount(text) {
  if (!text) return 0;
  
  text = text.trim().toUpperCase();
  
  // 移除逗號
  text = text.replace(/,/g, '');
  
  // 解析 K (千)
  if (text.endsWith('K')) {
    const num = parseFloat(text.slice(0, -1));
    return Math.round(num * 1000);
  }
  
  // 解析 M (百萬)
  if (text.endsWith('M')) {
    const num = parseFloat(text.slice(0, -1));
    return Math.round(num * 1000000);
  }
  
  // 解析 B (十億)
  if (text.endsWith('B')) {
    const num = parseFloat(text.slice(0, -1));
    return Math.round(num * 1000000000);
  }
  
  // 直接解析數字
  const num = parseFloat(text);
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * 從文字中提取國家/區域資訊
 * @param {string} text - 要分析的文字
 * @returns {string|null} 國家/區域名稱
 */
function extractRegionFromText(text) {
  if (!text) return null;

  // 嘗試匹配國家名稱
  for (const region of REGIONS_DATA) {
    // 使用正則表達式進行不區分大小寫的匹配（匹配英文或中文）
    const regexEn = new RegExp(`\\b${region.en}\\b`, 'i');
    const regexZh = new RegExp(region.zh_tw, 'i');
    if (regexEn.test(text) || regexZh.test(text)) {
      return region.en;
    }
  }

  // 嘗試匹配國家代碼（如 🇹🇼、🇺🇸 等旗幟 emoji）
  const flagMatch = text.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  if (flagMatch) {
    return flagEmojiToCountry(flagMatch[0]);
  }

  return null;
}

/**
 * 將旗幟 emoji 轉換為國家名稱
 * @param {string} flag - 旗幟 emoji
 * @returns {string} 國家名稱
 */
function flagEmojiToCountry(flag) {
  // 使用 REGIONS_DATA 查找對應的國家
  const region = REGIONS_DATA.find(r => r.emoji === flag);
  return region ? region.en : flag;
}

// ==================== 自動化查詢功能 ====================

/**
 * 自動點擊 "About this profile" 並取得地區資訊
 * @returns {Promise<string|null|{error: string}>} 地區名稱或錯誤物件
 */
async function autoClickAboutProfileAndGetRegion() {
  try {
    // 步驟 1: 找到並點擊 "More" 按鈕（第二個）
    console.log('[Threads] 步驟 1: 尋找 "More" 按鈕');

    const moreSvgs = document.querySelectorAll('svg[aria-label="More"]');

    if (!moreSvgs || moreSvgs.length < 4) {
      console.log('[Threads] 找不到第四個 "More" 按鈕的 SVG，目前找到:', moreSvgs?.length || 0);
      return null;
    }

    const moreSvg = moreSvgs[3]; // 選擇第四個 More 按鈕

    console.log('[Threads] 找到第四個 "More" SVG:', moreSvg);

    // 往上找第一個 div[role="button"]
    const moreButton = findParentButton(moreSvg);

    if (!moreButton) {
      console.log('[Threads] 找不到 "More" 的按鈕');
      return null;
    }

    console.log('[Threads] 找到 "More" 按鈕:', moreButton);

    // 隨機等待 2-4 秒後再點擊，避免被當成自動化程式
    const randomDelay1 = Math.random() * 2000 + 2000; 
    console.log(`[Threads] 等待 ${Math.round(randomDelay1)}ms 後點擊 "More" 按鈕`);
    await waitForMilliseconds(randomDelay1);

    // 點擊 More 按鈕
    console.log('[Threads] 點擊 "More" 按鈕');
    moreButton.click();

    // 等待選單出現
    console.log('[Threads] 等待選單出現');
    await waitForMilliseconds(1000);

    // 步驟 2: 找到並點擊 "About this profile" 按鈕
    console.log('[Threads] 步驟 2: 尋找 "About this profile" 按鈕');

    const aboutSpan = findSpanWithText('About this profile');

    if (!aboutSpan) {
      console.log('[Threads] 找不到 "About this profile" 文字');
      
      // 檢查是否有 "Insights" 按鈕（表示是自己的帳號）
      const insightsSpan = findSpanWithText('Insights');
      if (insightsSpan) {
        console.log('[Threads] 找到 "Insights" 按鈕，判定為自己的帳號');
        return { error: 'ME_UI_ISSUE' };
      }
      
      // 如果沒有 Insights，則維持原本的 RATE_LIMIT 錯誤
      return { error: 'RATE_LIMIT' };
    }

    console.log('[Threads] 找到 "About this profile" span:', aboutSpan);

    // 往上找第一個 div[role="button"]
    const aboutButton = findParentButton(aboutSpan);

    if (!aboutButton) {
      console.log('[Threads] 找不到 About this profile 的按鈕');
      return { error: 'RATE_LIMIT' };
    }

    console.log('[Threads] 找到 "About this profile" 按鈕:', aboutButton);

    // 隨機等待 2-4 秒後再點擊，避免被當成自動化程式
    const randomDelay2 = Math.random() * 2000 + 2000; 
    console.log(`[Threads] 等待 ${Math.round(randomDelay2)}ms 後點擊 "About this profile" 按鈕`);
    await waitForMilliseconds(randomDelay2);

    // 點擊按鈕
    console.log('[Threads] 步驟 3: 點擊 "About this profile" 按鈕');
    aboutButton.click();

    // 步驟 3: 等待 popup 出現
    console.log('[Threads] 步驟 4: 等待 popup 出現');
    await waitForMilliseconds(1000); // 等待 popup 動畫完成

    // 步驟 4: 找到 "Based in" 的 <span>
    console.log('[Threads] 步驟 5: 尋找 "Based in" 資訊');
    let basedInSpan = findSpanWithText('Based in');

    if (!basedInSpan) {
      // 多等 2 秒再試一次
      console.log('[Threads] 找不到 "Based in" 文字，等待 2 秒後重試...');
      await waitForMilliseconds(2000);
      basedInSpan = findSpanWithText('Based in');
    }

    if (!basedInSpan) {
      console.log('[Threads] 找不到 "Based in" 文字');
      return null;
    }

    console.log('[Threads] 找到 "Based in" span:', basedInSpan);

    // 步驟 5: 取得下一個兄弟 <span> 的文字（就是地區）
    const region = getNextSpanText(basedInSpan);

    if (!region) {
      console.log('[Threads] 找不到地區資訊');
      return null;
    }

    console.log('[Threads] 步驟 6: 成功取得地區:', region);
    return region;

  } catch (error) {
    console.log('[Threads] autoClickAboutProfileAndGetRegion 錯誤:', error);
    return null;
  }
}

/**
 * 找到包含指定文字的 <span> 元素
 * @param {string} text - 要尋找的文字
 * @returns {Element|null} 找到的 span 元素
 */
function findSpanWithText(text) {
  const allSpans = document.querySelectorAll('span');

  for (const span of allSpans) {
    // 使用 textContent 或 innerText 進行比對
    const spanText = (span.textContent || span.innerText || '').trim();
    
    if (spanText === text) {
      return span;
    }
  }

  return null;
}

/**
 * 從元素往上找第一個 div[role="button"]
 * @param {Element} element - 起始元素
 * @returns {Element|null} 找到的按鈕元素
 */
function findParentButton(element) {
  let current = element;
  let maxDepth = 15; // 最多往上找 15 層
  let depth = 0;

  while (current && depth < maxDepth) {
    current = current.parentElement;
    depth++;

    if (!current) break;

    // 檢查是否為 div[role="button"]
    if (current.tagName.toLowerCase() === 'div' && current.getAttribute('role') === 'button') {
      return current;
    }
  }

  return null;
}

/**
 * 取得指定元素的下一個 <span> 兄弟元素的文字
 * @param {Element} element - 起始元素
 * @returns {string|null} 下一個 span 的文字內容
 */
function getNextSpanText(element) {
  // 方法 1: 直接取得下一個兄弟元素
  let nextSibling = element.nextElementSibling;

  if (nextSibling && nextSibling.tagName.toLowerCase() === 'span') {
    const text = (nextSibling.textContent || nextSibling.innerText || '').trim();
    if (text) return text;
  }

  // 方法 2: 在父容器中尋找
  const parent = element.parentElement;
  if (!parent) return null;

  const allSpans = parent.querySelectorAll('span');
  let foundCurrent = false;

  for (const span of allSpans) {
    if (foundCurrent) {
      const text = (span.textContent || span.innerText || '').trim();
      if (text && text !== 'Based in') {
        return text;
      }
    }

    if (span === element) {
      foundCurrent = true;
    }
  }

  // 方法 3: 向上一層找
  const grandparent = parent.parentElement;
  if (!grandparent) return null;

  const allSpansInGrandparent = grandparent.querySelectorAll('span');
  foundCurrent = false;

  for (const span of allSpansInGrandparent) {
    if (foundCurrent) {
      const text = (span.textContent || span.innerText || '').trim();
      if (text && text !== 'Based in') {
        return text;
      }
    }

    if (span === element) {
      foundCurrent = true;
    }
  }

  return null;
}

/**
 * 檢查頁面是否顯示 HTTP 429 錯誤
 * @param {string} account - 查詢的帳號名稱（可包含或不包含 @ 符號）
 * @returns {boolean} 是否為 429 錯誤頁面
 */
function checkFor429Error(account) {
  try {
    // 檢查頁面標題
    const pageTitle = document.title || '';
    console.log(`[Threads] 檢查 429 錯誤 - 頁面標題: "${pageTitle}"`);
    
    if (pageTitle.includes('429') || pageTitle.toLowerCase().includes('too many requests')) {
      console.log('[Threads] 在頁面標題中偵測到 429 錯誤');
      return true;
    }

    // 檢查頁面內容
    const bodyText = document.body.innerText || document.body.textContent || '';
    const bodyTextPreview = bodyText.substring(0, 200); // 只記錄前 200 字元
    console.log(`[Threads] 檢查 429 錯誤 - 頁面內容預覽: "${bodyTextPreview}"`);
    
    // 常見的 429 錯誤訊息（包含 Chrome 預設錯誤頁面的格式）
    const error429Patterns = [
      /HTTP ERROR 429/i,           // Chrome 預設錯誤頁面
      /HTTP.*429/i,                 // 其他 HTTP 429 格式
      /too many requests/i,
      /rate limit/i,
      /請求過多/i,
      /超過.*限制/i,
      /請稍後再試/i,
      /這個網頁無法正常運作/i      // Chrome 中文錯誤頁面
    ];

    // 移除 @ 符號（如果有的話）
    const username = account ? (account.startsWith('@') ? account.slice(1) : account) : '';
    
    // only check content if pageTitle does not contain user account name
    if (!pageTitle.includes(username)) {
    
      for (const pattern of error429Patterns) {
        if (pattern.test(bodyText)) {
          console.log(`[Threads] 在頁面內容中偵測到 429 錯誤，匹配模式: ${pattern}`);
          return true;
        }
      }


      // 檢查是否有錯誤訊息元素
      const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"], [id*="error"], [id*="Error"]');
      console.log(`[Threads] 找到 ${errorElements.length} 個錯誤元素`);
      
      for (const el of errorElements) {
        const text = el.innerText || el.textContent || '';
        if (/429|too many requests|rate limit|HTTP ERROR/i.test(text)) {
          console.log(`[Threads] 在錯誤元素中偵測到 429 錯誤: "${text.substring(0, 100)}"`);
          return true;
        }
      }
    }

    console.log('[Threads] 未偵測到 429 錯誤');
    return false;
  } catch (error) {
    console.error('[Threads] 檢查 429 錯誤時發生錯誤:', error);
    return false;
  }
}

/**
 * 等待指定的毫秒數
 * @param {number} ms - 毫秒數
 * @returns {Promise<void>}
 */
function waitForMilliseconds(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 在頁面上顯示/隱藏用戶資訊標籤功能 ====================

// 顏色判斷條件常數（方便未來調整）
const RED_FLAG_LOCATION = 'China';
const RED_FLAG_PROFILE_TAGS = [ '仇恨言論','統戰言論'];
const GRAY_FLAG_PROFILE_TAGS = [ '易怒','謾罵','人身攻擊','詐騙風險','統戰言論','仇恨言論','刻意引戰','攻擊發言','惡意嘲諷'];
const GRAY_FLAG_LOCATION = ['China',  'India','Bangladesh','Afghanistan','Uzbekistan','Tunisia','Kenya','Brazil','Bulgaria','Saudi Arabia','Libya','Nigeria','Czech Republic','Colombia','Cambodia','Russia','Pakistan','Laos','Chile']; // 灰色標籤的地點
const GREEN_FLAG_LOCATION = 'Taiwan';
const NOT_USE_RED_FLAG = true; // 由於本機模型能力有限，暫時不使用紅色標籤
const GRAY_LABEL_BG_COLOR = '#9e9e9e'; // 灰色標籤的背景顏色
const GRAY_TEXT_COLOR = '#cccccce6'; // 灰色標籤對應的貼文文字顏色
const GRAY_LABEL_BG_COLOR_IN_DARK_MODE = '#616161'; // 深色模式下灰色標籤的背景顏色
const GRAY_TEXT_COLOR_DARK_MODE = '#333333'; // 灰色標籤對應的貼文文字顏色
const MANUAL_TRUST_LIST_KEY = 'manualTrustList'; // localStorage 中手動信任清單的鍵名

// ==================== 手動信任清單管理 ====================

/**
 * 從 localStorage 讀取手動信任清單
 * @returns {Array<string>} 信任的帳號列表（帶 @ 符號）
 */
function getManualTrustList() {
  try {
    const stored = localStorage.getItem(MANUAL_TRUST_LIST_KEY);
    if (stored) {
      const list = JSON.parse(stored);
      return Array.isArray(list) ? list : [];
    }
    return [];
  } catch (error) {
    console.error('[Threads] 讀取手動信任清單失敗:', error);
    return [];
  }
}

/**
 * 將帳號加入手動信任清單
 * @param {string} account - 帳號名稱（帶 @ 符號）
 * @returns {boolean} 是否成功加入
 */
function addToManualTrustList(account) {
  try {
    const list = getManualTrustList();
    if (!list.includes(account)) {
      list.push(account);
      localStorage.setItem(MANUAL_TRUST_LIST_KEY, JSON.stringify(list));
      console.log(`[Threads] 已將 ${account} 加入手動信任清單`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Threads] 加入手動信任清單失敗:', error);
    return false;
  }
}

/**
 * 從手動信任清單移除帳號
 * @param {string} account - 帳號名稱（帶 @ 符號）
 * @returns {boolean} 是否成功移除
 */
function removeFromManualTrustList(account) {
  try {
    const list = getManualTrustList();
    const index = list.indexOf(account);
    if (index > -1) {
      list.splice(index, 1);
      localStorage.setItem(MANUAL_TRUST_LIST_KEY, JSON.stringify(list));
      console.log(`[Threads] 已將 ${account} 從手動信任清單移除`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Threads] 從手動信任清單移除失敗:', error);
    return false;
  }
}

/**
 * 檢查帳號是否在手動信任清單中
 * @param {string} account - 帳號名稱（帶 @ 符號）
 * @returns {boolean} 是否在清單中
 */
function isInManualTrustList(account) {
  const list = getManualTrustList();
  return list.includes(account);
}

/**
 * 根據地區名稱和側寫標籤返回對應的標籤顏色
 * @param {string} region - 地區名稱
 * @param {string} profile - 側寫標籤（逗號分隔）
 * @param {string} account - 帳號名稱（用於檢查手動信任清單）
 * @param {string} regionQueryStatus - 查詢狀態（可選）
 * @returns {Object} 包含 backgroundColor 和 textColor 的物件
 */
function getRegionColor(region, profile = null, account = null, regionQueryStatus = null) {
  // 0. 優先檢查手動信任清單：如果在清單中，一律顯示為綠色
  if (account && isInManualTrustList(account)) {
    return {
      backgroundColor: '#4caf50',
      textColor: 'white'
    };
  }
  
  // 1. 處理 region 為 null 的情況，根據 regionQueryStatus 決定顏色
  if (!region && !profile) {
    // 1.1 未查詢或查詢中或查詢失敗：黃色
    if (!regionQueryStatus || regionQueryStatus === 'in_progress' || 
        regionQueryStatus === 'fail_http429' || regionQueryStatus === 'fail_me') {
      return {
        backgroundColor: '#ffc107',
        textColor: '#333'
      };
    }
    // 1.2 未揭露（該帳號尚未開放地點功能）：灰色
    if (regionQueryStatus === 'fail_not_rollout_yet') {
      return {
        backgroundColor: getGrayLabelBgColor(),
        textColor: 'white'
      };
    }
    // 1.3 其他情況：黃色（預設）
    return {
      backgroundColor: '#ffc107',
      textColor: '#333'
    };
  }

  // 2. 已完成查詢（有地區或有側寫）
  // 檢查側寫標籤是否包含紅旗標籤或灰旗標籤
  // 支援新格式「標籤:理由」，只取標籤部分進行比對
  const profileTags = profile ? profile.split(',').map(entry => {
    const trimmed = entry.trim();
    const colonIndex = trimmed.indexOf(':') !== -1 ? trimmed.indexOf(':') : trimmed.indexOf('：');
    return colonIndex > 0 ? trimmed.substring(0, colonIndex).trim() : trimmed;
  }) : [];
  const hasRedFlagProfileTag = profileTags.some(tag => 
    RED_FLAG_PROFILE_TAGS.includes(tag)
  );
  const hasGrayFlagProfileTag = profileTags.some(tag => 
    GRAY_FLAG_PROFILE_TAGS.includes(tag)
  );

  // 檢查地點是否符合灰旗條件
  const isGrayFlagLocation = region && (
    GRAY_FLAG_LOCATION.includes(region) || 
    region === 'Not shared' || 
    region === '[未揭露null]' ||
    region === '未揭露'
  );

  if( NOT_USE_RED_FLAG === false){
    // 2.1 紅色：所在地為 China 或 側寫標籤中有「人身攻擊」或「仇恨言論」（最高優先級）
    if (region === RED_FLAG_LOCATION || region === '中國' || hasRedFlagProfileTag) {
      return {
        backgroundColor: '#f44336',
        textColor: 'white'
      };
    }
  }

  // 2.2 灰色：profile tag 有符合 GRAY_FLAG_PROFILE_TAGS 或 地點標籤有符合 GRAY_FLAG_LOCATION，或地點標籤為 Not shared 或 [未揭露null]
  if (hasGrayFlagProfileTag || isGrayFlagLocation) {
    return {
      backgroundColor: getGrayLabelBgColor(),
      textColor: 'white'
    };
  }

  // 2.3 綠色：其他情況（不再使用 GREEN_FLAG_LOCATION 規則）
  return {
    backgroundColor: '#4caf50',
    textColor: 'white'
  };
}

/**
 * 根據標籤顏色設定貼文內容文字顏色
 * 如果標籤為灰色，則將貼文內容也設為灰色
 * @param {HTMLElement} element - 用戶名稱元素（<a> 標籤）
 * @param {boolean} isGray - 是否為灰色標籤
 */
function setPostContentColor(element, isGray) {
  try {
    // DOM 結構分析（根據實際 Threads DOM）:
    // 
    // 每個貼文區塊的結構：
    // <div class="x1a2a7pz x1n2onr6"> (貼文容器)
    //   <div> (內部容器)
    //     <div> (用戶資訊區：頭像、用戶名、標籤、時間)
    //     <div> (貼文內容區：文字、圖片、影片)
    //
    // 關鍵：找到包含此用戶名稱的貼文容器，只處理該容器內的內容
    
    // 找到貼文容器（向上查找 class 包含 x1a2a7pz 的 div）
    let postContainer = element.closest('div.x1a2a7pz');
    if (!postContainer) {
      // 備用方案：找到 data-pressable-container 的容器
      postContainer = element.closest('[data-pressable-container]');
    }
    if (!postContainer) {
      return;
    }
    
    // 處理此貼文容器內的頭像圖片（在用戶名稱附近的小頭像）
    const avatarImgs = postContainer.querySelectorAll('img[alt*="大頭貼照"]');
    avatarImgs.forEach(img => {
      if (isGray) {
        img.style.opacity = '0.5';
        img.style.filter = 'grayscale(50%) brightness(0.8)';
      } else {
        img.style.removeProperty('opacity');
        img.style.removeProperty('filter');
      }
    });
    
    // 處理貼文內容文字
    // 在貼文容器內尋找所有 span[dir="auto"]
    const outerSpans = postContainer.querySelectorAll('span[dir="auto"]');
    
    outerSpans.forEach((outerSpan) => {
      // 排除所有在連結內的 span（用戶連結、貼文連結、標籤連結等）
      const parentLink = outerSpan.closest('a');
      if (parentLink) {
        return;
      }
      
      // 排除時間元素內的 span
      if (outerSpan.closest('time')) {
        return;
      }
      
      // 排除已經是我們標籤內的 span
      if (outerSpan.closest('.threads-region-label')) {
        return;
      }
      
      // 目標是 outerSpan 內部的第一個 span（實際的文字內容）
      const targetSpan = outerSpan.querySelector('span') || outerSpan;
      
      // 檢查內容是否像是時間格式（排除時間顯示）
      const text = targetSpan.textContent || '';
      if (/^\d{1,2}(小時|天|分鐘|秒)$/.test(text) || /^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
        return;
      }
      
      if (isGray) {
        targetSpan.style.color = getGrayTextColor();
      } else {
        // 恢復原本顏色（移除 inline style）
        targetSpan.style.removeProperty('color');
      }
    });
    
    // 處理視頻/圖片展示區塊的視覺效果
    // 先檢查是否有視頻元素
    const videos = postContainer.querySelectorAll('video');
    const hasVideo = videos.length > 0;
    
    // 處理視頻元素
    videos.forEach(video => {
      if (isGray) {
        video.style.opacity = '0.5';
        video.style.filter = 'grayscale(50%) brightness(0.8)';
      } else {
        video.style.removeProperty('opacity');
        video.style.removeProperty('filter');
      }
    });
    
    // 處理圖片元素（排除頭像，只處理貼文內容圖片）
    const images = postContainer.querySelectorAll('img:not([alt*="大頭貼照"])');
    images.forEach(img => {
      if (isGray) {
        if (hasVideo) {
          // 有視頻時，將圖片設為完全透明（避免預覽圖蓋在視頻前面）
          img.style.opacity = '0';
        } else {
          // 沒有視頻時，正常處理圖片
          img.style.opacity = '0.5';
          img.style.filter = 'grayscale(50%) brightness(0.8)';
        }
      } else {
        img.style.removeProperty('opacity');
        img.style.removeProperty('filter');
      }
    });
    
    // 處理 role="presentation" 的覆蓋層（如果它是用來遮擋的）
    const presentationDivs = postContainer.querySelectorAll('div[role="presentation"]');
    presentationDivs.forEach(div => {
      if (isGray) {
        // 嘗試讓覆蓋層變暗
        div.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        div.style.pointerEvents = 'none';
      } else {
        div.style.removeProperty('background-color');
        div.style.removeProperty('pointer-events');
      }
    });
    
  } catch (error) {
    console.log('[Threads] 設定貼文內容顏色時發生錯誤:', error);
  }
}

/**
 * 從「標籤:理由」格式中提取只有標籤的字串
 * @param {string} profile - 側寫標籤（可能包含理由）
 * @returns {string} 只有標籤的字串
 */
function extractTagsOnly(profile) {
  if (!profile) return '';
  return profile.split(',').map(entry => {
    const trimmed = entry.trim();
    const colonIndex = trimmed.indexOf(':') !== -1 ? trimmed.indexOf(':') : trimmed.indexOf('：');
    return colonIndex > 0 ? trimmed.substring(0, colonIndex).trim() : trimmed;
  }).join(',');
}

/**
 * 從「標籤:理由」格式中提取標籤和理由的陣列
 * @param {string} profile - 側寫標籤（可能包含理由）
 * @returns {Array<{tag: string, reason: string}>} 標籤和理由的陣列
 */
function parseTagsWithReasons(profile) {
  if (!profile) return [];
  return profile.split(',').map(entry => {
    const trimmed = entry.trim();
    const colonIndex = trimmed.indexOf(':') !== -1 ? trimmed.indexOf(':') : trimmed.indexOf('：');
    if (colonIndex > 0) {
      return {
        tag: trimmed.substring(0, colonIndex).trim(),
        reason: trimmed.substring(colonIndex + 1).trim()
      };
    }
    return { tag: trimmed, reason: '' };
  }).filter(item => item.tag.length > 0);
}

/**
 * 創建可點擊的標籤 DOM 元素（點擊顯示理由）
 * @param {Array<{tag: string, reason: string}>} tagsWithReasons - 標籤和理由陣列
 * @returns {HTMLElement} 包含可點擊標籤的容器
 */
function createClickableTagsElement(tagsWithReasons) {
  const container = document.createElement('span');
  container.className = 'threads-tags-container';
  container.style.cssText = 'display: inline; position: relative;';

  tagsWithReasons.forEach((item, index) => {
    if (index > 0) {
      const separator = document.createTextNode(', ');
      container.appendChild(separator);
    }

    const tagSpan = document.createElement('span');
    tagSpan.className = 'threads-clickable-tag';
    tagSpan.textContent = item.tag;
    tagSpan.dataset.reason = item.reason;
    
    // 基本樣式 - 恢復 pointer-events 讓標籤可點擊
    tagSpan.style.cssText = `
      cursor: ${item.reason ? 'pointer' : 'default'};
      border-bottom: ${item.reason ? '1px dashed rgba(255,255,255,0.6)' : 'none'};
      position: relative;
      pointer-events: auto;
    `;

    if (item.reason) {
      // 點擊事件 - 顯示/隱藏 tooltip
      tagSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        // 檢查是否已有 tooltip（現在 tooltip 在 body 中）
        if (tagSpan._currentTooltip && document.body.contains(tagSpan._currentTooltip)) {
          tagSpan._currentTooltip.remove();
          tagSpan._currentTooltip = null;
          return;
        }

        // 關閉其他所有 tooltip
        document.querySelectorAll('.threads-tag-tooltip').forEach(t => t.remove());

        // 創建 tooltip（使用 fixed positioning 避免被父元素 overflow 裁切）
        const tooltip = document.createElement('div');
        tooltip.className = 'threads-tag-tooltip';
        tooltip.textContent = item.reason;
        
        // 取得標籤的位置
        const rect = tagSpan.getBoundingClientRect();
        
        tooltip.style.cssText = `
          position: fixed;
          top: ${rect.bottom + 8}px;
          left: ${rect.left + rect.width / 2}px;
          transform: translateX(-50%);
          background: #333;
          color: #fff;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 400;
          max-width: 280px;
          white-space: normal;
          word-wrap: break-word;
          line-height: 1.4;
          z-index: 2147483647;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          animation: fadeIn 0.15s ease-out;
          pointer-events: none;
        `;

        // 創建小三角形指向標籤（在 tooltip 上方）
        const arrow = document.createElement('div');
        arrow.style.cssText = `
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 6px solid #333;
        `;
        tooltip.appendChild(arrow);

        // 將 tooltip 加到 body 而不是 tagSpan，避免被裁切
        document.body.appendChild(tooltip);

        // 關閉 tooltip 的函數
        const removeTooltip = () => {
          tooltip.remove();
          tagSpan._currentTooltip = null;
          document.removeEventListener('click', closeTooltip);
          window.removeEventListener('scroll', onScroll, true);
        };

        // 點擊其他地方關閉 tooltip
        const closeTooltip = (event) => {
          if (!tagSpan.contains(event.target)) {
            removeTooltip();
          }
        };

        // 頁面捲動時關閉 tooltip
        const onScroll = () => {
          removeTooltip();
        };

        setTimeout(() => {
          document.addEventListener('click', closeTooltip);
          // 使用 capture 模式監聽所有捲動事件（包括子元素的捲動）
          window.addEventListener('scroll', onScroll, true);
        }, 0);

        // 儲存 tooltip 引用以便後續檢查
        tagSpan._currentTooltip = tooltip;
      });
    }

    container.appendChild(tagSpan);
  });

  return container;
}

/**
 * 將國家英文名稱轉換為繁體中文
 * @param {string} countryName - 國家英文名稱
 * @returns {string} 繁體中文名稱，如果找不到則返回原始名稱
 */
function convertCountryNameToZhTw(countryName) {
  if (!countryName) return countryName;
  
  const country = REGIONS_DATA.find(r => r.en === countryName);
  return country ? country.zh_tw : countryName;
}

/**
 * 生成標籤文字
 * @param {string|null} region - 地區
 * @param {string|null} profile - 側寫標籤（可能包含理由）
 * @param {string|null} regionQueryStatus - 查詢狀態（可選）
 * @returns {string} 標籤文字
 */
function generateLabelText(region, profile, regionQueryStatus = null) {
  let text;
  if (region) {
    const regionZh = convertCountryNameToZhTw(region);
    text = `所在地：${regionZh}`;
  } else if (profile) {
    // 有側寫但無地區，顯示「未揭露」
    text = `所在地：未揭露`;
  } else {
    // 根據 regionQueryStatus 顯示不同文字
    if (regionQueryStatus === 'in_progress') {
      text = `所在地：查詢中`;
    } else if (regionQueryStatus === 'fail_http429') {
      text = `所在地：查詢失敗`;
    } else if (regionQueryStatus === 'fail_me') {
      text = `所在地：無法查詢`;
    } else if (regionQueryStatus === 'fail_not_rollout_yet') {
      text = `所在地：未揭露`;
    } else {
      text = `所在地：待查詢`;
    }
  }
  if (profile) {
    // 顯示時只顯示標籤，不顯示理由
    const tagsOnly = extractTagsOnly(profile);
    text += ` (${tagsOnly})`;
  }
  return text;
}

/**
 * 生成標籤 DOM 元素（包含地區和可點擊的側寫標籤）
 * @param {string|null} region - 地區
 * @param {string|null} profile - 側寫標籤（可能包含理由）
 * @param {string|null} regionQueryStatus - 查詢狀態（可選）
 * @returns {HTMLElement} 標籤 DOM 元素
 */
function generateLabelElement(region, profile, regionQueryStatus = null) {
  const container = document.createElement('span');
  container.className = 'threads-label-text';

  // 地區文字
  let locationText;
  if (region) {
    const regionZh = convertCountryNameToZhTw(region);
    locationText = `所在地：${regionZh}`;
  } else if (profile) {
    locationText = `所在地：未揭露`;
  } else {
    // 根據 regionQueryStatus 顯示不同文字
    if (regionQueryStatus === 'in_progress') {
      locationText = `所在地：查詢中`;
    } else if (regionQueryStatus === 'fail_http429') {
      locationText = `所在地：查詢失敗`;
    } else if (regionQueryStatus === 'fail_me') {
      locationText = `所在地：無法查詢`;
    } else if (regionQueryStatus === 'fail_not_rollout_yet') {
      locationText = `所在地：未揭露`;
    } else {
      locationText = `所在地：待查詢`;
    }
  }

  const locationSpan = document.createTextNode(locationText);
  container.appendChild(locationSpan);

  // 如果有側寫，添加可點擊的標籤
  if (profile) {
    const tagsWithReasons = parseTagsWithReasons(profile);
    if (tagsWithReasons.length > 0) {
      const openParen = document.createTextNode(' (');
      container.appendChild(openParen);
      
      const clickableTags = createClickableTagsElement(tagsWithReasons);
      container.appendChild(clickableTags);
      
      const closeParen = document.createTextNode(')');
      container.appendChild(closeParen);
    }
  }

  return container;
}

/**
 * 在頁面上顯示用戶資訊標籤（添加或更新標籤並設為可見）
 * @param {Object} regionData - 地區資料，格式: { "@username": { region: "Taiwan", profile: "標籤" }, ... }
 *                              或舊格式: { "@username": "Taiwan", ... }
 * @returns {Object} 結果 { addedCount, totalCount }
 */
function showRegionLabelsOnPage(regionData) {
  let addedCount = 0;
  const totalCount = currentUserElementsData.length;

  //console.log(`[Threads] 開始在頁面上添加用戶資訊標籤，共 ${totalCount} 個用戶`);

  currentUserElementsData.forEach((userData, index) => {
    try {
      const account = userData.account;
      const element = userData.element;

      if (!element || !element.parentElement) {
        console.warn(`[Threads] 用戶 ${account} 的元素不存在或已被移除`);
        return;
      }

      // 粉絲頁面上的效能優化：檢查元素是否在可視範圍
      const followerCounter = document.getElementById('followerLabelCounter');
      if (followerCounter) {
        // 檢查該用戶元素是否在可視範圍內
        const rect = element.getBoundingClientRect();
        const isInViewport = (
          rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
          rect.bottom > 0 &&
          rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
          rect.right > 0
        );
        
        // 如果不在可視範圍，跳過此用戶的處理
        if (!isInViewport) {
          return;
        }
      }

      // 解析 regionData，支援新舊格式
      let region = null;
      let profile = null;
      let regionQueryStatus = null;
      const accountData = regionData[account];
      
      if (accountData) {
        if (typeof accountData === 'object' && accountData !== null) {
          // 新格式: { region: "Taiwan", profile: "標籤", regionQueryStatus: "success" }
          region = accountData.region;
          profile = accountData.profile;
          regionQueryStatus = accountData.regionQueryStatus;
          console.log(`[Threads] ${account} - region: ${region}, profile: ${profile}, regionQueryStatus: ${regionQueryStatus}`);
        } else {
          // 舊格式: "Taiwan"
          region = accountData;
        }
      }

      // 檢查是否已經添加過標籤（避免重複添加）
      const existingLabel = element.querySelector('.threads-region-label');
      if (existingLabel) {
        // 更新現有標籤

        // 更新文字（選擇文字 span，不是三角形 span）
        const labelTextSpan = existingLabel.querySelector('.threads-label-text') || existingLabel;
        const newText = generateLabelText(region, profile, regionQueryStatus);

        //console.log(`[Threads] 更新標籤文字 ${account}: ${region}`);

        if (labelTextSpan === existingLabel) {
          // 舊版標籤（沒有 span），需要重建
          existingLabel.innerHTML = '';
          
          // 重建時加入三角形
          const colors = getRegionColor(region, profile, account, regionQueryStatus);
          existingLabel.style.position = 'relative';
          existingLabel.style.marginLeft = '12px';
          
          const arrow = document.createElement('span');
          arrow.style.cssText = `
            position: absolute;
            left: -6px;
            top: 50%;
            transform: translateY(-50%);
            width: 0;
            height: 0;
            border-top: 6px solid transparent;
            border-bottom: 6px solid transparent;
            border-right: 6px solid ${colors.backgroundColor};
          `;
          existingLabel.appendChild(arrow);
          
          // 使用可點擊的標籤元素
          const labelElement = generateLabelElement(region, profile, regionQueryStatus);
          existingLabel.appendChild(labelElement);

          // 如果是待查詢且沒有 [C] 按鈕，添加（但如果已有側寫則視為已完成）
          if (!region && !profile) {
            addQueryButton(existingLabel, account, index, labelElement);
          }
        } else {
          // 替換為可點擊的標籤元素
          const newLabelElement = generateLabelElement(region, profile, regionQueryStatus);
          labelTextSpan.replaceWith(newLabelElement);

          // 處理 [C] 按鈕
          const existingButton = existingLabel.querySelector('.threads-query-btn');
          // 已有地區或已有側寫，視為已完成查詢
          const isCompleted = region || profile;
          if (isCompleted && existingButton) {
            // 已查詢，移除按鈕
            existingButton.remove();
          } else if (!isCompleted && !existingButton) {
            // 待查詢且沒有按鈕，添加
            addQueryButton(existingLabel, account, index, labelTextSpan);
          }

          // 如果已完成查詢（有地區或有側寫），添加重新整理按鈕
          if (isCompleted) {
            addRefreshButton(existingLabel, account, labelTextSpan);
          }
        }

        // 更新顏色（根據地區和側寫標籤使用對應顏色）
        const colors = getRegionColor(region, profile, account, regionQueryStatus);
        existingLabel.style.backgroundColor = colors.backgroundColor;
        existingLabel.style.color = colors.textColor;

        // 更新三角形顏色
        const arrowElement = existingLabel.querySelector('span[style*="border-right"]');
        if (arrowElement) {
          arrowElement.style.borderRightColor = colors.backgroundColor;
        }

        // 確保標籤顯示
        existingLabel.style.display = 'inline-flex';

        // 處理手動信任按鈕（只在灰色標籤時顯示）
        const isGray = colors.backgroundColor === getGrayLabelBgColor();
        if (isGray && !isInManualTrustList(account)) {
          addManualTrustButton(existingLabel, account);
        } else {
          // 移除已存在的信任按鈕（如果不是灰色或已在信任清單中）
          const existingTrustBtn = existingLabel.querySelector('.threads-trust-btn');
          if (existingTrustBtn) {
            existingTrustBtn.remove();
          }
        }
        
        // 如果標籤為灰色，將貼文內容也設為灰色
        setPostContentColor(element, isGray);

        //console.log(`[Threads] 更新 ${account} 的標籤: ${newText}`);
        return;
      }

      // 根據地區和側寫標籤取得對應顏色
      const colors = getRegionColor(region, profile, account, regionQueryStatus);

      // 判斷是否需要查詢按鈕（只有待查詢狀態需要，已有地區或已有側寫則視為已完成）
      const needButton = !region && !profile;

      // 創建標籤容器 div
      const label = document.createElement('div');
      label.className = 'threads-region-label';

      // 設定樣式（左方帶小三角形突出的標籤）
      // 使用 pointer-events: none 阻止滑鼠事件觸發用戶小卡 panel
      label.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 12px;
        padding: 2px 8px;
        background-color: ${colors.backgroundColor};
        color: ${colors.textColor};
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        vertical-align: middle;
        position: relative;
        pointer-events: none;
      `;

      // 創建左側三角形
      const arrow = document.createElement('span');
      arrow.style.cssText = `
        position: absolute;
        left: -6px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-top: 6px solid transparent;
        border-bottom: 6px solid transparent;
        border-right: 6px solid ${colors.backgroundColor};
      `;

      // 將三角形加入標籤
      label.appendChild(arrow);

      // 創建文字部分（使用可點擊的標籤元素）
      const labelText = generateLabelElement(region, profile, regionQueryStatus);
      label.appendChild(labelText);

      // 如果需要，添加 [C] 按鈕
      if (needButton) {
        addQueryButton(label, account, index, labelText);
      } else {
        // 已有地區資訊，添加重新整理按鈕
        addRefreshButton(label, account, labelText);
      }

      // 在元素後面插入標籤
      // 方法1: 嘗試直接插入到 element 內部
      if (element.childNodes.length > 0) {
        element.appendChild(label);
        addedCount++;
        //console.log(`[Threads] 成功添加 ${account} 的標籤: ${labelText} 1`);
      }
      // 方法2: 插入到 element 的下一個兄弟節點之前
      else if (element.parentElement) {
        element.parentElement.insertBefore(label, element.nextSibling);
        addedCount++;
        //console.log(`[Threads] 成功添加 ${account} 的標籤: ${labelText} 2`);
      }

      // 檢測是否正在追蹤此用戶
      let isFollowing = true;
      try {
        let currentElement = label;
        for (let i = 0; i < 10; i++) {
          if (!currentElement.parentElement) break;
          currentElement = currentElement.parentElement;
          
          const followSvg = currentElement.querySelector('svg[aria-label="Follow"]') ||
                           currentElement.querySelector('svg[aria-label="追蹤"]');
          
          if (followSvg) {
            isFollowing = false;
            break;
          }
        }
        
        userData.isFollowing = isFollowing;
        //console.log(`[Threads] ${account} 追蹤狀態: ${isFollowing ? '已追蹤' : '未追蹤'}`);
      } catch (error) {
        console.log(`[Threads] 檢測追蹤狀態時發生錯誤 (${account}):`, error);
        userData.isFollowing = true;
      }

      // 檢測是否為認證用戶
      let isVerified = false;
      try {
        let currentElement = label;
        for (let i = 0; i < 10; i++) {
          if (!currentElement.parentElement) break;
          currentElement = currentElement.parentElement;
          
          const verifiedSvg = currentElement.querySelector('svg[aria-label="Verified"]') ||
                             currentElement.querySelector('svg[aria-label="已驗證"]');
          
          if (verifiedSvg) {
            isVerified = true;
            break;
          }
        }
        
        userData.isVerified = isVerified;
        //console.log(`[Threads] ${account} 認證狀態: ${isVerified ? '已認證' : '未認證'}`);
      } catch (error) {
        console.log(`[Threads] 檢測認證狀態時發生錯誤 (${account}):`, error);
        userData.isVerified = false;
      }

      // 檢測互動數據（按讚、回覆、轉發數量）
      let likeCount = 0;
      let replyCount = 0;
      let repostCount = 0;
      try {
        let currentElement = label;
        for (let i = 0; i < 10; i++) {
          if (!currentElement.parentElement) break;
          currentElement = currentElement.parentElement;
          
          // 查找 Like SVG 和對應的數字
          const likeSvg = currentElement.querySelector('svg[aria-label="Like"]') ||
                         currentElement.querySelector('svg[aria-label="讚"]');
          if (likeSvg && likeCount === 0) {
            const likeButton = likeSvg.closest('[role="button"]');
            if (likeButton) {
              const likeSpan = likeButton.querySelector('span[dir="auto"]');
              if (likeSpan) {
                const likeText = likeSpan.textContent.trim();
                likeCount = parseEngagementCount(likeText);
              }
            }
          }
          
          // 查找 Reply SVG 和對應的數字
          const replySvg = currentElement.querySelector('svg[aria-label="Reply"]') ||
                          currentElement.querySelector('svg[aria-label="回覆"]');
          if (replySvg && replyCount === 0) {
            const replyButton = replySvg.closest('[role="button"]');
            if (replyButton) {
              const replySpan = replyButton.querySelector('span[dir="auto"]');
              if (replySpan) {
                const replyText = replySpan.textContent.trim();
                replyCount = parseEngagementCount(replyText);
              }
            }
          }
          
          // 查找 Repost SVG 和對應的數字
          const repostSvg = currentElement.querySelector('svg[aria-label="Repost"]') ||
                           currentElement.querySelector('svg[aria-label="轉發"]');
          if (repostSvg && repostCount === 0) {
            const repostButton = repostSvg.closest('[role="button"]');
            if (repostButton) {
              const repostSpan = repostButton.querySelector('span[dir="auto"]');
              if (repostSpan) {
                const repostText = repostSpan.textContent.trim();
                repostCount = parseEngagementCount(repostText);
              }
            }
          }
          
          // 如果三個數據都找到了，就停止搜尋
          if (likeCount > 0 && replyCount > 0 && repostCount > 0) {
            break;
          }
        }
        
        userData.likeCount = likeCount;
        userData.replyCount = replyCount;
        userData.repostCount = repostCount;
        //console.log(`[Threads] ${account} 互動數據: 讚 ${likeCount}, 回覆 ${replyCount}, 轉發 ${repostCount}`);
      } catch (error) {
        console.log(`[Threads] 檢測互動數據時發生錯誤 (${account}):`, error);
        userData.likeCount = 0;
        userData.replyCount = 0;
        userData.repostCount = 0;
      }

      // 處理手動信任按鈕（只在灰色標籤時顯示）
      const isGray = colors.backgroundColor === getGrayLabelBgColor();
      if (isGray && !isInManualTrustList(account)) {
        addManualTrustButton(label, account);
      }
      
      // 如果標籤為灰色，將貼文內容也設為灰色
      setPostContentColor(element, isGray);

    } catch (error) {
      console.log(`[Threads] 添加標籤時發生錯誤 (${userData.account}):`, error);
    }
  });

  //console.log(`[Threads] 完成添加標籤，成功: ${addedCount}/${totalCount}`);

  if(addedCount > 0)
  {
      chrome.runtime.sendMessage({
          action: 'updateSidepanelStatus',
          message: `成功加入新標籤: ${addedCount} `,
          type: 'success'
        }).catch(err => {
          console.log('[Threads] 更新 sidepanel 狀態失敗:', err.message);
        });

  }

  // 更新 followerLabelCounter 元素（如果存在）
  const followerLabelCounter = document.getElementById('followerLabelCounter');
  if (followerLabelCounter) {
    followerLabelCounter.textContent = `${totalCount}/`;
  }

  return {
    addedCount: addedCount,
    totalCount: totalCount
  };
}

/**
 * 添加查詢按鈕 [C] 到標籤
 * @param {Element} labelElement - 標籤元素
 * @param {string} account - 帳號名稱
 * @param {number} index - 索引
 * @param {Element} labelTextSpan - 標籤文字 span 元素
 */
function addQueryButton(labelElement, account, index, labelTextSpan) {
  const queryButton = document.createElement('button');
  queryButton.textContent = '查詢';
  queryButton.className = 'threads-query-btn';
  queryButton.dataset.account = account;
  queryButton.dataset.index = index;
  queryButton.dataset.isAutoQuery = 'false'; // 預設為手動查詢

  queryButton.style.cssText = `
    margin-left: 4px;
    padding: 1px 5px;
    background-color: transparent;
    color: #333;
    border: 1.5px solid #333;
    border-radius: 3px;
    font-size: 10px;
    font-weight: bold;
    cursor: pointer;
    line-height: 14px;
    min-width: 32px;
    pointer-events: auto;
  `;

  // 懸停效果
  queryButton.addEventListener('mouseenter', () => {
    queryButton.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
  });
  queryButton.addEventListener('mouseleave', () => {
    queryButton.style.backgroundColor = 'transparent';
  });

  // 點擊事件處理（在捕獲階段，優先級最高）
  queryButton.addEventListener('click', async (e) => {
    // 立即阻止所有事件傳播和預設行為
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();

    const accountToQuery = queryButton.dataset.account;
    const isAutoQuery = queryButton.dataset.isAutoQuery === 'true';
    const queryType = isAutoQuery ? '自動查詢' : '手動查詢';
    console.log(`[Threads] ${queryType}按鈕被點擊: ${accountToQuery}`);

    // 禁用按鈕並顯示查詢中
    queryButton.disabled = true;
    queryButton.textContent = '...';
    queryButton.style.cursor = 'not-allowed';
    queryButton.classList.add('querying');

    // 將標籤文字從「待查詢」改成「查詢中」
    labelTextSpan.textContent = `所在地：查詢中`;

    try {
      // 發送消息到 background 執行查詢
      console.log(`[Content] ${queryType}發送新分頁中開始查詢: ${accountToQuery}`);

        // 更新 sidepanel 狀態欄
      chrome.runtime.sendMessage({
        action: 'updateSidepanelStatus',
        message: `新分頁中開始查詢: ${accountToQuery}`,
        type: 'success'
      }).catch(err => {
        console.log('[Threads] 更新 sidepanel 狀態失敗:', err.message);
      });

      // 發送查詢請求並等待結果
      console.log(`[Content] 開始等待 manualQueryRegion 響應 (${queryType})...`);
      let response;
      try {
        response = await chrome.runtime.sendMessage({
          action: 'manualQueryRegion',
          account: accountToQuery,
          isPriority: !isAutoQuery  // 手動點擊才使用優先隊列，自動查詢不使用
        });
      } catch (err) {
        console.error(`[Content] manualQueryRegion 發生錯誤:`, err);
        response = null;
      }

      console.log(`[Content] 查詢響應:`, response, `success=${response?.success}, region=${response?.region}, error=${response?.error}`);

      // 檢查是否為 HTTP 429 錯誤
      if (response && !response.success && response.error === 'HTTP_429') {
        // HTTP 429 錯誤，不更新標籤狀態，保持原本的待查詢狀態
        console.log(`[Threads] HTTP 429 錯誤，不更新標籤狀態: ${accountToQuery}`);
        
        // 恢復按鈕狀態
        queryButton.disabled = false;
        queryButton.textContent = '查詢';
        queryButton.style.cursor = 'pointer';
        queryButton.classList.remove('querying');
        
        // 保持標籤文字為「待查詢」（不變）
        labelTextSpan.textContent = `所在地：待查詢`;
        
        // 不發送 updateUserRegion 訊息，不更新 sidepanel 中的用戶狀態
        
        return; // 提前返回，不繼續處理
      }

      // 檢查是否因為佇列已滿而被拒絕
      if (response && !response.success && response.error && 
          (response.error.includes('佇列已滿') || response.error.includes('已在查詢中'))) {
        // 佇列已滿或已在查詢中，恢復到待查詢狀態
        console.log(`[Threads] ${response.error}，恢復到待查詢狀態: ${accountToQuery}`);
        
        // 恢復按鈕狀態
        queryButton.disabled = false;
        queryButton.textContent = '查詢';
        queryButton.style.cursor = 'pointer';
        queryButton.classList.remove('querying');
        
        // 恢復標籤文字為「待查詢」
        labelTextSpan.textContent = `所在地：待查詢`;
        
        // 更新 sidepanel 狀態欄
        chrome.runtime.sendMessage({
          action: 'updateSidepanelStatus',
          message: `${response.error}: ${accountToQuery}`,
          type: 'info'
        }).catch(err => {
          console.log('[Threads] 更新 sidepanel 狀態失敗:', err.message);
        });
        
        return; // 提前返回，不繼續處理
      }

      // 處理查詢結果
      let profileText = '';
      try {
        const storageResult = await chrome.storage.local.get(['llmProfileAnalysis']);
        const llmProfileAnalysisEnabled = storageResult.llmProfileAnalysis || false;
        
        if (llmProfileAnalysisEnabled) {
          const profileResponse = await chrome.runtime.sendMessage({
            action: 'getUserProfile',
            account: accountToQuery
          });
          if (profileResponse && profileResponse.success && profileResponse.profile) {
            profileText = profileResponse.profile;
            console.log(`[Threads] 找到已有的側寫結果: ${accountToQuery} - ${profileText}`);
          }
        }
      } catch (err) {
        console.log('[Threads] 查詢側寫結果失敗:', err.message);
      }

      if (response && response.success && response.region) {
        // 查詢成功且有地區資訊，根據地區設置對應顏色
        const colors = getRegionColor(response.region, profileText || null, accountToQuery);
        
        // 更新標籤文字（包含側寫如果有的話）
        labelTextSpan.textContent = generateLabelText(response.region, profileText || null);
        labelElement.style.backgroundColor = colors.backgroundColor;
        labelElement.style.color = colors.textColor;
        // 更新三角形顏色
        const arrowElement = labelElement.querySelector('span[style*="border-right"]');
        if (arrowElement) {
          arrowElement.style.borderRightColor = colors.backgroundColor;
        }
        queryButton.remove();
        // 添加重新整理按鈕
        addRefreshButton(labelElement, accountToQuery, labelTextSpan);
        console.log(`[Threads] 查詢成功: ${accountToQuery} - ${response.region}${profileText ? ` (${profileText})` : ''}`);

        // 如果標籤為灰色，將貼文內容也設為灰色
        const userElement = labelElement.parentElement;
        if (userElement && userElement.tagName === 'A' && userElement.href && userElement.href.includes('/@')) {
          const isGray = colors.backgroundColor === getGrayLabelBgColor();
          setPostContentColor(userElement, isGray);
        }

        // 更新 sidepanel 狀態欄
        chrome.runtime.sendMessage({
          action: 'updateSidepanelStatus',
          message: `查詢成功: ${accountToQuery} - ${response.region}`,
          type: 'success'
        }).catch(err => {
          console.log('[Threads] 更新 sidepanel 狀態失敗:', err.message);
        });

        // 將查詢結果同步到 sidepanel 的 currentGetUserListArray
        chrome.runtime.sendMessage({
          action: 'updateUserRegion',
          account: accountToQuery,
          region: response.region
        }).catch(err => {
          console.log('[Threads] 同步查詢結果到 sidepanel 失敗:', err.message);
        });
      } else {
        // 查詢失敗或未找到地區資訊
        // 檢查錯誤類型以決定顯示文字
        let regionQueryStatus = null;
        if (response && response.error) {
          if (response.error === 'HTTP_429') {
            regionQueryStatus = 'fail_http429';
          } else if (response.error === 'ME_UI_ISSUE') {
            regionQueryStatus = 'fail_me';
          }
        }
        // 如果沒有錯誤類型，預設為 fail_not_rollout_yet
        if (!regionQueryStatus) {
          regionQueryStatus = 'fail_not_rollout_yet';
        }
        
        const colors = getRegionColor(null, profileText || null, accountToQuery, regionQueryStatus);
        labelTextSpan.textContent = generateLabelText(null, profileText || null, regionQueryStatus);
        labelElement.style.backgroundColor = colors.backgroundColor;
        labelElement.style.color = colors.textColor;
        // 更新三角形顏色
        const arrowElement = labelElement.querySelector('span[style*="border-right"]');
        if (arrowElement) {
          arrowElement.style.borderRightColor = colors.backgroundColor;
        }
        queryButton.remove();
        // 添加重新整理按鈕
        addRefreshButton(labelElement, accountToQuery, labelTextSpan);
        console.log(`[Threads] 查詢完成但未找到地區: ${accountToQuery}${profileText ? ` (${profileText})` : ''}, status: ${regionQueryStatus}`);

        // 處理手動信任按鈕（只在灰色標籤時顯示）
        const isGray = colors.backgroundColor === getGrayLabelBgColor();
        if (isGray && !isInManualTrustList(accountToQuery)) {
          addManualTrustButton(labelElement, accountToQuery);
        }

        // 如果標籤為灰色，將貼文內容也設為灰色
        const userElement = labelElement.parentElement;
        if (userElement && userElement.tagName === 'A' && userElement.href && userElement.href.includes('/@')) {
          setPostContentColor(userElement, isGray);
        }

        // 將查詢結果同步到 sidepanel 的 currentGetUserListArray
        // 根據 regionQueryStatus 決定顯示的文字
        let displayRegion = '未揭露';
        if (regionQueryStatus === 'fail_http429') {
          displayRegion = '查詢失敗';
        } else if (regionQueryStatus === 'fail_me') {
          displayRegion = '無法查詢';
        }
        chrome.runtime.sendMessage({
          action: 'updateUserRegion',
          account: accountToQuery,
          region: displayRegion
        }).catch(err => {
          console.log('[Threads] 同步查詢結果到 sidepanel 失敗:', err.message);
        });
      }
    } catch (error) {
      // 發生錯誤，設置為未揭露
      console.log('[Threads] 查詢錯誤:', error);
      
      // 查詢 sidepanel 是否已有該用戶的側寫結果
      let profileText = '';
      try {
        const storageResult = await chrome.storage.local.get(['llmProfileAnalysis']);
        const llmProfileAnalysisEnabled = storageResult.llmProfileAnalysis || false;
        
        if (llmProfileAnalysisEnabled) {
          const profileResponse = await chrome.runtime.sendMessage({
            action: 'getUserProfile',
            account: accountToQuery
          });
          if (profileResponse && profileResponse.success && profileResponse.profile) {
            profileText = profileResponse.profile;
            console.log(`[Threads] 找到已有的側寫結果: ${accountToQuery} - ${profileText}`);
          }
        }
      } catch (err) {
        console.log('[Threads] 查詢側寫結果失敗:', err.message);
      }

      const colors = getRegionColor('未揭露', profileText || null, accountToQuery);
      labelTextSpan.textContent = generateLabelText('未揭露', profileText || null);
      labelElement.style.backgroundColor = colors.backgroundColor;
      labelElement.style.color = colors.textColor;
      // 更新三角形顏色
      const arrowElement = labelElement.querySelector('span[style*="border-right"]');
      if (arrowElement) {
        arrowElement.style.borderRightColor = colors.backgroundColor;
      }
      queryButton.remove();
      // 添加重新整理按鈕
      addRefreshButton(labelElement, accountToQuery, labelTextSpan);

      // 處理手動信任按鈕（只在灰色標籤時顯示）
      const isGray = colors.backgroundColor === getGrayLabelBgColor();
      if (isGray && !isInManualTrustList(accountToQuery)) {
        addManualTrustButton(labelElement, accountToQuery);
      }

      // 如果標籤為灰色，將貼文內容也設為灰色
      const userElement = labelElement.parentElement;
      if (userElement && userElement.tagName === 'A' && userElement.href && userElement.href.includes('/@')) {
        setPostContentColor(userElement, isGray);
      }

      // 將查詢結果同步到 sidepanel 的 currentGetUserListArray
      chrome.runtime.sendMessage({
        action: 'updateUserRegion',
        account: accountToQuery,
        region: '未揭露'
      }).catch(err => {
        console.log('[Threads] 同步查詢結果到 sidepanel 失敗:', err.message);
      });
    }
  }, true); // 使用捕獲階段，確保在父層連結處理之前執行

  // 額外阻止 mousedown 和 mouseup 事件（防止某些框架的特殊處理）
  queryButton.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
  }, true);

  queryButton.addEventListener('mouseup', (e) => {
    e.stopPropagation();
    e.preventDefault();
  }, true);

  labelElement.appendChild(queryButton);
}

/**
 * 添加重新整理按鈕（cycle icon）到標籤
 * @param {Element} labelElement - 標籤元素
 * @param {string} account - 帳號名稱
 * @param {Element} labelTextSpan - 標籤文字 span 元素
 */
function addRefreshButton(labelElement, account, labelTextSpan) {
  // 檢查是否已有重新整理按鈕
  const existingRefreshBtn = labelElement.querySelector('.threads-refresh-btn');
  if (existingRefreshBtn) {
    return;
  }

  const refreshButton = document.createElement('button');
  refreshButton.className = 'threads-refresh-btn';
  refreshButton.dataset.account = account;
  refreshButton.title = '重新查詢';

  // 使用 SVG cycle icon
  refreshButton.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
    </svg>
  `;

  refreshButton.style.cssText = `
    margin-left: 4px;
    padding: 0;
    background: none;
    color: inherit;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
    transition: opacity 0.2s;
    pointer-events: auto;
  `;

  // 懸停效果
  refreshButton.addEventListener('mouseenter', () => {
    refreshButton.style.opacity = '1';
  });
  refreshButton.addEventListener('mouseleave', () => {
    refreshButton.style.opacity = '0.6';
  });

  // 點擊事件處理
  refreshButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();

    const accountToRefresh = refreshButton.dataset.account;
    console.log(`[Threads] 重新整理按鈕被點擊: ${accountToRefresh}`);

    // 禁用按鈕並顯示旋轉動畫
    refreshButton.disabled = true;
    refreshButton.style.cursor = 'not-allowed';
    refreshButton.style.animation = 'spin 1s linear infinite';

    // 1. 先清除標籤上顯示的地區與側寫，重建為純文字節點
    // 移除原有的 labelTextSpan 內容，替換為新的文字節點
    const newLabelText = document.createTextNode(`所在地：查詢中`);
    labelTextSpan.replaceWith(newLabelText);
    // 更新 labelTextSpan 引用為新的文字節點（用於後續更新）
    let currentLabelNode = newLabelText;

    // 更新標籤顏色為黃色（查詢中）
    const pendingColors = getRegionColor(null);
    labelElement.style.backgroundColor = pendingColors.backgroundColor;
    labelElement.style.color = pendingColors.textColor;
    const arrowElement = labelElement.querySelector('span[style*="border-right"]');
    if (arrowElement) {
      arrowElement.style.borderRightColor = pendingColors.backgroundColor;
    }

    try {
      // 2. 移除該用戶的 cache（地區和側寫）
      console.log(`[Threads] 移除 ${accountToRefresh} 的快取（地區和側寫）`);
      await chrome.runtime.sendMessage({
        action: 'removeUserCache',
        account: accountToRefresh
      });

      // 同時清除 sidepanel 中該用戶的側寫資料
      chrome.runtime.sendMessage({
        action: 'clearUserProfile',
        account: accountToRefresh
      }).catch(err => {
        console.log('[Threads] 清除 sidepanel 側寫資料失敗:', err.message);
      });

      // 更新 sidepanel 狀態欄
      chrome.runtime.sendMessage({
        action: 'updateSidepanelStatus',
        message: `重新查詢: ${accountToRefresh}`,
        type: 'info'
      }).catch(err => {
        console.log('[Threads] 更新 sidepanel 狀態失敗:', err.message);
      });

      // 3. 發送重新查詢請求
      const response = await chrome.runtime.sendMessage({
        action: 'manualQueryRegion',
        account: accountToRefresh,
        isPriority: true  // 重新查詢，使用優先隊列
      });

      console.log(`[Threads] 重新查詢響應:`, response);

      // 4. 處理查詢結果
      let profileText = '';
      try {
        const storageResult = await chrome.storage.local.get(['llmProfileAnalysis']);
        const llmProfileAnalysisEnabled = storageResult.llmProfileAnalysis || false;
        
        if (llmProfileAnalysisEnabled) {
          const profileResponse = await chrome.runtime.sendMessage({
            action: 'getUserProfile',
            account: accountToRefresh
          });
          if (profileResponse && profileResponse.success && profileResponse.profile) {
            profileText = profileResponse.profile;
          }
        }
      } catch (err) {
        console.log('[Threads] 查詢側寫結果失敗:', err.message);
      }

      if (response && response.success && response.region) {
        // 查詢成功後，自動從手動信任清單移除該使用者
        if (isInManualTrustList(accountToRefresh)) {
          removeFromManualTrustList(accountToRefresh);
          console.log(`[Threads] 重新查詢成功，已從手動信任清單移除: ${accountToRefresh}`);
        }
        
        const colors = getRegionColor(response.region, profileText || null, accountToRefresh);
        // 使用 generateLabelElement 重建完整的標籤元素（包含可點擊的側寫標籤）
        const newLabelElement = generateLabelElement(response.region, profileText || null);
        currentLabelNode.replaceWith(newLabelElement);
        labelElement.style.backgroundColor = colors.backgroundColor;
        labelElement.style.color = colors.textColor;
        if (arrowElement) {
          arrowElement.style.borderRightColor = colors.backgroundColor;
        }

        // 處理手動信任按鈕（只在灰色標籤時顯示）
        const isGray = colors.backgroundColor === getGrayLabelBgColor();
        if (isGray && !isInManualTrustList(accountToRefresh)) {
          addManualTrustButton(labelElement, accountToRefresh);
        } else {
          // 移除已存在的信任按鈕（如果不是灰色或已在信任清單中）
          const existingTrustBtn = labelElement.querySelector('.threads-trust-btn');
          if (existingTrustBtn) {
            existingTrustBtn.remove();
          }
        }

        // 如果標籤為灰色，將貼文內容也設為灰色
        const userElement = labelElement.parentElement;
        if (userElement && userElement.tagName === 'A' && userElement.href && userElement.href.includes('/@')) {
          setPostContentColor(userElement, isGray);
        }

        // 更新 sidepanel 狀態欄
        chrome.runtime.sendMessage({
          action: 'updateSidepanelStatus',
          message: `重新查詢成功: ${accountToRefresh} - ${response.region}`,
          type: 'success'
        }).catch(err => {
          console.log('[Threads] 更新 sidepanel 狀態失敗:', err.message);
        });

        // 同步到 sidepanel
        chrome.runtime.sendMessage({
          action: 'updateUserRegion',
          account: accountToRefresh,
          region: response.region
        }).catch(err => {
          console.log('[Threads] 同步查詢結果到 sidepanel 失敗:', err.message);
        });
      } else {
        // 查詢失敗或未找到地區資訊
        // 檢查錯誤類型以決定顯示文字
        let regionQueryStatus = null;
        if (response && response.error) {
          if (response.error === 'HTTP_429') {
            regionQueryStatus = 'fail_http429';
          } else if (response.error === 'ME_UI_ISSUE') {
            regionQueryStatus = 'fail_me';
          }
        }
        // 如果沒有錯誤類型，預設為 fail_not_rollout_yet
        if (!regionQueryStatus) {
          regionQueryStatus = 'fail_not_rollout_yet';
        }
        
        const colors = getRegionColor(null, profileText || null, accountToRefresh, regionQueryStatus);
        // 使用 generateLabelElement 重建完整的標籤元素
        const newLabelElement = generateLabelElement(null, profileText || null, regionQueryStatus);
        currentLabelNode.replaceWith(newLabelElement);
        labelElement.style.backgroundColor = colors.backgroundColor;
        labelElement.style.color = colors.textColor;
        if (arrowElement) {
          arrowElement.style.borderRightColor = colors.backgroundColor;
        }

        // 處理手動信任按鈕（只在灰色標籤時顯示）
        const isGray = colors.backgroundColor === getGrayLabelBgColor();
        if (isGray && !isInManualTrustList(accountToRefresh)) {
          addManualTrustButton(labelElement, accountToRefresh);
        } else {
          // 移除已存在的信任按鈕（如果不是灰色或已在信任清單中）
          const existingTrustBtn = labelElement.querySelector('.threads-trust-btn');
          if (existingTrustBtn) {
            existingTrustBtn.remove();
          }
        }

        // 如果標籤為灰色，將貼文內容也設為灰色
        const userElement = labelElement.parentElement;
        if (userElement && userElement.tagName === 'A' && userElement.href && userElement.href.includes('/@')) {
          setPostContentColor(userElement, isGray);
        }

        // 同步到 sidepanel
        // 根據 regionQueryStatus 決定顯示的文字
        let displayRegion = '未揭露';
        if (regionQueryStatus === 'fail_http429') {
          displayRegion = '查詢失敗';
        } else if (regionQueryStatus === 'fail_me') {
          displayRegion = '無法查詢';
        }
        chrome.runtime.sendMessage({
          action: 'updateUserRegion',
          account: accountToRefresh,
          region: displayRegion
        }).catch(err => {
          console.log('[Threads] 同步查詢結果到 sidepanel 失敗:', err.message);
        });
      }
    } catch (error) {
      console.log('[Threads] 重新查詢錯誤:', error);
      const colors = getRegionColor('未揭露', null, accountToRefresh);
      // 使用 generateLabelElement 重建標籤元素
      const newLabelElement = generateLabelElement('未揭露', null);
      currentLabelNode.replaceWith(newLabelElement);
      labelElement.style.backgroundColor = colors.backgroundColor;
      labelElement.style.color = colors.textColor;
      if (arrowElement) {
        arrowElement.style.borderRightColor = colors.backgroundColor;
      }

      // 處理手動信任按鈕（只在灰色標籤時顯示）
      const isGray = colors.backgroundColor === getGrayLabelBgColor();
      if (isGray && !isInManualTrustList(accountToRefresh)) {
        addManualTrustButton(labelElement, accountToRefresh);
      } else {
        // 移除已存在的信任按鈕（如果不是灰色或已在信任清單中）
        const existingTrustBtn = labelElement.querySelector('.threads-trust-btn');
        if (existingTrustBtn) {
          existingTrustBtn.remove();
        }
      }

      // 如果標籤為灰色，將貼文內容也設為灰色
      const userElement = labelElement.parentElement;
      if (userElement && userElement.tagName === 'A' && userElement.href && userElement.href.includes('/@')) {
        setPostContentColor(userElement, isGray);
      }
    } finally {
      // 恢復按鈕狀態
      refreshButton.disabled = false;
      refreshButton.style.cursor = 'pointer';
      refreshButton.style.animation = '';
    }
  }, true);

  // 阻止事件傳播
  refreshButton.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
  }, true);

  refreshButton.addEventListener('mouseup', (e) => {
    e.stopPropagation();
    e.preventDefault();
  }, true);

  labelElement.appendChild(refreshButton);
}

/**
 * 添加手動信任按鈕到標籤（只在灰色標籤時顯示）
 * @param {Element} labelElement - 標籤元素
 * @param {string} account - 帳號名稱
 */
function addManualTrustButton(labelElement, account) {
  // 檢查是否已有信任按鈕
  const existingTrustBtn = labelElement.querySelector('.threads-trust-btn');
  if (existingTrustBtn) {
    return;
  }

  const trustButton = document.createElement('button');
  trustButton.className = 'threads-trust-btn';
  trustButton.dataset.account = account;
  trustButton.title = '將此用戶手動加入信任清單，變更標籤顯示為綠色';

  // 使用 SVG icon: 綠色小旗子
  trustButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 3 L4 21" stroke="#333" stroke-width="3" stroke-linecap="round"/>
      <path d="M4 3 L18 3 L18 13 L4 13 Z" fill="#22c55e" stroke="#16a34a" stroke-width="1.5"/>
    </svg>
  `;

  trustButton.style.cssText = `
    margin-left: 4px;
    padding: 0;
    background: none;
    color: inherit;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    transition: opacity 0.2s;
    opacity: 0.8;
  `;

  // 懸停效果
  trustButton.addEventListener('mouseenter', () => {
    trustButton.style.opacity = '1';
  });
  trustButton.addEventListener('mouseleave', () => {
    trustButton.style.opacity = '0.8';
  });

  // 點擊事件處理
  trustButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();

    const accountToTrust = trustButton.dataset.account;
    console.log(`[Threads] 手動信任按鈕被點擊: ${accountToTrust}`);

    // 加入信任清單
    const success = addToManualTrustList(accountToTrust);
    
    if (success) {
      // 移除信任按鈕
      trustButton.remove();
      
      // 更新標籤顏色為綠色
      const greenColors = {
        backgroundColor: '#4caf50',
        textColor: 'white'
      };
      labelElement.style.backgroundColor = greenColors.backgroundColor;
      labelElement.style.color = greenColors.textColor;
      
      // 更新三角形顏色
      const arrowElement = labelElement.querySelector('span[style*="border-right"]');
      if (arrowElement) {
        arrowElement.style.borderRightColor = greenColors.backgroundColor;
      }
      
      // 將貼文內容恢復為正常顏色（不再是灰色）
      const userElement = labelElement.parentElement;
      if (userElement && userElement.tagName === 'A' && userElement.href && userElement.href.includes('/@')) {
        setPostContentColor(userElement, false);
      }
      
      console.log(`[Threads] 已將 ${accountToTrust} 加入信任清單並更新為綠色標籤`);
      
      // 更新 sidepanel 狀態欄
      chrome.runtime.sendMessage({
        action: 'updateSidepanelStatus',
        message: `已將 ${accountToTrust} 加入信任清單`,
        type: 'success'
      }).catch(err => {
        console.log('[Threads] 更新 sidepanel 狀態失敗:', err.message);
      });
    }
  }, true);

  // 阻止事件傳播
  trustButton.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
  }, true);

  trustButton.addEventListener('mouseup', (e) => {
    e.stopPropagation();
    e.preventDefault();
  }, true);

  labelElement.appendChild(trustButton);
}

/**
 * 隱藏頁面上所有的用戶資訊標籤
 * @returns {Object} 結果 { hiddenCount }
 */
function hideRegionLabelsOnPage() {
  let hiddenCount = 0;

  console.log(`[Threads] 開始隱藏頁面上的用戶資訊標籤`);

  // 找到所有的用戶資訊標籤並隱藏
  const allLabels = document.querySelectorAll('.threads-region-label');

  allLabels.forEach(label => {
    label.style.display = 'none';
    hiddenCount++;
  });

  console.log(`[Threads] 完成隱藏標籤，共隱藏 ${hiddenCount} 個`);

  return {
    hiddenCount: hiddenCount
  };
}

/**
 * 移除頁面上所有的用戶資訊標籤（完全刪除）
 * @returns {Object} 結果 { removedCount }
 */
function removeRegionLabelsOnPage() {
  let removedCount = 0;

  console.log(`[Threads] 開始移除頁面上的所有用戶資訊標籤`);

  // 找到所有的用戶資訊標籤並移除
  const allLabels = document.querySelectorAll('.threads-region-label');

  allLabels.forEach(label => {
    try {
      label.remove();
      removedCount++;
    } catch (error) {
      console.error(`[Threads] 移除標籤時發生錯誤:`, error);
    }
  });

  // 清空 currentUserElementsData 中的標籤引用
  currentUserElementsData.forEach(userData => {
    if (userData.labelElement) {
      userData.labelElement = null;
    }
  });

  console.log(`[Threads] 完成移除標籤，共移除 ${removedCount} 個`);

  return {
    removedCount: removedCount
  };
}
// ==================== 頁面捲動監聽機制 ====================

// 節流機制：確保兩次呼叫之間至少相隔 3 秒
let lastScrollUpdate = 0;
const SCROLL_THROTTLE_DELAY = 2000; // 3 秒

// 滾動停止計時器
let scrollStopTimer = null;

/**
 * 檢查元素是否在可見視窗範圍內
 * @param {Element} element - 要檢查的 DOM 元素
 * @returns {boolean} 是否在可見範圍內
 */
function isElementVisible(element) {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  // 檢查元素是否在視窗範圍內
  const isInViewport = (
    rect.top < windowHeight &&
    rect.bottom > 0 &&
    rect.left < windowWidth &&
    rect.right > 0
  );

  return isInViewport;
}

/**
 * 檢查元素是否在可見視窗下方（即將被捲動看到的區域）
 * @param {Element} element - 要檢查的 DOM 元素
 * @returns {boolean} 是否在可見區域下方
 */
function isElementComingVisible(element) {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  // 檢查元素是否在視窗下方（top 位置超過視窗高度，且在水平範圍內）
  const isBelowViewport = (
    rect.top >= windowHeight &&
    rect.left < windowWidth &&
    rect.right > 0
  );

  return isBelowViewport;
}

/**
 * 查找當前可見範圍內的用戶元素
 * @returns {Array<Object>} 可見用戶的資料，格式：[{account, element, index}, ...]
 */
function getVisibleUsers() {
  const visibleUsers = [];

  currentUserElementsData.forEach((userData, index) => {
    if (isElementVisible(userData.element)) {
      visibleUsers.push({
        ...userData,  // 包含所有原始資料（isFollowing, isVerified, likeCount, etc.）
        index: index
      });
    }
  });

  console.log(`[Threads] 找到 ${visibleUsers.length} 個可見用戶`);
  return visibleUsers;
}

/**
 * 查找即將顯示的用戶元素（位於可見區域下方）
 * @returns {Array<Object>} 即將顯示的用戶資料，格式：[{account, element, index}, ...]
 */
function getComingVisibleUsers() {
  const comingVisibleUsers = [];

  currentUserElementsData.forEach((userData, index) => {
    if (isElementComingVisible(userData.element)) {
      const rect = userData.element.getBoundingClientRect();
      // 返回完整的 userData，並添加 top 位置資訊
      comingVisibleUsers.push({
        ...userData,  // 包含所有原始資料（isFollowing, isVerified, likeCount, etc.）
        index: index,
        top: rect.top
      });
    }
  });

  // 按照 top 位置升序排列（較近的元素在前面）
  comingVisibleUsers.sort((a, b) => a.top - b.top);

  console.log(`[Threads] 找到 ${comingVisibleUsers.length} 個即將顯示的用戶`);
  if (comingVisibleUsers.length > 0) {
    console.log('[Threads] 即將顯示的用戶列表（由近到遠）:', comingVisibleUsers.map(u => `${u.account} (top: ${Math.round(u.top)})`).join(', '));
  }
  return comingVisibleUsers;
}

/**
 * 自動查詢可見範圍內未查詢的用戶
 */
async function autoQueryVisibleUsers() {
  try {
    // 從 chrome.storage 讀取自動查詢設定（支援新舊格式）
    const storageResult = await chrome.storage.local.get(['autoQueryMode', 'autoQueryVisible']);
    let autoQueryMode = storageResult.autoQueryMode;
    
    // 向後兼容：如果沒有 autoQueryMode，檢查舊的 autoQueryVisible 設定
    if (!autoQueryMode && storageResult.autoQueryVisible !== undefined) {
      autoQueryMode = storageResult.autoQueryVisible ? 'visible' : 'off';
    }
    
    // 預設為關閉
    if (!autoQueryMode) {
      autoQueryMode = 'off';
    }

    if (autoQueryMode === 'off') {
      console.log('[Threads] 自動查詢未啟用');
      return;
    }

    console.log(`[Threads] 開始自動查詢可見用戶（模式: ${autoQueryMode}）`);

    // 根據模式選擇要處理的用戶列表
    let targetUsers = [];
    
    if (autoQueryMode === 'visible') {
      // visible 模式：處理目前可見的用戶
      targetUsers = getVisibleUsers();
    } else if (autoQueryMode === 'smart') {
      // smart 模式：檢查頁面是否剛載入
      const scrollY = window.scrollY || window.pageYOffset || 0;
      
      if (scrollY < 10) {
        // 頁面剛載入（scroll Y < 10），處理目前可見的用戶
        console.log(`[Threads] 智慧模式：頁面剛載入 (scrollY: ${scrollY})，處理可見用戶`);
        targetUsers = getVisibleUsers();
      } else {
        // 頁面已捲動，處理即將顯示的用戶（高互動陌生帳號優先）
        console.log(`[Threads] 智慧模式：頁面已捲動 (scrollY: ${scrollY})，處理即將顯示的用戶`);
        targetUsers = getComingVisibleUsers();
      }
    }

    if (targetUsers.length === 0) {
      console.log('[Threads] 沒有目標用戶');
      return;
    }

    // 找出尚未查詢的用戶（檢查標籤是否存在且為待查詢狀態）
    let unqueriedUsers = targetUsers.filter(user => {
      const existingLabel = user.element.querySelector('.threads-region-label');
      if (!existingLabel) {
        return true; // 沒有標籤，需要查詢
      }

      // 1. 檢查標籤文字是否為「查詢中」
      const labelTextSpan = existingLabel.querySelector('.threads-label-text') || existingLabel;
      const labelText = (labelTextSpan.textContent || labelTextSpan.innerText || '').trim();
      if (labelText.includes('查詢中')) {
        return false; // 正在查詢中，跳過
      }

      // 2. 檢查標籤的背景色是否為黃色（待查詢狀態）
      const bgColor = existingLabel.style.backgroundColor;
      const isWaitingToQuery = bgColor === 'rgb(255, 193, 7)' || bgColor === '#ffc107';

      // 如果不是待查詢狀態（已經有其他顏色），表示已查詢過（有 region 資料）
      if (!isWaitingToQuery) {
        return false; // 已查詢過，跳過
      }

      // 待查詢且不是查詢中
      return true;
    });

    // smart 模式：額外篩選條件
    if (autoQueryMode === 'smart') {
      console.log(`[Threads] 智慧模式：篩選前有 ${unqueriedUsers.length} 個待查詢用戶`);
      
      // 篩選條件：isVerified == false, isFollowing == false, likeCount+replyCount+repostCount > 100
      unqueriedUsers = unqueriedUsers.filter(user => {
        const isVerified = user.isVerified || false;
        const isFollowing = user.isFollowing !== false; // 預設為 true（已追蹤）
        const likeCount = user.likeCount || 0;
        const replyCount = user.replyCount || 0;
        const repostCount = user.repostCount || 0;
        const totalEngagement = likeCount + replyCount + repostCount;
        
        const shouldQuery = !isVerified && !isFollowing && totalEngagement > 100;
        
        // 詳細記錄每個用戶的篩選結果
        console.log(`[Threads] 智慧模式檢查: ${user.account}`, {
          isVerified: isVerified,
          isFollowing: isFollowing,
          likeCount: likeCount,
          replyCount: replyCount,
          repostCount: repostCount,
          totalEngagement: totalEngagement,
          通過認證檢查: !isVerified,
          通過追蹤檢查: !isFollowing,
          通過互動數檢查: totalEngagement > 100,
          最終結果: shouldQuery ? '✓ 符合條件' : '✗ 不符合'
        });
        
        return shouldQuery;
      });
      
      // 按照互動數排序（由高到低）
      unqueriedUsers.sort((a, b) => {
        const engagementA = (a.likeCount || 0) + (a.replyCount || 0) + (a.repostCount || 0);
        const engagementB = (b.likeCount || 0) + (b.replyCount || 0) + (b.repostCount || 0);
        return engagementB - engagementA; // 降序排列
      });
      
      console.log(`[Threads] 智慧模式：篩選後有 ${unqueriedUsers.length} 個高互動陌生帳號`);
    }

    console.log(`[Threads] ${autoQueryMode} 模式：有 ${unqueriedUsers.length} 個待查詢用戶`);

    if (unqueriedUsers.length === 0) {
      console.log('[Threads] 所有目標用戶都已查詢或不符合條件');
      return;
    }

    // 自動點擊查詢按鈕
    for (const user of unqueriedUsers) {
      const existingLabel = user.element.querySelector('.threads-region-label');
      if (existingLabel) {
        const queryButton = existingLabel.querySelector('.threads-query-btn');
        if (queryButton) {
          const engagement = (user.likeCount || 0) + (user.replyCount || 0) + (user.repostCount || 0);
          console.log(`[Threads] 自動查詢 (${autoQueryMode}): ${user.account}${autoQueryMode === 'smart' ? ` (互動數: ${engagement})` : ''}`);
          queryButton.dataset.isAutoQuery = 'true'; // 標記為自動查詢，不使用優先隊列
          queryButton.click();
        }
      }
    }
  } catch (error) {
    console.log('[Threads] 自動查詢可見用戶時發生錯誤:', error);
  }
}

/**
 * 處理頁面捲動事件（帶節流機制）
 * @param {boolean} skipThrottle - 是否跳過節流機制（手動偵測或開關 panel 時使用）
 */
function handlePageScroll(skipThrottle = false) {
  const now = Date.now();
  
  // 檢查是否距離上次更新已經過了 2 秒（除非跳過節流）
  if (!skipThrottle && ( ( now - lastScrollUpdate) < SCROLL_THROTTLE_DELAY ) ) {
    //console.log('[Threads] 捲動事件被節流機制忽略（距離上次更新不足 2 秒）');
    return;
  }
  
  // 更新最後一次捲動時間
  lastScrollUpdate = now;
  
  console.log('[Threads] 頁面捲動，通知 sidepanel 更新用戶列表');

  // 檢查 extension context 是否仍有效
  if (!chrome.runtime?.id) {
    console.log('[Threads] Extension context 已失效，請重新整理頁面');
    return;
  }

  // 發送消息到 sidepanel
  chrome.runtime.sendMessage({
    action: 'pageScrolled'
  }).then(response => {
    if (response && response.success) {
      //console.log('[Threads] Sidepanel 已收到捲動通知');
    }
  }).catch(error => {
    // 忽略錯誤（可能 sidepanel 未開啟）
    console.log('[Threads] 發送捲動通知失敗（sidepanel 可能未開啟）:', error.message);
  });

  // 清除之前的滾動停止計時器
  if (scrollStopTimer) {
    clearTimeout(scrollStopTimer);
  }

  // 設置新的計時器，滾動停止 1 秒後執行自動查詢
  scrollStopTimer = setTimeout(() => {
    console.log('[Threads] 滾動已停止，檢查是否需要自動查詢');
    autoQueryVisibleUsers();
  }, 1000);
}

/**
 * 初始化捲動監聽器和 AJAX 監聽器
 *
 * 【功能】
 * 1. 監聽頁面滾動事件，觸發 handlePageScroll
 * 2. 攔截 fetch API 和 XMLHttpRequest，監聽 GraphQL 請求完成時觸發 handlePageScroll
 *
 * 【觸發 handlePageScroll 的時機】
 * - 頁面滾動時（有 2 秒節流機制）
 * - AJAX 請求到 https://www.threads.com/graphql/query 完成時
 *
 * 【說明】
 * Threads 使用 GraphQL API 動態載入內容（如無限滾動載入更多貼文）
 * 當 GraphQL 請求完成時，新的用戶資料已被加入到頁面
 * 此時觸發 handlePageScroll 可以立即偵測並標記新出現的用戶
 */
function initScrollListener() {
  console.log('[Threads] 初始化頁面捲動監聽器');

    // 使用包裝函數確保 skipThrottle 為 false，避免 scroll 事件的 Event 物件被誤認為 truthy 的 skipThrottle
    window.addEventListener('scroll', () => handlePageScroll(false), { passive: true });

    console.log('[Threads] 捲動監聽器已啟動（節流間隔: 2 秒）');
  }


function findProfilePageFollowerElement() {
  // 1️⃣ 找到所有「粉絲 / followers」span
  const targets = [...document.querySelectorAll('span')]
    .filter(el => /^(粉絲|followers)$/i.test(el.textContent.trim()));

  for (const target of targets) {
    // 2️⃣ 由該 span 往上找 role="tablist"（最多 10 層）
    let current = target;
    let tablist = null;

    for (let i = 0; i < 10 && current; i++) {
      if (
        current.tagName === 'DIV' &&
        current.getAttribute('role') === 'tablist'
      ) {
        tablist = current;
        break;
      }
      current = current.parentElement;
    }

    // 3️⃣ tablist 的 parent
    const parentDiv = tablist?.parentElement;

    // 4️⃣ parent 的下一個 sibling
    const result = parentDiv?.nextElementSibling;

    // ✅ 找到第一個有效的就回傳
    if (result) {
      return result;
    }
  }

  // ❌ 都沒找到
  return null;
}

// ==================== URL 變化監聽（SPA 支援）====================

/**
 * 在粉絲數字下方添加 followerLabelCounter span
 */
function addFollowerLabelCounter() {
  const tablist = document.querySelector('div[role="tablist"]');
  if (!tablist) {
    console.log('[Threads] 找不到 role="tablist" 元素');
    return;
  }

  const followerTab = tablist.querySelector('div[aria-label="粉絲"]');
  if (!followerTab) {
    console.log('[Threads] 找不到 aria-label="粉絲" 元素');
    return;
  }

  const followerCountSpan = followerTab.querySelector('span[title]');
  if (!followerCountSpan) {
    console.log('[Threads] 找不到粉絲數字 span');
    return;
  }

  if (document.getElementById('followerLabelCounter')) {
    console.log('[Threads] followerLabelCounter 已存在');
    return;
  }

  const counterSpan = document.createElement('span');
  counterSpan.id = 'followerLabelCounter';
  counterSpan.textContent = '0/';
  
  followerCountSpan.parentElement.insertBefore(
    counterSpan,
    followerCountSpan
  );

  console.log('[Threads] followerLabelCounter 已添加');
}

/**
 * 設置用戶資料頁的粉絲頁滾動監聽器
 * 當切換到用戶資料頁時調用
 */
let profilePageCheckTimer = null;
let profilePageHasAddedScrollListener = false;

function setupProfilePageFollowerListener() {
  const currentUrl = window.location.href;
  const threadsProfileRegex = /^https:\/\/www\.threads\.com\/@[^/]+$/;

  // 清除之前的計時器
  if (profilePageCheckTimer) {
    clearInterval(profilePageCheckTimer);
    profilePageCheckTimer = null;
  }


  if (!threadsProfileRegex.test(currentUrl)) {
    return;
  }

  console.log('[Threads] 檢測到用戶資料頁，幫粉絲頁加入事件監聽器');

  profilePageCheckTimer = setInterval(() => {

    const followerCounterChecker = document.getElementById('followerLabelCounter');
    
    if (followerCounterChecker) return;

    const element = findProfilePageFollowerElement();

    console.log('[Threads] 查看粉絲頁元素', element);

    if (element) {
      element.addEventListener(
        'scroll',
        () => handlePageScroll(false),
        { passive: true }
      );
      
      addFollowerLabelCounter();
      
    }
  }, 10000); // 每 10 秒檢查一次
}

/**
 * 處理 URL 變化
 */
let lastUrl = window.location.href;

function handleUrlChange() {
  const currentUrl = window.location.href;
  
  if (currentUrl === lastUrl) {
    return;
  }

  console.log('[Threads] URL 變化:', lastUrl, '->', currentUrl);
  lastUrl = currentUrl;

  // 重新設置用戶資料頁的粉絲頁監聽器
  setupProfilePageFollowerListener();
}

/**
 * 初始化 URL 變化監聽器
 */
function initUrlChangeListener() {
  // 監聽 popstate（瀏覽器前進/後退）
  window.addEventListener('popstate', handleUrlChange);

  // 攔截 pushState 和 replaceState（SPA 路由變化）
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    handleUrlChange();
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    handleUrlChange();
  };

  // 備用方案：定時輪詢 URL 變化（某些 SPA 可能不觸發 pushState/replaceState）
  setInterval(() => {
    handleUrlChange();
  }, 1000); // 每秒檢查一次

  console.log('[Threads] URL 變化監聽器已初始化（含輪詢備用）');
}

/**
 * 初始化頁面功能
 */
function initPageFeatures() {
  // 檢查是否為 threads.com
  const currentUrl = window.location.href;
  if (!currentUrl.includes('threads.com')) {
    console.log('[Threads] 當前頁面不是 threads.com，跳過初始化');
    return;
  }

  console.log('[Threads] 檢測到 threads.com，開始初始化功能');

  // 注入動畫樣式（確保在任何按鈕被點擊前就已經存在）
  if (!document.getElementById('threads-animation-styles')) {
    const style = document.createElement('style');
    style.id = 'threads-animation-styles';
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes dotRotate {
        0% { content: '.  '; }
        33% { content: '.. '; }
        66% { content: '...'; }
        100% { content: '.  '; }
      }
      .threads-query-btn.querying {
        color: transparent !important;
        position: relative;
        font-weight: bold;
      }
      .threads-query-btn.querying::after {
        content: '.  ';
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #333;
        animation: dotRotate 1.2s steps(3, end) infinite;
      }
    `;
    document.head.appendChild(style);
    console.log('[Threads] 動畫樣式已注入');
  }

  // 啟動捲動監聽器
  initScrollListener();

  // 初始化 URL 變化監聽器
  initUrlChangeListener();

  // 用戶資料頁，幫粉絲頁加入事件監聽器
  setupProfilePageFollowerListener();

  // 延遲後執行第一次的 handlePageScroll
  console.log('[Threads] 將在 2 秒後執行第一次 handlePageScroll');
  setTimeout(() => {
    console.log('[Threads] 執行第一次 handlePageScroll');
    handlePageScroll(true);
  }, 2000);
}

// 當頁面載入完成後，初始化功能
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Threads] DOM 載入完成');
    initPageFeatures();
  });
} else {
  // DOM 已經載入完成
  console.log('[Threads] DOM 已載入');
  initPageFeatures();
}


function extractTextFromDocument() {
  const walker = document.createTreeWalker(
    document,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const text = node.textContent.trim();
        if (!text) return NodeFilter.FILTER_REJECT;

        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        const tagName = parent.tagName.toLowerCase();

        // 排除這些不該取得文字的標籤
        if (['script', 'style', 'noscript', 'iframe', 'svg'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const texts = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const parent = node.parentElement;
    const grandparent = parent?.parentElement;
    
    let text = node.textContent.trim();

    texts.push(text);
  }

  
  return texts.join('\n');
}