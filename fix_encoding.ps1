$path = "e:\project\workspace\WOS-Commander\app\index.tsx"
$string = Get-Content $path -Raw -Encoding UTF8
$cp949 = [System.Text.Encoding]::GetEncoding(949)
$originalBytes = $cp949.GetBytes($string)
[System.IO.File]::WriteAllBytes($path, $originalBytes)
Write-Host "Encoding fixed."
