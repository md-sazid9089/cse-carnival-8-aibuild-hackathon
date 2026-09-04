# One-shot: move the real values out of the tracked .env.example into a local, git-ignored .env,
# then restore .env.example to a placeholder. Prints nothing sensitive.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$example = Join-Path $root ".env.example"
$target = Join-Path $root ".env"

if (Test-Path $target) {
    Write-Output "SKIP: .env already exists, leaving it untouched."
}
else {
    Copy-Item $example $target
    Write-Output "CREATED: .env (git-ignored)"
}

$lines = Get-Content $example
$scrubbed = $lines | ForEach-Object {
    if ($_ -match '^OPENROUTER_API_KEYS=sk-or-') { 'OPENROUTER_API_KEYS=' } else { $_ }
}
Set-Content -Path $example -Value $scrubbed -Encoding UTF8
Write-Output "SCRUBBED: .env.example key line replaced with a blank placeholder"

$leak = Select-String -Path $example -Pattern 'sk-or-v1-' -Quiet
Write-Output "VERIFY: .env.example still contains a key? $([bool]$leak)"
$hasKeys = Select-String -Path $target -Pattern '^OPENROUTER_API_KEYS=sk-or-v1-' -Quiet
Write-Output "VERIFY: .env has keys? $([bool]$hasKeys)"
Write-Output "VERIFY: .env ignored by git? $((git -C $root check-ignore .env) -eq '.env')"
