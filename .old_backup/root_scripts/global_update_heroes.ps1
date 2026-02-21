
$files = Get-ChildItem -Include *.html -Path ".", "docs" -Recurse

$replacements = @{
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/11/wuming.jpg" = "./assets/images/heroes/wuming.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/11/rene.jpg" = "./assets/images/heroes/rene.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/11/wayne.jpg" = "./assets/images/heroes/wayne.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/02/20240222_2.jpg" = "./assets/images/heroes/edith.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/02/20240222_1.jpg" = "./assets/images/heroes/gordon.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/02/20240222_3.jpg" = "./assets/images/heroes/bradley.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/07/5.jpg" = "./assets/images/heroes/gato.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/07/6.jpg" = "./assets/images/heroes/sonya.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/07/7.jpg" = "./assets/images/heroes/hendrick.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/magnus.jpg" = "./assets/images/heroes/magnus.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/fred.jpg" = "./assets/images/heroes/fred.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/xura.jpg" = "./assets/images/heroes/xura.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/12/gregory350.jpg" = "./assets/images/heroes/gregory.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/12/freya350.jpg" = "./assets/images/heroes/freya.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/12/blanchette350.jpg" = "./assets/images/heroes/blanchette.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/03/eleonora.jpg" = "./assets/images/heroes/eleonora.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/03/Lloyd.jpg" = "./assets/images/heroes/lloyd.jpg"
    "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/03/rufus.jpg" = "./assets/images/heroes/rufus.jpg"
}

# Note: Add S12-S15 as well
$replacements["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8FHervor-1.jpg"] = "./assets/images/heroes/hervor.jpg"
$replacements["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8Fkarol-1.jpg"] = "./assets/images/heroes/garoal.jpg"
$replacements["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8FLigeia-1.jpg"] = "./assets/images/heroes/ligeia.jpg"
$replacements["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8Fgisela.jpg"] = "./assets/images/heroes/gisela.jpg"
$replacements["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8FFlora.jpg"] = "./assets/images/heroes/flora.jpg"
$replacements["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8Fvulcanus.jpg"] = "./assets/images/heroes/vulcanus.jpg"
$replacements["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/11/Elif.png"] = "./assets/images/heroes/elif.png"
$replacements["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/11/Dominic.png"] = "./assets/images/heroes/dominica.png"
$replacements["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/11/cara.png"] = "./assets/images/heroes/cara.png"
$replacements["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/01/%E6%B1%89%E5%85%8B.png"] = "./assets/images/heroes/hank.png"
$replacements["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/01/%E8%89%BE%E6%96%AF%E9%BB%9B%E6%8B%89%EF%BC%88%E7%94%BB%E5%AE%B6%EF%BC%89.png"] = "./assets/images/heroes/estella.png"
$replacements["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/01/%E7%BB%B4%E8%96%87%E5%8D%A1.png"] = "./assets/images/heroes/vivika.png"

foreach ($file in $files) {
    echo "Updating $($file.FullName)..."
    $content = Get-Content $file.FullName -Raw
    $changed = $false
    foreach ($url in $replacements.Keys) {
        if ($content.Contains($url)) {
            $local = $replacements[$url]
            # If the file is in 'docs/', we might need to adjust relative path if images are in 'assets/'
            # But the projects root seems to be where 'assets/' is.
            # If magnus_wiki.html is in 'docs/', './assets/images/heroes/...' won't work unless there is an assets folder in docs.
            # Usually it should be '../assets/images/heroes/...'
            $finalPath = $local
            if ($file.FullName.Contains("\docs\")) {
                $finalPath = $local.Replace("./", "../")
            }
            $content = $content.Replace($url, $finalPath)
            $changed = $true
        }
    }
    if ($changed) {
        Set-Content $file.FullName $content
    }
}
