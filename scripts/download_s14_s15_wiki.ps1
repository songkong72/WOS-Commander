# S13-S15 Hero Wiki Download Script
$heroes = @(
    # S13
    @{ name = "vulcanus"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ec%98%ac%ec%b9%b4%eb%88%84%ec%8a%a4/" },
    @{ name = "flora"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ed%94%8c%eb%a1%9c%eb%9d%bc/" },
    
    # S14
    @{ name = "elif"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ec%97%98%eb%a6%ac%ed%94%84/" },
    @{ name = "dominica"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%8f%84%eb%af%b8%eb%8b%88%ec%b9%b4/" },
    @{ name = "cara"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ec%b9%b4%eb%9d%bc/" },
    
    # S15
    @{ name = "hank"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/38857/" },
    @{ name = "estella"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ec%97%90%ec%8a%a4%ed%85%94%eb%9d%bc/" },
    @{ name = "vivica"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%b9%84%eb%b9%84%ec%b9%b4/" }
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
