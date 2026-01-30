$baseDir = "assets/images/skill-icons"
if (-not (Test-Path $baseDir)) { New-Item -ItemType Directory -Path $baseDir }

$downloads = @(
    # Magnus (2024/08)
    @{ Base = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/"; Files = 500381..500388 | ForEach-Object { "hero_skill_icon_$_.png" } },
    @{ Base = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/"; Files = @("equipment_icon_1050038.png") },

    # Sonya (2024/05)
    @{ Base = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/05/"; Files = 500351..500358 | ForEach-Object { "hero_skill_icon_$_.png" } },
    @{ Base = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/05/"; Files = @("equipment_icon_1050035.png") },

    # Fred (2024/08)
    @{ Base = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/"; Files = 500391..500398 | ForEach-Object { "hero_skill_icon_$_.png" } },
    @{ Base = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/"; Files = @("equipment_icon_1050039.png") }
)

foreach ($group in $downloads) {
    foreach ($file in $group.Files) {
        $url = $group.Base + $file
        $dest = Join-Path $baseDir $file
        Write-Host "Downloading $file..."
        try {
            Invoke-WebRequest -Uri $url -OutFile $dest -UserAgent "Mozilla/5.0"
        } catch {
            Write-Host "Failed to download $file : $_"
        }
    }
}
