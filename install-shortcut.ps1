$ErrorActionPreference = 'Stop'
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $desktop '驗收影片中心.lnk'))
$shortcut.TargetPath = (Join-Path $PSHOME 'powershell.exe')
if (-not (Test-Path $shortcut.TargetPath)) { $shortcut.TargetPath = (Get-Command powershell.exe).Source }
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $PSScriptRoot 'start.ps1') + '"'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description = '開啟本機驗收影片中心'
$shortcut.Save()
Write-Output (Join-Path $desktop '驗收影片中心.lnk')
