$path = "e:\project\workspace\WOS-Commander\app\index.tsx"
$content = Get-Content -Path $path -Raw
# Escape regex special characters if needed, but here mostly standard
$pattern = "(?s)\s+\{\/\* Notice Detail Modal \*\/\}.*?<\/Modal>"
$newContent = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, "")
Set-Content -Path $path -Value $newContent -Encoding UTF8
Write-Host "Fixed nested modal."
