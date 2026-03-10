# Fix index.html by removing the incorrect main.js script tag
$root = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD.Path }
$indexPath = Join-Path $root "dist\photography_2026\browser\index.html"

if (Test-Path $indexPath) {
    $content = Get-Content $indexPath -Raw -Encoding UTF8
    
    # Remove the main.js script tag
    $content = $content -replace '\s*<script src="main\.js" type="module"></script>', ''
    
    # Write back with UTF8 encoding
    Set-Content $indexPath $content -Encoding UTF8 -NoNewline
    
    Write-Host "index.html fixed successfully"
} else {
    Write-Host "index.html not found at: $indexPath"
}
