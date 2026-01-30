# S6-S15 영웅들의 위키 페이지 다운로드
$heroes = @(
    # S6
    @{ name = "wuming"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%ac%b4%eb%aa%85/" },
    @{ name = "rene"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%a0%88%eb%8b%88/" },
    @{ name = "wayne"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ec%9b%a8%ec%9d%b8/" },
    # S7
    @{ name = "edith"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ec%97%90%eb%94%94%ec%8a%a4/" },
    @{ name = "gordon"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ea%b3%a0%eb%93%a0/" },
    @{ name = "bradley"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%b8%8c%eb%a0%88%eb%93%a4%eb%a6%ac/" },
    # S8
    @{ name = "gato"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ea%b0%80%ed%86%a0/" },
    @{ name = "sonya"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ec%86%8c%eb%83%90/" },
    @{ name = "hendrick"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ed%97%a8%eb%93%9c%eb%a6%ad/" },
    # S9
    @{ name = "magnus"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%a7%88%ea%b7%b8%eb%88%84%ec%8a%a4/" },
    @{ name = "fred"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ed%94%84%eb%a0%88%eb%93%9c/" },
    @{ name = "xura"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ec%87%a0%eb%9d%bc/" },
    # S10
    @{ name = "gregory"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ea%b7%b8%eb%a0%88%ea%b3%a0%eb%a6%ac/" },
    @{ name = "freya"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ed%94%84%eb%a0%88%ec%95%bc/" },
    @{ name = "blanchette"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%b8%94%eb%9e%91%ec%89%ac/" },
    # S11
    @{ name = "eleonora"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ec%97%98%eb%a0%88%ec%98%a4%eb%85%b8%eb%9d%bc/" },
    @{ name = "lloyd"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%a1%9c%ec%9d%b4%eb%93%9c/" },
    @{ name = "rufus"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%a3%a8%ed%8d%bc%ec%8a%a4/" },
    # S12
    @{ name = "hervor"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ed%97%a4%eb%a5%b4%eb%b3%b4%eb%a5%b4/" },
    @{ name = "garoal"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ea%b0%80%eb%a1%9c%ec%96%bc/" },
    @{ name = "ligeia"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%a6%ac%ea%b2%8c%ec%9d%b4%ec%95%84/" },
    # S13
    @{ name = "gisela"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ea%b8%b0%ec%85%80%eb%9d%bc/" },
    @{ name = "flora"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ed%94%8c%eb%a1%9c%eb%9d%bc/" },
    @{ name = "vulcanus"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%b2%8c%ec%b9%b4%eb%88%84%ec%8a%a4/" },
    # S14
    @{ name = "elif"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ec%97%98%eb%a6%ac%ed%94%84/" },
    @{ name = "dominica"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%8f%84%eb%af%b8%eb%8b%88%ec%b9%b4/" },
    @{ name = "cara"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ec%b9%b4%eb%9d%bc/" },
    # S15
    @{ name = "hank"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ed%96%89%ed%81%ac/" },
    @{ name = "estella"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%ec%97%90%ec%8a%a4%ed%85%94%eb%9d%bc/" },
    @{ name = "vivica"; url = "https://www.whiteoutsurvival.wiki/ko/heroes/%eb%b9%84%eb%b9%84%ec%b9%b4/" }
)

foreach ($hero in $heroes) {
    $filename = "docs/$($hero.name)_wiki_ko.html"
    Write-Host "Downloading $($hero.name)..."
    try {
        Invoke-WebRequest -Uri $hero.url -UserAgent "Mozilla/5.0" -OutFile $filename
        Write-Host "  [OK] Saved to $filename"
        Start-Sleep -Milliseconds 500  # 서버에 부담 주지 않기 위해
    } catch {
        Write-Host "  [FAILED] $($_.Exception.Message)"
    }
}

Write-Host "Download complete!"
