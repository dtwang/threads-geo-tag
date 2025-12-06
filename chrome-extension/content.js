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
 * 2. 用於在頁面上插入/更新地區標籤（標籤會插入到這些元素附近）
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

      console.log(`[Threads] 列出用戶: 原有 ${currentUserElementsData.length - newUniqueUsers.length} 個，新增 ${newUniqueUsers.length} 個，總共 ${currentUserElementsData.length} 個`);

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

  // 處理顯示地區標籤
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

  // 處理隱藏地區標籤
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

  // 處理移除地區標籤（完全刪除）
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

        // 步驟 1: 找到並點擊 "About this profile" 按鈕
        const region = await autoClickAboutProfileAndGetRegion();

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
 * 從文字中提取國家/區域資訊
 * @param {string} text - 要分析的文字
 * @returns {string|null} 國家/區域名稱
 */
function extractRegionFromText(text) {
  if (!text) return null;

  // 常見的國家/區域清單（可以根據需要擴充）
  const regions = [
    // 亞洲
    'Taiwan', '台灣', 'China', '中國', 'Japan', '日本', 'Korea', '韓國',
    'Hong Kong', '香港', 'Singapore', '新加坡', 'Malaysia', '馬來西亞',
    'Thailand', '泰國', 'Vietnam', '越南', 'Philippines', '菲律賓',
    'Indonesia', '印尼', 'India', '印度',

    // 北美
    'United States', 'USA', 'US', '美國', 'Canada', '加拿大',

    // 歐洲
    'United Kingdom', 'UK', '英國', 'France', '法國', 'Germany', '德國',
    'Italy', '義大利', 'Spain', '西班牙', 'Netherlands', '荷蘭',

    // 大洋洲
    'Australia', '澳洲', 'New Zealand', '紐西蘭',

    // 其他
    'Brazil', '巴西', 'Mexico', '墨西哥', 'Russia', '俄羅斯'
  ];

  // 嘗試匹配國家名稱
  for (const region of regions) {
    // 使用正則表達式進行不區分大小寫的匹配
    const regex = new RegExp(`\\b${region}\\b`, 'i');
    if (regex.test(text)) {
      return region;
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
  const flagMap = {
    '🇹🇼': 'Taiwan',
    '🇨🇳': 'China',
    '🇯🇵': 'Japan',
    '🇰🇷': 'Korea',
    '🇭🇰': 'Hong Kong',
    '🇸🇬': 'Singapore',
    '🇲🇾': 'Malaysia',
    '🇹🇭': 'Thailand',
    '🇻🇳': 'Vietnam',
    '🇵🇭': 'Philippines',
    '🇮🇩': 'Indonesia',
    '🇮🇳': 'India',
    '🇺🇸': 'United States',
    '🇨🇦': 'Canada',
    '🇬🇧': 'United Kingdom',
    '🇫🇷': 'France',
    '🇩🇪': 'Germany',
    '🇮🇹': 'Italy',
    '🇪🇸': 'Spain',
    '🇳🇱': 'Netherlands',
    '🇦🇺': 'Australia',
    '🇳🇿': 'New Zealand',
    '🇧🇷': 'Brazil',
    '🇲🇽': 'Mexico',
    '🇷🇺': 'Russia'
  };

  return flagMap[flag] || flag;
}

// ==================== 自動化查詢功能 ====================

/**
 * 自動點擊 "About this profile" 並取得地區資訊
 * @returns {Promise<string|null>} 地區名稱
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

    // 隨機等待 2-5 秒後再點擊，避免被當成自動化程式
    const randomDelay1 = Math.random() * 3000 + 2000; 
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
      return null;
    }

    console.log('[Threads] 找到 "About this profile" span:', aboutSpan);

    // 往上找第一個 div[role="button"]
    const aboutButton = findParentButton(aboutSpan);

    if (!aboutButton) {
      console.log('[Threads] 找不到 About this profile 的按鈕');
      return null;
    }

    console.log('[Threads] 找到 "About this profile" 按鈕:', aboutButton);

    // 隨機等待 2-5 秒後再點擊，避免被當成自動化程式
    const randomDelay2 = Math.random() * 3000 + 2000; 
    console.log(`[Threads] 等待 ${Math.round(randomDelay2)}ms 後點擊 "About this profile" 按鈕`);
    await waitForMilliseconds(randomDelay2);

    // 點擊按鈕
    console.log('[Threads] 步驟 3: 點擊 "About this profile" 按鈕');
    aboutButton.click();

    // 步驟 3: 等待 popup 出現
    console.log('[Threads] 步驟 4: 等待 popup 出現');
    await waitForMilliseconds(1500); // 等待 popup 動畫完成

    // 步驟 4: 找到 "Based in" 的 <span>
    console.log('[Threads] 步驟 5: 尋找 "Based in" 資訊');
    const basedInSpan = findSpanWithText('Based in');

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
 * 等待指定的毫秒數
 * @param {number} ms - 毫秒數
 * @returns {Promise<void>}
 */
function waitForMilliseconds(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 在頁面上顯示/隱藏地區標籤功能 ====================

/**
 * 根據地區名稱返回對應的標籤顏色
 * @param {string} region - 地區名稱
 * @returns {Object} 包含 backgroundColor 和 textColor 的物件
 */
function getRegionColor(region) {
  if (!region) {
    // 待查詢：黃色
    return {
      backgroundColor: '#ffc107',
      textColor: '#333'
    };
  }

  // 未揭露/失敗：灰色
  if (region === '未揭露' || region.includes('查詢失敗') || region.includes('錯誤')) {
    return {
      backgroundColor: '#9e9e9e',
      textColor: 'white'
    };
  }

  // Taiwan：綠色
  if (region === 'Taiwan' || region === '台灣') {
    return {
      backgroundColor: '#4caf50',
      textColor: 'white'
    };
  }

  // China：紅色
  if (region === 'China' || region === '中國') {
    return {
      backgroundColor: '#f44336',
      textColor: 'white'
    };
  }

  // 其他國家地區：粉紅色
  return {
    backgroundColor: '#E91E63',
    textColor: 'white'
  };
}

/**
 * 在頁面上顯示地區標籤（添加或更新標籤並設為可見）
 * @param {Object} regionData - 地區資料，格式: { "@username": "Taiwan", ... }
 * @returns {Object} 結果 { addedCount, totalCount }
 */
function showRegionLabelsOnPage(regionData) {
  let addedCount = 0;
  const totalCount = currentUserElementsData.length;

  console.log(`[Threads] 開始在頁面上添加地區標籤，共 ${totalCount} 個用戶`);

  currentUserElementsData.forEach((userData, index) => {
    try {
      const account = userData.account;
      const element = userData.element;

      if (!element || !element.parentElement) {
        console.warn(`[Threads] 用戶 ${account} 的元素不存在或已被移除`);
        return;
      }

      // 檢查是否已經添加過標籤（避免重複添加）
      const existingLabel = element.querySelector('.threads-region-label');
      if (existingLabel) {
        // 更新現有標籤
        const region = regionData[account];

        // 更新文字（選擇文字 span，不是三角形 span）
        const labelTextSpan = existingLabel.querySelector('.threads-label-text') || existingLabel;
        const newText = region ? `所在地：${region}` : `所在地：待查詢`;

        //console.log(`[Threads] 更新標籤文字 ${account}: ${region}`);

        if (labelTextSpan === existingLabel) {
          // 舊版標籤（沒有 span），需要重建
          existingLabel.innerHTML = '';
          
          // 重建時加入三角形
          const colors = getRegionColor(region);
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
          
          const textSpan = document.createElement('span');
          textSpan.className = 'threads-label-text';
          textSpan.textContent = newText;
          existingLabel.appendChild(textSpan);

          // 如果是待查詢且沒有 [C] 按鈕，添加
          if (!region) {
            addQueryButton(existingLabel, account, index, textSpan);
          }
        } else {
          labelTextSpan.textContent = newText;

          // 處理 [C] 按鈕
          const existingButton = existingLabel.querySelector('.threads-query-btn');
          if (region && existingButton) {
            // 已查詢，移除按鈕
            existingButton.remove();
          } else if (!region && !existingButton) {
            // 待查詢且沒有按鈕，添加
            addQueryButton(existingLabel, account, index, labelTextSpan);
          }
        }

        // 更新顏色（根據地區使用對應顏色）
        const colors = getRegionColor(region);
        existingLabel.style.backgroundColor = colors.backgroundColor;
        existingLabel.style.color = colors.textColor;

        // 更新三角形顏色
        const arrowElement = existingLabel.querySelector('span[style*="border-right"]');
        if (arrowElement) {
          arrowElement.style.borderRightColor = colors.backgroundColor;
        }

        // 確保標籤顯示
        existingLabel.style.display = 'inline-flex';

        //console.log(`[Threads] 更新 ${account} 的標籤: ${newText}`);
        return;
      }

      // 取得該帳號的地區資訊
      const region = regionData[account];

      // 根據地區取得對應顏色
      const colors = getRegionColor(region);

      // 判斷是否需要查詢按鈕（只有待查詢狀態需要）
      const needButton = !region;

      // 創建標籤容器 div
      const label = document.createElement('div');
      label.className = 'threads-region-label';

      // 設定樣式（左方帶小三角形突出的標籤）
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

      // 創建文字部分
      const labelText = document.createElement('span');
      labelText.className = 'threads-label-text';
      labelText.textContent = region ? `所在地：${region}` : `所在地：待查詢`;
      label.appendChild(labelText);

      // 如果需要，添加 [C] 按鈕
      if (needButton) {
        addQueryButton(label, account, index, labelText);
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

    } catch (error) {
      console.log(`[Threads] 添加標籤時發生錯誤 (${userData.account}):`, error);
    }
  });

  console.log(`[Threads] 完成添加標籤，成功: ${addedCount}/${totalCount}`);

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
    console.log(`[Threads] 手動查詢按鈕被點擊: ${accountToQuery}`);

    // 禁用按鈕並顯示查詢中
    queryButton.disabled = true;
    queryButton.textContent = '...';
    queryButton.style.cursor = 'not-allowed';

    // 將標籤文字從「待查詢」改成「查詢中」
    labelTextSpan.textContent = `所在地：查詢中`;

    try {
      // 發送消息到 background 執行查詢
      console.log(`[Content] 發送新分頁中開始查詢: ${accountToQuery}`);

        // 更新 sidepanel 狀態欄
      chrome.runtime.sendMessage({
        action: 'updateSidepanelStatus',
        message: `新分頁中開始查詢: ${accountToQuery}`,
        type: 'success'
      }).catch(err => {
        console.log('[Threads] 更新 sidepanel 狀態失敗:', err.message);
      });

      const response = await chrome.runtime.sendMessage({
        action: 'manualQueryRegion',
        account: accountToQuery
      });

      console.log(`[Content] 收到查詢響應:`, response);

      if (response && response.success && response.region) {
        // 查詢成功且有地區資訊，根據地區設置對應顏色
        const colors = getRegionColor(response.region);
        labelTextSpan.textContent = `所在地：${response.region}`;
        labelElement.style.backgroundColor = colors.backgroundColor;
        labelElement.style.color = colors.textColor;
        // 更新三角形顏色
        const arrowElement = labelElement.querySelector('span[style*="border-right"]');
        if (arrowElement) {
          arrowElement.style.borderRightColor = colors.backgroundColor;
        }
        queryButton.remove();
        console.log(`[Threads] 查詢成功: ${accountToQuery} - ${response.region}`);

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
        // 查詢失敗或未找到地區資訊，設置為未揭露
        const colors = getRegionColor('未揭露');
        labelTextSpan.textContent = `所在地：未揭露`;
        labelElement.style.backgroundColor = colors.backgroundColor;
        labelElement.style.color = colors.textColor;
        // 更新三角形顏色
        const arrowElement = labelElement.querySelector('span[style*="border-right"]');
        if (arrowElement) {
          arrowElement.style.borderRightColor = colors.backgroundColor;
        }
        queryButton.remove();
        console.log(`[Threads] 查詢完成但未找到地區: ${accountToQuery}`);

        // 將查詢結果同步到 sidepanel 的 currentGetUserListArray
        chrome.runtime.sendMessage({
          action: 'updateUserRegion',
          account: accountToQuery,
          region: '未揭露'
        }).catch(err => {
          console.log('[Threads] 同步查詢結果到 sidepanel 失敗:', err.message);
        });
      }
    } catch (error) {
      // 發生錯誤，設置為未揭露
      console.log('[Threads] 查詢錯誤:', error);
      const colors = getRegionColor('未揭露');
      labelTextSpan.textContent = `所在地：未揭露`;
      labelElement.style.backgroundColor = colors.backgroundColor;
      labelElement.style.color = colors.textColor;
      // 更新三角形顏色
      const arrowElement = labelElement.querySelector('span[style*="border-right"]');
      if (arrowElement) {
        arrowElement.style.borderRightColor = colors.backgroundColor;
      }
      queryButton.remove();

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
 * 隱藏頁面上所有的地區標籤
 * @returns {Object} 結果 { hiddenCount }
 */
function hideRegionLabelsOnPage() {
  let hiddenCount = 0;

  console.log(`[Threads] 開始隱藏頁面上的地區標籤`);

  // 找到所有的地區標籤並隱藏
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
 * 移除頁面上所有的地區標籤（完全刪除）
 * @returns {Object} 結果 { removedCount }
 */
function removeRegionLabelsOnPage() {
  let removedCount = 0;

  console.log(`[Threads] 開始移除頁面上的所有地區標籤`);

  // 找到所有的地區標籤並移除
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
 * 查找當前可見範圍內的用戶元素
 * @returns {Array<Object>} 可見用戶的資料，格式：[{account, element, index}, ...]
 */
function getVisibleUsers() {
  const visibleUsers = [];

  currentUserElementsData.forEach((userData, index) => {
    if (isElementVisible(userData.element)) {
      visibleUsers.push({
        account: userData.account,
        element: userData.element,
        index: index
      });
    }
  });

  console.log(`[Threads] 找到 ${visibleUsers.length} 個可見用戶`);
  return visibleUsers;
}

/**
 * 自動查詢可見範圍內未查詢的用戶
 */
async function autoQueryVisibleUsers() {
  try {
    // 從 chrome.storage 讀取自動查詢設定
    const storageResult = await chrome.storage.local.get(['autoQueryVisible']);
    const shouldAutoQuery = storageResult.autoQueryVisible || false;

    if (!shouldAutoQuery) {
      console.log('[Threads] 自動查詢未啟用');
      return;
    }

    console.log('[Threads] 開始自動查詢可見用戶');

    // 獲取可見用戶
    const visibleUsers = getVisibleUsers();

    if (visibleUsers.length === 0) {
      console.log('[Threads] 沒有可見用戶');
      return;
    }

    // 找出尚未查詢的用戶（檢查標籤是否存在且為待查詢狀態）
    const unqueriedVisibleUsers = visibleUsers.filter(user => {
      const existingLabel = user.element.querySelector('.threads-region-label');
      if (!existingLabel) {
        //console.log(`[Threads] ${user.account} 沒有標籤，需要查詢`);
        return true; // 沒有標籤，需要查詢
      }

      // 1. 檢查標籤文字是否為「查詢中」
      const labelTextSpan = existingLabel.querySelector('.threads-label-text') || existingLabel;
      const labelText = (labelTextSpan.textContent || labelTextSpan.innerText || '').trim();
      if (labelText.includes('查詢中')) {
        //console.log(`[Threads] ${user.account} 正在查詢中，跳過`);
        return false; // 正在查詢中，跳過
      }

      // 2. 檢查標籤的背景色是否為黃色（待查詢狀態）
      const bgColor = existingLabel.style.backgroundColor;
      const isWaitingToQuery = bgColor === 'rgb(255, 193, 7)' || bgColor === '#ffc107';

      // 如果不是待查詢狀態（已經有其他顏色），表示已查詢過（有 region 資料）
      if (!isWaitingToQuery) {
        //console.log(`[Threads] ${user.account} 已查詢過（背景色: ${bgColor}），跳過`);
        return false; // 已查詢過，跳過
      }

      //console.log(`[Threads] ${user.account} bgColor ${bgColor}`);

      // 待查詢且不是查詢中
      return true;
    });

    console.log(`[Threads] 可見用戶中有 ${unqueriedVisibleUsers.length} 個待查詢`);

    if (unqueriedVisibleUsers.length === 0) {
      console.log('[Threads] 所有可見用戶都已查詢');
      return;
    }

    // 自動點擊查詢按鈕
    for (const user of unqueriedVisibleUsers) {
      const existingLabel = user.element.querySelector('.threads-region-label');
      if (existingLabel) {
        const queryButton = existingLabel.querySelector('.threads-query-btn');
        if (queryButton) {
          console.log(`[Threads] 自動查詢: ${user.account}`);
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
    console.log('[Threads] 捲動事件被節流機制忽略（距離上次更新不足 2 秒）');
    return;
  }
  
  // 更新最後一次捲動時間
  lastScrollUpdate = now;
  
  console.log('[Threads] 頁面捲動，通知 sidepanel 更新用戶列表');

  // 發送消息到 sidepanel
  chrome.runtime.sendMessage({
    action: 'pageScrolled'
  }).then(response => {
    if (response && response.success) {
      console.log('[Threads] Sidepanel 已收到捲動通知');
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

  // 重置狀態
  profilePageHasAddedScrollListener = false;

  if (!threadsProfileRegex.test(currentUrl)) {
    return;
  }

  console.log('[Threads] 檢測到用戶資料頁，幫粉絲頁加入事件監聽器');

  profilePageCheckTimer = setInterval(() => {
    if (profilePageHasAddedScrollListener) return;

    const element = findProfilePageFollowerElement();

    console.log('[Threads] 查看粉絲頁元素', element);

    if (element) {
      element.addEventListener(
        'scroll',
        () => handlePageScroll(false),
        { passive: true }
      );

      profilePageHasAddedScrollListener = true;
      clearInterval(profilePageCheckTimer);
      profilePageCheckTimer = null;
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
