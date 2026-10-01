# OBS 連接與錄影

OBS 28 以上內建 WebSocket。先在 OBS 的工具選單啟用 WebSocket，保留驗證。來源與保存路徑由 OBS 現有設定決定，確認只捕捉已授權範圍。Windows 電腦操作需要目標程式保持在目前桌面，不能承諾鎖屏後继续。

配套腳本以 PowerShell 連接本機 OBS。密碼從環境變數 OBS_WEBSOCKET_PASSWORD 讀取，不寫入技能或驗收紀錄。預設連接 ws://127.0.0.1:4455，可用 Uri 參數改成本機端點。不要把密碼印到對話或命令輸出。

```powershell
pwsh -File scripts/obs-record.ps1 -Action status
pwsh -File scripts/obs-record.ps1 -Action start
pwsh -File scripts/obs-record.ps1 -Action stop
```

Windows PowerShell 也可用 powershell 執行。start 在 OBS 已錄製時拒絕接管；stop 只在呼叫者確認為本次錄影時使用，腳本本身不能跨呼叫判定所有權。停止結果包含 OBS 的保存檔案位置。不可因呼叫成功便宣稱影片內容正確。

若 OBS 尚未設定或連線失敗，回報最小必要設定，不自行安裝、改來源或停止其他人的錄影。

官方來源：
- https://learn.chatgpt.com/docs/computer-use
- https://obsproject.com/kb/remote-control-guide
- https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
