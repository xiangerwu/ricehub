<img src="docs/branding/ricehub-logo.png" alt="" width="88" align="right">

# RiceHub

**繁體中文** · [English](README.md)

RiceHub 是一個 Firefox 擴充套件，可以把 GitHub 儲存庫的分析提示詞，開在 Claude Desktop、Codex Desktop 或你自己設定的 HTTPS 目的地。

在套件設定頁選好目的地、輸出語言、報告項目，以及各項目要不要用自訂問法。之後在 GitHub 儲存庫頁面上，用那個可拖曳的 RiceHub 面板按下 **Analyze with AI agent**。RiceHub 會正規化儲存庫網址、組出提示詞，然後請 Firefox 開啟你選的應用程式並把提示詞預先填好。你看過之後按 Enter 送出，報告就留在那個對話裡。

RiceHub 不會抓取儲存庫內容、不判斷儲存庫是公開或私有、不替你送出提示詞、不取回結果，也不儲存任何儲存庫資料。

## 安裝

RiceHub 沒有上架，要用臨時附加元件的方式載入：

1. 在 Firefox 打開 `about:debugging`。
2. 選 **This Firefox**（這個 Firefox）。
3. 選 **Load Temporary Add-on…**（載入臨時附加元件）。
4. 選這個專案裡的 `manifest.json`。
5. 打開套件的設定頁，選一個目的地。

臨時附加元件在 Firefox 關掉之後就會消失，所以重開瀏覽器要再做一次。

## 指令

```sh
npm test
```

用 Node 內建的測試執行器跑完整測試。這個專案沒有任何相依套件，也沒有建置步驟。

## 目錄結構

```text
manifest.json   Firefox manifest
src/            擴充套件腳本、設定頁與圖示
tests/          Node 測試與最小化的瀏覽器替身
docs/           品牌圖檔，不會跟著套件一起發布
aidd_docs/      產品架構、決策紀錄、路線圖與研究
```

## 疑難排解

按了面板卻沒有任何反應時：

1. **先確認你選的桌面版有裝。** 在 Firefox 網址列直接測 `claude://claude.ai/new?q=RiceHub%20test` 或 `codex://threads/new?prompt=RiceHub%20test`。如果對應的應用程式沒有打開，代表它的協定處理程式不可用——先把那個註冊修好，再回頭查 RiceHub。
2. **Firefox 如果跳出確認視窗，要允許它開啟外部應用程式。**
3. **換一個內建目的地再試一次。** 如果一個應用程式開得起來、另一個開不起來，問題邊界大概就在開不起來的那個應用程式的協定處理程式。
4. **改過本機的擴充套件檔案之後**，要重新載入臨時附加元件，也要重新整理 GitHub 的分頁。

關於 Codex：[`src/button.js`](src/button.js) 只在使用者真的點擊的當下，才把產生出來的連結放進 `href`，接著在下一個 task 就清掉。這樣既不會延遲原生連結的啟動，也不會讓自訂的提示詞指示留在 GitHub 的 DOM 裡。

## 設計約束

- Manifest V3，優先在 Windows 驗證，沒有建置步驟。
- 靜態 content script 只跑在 `https://github.com/*`，不要 `<all_urls>`。
- `storage` 只放設定，絕不放憑證、儲存庫網址、提示詞或結果。
- 內建的桌面協定是寫死的；自訂目的地只接受 HTTPS。
- 儲存庫的中繼資料與內容一律視為不可信的提示詞資料。
- 「Open request sent」（已送出開啟要求）是我們敢做的最強宣稱——**協定送達與否是觀察不到的**，所以不會說成「已開啟」。

產品研究、威脅模型與決策紀錄不放在這個儲存庫裡。
