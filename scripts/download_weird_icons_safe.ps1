$heroes = @("elif", "dominica", "cara")
$baseUrl = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads"

foreach ($hero in $heroes) {
    $htmlFile = "docs/${hero}_wiki_ko.html"
    if (Test-Path $htmlFile) {
        Write-Host "Processing $hero..."
        $content = Get-Content $htmlFile -Raw
        
        # 이미지 태그에서 src 추출
        $pattern = 'src="(https://gom-s3-user-avatar\.s3\.us-west-2\.amazonaws\.com/wp-content/uploads/[^"]+)"'
        $matches = [regex]::Matches($content, $pattern)
        
        foreach ($match in $matches) {
            $url = $match.Groups[1].Value
            $filename = $url.Split('/')[-1]
            
            # 영문 패턴만 다운로드
            if ($filename -match "IMG_" -or $filename -match "Dominic_" -or $filename -match "Cara_" -or $filename -match "cara_") {
                $dest = "assets/images/skill-icons/$filename"
                if (-not (Test-Path $dest)) {
                    Write-Host "  Downloading $filename..."
                    try {
                        Invoke-WebRequest -Uri $url -OutFile $dest -UserAgent "Mozilla/5.0"
                    } catch {
                        Write-Host "    [FAILED] $url"
                    }
                } else {
                    Write-Host "  [SKIP] $filename (already exists)"
                }
            }
        }
    }
}
