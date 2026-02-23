$ErrorActionPreference = "Stop"

$pythonCmd = if ($env:PYTHON_EXECUTABLE) { $env:PYTHON_EXECUTABLE } else { "python" }

Write-Host "Using Python executable: $pythonCmd"

# --- Ensure all project dependencies are installed so --collect-all works ---
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Write-Host "Installing project dependencies into build Python..."
& $pythonCmd -m pip install pyinstaller
& $pythonCmd -m pip install "$repoRoot"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install gpt-engineer into the build Python. Cannot bundle dependencies."
    exit 1
}

# Quick sanity check: the packages PyInstaller needs to collect must be importable
foreach ($pkg in @("gpt_engineer", "langchain", "langchain_openai", "langchain_community", "langchain_anthropic", "openai", "tiktoken", "tiktoken_ext", "rich")) {
    & $pythonCmd -c "import $pkg" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Package '$pkg' is not importable — --collect-all will skip it."
    }
}

$backendDir = Join-Path $PSScriptRoot "..\backend"
$distDir = Join-Path $backendDir "dist"
$buildDir = Join-Path $backendDir "build"

if (Test-Path $distDir) {
    Remove-Item -Path $distDir -Recurse -Force
}

if (Test-Path $buildDir) {
    Remove-Item -Path $buildDir -Recurse -Force
}

$collectArgs = @(
    "--paths", "$repoRoot",
    "--add-data", "$repoRoot\gpt_engineer\preprompts;gpt_engineer\preprompts",
    "--add-data", "$repoRoot\gpt_engineer\applications\web_local\static;gpt_engineer\applications\web_local\static",
    "--collect-all", "gpt_engineer",
    "--collect-all", "langchain",
    "--collect-all", "langchain_openai",
    "--collect-all", "langchain_community",
    "--collect-all", "langchain_anthropic",
    "--collect-all", "openai",
    "--collect-all", "tiktoken",
    "--collect-all", "tiktoken_ext",
    "--collect-all", "rich"
)

Write-Host "Building gpte-web-backend.exe"
& $pythonCmd -m PyInstaller `
    --noconfirm --clean --onefile `
    --name gpte-web-backend `
    --distpath $distDir `
    --workpath $buildDir `
    "$backendDir\web_backend_entry.py" `
    @collectArgs

Write-Host "Building gpte-cli.exe"
& $pythonCmd -m PyInstaller `
    --noconfirm --clean --onefile `
    --name gpte-cli `
    --distpath $distDir `
    --workpath $buildDir `
    "$backendDir\gpte_cli_entry.py" `
    @collectArgs

Write-Host "Standalone backend binaries built in $distDir"
