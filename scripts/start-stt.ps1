param([int]$WebPort = 3000, [int]$SttPort = 8765, [switch]$BackendOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$python = Join-Path $projectRoot '.venv-stt\Scripts\python.exe'
if (!(Test-Path -LiteralPath $python)) { throw 'Run npm run stt:setup first.' }
New-Item -ItemType Directory -Force (Join-Path $projectRoot 'logs'), (Join-Path $projectRoot '.tmp') | Out-Null
$env:TEMP = Join-Path $projectRoot '.tmp'
$env:TMP = $env:TEMP
$env:PYTHONUTF8 = '1'
$env:STT_BACKEND_URL = "http://127.0.0.1:$SttPort"
$env:HF_HUB_OFFLINE = '1'

function Get-JsonStatus([string]$Url) {
    try { return Invoke-RestMethod -Uri $Url -TimeoutSec 2 } catch { return $null }
}

$health = Get-JsonStatus "$env:STT_BACKEND_URL/health"
if ($null -eq $health) {
    $backend = Start-Process -FilePath $python -ArgumentList @('-m', 'uvicorn', 'stt.api:app', '--host', '127.0.0.1', '--port', "$SttPort") -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'logs/stt-backend.log') -RedirectStandardError (Join-Path $projectRoot 'logs/stt-backend.err.log')
    $backend.Id | Set-Content -LiteralPath (Join-Path $projectRoot 'logs/stt-backend.pid')
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        $health = Get-JsonStatus "$env:STT_BACKEND_URL/health"
        if ($null -ne $health) { break }
        if ($backend.HasExited) { throw 'STT service exited. Read logs/stt-backend.err.log.' }
    }
}
if (!$health.ready -or $health.backend -ne 'sherpa-onnx') { throw 'STT model/service is not ready. Run npm run stt:setup and inspect logs.' }
if (!$BackendOnly) {
    if (!(Test-Path -LiteralPath 'node_modules/next/dist/bin/next')) { throw 'Run npm ci first.' }
    $webReady = $false
    try {
        $web = Invoke-WebRequest -Uri "http://127.0.0.1:$WebPort/stt" -UseBasicParsing -TimeoutSec 4
        $proxy = Get-JsonStatus "http://127.0.0.1:$WebPort/api/stt"
        $webReady = $web.StatusCode -eq 200 -and $proxy.ready -and $proxy.model_id -eq $health.model_id
    } catch {}
    if (!$webReady) {
        $node = (Get-Command node).Source
        $webProcess = Start-Process -FilePath $node -ArgumentList @('node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', "$WebPort") -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'logs/stt-web.log') -RedirectStandardError (Join-Path $projectRoot 'logs/stt-web.err.log')
        $webProcess.Id | Set-Content -LiteralPath (Join-Path $projectRoot 'logs/stt-web.pid')
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            Start-Sleep -Milliseconds 500
            if ($webProcess.HasExited) { throw 'Next server exited. Read logs/stt-web.err.log; use -WebPort if port 3000 is occupied.' }
            $proxy = Get-JsonStatus "http://127.0.0.1:$WebPort/api/stt"
            if ($proxy.ready -and $proxy.model_id -eq $health.model_id) { $webReady = $true; break }
        }
    }
    if (!$webReady) { throw 'Web startup timed out. Read logs/stt-web.err.log.' }
    Write-Host "STT experiment: http://localhost:$WebPort/stt"
}
Write-Host "STT backend: $env:STT_BACKEND_URL/health"
Write-Host 'Services run in the background. Logs and process IDs are in logs/.'
