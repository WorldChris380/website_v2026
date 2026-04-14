# Fix index.html by removing the incorrect main.js script tag
$root = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD.Path }
$indexPath = Join-Path $root "dist\photography_2026\browser\index.html"
$browserOut = Join-Path $root "dist\photography_2026\browser"
$flatOut = Join-Path $root "dist\photography_2026"

if (Test-Path $indexPath) {
    $content = Get-Content $indexPath -Raw -Encoding UTF8

    # Safety: remove stale main.js script tag if it somehow appears in dist
    $fixed = $content -replace '\s*<script src="main\.js" type="module"></script>', ''

    if ($fixed -ne $content) {
        Set-Content $indexPath $fixed -Encoding UTF8 -NoNewline
        Write-Host "index.html: removed stale main.js script tag"
    } else {
        Write-Host "index.html OK"
    }
} else {
    Write-Host "index.html not found at: $indexPath"
}

# Keep a flat deploy output in dist\photography_2026 for hosts that don't use the browser/ subfolder
if ((Test-Path $browserOut) -and (Test-Path $flatOut)) {
    robocopy $browserOut $flatOut /E /XO /XC /XN /NJH /NJS /NP /NFL /NDL | Out-Null
    Write-Host "Flattened browser build into dist\\photography_2026 for deployment compatibility"
}
