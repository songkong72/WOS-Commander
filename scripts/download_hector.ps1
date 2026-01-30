$baseDir = "assets/images/skill-icons"

$downloads = @(
    # Hector Skills (2023/09)
    @{ Base = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/09/"; Files = 1..8 | ForEach-Object { "hero_skill_icon_50024${_}.png" } },
    # Hector Equipment (2024/01)
    @{ Base = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/01/"; Files = @("equipment_icon_1050024.png") }
)

foreach ($group in $downloads) {
    foreach ($file in $group.Files) {
        $url = $group.Base + $file
        $dest = Join-Path $baseDir $file
        Write-Host "Downloading $file..."
        try {
            Invoke-WebRequest -Uri $url -OutFile $dest -UserAgent "Mozilla/5.0"
        } catch {
            Write-Host "Failed to download $file from $($group.Base)"
        }
    }
}
