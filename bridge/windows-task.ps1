param(
  [ValidateSet('install','start','stop','status','uninstall','disable')][string]$Operation,
  [Parameter(Mandatory=$true)][string]$ConfigPath,
  [switch]$KeepRunning
)
$ErrorActionPreference = 'Stop'
$taskName = 'PI-WorkBuddy-Connect'
$marker = 'PI WorkBuddy Connect managed companion v1'
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and $existing.Description -ne $marker) { throw 'A different task uses PI-WorkBuddy-Connect; refusing to replace it.' }
if ($Operation -eq 'install') {
  $config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if (!(Test-Path -LiteralPath $config.nodePath -PathType Leaf) -or !(Test-Path -LiteralPath $config.cliPath -PathType Leaf)) { throw 'Node or companion path is unavailable.' }
  $runner = Join-Path $PSScriptRoot 'runner.cjs'
  foreach ($path in @($runner, $ConfigPath)) { if ($path.Contains('"')) { throw 'Invalid path.' } }
  $arguments = '"' + $runner + '" "' + $ConfigPath + '"'
  $action = New-ScheduledTaskAction -Execute $config.nodePath -Argument $arguments -WorkingDirectory $PSScriptRoot
  $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
  $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  if ($existing -and !$KeepRunning) { Stop-ScheduledTask -TaskName $taskName }
  Register-ScheduledTask -TaskName $taskName -Description $marker -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  if (!$KeepRunning) { Start-ScheduledTask -TaskName $taskName }
  Write-Output 'Current-user login task enabled.'
} elseif ($Operation -eq 'uninstall') {
  if ($existing) { Stop-ScheduledTask -TaskName $taskName; Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
  Write-Output 'Login task removed. Local credentials, key and caches were preserved.'
} elseif ($Operation -eq 'status') {
  if (!$existing) { Write-Output 'not-installed'; exit 0 }
  $info = Get-ScheduledTaskInfo -TaskName $taskName
  [PSCustomObject]@{ task=$taskName; state=[string]$existing.State; enabled=[bool]$existing.Settings.Enabled; lastResult=$info.LastTaskResult; lastRun=$info.LastRunTime } | ConvertTo-Json -Compress
} elseif ($Operation -eq 'disable') {
  if ($existing) { Disable-ScheduledTask -TaskName $taskName | Out-Null }
  Write-Output 'Login startup disabled; current bridge remains running.'
} else {
  if (!$existing) { throw 'Login task is not installed. Run automation install first.' }
  if ($Operation -eq 'start') { Start-ScheduledTask -TaskName $taskName; Write-Output 'Started background task.' }
  else { Stop-ScheduledTask -TaskName $taskName; Write-Output 'Stopped background task; login startup is still enabled.' }
}
