# 小黃標 - Threads User Location Tag

<p align="center">
  <strong>可以將 Threads 用戶所在地資訊，自動顯示在小黃標籤上</strong><br>
  <em>Automatically extracts and reveals location-related text from Threads posts for quick identification</em>
</p>

---

## 📖 簡介 | Introduction

**小黃標** 是一款 Chrome 瀏覽器擴充功能，可以自動偵測並顯示 Threads 用戶的所在地區資訊。透過醒目的標籤設計，讓您快速識別用戶來自哪個國家或地區。

**Threads User Location Tag** is a Chrome browser extension that automatically detects and displays the location information of Threads users. With eye-catching label designs, you can quickly identify which country or region a user is from.

---

## ✨ 功能特色 | Features

### 🏷️ 自動標籤顯示 | Auto Label Display
- 在每位用戶名稱旁自動加入所在地標籤
- Automatically adds location tags next to each username

### 🔍 一鍵查詢 | One-Click Query
- 點擊「查詢」按鈕，自動開啟新分頁查詢用戶位置
- Click the "Query" button to automatically open a new tab and query user location

### 🎨 顏色區分 | Color Coding
- **綠色 Green**: 台灣 Taiwan
- **紅色 Red**: 中國 China
- **粉紅色 Pink**: 其他國家/地區 Other countries/regions
- **灰色 Gray**: 未揭露 Not disclosed
- **黃色 Yellow**: 待查詢 Pending query

### 💾 本機快取 | Local Cache
- 查詢結果自動儲存於本機，避免重複查詢
- Query results are automatically saved locally to avoid repeated queries

### ⚡ 自動查詢模式 | Auto Query Mode
- 可開啟自動查詢功能，批次處理多位用戶
- Enable auto-query feature to batch process multiple users

---

## 📥 安裝方式 | Installation

### 開發者模式安裝 | Developer Mode Installation

1. **下載專案 | Download the project**
   ```bash
   git clone https://github.com/GeoffSpacetime/threads-geo-tag.git
   ```

2. **開啟 Chrome 擴充功能頁面 | Open Chrome Extensions page**
   - 在網址列輸入 `chrome://extensions/`
   - Enter `chrome://extensions/` in the address bar

3. **啟用開發者模式 | Enable Developer Mode**
   - 開啟右上角的「開發者模式」開關
   - Toggle on "Developer mode" in the top right corner

4. **載入擴充功能 | Load the extension**
   - 點擊「載入未封裝項目」
   - Click "Load unpacked"
   - 選擇 `chrome-extension` 資料夾
   - Select the `chrome-extension` folder

---

## 🚀 使用方式 | Usage

### 基本使用 | Basic Usage

1. **開啟 Threads 網站 | Open Threads website**
   - 前往 [threads.net](https://www.threads.net)
   - Go to [threads.net](https://www.threads.net)

2. **開啟側邊欄 | Open Side Panel**
   - 點擊瀏覽器工具列上的擴充功能圖示
   - Click the extension icon in the browser toolbar
   - 側邊欄會自動開啟，並在頁面上顯示用戶所在地標籤
   - The side panel will open automatically and display location tags on the page

3. **查詢用戶位置 | Query User Location**
   - 點擊標籤上的「查詢」按鈕
   - Click the "Query" button on the tag
   - 系統會自動開啟新分頁並取得用戶所在地資訊
   - The system will automatically open a new tab and retrieve the user's location

4. **關閉功能 | Disable Feature**
   - 關閉側邊欄即可移除所有標籤
   - Close the side panel to remove all tags

### 進階功能 | Advanced Features

在側邊欄中點擊「進階功能...」可以使用以下選項：

Click "進階功能..." in the side panel to access the following options:

| 功能 Feature | 說明 Description |
|-------------|-----------------|
| **查詢後保留結果分頁** | 保留查詢時開啟的分頁，方便查看詳細資訊 |
| Keep result tabs | Keep the tabs opened during query for detailed information |
| **自動查詢** | 自動批次查詢頁面上的用戶 |
| Auto query | Automatically batch query users on the page |
| **同時最多查詢分頁數量** | 控制同時開啟的查詢分頁數（1-10） |
| Max concurrent tabs | Control the number of query tabs opened simultaneously (1-10) |
| **顯示/清除本機快取** | 管理已儲存的用戶所在地資料 |
| Show/Clear local cache | Manage saved user location data |

---

## 🔧 技術架構 | Technical Architecture

```
chrome-extension/
├── manifest.json       # 擴充功能設定檔 | Extension manifest
├── background.js       # 背景服務 | Background service worker
├── content.js          # 內容腳本（注入頁面）| Content script (injected into pages)
├── queryManager.js     # 查詢管理器（處理 API 請求）| Query manager (handles API requests)
├── sidepanel.html      # 側邊欄介面 | Side panel interface
├── sidepanel.js        # 側邊欄邏輯 | Side panel logic
├── sidepanel.css       # 側邊欄樣式 | Side panel styles
└── icons/              # 圖示資源 | Icon assets
```

### 運作流程 | How It Works

1. **Content Script** 掃描頁面上的 Threads 用戶連結
   - Scans Threads user links on the page

2. **Side Panel** 管理用戶介面與設定
   - Manages user interface and settings

3. **Background Service** 處理跨分頁通訊與查詢任務
   - Handles cross-tab communication and query tasks

4. **Query Manager** 管理查詢佇列、快取與並行控制
   - Manages query queue, cache, and concurrency control

---

## 🐛 除錯指南 | Debugging Guide

詳細的除錯說明請參考 [DEBUG.md](chrome-extension/DEBUG.md)

For detailed debugging instructions, please refer to [DEBUG.md](chrome-extension/DEBUG.md)

### 快速除錯 | Quick Debug

| Console 位置 | 日誌前綴 | 來源檔案 |
|-------------|---------|---------|
| 頁面 Console (F12) | `[Threads]`, `[Content]` | content.js |
| Service Worker Console | `[Background]`, `[QueryManager]`, `[Cache]` | background.js, queryManager.js |
| Sidepanel Console | `[Sidepanel]` | sidepanel.js |

---

## 📋 系統需求 | Requirements

- **瀏覽器 Browser**: Google Chrome (Manifest V3 支援)
- **網站 Website**: [threads.net](https://www.threads.net)

---

## 📄 授權條款 | License

本專案採用 [MIT License](LICENSE) 授權。

This project is licensed under the [MIT License](LICENSE).

---

## 🤝 貢獻 | Contributing

歡迎提交 Issue 或 Pull Request！

Issues and Pull Requests are welcome!

---

## ⚠️ 免責聲明 | Disclaimer

本擴充功能僅供個人使用，請遵守 Threads 的服務條款。所顯示的位置資訊來自用戶公開的個人資料。

This extension is for personal use only. Please comply with Threads' Terms of Service. The displayed location information comes from users' public profiles.
