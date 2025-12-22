# 小黃標 - Threads 用戶所在地與側寫標籤

<p align="center">
  <strong>快速查詢與顯示 Threads 用戶的所在地區資訊與 AI 側寫分析</strong>
</p>

---

## 📖 簡介

**小黃標** 是一款 Chrome 瀏覽器擴充功能，可以快速查詢與顯示 Threads 用戶的所在地區資訊，以及 AI 分析用戶過去發言與回覆紀錄，協助識別帳號可信度。

### 核心功能

- ✅ **以小標籤方式顯示於用戶資訊旁**，便於即時查看
- ✅ **彙整 Threads 用戶的公開資料**與歷史互動紀錄
- ✅ **透過 AI 進行文字內容與行為特徵分析**，提供用戶側寫標註作為參考
- ✅ **所有資訊皆來自公開可取得內容**，分析結果僅於使用者本地端處理與留存，不蒐集或回傳任何個人資料
- ✅ **對於可能包含攻擊性言論、疑似詐騙或仇恨內容的貼文**，系統會自動降低顯示重要度，讓你更專注在有價值的內容上

---

## ✨ 功能特色

### 🏷️ 自動標籤顯示
在每位用戶名稱旁自動加入所在地標籤

### 🔍 一鍵查詢
點擊「查詢」按鈕，自動開啟新分頁查詢用戶位置

### 🎨 顏色區分

標籤顏色會根據用戶的所在地與 AI 側寫標籤自動判定，優先順序如下：

#### 🟢 綠色
- **手動信任清單中的用戶** - 使用者手動標記為可信任的帳號
- **其他已查詢用戶** - 已完成查詢且未觸發灰色或紅色條件的用戶

#### 🟡 黃色
- **待查詢** - 尚未查詢所在地與側寫資訊的用戶

#### ⚫ 灰色
標籤與貼文內容都會變成灰色，降低顯示重要度

**觸發條件：**
- **AI 側寫標籤包含**：易怒、謾罵、人身攻擊、詐騙風險、統戰言論、仇恨言論、刻意引戰、攻擊發言、惡意嘲諷
- **所在地為**：China, India, Bangladesh, Afghanistan, Uzbekistan, Tunisia, Kenya, Brazil, Bulgaria, Saudi Arabia, Libya, Nigeria, Czech Republic, Colombia, Cambodia, Russia, Pakistan
- **所在地為**：Not shared（未揭露）、[未揭露null]、未揭露

**灰色標籤功能：**
- 會顯示「手動信任」按鈕，點擊後可將該用戶加入信任清單，標籤會變為綠色

#### 🔴 紅色（目前停用）
- **所在地為 China** 或 **AI 側寫標籤包含**：仇恨言論、統戰言論
- 由於本機 LLM 模型能力有限，目前暫時停用紅色標籤功能

**注意事項：**
- AI 側寫標籤支援「標籤:理由」格式，系統只會比對標籤部分
- 手動信任清單的優先級最高，會覆蓋所有其他顏色判定

### 💾 本機快取
查詢結果自動儲存於本機，避免重複查詢

### ⚡ 自動查詢模式
可開啟自動查詢功能，批次處理多位用戶

### 🤖 AI 社群行為分析
- 根據用戶近期的貼文與回覆，由 AI 分析並自動產生使用者的側寫標籤
- **注意**：此功能為實驗性功能，AI 產出的標籤不一定正確，仍需自行評估參考價值

---

## 📥 安裝方式

### 方法一：標準安裝

從 Chrome 線上應用程式商店安裝：

👉 **[Chrome Web Store - Threads Geo Tag](https://chromewebstore.google.com/detail/fpodgdlampongmicaeelhelejggonkid)**

### 方法二：從原始碼安裝

可安裝尚未通過審查的最新版本

1. **下載最新版本原始碼**
   - 前往 [GitHub Releases](https://github.com/dtwang/threads-geo-tag/releases) 頁面
   - 下載最新版本的原始碼壓縮檔

2. **開啟 Chrome 擴充功能頁面**
   - 在網址列輸入 `chrome://extensions/`

3. **啟用開發者模式**
   - 開啟右上角的「開發者模式」開關

4. **載入擴充功能**
   - 點擊「載入未封裝項目」
   - 解壓縮剛剛下載的原始碼檔案，選擇 `threads-geo-tag-0.9.x/chrome-extension` 資料夾來安裝

5. **固定擴充功能**
   - 為方便隨時開關使用，可以將這個擴充功能設定固定 (pin) 在瀏覽器上

---

## 🚀 使用方式

### 基本使用

1. **開啟 Threads 網站**
   - 前往 [threads.com](https://www.threads.com)

2. **開啟側邊欄**
   - 點擊瀏覽器工具列上的擴充功能圖示
   - 側邊欄會自動開啟，並在頁面上顯示用戶所在地標籤

3. **查詢用戶位置**
   - 點擊標籤上的「查詢」按鈕
   - 系統會自動開啟新分頁並取得用戶所在地資訊

4. **關閉功能**
   - 關閉側邊欄即可移除所有標籤

### 進階功能選項說明

在側邊欄中點擊「進階功能...」可以使用以下選項：

#### 🤖 社群行為分析

可根據用戶近期的貼文與回覆功能，由 AI 分析並自動產生使用者的側寫標籤。

**⚠️ 此功能為實驗性功能，AI 產出的標籤不一定正確，仍需自行評估參考價值。**

目前支援兩種方式：

**1. OpenAI 的雲端 API**
- 需要自行準備 API Key，並支付相關呼叫費用

**2. Chrome 提供的本地 LLM**

系統需求：
- Windows 10 or 11; macOS 13+ (Ventura and onwards); Linux; or ChromeOS (from Platform 16389.0.0 and onwards) on Chromebook Plus devices
- Chrome for Android, iOS, and ChromeOS on non-Chromebook Plus devices are not yet supported
- **GPU**: Strictly more than 4 GB of VRAM
- **CPU**: 16 GB of RAM or more and 4 CPU cores or more

詳細資訊：[Chrome Prompt API Documentation](https://developer.chrome.com/docs/ai/prompt-api)

#### 📑 其他進階選項

| 功能 | 說明 |
|-----|------|
| **查詢後保留結果分頁** | 此選項啟用時，查詢後會保留分頁不關閉。可以用來查看用戶資訊、截圖分享、或是進一步做封鎖或退追蹤的處理 |
| **自動查詢** | 如果不想要逐一點擊查詢，也可以啟動自動查詢功能 |
| **同時最多查詢分頁數量** | 控制同時開啟的查詢分頁數（1-10） |

**⚠️ 重要提醒**

為避免因查詢過於頻繁，被停用查詢功能，建議不要一次開啟過多查詢分頁。如自動大量查詢時，有可能超過 Threads 的每日或每小時查詢上限，會出現暫時無法查詢（HTTP 409）或無法進入用戶資料頁的情況。建議稍等數小時或一天後再試，功能通常會自動恢復。但仍建議避免過度使用，以免因過量操作而增加帳號被 Meta 停權的風險。

#### � 本機儲存資料管理

| 功能 | 說明 |
|-----|------|
| **顯示本機快取** | 系統會自動於本機儲存已經完成的查詢結果，以便下次顯示時加速。可以將已經查詢的結果顯示在下方文字區塊 |
| **清除本機快取** | 手動清除已儲存的查詢結果，以便重新查詢 |

---

## 🔧 技術架構

```
chrome-extension/
├── manifest.json         # 擴充功能設定檔
├── background.js         # 背景服務工作器
├── content.js            # 內容腳本（注入頁面）
├── queryManager.js       # 查詢管理器（處理 API 請求）
├── llmAnalyzer.js        # AI 分析模組（用戶側寫分析）
├── sidepanel.html        # 側邊欄介面
├── sidepanel.js          # 側邊欄邏輯
├── sidepanel-loader.js   # 側邊欄載入器
├── sidepanel.css         # 側邊欄樣式
└── icons/                # 圖示資源
```

### 核心模組說明

| 模組 | 功能說明 |
|------|---------|
| **manifest.json** | 定義擴充功能的權限、版本與資源配置 |
| **background.js** | 背景服務工作器，處理跨分頁通訊、訊息路由與查詢任務協調 |
| **content.js** | 注入至 Threads 頁面的內容腳本，負責掃描用戶連結、添加標籤、處理 DOM 操作 |
| **queryManager.js** | 查詢管理器，管理查詢佇列、快取機制、並行控制與 API 請求 |
| **llmAnalyzer.js** | AI 分析模組，整合 OpenAI API 與 Chrome 本地 LLM，進行用戶行為分析與側寫標籤生成 |
| **sidepanel.html/js/css** | 側邊欄使用者介面，提供設定選項、快取管理與 AI 分析功能控制 |
| **sidepanel-loader.js** | 側邊欄載入器，處理側邊欄初始化與資源載入 |

### 運作流程

1. **Content Script** 掃描頁面上的 Threads 用戶連結，並在用戶名稱旁添加小黃標籤
2. **Side Panel** 管理用戶介面與設定，包含自動查詢、AI 分析、快取管理等功能
3. **Background Service** 處理跨分頁通訊與查詢任務，協調各模組之間的訊息傳遞
4. **Query Manager** 管理查詢佇列、快取與並行控制，避免過度查詢觸發 API 限制
5. **LLM Analyzer** 當啟用 AI 分析功能時，收集用戶公開貼文與回覆，透過 AI 生成側寫標籤

---

## 📋 系統需求

- **瀏覽器**: Google Chrome (Manifest V3 支援)
- **網站**: [threads.net](https://www.threads.net)

---

## 📄 授權條款

本專案採用 [MIT License](LICENSE) 授權。

---

## 🤝 貢獻

歡迎提交 Issue 或 Pull Request！

---

## ⚠️ 免責聲明

本擴充功能僅供個人使用，請遵守 Threads 的服務條款。所顯示的位置資訊來自用戶公開的個人資料。

---

## 👤 作者

[@geoff_spacetime](https://www.threads.com/@geoff_spacetime)

---

## 📚 使用說明

詳細使用說明請參閱：

👉 [https://ddo-taiwan.gitbook.io/toolkit/ss/threads-geo-tag/](https://ddo-taiwan.gitbook.io/toolkit/ss/threads-geo-tag/)

---
---

# Threads User Location Tag

<p align="center">
  <strong>Quickly query and display Threads users' location information and AI profiling analysis</strong>
</p>

---

## 📖 Introduction

**Threads User Location Tag** is a Chrome browser extension that quickly queries and displays Threads users' location information, and uses AI to analyze users' past posts and replies to help identify account credibility.

### Core Features

- ✅ **Display tags next to user information** for instant viewing
- ✅ **Aggregate Threads users' public data** and interaction history
- ✅ **AI-powered text and behavioral analysis** to provide user profiling tags for reference
- ✅ **All information comes from publicly available content**, analysis results are processed and stored locally only, no personal data is collected or transmitted
- ✅ **For posts with potentially offensive, fraudulent, or hateful content**, the system automatically reduces their display priority to help you focus on valuable content

---

## ✨ Features

### 🏷️ Auto Label Display
Automatically adds location tags next to each username

### 🔍 One-Click Query
Click the "Query" button to automatically open a new tab and query user location

### 🎨 Color Coding

Tag colors are automatically determined based on user location and AI profiling tags, with the following priority:

#### 🟢 Green
- **Users in manual trust list** - Accounts manually marked as trusted by the user
- **Other queried users** - Completed queries that don't trigger gray or red conditions

#### 🟡 Yellow
- **Pending query** - Users whose location and profile haven't been queried yet

#### ⚫ Gray
Both tag and post content turn gray to reduce visibility

**Triggered by:**
- **AI profiling tags include**: 易怒, 謾罵, 人身攻擊, 詐騙風險, 統戰言論, 仇恨言論, 刻意引戰, 攻擊發言, 惡意嘲諷
- **Location is**: China, India, Bangladesh, Afghanistan, Uzbekistan, Tunisia, Kenya, Brazil, Bulgaria, Saudi Arabia, Libya, Nigeria, Czech Republic, Colombia, Cambodia, Russia, Pakistan
- **Location is**: Not shared, [未揭露null], 未揭露

**Gray Tag Features:**
- Shows "Manual Trust" button - click to add user to trust list and turn tag green

#### 🔴 Red (Currently Disabled)
- **Location is China** OR **AI profiling tags include**: 仇恨言論, 統戰言論
- Currently disabled due to limited local LLM capabilities

**Notes:**
- AI profiling tags support "tag:reason" format, system only matches the tag portion
- Manual trust list has highest priority and overrides all other color determinations

### 💾 Local Cache
Query results are automatically saved locally to avoid repeated queries

### ⚡ Auto Query Mode
Enable auto-query feature to batch process multiple users

### 🤖 AI Social Behavior Analysis
- AI analyzes users' recent posts and replies to automatically generate user profiling tags
- **Note**: This is an experimental feature. AI-generated tags may not be accurate and should be evaluated for reference value

---

## 📥 Installation

### Method 1: Standard Installation

Install from Chrome Web Store:

👉 **[Chrome Web Store - Threads Geo Tag](https://chromewebstore.google.com/detail/fpodgdlampongmicaeelhelejggonkid)**

### Method 2: Install from Source Code

Install the latest version that hasn't been reviewed yet

1. **Download the latest source code**
   - Go to the [GitHub Releases](https://github.com/dtwang/threads-geo-tag/releases) page
   - Download the latest version source code archive

2. **Open Chrome Extensions page**
   - Enter `chrome://extensions/` in the address bar

3. **Enable Developer Mode**
   - Toggle on "Developer mode" in the top right corner

4. **Load the extension**
   - Click "Load unpacked"
   - Extract the downloaded source code file and select the `threads-geo-tag-0.9.x/chrome-extension` folder to install

5. **Pin the Extension**
   - For easy access, you can pin this extension to your browser toolbar

---

## 🚀 Usage

### Basic Usage

1. **Open Threads website**
   - Go to [threads.com](https://www.threads.com)

2. **Open Side Panel**
   - Click the extension icon in the browser toolbar
   - The side panel will open automatically and display location tags on the page

3. **Query User Location**
   - Click the "Query" button on the tag
   - The system will automatically open a new tab and retrieve the user's location

4. **Disable Feature**
   - Close the side panel to remove all tags

### Advanced Features

Click "進階功能..." in the side panel to access the following options:

#### 🤖 Social Behavior Analysis

AI can analyze users' recent posts and replies to automatically generate user profiling tags.

**⚠️ This is an experimental feature. AI-generated tags may not be accurate and should be evaluated for reference value.**

Currently supports two methods:

**1. OpenAI Cloud API**
- Requires your own API Key and payment for API calls

**2. Chrome Built-in Local LLM**

System Requirements:
- Windows 10 or 11; macOS 13+ (Ventura and onwards); Linux; or ChromeOS (from Platform 16389.0.0 and onwards) on Chromebook Plus devices
- Chrome for Android, iOS, and ChromeOS on non-Chromebook Plus devices are not yet supported
- **GPU**: Strictly more than 4 GB of VRAM
- **CPU**: 16 GB of RAM or more and 4 CPU cores or more

More information: [Chrome Prompt API Documentation](https://developer.chrome.com/docs/ai/prompt-api)

#### 📑 Other Advanced Options

| Feature | Description |
|---------|-------------|
| **Keep result tabs** | When enabled, tabs will remain open after query. Useful for viewing user info, taking screenshots, or blocking/unfollowing |
| **Auto query** | Enable automatic querying if you don't want to click each query button manually |
| **Max concurrent tabs** | Control the number of query tabs opened simultaneously (1-10) |

**⚠️ Important Notice**

To avoid being rate-limited, don't open too many query tabs at once. Excessive automatic queries may exceed Threads' daily or hourly limits, resulting in temporary query failures (HTTP 409) or inability to access user profile pages. Wait a few hours or a day before retrying. Avoid excessive use to reduce the risk of account suspension by Meta.

#### 💾 Local Storage Management

| Feature | Description |
|---------|-------------|
| **Show local cache** | The system automatically stores completed query results locally for faster display. View cached results in the text area below |
| **Clear local cache** | Manually clear stored query results to re-query users |

---

## 🔧 Technical Architecture

```
chrome-extension/
├── manifest.json         # Extension manifest
├── background.js         # Background service worker
├── content.js            # Content script (injected into pages)
├── queryManager.js       # Query manager (handles API requests)
├── llmAnalyzer.js        # AI analyzer module (user profiling)
├── sidepanel.html        # Side panel interface
├── sidepanel.js          # Side panel logic
├── sidepanel-loader.js   # Side panel loader
├── sidepanel.css         # Side panel styles
└── icons/                # Icon assets
```

### Core Modules

| Module | Description |
|--------|-------------|
| **manifest.json** | Defines extension permissions, version, and resource configuration |
| **background.js** | Background service worker handling cross-tab communication, message routing, and query task coordination |
| **content.js** | Content script injected into Threads pages, scans user links, adds tags, handles DOM operations |
| **queryManager.js** | Query manager handling query queue, cache mechanism, concurrency control, and API requests |
| **llmAnalyzer.js** | AI analyzer module integrating OpenAI API and Chrome built-in LLM for user behavior analysis and profiling tag generation |
| **sidepanel.html/js/css** | Side panel UI providing settings, cache management, and AI analysis feature controls |
| **sidepanel-loader.js** | Side panel loader handling initialization and resource loading |

### How It Works

1. **Content Script** scans Threads user links on the page and adds small yellow tags next to usernames
2. **Side Panel** manages user interface and settings including auto-query, AI analysis, and cache management
3. **Background Service** handles cross-tab communication and query tasks, coordinates message passing between modules
4. **Query Manager** manages query queue, cache, and concurrency control to avoid triggering API rate limits
5. **LLM Analyzer** when AI analysis is enabled, collects users' public posts and replies, generates profiling tags via AI

---

## 📋 Requirements

- **Browser**: Google Chrome (Manifest V3 support)
- **Website**: [threads.net](https://www.threads.net)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

---

## ⚠️ Disclaimer

This extension is for personal use only. Please comply with Threads' Terms of Service. The displayed location information comes from users' public profiles.

---

## 👤 Author

[@geoff_spacetime](https://www.threads.com/@geoff_spacetime)

---

## 📚 Documentation

For detailed documentation, please visit:

👉 [https://ddo-taiwan.gitbook.io/toolkit/ss/threads-geo-tag/](https://ddo-taiwan.gitbook.io/toolkit/ss/threads-geo-tag/)
