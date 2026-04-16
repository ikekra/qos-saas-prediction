$ErrorActionPreference = "Stop"

Write-Host "== QoSCollab backend deploy =="

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  throw "npx was not found. Install Node.js and npm first."
}

Write-Host "[1/4] Checking Supabase CLI availability..."
npx supabase --version | Out-Host

Write-Host "[2/4] Applying database migrations (db push)..."
npx supabase db push

$functions = @(
  "team-api",
  "create-web-service",
  "admin-web-services",
  "payments-create-order",
  "payments-verify",
  "payments-webhook",
  "run-qos-test",
  "sync-publicapis",
  "admin-control-plane"
)

Write-Host "[3/4] Deploying critical Edge Functions..."
foreach ($fn in $functions) {
  Write-Host " - Deploying $fn"
  npx supabase functions deploy $fn
}

Write-Host "[4/4] Done."
Write-Host ""
Write-Host "Post-deploy checks:"
Write-Host " - Open /team and create team with a Pro account."
Write-Host " - Create service from /services/new and /admin/web-services."
Write-Host " - Verify payment success updates team eligibility."

