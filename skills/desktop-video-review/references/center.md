# 中心定位、加入與交付

本技能採用 function-video-tester 本機驗收影片中心。第一次在當前專案使用技能時自動加入；之後用同一個專案編號登記。不要再次問是否採用中心，不批次加入其他專案。共同名錄位於中心資料目錄的 projects.json；程式回傳的名錄也是使用者手動加入的同一份資料。

## 定位

使用本技能目錄內的 `scripts/center.js`，命令均以 `node` 執行。位置依序取自 `REVIEW_CENTER_HOME` 環境變數、共享本機設定 `%LOCALAPPDATA%/function-video-tester/center.local.json`。可用 `REVIEW_CENTER_CONFIG` 指定不同設定檔；設定保存 root 與 dataDir，若 `REVIEW_DATA_DIR` 已設定則優先使用該資料目錄。此設定只留本機，不寫入公開 Git 或專案規則。中心啟動捷徑會自動保存設定。

```powershell
node "技能目錄\scripts\center.js" projects
```

命令讀取設定並確認位置是正確的中心，回傳 root 及名錄。中心網頁不必開啟；這是本機檔案登記，不依賴瀏覽器連線。找不到設定時，如果當前技能位於中心倉庫 `skills/desktop-video-review`，可核對根目錄 package.json 的 name 是 desktop-video-review-center，再執行 configure。独立安裝版本則只詢問中心資料夾位置（不是詢問是否加入），不要掃描硬碟猜位置。

```powershell
node "技能目錄\scripts\center.js" configure "中心資料夾完整路徑"
```

## 首次加入與重用

先以 projects 讀取共同名錄，再以目前工作範圍的實際本機資料夾呼叫 join。不要求 Git；名稱預設取資料夾名稱。命令核對現存資料夾，處理 Windows 大小寫及資料夾連結指向，相同資料夾不重複加入。不同資料夾即使同名仍分開登記。

```powershell
node "技能目錄\scripts\center.js" join "當前專案資料夾完整路徑"
```

可選的第三個參數是 JSON 檔，包含 name、git、shortcut；只從目前專案已有資訊填寫，缺少則略過，不需為此詢問。空白資料不覆蓋使用者已登記的資訊。只讀名錄辨識當前專案，不操作其他項目的資料夾。資料夾搬移後視為新位置，不能憑同名自行合併。舊版只按名稱保存的驗收紀錄原樣保留，不猜測其資料夾。

## 結果登記

依中心 example-record.json 填 ticket、category、reason、version、video、result、items、untested、retries；video 為原始影片完整路徑，錄製失敗時 null 並寫原因。每次重試各留一筆，不挑成功片段。結果檔命名 `.local.json` 並留在不提交的本機工作目錄。

```powershell
node "技能目錄\scripts\center.js" record "當前專案資料夾完整路徑" "結果.local.json"
```

此命令再次確認專案並寫入該專案編號，回傳 id 與 pending；忽略結果檔自行提供的人工通過狀態。在中心重新整理即可看到。使用者手動加入的專案可在無影片時列出。人工通過必須由使用者決定，代理不得操作中心人工審查入口。

失敗回傳 complete:false 與錯誤，record 會盡可能將待登記副本保存於 `%LOCALAPPDATA%/function-video-tester/pending`；副本包含 folder、input 與錯誤。如副本也無法保存，原始結果檔與影片仍應保留並回報。修復後用原始結果檔重試 record；先檢查中心有沒有已登記的相同嘗試，避免在不確定是否成功時重複寫入。待登記副本的 input 可另存為結果檔，不直接把包裝副本當結果傳入。中心未接入成功不得宣稱完整交付，也不丟棄影片或默認通過。
