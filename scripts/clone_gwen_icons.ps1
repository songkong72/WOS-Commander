$baseDir = "assets/images/skill-icons"
$pairings = @(
    @{ Src = "hero_skill_icon_500251.png"; Dst = "hero_skill_icon_501711.png" },
    @{ Src = "hero_skill_icon_500252.png"; Dst = "hero_skill_icon_501712.png" },
    @{ Src = "hero_skill_icon_500253.png"; Dst = "hero_skill_icon_501713.png" }, # Note: Gwen's JSON has 501713 but Norah has 500253.
    # Gwen expdition/exploration order might differ, but copying by index is safe enough for placeholder.
    @{ Src = "hero_skill_icon_500254.png"; Dst = "hero_skill_icon_501714.png" }, # 500254 is exploration? Check Norah.
    @{ Src = "hero_skill_icon_500255.png"; Dst = "hero_skill_icon_501715.png" },
    @{ Src = "hero_skill_icon_500256.png"; Dst = "hero_skill_icon_501716.png" },
    # Equipment skills
    @{ Src = "hero_skill_icon_500257.png"; Dst = "hero_skill_icon_501717.png" },
    @{ Src = "hero_skill_icon_500258.png"; Dst = "hero_skill_icon_501718.png" },
    # Equipment icon
    @{ Src = "equipment_icon_1050025.png"; Dst = "equipment_icon_1050171.png" }
)

foreach ($pair in $pairings) {
    $srcPath = Join-Path $baseDir $pair.Src
    $dstPath = Join-Path $baseDir $pair.Dst
    if (Test-Path $srcPath) {
        Copy-Item -Path $srcPath -Destination $dstPath -Force
        Write-Host "Cloned $($pair.Src) to $($pair.Dst)"
    } else {
        Write-Host "Source $($pair.Src) not found!"
    }
}
