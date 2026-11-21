# Builds the static site for the site ROOT and deploys it to Cloudflare Workers (static assets).
# Run from anywhere:  powershell -File web\scripts\deploy-cloudflare.ps1
# Needs: Node 22+, the Cloudflare CLI ("npm install --global cf") and a sign-in ("cf auth login").
# Supabase URL and key come from web\.env.production (public values). The build is done in a
# scratch copy so a running "npm run dev" and its .next folder are not disturbed.
param([string]$Name = "kuldiip")   # Worker name = first part of https://<Name>.<account>.workers.dev

$ErrorActionPreference = "Stop"
$web = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tmp = Join-Path (Split-Path (Split-Path $web -Parent) -Parent) "_cfbuild_tmp"   # same drive as node_modules (junction)
$cf  = Join-Path (npm config get prefix).Trim() "cf.cmd"
if (-not (Test-Path $cf)) { throw "cf CLI not found. Run: npm install --global cf" }
if (-not (Test-Path (Join-Path $web ".env.production"))) { throw "web\.env.production is missing (Supabase URL and public key)." }

function Remove-Scratch {
  if (Test-Path (Join-Path $tmp "node_modules")) { cmd /c rmdir "$tmp\node_modules" | Out-Null }   # remove the link only
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
}

Remove-Scratch
try {
  robocopy $web $tmp /E /XD node_modules .next out /XF .env.local .env /NFL /NDL /NJH /NJS | Out-Null
  New-Item -ItemType Junction -Path (Join-Path $tmp "node_modules") -Target (Join-Path $web "node_modules") | Out-Null
  (Get-Content (Join-Path $tmp "package.json") -Raw) -replace '"name": "[^"]*"', "`"name`": `"$Name`"" |
    Set-Content (Join-Path $tmp "package.json") -NoNewline
  Push-Location $tmp
  Remove-Item Env:NEXT_PUBLIC_* -ErrorAction SilentlyContinue
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Build failed." }
  & $cf deploy ./out --message "Deploy from deploy-cloudflare.ps1"
  if ($LASTEXITCODE -ne 0) { throw "Deploy failed." }
}
finally {
  Pop-Location -ErrorAction SilentlyContinue
  Remove-Scratch
}
