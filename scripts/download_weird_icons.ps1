$heroes = @("freya", "elif", "dominica", "cara")
$baseUrl = "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads"

foreach ($hero in $heroes) {
    $htmlFile = "docs/${hero}_wiki_ko.html"
    if (Test-Path $htmlFile) {
        Write-Host "Processing $hero..."
        $content = Get-Content $htmlFile -Raw
        
        # 이미지 태그에서 src 추출 (간단한 정규식 사용)
        $pattern = 'src="(https://gom-s3-user-avatar\.s3\.us-west-2\.amazonaws\.com/wp-content/uploads/[^"]+)"'
        $matches = [regex]::Matches($content, $pattern)
        
        foreach ($match in $matches) {
            $url = $match.Groups[1].Value
            $filename = $url.Split('/')[-1]
            
            # 스킬 섹션에 있는 이미지인지 확인하는 것은 복잡하므로, 
            # 특정 패턴(IMG_, Dominic_, Cara_, 守夜人, 小红帽)을 가진 파일만 다운로드
            if ($filename -match "IMG_" -or $filename -match "Dominic_" -or $filename -match "Cara_" -or $filename -match "cara_" -or $filename -match "守夜人" -or $filename -match "小红帽") {
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
