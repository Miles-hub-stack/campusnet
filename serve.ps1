# Simple PowerShell helper to start a local static server on port 5500
# Usage: Right-click -> Run with PowerShell, or open powershell and run: ./serve.ps1
$port = 5500
if (Get-Command python -ErrorAction SilentlyContinue){
  python -m http.server $port
}elseIf (Get-Command py -ErrorAction SilentlyContinue){
  py -3 -m http.server $port
}else{
  Write-Host "Python not found. You can instead run:"
  Write-Host "  python -m http.server 5500"
}
