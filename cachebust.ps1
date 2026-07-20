Get-ChildItem d:\ashi_prj\*.html | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace 'js/app\.js\?v=\d+', 'js/app.js'
    $content = $content -replace 'js/api_keys\.js\?v=\d+', 'js/api_keys.js'
    $content = $content -replace 'css/style\.css\?v=\d+', 'css/style.css'
    Set-Content -Path $_.FullName -Value $content -Encoding UTF8
    Write-Host "Cleaned: $($_.Name)"
}
