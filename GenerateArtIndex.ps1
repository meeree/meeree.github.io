# GenerateArtIndex.ps1

# 1. Set your folder name
$directory = "art"

# 2. Path to the generated index.html
$outputFile = Join-Path $directory "index.html"

# 3. HTML header
$htmlStart = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Index of /art/</title>
</head>
<body>
    <h1>Index of /art/</h1>
    <ul>
"@

# 4. HTML footer
$htmlEnd = @"
    </ul>
</body>
</html>
"@

# 5. Begin assembling
$htmlContent = $htmlStart

# 6. Enumerate files (exclude index.html itself)
Get-ChildItem -Path $directory -File |
  Where-Object { $_.Name -ne "index.html" } |
  ForEach-Object {
    $name = $_.Name
    # URL-encode names with spaces/special chars
    $link = [uri]::EscapeUriString($name)
    $htmlContent += "        <li><a href=""$link"">$name</a></li>`r`n"
  }

# 7. Finish HTML
$htmlContent += $htmlEnd

# 8. Write to disk (UTF-8)
Set-Content -Path $outputFile -Value $htmlContent -Encoding UTF8

Write-Host "Generated $outputFile"
