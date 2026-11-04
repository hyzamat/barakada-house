# Renders tools/og-card.html to site/og-card.jpg (the WhatsApp / social link-preview image, 1200x675).
# Usage: powershell -ExecutionPolicy Bypass -File tools\build_og.ps1
$root = Split-Path -Parent $PSScriptRoot
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$card = "file:///" + ((Join-Path $PSScriptRoot 'og-card.html') -replace '\\', '/')
$png = Join-Path $env:TEMP 'barkada-og.png'
$jpg = Join-Path $root 'site\og-card.jpg'

& $edge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
  --window-size=1200,675 --virtual-time-budget=8000 "--screenshot=$png" $card | Out-Null

Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($png)
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 86L
$img.Save($jpg, $codec, $params)
$img.Dispose()
Remove-Item $png
"Wrote $jpg ($([math]::Round((Get-Item $jpg).Length / 1KB)) KB)"
