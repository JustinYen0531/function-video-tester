$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$url = 'http://127.0.0.1:43127'
try { $response = Invoke-RestMethod "$url/api/records" -TimeoutSec 2; $ready = $true } catch { $ready = $false }
if (-not $ready) {
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    Start-Process -FilePath $node -ArgumentList ('"' + (Join-Path $root 'server.js') + '"') -WorkingDirectory $root -WindowStyle Hidden
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try { $response = Invoke-RestMethod "$url/api/records" -TimeoutSec 1; $ready = $true; break } catch { Start-Sleep -Milliseconds 250 }
    }
}
if (-not $ready) { throw '驗收中心未啟動。請確認 Node.js 已安裝，且 43127 沒有被其他程式占用。' }
Start-Process $url
