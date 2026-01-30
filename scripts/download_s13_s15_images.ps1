$urls = @{
    "hank.png" = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/01/%E6%B1%89%E5%85%8B.png"
    "estella.png" = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/01/%E8%89%be%E6%96%AF%E9%BB%9B%E6%8B%89%EF%BC%88%E7%94%BB%E5%AE%B6%EF%BC%89.png"
    "vivica.png" = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/01/%E7%BB%B4%E8%96%87%E5%8D%A1.png"
    "gisela.png" = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8Fgisela.jpg"
    "flora.png" = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8FFlora.jpg"
    "vulcanus.png" = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8Fvulcanus.jpg"
}

$destDir = "assets/images/heroes"
if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir }

foreach ($key in $urls.Keys) {
    $url = $urls[$key]
    $dest = Join-Path $destDir $key
    Write-Host "Downloading $key from $url..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $dest -UserAgent "Mozilla/5.0"
        Write-Host "  Success!"
    } catch {
        Write-Host "  Failed: $_"
    }
}
