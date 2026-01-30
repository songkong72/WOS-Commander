$content = Get-Content 'docs/wuming_wiki_ko.html' -Raw
$pattern = 'hero_skill_icon_\d+\.png'
$matches = [regex]::Matches($content, $pattern)
$matches | ForEach-Object { $_.Value } | Select-Object -Unique
