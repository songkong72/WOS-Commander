$heroes = @(
    @{ Name = "hector"; Url = "https://www.whiteoutsurvival.wiki/heroes/hector/"; Prefix = "5015" },
    @{ Name = "gwen"; Url = "https://www.whiteoutsurvival.wiki/heroes/gwen/"; Prefix = "5017" }
)

$destDir = "assets/images/skill-icons"

foreach ($hero in $heroes) {
    $htmlFile = "docs/$($hero.Name)_wiki_temp.html"
    Write-Host "Fetching $($hero.Name) from $($hero.Url)..."
    
    try {
        Invoke-WebRequest -Uri $hero.Url -OutFile $htmlFile -UserAgent "Mozilla/5.0"
    } catch {
        Write-Host "Failed to fetch page for $($hero.Name)"
        continue
    }

    $content = Get-Content $htmlFile -Raw
    # Regex to find image URLs matching the hero's ID prefix
    # Matches: src=".../hero_skill_icon_501511.png"
    $pattern = "https?://[^""']+/wp-content/uploads/[^""']+/hero_skill_icon_$($hero.Prefix)\d+\.png"
    $matches = [regex]::Matches($content, $pattern)
    
    # Also find equipment icons
    $equipPattern = "https?://[^""']+/wp-content/uploads/[^""']+/equipment_icon_10$($hero.Prefix)\d+\.png"
    $equipMatches = [regex]::Matches($content, $equipPattern)

    $allMatches = $matches + $equipMatches

    if ($allMatches.Count -eq 0) {
        Write-Host "No icons found for $($hero.Name) with prefix $($hero.Prefix)"
        # Try generic search for any image in the page to debug? No, stick to pattern.
    } else {
        foreach ($match in $allMatches) {
            $url = $match.Value
            $filename = [System.IO.Path]::GetFileName($url)
            $localPath = Join-Path $destDir $filename
            
            if (-not (Test-Path $localPath)) {
                Write-Host "Downloading $filename from $url..."
                try {
                    Invoke-WebRequest -Uri $url -OutFile $localPath -UserAgent "Mozilla/5.0"
                } catch {
                    Write-Host "Failed to download $filename"
                }
            } else {
                Write-Host "$filename already exists."
            }
        }
    }
}
