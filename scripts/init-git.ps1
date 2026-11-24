# Creates the OrderFlow Git repository with multiple logical commits.
# Run ONCE on a fresh copy, after installing Git for Windows:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\ashis\OneDrive\Desktop\Project Ecommerce\scripts\init-git.ps1"

$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\Users\ashis\OneDrive\Desktop\Project Ecommerce'
Set-Location -LiteralPath $projectRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'git was not found on PATH. Install Git for Windows, then re-run this script.'
}

if (Test-Path '.git') {
  throw 'A Git repository already exists here. This script is for initial setup only.'
}

git init
git branch -M main

# Local identity matching the GitHub account used for this project.
git config user.name 'kashyap801'
git config user.email 'ashish801kashyap@gmail.com'

function Add-And-Commit {
  param(
    [Parameter(Mandatory = $true)][string]$Message,
    [Parameter(Mandatory = $true)][string[]]$Paths
  )
  git add -- $Paths
  git commit -m $Message
}

Add-And-Commit 'chore: initialise npm workspaces and tooling' @(
  'package.json',
  'tsconfig.base.json',
  'eslint.config.js',
  '.prettierrc.json',
  '.prettierignore',
  '.gitignore',
  'scripts/init-git.ps1',
  'apps/api-gateway/package.json',
  'apps/order-service/package.json',
  'apps/inventory-service/package.json',
  'apps/payment-service/package.json',
  'apps/notification-service/package.json',
  'apps/web/package.json',
  'libs/contracts/package.json',
  'libs/common/package.json',
  'libs/testing/package.json'
)

Add-And-Commit 'docs: add Phase 1 architecture, service notes and contracts' @(
  'README.md',
  'apps/api-gateway/README.md',
  'apps/order-service/README.md',
  'apps/inventory-service/README.md',
  'apps/payment-service/README.md',
  'apps/notification-service/README.md',
  'apps/web/README.md',
  'libs/contracts/README.md',
  'libs/common/README.md',
  'libs/testing/README.md',
  'docs/api-documentation.md',
  'docs/architecture.md',
  'docs/database-design.md',
  'docs/event-driven-architecture.md',
  'docs/order-lifecycle.md',
  'docs/technical-decisions.md'
)

Add-And-Commit 'chore: add MongoDB and managed-hosting environment template' @('.env.example')

Add-And-Commit 'docs: add local and hosted deployment guide' @('deploy/README.md')

Add-And-Commit 'docs: track Phase 1 revision and package install commands' @(
  'docs/implementation-checklist.md',
  'docs/install-commands.md'
)

git status --short
git log --oneline --decorate

# Optional once you have created the GitHub repository:
# git remote add origin https://github.com/kashyap801/orderflow.git
# git push -u origin main
