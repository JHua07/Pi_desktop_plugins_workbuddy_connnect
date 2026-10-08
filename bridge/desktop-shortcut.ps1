param([ValidateSet('install','remove')][string]$Operation,[Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference='Stop'
$desktop=[Environment]::GetFolderPath('Desktop')
$oldPath=Join-Path $desktop 'PI WorkBuddy Connect.lnk'
# Only remove the legacy link created by this project. Do not restore quarantined files.
if(Test-Path -LiteralPath $oldPath) {
  $shell=New-Object -ComObject WScript.Shell
  $old=$shell.CreateShortcut($oldPath)
  if($old.Description -ne 'PI WorkBuddy Connect local dashboard') { throw 'Unrelated legacy shortcut; refusing to remove it.' }
  Remove-Item -LiteralPath $oldPath
}
$path=Join-Path $desktop 'PI WorkBuddy Connect.url'
$marker='; PI WorkBuddy Connect browser-only dashboard'
if((Test-Path -LiteralPath $path) -and !(Get-Content -LiteralPath $path -Raw).Contains($marker)) { throw 'Unrelated internet shortcut; refusing to replace it.' }
if($Operation -eq 'remove') { if(Test-Path -LiteralPath $path){Remove-Item -LiteralPath $path};exit 0 }
$config=Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$port=[int]$config.environment.PI_WORKBUDDY_PORT
if($port -lt 1 -or $port -gt 65535) { throw 'Invalid port.' }
$content=$marker+"`r`n[InternetShortcut]`r`nURL=http://127.0.0.1:"+$port+"/dashboard/`r`n"
[IO.File]::WriteAllText($path,$content,[Text.Encoding]::ASCII)
