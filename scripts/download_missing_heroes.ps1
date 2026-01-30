# S13-S15 누락된 영웅들 다운로드
$heroes = @(
    @{ name = "gisela"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ea%b8%b0%ec%a0%a4%eb%9d%bc/" },
    @{ name = "vulcanus"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ec%98%ac%ec%b9%b4%eb%88%84%ec%8a%a4/" },
    @{ name = "ligeia"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%a6%ac%ec%a7%80%ec%95%84/" },
    @{ name = "hank"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/38857/" }
)

foreach ($hero in $heroes) {
    $filename = "docs/$($hero.name)_wiki_ko.html"
    Write-Host "Downloading $($hero.name)..."
    try {
        Invoke-WebRequest -Uri $hero.url -UserAgent "Mozilla/5.0" -OutFile $filename
        Write-Host "  [OK] Saved to $filename"
        Start-Sleep -Milliseconds 500
    } catch {
        Write-Host "  [FAILED] $($_.Exception.Message)"
    }
}

Write-Host "Download complete!"
