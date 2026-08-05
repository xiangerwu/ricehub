<img src="docs/branding/ricehub-social-preview-zh-TW.png" alt="RiceHub 品牌預覽">

# RiceHub

**繁體中文** · [English](README.md)

RiceHub 是一款協助你用 AI 代理了解 GitHub 儲存庫的瀏覽器擴充功能。在儲存庫頁面按下 RiceHub 懸浮按鈕，它會準備一份聚焦的分析提示詞，並在 Claude Desktop、Codex Desktop 或自訂 HTTPS 目的地中開啟。

RiceHub 只會填入提示詞，不會替你送出。你可以先在代理中閱讀或修改內容，確認後再自行送出。

## 使用方式

1. 開啟 GitHub 儲存庫頁面。
2. 按下 RiceHub 懸浮按鈕。
3. 在選定的 AI 代理中檢查提示詞，準備好後再送出。

提示詞包含儲存庫的標準網址、頁面標題、偏好語言與已選分析項目。儲存庫資料會被視為不可信的資料，而不是指令。

## 主要功能

- 選擇 Claude Desktop、Codex Desktop 或自訂 HTTPS 網址。
- 分析用途、架構、安裝、維護狀態、風險、替代方案與適用性。
- 用自己的問法取代任何預設分析問題。
- 使用英文或繁體中文設定頁與分析報告。
- 調整懸浮按鈕的大小、顏色與位置。

## 安裝

**從瀏覽器商店安裝**

| 瀏覽器 | 商店 | 狀態 |
| --- | --- | --- |
| Edge | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/hjhgaaebgogmnekbdmlokdinnbdnmbbl) | 已上架 |
| Chrome | Chrome 線上應用程式商店 | 尚未送審 |
| Firefox | Firefox Add-ons（AMO） | 尚未送審 |

**從此儲存庫安裝**

**Firefox**

1. 開啟 `about:debugging`，選擇 **This Firefox**。
2. 選擇 **Load Temporary Add-on…**。
3. 選取 `manifest.json`。

Firefox 關閉後會移除臨時附加元件。

**Chrome 95+ 或 Edge**

1. 開啟 `chrome://extensions` 或 `edge://extensions`。
2. 啟用 **開發人員模式**。
3. 選擇 **載入未封裝項目**，再選取此儲存庫資料夾。

安裝後，開啟擴充功能設定並選擇目的地。Firefox 與 Edge 已完成人工驗證；Chrome 支援已實作，但仍待瀏覽器實測。

## 設定

- **目的地：** 選擇桌面代理，或提供剛好包含一次 `{prompt}` 的 HTTPS 樣板。
- **語言：** 控制設定頁與分析報告使用的語言。
- **分析項目：** 選擇報告主題，也可以取代各項目的預設問題。
- **懸浮按鈕：** 設定大小與各目的地的顏色；拖曳或使用方向鍵即可儲存新位置。

自訂問題請保持簡短。提示詞超過啟動網址限制時，RiceHub 會停止開啟，避免送出遭截斷的內容。

## 隱私與設計約束

- 只在符合 `https://github.com/*` 的 GitHub 頁面執行。
- 讀取目前儲存庫網址與頁面標題來建立提示詞。
- 不下載儲存庫檔案、不送出提示詞，也不取回分析結果。
- 只在本機儲存設定，不儲存儲存庫網址、提示詞、結果或憑證。
- 自訂目的地只接受 HTTPS；只有按下按鈕後，目的地才會收到資料。

## 疑難排解

1. 找不到按鈕時，確認目前是儲存庫頁面，再重新載入擴充功能與分頁。
2. 應用程式沒有開啟時，確認已安裝所選桌面程式，並允許瀏覽器開啟外部應用程式。
3. 某個目的地無法使用時，改試另一個，以確認問題是否出在桌面協定處理程式。
4. RiceHub 顯示問題過長時，到設定頁縮短自訂問題。

## 開發

此擴充功能使用 Manifest V3、原生 JavaScript 與 Node 內建測試執行器，沒有相依套件或建置步驟。

修改擴充功能行為或安全邊界前，請先閱讀[架構說明](ARCHITECTURE.md)。

```sh
npm test
```

```text
manifest.json   擴充功能 manifest
src/            擴充功能程式、設定頁與圖示
tests/          自動化測試與瀏覽器替身
docs/           品牌原始檔
store-assets/   商店文案與圖片
```
