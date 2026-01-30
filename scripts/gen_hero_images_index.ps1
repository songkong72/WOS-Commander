
$files = Get-ChildItem assets/images/heroes | Where-Object { $_.Extension -match "png|jpg|webp" }
$content = "// Auto-generated mapping`nexport const heroImages: { [key: string]: any } = {`n"
foreach ($f in $files) {
    $content += "    '$($f.Name)': require('./$($f.Name)'),`n"
}
$content += "};"
Set-Content assets/images/heroes/index.ts $content
